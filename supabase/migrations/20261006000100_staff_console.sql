-- Additive, read-only staff console. Existing moderation commands stay authoritative.
create index moderation_actions_history on public.moderation_actions(created_at desc,id desc);
create index suspended_accounts on public.user_roles(user_id) where suspended;

create function public.staff_console(section text default 'overview',filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
 rows jsonb; q text:=left(coalesce(filters->>'q',''),60);
 state text:=coalesce(filters->>'status','open'); kind text:=coalesce(filters->>'kind','');
 oldest boolean:=coalesce(filters->>'order','newest')='oldest';
 stamp timestamptz; after_id uuid;
begin
 if not public.is_staff() then raise exception 'forbidden'; end if;
 if section not in ('overview','reports','suspended','audit') or state not in ('open','resolved','dismissed','all') or kind not in ('','post','comment','user') then raise exception 'invalid_filter'; end if;
 if filters->>'cursor' is not null then
  stamp:=(split_part(filters->>'cursor','|',1))::timestamptz;
  after_id:=(split_part(filters->>'cursor','|',2))::uuid;
 end if;
 if section='overview' then
  return jsonb_build_object(
   'reports',least(1000,(select count(*) from (select 1 from reports where status='open' limit 1001) x)),
   'suspended',least(1000,(select count(*) from (select 1 from user_roles where suspended limit 1001) x)),
   'audit',coalesce((select jsonb_agg(x) from (
    select a.id,a.action,a.target_type,a.target_id,a.note,a.created_at,p.username actor_username,p.display_name actor_name
    from moderation_actions a left join profiles p on p.id=a.actor_id order by a.created_at desc,a.id desc limit 5
   ) x),'[]'::jsonb));
 elsif section='reports' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into rows from (
   select r.id,r.target_type,r.target_id,r.reason,r.notes,r.status,r.created_at,r.resolved_at,
    case r.target_type when 'post' then po.body when 'comment' then c.body else p.display_name||' @'||p.username end content,
    coalesce(po.author_id,c.author_id,p.id) author_id,
    coalesce(pp.username,cp.username,p.username) author_username,
    coalesce(pp.display_name,cp.display_name,p.display_name) author_name
   from reports r
   left join posts po on r.target_type='post' and po.id=r.target_id
   left join comments c on r.target_type='comment' and c.id=r.target_id
   left join profiles p on r.target_type='user' and p.id=r.target_id
   left join profiles pp on pp.id=po.author_id left join profiles cp on cp.id=c.author_id
   where (state='all' or r.status=state) and (kind='' or r.target_type=kind)
    and (q='' or position(lower(q) in lower(concat_ws(' ',r.reason,r.notes,po.body,c.body,p.username,p.display_name,pp.username,cp.username)))>0)
    and (stamp is null or (not oldest and (r.created_at,r.id)<(stamp,after_id)) or (oldest and (r.created_at,r.id)>(stamp,after_id)))
   order by case when oldest then r.created_at end asc,case when oldest then r.id end asc,
    case when not oldest then r.created_at end desc,case when not oldest then r.id end desc limit 51
  ) x;
 elsif section='suspended' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into rows from (
   select p.id,p.username,p.display_name,p.created_at,r.role
   from user_roles r join profiles p on p.id=r.user_id
   where r.suspended and (q='' or position(lower(q) in lower(p.username||' '||p.display_name))>0)
    and (stamp is null or (not oldest and (p.created_at,p.id)<(stamp,after_id)) or (oldest and (p.created_at,p.id)>(stamp,after_id)))
   order by case when oldest then p.created_at end asc,case when oldest then p.id end asc,
    case when not oldest then p.created_at end desc,case when not oldest then p.id end desc limit 51
  ) x;
 else
  select coalesce(jsonb_agg(x),'[]'::jsonb) into rows from (
   select a.id,a.action,a.target_type,a.target_id,a.note,a.created_at,p.username actor_username,p.display_name actor_name
   from moderation_actions a left join profiles p on p.id=a.actor_id
   where (kind='' or a.target_type=kind)
    and (q='' or position(lower(q) in lower(concat_ws(' ',a.action,a.note,a.target_id::text,p.username,p.display_name)))>0)
    and (stamp is null or (not oldest and (a.created_at,a.id)<(stamp,after_id)) or (oldest and (a.created_at,a.id)>(stamp,after_id)))
   order by case when oldest then a.created_at end asc,case when oldest then a.id end asc,
    case when not oldest then a.created_at end desc,case when not oldest then a.id end desc limit 51
  ) x;
 end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(rows) with ordinality where ordinality<=50),
  'next',case when jsonb_array_length(rows)>50 then (rows->49->>'created_at')||'|'||(rows->49->>'id') else null end);
end $$;
revoke execute on function public.staff_console(text,jsonb) from public,anon;
grant execute on function public.staff_console(text,jsonb) to authenticated;
