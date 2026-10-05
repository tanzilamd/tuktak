import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  mentionNames,
  pollOptionKey,
  pollRemaining,
  validPollOptions,
  voteOptimistically,
} from "@/lib/engagement";
import { commandSchemas } from "@/lib/validation";
import { RichText } from "@/components/rich-text";
import type { Poll } from "@/lib/types";
import { notificationGroups, type Notification } from "@/lib/notifications";

describe("safe mentions and Unicode poll rules", () => {
  it.each([
    ["হাই @alpha (@Beta) @alpha", ["alpha", "beta"]],
    ["mail@alpha.com https://x.invalid/@beta @gamma", ["gamma"]],
    ["@ab @abcdefghijklmnopqrstuvwxyz @valid_name", ["valid_name"]],
    ["বাংলা\u2003@alpha\n@beta", ["alpha", "beta"]],
    ["https://x.invalid/a\u00a0@gamma", ["gamma"]],
    ["https://x.invalid/a\ufeff@gamma", ["gamma"]],
  ])("parses %s deterministically", (text, names) =>
    expect(mentionNames(text)).toEqual(names),
  );
  it("links only resolved public usernames and escapes HTML", () => {
    const html = renderToStaticMarkup(
      RichText({
        text: "@alpha @missing <script>bad</script> mail@alpha.com https://x.invalid/@alpha",
        mentions: ["alpha"],
      }),
    );
    expect(html.match(/href="\/u\/alpha"/g)).toHaveLength(1);
    expect(html).not.toContain("/u/missing");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("bounds mention fan-out, preserving the existing normal post/reply limits", () => {
    expect(
      commandSchemas.post.safeParse({
        body: "@aaa @bbb @ccc @ddd @eee @fff",
        mood: "",
      }).success,
    ).toBe(false);
    expect(
      commandSchemas.comment.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        body: "🙂".repeat(180),
      }).success,
    ).toBe(true);
    expect(
      commandSchemas.comment.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        body: "🙂".repeat(181),
      }).success,
    ).toBe(false);
    expect(commandSchemas.post.safeParse({ body: "", mood: "" }).success).toBe(
      false,
    );
    expect(
      commandSchemas.post.safeParse({
        body: "",
        mood: "",
        quote_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }).success,
    ).toBe(true);
  });
  it.each([
    [" হ্যাঁ ", "হ্যাঁ"],
    ["Ａ  B", "a b"],
    ["a\u2003b", "a b"],
  ])("normalizes %s for duplicate comparison", (text, result) =>
    expect(pollOptionKey(text)).toBe(result),
  );
  it("rejects blanks, duplicate normalized answers, wrong option counts and Unicode overlength", () => {
    expect(validPollOptions(["হ্যাঁ", "না"])).toBe(true);
    expect(validPollOptions(["a", "b", "c", "d"])).toBe(true);
    for (const options of [
      ["a"],
      ["a", "b", "c", "d", "e"],
      ["a", " "],
      ["Ａ", "a"],
      ["a b", "a\u2003b"],
      ["🙂".repeat(61), "b"],
    ])
      expect(validPollOptions(options)).toBe(false);
    expect(validPollOptions(["🙂".repeat(60), "না"])).toBe(true);
  });
});
describe("poll state", () => {
  const poll: Poll = {
    expires_at: "2026-10-05T10:00:00Z",
    selected_option: null,
    options: [
      { id: "a", body: "a", votes: 0 },
      { id: "b", body: "b", votes: 2 },
    ],
  };
  it("optimistically adds/switches one vote without mutating the rollback snapshot", () => {
    const first = voteOptimistically(poll, "a");
    expect(first.options.map((o) => o.votes)).toEqual([1, 2]);
    const switched = voteOptimistically(first, "b");
    expect(switched.options.map((o) => o.votes)).toEqual([0, 3]);
    expect(voteOptimistically(switched, "b")).toBe(switched);
    expect(poll.options.map((o) => o.votes)).toEqual([0, 2]);
  });
  it("closes exactly at expiry and keeps zero-result arithmetic safe", () => {
    expect(
      pollRemaining(poll.expires_at, Date.parse(poll.expires_at)).closed,
    ).toBe(true);
    expect(
      pollRemaining(poll.expires_at, Date.parse(poll.expires_at) - 1),
    ).toEqual({ closed: false, value: 1, unit: "মিনিট" });
  });
});

it("keeps entry-new reaction groups separate from previously read events after auto-read", () => {
  const base: Notification = {
    id: "old",
    kind: "reaction",
    post_id: "post",
    comment_id: null,
    created_at: "2026-10-05T10:00:00Z",
    read_at: "2026-10-05T10:01:00Z",
    profiles: {
      id: "actor",
      username: "actor",
      display_name: "নাম",
      accent: "mint",
      status: "",
    },
  };
  const entries = [
    base,
    { ...base, id: "new-a" },
    { ...base, id: "new-b" },
    { ...base, id: "later", read_at: null },
  ];
  const groups = notificationGroups(entries, new Set(["new-a", "new-b"]));
  expect(groups.map((group) => group.map((n) => n.id))).toEqual([
    ["old"],
    ["new-a", "new-b"],
    ["later"],
  ]);
});
