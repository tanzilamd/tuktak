import "server-only";
import { cache } from "react";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "./supabase";
import { demoPosts, demoProfiles } from "./demo";
import type { Profile, Post, PostStats, Comment, Viewer } from "./types";
import type { Notification } from "./notifications";
type PostRow = Omit<Post, keyof PostStats>;
function popularPosts(posts: Post[]) {
  const total = (post: Post) =>
    Object.values(post.reaction_counts).reduce((sum, count) => sum + count, 0);
  // Stable sort keeps the existing chronological order when totals tie.
  return [...posts].sort((a, b) => total(b) - total(a)).slice(0, 5);
}
export const PUBLIC_PROFILE =
  "id,username,display_name,bio,education,institution,class_year,ssc_batch,hsc_batch,hobbies,status,accent,discoverable,created_at";
export const POST_SELECT = `id,author_id,body,mood,created_at,profiles!posts_author_id_fkey(${PUBLIC_PROFILE})`;
export const viewer = cache(async (): Promise<Viewer | null> => {
  const client = await db();
  if (!client) return null;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const [{ data: profile, error }, { data: role, error: roleError }] =
    await Promise.all([
      client.from("profiles").select(PUBLIC_PROFILE).eq("id", user.id).single(),
      client
        .from("user_roles")
        .select("role,suspended")
        .eq("user_id", user.id)
        .single(),
    ]);
  if (error || roleError || !profile || !role)
    throw new Error("Account lookup failed");
  return {
    id: user.id,
    profile: profile as Profile,
    role: role.role,
    suspended: role.suspended,
  };
});
export async function requireViewer(allowSuspended = false) {
  const v = await viewer();
  if (!v) redirect("/login");
  if (v.suspended && !allowSuspended) redirect("/suspended");
  return v;
}
function checked<T>(data: T | null, error: unknown): T {
  if (error) throw new Error("Database request failed");
  return data!;
}
export async function feed(
  options: {
    mode?: string;
    author?: string;
    tag?: string;
    before?: string;
    popular?: boolean;
  } = {},
): Promise<Post[]> {
  const client = await db();
  if (!client) {
    let posts = demoPosts;
    if (options.author)
      posts = posts.filter((p) => p.author_id === options.author);
    if (options.tag)
      posts = posts.filter((p) =>
        p.body.toLowerCase().includes("#" + options.tag!.toLowerCase()),
      );
    return options.popular ? popularPosts(posts) : posts;
  }
  const v = await viewer();
  let q = client
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(v ? 20 : 8);
  if (options.before) {
    const [time, id] = options.before.split("|");
    if (!isNaN(Date.parse(time))) {
      const timestamp = new Date(time).toISOString();
      q =
        id && /^[0-9a-f-]{36}$/i.test(id)
          ? q.or(
              `created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${id})`,
            )
          : q.lt("created_at", timestamp);
    }
  }
  if (options.author) q = q.eq("author_id", options.author);
  if (options.tag) {
    const { data, error } = await client
      .from("post_hashtags")
      .select("post_id")
      .eq("tag", options.tag.toLowerCase())
      .limit(200);
    checked(data, error);
    q = q.in("id", data?.map((p) => p.post_id) ?? []);
  }
  if (options.mode === "following") {
    if (!v) return [];
    const { data, error } = await client
      .from("follows")
      .select("following_id")
      .eq("follower_id", v.id)
      .limit(1000);
    checked(data, error);
    q = q.in("author_id", data?.map((p) => p.following_id) ?? []);
  }
  if (options.mode === "institution") {
    if (!v?.profile.institution) return [];
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq(
        "institution_key",
        v.profile.institution.trim().replace(/\s+/g, " ").toLowerCase(),
      )
      .limit(1000);
    checked(data, error);
    q = q.in("author_id", data?.map((p) => p.id) ?? []);
  }
  const { data, error } = await q;
  const posts = await withStats(checked(data, error) as unknown as PostRow[]);
  return options.popular ? popularPosts(posts) : posts;
}
async function withStats(posts: PostRow[]): Promise<Post[]> {
  if (!posts.length) return [];
  const client = (await db())!;
  const { data, error } = await client.rpc("post_stats", {
    ids: posts.map((p) => p.id),
  });
  const stats = checked(data, error) as Record<string, PostStats>;
  // Visibility/deletion may change between the row query and the aggregate RPC.
  return posts.flatMap((p) => (stats[p.id] ? [{ ...p, ...stats[p.id] }] : []));
}
export const getPost = cache(async (id: string) => {
  const client = await db();
  if (!client) return demoPosts.find((p) => p.id === id);
  const { data, error } = await client
    .from("posts")
    .select(POST_SELECT)
    .eq("id", id)
    .maybeSingle();
  const post = checked(data, error) as unknown as PostRow | null;
  return post ? (await withStats([post]))[0] : undefined;
});
export const getProfile = cache(async (username: string) => {
  const client = await db();
  if (!client) return demoProfiles.find((p) => p.username === username);
  const { data, error } = await client
    .from("profiles")
    .select(PUBLIC_PROFILE)
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return checked(data, error) as Profile | undefined;
});
export async function comments(id: string): Promise<Comment[]> {
  const client = await db();
  if (!client) return [];
  const { data, error } = await client
    .from("comments")
    .select(
      `id,post_id,author_id,body,created_at,profiles!comments_author_id_fkey(${PUBLIC_PROFILE})`,
    )
    .eq("post_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  return checked(data, error) as unknown as Comment[];
}
export async function people(query = ""): Promise<Profile[]> {
  const client = await db();
  if (!client)
    return demoProfiles.filter((p) =>
      [p.display_name, p.username, p.institution, ...p.hobbies]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  // Search uses public columns only. Escape filter metacharacters rather than interpolating raw PostgREST syntax.
  const search = query
    .replace(/[^\p{L}\p{M}\p{N}_ #]/gu, "")
    .slice(0, 60)
    .trim();
  let q = client
    .from("profiles")
    .select(PUBLIC_PROFILE)
    .eq("discoverable", true)
    .limit(20);
  if (search) {
    const hobby = search.replace(/^#/, "");
    q = q.or(
      `username.ilike.%${search}%,display_name.ilike.%${search}%,institution.ilike.%${search}%,hobbies.cs.{${hobby}}`,
    );
  }
  const { data, error } = await q;
  return checked(data, error) as Profile[];
}
export async function topics(): Promise<{ tag: string; count: number }[]> {
  const client = await db();
  if (client) {
    const { data, error } = await client.rpc("popular_topics");
    return checked(data, error);
  }
  const posts = await feed();
  const counts = new Map<string, number>();
  for (const p of posts) {
    const tags = new Set(
      [...p.body.matchAll(/(?:^|\s)#([\p{L}\p{M}\p{N}_]{1,40})/gu)]
        .map((m) => m[1].toLowerCase())
        .slice(0, 5),
    );
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}
export async function relationship(id: string) {
  return (await relationships([id])).has(id);
}
export async function relationships(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const v = await viewer();
  const client = await db();
  if (!v || !client) return new Set();
  const { data, error } = await client
    .from("follows")
    .select("following_id")
    .eq("follower_id", v.id)
    .in("following_id", [...new Set(ids)]);
  return new Set(checked(data, error)!.map((row) => row.following_id));
}
export async function followList(id: string, kind: "followers" | "following") {
  const client = await db();
  if (!client) return [];
  const column = kind === "followers" ? "following_id" : "follower_id";
  const other = kind === "followers" ? "follower_id" : "following_id";
  const { data, error } = await client
    .from("follows")
    .select(`profiles!follows_${other}_fkey(${PUBLIC_PROFILE})`)
    .eq(column, id)
    .limit(100);
  return (checked(data, error) as unknown as { profiles: Profile }[]).map(
    (p) => p.profiles,
  );
}
export async function privateSettings() {
  const v = await requireViewer(true);
  const client = (await db())!;
  const { data, error } = await client
    .from("account_private")
    .select("phone,institution,institution_visible,onboarding_complete")
    .eq("user_id", v.id)
    .single();
  return checked(data, error);
}
export async function onboardingComplete() {
  const v = await requireViewer();
  const client = (await db())!;
  const { data, error } = await client
    .from("account_private")
    .select("onboarding_complete")
    .eq("user_id", v.id)
    .single();
  return checked(data, error).onboarding_complete as boolean;
}
export async function safetyList(kind: "blocks" | "mutes") {
  await requireViewer();
  const client = (await db())!;
  const { data, error } = await client.rpc("safety_accounts", { kind });
  return checked(data, error) as Pick<
    Profile,
    "id" | "username" | "display_name" | "accent"
  >[];
}
export const unreadNotificationCount = cache(async () => {
  const v = await viewer();
  if (!v || v.suspended) return 0;
  const client = (await db())!;
  const { data, error } = await client
    .from("notifications")
    .select("id")
    .eq("recipient_id", v.id)
    .is("read_at", null)
    .limit(100);
  return checked(data, error).length;
});
export async function inbox(): Promise<Notification[]> {
  const v = await requireViewer();
  const client = (await db())!;
  const { data, error } = await client
    .from("notifications")
    .select(
      `id,kind,post_id,comment_id,read_at,created_at,profiles!notifications_actor_id_fkey(${PUBLIC_PROFILE})`,
    )
    .eq("recipient_id", v.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return checked(data, error) as unknown as Notification[];
}
export async function moderationQueue() {
  const v = await requireViewer();
  if (v.role === "user") redirect("/");
  const client = (await db())!;
  const { data, error } = await client.rpc("moderation_queue");
  return checked(data, error) as {
    reports: {
      id: string;
      target_type: string;
      target_id: string;
      reason: string;
      notes: string;
      content: string | null;
      created_at: string;
    }[];
    suspended: { id: string; username: string; display_name: string }[];
    audit: {
      id: string;
      action: string;
      target_type: string;
      target_id: string;
      note: string;
      created_at: string;
    }[];
  };
}

export async function adminAccounts(query = "") {
  const v = await requireViewer();
  if (v.role !== "admin") redirect("/");
  const client = (await db())!;
  const { data, error } = await client.rpc("admin_accounts", { query });
  return checked(data, error) as {
    id: string;
    username: string;
    display_name: string;
    role: string;
    suspended: boolean;
  }[];
}

export async function postStats(id: string): Promise<PostStats | null> {
  const client = await db();
  if (!client) return null;
  const { data, error } = await client.rpc("post_stats", { ids: [id] });
  return (checked(data, error) as Record<string, PostStats>)[id] ?? null;
}
export async function followCounts(id: string) {
  const client = await db();
  if (!client) return { followers: 0, following: 0 };
  const results = await Promise.all(
    ["following_id", "follower_id"].map((column) =>
      client
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq(column, id),
    ),
  );
  for (const result of results)
    if (result.error) throw new Error("Database request failed");
  return { followers: results[0].count ?? 0, following: results[1].count ?? 0 };
}

// Public render snapshots reset local state after authoritative RSC revalidation
// (particularly block/mute), without serializing a duplicate feed as a React key.
export function socialRevision(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}
