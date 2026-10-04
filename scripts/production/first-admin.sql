-- Owner-console bootstrap only; never run as a migration or from the app.
-- Replace the single placeholder with an existing verified owner's email.
-- Use the intended production project's Supabase SQL Editor as its DB owner.
-- A repeat run rejects once any admin exists; do not bypass that guard.
begin;
lock table public.user_roles in exclusive mode;
do $$
declare owner_id uuid;
begin
  if exists(select 1 from public.user_roles where role='admin') then
    raise exception 'An admin already exists; review roles instead of re-bootstrapping';
  end if;
  select u.id into owner_id
  from auth.users u
  join public.profiles p on p.id=u.id
  join public.account_private a on a.user_id=u.id
  join public.user_roles r on r.user_id=u.id
  where lower(u.email)=lower('YOUR_VERIFIED_OWNER_EMAIL')
    and u.email_confirmed_at is not null and not r.suspended;
  if owner_id is null then
    raise exception 'Verified, complete, unsuspended owner account not found';
  end if;
  update public.user_roles set role='admin' where user_id=owner_id;
  insert into public.moderation_actions(actor_id,action,target_type,target_id,note)
  values(owner_id,'bootstrap_admin','user',owner_id,'Owner console bootstrap');
end $$;
commit;
