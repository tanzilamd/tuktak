import Link from "next/link";
import { staffConsole, type StaffFilters, type StaffReport } from "@/lib/staff";
import { StaffSearch, StaffNext } from "@/components/staff-console";
import { Mutation } from "@/components/forms";
import { Timestamp } from "@/components/timestamp";
export const metadata = { title: "রিপোর্ট", robots: { index: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<StaffFilters>;
}) {
  const filters = await searchParams;
  const result = await staffConsole<{
    rows: StaffReport[];
    next: string | null;
  }>("reports", filters);
  return (
    <>
      <div className="page-top">
        <h1>রিপোর্ট</h1>
      </div>
      <StaffSearch filters={filters} reports />
      <h2 className="sr-only">রিপোর্ট তালিকা</h2>
      {result.rows.map((r) => (
        <article className="card content-card" key={r.id}>
          <span className="eyebrow">
            {r.target_type === "post"
              ? "পোস্ট"
              : r.target_type === "comment"
                ? "মন্তব্য / উত্তর"
                : "অ্যাকাউন্ট"}{" "}
            · {r.reason}
          </span>
          {r.author_username && (
            <p className="small">
              <Link href={`/u/${r.author_username}`} prefetch={false}>
                {r.author_name} @{r.author_username}
              </Link>
            </p>
          )}
          <blockquote>{r.content || "কনটেন্টটি আর নেই।"}</blockquote>
          {r.notes && <p>{r.notes}</p>}
          <p className="small muted">
            <Timestamp value={r.created_at} /> ·{" "}
            {r.status === "open"
              ? "অপেক্ষায়"
              : r.status === "dismissed"
                ? "বন্ধ"
                : "সিদ্ধান্ত হয়েছে"}
          </p>
          {r.status === "open" && (
            <div className="moderation-controls">
              {[
                "dismiss",
                ...(r.target_type === "user" ? [] : ["hide", "remove"]),
                ...(r.author_id ? ["suspend"] : []),
              ].map((decision) => (
                <Mutation
                  key={decision}
                  action="moderate"
                  values={{ id: r.id, decision, note: "" }}
                  label={
                    decision === "dismiss"
                      ? "বন্ধ করি"
                      : decision === "hide"
                        ? "লুকাই"
                        : decision === "remove"
                          ? "মুছে দিই"
                          : "স্থগিত করি"
                  }
                  confirm={
                    decision === "dismiss"
                      ? undefined
                      : "এই সিদ্ধান্ত প্রয়োগ করবে?"
                  }
                />
              ))}
            </div>
          )}
        </article>
      ))}
      {!result.rows.length && (
        <p className="card content-card muted">এই খোঁজে কোনো রিপোর্ট নেই।</p>
      )}
      <StaffNext next={result.next} filters={filters} />
    </>
  );
}
