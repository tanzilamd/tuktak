import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoPosts, demoProfiles } from "@/lib/demo";
const { dbMock } = vi.hoisted(() => ({ dbMock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ db: dbMock }));
import { feed, getPost, relationships } from "@/lib/data";

function query(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };
}
function client(followError: unknown = null) {
  const rows = demoPosts.slice(0, 3).map((p) => ({
    id: p.id,
    author_id: p.author_id,
    body: p.body,
    mood: p.mood,
    created_at: p.created_at,
    profiles: p.profiles,
  }));
  const follows = query([{ following_id: demoProfiles[1].id }], followError);
  const posts = query(rows);
  const instance = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: demoProfiles[0].id } } }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") return query(demoProfiles[0]);
      if (table === "user_roles")
        return query({ role: "user", suspended: false });
      if (table === "follows") return follows;
      if (table === "posts") return posts;
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue({
      data: {
        [rows[0].id]: {
          reaction_counts: { love: 1 },
          current_reaction: null,
          comment_count: 0,
        },
        [rows[1].id]: {
          reaction_counts: { love: 2, haha: 3 },
          current_reaction: "haha",
          comment_count: 2,
        },
        [rows[2].id]: {
          reaction_counts: { fire: 3 },
          current_reaction: null,
          comment_count: 1,
        },
      },
      error: null,
    }),
  };
  dbMock.mockResolvedValue(instance);
  return { instance, rows, posts, follows };
}
beforeEach(() => vi.clearAllMocks());

describe("post view model and Discover ranking", () => {
  it("ranks the bounded recent posts by aggregate reaction totals, not recency or legacy arrays", async () => {
    const { rows, instance } = client();
    const result = await feed({ popular: true });
    expect(result.map((p) => p.id)).toEqual([
      rows[1].id,
      rows[2].id,
      rows[0].id,
    ]);
    expect(result[0]).toMatchObject({
      reaction_counts: { love: 2, haha: 3 },
      current_reaction: "haha",
      comment_count: 2,
    });
    expect(result[0]).not.toHaveProperty("reactions");
    expect(result[0]).not.toHaveProperty("comments");
    expect(instance.rpc).toHaveBeenCalledWith("post_stats", {
      ids: rows.map((p) => p.id),
    });
  });
  it("keeps normal feeds chronological and uses the same aggregates on post details", async () => {
    const { rows, posts } = client();
    expect((await feed()).map((p) => p.id)).toEqual(rows.map((p) => p.id));
    posts.then = query(rows[1]).then;
    expect(await getPost(rows[1].id)).toMatchObject({
      reaction_counts: { love: 2, haha: 3 },
      current_reaction: "haha",
      comment_count: 2,
    });
  });
  it("uses the same required aggregate model for fictional preview posts", async () => {
    dbMock.mockResolvedValue(null);
    const posts = await feed({ popular: true });
    expect(posts).toHaveLength(5);
    expect(
      posts.map((p) =>
        Object.values(p.reaction_counts).reduce((a, b) => a + b, 0),
      ),
    ).toEqual([7, 6, 5, 4, 3]);
    expect(
      posts.every(
        (p) =>
          p.current_reaction === null &&
          p.comment_count === 0 &&
          !("reactions" in p),
      ),
    ).toBe(true);
    expect(demoPosts).toHaveLength(6);
  });
  it("omits posts that become inaccessible before the aggregate RPC completes", async () => {
    const { instance, rows } = client();
    instance.rpc.mockResolvedValue({
      data: {
        [rows[1].id]: {
          reaction_counts: { haha: 3 },
          current_reaction: null,
          comment_count: 0,
        },
      },
      error: null,
    });
    expect((await feed()).map((p) => p.id)).toEqual([rows[1].id]);
  });
});
describe("batched follow relationships", () => {
  it("uses one session-scoped query for all displayed IDs and distinguishes followed users", async () => {
    const { instance, follows } = client();
    const ids = demoProfiles.map((p) => p.id);
    const result = await relationships([...ids, ids[1]]);
    expect([...result]).toEqual([ids[1]]);
    expect(result.has(ids[2])).toBe(false);
    expect(
      instance.from.mock.calls.filter(([table]) => table === "follows"),
    ).toHaveLength(1);
    expect(follows.eq).toHaveBeenCalledWith("follower_id", ids[0]);
    expect(follows.in).toHaveBeenCalledWith("following_id", ids);
  });
  it("does not query follows for guests or empty lists", async () => {
    expect(await relationships([])).toEqual(new Set());
    expect(dbMock).not.toHaveBeenCalled();
    const { instance } = client();
    instance.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await relationships(demoProfiles.map((p) => p.id))).toEqual(
      new Set(),
    );
    expect(instance.from).not.toHaveBeenCalled();
  });
  it("surfaces database failures instead of reporting every user as unfollowed", async () => {
    client({ message: "unavailable" });
    await expect(relationships([demoProfiles[1].id])).rejects.toThrow(
      "Database request failed",
    );
  });
});
