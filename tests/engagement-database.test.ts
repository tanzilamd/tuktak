import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { Poll, QuotePreview } from "../src/lib/types";
import type { Notification } from "../src/lib/notifications";
import type { PGlite } from "@electric-sql/pglite";
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
async function as<T>(id: string | null, run: () => Promise<T>) {
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
const command = async (
  who: string | null,
  action: string,
  payload: object = {},
) =>
  (
    await as(who, () =>
      db.query<{
        result: {
          id: string;
          entries: Notification[];
          entryUnreadIds: string[];
          unreadCount: number;
        };
      }>("select command($1,$2::jsonb) result", [
        action,
        JSON.stringify(payload),
      ]),
    )
  ).rows[0].result;
const post = async (who = a, body = "একটা কথা", extra = {}) =>
  String((await command(who, "post", { body, mood: "", ...extra })).id);
const comment = async (pid: string, who = b, body = "একটা উত্তর", extra = {}) =>
  String((await command(who, "comment", { id: pid, body, ...extra })).id);
const read = async (who: string | null, sql: string, args: unknown[] = []) =>
  (
    await as(who, () =>
      db.query<{
        id: string;
        parent_id: string | null;
        kind: string;
        created_at: string;
        updated_at: string | null;
        read_at: string | null;
        result: Record<
          string,
          {
            comment_count: number;
            mentions: string[];
            quote: QuotePreview;
            poll: Poll;
          }
        >;
      }>(sql, args),
    )
  ).rows;
const stats = async (pid: string, who: string | null = a) =>
  (await read(who, "select post_stats(array[$1::uuid]) result", [pid]))[0]
    .result[pid];
const poll = async (options = ["হ্যাঁ", "না"], who = a) =>
  post(who, "পোলের প্রশ্ন", { poll_options: options, poll_duration: 86400 });
describe("one-level replies", () => {
  it("bounds a discussion without losing root context or a notification's older target", async () => {
    const pid = await post();
    await db.query(
      "insert into comments(id,post_id,author_id,body,created_at) select md5('root'||i)::uuid,$1,$2,'মূল '||i,now()-interval '1 day' from generate_series(1,105) i",
      [pid, b],
    );
    await db.query(
      "insert into comments(post_id,author_id,body,parent_id) select $1,$2,'জবাব '||i,md5('root'||i)::uuid from generate_series(1,105) i",
      [pid, c],
    );
    const rows = (
      await as(a, () =>
        db.query<{ result: { id: string; parent_id: string | null }[] }>(
          "select discussion_comments($1) result",
          [pid],
        ),
      )
    ).rows[0].result;
    expect(rows).toHaveLength(200);
    const ids = new Set(rows.map((r) => r.id));
    for (const child of rows.filter((r) => r.parent_id))
      expect(ids.has(child.parent_id!)).toBe(true);
    const older = (
      await db.query<{ id: string }>(
        "select id from comments where post_id=$1 and parent_id is null order by id limit 1",
        [pid],
      )
    ).rows[0].id;
    const focused = (
      await as(a, () =>
        db.query<{ result: { id: string }[] }>(
          "select discussion_comments($1,$2) result",
          [pid, older],
        ),
      )
    ).rows[0].result;
    expect(focused.some((r) => r.id === older)).toBe(true);
  });
  it("creates/flattens a thread, counts every visible reply and notifies the root author", async () => {
    const pid = await post(),
      root = await comment(pid, c),
      child = await comment(pid, b, "প্রথম জবাব", { parent_id: root });
    const flattened = await comment(pid, a, "পরের জবাব", { parent_id: child });
    expect(
      (
        await read(a, "select parent_id from comments where id=$1", [flattened])
      )[0].parent_id,
    ).toBe(root);
    expect((await stats(pid)).comment_count).toBe(3);
    expect(
      await read(c, "select kind from notifications where comment_id=$1", [
        child,
      ]),
    ).toEqual([{ kind: "reply" }]);
  });
  it("rejects wrong-post/deleted parents and forged direct writes", async () => {
    const pid = await post(),
      other = await post(a, "অন্য কথা"),
      root = await comment(other);
    await expect(
      comment(pid, c, "ভুল জবাব", { parent_id: root }),
    ).rejects.toThrow(/invalid_parent/);
    await command(b, "delete_comment", { id: root });
    await expect(
      comment(other, c, "মুছে গেছে", { parent_id: root }),
    ).rejects.toThrow(/invalid_parent/);
    await expect(
      read(
        b,
        "insert into comments(post_id,author_id,body) values($1,$2,'forged')",
        [pid, a],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("enforces depth even at the constraint/trigger boundary", async () => {
    const pid = await post(),
      root = await comment(pid),
      child = await comment(pid, c, "জবাব", { parent_id: root });
    await expect(
      db.query(
        "insert into comments(post_id,author_id,body,parent_id) values($1,$2,'deep',$3)",
        [pid, a, child],
      ),
    ).rejects.toThrow(/invalid_parent/);
  });
  it("hides the entire parent thread and cascades parent deletion", async () => {
    const pid = await post(),
      root = await comment(pid),
      child = await comment(pid, c, "জবাব", { parent_id: root });
    await db.query("update comments set hidden=true where id=$1", [root]);
    expect((await stats(pid)).comment_count).toBe(0);
    expect(
      await read(a, "select id from comments where id=$1", [child]),
    ).toEqual([]);
    await command(b, "delete_comment", { id: root });
    expect(
      (await db.query("select id from comments where post_id=$1", [pid])).rows,
    ).toEqual([]);
  });
  it("rejects blocked/muted/suspended parents and keeps deletion ownership", async () => {
    const pid = await post(),
      root = await comment(pid, b);
    await command(c, "block", { id: b, enabled: true });
    await expect(comment(pid, c, "বন্ধ", { parent_id: root })).rejects.toThrow(
      /invalid_parent/,
    );
    await command(a, "delete_comment", { id: root });
    expect(
      (await db.query("select id from comments where id=$1", [root])).rows,
    ).toHaveLength(1);
  });
});
describe("entry snapshot reads", () => {
  it("leaves an arrival between capture and read-update unread", async () => {
    await db.query(
      "insert into notifications(recipient_id,actor_id,kind,event_key) values($1,$2,'follow','entry:first')",
      [a, b],
    );
    // Test-only injection at the update boundary, after the UUID snapshot exists.
    await db.exec(`create function test_inbox_arrival() returns trigger language plpgsql as $$ begin
      insert into notifications(recipient_id,actor_id,kind,event_key) values(new.recipient_id,'${c}','follow','entry:late') on conflict do nothing;
      return new;
    end $$; create trigger test_inbox_arrival before update of read_at on notifications for each row execute function test_inbox_arrival();`);
    try {
      const opened = await command(a, "inbox_open");
      expect(opened.entries).toHaveLength(1);
      expect(opened.entryUnreadIds).toHaveLength(1);
      expect(opened.unreadCount).toBe(1);
      expect(
        await read(
          a,
          "select id from notifications where event_key='entry:late' and read_at is null",
        ),
      ).toHaveLength(1);
    } finally {
      await db.exec(
        "drop trigger test_inbox_arrival on notifications; drop function test_inbox_arrival()",
      );
    }
  });
  it("does not expose new engagement notifications after their content/root becomes hidden", async () => {
    const pid = await post(a, "@beta");
    expect((await command(b, "inbox_open")).entries).toHaveLength(1);
    await db.query("update posts set hidden=true where id=$1", [pid]);
    expect((await command(b, "inbox_open")).entries).toEqual([]);
    const visible = await post(a, "দ্বিতীয় কথা"),
      root = await comment(visible, b);
    await comment(visible, c, "জবাব", { parent_id: root });
    await db.query("update comments set hidden=true where id=$1", [root]);
    expect((await command(b, "inbox_open")).entries).toEqual([]);
  });
  it("captures exactly the entry unread IDs, preserves read timestamps, and leaves later/foreign arrivals unread", async () => {
    const pid = await post();
    await comment(pid, b);
    await command(c, "follow", { id: a, enabled: true });
    await command(a, "follow", { id: b, enabled: true });
    const before = await read(
      a,
      "select id from notifications where read_at is null",
    );
    const first = await command(a, "inbox_open");
    expect(new Set(first.entryUnreadIds)).toEqual(
      new Set(before.map((n) => n.id)),
    );
    expect(first.unreadCount).toBe(0);
    expect(first.entries.every((n) => n.read_at)).toBe(true);
    const dates = await read(a, "select id,read_at from notifications");
    await comment(pid, c, "পরে এলাম");
    expect(
      await read(a, "select id from notifications where read_at is null"),
    ).toHaveLength(1);
    expect(
      await read(b, "select id from notifications where read_at is null"),
    ).toHaveLength(1);
    expect(
      (
        await read(
          a,
          "select id,read_at from notifications where id=any($1::uuid[])",
          [before.map((n) => n.id)],
        )
      ).sort((x, y) => x.id.localeCompare(y.id)),
    ).toEqual(dates.sort((x, y) => x.id.localeCompare(y.id)));
    expect((await command(a, "inbox_open")).entryUnreadIds).toHaveLength(1);
  });
  it("bounds entry updates at 100 and preserves explicit single/group/all read compatibility", async () => {
    await db.query(
      "insert into notifications(recipient_id,actor_id,kind,event_key) select $1,$2,'follow','bulk:'||i from generate_series(1,105) i",
      [a, b],
    );
    const opened = await command(a, "inbox_open");
    expect(opened.entries).toHaveLength(100);
    expect(opened.entryUnreadIds).toHaveLength(100);
    expect(opened.unreadCount).toBe(5);
    const rest = await read(
      a,
      "select id from notifications where read_at is null",
    );
    await command(a, "read", { ids: [rest[0].id, rest[1].id] });
    expect(
      await read(a, "select id from notifications where read_at is null"),
    ).toHaveLength(3);
    await command(a, "read", { id: rest[2].id });
    expect(
      await read(a, "select id from notifications where read_at is null"),
    ).toHaveLength(2);
    await command(a, "read");
    expect(
      await read(a, "select id from notifications where read_at is null"),
    ).toHaveLength(0);
  });
});
describe("mentions, editing and quotes", () => {
  it.each(["\u00a0", "\ufeff", "\u2000"])(
    "separates URL/mention at Unicode whitespace %j for resolution and notification",
    async (space) => {
      const pid = await post(a, `https://x.invalid/a${space}@beta`);
      expect((await stats(pid)).mentions).toEqual(["beta"]);
      expect(await read(b, "select kind,post_id from notifications")).toEqual([
        { kind: "mention", post_id: pid },
      ]);
    },
  );
  it("notifies each valid user once, excluding self/missing/repeated names and linked private fields", async () => {
    const pid = await post(a, "@alpha @beta @beta @missing @gamma");
    expect(await read(b, "select kind,post_id from notifications")).toEqual([
      { kind: "mention", post_id: pid },
    ]);
    expect(await read(a, "select kind from notifications")).toEqual([]);
    expect((await stats(pid)).mentions).toEqual(["alpha", "beta", "gamma"]);
    expect(JSON.stringify(await stats(pid))).not.toMatch(
      /phone|email|institution/,
    );
  });
  it("supports comment mentions and avoids a duplicate notification to the post/parent author", async () => {
    const pid = await post(),
      cid = await comment(pid, b, "@alpha @gamma");
    expect(
      await read(a, "select kind from notifications where comment_id=$1", [
        cid,
      ]),
    ).toEqual([{ kind: "comment" }]);
    expect(
      await read(c, "select kind from notifications where comment_id=$1", [
        cid,
      ]),
    ).toEqual([{ kind: "mention" }]);
  });
  it("respects recipient mute/block/suspension without leaking mention targets", async () => {
    await command(b, "mute", { id: a, enabled: true });
    await command(c, "block", { id: a, enabled: true });
    const pid = await post(a, "@beta @gamma");
    expect(await read(b, "select id from notifications")).toHaveLength(0);
    expect(await read(c, "select id from notifications")).toHaveLength(0);
    expect((await stats(pid)).mentions).toEqual(["beta"]);
    await db.query("update user_roles set suspended=true where user_id=$1", [
      b,
    ]);
    expect((await stats(pid)).mentions).toEqual([]);
  });
  it("edits body and hashtags within the window and notifies only new recipients once", async () => {
    const pid = await post(a, "@beta #আগের");
    const created = (
      await read(a, "select created_at from posts where id=$1", [pid])
    )[0].created_at;
    await command(a, "edit_post", { id: pid, body: "@beta @gamma #নতুন" });
    expect(await read(c, "select kind from notifications")).toEqual([
      { kind: "mention" },
    ]);
    await command(a, "edit_post", { id: pid, body: "শুধু #অন্য" });
    await command(a, "edit_post", { id: pid, body: "@beta @gamma নতুন কথা" });
    expect(await read(c, "select id from notifications")).toHaveLength(1);
    expect(await read(b, "select id from notifications")).toHaveLength(1);
    const row = (
      await read(
        a,
        "select body,created_at,updated_at from posts where id=$1",
        [pid],
      )
    )[0];
    expect(row.created_at).toEqual(created);
    expect(row.updated_at).toBeTruthy();
    expect(
      await read(a, "select tag from post_hashtags where post_id=$1", [pid]),
    ).toEqual([]);
  });
  it("enforces ownership, 15-minute expiry, Unicode bounds and hidden-post moderation", async () => {
    const pid = await post();
    await expect(
      command(b, "edit_post", { id: pid, body: "forged" }),
    ).rejects.toThrow(/not_found/);
    await expect(
      command(a, "edit_post", { id: pid, body: "🙂".repeat(241) }),
    ).rejects.toThrow(/posts_body_check/);
    await db.query(
      "update posts set created_at=clock_timestamp()-interval '15 minutes' where id=$1",
      [pid],
    );
    await expect(
      command(a, "edit_post", { id: pid, body: "too late" }),
    ).rejects.toThrow(/edit_expired/);
    await db.query("update posts set hidden=true where id=$1", [pid]);
    await expect(
      command(a, "edit_post", { id: pid, body: "hidden" }),
    ).rejects.toThrow(/not_found/);
  });
  it("rejects more than five distinct mentions at the direct RPC boundary", async () => {
    await expect(post(a, "@aaa @bbb @ccc @ddd @eee @fff")).rejects.toThrow(
      /mention_limit/,
    );
  });
  it("flattens quote-of-quote, permits empty commentary, notifies the root owner and preserves unavailable originals", async () => {
    const original = await post(),
      quoted = await post(b, "", { quote_id: original }),
      flattened = await post(c, "আমার কথা", { quote_id: quoted });
    expect((await stats(flattened, c)).quote.id).toBe(original);
    expect(
      await read(a, "select kind from notifications where post_id=$1", [
        quoted,
      ]),
    ).toEqual([{ kind: "quote" }]);
    await command(a, "delete_post", { id: original });
    expect((await stats(quoted, b)).quote).toBeNull();
    expect(
      (
        await read(b, "select is_quote,quoted_post_id from posts where id=$1", [
          quoted,
        ])
      )[0],
    ).toEqual({ is_quote: true, quoted_post_id: null });
    await expect(post(c, "না", { quote_id: quoted })).rejects.toThrow(
      /not_found/,
    );
  });
  it("conceals hidden/blocked/muted sources without hiding the quote itself", async () => {
    const original = await post(),
      quoted = await post(b, "কথা", { quote_id: original });
    await command(c, "block", { id: a, enabled: true });
    expect((await stats(quoted, c)).quote).toBeNull();
    await expect(post(c, "অন্য", { quote_id: original })).rejects.toThrow(
      /not_found/,
    );
    await db.query("update posts set hidden=true where id=$1", [original]);
    expect((await stats(quoted, b)).quote).toBeNull();
  });
  it("does not notify self quotes, and editing cannot alter quote/poll references", async () => {
    const original = await poll(),
      quoted = await post(a, "", { quote_id: original });
    expect(await read(a, "select id from notifications")).toEqual([]);
    expect((await stats(quoted)).quote.has_poll).toBe(true);
    expect((await stats(quoted)).poll).toBeNull();
    await command(a, "edit_post", { id: quoted, body: "যোগ করলাম" });
    await expect(
      command(a, "edit_post", { id: quoted, body: "আবার", quote_id: original }),
    ).rejects.toThrow(/invalid_action/);
    await expect(
      command(a, "edit_post", {
        id: original,
        body: "আবার",
        poll_options: ["x", "y"],
      }),
    ).rejects.toThrow(/invalid_action/);
  });
});
describe("private single-choice polls", () => {
  it("requires verified, unsuspended voters and a curated duration at the database boundary", async () => {
    const pid = await poll(),
      option = (await stats(pid)).poll.options[0].id;
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [b],
    );
    await expect(
      command(b, "vote_poll", { id: pid, option_id: option }),
    ).rejects.toThrow(/email_unverified/);
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [b],
    );
    await db.query("update user_roles set suspended=true where user_id=$1", [
      b,
    ]);
    await expect(
      command(b, "vote_poll", { id: pid, option_id: option }),
    ).rejects.toThrow(/account_suspended/);
    await expect(
      post(a, "ভুল সময়", { poll_options: ["a", "b"], poll_duration: 2 }),
    ).rejects.toThrow(/invalid_poll/);
    await expect(
      post(a, "ভুল ধরন", { poll_options: ["a", 1], poll_duration: 3600 }),
    ).rejects.toThrow(/invalid_poll/);
    await expect(
      post(a, "", { poll_options: ["a", "b"], poll_duration: 3600 }),
    ).rejects.toThrow(/posts_body_check/);
  });
  it.each([
    ["a", "b"],
    ["a", "b", "c", "d"],
    ["🙂".repeat(60), "না"],
  ])("creates valid options %j", async (...options) => {
    const pid = await poll(options);
    expect((await stats(pid)).poll.options.map((o) => o.body)).toEqual(options);
  });
  it.each([
    ["a"],
    ["a", "b", "c", "d", "e"],
    ["a", " "],
    ["Ａ", "a"],
    ["a b", "a\u2003b"],
    ["🙂".repeat(61), "b"],
  ])("rejects invalid options %j atomically", async (...options) => {
    await expect(poll(options)).rejects.toThrow();
    expect((await db.query("select id from posts")).rows).toEqual([]);
  });
  it("votes, switches without duplication, lets the owner vote, and exposes only anonymous counts/current selection", async () => {
    const pid = await poll(),
      state = (await stats(pid)).poll,
      [one, two] = state.options;
    await command(a, "vote_poll", { id: pid, option_id: one.id });
    await command(b, "vote_poll", { id: pid, option_id: one.id });
    await command(a, "vote_poll", { id: pid, option_id: two.id });
    const result = (await stats(pid)).poll;
    expect(result.options.map((o) => o.votes)).toEqual([1, 1]);
    expect(result.selected_option).toBe(two.id);
    expect((await stats(pid, null)).poll.selected_option).toBeNull();
    await expect(read(b, "select * from poll_votes")).rejects.toThrow(
      /permission denied/,
    );
    await expect(read(null, "select * from poll_votes")).rejects.toThrow(
      /permission denied/,
    );
    expect(JSON.stringify(result)).not.toContain(b);
  });
  it("rejects foreign options, guest/unverified/suspended/blocked voters and direct option/vote writes", async () => {
    const pid = await poll(),
      other = await post(b, "দ্বিতীয় পোল", {
        poll_options: ["x", "y"],
        poll_duration: 3600,
      });
    await expect(
      command(a, "vote_poll", {
        id: pid,
        option_id: (await stats(other)).poll.options[0].id,
      }),
    ).rejects.toThrow(/invalid_poll/);
    await expect(command(null, "vote_poll", { id: pid })).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      read(a, "update poll_options set body='forged' where post_id=$1", [pid]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      read(a, "insert into poll_votes values($1,$2,$3)", [
        pid,
        b,
        (await stats(pid)).poll.options[0].id,
      ]),
    ).rejects.toThrow(/permission denied/);
    await command(b, "block", { id: a, enabled: true });
    await expect(
      command(b, "vote_poll", {
        id: pid,
        option_id: (await stats(pid)).poll.options[0].id,
      }),
    ).rejects.toThrow(/not_found/);
  });
  it("expiration closes new/changed votes only, preserving post/options/final results until parent deletion", async () => {
    const pid = await poll(),
      option = (await stats(pid)).poll.options[0].id;
    await command(b, "vote_poll", { id: pid, option_id: option });
    await db.query(
      "update polls set expires_at=clock_timestamp()-interval '1 second' where post_id=$1",
      [pid],
    );
    await expect(
      command(a, "vote_poll", { id: pid, option_id: option }),
    ).rejects.toThrow(/poll_closed/);
    await expect(
      command(b, "vote_poll", {
        id: pid,
        option_id: (await stats(pid)).poll.options[1].id,
      }),
    ).rejects.toThrow(/poll_closed/);
    expect(
      await read(null, "select id from posts where id=$1", [pid]),
    ).toHaveLength(1);
    expect((await stats(pid, null)).poll.options[0].votes).toBe(1);
    await command(a, "delete_post", { id: pid });
    for (const table of ["polls", "poll_options", "poll_votes"])
      expect((await db.query(`select * from ${table}`)).rows).toEqual([]);
  });
  it("hidden/moderated parents also conceal poll options and aggregate results", async () => {
    const pid = await poll();
    await db.query("update posts set hidden=true where id=$1", [pid]);
    expect(
      await read(b, "select * from poll_options where post_id=$1", [pid]),
    ).toEqual([]);
    expect(await stats(pid, b)).toBeUndefined();
  });
});
