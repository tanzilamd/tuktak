-- Reject absent/null confirmation at the authoritative RPC boundary.
-- Also protect completed profiles against stale first-time onboarding submissions.
-- Preserve identity, RLS, locks, limits and existing grants.
create or replace function public.command(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 me uuid:=auth.uid(); target uuid; owner_id uuid; new_id uuid; r reports%rowtype; actor_role text; current_kind text; entry text; tags text[]; priv account_private%rowtype; pub profiles%rowtype;
begin
 if me is null then raise exception 'authentication_required'; end if;
 if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null) then raise exception 'email_unverified'; end if;
 select role into actor_role from user_roles where user_id=me;
 if exists(select 1 from user_roles where user_id=me and suspended) and action not in ('delete_account') then raise exception 'account_suspended'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 if payload ? 'id' then target:=(payload->>'id')::uuid; end if;
 -- Serialize bilateral interactions with block changes, including concurrent callers.
 if action in ('follow','block','mute') then owner_id:=target;
 elsif action in ('comment','react') then select author_id into owner_id from posts where id=target;
 elsif action='report' then
  if payload->>'target_type'='user' then owner_id:=target;
  elsif payload->>'target_type'='post' then select author_id into owner_id from posts where id=target;
  elsif payload->>'target_type'='comment' then select author_id into owner_id from comments where id=target; end if;
 end if;
 if owner_id is not null and owner_id<>me then
  perform pg_advisory_xact_lock(hashtextextended('pair:'||least(me::text,owner_id::text)||':'||greatest(me::text,owner_id::text),0));
 end if;

 case action
 when 'post' then
  perform take_rate('post',10,btrim(payload->>'body'));
  insert into posts(author_id,body,mood) values(me,btrim(payload->>'body'),nullif(payload->>'mood','')) returning id into new_id;
  -- At most five distinct tags per post; Unicode letters/numbers are supported.
  select array_agg(t) into tags from (select distinct lower(m[1]) t from regexp_matches(payload->>'body','(?:^|[[:space:]])#([a-zA-Z0-9_ঀ-ঃঅ-ঌএঐও-নপ-রলশ-হ়-ৄেৈো-ৎৗড়ঢ়য়-ৣ০-৯ৰৱ৴-৹ৼ৾]{1,40})','g') m limit 5) q;
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
  if payload->>'target_type'='comment' and not exists(select 1 from comments where id=target and not hidden and visible_user(author_id) and visible_post(post_id)) then raise exception 'not_found'; end if;
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
 when 'read' then
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
