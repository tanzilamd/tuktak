import type { Profile } from "./types";
import { bn } from "./config";
export type Notification = {
  id: string;
  kind: string;
  post_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
  profiles: Pick<
    Profile,
    "id" | "username" | "display_name" | "accent" | "status"
  >;
};
export function notificationGroups(
  entries: Notification[],
  entryUnreadIds?: Set<string>,
) {
  const groups = new Map<string, Notification[]>();
  for (const n of entries) {
    const key =
      n.kind === "reaction"
        ? `${n.kind}:${n.post_id}:${n.read_at ? "read" : "unread"}:${entryUnreadIds?.has(n.id) ? "new" : "old"}`
        : n.id;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  return [...groups.values()];
}
export function notificationHref(n: Notification) {
  return n.post_id
    ? `/post/${n.post_id}${n.comment_id ? `?comment=${n.comment_id}#comment-${n.comment_id}` : ""}`
    : `/u/${n.profiles.username}`;
}
export function unreadLabel(count: number) {
  return count > 99 ? "৯৯+" : bn(count);
}
export function notificationLabel(count: number) {
  return count ? `খবর, ${unreadLabel(count)}টি অপঠিত` : "খবর";
}
