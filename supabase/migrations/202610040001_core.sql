-- All mutations go through narrowly scoped, authenticated RPCs; no browser service key.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username = lower(username) and username ~ '^[a-z0-9_]{3,20}$' and username not in ('admin','api','login','signup','settings','support','moderator','system','discover','notifications','onboarding','auth','post','tag','u','help','tuktak','www')),
 display_name text not null check(char_length(btrim(display_name)) between 1 and 40),
 bio text not null default '' check(char_length(bio)<=100),
 education text not null default '' check(education in ('','স্কুলে পড়ি','কলেজে পড়ি','মাদ্রাসায় পড়ি','বিশ্ববিদ্যালয়ে পড়ি','ভর্তি প্রস্তুতি নিচ্ছি','গ্যাপ ইয়ার','পড়াশোনায় বিরতিতে','পড়াশোনা শেষ','বর্তমানে পড়াশোনা করছি না','অন্যান্য')),
 -- Only a deliberately published institution is stored here. Hidden values live in account_private.
 institution text check(char_length(institution)<=100), institution_key text,
 class_year text not null default '' check(char_length(class_year)<=40),
 ssc_batch text not null default '' check(ssc_batch ~ '^([12][0-9]{3})?$'),
 hsc_batch text not null default '' check(hsc_batch ~ '^([12][0-9]{3})?$'),
 hobbies text[] not null default '{}' check(cardinality(hobbies)<=5 and hobbies <@ array['গেমিং','ফুটবল','ক্রিকেট','সিনেমা','সিরিজ','বই','গান','আঁকাআঁকি','ফটোগ্রাফি','প্রযুক্তি','প্রোগ্রামিং','বিতর্ক','ভ্রমণ','রান্না','ফিটনেস','অ্যানিমে','লেখালেখি','মিম','অন্যান্য']::text[]),
 status text not null default '' check(char_length(status)<=12),
 accent text not null default 'mango' check(accent in ('mango','mint','berry','sky')),
 discoverable boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.account_private (
 user_id uuid primary key references public.profiles on delete cascade,
 phone text not null check(phone ~ '^\+8801[3-9][0-9]{8}$'),
 phone_verified_at timestamptz, institution text not null default '' check(char_length(institution)<=100),
 institution_visible boolean not null default false,
 onboarding_complete boolean not null default false
);
create table public.user_roles (
 user_id uuid primary key references public.profiles on delete cascade,
 role text not null default 'user' check(role in ('user','moderator','admin')),
 suspended boolean not null default false
);
create table public.posts (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles on delete cascade,
 body text not null check(char_length(body)<=240 and char_length(btrim(body,E' \t\n\r'))>0),
 mood text check(mood in ('😄 জমে গেছে','😂 হাসি পাচ্ছে','😭 আর পারি না','😵‍💫 মাথা শেষ','😌 শান্তি','😤 বিরক্ত','🥹 ইমোশনাল','🤔 ভাবছি','🔥 উত্তেজিত','🎲 র‍্যান্ডম')),
 hidden boolean not null default false, created_at timestamptz not null default now()
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts on delete cascade,
 author_id uuid not null references public.profiles on delete cascade,
 body text not null check(char_length(body)<=180 and char_length(btrim(body,E' \t\n\r'))>0),
 hidden boolean not null default false, created_at timestamptz not null default now()
);
create table public.reactions (
 post_id uuid not null references public.posts on delete cascade, user_id uuid not null references public.profiles on delete cascade,
 kind text not null check(kind in ('love','haha','relate','fire')),created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create table public.follows (
 follower_id uuid not null references public.profiles on delete cascade, following_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),primary key(follower_id,following_id),check(follower_id<>following_id)
);
create table public.blocks (
 blocker_id uuid not null references public.profiles on delete cascade, blocked_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create table public.mutes (
 muter_id uuid not null references public.profiles on delete cascade, muted_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(), primary key(muter_id,muted_id),check(muter_id<>muted_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles on delete cascade,
 actor_id uuid not null references public.profiles on delete cascade,
 kind text not null check(kind in ('follow','reaction','comment')),
 post_id uuid references public.posts on delete cascade,comment_id uuid references public.comments on delete cascade,
 event_key text not null unique,read_at timestamptz,created_at timestamptz not null default now(),check(recipient_id<>actor_id)
);
create table public.reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid references public.profiles on delete set null,
 target_type text not null check(target_type in ('post','comment','user')), target_id uuid not null,
 reason text not null check(reason in ('হয়রানি','অপমান বা bullying','স্প্যাম','ভুয়া পরিচয়','অনুপযুক্ত কনটেন্ট','ব্যক্তিগত তথ্য প্রকাশ','অন্যান্য')),
 notes text not null default '' check(char_length(notes)<=500),status text not null default 'open' check(status in ('open','dismissed','resolved')),
 created_at timestamptz not null default now(),resolved_at timestamptz,
 unique(reporter_id,target_type,target_id)
);
create table public.moderation_actions (
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles on delete set null,
 action text not null, target_type text not null,target_id uuid not null,
 report_id uuid references public.reports on delete set null,
 note text not null default '' check(char_length(note)<=500), created_at timestamptz not null default now()
);
create table public.hashtags (tag text primary key check(char_length(tag) between 1 and 40));
create table public.post_hashtags (post_id uuid references public.posts on delete cascade, tag text references public.hashtags on delete cascade,primary key(post_id,tag));
create table public.action_receipts (user_id uuid references public.profiles on delete cascade, action text not null, fingerprint text, created_at timestamptz not null default now());
create index posts_feed on public.posts(created_at desc,id desc) where not hidden;
create index posts_author on public.posts(author_id,created_at desc);
create index comments_thread on public.comments(post_id,created_at desc);
create index follows_reverse on public.follows(following_id);
create index blocks_reverse on public.blocks(blocked_id);
create index profiles_institution on public.profiles(institution_key) where institution_key is not null;
create index notifications_inbox on public.notifications(recipient_id,created_at desc);
create index reports_queue on public.reports(status,created_at);
create index receipts_limits on public.action_receipts(user_id,action,created_at desc);
create index hashtag_lookup on public.post_hashtags(tag,post_id);

create function public.is_staff() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from user_roles where user_id=auth.uid() and role in ('moderator','admin') and not suspended)
$$;
create function public.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a))
$$;
create function public.visible_user(target uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from user_roles where user_id=target and not suspended) and not public.blocked(auth.uid(),target)
$$;
create function public.visible_post(target uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from posts where id=target and not hidden and public.visible_user(author_id) and not exists(select 1 from mutes where muter_id=auth.uid() and muted_id=author_id))
$$;
create function public.is_muted(target uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from mutes where muter_id=auth.uid() and muted_id=target)
$$;
-- The trigger is the only profile creation path: role/identity never trust user metadata.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into profiles(id,username,display_name) values(new.id,lower(new.raw_user_meta_data->>'username'),new.raw_user_meta_data->>'display_name');
 insert into account_private(user_id,phone) values(new.id,new.raw_user_meta_data->>'phone');
 insert into user_roles(user_id) values(new.id);
 -- Keep phone out of user metadata/session claims; application auth responses never return a User object.
 update auth.users set raw_user_meta_data=raw_user_meta_data-'phone' where id=new.id;
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table profiles enable row level security;
alter table account_private enable row level security;
alter table user_roles enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table reactions enable row level security;
alter table follows enable row level security;
alter table blocks enable row level security;
alter table mutes enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;
alter table moderation_actions enable row level security;
alter table hashtags enable row level security;
alter table post_hashtags enable row level security;
alter table action_receipts enable row level security;
create policy profiles_read on profiles for select using(public.visible_user(id) or id=auth.uid());
create policy private_own on account_private for select to authenticated using(user_id=auth.uid());
create policy role_own on user_roles for select to authenticated using(user_id=auth.uid());
create policy posts_read on posts for select using(public.visible_post(id));
create policy comments_read on comments for select using(not hidden and public.visible_post(post_id) and public.visible_user(author_id) and not public.is_muted(author_id));
create policy reactions_read on reactions for select using(public.visible_post(post_id) and public.visible_user(user_id));
create policy follows_read on follows for select using(public.visible_user(follower_id) and public.visible_user(following_id));
create policy blocks_own on blocks for select to authenticated using(blocker_id=auth.uid());
create policy mutes_own on mutes for select to authenticated using(muter_id=auth.uid());
create policy notification_own on notifications for select to authenticated using(recipient_id=auth.uid() and public.visible_user(actor_id));
create policy report_staff on reports for select to authenticated using(public.is_staff());
create policy audit_staff on moderation_actions for select to authenticated using(public.is_staff());
-- Tags only come from visible posts. No global count that leaks private interactions.
create policy hashtags_read on hashtags for select using(exists(select 1 from post_hashtags ph where ph.tag=hashtags.tag and public.visible_post(ph.post_id)));
create policy post_hashtags_read on post_hashtags for select using(public.visible_post(post_id));
revoke all on all tables in schema public from anon,authenticated;
grant select on profiles,posts,comments,reactions,follows,hashtags,post_hashtags to anon,authenticated;
grant select on account_private,user_roles,blocks,mutes,notifications,reports,moderation_actions to authenticated;

create function public.take_rate(action_name text,max_count int,body text default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- command() takes one per-user transaction lock, so simultaneous requests cannot overshoot.
 if (select count(*) from action_receipts where user_id=auth.uid() and action=action_name and created_at>now()-interval '10 minutes')>=max_count then raise exception 'rate_limit'; end if;
 if body is not null and exists(select 1 from action_receipts where user_id=auth.uid() and action=action_name and fingerprint=md5(body) and created_at>now()-interval '10 minutes') then raise exception 'duplicate_content'; end if;
 delete from action_receipts where user_id=auth.uid() and created_at<now()-interval '1 day';
 insert into action_receipts(user_id,action,fingerprint) values(auth.uid(),action_name,case when body is null then null else md5(body) end);
end $$;

create function public.command(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 me uuid:=auth.uid(); target uuid; owner_id uuid; new_id uuid; r reports%rowtype; actor_role text; current_kind text; entry text; tags text[]; priv account_private%rowtype; pub profiles%rowtype;
begin
 if me is null then raise exception 'authentication_required'; end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null) then raise exception 'email_unverified'; end if;
 select role into actor_role from user_roles where user_id=me;
 if exists(select 1 from user_roles where user_id=me and suspended) and action not in ('delete_account') then raise exception 'account_suspended'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 if payload ? 'id' then target:=(payload->>'id')::uuid; end if;
 case action
 when 'post' then
  perform take_rate('post',10,btrim(payload->>'body'));
  insert into posts(author_id,body,mood) values(me,btrim(payload->>'body'),nullif(payload->>'mood','')) returning id into new_id;
  -- At most five distinct tags per post; Unicode letters/numbers are supported.
  select array_agg(t) into tags from (select distinct lower(m[1]) t from regexp_matches(payload->>'body','(?:^|[[:space:]])#([a-zA-Z0-9_ঀ-৿]{1,40})','g') m limit 5) q;
  foreach entry in array coalesce(tags,'{}') loop
   insert into hashtags(tag) values(entry) on conflict do nothing;
   insert into post_hashtags values(new_id,entry);
  end loop;
  return jsonb_build_object('id',new_id);
 when 'delete_post' then
  delete from posts where id=target and author_id=me;
 when 'comment' then
  if not visible_post(target) then raise exception 'not_found'; end if;
  perform take_rate('comment',20,btrim(payload->>'body'));
  insert into comments(post_id,author_id,body) values(target,me,btrim(payload->>'body')) returning id into new_id;
  select author_id into owner_id from posts where id=target;
  if owner_id<>me then insert into notifications(recipient_id,actor_id,kind,post_id,comment_id,event_key) values(owner_id,me,'comment',target,new_id,'comment:'||new_id); end if;
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
  if not visible_user(target) then raise exception 'not_found'; end if;
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
  if target=me or not visible_user(target) then raise exception 'not_found'; end if;
  perform take_rate('mute',40);
  if coalesce((payload->>'enabled')::boolean,true) then insert into mutes values(me,target,now()) on conflict do nothing;
  else delete from mutes where muter_id=me and muted_id=target; end if;
 when 'report' then
  perform take_rate('report',5);
  if payload->>'target_type'='post' and not visible_post(target) then raise exception 'not_found'; end if;
  if payload->>'target_type'='comment' and not exists(select 1 from comments where id=target and not hidden and visible_user(author_id) and visible_post(post_id)) then raise exception 'not_found'; end if;
  if payload->>'target_type'='user' and not visible_user(target) then raise exception 'not_found'; end if;
  insert into reports(reporter_id,target_type,target_id,reason,notes) values(me,payload->>'target_type',target,payload->>'reason',coalesce(payload->>'notes','')) on conflict do nothing;
 when 'profile' then
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
 when 'read' then
  update notifications set read_at=now() where recipient_id=me and (target is null or id=target);
 when 'delete_account' then
  if payload->>'confirmation'<>'DELETE' then raise exception 'confirmation_required'; end if;
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

create function public.moderation_queue() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not is_staff() then raise exception 'forbidden'; end if;
 return jsonb_build_object('reports',coalesce((select jsonb_agg(q) from (select r.id,r.target_type,r.target_id,r.reason,r.notes,r.created_at,
 case r.target_type when 'post' then (select body from posts where id=r.target_id) when 'comment' then (select body from comments where id=r.target_id) else (select display_name||' (@'||username||')' from profiles where id=r.target_id) end content
 from reports r where status='open' order by created_at limit 100) q),'[]'),
 'suspended',coalesce((select jsonb_agg(q) from (select p.id,p.username,p.display_name from profiles p join user_roles ur on ur.user_id=p.id where ur.suspended limit 100) q),'[]'),
 'audit',coalesce((select jsonb_agg(q) from (select action,target_type,target_id,note,created_at from moderation_actions order by created_at desc limit 50) q),'[]'));
end $$;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_staff(),public.is_muted(uuid),public.visible_user(uuid),public.visible_post(uuid) to anon,authenticated;
grant execute on function public.command(text,jsonb),public.moderation_queue() to authenticated;

create function public.popular_topics() returns table(tag text,count bigint) language sql stable security definer set search_path=public,pg_temp as $$
 select ph.tag,count(distinct p.author_id) from post_hashtags ph join posts p on p.id=ph.post_id
 where p.created_at>now()-interval '7 days' and visible_post(p.id)
 group by ph.tag order by count(distinct p.author_id) desc,ph.tag limit 6
$$;
create function public.safety_accounts(kind text) returns table(id uuid,username text,display_name text,accent text) language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if kind='blocks' then return query select p.id,p.username,p.display_name,p.accent from profiles p join blocks b on b.blocked_id=p.id where b.blocker_id=auth.uid() limit 100;
 elsif kind='mutes' then return query select p.id,p.username,p.display_name,p.accent from profiles p join mutes m on m.muted_id=p.id where m.muter_id=auth.uid() limit 100;
 else raise exception 'invalid_action';end if;
end $$;
revoke execute on function public.popular_topics(),public.safety_accounts(text) from public;
grant execute on function public.popular_topics() to anon,authenticated;
grant execute on function public.safety_accounts(text) to authenticated;
