import { describe, it, expect } from "vitest";
import {
  commandSchemas,
  phoneSchema,
  usernameSchema,
  registrationSchema,
} from "../src/lib/validation";
import {
  charCount,
  questionOfDay,
  safeNext,
  loginHref,
} from "../src/lib/config";
describe("server boundary validation", () => {
  it("counts Unicode codepoints like PostgreSQL, including Bengali and emoji", () => {
    expect(charCount("কি🙂")).toBe(3);
    expect(
      commandSchemas.post.safeParse({ body: "🙂".repeat(240), mood: "" })
        .success,
    ).toBe(true);
    expect(
      commandSchemas.post.safeParse({ body: "🙂".repeat(241), mood: "" })
        .success,
    ).toBe(false);
    expect(
      commandSchemas.comment.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        body: "a".repeat(181),
      }).success,
    ).toBe(false);
  });
  it("rejects blank text, unsafe usernames and reserved usernames", () => {
    expect(
      commandSchemas.post.safeParse({ body: " \n ", mood: "" }).success,
    ).toBe(false);
    expect(usernameSchema.parse("New_User")).toBe("new_user");
    for (const v of ["Admin", "api", "bad-name", "a", "x".repeat(21)])
      expect(usernameSchema.safeParse(v).success).toBe(false);
  });
  it("normalizes private BD phone numbers without exposing them in public schema", () => {
    expect(phoneSchema.parse("01700 000000")).toBe("+8801700000000");
    expect(phoneSchema.safeParse("1234").success).toBe(false);
    expect(
      registrationSchema.safeParse({
        email: "invalid",
        password: "short",
        username: "rafi",
        phone: "1234",
        display_name: "রাফি",
      }).success,
    ).toBe(false);
  });
  it("uses Dhaka calendar days deterministically for daily questions", () => {
    expect(questionOfDay(new Date("2026-10-03T18:01:00Z"))).toBe(
      questionOfDay(new Date("2026-10-04T15:00:00Z")),
    );
  });
  it("rejects external and protocol relative redirects", () => {
    for (const v of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/\n/evil.test",
      "/\t/evil.test",
      null,
    ])
      expect(safeNext(v)).toBe("/");
    expect(safeNext("/onboarding")).toBe("/onboarding");
  });
});

it("preserves only safe login destinations, without action replay", () => {
  expect(loginHref("/post/example?comment=one#comment-one")).toBe(
    "/login?next=%2Fpost%2Fexample%3Fcomment%3Done%23comment-one",
  );
  expect(loginHref("https://evil.test")).toBe("/login?next=%2F");
});
it("gives safe specific Bengali username guidance", async () => {
  const { validationFailure } = await import("../src/lib/form-errors");
  for (const [value, expected] of [
    ["student friend", "স্পেস"],
    ["student-friend", "ইংরেজি"],
    ["ab", "অন্তত ৩"],
    ["admin", "সংরক্ষিত"],
  ]) {
    const result = registrationSchema.safeParse({
      email: "student@example.invalid",
      password: "LongNeutralPassword!",
      username: value,
      display_name: "বন্ধু",
      phone: "01700000000",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(validationFailure(result.error).fieldErrors?.username).toContain(
        expected,
      );
  }
});
