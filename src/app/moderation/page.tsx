import Link from "next/link";
import { staffConsole, requireStaff, type AuditEntry } from "@/lib/staff";
import { StaffAudit } from "@/components/staff-console";
import { bn } from "@/lib/config";
export const metadata = { title: "আড্ডা সামলাই", robots: { index: false } };
export default async function Page() {
  const [v, summary] = await Promise.all([
    requireStaff(),
    staffConsole<{ reports: number; suspended: number; audit: AuditEntry[] }>(
      "overview",
    ),
  ]);
  const count = (n: number) => `${bn(n)}${n >= 1000 ? "+" : ""}`;
  return (
    <>
      <div className="page-top">
        <h1>আড্ডা সামলাই 🛡️</h1>
      </div>
      <section className="card content-card">
        <h2>মডারেশন</h2>
        <div className="staff-overview">
          <Link href="/moderation/reports">
            <span>অপেক্ষায় রিপোর্ট</span>
            <strong>{count(summary.reports)}</strong>
          </Link>
          <Link href="/moderation/suspended">
            <span>স্থগিত অ্যাকাউন্ট</span>
            <strong>{count(summary.suspended)}</strong>
          </Link>
        </div>
        {!summary.reports && (
          <p className="small muted">🛡 সব শান্ত — নতুন কোনো রিপোর্ট নেই</p>
        )}
      </section>
      <section className="card content-card">
        <h2>সাম্প্রতিক সিদ্ধান্ত</h2>
        <StaffAudit entries={summary.audit} />
        <Link className="settings-link" href="/moderation/audit">
          সব ইতিহাস →
        </Link>
      </section>
      {v.role === "admin" && (
        <section className="card content-card">
          <h2>অ্যাডমিন</h2>
          <Link className="settings-link" href="/moderation/team">
            দল পরিচালনা →
          </Link>
        </section>
      )}
    </>
  );
}
