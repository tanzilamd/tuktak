import { describe, expect, it } from "vitest";
import {
  communitySaveSchema,
  communityInput,
  dhakaInput,
  safeCommunityLink,
  COMMUNITY_FIELD_MESSAGES,
  communityCommandSchemas,
} from "../src/lib/community";
import { validationFailure } from "../src/lib/form-errors";
import { commandSchemas } from "../src/lib/validation";
const base = { active: true, position: 0 };
const banner = {
  ...base,
  kind: "announcements",
  body: "কথা",
  title: "",
  priority: 1,
  dismissible: true,
  starts_at: "2026-10-06T12:00",
  ends_at: "",
  link: "",
};
describe("community management form boundaries", () => {
  it("uses distinct Unicode limits for questions, prompts, moods and announcements", () => {
    for (const [kind, limit] of [
      ["questions", 160],
      ["prompts", 120],
    ] as const) {
      expect(
        communitySaveSchema.safeParse({
          ...base,
          kind,
          body: "🙂".repeat(limit),
        }).success,
      ).toBe(true);
      expect(
        communitySaveSchema.safeParse({
          ...base,
          kind,
          body: "🙂".repeat(limit + 1),
        }).success,
      ).toBe(false);
      expect(
        communitySaveSchema.safeParse({ ...base, kind, body: " \u2003 " })
          .success,
      ).toBe(false);
    }
    expect(
      communitySaveSchema.safeParse({
        ...base,
        kind: "moods",
        label: "🙂".repeat(40),
        emoji: "🙂".repeat(12),
      }).success,
    ).toBe(true);
    expect(
      communitySaveSchema.safeParse({ ...banner, body: "🙂".repeat(241) })
        .success,
    ).toBe(false);
    expect(
      communitySaveSchema.safeParse({
        ...base,
        kind: "moods",
        label: " ",
        emoji: "",
      }).success,
    ).toBe(false);
  });
  it("normalizes curated topic tags without losing Bengali vowel signs or digits", () => {
    for (const value of ["#টুকটাক২০২৯", "#PLAY", "টিকি"]) {
      const row = communitySaveSchema.parse({
        ...base,
        kind: "topics",
        tag: value,
        expires_at: "",
      });
      expect(row.kind === "topics" && row.tag).toBe(
        value.replace(/^#/, "").toLowerCase(),
      );
    }
    for (const tag of ["bad tag", "bad-link", "#", "a".repeat(41)])
      expect(
        communitySaveSchema.safeParse({
          ...base,
          kind: "topics",
          tag,
          expires_at: "",
        }).success,
      ).toBe(false);
  });
  it("interprets schedules as Dhaka local time and rejects invalid dates/reversed ranges", () => {
    const row = communitySaveSchema.parse(banner);
    expect(row.kind === "announcements" && row.starts_at).toBe(
      "2026-10-06T06:00:00.000Z",
    );
    expect(dhakaInput("2026-10-05T18:01Z")).toBe("2026-10-06T00:01");
    expect(dhakaInput("invalid")).toBe("");
    for (const starts_at of [
      "",
      "2026-02-30T12:00",
      "2026-10-06T25:00",
      "2026-10-06T12:00Z",
    ])
      expect(
        communitySaveSchema.safeParse({ ...banner, starts_at }).success,
      ).toBe(false);
    const parsed = communitySaveSchema.safeParse({
      ...banner,
      ends_at: "2026-10-06T11:00",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(
        validationFailure(parsed.error, COMMUNITY_FIELD_MESSAGES).fieldErrors,
      ).toHaveProperty("ends_at");
  });
  it("accepts only safe relative or HTTPS links without credentials or hidden separators", () => {
    for (const link of ["", "/", "/community", "https://example.com/a?b=1#c"])
      expect(safeCommunityLink(link)).toBe(true);
    for (const link of [
      "//evil.test",
      "javascript:alert(1)",
      "http://example.test",
      "https://user:pass@example.test",
      "/\\evil",
      "/a\nb",
      "https://example.test:99999",
      "https://例子.test",
    ])
      expect(safeCommunityLink(link)).toBe(false);
  });
  it("parses checkbox defaults and shares schemas with the server command boundary", () => {
    const form = new FormData();
    form.set("kind", "questions");
    form.set("body", "প্রশ্ন");
    form.set("position", "2");
    expect(
      communityCommandSchemas.community_save.parse(communityInput(form)),
    ).toMatchObject({ active: false, position: 2, body: "প্রশ্ন" });
    form.set("active", "on");
    expect(communityInput(form).active).toBe(true);
    expect(
      communityCommandSchemas.community_toggle.safeParse({
        kind: "questions",
        id: "bad",
        active: true,
      }).success,
    ).toBe(false);
  });
  it("retains the historical post boundary but leaves active mood authorization to SQL", () => {
    expect(
      commandSchemas.post.safeParse({ body: "পোস্ট", mood: "🪁 নতুন মুড" })
        .success,
    ).toBe(true);
    expect(
      commandSchemas.post.safeParse({ body: "পোস্ট", mood: "🙂".repeat(61) })
        .success,
    ).toBe(false);
  });
});
