create role anon nologin;
create role authenticated nologin;
create role authenticator login password 'local-only-password' noinherit;
grant anon, authenticated to authenticator;
create role supabase_auth_admin login password 'local-only-password' createrole;
create schema auth authorization supabase_auth_admin;
grant all on schema public to supabase_auth_admin;
grant usage on schema public to anon, authenticated;
alter role supabase_auth_admin set search_path=auth,public;
