import "server-only";
import { redirect } from "next/navigation";
import { requireViewer } from "./data";
import { db } from "./supabase";

export type StaffFilters = {
  q?: string;
  status?: string;
  kind?: string;
  order?: string;
  cursor?: string;
};
export type AuditEntry = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  note: string;
  created_at: string;
  actor_username: string | null;
  actor_name: string | null;
};
export type StaffReport = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  notes: string;
  status: string;
  content: string | null;
  author_id: string | null;
  author_username: string | null;
  author_name: string | null;
  created_at: string;
};
export type SuspendedAccount = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
};
export async function requireStaff(adminOnly = false) {
  const v = await requireViewer();
  if (v.role === "user" || (adminOnly && v.role !== "admin")) redirect("/");
  return v;
}
export async function staffConsole<T>(
  section: string,
  filters: StaffFilters = {},
) {
  await requireStaff();
  const clean: StaffFilters = {
    q: typeof filters.q === "string" ? filters.q.slice(0, 60) : "",
    status: ["open", "resolved", "dismissed", "all"].includes(
      filters.status ?? "",
    )
      ? filters.status
      : "open",
    kind: ["post", "comment", "user"].includes(filters.kind ?? "")
      ? filters.kind
      : "",
    order: filters.order === "oldest" ? "oldest" : "newest",
  };
  if (typeof filters.cursor === "string") {
    const [time, id] = filters.cursor.split("|");
    if (
      Number.isFinite(Date.parse(time)) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id ?? "",
      )
    )
      clean.cursor = `${new Date(time).toISOString()}|${id}`;
  }
  const client = (await db())!;
  const { data, error } = await client.rpc("staff_console", {
    section,
    filters: clean,
  });
  if (error) throw new Error("Database request failed");
  return data as T;
}
