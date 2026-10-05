import Link from "next/link";
import {
  staffConsole,
  requireStaff,
  type StaffFilters,
  type SuspendedAccount,
} from "@/lib/staff";
import { StaffSearch, StaffNext } from "@/components/staff-console";
import { Mutation } from "@/components/forms";
export const metadata = {
  title: "স্থগিত অ্যাকাউন্ট",
  robots: { index: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<StaffFilters>;
}) {
  const filters = await searchParams;
  const [v, result] = await Promise.all([
    requireStaff(),
    staffConsole<{ rows: SuspendedAccount[]; next: string | null }>(
      "suspended",
      filters,
    ),
  ]);
  return (
    <section className="card content-card">
      <h1>স্থগিত অ্যাকাউন্ট</h1>
      <p className="small muted">ফিরিয়ে না আনা পর্যন্ত স্থগিত থাকবে।</p>
      <StaffSearch filters={filters} types={false} />
      <h2 className="sr-only">স্থগিত অ্যাকাউন্টের তালিকা</h2>
      {result.rows.map((p) => (
        <div className="safety-row" key={p.id}>
          <span>
            {p.display_name}
            <small>@{p.username} · স্থগিত</small>
            <Link href={`/moderation/audit?q=${encodeURIComponent(p.id)}`}>
              সিদ্ধান্তের ইতিহাস →
            </Link>
          </span>
          {(v.role === "admin" || p.role === "user") && (
            <Mutation
              action="unsuspend"
              values={{ id: p.id }}
              label="ফিরিয়ে আনি"
              confirm="এই অ্যাকাউন্ট ফিরিয়ে আনবে?"
            />
          )}
        </div>
      ))}
      {!result.rows.length && <p className="muted">এই খোঁজে কেউ নেই।</p>}
      <StaffNext next={result.next} filters={filters} />
    </section>
  );
}
