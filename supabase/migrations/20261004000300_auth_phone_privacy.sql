-- GoTrue saves its in-memory signup metadata after handle_new_user() removes
-- phone in its AFTER INSERT trigger. Sanitize the row before those later saves
-- so confirmation/session claims cannot restore the private phone.
create function public.strip_auth_phone() returns trigger
language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
 new.raw_user_meta_data := new.raw_user_meta_data - 'phone';
 return new;
end $$;
revoke execute on function public.strip_auth_phone() from public,anon,authenticated;
create trigger keep_auth_phone_private before update of raw_user_meta_data on auth.users
for each row execute function public.strip_auth_phone();

-- Preserve all accounts, confirmation states, credentials, private phone values
-- and application rows. Clean existing metadata only after private storage exists;
-- manually orphaned accounts require a deliberate owner decision, not auto-repair.
update auth.users u set raw_user_meta_data=u.raw_user_meta_data-'phone'
where u.raw_user_meta_data ? 'phone'
and exists(select 1 from public.account_private a where a.user_id=u.id);
