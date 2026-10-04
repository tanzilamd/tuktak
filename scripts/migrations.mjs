import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { join } from "node:path";

const directory = fileURLToPath(
  new URL("../supabase/migrations/", import.meta.url),
);
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";

export function readMigrations() {
  const migrations = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => {
      const version = name.match(/^(\d+)_[a-z0-9_]+\.sql$/)?.[1];
      if (!version) throw new Error(`Invalid migration filename: ${name}`);
      const sql = readFileSync(join(directory, name), "utf8");
      return {
        name,
        version,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    });
  if (
    !migrations.length ||
    new Set(migrations.map((m) => m.version)).size !== migrations.length
  )
    throw new Error(
      "Migrations must have unique versions and cannot be empty.",
    );
  return migrations;
}

// Only for the fictional local stack and PGlite tests. Hosted projects use
// Supabase's migration workflow, not this owner-only local history schema.
export function migrationSQL(migrations, { adoptInitial = false } = {}) {
  const initial = migrations[0];
  const tables = [
    ...initial.sql.matchAll(/create table public\.([a-z_]+)\s*\(/g),
  ].map((m) => m[1]);
  const initialCommand = initial.sql.match(
    /create function public\.command\([\s\S]*?as \$\$([\s\S]*?)\$\$;/,
  )?.[1];
  if (!tables.length || !initialCommand)
    throw new Error("Initial migration baseline not found.");
  const statements = migrations.map((migration, index) => {
    const adoption =
      adoptInitial && index === 0
        ? `
      if to_regclass('public.profiles') is not null then
        if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relkind='r' and c.relrowsecurity
              and c.relname=any(array[${tables.map(literal).join(",")}])) <> ${tables.length}
          or (select prosrc from pg_proc where oid=to_regprocedure('public.command(text,jsonb)'))
             is distinct from ${literal(initialCommand)} then
          raise exception 'Untracked local schema differs from the initial migration; inspect it before adopting history';
        end if;
      else
        execute ${literal(migration.sql)};
      end if;`
        : `execute ${literal(migration.sql)};`;
    return `do $apply_${migration.version}$
    begin
      if exists(select 1 from tuktak_local.migrations where version=${literal(migration.version)}
                and checksum<>${literal(migration.checksum)}) then
        raise exception 'Previously applied migration changed: ${migration.name}';
      end if;
      if not exists(select 1 from tuktak_local.migrations where version=${literal(migration.version)}) then
        ${adoption}
        insert into tuktak_local.migrations(version,checksum)
          values(${literal(migration.version)},${literal(migration.checksum)});
      end if;
    end $apply_${migration.version}$;`;
  });
  return `begin;
    set local standard_conforming_strings=on;
    select pg_advisory_xact_lock(hashtextextended('tuktak-local-migrations',0));
    create schema if not exists tuktak_local;
    revoke all on schema tuktak_local from public,anon,authenticated;
    create table if not exists tuktak_local.migrations(version text primary key,checksum text not null);
    revoke all on tuktak_local.migrations from public,anon,authenticated;
    ${statements.join("\n")}
    commit;`;
}
