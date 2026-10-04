import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createAuthDatabase } from "./helpers/database";
import { migrationSQL, readMigrations } from "../scripts/migrations.mjs";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bootstrap = readFileSync(
  new URL("../scripts/production/first-admin.sql", import.meta.url),
  "utf8",
).replace("YOUR_VERIFIED_OWNER_EMAIL", "owner@example.invalid");
let db: PGlite;
beforeEach(async () => {
  db = await createAuthDatabase();
  await db.exec(migrationSQL(readMigrations()));
  await db.query(
    `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
     values($1,'owner@example.invalid',now(),$2)`,
    [
      id,
      {
        username: "qa_owner",
        display_name: "QA Owner",
        phone: "+8801700000000",
      },
    ],
  );
});
afterEach(async () => {
  await db.close();
});

describe("guarded first-admin owner procedure", () => {
  it("bootstraps a complete verified account with an audit entry; rejects a repeat", async () => {
    await db.exec(bootstrap);
    expect(
      (await db.query(`select role from user_roles where user_id=$1`, [id]))
        .rows,
    ).toEqual([{ role: "admin" }]);
    expect(
      (
        await db.query(
          `select action,actor_id,target_id from moderation_actions`,
        )
      ).rows,
    ).toEqual([{ action: "bootstrap_admin", actor_id: id, target_id: id }]);
    await expect(db.exec(bootstrap)).rejects.toThrow("An admin already exists");
    await db.exec("rollback");
    expect(
      (await db.query(`select count(*)::int total from moderation_actions`))
        .rows,
    ).toEqual([{ total: 1 }]);
  });
  for (const [name, setup] of [
    ["unverified", `update auth.users set email_confirmed_at=null`],
    ["suspended", `update user_roles set suspended=true`],
    ["manually orphaned", `delete from profiles`],
  ]) {
    it(`rejects an ${name} target without creating a role/audit`, async () => {
      await db.exec(setup);
      await expect(db.exec(bootstrap)).rejects.toThrow(
        "owner account not found",
      );
      await db.exec("rollback");
      expect(
        (
          await db.query(
            `select count(*)::int total from user_roles where role='admin'`,
          )
        ).rows,
      ).toEqual([{ total: 0 }]);
      expect(
        (await db.query(`select count(*)::int total from moderation_actions`))
          .rows,
      ).toEqual([{ total: 0 }]);
    });
  }
});
