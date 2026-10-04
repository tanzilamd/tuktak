import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeCommand } from "@/lib/commands";
import {
  comments,
  feed,
  followCounts,
  getPost,
  postStats,
  relationships,
} from "@/lib/data";
import type { SocialResult } from "@/lib/types";

const actions = new Set([
  "post",
  "react",
  "comment",
  "delete_comment",
  "delete_post",
  "follow",
]);
const failure = {
  ok: false,
  message: "কাজটা করা গেল না। অনুমতি ও তথ্য দেখে আবার চেষ্টা করো।",
};
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    if (params.has("follow")) {
      const id = z.string().uuid().safeParse(params.get("follow"));
      if (!id.success) return json(failure, 400);
      const [followed, counts] = await Promise.all([
        relationships([id.data]),
        followCounts(id.data),
      ]);
      return json({ ok: true, following: followed.has(id.data), counts });
    }
    if (params.has("id")) {
      const id = z.string().uuid().safeParse(params.get("id"));
      if (!id.success) return json(failure, 400);
      const [post, replies] = await Promise.all([
        getPost(id.data),
        comments(id.data),
      ]);
      return json({ ok: true, post, comments: replies });
    }
    const mode = z
      .enum(["all", "following", "institution"])
      .safeParse(params.get("feed") ?? "all");
    if (!mode.success) return json(failure, 400);
    const before = params.get("before") ?? undefined;
    if (before && before.length > 128) return json(failure, 400);
    return json({ ok: true, posts: await feed({ mode: mode.data, before }) });
  } catch {
    return json(failure, 503);
  }
}
function sameOrigin(request: NextRequest) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return (
      ["http:", "https:"].includes(origin.protocol) && origin.host === host
    );
  } catch {
    return false;
  }
}
export async function POST(request: NextRequest) {
  // Route handlers do not inherit Server Actions' Origin protection. Reject
  // cross-origin/opaque requests before touching the caller-session RPC.
  if (
    !sameOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return json(failure, 403);
  let committed = false;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json(failure, 400);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 4096) {
        await reader.cancel();
        return json(failure, 413);
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    const payload = z
      .record(z.string(), z.union([z.string(), z.boolean()]))
      .safeParse(JSON.parse(text));
    if (!payload.success || !actions.has(String(payload.data.action)))
      return json(failure, 400);
    const form = new FormData();
    for (const [key, value] of Object.entries(payload.data))
      form.set(key, String(value));
    const result: SocialResult = await executeCommand(form);
    if (!result.ok) return json(result);
    committed = true;
    const action = String(form.get("action"));
    const id = String(form.get("id"));
    if (action === "post") result.post = await getPost(result.id!);
    if (action === "react") result.stats = await postStats(id);
    if (action === "comment" || action === "delete_comment") {
      const postId = action === "comment" ? id : String(form.get("post_id"));
      if (!z.string().uuid().safeParse(postId).success)
        return json({ ...result, uncertain: true });
      [result.comments, result.stats] = await Promise.all([
        comments(postId),
        postStats(postId),
      ]);
    }
    if (action === "follow") {
      const [followed, counts] = await Promise.all([
        relationships([id]),
        followCounts(id),
      ]);
      result.following = followed.has(id);
      result.counts = counts;
    }
    return json(result);
  } catch {
    // A lost/read-failed response may follow a committed command. Never replay
    // toggles or inserts automatically; roll back locally and re-read instead.
    return json({ ...failure, uncertain: committed }, 503);
  }
}
