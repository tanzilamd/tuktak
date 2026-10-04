import { PGlite } from "@electric-sql/pglite";

export async function createAuthDatabase() {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth;
     create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
     grant usage on schema public,auth to anon,authenticated;
     grant execute on function auth.uid() to anon,authenticated;`,
  );
  return db;
}
