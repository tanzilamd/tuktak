import "server-only";
import { cache } from "react";
import { db } from "./supabase";
import { MOODS, questionOfDay } from "./config";
import type {
  CommunityKind,
  CommunitySnapshot,
  CommunityEntry,
} from "./community";
export const communityPublic = cache(async (): Promise<CommunitySnapshot> => {
  const client = await db();
  if (!client)
    return {
      question: questionOfDay(),
      prompt: "আজকের আজাইরা ভাবনা কী?",
      moods: [...MOODS],
      topics: [],
      announcement: null,
      manualQuestion: false,
    };
  const { data, error } = await client.rpc("community_public");
  if (error) throw new Error("Database request failed");
  return data as CommunitySnapshot;
});
export async function communityList(
  kind: CommunityKind,
  filters: { q?: string; status?: string; cursor?: string } = {},
) {
  const clean = {
    q: typeof filters.q === "string" ? filters.q.slice(0, 60) : "",
    status: ["active", "inactive"].includes(filters.status ?? "")
      ? filters.status
      : "all",
    ...(typeof filters.cursor === "string" &&
    /^\d{1,4}\|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      filters.cursor,
    )
      ? { cursor: filters.cursor }
      : {}),
  };
  const client = (await db())!;
  const { data, error } = await client.rpc("community_list", {
    kind,
    filters: clean,
  });
  if (error) throw new Error("Database request failed");
  return data as {
    rows: CommunityEntry[];
    next: string | null;
    override: string;
  };
}
