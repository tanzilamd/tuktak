import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createAuthDatabase } from "./helpers/database";
import { migrationSQL, readMigrations } from "../scripts/migrations.mjs";
let db: PGlite;
const ids = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
];
beforeAll(async () => {
  db = await createAuthDatabase();
  const chain = readMigrations();
  await db.exec(migrationSQL(chain.slice(0, -1)));
  for (const [i, id] of ids.entries())
    await db.query("insert into auth.users values($1,$2,now(),$3::jsonb)", [
      id,
      `identity${i}@example.invalid`,
      JSON.stringify({
        username: `identity${i}`,
        display_name: `আগের নাম ${i}`,
        phone: "+8801700000000",
      }),
    ]);
  await db.query("update user_roles set role='admin' where user_id=$1", [
    ids[0],
  ]);
  await db.query("update user_roles set role='moderator' where user_id=$1", [
    ids[1],
  ]);
  await db.exec(migrationSQL(chain));
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
const adminIds = (actor: string | null = null, values = ids) =>
  as(actor, () =>
    db.query<{ ids: string[] }>("select public_admin_ids($1::uuid[]) ids", [
      values,
    ]),
  );
describe("safe public current-admin identity", () => {
  it("upgrades existing profiles without changing their names or Auth metadata", async () => {
    const rows = await db.query<{ display_name: string; metadata: string }>(
      "select p.display_name,u.raw_user_meta_data->>'display_name' metadata from profiles p join auth.users u on u.id=p.id order by p.username",
    );
    expect(rows.rows.map((r) => r.display_name)).toEqual([
      "আগের নাম 0",
      "আগের নাম 1",
      "আগের নাম 2",
    ]);
    expect(rows.rows.every((r) => r.display_name === r.metadata)).toBe(true);
  });
  it("exposes only requested visible admins, never normal/moderator role records", async () => {
    expect((await adminIds()).rows[0].ids).toEqual([ids[0]]);
    expect((await adminIds(null, [ids[1], ids[2]])).rows[0].ids).toEqual([]);
    expect((await adminIds(null, [])).rows[0].ids).toEqual([]);
    const roleRows = await as(ids[2], () =>
      db.query("select user_id from user_roles"),
    );
    expect(roleRows.rows).toEqual([{ user_id: ids[2] }]);
    await expect(
      as(null, () => db.query("select engagement_profile($1)", [ids[0]])),
    ).rejects.toThrow("permission denied");
  });
  it("caps the requested ID slice and removes demoted or suspended admins immediately on fresh reads", async () => {
    expect(
      (await adminIds(null, [...Array(200).fill(ids[2]), ids[0]])).rows[0].ids,
    ).toEqual([]);
    await db.query("update user_roles set role='moderator' where user_id=$1", [
      ids[0],
    ]);
    expect((await adminIds()).rows[0].ids).toEqual([]);
    await db.query(
      "update user_roles set role='admin',suspended=true where user_id=$1",
      [ids[0]],
    );
    expect((await adminIds()).rows[0].ids).toEqual([]);
    await db.query("update user_roles set suspended=false where user_id=$1", [
      ids[0],
    ]);
  });
  it("respects bilateral block visibility without exposing private account fields", async () => {
    await db.query("insert into blocks(blocker_id,blocked_id) values($1,$2)", [
      ids[2],
      ids[0],
    ]);
    expect((await adminIds(ids[2])).rows[0].ids).toEqual([]);
    await db.exec("delete from blocks");
    const projection = (
      await db.query<{ profile: Record<string, unknown> }>(
        "select engagement_profile($1) profile",
        [ids[0]],
      )
    ).rows[0].profile;
    expect(Object.keys(projection).sort()).toEqual(
      ["id", "username", "display_name", "accent", "status", "is_admin"].sort(),
    );
    expect(projection.is_admin).toBe(true);
  });
  it("reads current profile names and badges for posts, quotes, comments/replies and inbox without Auth synchronization", async () => {
    await db.query(
      "update profiles set display_name='এখনকার নাম' where id=$1",
      [ids[0]],
    );
    const post = (
      await db.query<{ id: string }>(
        "insert into posts(author_id,body) values($1,$2) returning id",
        [ids[0], "নাম পরীক্ষা"],
      )
    ).rows[0].id;
    const quote = (
      await db.query<{ id: string }>(
        "insert into posts(author_id,body,is_quote,quoted_post_id) values($1,$2,true,$3) returning id",
        [ids[2], "কথা", post],
      )
    ).rows[0].id;
    const root = (
      await db.query<{ id: string }>(
        "insert into comments(author_id,post_id,body) values($1,$2,$3) returning id",
        [ids[0], post, "উত্তর"],
      )
    ).rows[0].id;
    await db.query(
      "insert into comments(author_id,post_id,body,parent_id) values($1,$2,$3,$4)",
      [ids[0], post, "জবাব", root],
    );
    await db.query(
      "insert into notifications(recipient_id,actor_id,kind,post_id,event_key) values($1,$2,'quote',$3,'identity-test')",
      [ids[2], ids[0], post],
    );
    const result = (
      await as(ids[2], () =>
        db.query<{
          stats: Record<
            string,
            {
              author_is_admin: boolean;
              quote: { profiles: Record<string, unknown> };
            }
          >;
        }>("select post_stats($1::uuid[]) stats", [[post, quote]]),
      )
    ).rows[0].stats;
    expect(result[post].author_is_admin).toBe(true);
    expect(result[quote].author_is_admin).toBe(false);
    expect(result[quote].quote.profiles).toMatchObject({
      display_name: "এখনকার নাম",
      is_admin: true,
    });
    const comments = (
      await as(ids[2], () =>
        db.query<{ entries: { profiles: Record<string, unknown> }[] }>(
          "select discussion_comments($1) entries",
          [post],
        ),
      )
    ).rows[0].entries;
    expect(comments).toHaveLength(2);
    expect(
      comments.every(
        (c) =>
          c.profiles.display_name === "এখনকার নাম" &&
          c.profiles.is_admin === true,
      ),
    ).toBe(true);
    const inbox = (
      await as(ids[2], () =>
        db.query<{
          result: { entries: { profiles: Record<string, unknown> }[] };
        }>("select command('inbox_open','{}') result"),
      )
    ).rows[0].result;
    expect(inbox.entries[0].profiles).toMatchObject({
      display_name: "এখনকার নাম",
      is_admin: true,
    });
    expect(
      (
        await db.query<{ name: string }>(
          "select raw_user_meta_data->>'display_name' name from auth.users where id=$1",
          [ids[0]],
        )
      ).rows[0].name,
    ).toBe("আগের নাম 0");
    await db.query("update user_roles set role='user' where user_id=$1", [
      ids[0],
    ]);
    expect(
      (
        await as(ids[2], () =>
          db.query<{ stats: Record<string, { author_is_admin: boolean }> }>(
            "select post_stats($1::uuid[]) stats",
            [[post]],
          ),
        )
      ).rows[0].stats[post].author_is_admin,
    ).toBe(false);
  });
  it("retains narrow read-only RPC grants and all existing RLS/direct-write rules", async () => {
    const rows = await db.query<{ rls: boolean }>(
      "select bool_and(relrowsecurity) rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    expect(rows.rows[0].rls).toBe(true);
    for (const role of ["anon", "authenticated"])
      expect(
        (
          await db.query<{ write: boolean }>(
            "select has_table_privilege($1,'public.user_roles','UPDATE') as write",
            [role],
          )
        ).rows[0].write,
      ).toBe(false);
  });
});
