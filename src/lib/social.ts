import type { PostStats, SocialResult } from "./types";
export const SOCIAL_ERROR =
  "কাজটা করা গেল না। অনুমতি ও তথ্য দেখে আবার চেষ্টা করো।";
export function toggleReaction(stats: PostStats, kind: string): PostStats {
  const counts = { ...stats.reaction_counts };
  if (stats.current_reaction)
    counts[stats.current_reaction] = Math.max(
      0,
      (counts[stats.current_reaction] ?? 0) - 1,
    );
  const current = stats.current_reaction === kind ? null : kind;
  if (current) counts[current] = (counts[current] ?? 0) + 1;
  return { ...stats, reaction_counts: counts, current_reaction: current };
}
export async function requestSocial(form: FormData): Promise<SocialResult> {
  try {
    const response = await fetch("/api/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        Object.fromEntries(
          [...form].filter(([key]) => !key.startsWith("$ACTION_")),
        ),
      ),
      cache: "no-store",
      keepalive: true,
    });
    const result = await response.json();
    if (typeof result.ok !== "boolean" || typeof result.message !== "string")
      throw new Error("Invalid response");
    return result;
  } catch {
    return { ok: false, message: SOCIAL_ERROR, uncertain: true };
  }
}
export function socialChanged(
  phase: "start" | "settled",
  result?: SocialResult,
  id?: string,
) {
  window.dispatchEvent(
    new CustomEvent("tuktak:social-change", { detail: { phase, result, id } }),
  );
}

export async function readSocial(
  query: Record<string, string>,
): Promise<SocialResult> {
  try {
    const response = await fetch(`/api/social?${new URLSearchParams(query)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    return { ...result, message: result.message ?? "" };
  } catch {
    return { ok: false, message: SOCIAL_ERROR };
  }
}
