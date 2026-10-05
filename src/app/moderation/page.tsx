import Link from "next/link";
import { staffConsole, requireStaff, type AuditEntry } from "@/lib/staff";
import { StaffAudit } from "@/components/staff-console";
import { bn } from "@/lib/config";
import { communityPublic } from "@/lib/community-data";
import { COMMUNITY_KINDS, COMMUNITY_LABELS } from "@/lib/community";
export const metadata = { title: "আড্ডা সামলাই", robots: { index: false } };
export default async function Page() {
  const [v, summary] = await Promise.all([
    requireStaff(),
    staffConsole<{ reports: number; suspended: number; audit: AuditEntry[] }>(
      "overview",
    ),
  ]);
  const count = (n: number) => `${bn(n)}${n >= 1000 ? "+" : ""}`;
  const community = v.role === "admin" ? await communityPublic() : null;
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
      {community && (
        <section className="card content-card">
          <h2>কনটেন্ট</h2>
          <p className="small muted">
            আজকের প্রশ্ন ·{" "}
            {community.question
              ? community.manualQuestion
                ? "নিজে বাছাই করা"
                : "স্বয়ংক্রিয় বাছাই"
              : "সক্রিয় প্রশ্ন নেই"}
          </p>
          <p className="small muted">
            ঘোষণা · {community.announcement ? "সক্রিয়" : "এখন কোনো ঘোষণা নেই"}
          </p>
          <nav className="staff-nav" aria-label="কনটেন্ট পরিচালনা">
            {COMMUNITY_KINDS.map((kind) => (
              <Link key={kind} href={`/moderation/content/${kind}`}>
                {COMMUNITY_LABELS[kind]}
              </Link>
            ))}
          </nav>
        </section>
      )}
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
