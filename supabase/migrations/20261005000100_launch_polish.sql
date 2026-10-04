-- Small profile refinements; existing accents, profiles and Auth/RLS stay intact.
alter table public.profiles drop constraint profiles_status_check;
alter table public.profiles add constraint profiles_status_check check(char_length(status)<=40);

-- Normalize only numeric batches and optional status, including direct caller RPCs.
create function public.normalize_profile_fields() returns trigger
language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
 new.ssc_batch := translate(btrim(new.ssc_batch),'০১২৩৪৫৬৭৮৯','0123456789');
 new.hsc_batch := translate(btrim(new.hsc_batch),'০১২৩৪৫৬৭৮৯','0123456789');
 new.status := btrim(new.status,E' \t\n\r\v\f'||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279));
 return new;
end
$$;
revoke all on function public.normalize_profile_fields() from public,anon,authenticated;
create trigger normalize_profile_fields before insert or update of ssc_batch,hsc_batch,status on public.profiles
for each row execute function public.normalize_profile_fields();

-- Badge reads stop at 100 visible unread rows; no full-table count or polling.
create index notifications_unread on public.notifications(recipient_id,created_at desc) where read_at is null;
