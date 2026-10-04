-- Match JavaScript trim() for caller RPC batch input without changing existing rows.
create or replace function public.normalize_profile_fields() returns trigger
language plpgsql set search_path=pg_catalog,pg_temp as $$
declare trim_chars text := E' \t\n\r\v\f'||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
begin
 new.ssc_batch := translate(btrim(new.ssc_batch,trim_chars),'০১২৩৪৫৬৭৮৯','0123456789');
 new.hsc_batch := translate(btrim(new.hsc_batch,trim_chars),'০১২৩৪৫৬৭৮৯','0123456789');
 new.status := btrim(new.status,trim_chars);
 return new;
end
$$;
