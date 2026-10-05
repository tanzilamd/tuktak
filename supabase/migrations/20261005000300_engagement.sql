-- Compatible engagement extensions. Existing rows/commands remain valid.
create function public.engagement_trim(value text) returns text language sql immutable
set search_path=pg_catalog,pg_temp as $$
 select btrim(value,E' \t\n\r\v\f'||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279))
$$;
create function public.mention_names(value text) returns text[] language sql immutable
set search_path=public,pg_temp as $$
 select coalesce(array_agg(name order by name),'{}') from (
  select distinct m[1] name from regexp_matches(
   regexp_replace(lower(left(value,240)),'https?://[^[:space:]<>]+','','g'),
   '(?:^|[[:space:]   -     　﻿(\[{])@([a-z0-9_]{3,20})(?![a-z0-9_])','g') m
 ) q
$$;
create function public.poll_option_key(value text) returns text language sql immutable
set search_path=public,pg_temp as $$
 select translate(normalize(regexp_replace(engagement_trim(value),'[[:space:]   -     　﻿]+',' ','g'),NFKC),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
$$;
revoke all on function public.engagement_trim(text),public.mention_names(text),public.poll_option_key(text) from public,anon,authenticated;

alter table public.posts add column updated_at timestamptz,
 add column is_quote boolean not null default false,
 add column quoted_post_id uuid references public.posts(id) on delete set null;
alter table public.posts drop constraint posts_body_check;
alter table public.posts add constraint posts_body_check check(char_length(body)<=240 and (public.has_text(body) or (is_quote and body=''))),
 add constraint posts_quote_check check((is_quote or quoted_post_id is null) and quoted_post_id is distinct from id);
create index posts_quote_original on public.posts(quoted_post_id) where quoted_post_id is not null;
alter table public.comments add column parent_id uuid references public.comments(id) on delete cascade;
create index comments_parent on public.comments(parent_id) where parent_id is not null;
create function public.check_comment_parent() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.parent_id is not null and not exists(select 1 from comments where id=new.parent_id and post_id=new.post_id and parent_id is null and id<>new.id) then raise exception 'invalid_parent'; end if;
 return new;
end $$;
revoke all on function public.check_comment_parent() from public,anon,authenticated;
create trigger comments_one_level before insert or update of parent_id,post_id on public.comments for each row execute function public.check_comment_parent();
create function public.visible_comment(target uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from comments c where c.id=target and not c.hidden and visible_post(c.post_id) and visible_user(c.author_id) and not is_muted(c.author_id)
  and (c.parent_id is null or exists(select 1 from comments root where root.id=c.parent_id and not root.hidden and visible_user(root.author_id) and not is_muted(root.author_id))))
$$;
revoke all on function public.visible_comment(uuid) from public;
grant execute on function public.visible_comment(uuid) to anon,authenticated;
drop policy comments_read on public.comments;
create policy comments_read on public.comments for select using(public.visible_comment(id));

create table public.polls (
 post_id uuid primary key references public.posts(id) on delete cascade,
 expires_at timestamptz not null
);
create table public.poll_options (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.polls(post_id) on delete cascade,
 position smallint not null check(position between 1 and 4),
 body text not null check(char_length(body) between 1 and 60 and public.has_text(body)),
 option_key text generated always as (public.poll_option_key(body)) stored,
 unique(post_id,position),unique(post_id,option_key),unique(post_id,id)
);
create table public.poll_votes (
 post_id uuid not null references public.polls(post_id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 option_id uuid not null,
 primary key(post_id,user_id),
 foreign key(post_id,option_id) references public.poll_options(post_id,id) on delete cascade
);
create index poll_votes_totals on public.poll_votes(post_id,option_id);
create table public.mention_receipts (
 content_id uuid not null,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 comment_id uuid references public.comments(id) on delete cascade,
 primary key(content_id,recipient_id),
 check(content_id=coalesce(comment_id,post_id))
);
create index mention_receipts_post on public.mention_receipts(post_id);
create index mention_receipts_comment on public.mention_receipts(comment_id) where comment_id is not null;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.mention_receipts enable row level security;
create policy polls_read on public.polls for select using(public.visible_post(post_id));
create policy poll_options_read on public.poll_options for select using(public.visible_post(post_id));
revoke all on public.polls,public.poll_options,public.poll_votes,public.mention_receipts from anon,authenticated;
grant select on public.polls,public.poll_options to anon,authenticated;
-- Neither vote identities nor notification receipts have a caller SELECT grant/policy.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in ('follow','reaction','comment','reply','mention','quote'));
drop policy notification_own on public.notifications;
create policy notification_own on public.notifications for select to authenticated using(
 recipient_id=auth.uid() and public.visible_user(actor_id) and
 (kind in ('follow','reaction','comment') or (not public.is_muted(actor_id) and public.visible_post(post_id) and (comment_id is null or public.visible_comment(comment_id))))
);

-- Recipient-perspective visibility is internal only, never an account/relationship oracle.
create function public.engagement_can_receive(recipient uuid,pid uuid,cid uuid default null) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select recipient<>auth.uid() and visible_user(recipient)
 and not exists(select 1 from mutes where muter_id=recipient and muted_id=auth.uid())
 and exists(select 1 from posts p join user_roles r on r.user_id=p.author_id where p.id=pid and not p.hidden and not r.suspended and not blocked(recipient,p.author_id) and not exists(select 1 from mutes where muter_id=recipient and muted_id=p.author_id))
 and (cid is null or exists(select 1 from comments c join user_roles r on r.user_id=c.author_id where c.id=cid and not c.hidden and not r.suspended and not blocked(recipient,c.author_id) and not exists(select 1 from mutes where muter_id=recipient and muted_id=c.author_id)
  and (c.parent_id is null or exists(select 1 from comments root join user_roles rr on rr.user_id=root.author_id where root.id=c.parent_id and not root.hidden and not rr.suspended and not blocked(recipient,root.author_id) and not exists(select 1 from mutes where muter_id=recipient and muted_id=root.author_id)))))
$$;
create function public.engagement_notify(recipient uuid,event_kind text,pid uuid,cid uuid default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if engagement_can_receive(recipient,pid,cid) then
  insert into notifications(recipient_id,actor_id,kind,post_id,comment_id,event_key)
  values(recipient,auth.uid(),event_kind,pid,cid,event_kind||':'||coalesce(cid,pid)||':'||recipient) on conflict do nothing;
 end if;
end $$;
create function public.emit_mentions(value text,old_value text,pid uuid,cid uuid,locked_people uuid[]) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare person uuid; fresh boolean;
begin
 for person in select p.id from profiles p where p.id=any(locked_people) and p.username=any(mention_names(value)) and engagement_can_receive(p.id,pid,cid) loop
  insert into mention_receipts(content_id,recipient_id,post_id,comment_id) values(coalesce(cid,pid),person,pid,cid) on conflict do nothing;
  fresh:=found;
  -- Existing old-body mentions are not newly added on an upgraded legacy post.
  if fresh and not exists(select 1 from profiles p where p.id=person and p.username=any(mention_names(coalesce(old_value,''))))
   and not exists(select 1 from notifications n where n.recipient_id=person and n.actor_id=auth.uid() and n.post_id=pid and n.comment_id is not distinct from cid and n.kind in ('comment','reply','quote')) then
   perform engagement_notify(person,'mention',pid,cid);
  end if;
 end loop;
end $$;
revoke all on function public.engagement_can_receive(uuid,uuid,uuid),public.engagement_notify(uuid,text,uuid,uuid),public.emit_mentions(text,text,uuid,uuid,uuid[]) from public,anon,authenticated;

-- Explicit public projections: no Auth/private records are serialized.
create function public.engagement_profile(target uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'accent',p.accent,'status',p.status) from profiles p where p.id=target and visible_user(p.id)
$$;
create function public.resolved_mentions(value text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(p.username order by p.username),'[]') from profiles p where p.username=any((mention_names(value))[1:5]) and visible_user(p.id) and not is_muted(p.id)
$$;
create function public.poll_state(target uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('expires_at',p.expires_at,'options',(
  select jsonb_agg(jsonb_build_object('id',o.id,'body',o.body,'votes',coalesce(v.total,0)) order by o.position)
  from poll_options o left join (select option_id,count(*) total from poll_votes where post_id=target group by option_id) v on v.option_id=o.id where o.post_id=target),
  'selected_option',(select option_id from poll_votes where post_id=target and user_id=auth.uid()))
 from polls p where p.post_id=target and visible_post(target)
$$;
revoke all on function public.engagement_profile(uuid),public.resolved_mentions(text),public.poll_state(uuid) from public,anon,authenticated;
create or replace function public.post_stats(ids uuid[]) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_object_agg(p.id::text,jsonb_build_object(
  'reaction_counts',coalesce((select jsonb_object_agg(kind,total) from (select r.kind,count(*) total from reactions r where r.post_id=p.id and visible_user(r.user_id) group by r.kind) q),'{}'),
  'current_reaction',(select kind from reactions r where r.post_id=p.id and r.user_id=auth.uid()),
  'comment_count',(select count(*) from comments c where c.post_id=p.id and not c.hidden and visible_user(c.author_id) and not is_muted(c.author_id) and (c.parent_id is null or exists(select 1 from comments root where root.id=c.parent_id and not root.hidden and visible_user(root.author_id) and not is_muted(root.author_id)))),
  'mentions',case when position('@' in p.body)>0 then resolved_mentions(p.body) else '[]'::jsonb end,
  'poll',poll_state(p.id),
  'quote',case when p.is_quote then (select jsonb_build_object('id',q.id,'body',q.body,'created_at',q.created_at,'profiles',engagement_profile(q.author_id),'has_poll',exists(select 1 from polls where post_id=q.id)) from posts q where q.id=p.quoted_post_id and visible_post(q.id)) else null end
 )),'{}') from posts p where p.id=any(ids[1:100]) and visible_post(p.id)
$$;
create function public.discussion_comments(pid uuid,focus_id uuid default null) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with recent as materialized (
  select c.* from comments c where c.post_id=pid and visible_comment(c.id) order by (c.id=focus_id) desc nulls last,c.created_at desc,c.id desc limit 100
 ), selected as (
  select * from recent union select root.* from comments root join recent child on child.parent_id=root.id where visible_comment(root.id)
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'post_id',c.post_id,'parent_id',c.parent_id,'author_id',c.author_id,'body',c.body,'created_at',c.created_at,
  'profiles',engagement_profile(c.author_id),'mentions',case when position('@' in c.body)>0 then resolved_mentions(c.body) else '[]'::jsonb end,
  'reply_count',case when c.parent_id is null then (select count(*) from comments child where child.parent_id=c.id and visible_comment(child.id)) else 0 end) order by c.created_at desc,c.id desc),'[]') from selected c
$$;
revoke all on function public.discussion_comments(uuid,uuid) from public;
grant execute on function public.discussion_comments(uuid,uuid) to anon,authenticated;

create or replace function public.command(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 me uuid:=auth.uid(); target uuid; owner_id uuid; new_id uuid; r reports%rowtype; actor_role text; current_kind text; entry text; tags text[]; priv account_private%rowtype; pub profiles%rowtype;
 entry_parent_author uuid; original_time timestamptz; parent uuid; quote_id uuid; old_body text; body_value text; option_value text; option_position int; duration int; people uuid[]; pair_key text; snapshot_ids uuid[]; unread_ids uuid[]; snapshot_entries jsonb; remaining int;
begin
 if me is null then raise exception 'authentication_required'; end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null) then raise exception 'email_unverified'; end if;
 select role into actor_role from user_roles where user_id=me;
 if exists(select 1 from user_roles where user_id=me and suspended) and action not in ('delete_account') then raise exception 'account_suspended'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 if payload ? 'id' then target:=(payload->>'id')::uuid; end if;
 -- All affected pairs use one global ordering; never take another user's command lock.
 if action in ('follow','block','mute') then owner_id:=target;
 elsif action in ('comment','react','vote_poll') then select author_id into owner_id from posts where id=target;
 elsif action='report' then
  if payload->>'target_type'='user' then owner_id:=target;
  elsif payload->>'target_type'='post' then select author_id into owner_id from posts where id=target;
  elsif payload->>'target_type'='comment' then select author_id into owner_id from comments where id=target; end if;
 end if;
 people:=array[owner_id];
 if action in ('post','edit_post','comment') then
  body_value:=engagement_trim(coalesce(payload->>'body',''));
  if cardinality(mention_names(body_value))>5 then raise exception 'mention_limit'; end if;
  people:=people||array(select id from profiles where username=any(mention_names(body_value)));
 end if;
 if action='post' and nullif(payload->>'quote_id','') is not null then
  quote_id:=(payload->>'quote_id')::uuid;
  select case when is_quote then quoted_post_id else id end into quote_id from posts where id=quote_id;
  people:=people||array(select author_id from posts where id=quote_id);
 end if;
 if action='comment' and nullif(payload->>'parent_id','') is not null then
  parent:=(payload->>'parent_id')::uuid;
  select coalesce(parent_id,id) into parent from comments where id=parent and post_id=target;
  people:=people||array(select author_id from comments where id=parent);
 end if;
 for pair_key in select distinct 'pair:'||least(me::text,person::text)||':'||greatest(me::text,person::text) from unnest(people) person where person is not null and person<>me order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended(pair_key,0));
 end loop;
 -- Waits must not preserve an earlier suspension/verification decision.
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null) then raise exception 'email_unverified'; end if;
 if exists(select 1 from user_roles where user_id=me and suspended) and action<>'delete_account' then raise exception 'account_suspended'; end if;

 case action
 when 'post' then
  if payload ? 'quote_id' and (quote_id is null or not visible_post(quote_id)) then raise exception 'not_found'; end if;
  if quote_id is not null and payload ? 'poll_options' then raise exception 'invalid_poll'; end if;
  perform take_rate('post',10,case when quote_id is null then body_value else quote_id||':'||body_value end);
  insert into posts(author_id,body,mood,is_quote,quoted_post_id) values(me,body_value,nullif(payload->>'mood',''),quote_id is not null,quote_id) returning id into new_id;
  if payload ? 'poll_options' then
   if jsonb_typeof(payload->'poll_options')<>'array' or jsonb_array_length(payload->'poll_options') not between 2 and 4 then raise exception 'invalid_poll'; end if;
   if exists(select 1 from jsonb_array_elements(payload->'poll_options') o where jsonb_typeof(o)<>'string') then raise exception 'invalid_poll'; end if;
   duration:=(payload->>'poll_duration')::int;
   if duration is null or duration not in (3600,21600,86400,259200,604800) then raise exception 'invalid_poll'; end if;
   insert into polls(post_id,expires_at) values(new_id,clock_timestamp()+make_interval(secs=>duration));
   option_position:=0;
   for option_value in select jsonb_array_elements_text(payload->'poll_options') loop
    option_position:=option_position+1;
    if option_value is null or char_length(engagement_trim(option_value)) not between 1 and 60 or not has_text(option_value) then raise exception 'invalid_poll'; end if;
    insert into poll_options(post_id,position,body) values(new_id,option_position,engagement_trim(option_value));
   end loop;
  end if;
  select array_agg(t) into tags from (select distinct lower(m[1]) t from regexp_matches(body_value,'(?:^|[[:space:]])#([a-zA-Z0-9_ঀ-ঃঅ-ঌএঐও-নপ-রলশ-হ়-ৄেৈো-ৎৗড়ঢ়য়-ৣ০-৯ৰৱ৴-৹ৼ৾]{1,40})','g') m limit 5) q;
  foreach entry in array coalesce(tags,'{}') loop
   insert into hashtags(tag) values(entry) on conflict do nothing;
   insert into post_hashtags values(new_id,entry);
  end loop;
  if quote_id is not null then
   select author_id into owner_id from posts where id=quote_id;
   perform engagement_notify(owner_id,'quote',new_id);
  end if;
  perform emit_mentions(body_value,'',new_id,null,people);
  return jsonb_build_object('id',new_id);
 when 'edit_post' then
  select body,created_at into old_body,original_time from posts where id=target and author_id=me for update;
  if not found or not visible_post(target) then raise exception 'not_found'; end if;
  if clock_timestamp()>=original_time+interval '15 minutes' then raise exception 'edit_expired'; end if;
  if payload ? 'poll_options' or payload ? 'quote_id' or payload ? 'mood' then raise exception 'invalid_action'; end if;
  if old_body=body_value then return jsonb_build_object('id',target); end if;
  perform take_rate('edit_post',10,target||':'||body_value);
  update posts set body=body_value,updated_at=clock_timestamp() where id=target;
  delete from post_hashtags where post_id=target;
  select array_agg(t) into tags from (select distinct lower(m[1]) t from regexp_matches(body_value,'(?:^|[[:space:]])#([a-zA-Z0-9_ঀ-ঃঅ-ঌএঐও-নপ-রলশ-হ়-ৄেৈো-ৎৗড়ঢ়য়-ৣ০-৯ৰৱ৴-৹ৼ৾]{1,40})','g') m limit 5) q;
  foreach entry in array coalesce(tags,'{}') loop
   insert into hashtags(tag) values(entry) on conflict do nothing;
   insert into post_hashtags values(target,entry);
  end loop;
  perform emit_mentions(body_value,old_body,target,null,people);
  return jsonb_build_object('id',target);
 when 'vote_poll' then
  if not visible_post(target) then raise exception 'not_found'; end if;
  if not exists(select 1 from polls where post_id=target and clock_timestamp()<expires_at) then raise exception 'poll_closed'; end if;
  if not exists(select 1 from poll_options where post_id=target and id=(payload->>'option_id')::uuid) then raise exception 'invalid_poll'; end if;
  perform take_rate('vote_poll',100);
  insert into poll_votes(post_id,user_id,option_id) values(target,me,(payload->>'option_id')::uuid) on conflict(post_id,user_id) do update set option_id=excluded.option_id;

 when 'delete_post' then
  delete from posts where id=target and author_id=me;
 when 'comment' then
  if not visible_post(target) then raise exception 'not_found'; end if;
  if payload ? 'parent_id' then
   if parent is null then raise exception 'invalid_parent'; end if;
   perform 1 from comments where id=parent and post_id=target for key share;
   if not found or not visible_comment(parent) then raise exception 'invalid_parent'; end if;
  end if;
  perform take_rate('comment',20,body_value);
  insert into comments(post_id,author_id,body,parent_id) values(target,me,body_value,parent) returning id into new_id;
  select author_id into owner_id from posts where id=target;
  perform engagement_notify(owner_id,'comment',target,new_id);
  if parent is not null then
   select author_id into entry_parent_author from comments where id=parent;
   if entry_parent_author is distinct from owner_id then perform engagement_notify(entry_parent_author,'reply',target,new_id); end if;
  end if;
  perform emit_mentions(body_value,'',target,new_id,people);
  return jsonb_build_object('id',new_id);
 when 'delete_comment' then
  delete from comments where id=target and author_id=me;
 when 'react' then
  if not visible_post(target) then raise exception 'not_found'; end if;
  perform take_rate('react',100);
  select kind into current_kind from reactions where post_id=target and user_id=me;
  delete from notifications where event_key='reaction:'||target||':'||me;
  if current_kind=payload->>'kind' then delete from reactions where post_id=target and user_id=me;
  else
   insert into reactions(post_id,user_id,kind) values(target,me,payload->>'kind') on conflict(post_id,user_id) do update set kind=excluded.kind;
   select author_id into owner_id from posts where id=target;
   if owner_id<>me then insert into notifications(recipient_id,actor_id,kind,post_id,event_key) values(owner_id,me,'reaction',target,'reaction:'||target||':'||me); end if;
  end if;
 when 'follow' then
  if target=me then raise exception 'self_follow'; end if;
  if coalesce((payload->>'enabled')::boolean,true) and not visible_user(target) then raise exception 'not_found'; end if;
  perform take_rate('follow',40);
  if coalesce((payload->>'enabled')::boolean,true) then
   insert into follows values(me,target,now()) on conflict do nothing;
   insert into notifications(recipient_id,actor_id,kind,event_key) values(target,me,'follow','follow:'||target||':'||me) on conflict do nothing;
  else
   delete from follows where follower_id=me and following_id=target;
   delete from notifications where event_key='follow:'||target||':'||me;
  end if;
 when 'block' then
  if target=me or not exists(select 1 from profiles where id=target) then raise exception 'not_found'; end if;
  perform take_rate('block',40);
  if coalesce((payload->>'enabled')::boolean,true) then
   insert into blocks values(me,target,now()) on conflict do nothing;
   delete from follows where (follower_id=me and following_id=target) or (follower_id=target and following_id=me);
   delete from notifications where (recipient_id=me and actor_id=target) or (recipient_id=target and actor_id=me);
  else delete from blocks where blocker_id=me and blocked_id=target; end if;
 when 'mute' then
  if target=me or (coalesce((payload->>'enabled')::boolean,true) and not visible_user(target)) then raise exception 'not_found'; end if;
  perform take_rate('mute',40);
  if coalesce((payload->>'enabled')::boolean,true) then insert into mutes values(me,target,now()) on conflict do nothing;
  else delete from mutes where muter_id=me and muted_id=target; end if;
 when 'report' then
  perform take_rate('report',5);
  if payload->>'target_type'='post' and not visible_post(target) then raise exception 'not_found'; end if;
  if payload->>'target_type'='comment' and not visible_comment(target) then raise exception 'not_found'; end if;
  if payload->>'target_type'='user' and not visible_user(target) then raise exception 'not_found'; end if;
  insert into reports(reporter_id,target_type,target_id,reason,notes) values(me,payload->>'target_type',target,payload->>'reason',coalesce(payload->>'notes','')) on conflict do nothing;
 when 'profile' then
  -- A stale first-time wizard must not overwrite a profile saved in another tab.
  if coalesce((payload->>'onboarding')::boolean,false) and exists(select 1 from account_private where user_id=me and onboarding_complete) then
   raise exception 'onboarding_complete';
  end if;
  select * into priv from account_private where user_id=me;
  entry:=btrim(coalesce(payload->>'institution',''));
  update account_private set institution=entry,institution_visible=coalesce((payload->>'institution_visible')::boolean,false),onboarding_complete=true where user_id=me;
  update profiles set username=lower(payload->>'username'), display_name=btrim(payload->>'display_name'), bio=coalesce(payload->>'bio',''), education=coalesce(payload->>'education',''),
   institution=case when (payload->>'institution_visible')::boolean then nullif(entry,'') else null end,
   institution_key=case when (payload->>'institution_visible')::boolean then nullif(lower(regexp_replace(entry,'\s+',' ','g')),'') else null end,
   class_year=coalesce(payload->>'class_year',''),ssc_batch=coalesce(payload->>'ssc_batch',''),hsc_batch=coalesce(payload->>'hsc_batch',''),
   hobbies=array(select jsonb_array_elements_text(coalesce(payload->'hobbies','[]'))), status=coalesce(payload->>'status',''), accent=coalesce(payload->>'accent','mango'),discoverable=coalesce((payload->>'discoverable')::boolean,true),updated_at=now() where id=me;
 when 'phone' then
  update account_private set phone=payload->>'phone',phone_verified_at=null where user_id=me;
 when 'inbox_open' then
  select coalesce(array_agg(id),'{}'),coalesce(array_agg(id) filter(where read_at is null),'{}') into snapshot_ids,unread_ids from (
   select n.id,n.read_at from notifications n where n.recipient_id=me and visible_user(n.actor_id)
    and (n.kind in ('follow','reaction','comment') or (not is_muted(n.actor_id) and visible_post(n.post_id) and (n.comment_id is null or visible_comment(n.comment_id))))
   order by n.created_at desc,n.id desc limit 100
  ) q;
  update notifications set read_at=clock_timestamp() where recipient_id=me and id=any(unread_ids) and read_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'post_id',n.post_id,'comment_id',n.comment_id,'read_at',n.read_at,'created_at',n.created_at,'profiles',engagement_profile(n.actor_id)) order by n.created_at desc,n.id desc),'[]') into snapshot_entries from notifications n where n.id=any(snapshot_ids) and n.recipient_id=me and visible_user(n.actor_id)
   and (n.kind in ('follow','reaction','comment') or (not is_muted(n.actor_id) and visible_post(n.post_id) and (n.comment_id is null or visible_comment(n.comment_id))));
  select count(*) into remaining from (select id from notifications n where n.recipient_id=me and n.read_at is null and visible_user(n.actor_id)
   and (n.kind in ('follow','reaction','comment') or (not is_muted(n.actor_id) and visible_post(n.post_id) and (n.comment_id is null or visible_comment(n.comment_id)))) limit 100) q;
  return jsonb_build_object('entries',snapshot_entries,'entryUnreadIds',unread_ids,'unreadCount',remaining);
 when 'read' then
  if payload ? 'ids' and (jsonb_typeof(payload->'ids')<>'array' or jsonb_array_length(payload->'ids')>100) then raise exception 'invalid_action'; end if;
  update notifications set read_at=now() where recipient_id=me and ((target is null and not payload ? 'ids') or id=target or id::text in (select jsonb_array_elements_text(coalesce(payload->'ids','[]'))));
 when 'delete_account' then
  if payload->>'confirmation' is distinct from 'DELETE' then raise exception 'confirmation_required'; end if;
  delete from auth.users where id=me;
 when 'moderate' then
  if not is_staff() then raise exception 'forbidden'; end if;
  if target is null then raise exception 'not_found'; end if;
  select * into r from reports where id=target for update;
  if not found then raise exception 'not_found'; end if;
  if payload->>'decision' in ('hide','remove') then
   if r.target_type='post' then
    if payload->>'decision'='hide' then update posts set hidden=true where id=r.target_id; else delete from posts where id=r.target_id; end if;
   elsif r.target_type='comment' then
    if payload->>'decision'='hide' then update comments set hidden=true where id=r.target_id; else delete from comments where id=r.target_id; end if;
   else raise exception 'invalid_action'; end if;
  elsif payload->>'decision'='suspend' then
   if r.target_type='user' then owner_id:=r.target_id;
   elsif r.target_type='post' then select author_id into owner_id from posts where id=r.target_id;
   else select author_id into owner_id from comments where id=r.target_id; end if;
   if owner_id=me or exists(select 1 from user_roles where user_id=owner_id and role='admin') or (actor_role<>'admin' and exists(select 1 from user_roles where user_id=owner_id and role='moderator')) then raise exception 'forbidden'; end if;
   update user_roles set suspended=true where user_id=owner_id;
  elsif payload->>'decision'<>'dismiss' then raise exception 'invalid_action'; end if;
  update reports set status=case when payload->>'decision'='dismiss' then 'dismissed' else 'resolved' end,resolved_at=now() where id=target;
  insert into moderation_actions(actor_id,action,target_type,target_id,report_id,note) values(me,payload->>'decision',r.target_type,r.target_id,r.id,coalesce(payload->>'note',''));
 when 'unsuspend' then
  if not is_staff() or (actor_role<>'admin' and exists(select 1 from user_roles where user_id=target and role<>'user')) then raise exception 'forbidden'; end if;
  update user_roles set suspended=false where user_id=target;
  insert into moderation_actions(actor_id,action,target_type,target_id) values(me,'unsuspend','user',target);
 when 'role' then
  if actor_role<>'admin' or target=me or payload->>'role' not in ('user','moderator') or exists(select 1 from user_roles where user_id=target and role='admin') then raise exception 'forbidden'; end if;
  update user_roles set role=payload->>'role' where user_id=target;
  insert into moderation_actions(actor_id,action,target_type,target_id,note) values(me,'role','user',target,payload->>'role');
 else raise exception 'invalid_action';
 end case;
 return jsonb_build_object('ok',true);
end $$;

