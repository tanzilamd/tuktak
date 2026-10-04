import { describe, expect, it, vi } from "vitest";
import { toggleReaction, requestSocial } from "@/lib/social";
import { FeedCache } from "@/lib/feed-cache";
import { demoPosts } from "@/lib/demo";

describe("optimistic reactions", () => {
  it("adds, switches and removes one reaction without mutating its rollback snapshot", () => {
    const initial = {
      reaction_counts: { love: 7, fire: 2 },
      current_reaction: null,
      comment_count: 4,
    };
    const added = toggleReaction(initial, "love");
    const switched = toggleReaction(added, "fire");
    const removed = toggleReaction(switched, "fire");
    expect(added).toMatchObject({
      reaction_counts: { love: 8, fire: 2 },
      current_reaction: "love",
    });
    expect(switched).toMatchObject({
      reaction_counts: { love: 7, fire: 3 },
      current_reaction: "fire",
    });
    expect(removed).toMatchObject({
      reaction_counts: initial.reaction_counts,
      current_reaction: null,
      comment_count: 4,
    });
    expect(initial.reaction_counts).toEqual({ love: 7, fire: 2 });
    expect(
      toggleReaction({ ...initial, current_reaction: "haha" }, "haha")
        .reaction_counts.haha,
    ).toBe(0);
  });
  it("treats lost or malformed responses as uncertain and never retries a toggle", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Lost response"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const form = new FormData();
      form.set("action", "react");
      expect(await requestSocial(form)).toMatchObject({
        ok: false,
        uncertain: true,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      fetchMock.mockResolvedValue({ json: () => ({}) });
      expect(await requestSocial(form)).toMatchObject({
        ok: false,
        uncertain: true,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
describe("session-local feed cache", () => {
  it("coalesces prefetch and selection, expires after five seconds and does not cross instances", async () => {
    let now = 0;
    const cache = new FeedCache(() => now);
    const read = vi.fn().mockResolvedValue(demoPosts);
    const first = cache.load("all|", read);
    expect(cache.load("all|", read)).toBe(first);
    expect(await first).toEqual(demoPosts);
    now = 4999;
    expect(await cache.load("all|", read)).toEqual(demoPosts);
    expect(read).toHaveBeenCalledTimes(1);
    expect(new FeedCache(() => now).peek("all|")).toBeUndefined();
    now = 5000;
    await cache.load("all|", read);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("discards stale in-flight responses after a social mutation", async () => {
    const cache = new FeedCache();
    let resolve!: (posts: typeof demoPosts) => void;
    const request = cache.load(
      "all|",
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    cache.clear();
    cache.seed("all|", demoPosts.slice(1));
    resolve(demoPosts);
    expect(await request).toBeNull();
    expect(cache.peek("all|")).toEqual(demoPosts.slice(1));
  });
  it("does not cache failures or retain an unbounded cursor history", async () => {
    const cache = new FeedCache();
    await expect(
      cache.load("all|", () => Promise.reject(new Error("Unavailable"))),
    ).rejects.toThrow();
    expect(cache.peek("all|")).toBeUndefined();
    expect(await cache.load("all|", () => Promise.resolve(demoPosts))).toEqual(
      demoPosts,
    );
    for (let i = 0; i < 9; i++) cache.seed(`all|${i}`, demoPosts);
    expect(cache.peek("all|0")).toBeUndefined();
    expect(cache.peek("all|8")).toEqual(demoPosts);
  });
});
