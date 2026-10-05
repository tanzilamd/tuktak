import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  ACCENT_LABELS,
  QUESTIONS,
  questionOfDay,
} from "../src/lib/config";
import {
  batchSchema,
  profileSchema,
  registrationSchema,
} from "../src/lib/validation";
import { relativeTime, exactTime } from "../src/lib/time";
import {
  notificationGroups,
  notificationHref,
  notificationLabel,
} from "../src/lib/notifications";
import { demoProfiles } from "../src/lib/demo";
import { validationFailure } from "../src/lib/form-errors";
import { publicMetadata } from "../src/lib/metadata";

describe("Dhaka daily questions", () => {
  it("stays stable throughout one Dhaka calendar day, not one UTC day", () => {
    expect(questionOfDay(new Date("2026-10-04T18:00:00Z"))).toBe(
      questionOfDay(new Date("2026-10-05T17:59:59Z")),
    );
    expect(questionOfDay(new Date("2026-10-04T17:59:59Z"))).not.toBe(
      questionOfDay(new Date("2026-10-04T18:00:00Z")),
    );
  });
  it("changes each day, including pool wraparound, month/year boundaries, without recent repeats", () => {
    expect(new Set(QUESTIONS).size).toBe(QUESTIONS.length);
    const start = Date.parse("2026-12-20T18:00:00Z");
    const questions = Array.from({ length: QUESTIONS.length * 2 }, (_, i) =>
      questionOfDay(new Date(start + i * 86400000)),
    );
    expect(new Set(questions.slice(0, QUESTIONS.length)).size).toBe(
      QUESTIONS.length,
    );
    for (let i = 1; i < questions.length; i++)
      expect(questions[i]).not.toBe(questions[i - 1]);
  });
});
describe("numeric and status boundaries", () => {
  it.each([
    ["2025", "2025"],
    ["২০২৫", "2025"],
    ["20২৫", "2025"],
    [" ২০২৫ ", "2025"],
    ["", ""],
    ["1999", "1999"],
    ["2999", "2999"],
  ])(
    "normalizes %s to %s without altering saved ASCII years",
    (input, expected) => expect(batchSchema.parse(input)).toBe(expected),
  );
  it.each(["20x৫", "২০২৫ সাল", "99", "0999", "৩০০০", "2025.0", "٢٠٢٥"])(
    "rejects invalid/mixed/out-of-range year %s",
    (input) => expect(batchSchema.safeParse(input).success).toBe(false),
  );
  it("accepts 40 status codepoints, preserves emoji, and clears whitespace", () => {
    const schema = profileSchema.shape.status;
    expect(schema.parse("🙂".repeat(40))).toBe("🙂".repeat(40));
    expect(schema.safeParse("🙂".repeat(41)).success).toBe(false);
    expect(schema.parse(" \u2003\n ")).toBe("");
    expect(schema.parse("  আজ ভালো আছি 🌿  ")).toBe("আজ ভালো আছি 🌿");
    expect(profileSchema.shape.bio.parse("সাল ২০২৫")).toBe("সাল ২০২৫");
  });
  it("keeps accent IDs while changing only display labels", () => {
    expect(ACCENTS).toEqual(["mango", "mint", "berry", "sky"]);
    expect(Object.keys(ACCENT_LABELS)).toEqual([...ACCENTS]);
    for (const accent of ACCENTS)
      expect(profileSchema.shape.accent.parse(accent)).toBe(accent);
  });
  it("returns safe field-level validation feedback without schema internals", () => {
    const parsed = registrationSchema.safeParse({
      display_name: "",
      username: "admin",
      email: "bad",
      phone: "123",
      password: "short",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const result = validationFailure(parsed.error);
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
      "display_name",
      "email",
      "password",
      "phone",
      "username",
    ]);
    expect(result.fieldErrors?.username).toContain("সংরক্ষিত");
    expect(JSON.stringify(result)).not.toMatch(/Invalid|expected|Zod|SQL/);
  });
});
describe("relative timestamps", () => {
  const now = new Date("2026-10-05T06:00:00Z");
  it.each([
    [0, "এইমাত্র"],
    [59, "এইমাত্র"],
    [60, "১ মিনিট"],
    [3599, "৫৯ মিনিট"],
    [3600, "১ ঘণ্টা"],
    [86399, "২৩ ঘণ্টা"],
    [86400, "৪ অক্টোবর"],
    [259200, "২ অক্টোবর"],
  ])(
    "formats %s seconds without unbounded minutes/hours",
    (seconds, expected) =>
      expect(
        relativeTime(
          new Date(now.getTime() - seconds * 1000).toISOString(),
          now,
        ),
      ).toBe(expected),
  );
  it("uses Dhaka dates and handles invalid/future input safely", () => {
    expect(relativeTime("2026-10-03T20:00:00Z", now)).toBe("৪ অক্টোবর");
    expect(relativeTime("2027-01-01T00:00:00Z", now)).toBe("এইমাত্র");
    expect(relativeTime("invalid", now)).toBe("");
    expect(exactTime("2026-10-04T18:01:00Z")).toContain("৫ অক্টোবর");
  });
});
describe("notification scope and presentation", () => {
  const entry = {
    id: "a",
    kind: "reaction",
    post_id: "post",
    comment_id: null,
    read_at: null,
    created_at: "2026-10-05T00:00:00Z",
    profiles: demoProfiles[0],
  };
  it("groups only same-post, same-read-state reactions", () => {
    const groups = notificationGroups([
      entry,
      { ...entry, id: "b" },
      { ...entry, id: "c", post_id: "other" },
      { ...entry, id: "d", read_at: entry.created_at },
      { ...entry, id: "e", kind: "comment" },
    ]);
    expect(groups.map((group) => group.map((n) => n.id))).toEqual([
      ["a", "b"],
      ["c"],
      ["d"],
      ["e"],
    ]);
  });
  it("links replies to their anchor and caps accessible badge labels", () => {
    expect(notificationHref({ ...entry, comment_id: "reply" })).toBe(
      "/post/post?comment=reply#comment-reply",
    );
    expect(notificationHref({ ...entry, kind: "follow", post_id: null })).toBe(
      `/u/${demoProfiles[0].username}`,
    );
    expect(notificationLabel(0)).toBe("খবর");
    expect(notificationLabel(12)).toContain("১২টি অপঠিত");
    expect(notificationLabel(100)).toContain("৯৯+");
  });
});
it("uses production canonicals and sharing metadata without private fields", () => {
  const metadata = publicMetadata("/terms", "ব্যবহারের শর্ত");
  expect(metadata.alternates?.canonical).toBe(
    "https://tuktakbd.vercel.app/terms",
  );
  expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  expect(JSON.stringify(metadata)).not.toMatch(
    /localhost|phone|email|password/,
  );
});
