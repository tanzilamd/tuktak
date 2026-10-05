import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrationSQL, readMigrations } from "../scripts/migrations.mjs";
import { createAuthDatabase } from "./helpers/database";
let db: PGlite;
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  c = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
beforeAll(async () => {
  db = await createAuthDatabase();
  await db.exec(migrationSQL(readMigrations()));
});
beforeEach(async () => {
  await db.exec("truncate auth.users cascade");
  for (const [id, name] of [
    [a, "alpha"],
    [b, "beta"],
    [c, "gamma"],
  ])
    await db.query("insert into auth.users values($1,$2,now(),$3::jsonb)", [
      id,
      `${name}@example.invalid`,
      JSON.stringify({
        username: name,
        display_name: name,
        phone: "+8801700000000",
      }),
    ]);
});
afterAll(async () => {
  await db.close();
});
async function asUser<T>(id: string | null, run: () => Promise<T>) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${id ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      id ?? "",
    ]);
    const result = await run();
    await db.exec("commit");
    return result;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
const command = (
  id: string | null,
  action: string,
  payload: object | null = {},
) =>
  asUser(id, () =>
    db.query<{ command: { id: string } }>(
      "select public.command($1,$2::jsonb)",
      [action, JSON.stringify(payload)],
    ),
  );
const post = async (id = a, body = "ছোট্ট একটা কথা") =>
  (await command(id, "post", { body, mood: "" })).rows[0].command.id;
const rows = (id: string | null, sql: string, params: unknown[] = []) =>
  asUser(id, () => db.query<Record<string, string>>(sql, params));
const profile = (extra: object = {}) => ({
  username: "alpha",
  display_name: "আলফা",
  bio: "",
  education: "",
  institution: "গোপন কলেজ",
  institution_visible: false,
  class_year: "",
  ssc_batch: "",
  hsc_batch: "",
  hobbies: [],
  status: "",
  accent: "mint",
  discoverable: true,
  ...extra,
});
describe("real PostgreSQL migration, authorization and social operations", () => {
  it("keeps a valid signup phone private when Auth saves the original metadata again", async () => {
    // GoTrue can write this original in-memory metadata after handle_new_user().
    await db.query(
      "update auth.users set raw_user_meta_data=$2::jsonb where id=$1",
      [
        a,
        JSON.stringify({
          username: "alpha",
          display_name: "আলফা",
          phone: "+8801700000000",
        }),
      ],
    );
    const result = await db.query<{ metadata: Record<string, unknown> }>(
      "select raw_user_meta_data metadata from auth.users where id=$1",
      [a],
    );
    expect(result.rows[0].metadata).toEqual({
      username: "alpha",
      display_name: "আলফা",
    });
    expect((await rows(a, "select phone from account_private")).rows).toEqual([
      { phone: "+8801700000000" },
    ]);
    expect((await rows(a, "select role from user_roles")).rows).toEqual([
      { role: "user" },
    ]);
    await command(a, "phone", { phone: "+8801800000000" });
    expect((await rows(a, "select phone from account_private")).rows).toEqual([
      { phone: "+8801800000000" },
    ]);
  });
  it.each([
    ["missing", {}],
    ["null", { confirmation: null }],
    ["incorrect", { confirmation: "oops" }],
    ["lowercase", { confirmation: "delete" }],
    ["padded", { confirmation: "DELETE " }],
    ["null payload", null],
  ])(
    "rejects %s account deletion confirmation at the RPC boundary",
    async (_, payload) => {
      await expect(command(a, "delete_account", payload)).rejects.toThrow(
        /confirmation_required/,
      );
      expect(
        (await db.query("select id from auth.users where id=$1", [a])).rows,
      ).toHaveLength(1);
      expect(
        (await rows(a, "select user_id from account_private")).rows,
      ).toHaveLength(1);
    },
  );
  it("accepts the exact DELETE confirmation at the RPC boundary", async () => {
    await command(a, "delete_account", { confirmation: "DELETE" });
    expect(
      (await db.query("select id from auth.users where id=$1", [a])).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select user_id from account_private where user_id=$1", [
          a,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("rejects stale onboarding submissions while preserving completed profile data", async () => {
    const saved = profile({
      class_year: "দশম",
      ssc_batch: "2027",
      hsc_batch: "2029",
      hobbies: ["বই"],
      bio: "আগের কথা",
    });
    await command(a, "profile", saved);
    const before = (
      await db.query(
        "select row_to_json(p) profile,row_to_json(a) private from profiles p join account_private a on a.user_id=p.id where p.id=$1",
        [a],
      )
    ).rows;
    await expect(
      command(
        a,
        "profile",
        profile({
          onboarding: true,
          institution: "",
          class_year: "",
          ssc_batch: "",
          hsc_batch: "",
        }),
      ),
    ).rejects.toThrow(/onboarding_complete/);
    expect(
      (
        await db.query(
          "select row_to_json(p) profile,row_to_json(a) private from profiles p join account_private a on a.user_id=p.id where p.id=$1",
          [a],
        )
      ).rows,
    ).toEqual(before);
    // Explicit editing remains available; the protection applies to the first-time wizard.
    await command(a, "profile", {
      ...saved,
      bio: "নতুন কথা",
      onboarding: false,
    });
    expect(
      (await rows(a, "select bio from profiles where id=$1", [a])).rows[0].bio,
    ).toBe("নতুন কথা");
  });
  it("enables RLS on every app table and denies public writes", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class join pg_namespace on pg_namespace.oid=relnamespace where nspname='public' and relkind='r'",
    );
    expect(result.rows.map((r) => r.relname)).toEqual(
      expect.arrayContaining([
        "posts",
        "comments",
        "polls",
        "poll_options",
        "poll_votes",
        "mention_receipts",
      ]),
    );
    expect(result.rows.length).toBe(19);
    expect(result.rows.every((r) => r.relrowsecurity)).toBe(true);
    await expect(
      rows(a, "insert into posts(author_id,body) values($1,'forged')", [b]),
    ).rejects.toThrow(/permission denied/);
    await expect(command(null, "post", { body: "fake" })).rejects.toThrow(
      /permission denied/,
    );
  });
  it("enforces username uniqueness case-insensitively and reserved names", async () => {
    await expect(
      command(a, "profile", profile({ username: "BETA" })),
    ).rejects.toThrow(/unique/);
    await expect(
      command(a, "profile", profile({ username: "admin" })),
    ).rejects.toThrow(/check constraint/);
    await expect(
      command(a, "profile", profile({ username: "bad-url!" })),
    ).rejects.toThrow(/check constraint/);
  });
  it("requires email verification and keeps phone out of profile/session metadata", async () => {
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [a],
    );
    await expect(command(a, "post", { body: "not verified" })).rejects.toThrow(
      /email_unverified/,
    );
    const user = await db.query<{ raw_user_meta_data: Record<string, string> }>(
      "select raw_user_meta_data from auth.users where id=$1",
      [a],
    );
    expect(user.rows[0].raw_user_meta_data.phone).toBeUndefined();
    const p = await rows(null, "select * from profiles");
    expect(p.rows[0]).not.toHaveProperty("phone");
    await expect(rows(null, "select * from account_private")).rejects.toThrow(
      /permission denied/,
    );
    expect(
      (await rows(b, "select * from account_private where user_id=$1", [a]))
        .rows,
    ).toHaveLength(0);
  });
  it("enforces 240 Unicode characters and attributes posts to the caller", async () => {
    const id = await post(a, "🙂".repeat(240));
    expect(
      (await rows(null, "select body,author_id from posts where id=$1", [id]))
        .rows[0],
    ).toEqual({ body: "🙂".repeat(240), author_id: a });
    await expect(post(a, "ক".repeat(241))).rejects.toThrow(/check constraint/);
    await expect(post(a, " \n\t ")).rejects.toThrow(/check constraint/);
    await expect(post(a, "\u00a0\u2000\ufeff")).rejects.toThrow(
      /check constraint/,
    );
  });
  it("rejects repeated identical posts and limits posts to ten per ten minutes", async () => {
    await post();
    await expect(post()).rejects.toThrow(/duplicate_content/);
    for (let i = 0; i < 9; i++) await post(a, `কথা ${i}`);
    await expect(post(a, "eleventh")).rejects.toThrow(/rate_limit/);
  });
  it("creates/deletes flat comments, enforces 180 characters and notifies owners", async () => {
    const id = await post();
    await command(b, "comment", { id, body: "উত্তর" });
    let result = await rows(b, "select id from comments");
    const comment = String(result.rows[0].id);
    expect((await rows(a, "select * from notifications")).rows).toHaveLength(1);
    await expect(
      command(b, "comment", { id, body: "🙂".repeat(181) }),
    ).rejects.toThrow(/check constraint/);
    await command(a, "delete_comment", { id: comment });
    expect((await rows(b, "select * from comments")).rows).toHaveLength(1);
    await command(b, "delete_comment", { id: comment });
    result = await rows(b, "select id from comments");
    expect(result.rows).toHaveLength(0);
    expect((await rows(a, "select * from notifications")).rows).toHaveLength(0);
  });
  it("switches/removes one reaction per user and deduplicates notifications", async () => {
    const id = await post();
    await command(b, "react", { id, kind: "love" });
    await command(b, "react", { id, kind: "haha" });
    expect((await rows(a, "select kind from reactions")).rows).toEqual([
      { kind: "haha" },
    ]);
    expect((await rows(a, "select * from notifications")).rows).toHaveLength(1);
    await command(b, "react", { id, kind: "haha" });
    expect((await rows(a, "select * from reactions")).rows).toHaveLength(0);
  });
  it("follows idempotently, unfollows and prevents self-follow", async () => {
    await expect(
      command(a, "follow", { id: a, enabled: true }),
    ).rejects.toThrow(/self_follow/);
    await command(a, "follow", { id: b, enabled: true });
    await command(a, "follow", { id: b, enabled: true });
    expect((await rows(a, "select * from follows")).rows).toHaveLength(1);
    await command(a, "follow", { id: b, enabled: false });
    expect((await rows(a, "select * from follows")).rows).toHaveLength(0);
  });
  it("blocks in both directions, removes follows, prevents interactions and supports unblock", async () => {
    const id = await post();
    const other = await post(b, "other");
    await command(a, "follow", { id: b, enabled: true });
    await command(b, "block", { id: a, enabled: true });
    expect(
      (await rows(b, "select * from posts where id=$1", [id])).rows,
    ).toHaveLength(0);
    expect(
      (await rows(a, "select * from posts where id=$1", [other])).rows,
    ).toHaveLength(0);
    expect((await rows(a, "select * from follows")).rows).toHaveLength(0);
    await expect(
      command(a, "comment", { id: other, body: "hey" }),
    ).rejects.toThrow(/not_found/);
    await expect(
      command(a, "follow", { id: b, enabled: true }),
    ).rejects.toThrow(/not_found/);
    await command(b, "block", { id: a, enabled: false });
    expect((await rows(a, "select * from posts")).rows).toHaveLength(2);
  });
  it("mutes only for the caller and never notifies the muted person", async () => {
    await post();
    await post(b, "other");
    await command(b, "mute", { id: a, enabled: true });
    expect((await rows(b, "select * from posts")).rows).toHaveLength(1);
    expect((await rows(a, "select * from posts")).rows).toHaveLength(2);
    expect((await rows(a, "select * from notifications")).rows).toHaveLength(0);
    await command(b, "mute", { id: a, enabled: false });
    expect((await rows(b, "select * from posts")).rows).toHaveLength(2);
  });
  it("keeps hidden institutions private and only publishes on explicit opt-in", async () => {
    await command(a, "profile", profile());
    expect(
      (await rows(b, "select institution from profiles where id=$1", [a]))
        .rows[0].institution,
    ).toBeNull();
    expect(
      (
        await rows(
          b,
          "select institution from account_private where user_id=$1",
          [a],
        )
      ).rows,
    ).toHaveLength(0);
    await command(a, "profile", profile({ institution_visible: true }));
    expect(
      (await rows(null, "select institution from profiles where id=$1", [a]))
        .rows[0].institution,
    ).toBe("গোপন কলেজ");
  });
  it("makes reports private and authorizes moderation/admin in the database", async () => {
    const id = await post();
    await command(b, "report", {
      id,
      target_type: "post",
      reason: "স্প্যাম",
      notes: "review",
    });
    expect((await rows(a, "select * from reports")).rows).toHaveLength(0);
    await expect(
      asUser(a, () => db.query("select moderation_queue()")),
    ).rejects.toThrow(/forbidden/);
    await expect(
      command(a, "role", { id: b, role: "moderator" }),
    ).rejects.toThrow(/forbidden/);
    await db.query("update user_roles set role='moderator' where user_id=$1", [
      c,
    ]);
    const reports = await rows(c, "select * from reports");
    await command(c, "moderate", {
      id: reports.rows[0].id,
      decision: "hide",
      note: "spam",
    });
    expect((await rows(a, "select * from posts")).rows).toHaveLength(0);
    expect(
      (await rows(c, "select * from moderation_actions")).rows,
    ).toHaveLength(1);
    await expect(
      command(c, "role", { id: b, role: "moderator" }),
    ).rejects.toThrow(/forbidden/);
    await db.query("update user_roles set role='admin' where user_id=$1", [c]);
    await command(c, "role", { id: b, role: "moderator" });
    expect((await rows(b, "select role from user_roles")).rows[0].role).toBe(
      "moderator",
    );
  });
  it("suspends users, prevents writes, hides their public content, and unsuspends", async () => {
    const id = await post();
    await command(b, "report", {
      id: a,
      target_type: "user",
      reason: "হয়রানি",
      notes: "",
    });
    await db.query("update user_roles set role='moderator' where user_id=$1", [
      c,
    ]);
    const r = await rows(c, "select id from reports");
    await command(c, "moderate", {
      id: r.rows[0].id,
      decision: "suspend",
      note: "",
    });
    await expect(post(a, "cant write")).rejects.toThrow(/account_suspended/);
    expect(
      (await rows(null, "select id from posts where id=$1", [id])).rows,
    ).toHaveLength(0);
    await command(c, "unsuspend", { id: a });
    expect(
      (await rows(null, "select id from posts where id=$1", [id])).rows,
    ).toHaveLength(1);
  });
  it("cascades post deletion and account deletion without orphaned private data", async () => {
    const id = await post();
    await command(b, "react", { id, kind: "love" });
    await command(b, "comment", { id, body: "hey" });
    await command(b, "delete_post", { id });
    expect((await rows(null, "select * from posts")).rows).toHaveLength(1);
    await command(a, "delete_post", { id });
    expect((await rows(b, "select * from reactions")).rows).toHaveLength(0);
    expect((await rows(b, "select * from comments")).rows).toHaveLength(0);
    await expect(
      command(a, "delete_account", { confirmation: "oops" }),
    ).rejects.toThrow(/confirmation_required/);
    await command(a, "delete_account", { confirmation: "DELETE" });
    expect(
      (await db.query("select * from account_private where user_id=$1", [a]))
        .rows,
    ).toHaveLength(0);
  });
  it("allows anonymous comment aggregates without reading private mute data", async () => {
    const id = await post();
    await command(b, "comment", { id, body: "public reply" });
    expect((await rows(null, "select id from comments")).rows).toHaveLength(1);
    await expect(rows(null, "select * from mutes")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("marks a selected notification group without marking unrelated notifications", async () => {
    const id = await post();
    await command(b, "react", { id, kind: "love" });
    await command(c, "comment", { id, body: "another" });
    const n = await rows(a, "select id,kind from notifications");
    const reaction = n.rows.find((x) => x.kind === "reaction")!;
    await command(a, "read", { ids: [reaction.id] });
    expect(
      (
        await rows(
          a,
          "select kind from notifications where read_at is not null",
        )
      ).rows,
    ).toEqual([{ kind: "reaction" }]);
  });
  it("reads one/group/all without crossing recipients and keeps unread counts consistent", async () => {
    const id = await post();
    await command(b, "react", { id, kind: "love" });
    await command(c, "react", { id, kind: "haha" });
    await command(b, "comment", { id, body: "unrelated reply" });
    await command(a, "follow", { id: b, enabled: true });
    const before = await rows(
      a,
      "select id,kind from notifications where read_at is null",
    );
    expect(before.rows).toHaveLength(3);
    const group = before.rows
      .filter((n) => n.kind === "reaction")
      .map((n) => n.id);
    expect(group).toHaveLength(2);
    const foreign = (
      await rows(b, "select id from notifications where read_at is null")
    ).rows[0].id;
    await command(a, "read", { ids: [...group, foreign] });
    expect(
      (await rows(a, "select id from notifications where read_at is null"))
        .rows,
    ).toHaveLength(1);
    expect(
      (await rows(b, "select id from notifications where read_at is null"))
        .rows,
    ).toHaveLength(1);
    await command(a, "read", {
      id: before.rows.find((n) => n.kind === "comment")!.id,
    });
    expect(
      (await rows(a, "select id from notifications where read_at is null"))
        .rows,
    ).toHaveLength(0);
    await command(c, "follow", { id: a, enabled: true });
    await command(a, "read", {});
    expect(
      (await rows(a, "select id from notifications where read_at is null"))
        .rows,
    ).toHaveLength(0);
    expect(
      (await rows(b, "select id from notifications where read_at is null"))
        .rows,
    ).toHaveLength(1);
  });
  it("normalizes batch digits at the caller RPC and enforces Unicode status limits with RLS", async () => {
    await command(
      a,
      "profile",
      profile({
        ssc_batch: "২০২৫",
        hsc_batch: "20২৭",
        status: "🙂".repeat(40),
      }),
    );
    expect(
      (
        await rows(
          a,
          "select ssc_batch,hsc_batch,status from profiles where id=$1",
          [a],
        )
      ).rows[0],
    ).toEqual({
      ssc_batch: "2025",
      hsc_batch: "2027",
      status: "🙂".repeat(40),
    });
    await expect(
      command(a, "profile", profile({ status: "🙂".repeat(41) })),
    ).rejects.toThrow(/profiles_status_check/);
    await expect(
      command(a, "profile", profile({ ssc_batch: "20x৫" })),
    ).rejects.toThrow(/profiles_ssc_batch_check/);
    await expect(
      command(a, "profile", profile({ ssc_batch: "৩০০০" })),
    ).rejects.toThrow(/profiles_ssc_batch_check/);
    await command(a, "profile", profile({ status: "  \u2003  " }));
    expect(
      (await rows(a, "select status from profiles where id=$1", [a])).rows[0]
        .status,
    ).toBe("");
    await expect(
      asUser(b, () =>
        db.query("update profiles set status='forged' where id=$1", [a]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("restricts admin account searches and shows opted-out accounts only to admins", async () => {
    await command(a, "profile", profile({ discoverable: false }));
    await expect(
      asUser(b, () => db.query("select admin_accounts('alpha')")),
    ).rejects.toThrow(/forbidden/);
    await db.query("update user_roles set role='admin' where user_id=$1", [c]);
    const result = await asUser(c, () =>
      db.query("select * from admin_accounts('alpha')"),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).not.toHaveProperty("phone");
  });
  it("indexes Bengali tags and counts one author per topic to limit spam amplification", async () => {
    await post(a, "one #মিম");
    await post(a, "two #মিম");
    await post(a, "invalid currency #৳");
    const result = await rows(null, "select * from popular_topics()");
    expect(result.rows).toEqual([{ tag: "মিম", count: 1 }]);
  });
  it("allows users to remove their own mute/follow after the target is suspended", async () => {
    await command(a, "follow", { id: b, enabled: true });
    await command(a, "mute", { id: b, enabled: true });
    await db.query("update user_roles set suspended=true where user_id=$1", [
      b,
    ]);
    await command(a, "follow", { id: b, enabled: false });
    await command(a, "mute", { id: b, enabled: false });
    expect((await db.query("select * from follows")).rows).toHaveLength(0);
    expect((await db.query("select * from mutes")).rows).toHaveLength(0);
  });
});
