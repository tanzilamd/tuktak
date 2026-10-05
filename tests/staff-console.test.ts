import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createAuthDatabase } from "./helpers/database";
import { migrationSQL, readMigrations } from "../scripts/migrations.mjs";
let db: PGlite;
const admin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mod = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const user = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let unchanged: unknown;
let commandDefinition: string;
beforeAll(async () => {
  db = await createAuthDatabase();
  const chain = readMigrations();
  const index = chain.findIndex(
    (m) => m.name === "20261006000100_staff_console.sql",
  );
  await db.exec(migrationSQL(chain.slice(0, index)));
  for (const [i, id] of [admin, mod, user].entries())
    await db.query("insert into auth.users values($1,$2,now(),$3::jsonb)", [
      id,
      `staff${i}@example.invalid`,
      JSON.stringify({
        username: `staff${i}`,
        display_name: `নাম ${i}`,
        phone: "+8801700000000",
      }),
    ]);
  await db.query("update user_roles set role='admin' where user_id=$1", [
    admin,
  ]);
  await db.query("update user_roles set role='moderator' where user_id=$1", [
    mod,
  ]);
  await db.query(
    "insert into posts(author_id,body,hidden) values($1,'লুকানো রিপোর্টের প্রেক্ষাপট',true)",
    [user],
  );
  await db.exec(
    "insert into reports(target_type,target_id,reason,notes) select 'post',id,'স্প্যাম','প্রেক্ষাপট' from posts",
  );
  await db.exec(
    "insert into reports(target_type,target_id,reason,notes,created_at) select 'user',gen_random_uuid(),'অন্যান্য','পৃষ্ঠা পরীক্ষা',now()-i*interval '1 second' from generate_series(1,55) i",
  );
  await db.query(
    "insert into moderation_actions(actor_id,action,target_type,target_id,note) values($1,'role','user',$2,'moderator')",
    [admin, mod],
  );
  unchanged = (
    await db.query(
      "select row_to_json(p) p,row_to_json(a) a,row_to_json(r) r from profiles p join account_private a on a.user_id=p.id join user_roles r on r.user_id=p.id order by p.id",
    )
  ).rows;
  commandDefinition = (
    await db.query<{ definition: string }>(
      "select pg_get_functiondef('command(text,jsonb)'::regprocedure) definition",
    )
  ).rows[0].definition;
  await db.exec(migrationSQL(chain.slice(0, index + 1)));
});
afterAll(async () => db.close());
async function as<T>(actor: string | null, run: () => Promise<T>) {
  await db.exec(`begin; set local role ${actor ? "authenticated" : "anon"}`);
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor ?? "",
    ]);
    return await run();
  } finally {
    await db.exec("rollback");
  }
}
type Result = {
  rows: Record<string, unknown>[];
  next: string | null;
  reports: number;
  suspended: number;
  audit: Record<string, unknown>[];
};
const read = (actor: string | null, section = "overview", filters = {}) =>
  as(
    actor,
    async () =>
      (
        await db.query<{ result: Result }>(
          "select staff_console($1,$2::jsonb) result",
          [section, JSON.stringify(filters)],
        )
      ).rows[0].result,
  );
describe("bounded live-role staff console", () => {
  it("upgrades without changing accounts, command authority or public grants", async () => {
    expect(
      (
        await db.query(
          "select row_to_json(p) p,row_to_json(a) a,row_to_json(r) r from profiles p join account_private a on a.user_id=p.id join user_roles r on r.user_id=p.id order by p.id",
        )
      ).rows,
    ).toEqual(unchanged);
    expect(
      (
        await db.query<{ definition: string }>(
          "select pg_get_functiondef('command(text,jsonb)'::regprocedure) definition",
        )
      ).rows[0].definition,
    ).toBe(commandDefinition);
    expect(
      (
        await db.query(
          "select has_function_privilege('anon','staff_console(text,jsonb)','execute') anon,has_function_privilege('authenticated','staff_console(text,jsonb)','execute') authenticated",
        )
      ).rows[0],
    ).toEqual({ anon: false, authenticated: true });
  });
  it("denies guests/users and immediately respects demotion or suspension", async () => {
    await expect(read(null)).rejects.toThrow(/permission denied/);
    await expect(read(user)).rejects.toThrow(/forbidden/);
    expect((await read(mod)).reports).toBe(56);
    await db.query("update user_roles set suspended=true where user_id=$1", [
      mod,
    ]);
    await expect(read(mod)).rejects.toThrow(/forbidden/);
    await db.query(
      "update user_roles set suspended=false,role='user' where user_id=$1",
      [mod],
    );
    await expect(read(mod)).rejects.toThrow(/forbidden/);
    await db.query("update user_roles set role='moderator' where user_id=$1", [
      mod,
    ]);
  });
  it("pages reports without duplicates including timestamp ties in both directions", async () => {
    const first = await read(admin, "reports");
    expect(first.rows).toHaveLength(50);
    expect(first.next).not.toBeNull();
    const second = await read(admin, "reports", { cursor: first.next });
    expect(second.rows).toHaveLength(6);
    expect(second.next).toBeNull();
    expect(new Set([...first.rows, ...second.rows].map((r) => r.id)).size).toBe(
      56,
    );
    const oldest = await read(mod, "reports", { order: "oldest" });
    const rest = await read(mod, "reports", {
      order: "oldest",
      cursor: oldest.next,
    });
    expect([...oldest.rows, ...rest.rows].map((r) => r.id)).toEqual(
      [...first.rows, ...second.rows].map((r) => r.id).reverse(),
    );
  });
  it("filters current hidden context safely without reporter/private account data", async () => {
    const result = await read(mod, "reports", { kind: "post", q: "লুকানো" });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      content: "লুকানো রিপোর্টের প্রেক্ষাপট",
      author_username: "staff2",
      status: "open",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /phone|institution|email|reporter_id|raw_user_meta_data/,
    );
    expect((await read(mod, "reports", { q: "%" })).rows).toEqual([]);
    expect((await read(mod, "reports", { status: "resolved" })).rows).toEqual(
      [],
    );
  });
  it("retains moderation actions, status history and truthful actor identity", async () => {
    await as(mod, async () => {
      const id = (
        await db.query<{ id: string }>("select id from reports limit 1")
      ).rows[0].id;
      await db.query(
        "select command('moderate',jsonb_build_object('id',$1::text,'decision','dismiss','note','পরীক্ষা'))",
        [id],
      );
      const resolved = (
        await db.query<{ result: Result }>(
          "select staff_console('reports','{\"status\":\"dismissed\"}') result",
        )
      ).rows[0].result;
      expect(resolved.rows).toHaveLength(1);
      const audit = (
        await db.query<{ result: Result }>(
          "select staff_console('audit','{\"q\":\"পরীক্ষা\"}') result",
        )
      ).rows[0].result;
      expect(audit.rows[0]).toMatchObject({
        action: "dismiss",
        actor_username: "staff1",
        actor_name: "নাম 1",
        note: "পরীক্ষা",
      });
    });
  });
  it("lists suspensions and unsuspends without adding timed expiry", async () => {
    await db.query("update user_roles set suspended=true where user_id=$1", [
      user,
    ]);
    expect(
      (await read(mod, "suspended", { q: "staff2" })).rows[0],
    ).toMatchObject({ id: user, role: "user" });
    await as(mod, async () => {
      await db.query(
        "select command('unsuspend',jsonb_build_object('id',$1::text))",
        [user],
      );
      expect(
        (
          await db.query<{ result: Result }>(
            "select staff_console('suspended') result",
          )
        ).rows[0].result.rows,
      ).toEqual([]);
    });
    await db.query("update user_roles set suspended=false where user_id=$1", [
      user,
    ]);
  });
  it("bounds overview counts and rejects unsupported filters", async () => {
    expect((await read(admin)).audit).toHaveLength(1);
    await expect(read(admin, "private")).rejects.toThrow(/invalid_filter/);
    await expect(read(admin, "reports", { kind: "poll" })).rejects.toThrow(
      /invalid_filter/,
    );
    await expect(read(admin, "reports", { status: "invalid" })).rejects.toThrow(
      /invalid_filter/,
    );
    await db.exec(
      "insert into reports(target_type,target_id,reason) select 'user',gen_random_uuid(),'অন্যান্য' from generate_series(1,1005)",
    );
    expect((await read(admin)).reports).toBe(1000);
  });
});
