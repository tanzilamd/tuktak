#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p .local
# This stack is exclusively for fictional local data. It never connects to a hosted DB.
docker compose -p tuktak-test -f scripts/local/compose.yml up -d db mail
for _ in $(seq 1 30); do
 if docker exec tuktak-test-db-1 pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
if ! docker exec tuktak-test-db-1 psql -U postgres -Atc "select 1 from pg_roles where rolname='supabase_auth_admin'" | rg -q 1; then
 docker exec -i tuktak-test-db-1 psql -U postgres -v ON_ERROR_STOP=1 < scripts/local/bootstrap.sql
fi
docker compose -p tuktak-test -f scripts/local/compose.yml up -d auth rest
for _ in $(seq 1 30); do
 if curl --fail --silent http://127.0.0.1:55499/health >/dev/null; then break; fi
 sleep 1
done
curl --fail --silent http://127.0.0.1:55499/health >/dev/null
if ! docker exec tuktak-test-db-1 psql -U postgres -Atc "select coalesce(to_regclass('public.profiles')::text,'')" | rg -q profiles; then
 docker exec tuktak-test-db-1 psql -U postgres -v ON_ERROR_STOP=1 -c 'grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;'
 docker exec -i tuktak-test-db-1 psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610040001_core.sql
 docker exec -i tuktak-test-db-1 psql -U postgres -v ON_ERROR_STOP=1 < supabase/seed.sql
fi
docker exec tuktak-test-db-1 psql -U postgres -c "NOTIFY pgrst, 'reload schema';" >/dev/null
if ! curl --silent http://127.0.0.1:55421/auth/v1/health >/dev/null; then
 nohup node scripts/local/gateway.mjs > .local/gateway.log 2>&1 &
 echo "$!" > .local/gateway.pid
fi
node scripts/local/write-env.mjs
printf '%s\n' 'Local Auth + PostgREST + PostgreSQL ready. Run npm run dev. Mail UI port: 55424.'
