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
