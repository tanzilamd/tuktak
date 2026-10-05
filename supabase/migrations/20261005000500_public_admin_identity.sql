-- Public identity is derived from the live authoritative role, never profile/Auth metadata.
-- Additive read-only projections: old clients safely ignore the new boolean keys.
create or replace function public.engagement_profile(target uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'accent',p.accent,'status',p.status,'is_admin',coalesce(r.role='admin',false)) from profiles p left join user_roles r on r.user_id=p.id where p.id=target and visible_user(p.id)
$$;
create or replace function public.post_stats(ids uuid[]) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_object_agg(p.id::text,jsonb_build_object(
  'author_is_admin',coalesce(author_role.role='admin',false),
  'reaction_counts',coalesce((select jsonb_object_agg(kind,total) from (select r.kind,count(*) total from reactions r where r.post_id=p.id and visible_user(r.user_id) group by r.kind) q),'{}'),
  'current_reaction',(select kind from reactions r where r.post_id=p.id and r.user_id=auth.uid()),
  'comment_count',(select count(*) from comments c where c.post_id=p.id and not c.hidden and visible_user(c.author_id) and not is_muted(c.author_id) and (c.parent_id is null or exists(select 1 from comments root where root.id=c.parent_id and not root.hidden and visible_user(root.author_id) and not is_muted(root.author_id)))),
  'mentions',case when position('@' in p.body)>0 then resolved_mentions(p.body) else '[]'::jsonb end,
  'poll',poll_state(p.id),
  'quote',case when p.is_quote then (select jsonb_build_object('id',q.id,'body',q.body,'created_at',q.created_at,'profiles',engagement_profile(q.author_id),'has_poll',exists(select 1 from polls where post_id=q.id)) from posts q where q.id=p.quoted_post_id and visible_post(q.id)) else null end
 )),'{}') from posts p left join user_roles author_role on author_role.user_id=p.author_id where p.id=any(ids[1:100]) and visible_post(p.id)
$$;

create function public.public_admin_ids(ids uuid[]) returns uuid[]
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(array_agg(p.id), '{}'::uuid[])
 from profiles p join user_roles r on r.user_id=p.id
 where p.id=any(ids[1:200]) and r.role='admin' and visible_user(p.id)
$$;
revoke all on function public.public_admin_ids(uuid[]) from public,anon,authenticated;
grant execute on function public.public_admin_ids(uuid[]) to anon,authenticated;
-- Existing internal actor projections remain uncallable; existing post_stats grants are retained.
revoke all on function public.engagement_profile(uuid) from public,anon,authenticated;
notify pgrst, 'reload schema';
