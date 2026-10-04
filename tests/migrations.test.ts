import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { migrationSQL, readMigrations } from "../scripts/migrations.mjs";
import { createAuthDatabase } from "./helpers/database";

let db: PGlite;
const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const migrations = readMigrations();
beforeEach(async () => {
  db = await createAuthDatabase();
});
afterEach(async () => {
  await db.close();
});

async function seedAccount() {
  await db.query("insert into auth.users values($1,$2,now(),$3::jsonb)", [
    actor,
    "migration@example.invalid",
    JSON.stringify({
      username: "migration_user",
      display_name: "আগের নাম",
      phone: "+8801700000000",
    }),
  ]);
}
async function missingConfirmation() {
  await db.exec("begin; set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor,
    ]);
    return await db.query("select command('delete_account','{}')");
  } finally {
    await db.exec("rollback");
  }
}
async function versions() {
  return (
    await db.query<{ version: string }>(
      "select version from tuktak_local.migrations order by version",
    )
  ).rows.map((m) => m.version);
}
describe("ordered migration chain", () => {
  it("upgrades GoTrue metadata privacy without changing complete or manually orphaned accounts", async () => {
    const prior = migrations.slice(0, -1);
    expect(migrations.at(-1)?.name).toBe(
      "20261004000300_auth_phone_privacy.sql",
    );
    await db.exec(migrationSQL(prior));
    await seedAccount();
    const orphan = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await db.query("insert into auth.users values($1,$2,null,$3::jsonb)", [
      orphan,
      "orphan@example.invalid",
      JSON.stringify({
        username: "orphan_user",
        display_name: "পুরোনো পরীক্ষা",
        phone: "+8801800000000",
      }),
    ]);
    // Reproduce GoTrue's later metadata save and the owner's direct deletion.
    await db.query(
      "update auth.users set raw_user_meta_data=raw_user_meta_data||jsonb_build_object('phone',$2::text) where id=$1",
      [actor, "+8801700000000"],
    );
    await db.query(
      "update auth.users set raw_user_meta_data=raw_user_meta_data||jsonb_build_object('phone',$2::text) where id=$1",
      [orphan, "+8801800000000"],
    );
    await db.query("delete from public.profiles where id=$1", [orphan]);
    await db.query(
      "update public.user_roles set suspended=true where user_id=$1",
      [actor],
    );
    const snapshot = (
      await db.query(
        "select row_to_json(p) profile,row_to_json(a) private,row_to_json(r) role from profiles p join account_private a on a.user_id=p.id join user_roles r on r.user_id=p.id",
      )
    ).rows;
    await db.exec(migrationSQL(migrations));
    expect(await versions()).toEqual(migrations.map((m) => m.version));
    expect(
      (
        await db.query(
          "select row_to_json(p) profile,row_to_json(a) private,row_to_json(r) role from profiles p join account_private a on a.user_id=p.id join user_roles r on r.user_id=p.id",
        )
      ).rows,
    ).toEqual(snapshot);
    const accounts = await db.query<{
      id: string;
      confirmed: boolean;
      metadata: Record<string, unknown>;
    }>(
      "select id,email_confirmed_at is not null confirmed,raw_user_meta_data metadata from auth.users order by id",
    );
    expect(accounts.rows).toEqual([
      {
        id: actor,
        confirmed: true,
        metadata: { username: "migration_user", display_name: "আগের নাম" },
      },
      {
        id: orphan,
        confirmed: false,
        metadata: {
          username: "orphan_user",
          display_name: "পুরোনো পরীক্ষা",
          phone: "+8801800000000",
        },
      },
    ]);
    expect(
      (await db.query("select id from profiles where id=$1", [orphan])).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select has_function_privilege('anon','public.strip_auth_phone()','EXECUTE') anon,has_function_privilege('authenticated','public.strip_auth_phone()','EXECUTE') authenticated",
        )
      ).rows[0],
    ).toEqual({ anon: false, authenticated: false });
    await db.exec(migrationSQL(migrations));
    expect(await versions()).toEqual(migrations.map((m) => m.version));
  });
  it("applies later migrations on a fresh installation and keeps history private", async () => {
    expect(migrations.length).toBeGreaterThan(1);
    await db.exec(migrationSQL(migrations));
    expect(await versions()).toEqual(migrations.map((m) => m.version));
    await seedAccount();
    await expect(missingConfirmation()).rejects.toThrow(
      /confirmation_required/,
    );
    await db.exec("begin; set local role authenticated");
    await expect(
      db.query("select * from tuktak_local.migrations"),
    ).rejects.toThrow(/permission denied/);
    await db.exec("rollback");
  });
  it("upgrades the untracked original schema without losing existing data or reseeding", async () => {
    await db.exec(migrations[0].sql);
    await seedAccount();
    await db.query(
      "update profiles set class_year='দশম',ssc_batch='2027',hsc_batch='2029',bio='আগের কথা' where id=$1",
      [actor],
    );
    await db.query(
      "update account_private set institution='গোপন কলেজ',institution_visible=false,onboarding_complete=true where user_id=$1",
      [actor],
    );
    await db.query(
      "insert into posts(author_id,body) values($1,'আগের পোস্ট')",
      [actor],
    );
    // This succeeds on the original schema; its transaction is rolled back.
    await expect(missingConfirmation()).resolves.toBeDefined();
    const snapshot = (
      await db.query(
        "select row_to_json(p) profile,row_to_json(a) private from profiles p join account_private a on a.user_id=p.id",
      )
    ).rows;
    await db.exec(migrationSQL(migrations, { adoptInitial: true }));
    expect(await versions()).toEqual(migrations.map((m) => m.version));
    await expect(missingConfirmation()).rejects.toThrow(
      /confirmation_required/,
    );
    expect(
      (
        await db.query(
          "select row_to_json(p) profile,row_to_json(a) private from profiles p join account_private a on a.user_id=p.id",
        )
      ).rows,
    ).toEqual(snapshot);
    expect((await db.query("select body from posts")).rows).toEqual([
      { body: "আগের পোস্ট" },
    ]);
    await db.exec(migrationSQL(migrations, { adoptInitial: true }));
    expect(await versions()).toEqual(migrations.map((m) => m.version));
  });
  it("refuses to silently adopt an unknown partial schema", async () => {
    await db.exec("create table profiles(id integer)");
    await expect(
      db.exec(migrationSQL(migrations, { adoptInitial: true })),
    ).rejects.toThrow(/differs from the initial migration/);
    await db.exec("rollback");
    expect(
      (
        await db.query<{ ledger: string | null }>(
          "select to_regclass('tuktak_local.migrations') ledger",
        )
      ).rows[0].ledger,
    ).toBeNull();
  });
  it("rejects rewritten applied migrations without changing the schema", async () => {
    await db.exec(migrationSQL(migrations));
    const changed = migrations.map((m, i) =>
      i === 0 ? { ...m, checksum: "0".repeat(64) } : m,
    );
    await expect(db.exec(migrationSQL(changed))).rejects.toThrow(
      /Previously applied migration changed/,
    );
    await db.exec("rollback");
    expect(await versions()).toEqual(migrations.map((m) => m.version));
  });
});
