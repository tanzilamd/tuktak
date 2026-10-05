import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBadge } from "../src/components/admin-badge";
const { topicRead } = vi.hoisted(() => ({ topicRead: vi.fn() }));
vi.mock("@/lib/data", () => ({ topics: topicRead }));
import { MobileTopics } from "../src/components/mobile-topics";
beforeEach(() => vi.clearAllMocks());
it("renders a plain noninteractive admin label only for an authoritative true value", () => {
  expect(renderToStaticMarkup(createElement(AdminBadge, { admin: true }))).toBe(
    '<span class="admin-badge">অ্যাডমিন</span>',
  );
  expect(
    renderToStaticMarkup(createElement(AdminBadge, { admin: false })),
  ).toBe("");
  expect(renderToStaticMarkup(createElement(AdminBadge, {}))).toBe("");
});
it("leaves no mobile topic element or gap when the current bounded topic source is empty", async () => {
  topicRead.mockResolvedValue([]);
  expect(await MobileTopics()).toBeNull();
  expect(topicRead).toHaveBeenCalledTimes(1);
});
it("links Bengali and Latin topic chips to existing encoded tag routes without exposing counts or identities", async () => {
  topicRead.mockResolvedValue([
    { tag: "আড্ডা", count: 3 },
    { tag: "cricket", count: 2 },
  ]);
  const html = renderToStaticMarkup(await MobileTopics());
  expect(html).toContain('aria-labelledby="mobile-topics-heading"');
  expect(html).toContain(`/tag/${encodeURIComponent("আড্ডা")}`);
  expect(html).toContain("/tag/cricket");
  expect(html).toContain("#আড্ডা");
  expect(html).not.toContain("count");
});
it("right rail uses the supplied current viewer and omits profile/signup panels for guests", async () => {
  const { RightRail } = await import("../src/components/right-rail");
  const { demoProfiles } = await import("../src/lib/demo");
  topicRead.mockResolvedValue([]);
  const guest = renderToStaticMarkup(await RightRail({ viewer: null }));
  expect(guest).not.toContain("rail-profile");
  expect(guest).not.toContain("/signup");
  expect(guest).not.toContain("/login");
  expect(topicRead).toHaveBeenCalledTimes(1);
  const profile = {
    ...demoProfiles[0],
    display_name: "বর্তমান নাম",
    is_admin: true,
  };
  const signed = renderToStaticMarkup(
    await RightRail({
      viewer: { id: profile.id, profile, role: "admin", suspended: false },
    }),
  );
  expect(signed).toContain('class="mini-profile rail-profile"');
  expect(signed).toContain("বর্তমান নাম");
  expect(signed).toContain("অ্যাডমিন");
  expect(signed.indexOf("rail-profile")).toBeLessThan(
    signed.indexOf("rail-card"),
  );
  expect(topicRead).toHaveBeenCalledTimes(2);
});
