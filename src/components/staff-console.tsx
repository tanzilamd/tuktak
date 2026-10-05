import Link from "next/link";
import { Timestamp } from "./timestamp";
import type { AuditEntry, StaffFilters } from "@/lib/staff";

export const STAFF_ACTIONS: Record<string, string> = {
  dismiss: "বন্ধ করা",
  hide: "লুকানো",
  remove: "মুছে দেওয়া",
  suspend: "স্থগিত করা",
  unsuspend: "ফিরিয়ে আনা",
  role: "দায়িত্ব বদল",
  bootstrap_admin: "অ্যাডমিন দায়িত্ব",
};
export function StaffSearch({
  filters,
  reports = false,
  types = true,
}: {
  filters: StaffFilters;
  reports?: boolean;
  types?: boolean;
}) {
  return (
    <form className="staff-filters">
      <label className="field">
        <span>খুঁজি</span>
        <input
          name="q"
          maxLength={60}
          defaultValue={filters.q}
          placeholder="নাম, username বা লেখা"
        />
      </label>
      {reports && (
        <label className="field">
          <span>অবস্থা</span>
          <select name="status" defaultValue={filters.status ?? "open"}>
            <option value="open">অপেক্ষায়</option>
            <option value="resolved">সিদ্ধান্ত হয়েছে</option>
            <option value="dismissed">বন্ধ</option>
            <option value="all">সব</option>
          </select>
        </label>
      )}
      {types && (
        <label className="field">
          <span>ধরন</span>
          <select name="kind" defaultValue={filters.kind ?? ""}>
            <option value="">সব</option>
            <option value="post">পোস্ট</option>
            <option value="comment">মন্তব্য / উত্তর</option>
            <option value="user">অ্যাকাউন্ট</option>
          </select>
        </label>
      )}
      <label className="field">
        <span>ক্রম</span>
        <select name="order" defaultValue={filters.order ?? "newest"}>
          <option value="newest">নতুন আগে</option>
          <option value="oldest">পুরোনো আগে</option>
        </select>
      </label>
      <button className="button button-small">দেখি</button>
    </form>
  );
}
export function StaffNext({
  next,
  filters,
}: {
  next: string | null;
  filters: StaffFilters;
}) {
  if (!next) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (typeof value === "string" && key !== "cursor") params.set(key, value);
  params.set("cursor", next);
  return (
    <Link
      className="button button-small"
      href={`?${params.toString()}`}
      prefetch={false}
    >
      পরেরগুলো →
    </Link>
  );
}
export function StaffAudit({ entries }: { entries: AuditEntry[] }) {
  return (
    <>
      {entries.map((a) => (
        <div className="audit-row" key={a.id}>
          <span>
            {STAFF_ACTIONS[a.action] ?? a.action} · {a.target_type}
          </span>
          <span>
            {a.actor_name ? (
              <>
                {a.actor_name} <small>@{a.actor_username}</small>
              </>
            ) : (
              "পুরোনো অ্যাকাউন্ট"
            )}
          </span>
          <small className="staff-target">লক্ষ্য: {a.target_id}</small>
          {a.note && <span>{a.note}</span>}
          <Timestamp value={a.created_at} />
        </div>
      ))}
      {!entries.length && <p className="muted">এখনও কোনো সিদ্ধান্ত নেই।</p>}
    </>
  );
}
