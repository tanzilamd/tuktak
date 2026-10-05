import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createAuthDatabase } from "./helpers/database";
import { migrationSQL, readMigrations } from "../scripts/migrations.mjs";
import { MOODS, QUESTIONS, questionOfDay } from "../src/lib/config";
let db: PGlite;
const admin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mod = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const user = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let post: string;
let legacySource: string;
type Snapshot = {
  question: string | null;
  prompt: string | null;
  moods: string[];
  topics: { tag: string; count: number }[];
  announcement: {
    id: string;
    body: string;
    priority: number;
    dismissible: boolean;
  } | null;
  manualQuestion: boolean;
};
beforeAll(async () => {
  db = await createAuthDatabase();
  const chain = readMigrations();
  const index = chain.findIndex(
    (m) => m.name === "20261006000200_community_content.sql",
  );
  await db.exec(migrationSQL(chain.slice(0, index)));
  for (const [i, id] of [admin, mod, user].entries())
    await db.query("insert into auth.users values($1,$2,now(),$3::jsonb)", [
      id,
      `community${i}@example.invalid`,
      JSON.stringify({
        username: `community${i}`,
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
  post = (
    await db.query<{ id: string }>(
      "insert into posts(author_id,body,mood) values($1,'আগের পোস্ট','😄 জমে গেছে') returning id",
      [user],
    )
  ).rows[0].id;
  legacySource = (
    await db.query<{ source: string }>(
      "select prosrc source from pg_proc where oid='command(text,jsonb)'::regprocedure",
    )
  ).rows[0].source;
  await db.exec(migrationSQL(chain));
});
afterAll(async () => db.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function as<T>(actor: string | null, run: () => Promise<T>) {
  await db.exec("savepoint caller");
  try {
    await db.exec(`set local role ${actor ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor ?? "",
    ]);
    return await run();
  } finally {
    await db.exec("rollback to savepoint caller; release savepoint caller");
  }
}
const command = async (action: string, payload: unknown = {}) =>
  (
    await db.query<{ result: { id: string } }>(
      "select command($1,$2::jsonb) result",
      [action, JSON.stringify(payload)],
    )
  ).rows[0].result;
const save = (kind: string, payload: Record<string, unknown>) =>
  command("community_save", { kind, ...payload });
const publicRead = async () =>
  (await db.query<{ result: Snapshot }>("select community_public() result"))
    .rows[0].result;
const snapshot = async (at: string) =>
  (
    await db.query<{ result: Snapshot }>(
      "select community_snapshot($1::timestamptz) result",
      [at],
    )
  ).rows[0].result;
describe("admin-managed community content authority and compatibility", () => {
  it("preserves old posts, moods, names and exact legacy command body during upgrade", async () => {
    expect(
      (await db.query("select body,mood from posts where id=$1", [post]))
        .rows[0],
    ).toEqual({ body: "আগের পোস্ট", mood: MOODS[0] });
    expect(
      (
        await db.query<{ source: string }>(
          "select prosrc source from pg_proc where oid='command_before_community(text,jsonb)'::regprocedure",
        )
      ).rows[0].source,
    ).toBe(legacySource);
    expect(
      (
        await db.query<{ body: string }>(
          "select body from community_questions order by position,id",
        )
      ).rows.map((r) => r.body),
    ).toEqual(QUESTIONS);
    expect((await publicRead()).moods).toEqual(MOODS);
    await as(user, async () => {
      const result = await command("post", {
        body: "পুরোনো ক্লায়েন্টের নতুন পোস্ট",
        mood: MOODS[0],
      });
      expect(result.id).toBeTruthy();
    });
  });
  it("enables RLS on every content table and revokes direct writes/reads and private helper entry points", async () => {
    const tables = [
      "community_questions",
      "community_prompts",
      "community_moods",
      "community_topics",
      "community_announcements",
      "community_question_override",
    ];
    const rows = (
      await db.query<{ relname: string; relrowsecurity: boolean }>(
        "select relname,relrowsecurity from pg_class where relname=any($1::text[])",
        [tables],
      )
    ).rows;
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    for (const role of [null, user, mod, admin]) {
      for (const table of tables)
        await expect(
          as(role, () => db.query(`select * from ${table}`)),
        ).rejects.toThrow(/permission denied/);
      await expect(
        as(role, () =>
          db.query("insert into community_questions(body) values('অননুমোদিত')"),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(role, () =>
          db.query("select command_before_community('post','{}')"),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(role, () =>
          db.query("select community_manage('community_release','{}')"),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(role, () =>
          db.query("select community_snapshot(now()+interval '1 day')"),
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
  it("denies users/moderators, forged actor metadata, unverified/suspended/demoted admins", async () => {
    for (const actor of [user, mod]) {
      await expect(
        as(actor, () =>
          save("questions", { body: "না", author_id: admin, role: "admin" }),
        ),
      ).rejects.toThrow(/forbidden/);
      await expect(
        as(actor, () => db.query("select community_list('questions')")),
      ).rejects.toThrow(/forbidden/);
      await expect(
        as(actor, () => command("community_release")),
      ).rejects.toThrow(/forbidden/);
      for (const action of [
        "community_delete",
        "community_toggle",
        "community_pin",
      ]) {
        await expect(
          as(actor, () =>
            command(action, { kind: "questions", id: admin, active: true }),
          ),
        ).rejects.toThrow(/forbidden/);
      }
    }
    await expect(
      as(null, () => save("questions", { body: "না" })),
    ).rejects.toThrow(/permission denied/);
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [admin],
    );
    await expect(
      as(admin, () => save("questions", { body: "না" })),
    ).rejects.toThrow(/email_unverified/);
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [admin],
    );
    await db.query("update user_roles set suspended=true where user_id=$1", [
      admin,
    ]);
    await expect(
      as(admin, () => save("questions", { body: "না" })),
    ).rejects.toThrow(/forbidden/);
    await db.query(
      "update user_roles set suspended=false,role='moderator' where user_id=$1",
      [admin],
    );
    await expect(
      as(admin, () => save("questions", { body: "না" })),
    ).rejects.toThrow(/forbidden/);
  });
  it("performs question/prompt CRUD, status, order and immutable actor audit", async () => {
    await as(admin, async () => {
      const question = await save("questions", {
        body: "  নতুন প্রশ্ন?  ",
        position: 999,
      });
      await save("questions", {
        id: question.id,
        body: "বদলানো প্রশ্ন?",
        active: false,
        position: 2,
      });
      expect((await publicRead()).question).not.toBe("বদলানো প্রশ্ন?");
      const prompt = await save("prompts", { body: "নতুন কথা", active: false });
      await command("community_toggle", {
        kind: "prompts",
        id: prompt.id,
        active: true,
      });
      const rows = (
        await db.query<{
          result: { rows: { id: string; body: string; active: boolean }[] };
        }>("select community_list('questions','{\"q\":\"বদলানো\"}') result")
      ).rows[0].result.rows;
      expect(rows).toEqual([
        expect.objectContaining({
          id: question.id,
          body: "বদলানো প্রশ্ন?",
          active: false,
        }),
      ]);
      await command("community_delete", { kind: "questions", id: question.id });
      await command("community_delete", { kind: "prompts", id: prompt.id });
      const audits = (
        await db.query<{
          result: { rows: { action: string; actor_username: string }[] };
        }>("select staff_console('audit') result")
      ).rows[0].result.rows;
      expect(audits.every((a) => a.actor_username === "community0")).toBe(true);
      expect(audits.some((a) => a.action === "community_delete")).toBe(true);
    });
  });
  it("keeps Dhaka daily selection stable, advances next day and preserves legacy automatic ordering", async () => {
    for (const at of [
      "2026-10-05T17:59:59Z",
      "2026-10-05T18:00:00Z",
      "2026-10-06T12:00:00Z",
    ])
      expect((await snapshot(at)).question).toBe(questionOfDay(new Date(at)));
    expect((await snapshot("2026-10-05T18:00:00Z")).question).toBe(
      (await snapshot("2026-10-06T12:00:00Z")).question,
    );
    expect((await snapshot("2026-10-05T17:59:59Z")).question).not.toBe(
      (await snapshot("2026-10-05T18:00:00Z")).question,
    );
    for (let i = 0; i < 31; i++)
      expect(
        (await snapshot(new Date(Date.UTC(2026, 9, 1 + i)).toISOString()))
          .question,
      ).not.toBe(
        (await snapshot(new Date(Date.UTC(2026, 9, 2 + i)).toISOString()))
          .question,
      );
  });
  it("pins only an active question for today, then releases or expires at Dhaka midnight", async () => {
    const question = (
      await db.query<{ id: string }>(
        "select id from community_questions order by position limit 1",
      )
    ).rows[0].id;
    await as(admin, async () => {
      await command("community_pin", { id: question });
      expect((await publicRead()).manualQuestion).toBe(true);
      expect((await publicRead()).question).toBe(QUESTIONS[0]);
      await command("community_release");
      expect((await publicRead()).manualQuestion).toBe(false);
      await command("community_toggle", {
        kind: "questions",
        id: question,
        active: false,
      });
      await expect(command("community_pin", { id: question })).rejects.toThrow(
        /not_found/,
      );
    });
    await db.query(
      "insert into community_question_override(singleton,day,question_id) values(true,'2026-10-05',$1)",
      [question],
    );
    expect((await snapshot("2026-10-05T17:59:59Z")).manualQuestion).toBe(true);
    expect((await snapshot("2026-10-05T18:00:00Z")).manualQuestion).toBe(false);
    await db.query("delete from community_questions where id=$1", [question]);
    expect((await snapshot("2026-10-05T12:00:00Z")).manualQuestion).toBe(false);
  });
  it("manages mood snapshots without corrupting old posts or permitting inactive new moods", async () => {
    await as(admin, async () => {
      const mood = await save("moods", {
        label: "নতুন অনুভূতি",
        emoji: "🙂",
        position: 0,
      });
      const result = await command("post", {
        body: "নতুন মুডের কথা",
        mood: "🙂 নতুন অনুভূতি",
      });
      await save("moods", {
        id: mood.id,
        label: "অন্য নাম",
        emoji: "🙂",
        active: false,
      });
      await command("community_delete", { kind: "moods", id: mood.id });
      expect(
        (await db.query("select mood from posts where id=$1", [result.id]))
          .rows[0],
      ).toEqual({ mood: "🙂 নতুন অনুভূতি" });
      await command("edit_post", { id: result.id, body: "বদলানো কথা" });
    });
    await expect(
      as(user, () => command("post", { body: "অচল মুড", mood: "অজানা" })),
    ).rejects.toThrow(/invalid_mood/);
    await db.exec("update community_moods set active=false where position=0");
    await expect(
      as(user, () => command("post", { body: "বন্ধ মুড", mood: MOODS[0] })),
    ).rejects.toThrow(/invalid_mood/);
    expect(
      (await db.query("select mood from posts where id=$1", [post])).rows[0],
    ).toEqual({ mood: MOODS[0] });
  });
  it("adds featured topics ahead of organic visible-author counts without duplicates or private leakage", async () => {
    await db.query(
      "insert into post_hashtags(post_id,tag) select $1,'organic' where exists(select 1 from hashtags where tag='organic')",
      [post],
    );
    await db.exec(
      "insert into hashtags(tag) values('organic') on conflict do nothing",
    );
    await db.query(
      "insert into post_hashtags(post_id,tag) values($1,'organic') on conflict do nothing",
      [post],
    );
    await db.exec(
      "insert into community_topics(tag,position) values('featured',0),('organic',1)",
    );
    const snapshot = await as(null, publicRead);
    expect(snapshot.topics.slice(0, 2)).toEqual([
      { tag: "featured", count: 0 },
      { tag: "organic", count: 1 },
    ]);
    expect(new Set(snapshot.topics.map((t) => t.tag)).size).toBe(
      snapshot.topics.length,
    );
    await db.query("update posts set hidden=true where id=$1", [post]);
    expect(
      (await as(null, publicRead)).topics.find((t) => t.tag === "organic")
        ?.count,
    ).toBe(0);
    await db.exec(
      "update community_topics set expires_at=now()-interval '1 second'",
    );
    expect((await as(null, publicRead)).topics).toEqual([]);
  });
  it("selects one scheduled highest-priority announcement, expires correctly and returns no inactive/private rows", async () => {
    await db.exec(
      "insert into community_announcements(title,body,priority,starts_at,ends_at,dismissible) values('','সাধারণ',1,'2026-10-05T00:00Z','2026-10-07T00:00Z',true),('','জরুরি',3,'2026-10-05T01:00Z','2026-10-06T00:00Z',false),('','ভবিষ্যৎ',3,'2026-10-07T00:00Z',null,true)",
    );
    expect((await snapshot("2026-10-05T10:00Z")).announcement).toMatchObject({
      body: "জরুরি",
      dismissible: false,
      priority: 3,
    });
    expect((await snapshot("2026-10-06T00:00Z")).announcement).toMatchObject({
      body: "সাধারণ",
    });
    expect((await snapshot("2026-10-04T00:00Z")).announcement).toBeNull();
    await db.exec("update community_announcements set active=false");
    expect((await as(null, publicRead)).announcement).toBeNull();
    expect(JSON.stringify(await as(null, publicRead))).not.toMatch(
      /phone|email|user_id|actor_id|institution|raw_user_meta_data/,
    );
  });
  it("keeps management lists bounded with stable position/id cursors and pool caps", async () => {
    await db.exec(
      "insert into community_prompts(body,position) select 'তালিকার কথা '||i,0 from generate_series(1,54) i",
    );
    await as(admin, async () => {
      type List = {
        rows: { id: string; body: string; active: boolean }[];
        next: string | null;
      };
      const first = (
        await db.query<{ result: List }>(
          "select community_list('prompts') result",
        )
      ).rows[0].result;
      expect(first.rows).toHaveLength(50);
      const next = (
        await db.query<{ result: List }>(
          "select community_list('prompts',jsonb_build_object('cursor',$1::text)) result",
          [first.next],
        )
      ).rows[0].result;
      expect(next.rows).toHaveLength(5);
      expect(next.next).toBeNull();
      expect(new Set([...first.rows, ...next.rows].map((r) => r.id)).size).toBe(
        55,
      );
    });
    await db.exec(
      "insert into community_questions(body) select 'সীমার প্রশ্ন '||i from generate_series(1,169) i",
    );
    await expect(
      as(admin, () => save("questions", { body: "আরেকটি প্রশ্ন" })),
    ).rejects.toThrow(/content_pool_full/);
  });
  it("manages topic and announcement edits/status/deletion through the same audited boundary", async () => {
    await expect(
      as(admin, () => save("topics", { tag: "#ভুল" })),
    ).rejects.toThrow(/community_topics_tag_check/);
    await as(admin, async () => {
      const topic = await save("topics", { tag: "টুকটাক", position: 0 });
      expect((await publicRead()).topics[0].tag).toBe("টুকটাক");
      await command("community_toggle", {
        kind: "topics",
        id: topic.id,
        active: false,
      });
      expect((await publicRead()).topics.some((t) => t.tag === "টুকটাক")).toBe(
        false,
      );
      await command("community_delete", { kind: "topics", id: topic.id });
      const banner = await save("announcements", {
        title: "খবর",
        body: "আগের ঘোষণা",
        priority: 2,
      });
      await save("announcements", {
        id: banner.id,
        title: "নতুন খবর",
        body: "বদলানো ঘোষণা",
        priority: 3,
        dismissible: false,
      });
      expect((await publicRead()).announcement).toMatchObject({
        id: banner.id,
        body: "বদলানো ঘোষণা",
        priority: 3,
        dismissible: false,
      });
      await command("community_toggle", {
        kind: "announcements",
        id: banner.id,
        active: false,
      });
      expect((await publicRead()).announcement).toBeNull();
      await command("community_delete", {
        kind: "announcements",
        id: banner.id,
      });
    });
  });
  it("enforces database content limits, safe links, schedule rules, uniqueness and management rate limits", async () => {
    const invalid = [
      { kind: "questions", body: "🙂".repeat(161) },
      { kind: "prompts", body: " \u2003 " },
      { kind: "moods", label: "🙂".repeat(41) },
      { kind: "topics", tag: "bad/topic" },
      { kind: "announcements", body: "ঘোষণা", link: "javascript:alert(1)" },
      { kind: "announcements", body: "ঘোষণা", link: "//evil.invalid" },
      {
        kind: "announcements",
        body: "ঘোষণা",
        link: "https://good.invalid@evil.invalid",
      },
      {
        kind: "announcements",
        body: "ঘোষণা",
        starts_at: "2026-10-06T00:00Z",
        ends_at: "2026-10-05T00:00Z",
      },
    ];
    for (const payload of invalid)
      await expect(
        as(admin, () => command("community_save", payload)),
      ).rejects.toThrow();
    await as(admin, async () => {
      await save("announcements", {
        body: "নিরাপদ লিংক",
        link: "https://example.invalid/help",
      });
      await save("announcements", { body: "নিজেদের নিয়ম", link: "/community" });
    });
    await db.query(
      "insert into action_receipts(user_id,action) select $1,'community_manage' from generate_series(1,100)",
      [admin],
    );
    await expect(
      as(admin, () => save("prompts", { body: "সীমা" })),
    ).rejects.toThrow(/rate_limit/);
  });
});
