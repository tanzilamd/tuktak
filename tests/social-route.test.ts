import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  command: vi.fn(),
  feed: vi.fn(),
  post: vi.fn(),
  comments: vi.fn(),
  stats: vi.fn(),
  relationships: vi.fn(),
  counts: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/commands", () => ({ executeCommand: mocks.command }));
vi.mock("@/lib/data", () => ({
  feed: mocks.feed,
  getPost: mocks.post,
  comments: mocks.comments,
  postStats: mocks.stats,
  relationships: mocks.relationships,
  followCounts: mocks.counts,
}));
import { GET, POST } from "@/app/api/social/route";
const id = "10000000-0000-4000-8000-000000000001";
function request(payload: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://0.0.0.0:3000/api/social", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.command.mockResolvedValue({ ok: true, message: "হয়ে গেছে ✨", id });
});
describe("caller-session social endpoint", () => {
  it("accepts the routed Host when the internal bind address differs", async () => {
    mocks.stats.mockResolvedValue({
      reaction_counts: { love: 2 },
      current_reaction: "love",
      comment_count: 1,
    });
    const response = await POST(request({ action: "react", id, kind: "love" }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      ok: true,
      stats: { current_reaction: "love" },
    });
    expect(mocks.command).toHaveBeenCalledOnce();
    expect(mocks.command.mock.calls[0][0].get("id")).toBe(id);
  });
  it.each(["https://attacker.invalid", "null", ""])(
    "rejects Origin %s before authorization or database work",
    async (origin) => {
      expect(
        (await POST(request({ action: "react", id }, { origin }))).status,
      ).toBe(403);
      expect(mocks.command).not.toHaveBeenCalled();
    },
  );
  it("rejects privileged actions and oversized or malformed payloads", async () => {
    expect(
      (await POST(request({ action: "role", id, role: "admin" }))).status,
    ).toBe(400);
    expect(
      (await POST(request({ action: "post", body: "a".repeat(4097) }))).status,
    ).toBe(413);
    expect(
      (await POST(request({ action: "react", id, kind: {} }))).status,
    ).toBe(400);
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("preserves database rejections and does not fetch fake confirmed state", async () => {
    mocks.command.mockResolvedValue({
      ok: false,
      message: "তোমার অ্যাকাউন্ট আপাতত স্থগিত আছে।",
    });
    expect(
      await (
        await POST(request({ action: "post", body: "কথা", mood: "" }))
      ).json(),
    ).toMatchObject({ ok: false });
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("returns canonical post IDs, discussion rows/counts and relationship state", async () => {
    mocks.post.mockResolvedValue({ id });
    expect(
      await (
        await POST(request({ action: "post", body: "কথা", mood: "" }))
      ).json(),
    ).toMatchObject({ post: { id } });
    mocks.comments.mockResolvedValue([{ id: "canonical-comment" }]);
    mocks.stats.mockResolvedValue({ comment_count: 1 });
    expect(
      await (
        await POST(request({ action: "comment", id, body: "উত্তর" }))
      ).json(),
    ).toMatchObject({
      comments: [{ id: "canonical-comment" }],
      stats: { comment_count: 1 },
    });
    mocks.relationships.mockResolvedValue(new Set([id]));
    mocks.counts.mockResolvedValue({ followers: 7, following: 2 });
    expect(
      await (
        await POST(request({ action: "follow", id, enabled: true }))
      ).json(),
    ).toMatchObject({ following: true, counts: { followers: 7 } });
  });
  it("marks a post-commit read failure as uncertain without replaying the command", async () => {
    mocks.post.mockRejectedValue(new Error("Read failed"));
    expect(
      await (
        await POST(request({ action: "post", body: "কথা", mood: "" }))
      ).json(),
    ).toMatchObject({ ok: false, uncertain: true });
    expect(mocks.command).toHaveBeenCalledOnce();
  });
  it("validates scoped feed inputs and passes through the full stable cursor", async () => {
    mocks.feed.mockResolvedValue([]);
    const cursor = `2026-10-04T10:00:00Z|${id}`;
    const response = await GET(
      new NextRequest(
        `http://localhost/api/social?feed=following&before=${encodeURIComponent(cursor)}`,
      ),
    );
    expect(await response.json()).toEqual({ ok: true, posts: [] });
    expect(mocks.feed).toHaveBeenCalledWith({
      mode: "following",
      before: cursor,
    });
    expect(
      (await GET(new NextRequest("http://localhost/api/social?feed=admin")))
        .status,
    ).toBe(400);
  });
});
