import { expect, it, vi } from "vitest";
import { publicShareUrl, sharePublicLink } from "../src/lib/share";
import { SITE_URL } from "../src/lib/config";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const url = new URL(`/post/${id}`, SITE_URL).href;
it("shares only the Bengali text and exact canonical URL", async () => {
  const share = vi.fn().mockResolvedValue(undefined),
    writeText = vi.fn();
  expect(await sharePublicLink(url, { share, clipboard: { writeText } })).toBe(
    "shared",
  );
  expect(share).toHaveBeenCalledWith({ text: "টুকটাকে দেখো", url });
  expect(writeText).not.toHaveBeenCalled();
});
it("uses stable UUID post paths and current lower-case public username paths", () => {
  expect(publicShareUrl({ kind: "post", id })).toBe(url);
  expect(publicShareUrl({ kind: "profile", id: "Campus_Friend" })).toBe(
    new URL("/u/campus_friend", SITE_URL).href,
  );
  const hostile = publicShareUrl({
    kind: "profile",
    id: "x?token=secret#private",
  });
  expect(new URL(hostile).search).toBe("");
  expect(new URL(hostile).hash).toBe("");
});
it("copies only the URL when native share is unavailable or cannot accept it", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined),
    share = vi.fn();
  expect(await sharePublicLink(url, { clipboard: { writeText } })).toBe(
    "copied",
  );
  expect(
    await sharePublicLink(url, {
      share,
      canShare: () => false,
      clipboard: { writeText },
    }),
  ).toBe("copied");
  expect(writeText).toHaveBeenCalledWith(url);
  expect(share).not.toHaveBeenCalled();
});
it("does not copy, error or replay after the user cancels the share sheet", async () => {
  const writeText = vi.fn(),
    share = vi
      .fn()
      .mockRejectedValue(new DOMException("Cancelled", "AbortError"));
  expect(await sharePublicLink(url, { share, clipboard: { writeText } })).toBe(
    "cancelled",
  );
  expect(writeText).not.toHaveBeenCalled();
});
it("falls back after native denial and offers manual copy when clipboard is blocked", async () => {
  const share = vi
      .fn()
      .mockRejectedValue(new Error("private internal details")),
    writeText = vi.fn().mockRejectedValue(new Error("denied"));
  expect(await sharePublicLink(url, { share, clipboard: { writeText } })).toBe(
    "manual",
  );
  expect(await sharePublicLink(url, {})).toBe("manual");
});
