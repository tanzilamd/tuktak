import { staffConsole, type StaffFilters, type AuditEntry } from "@/lib/staff";
import { StaffSearch, StaffNext, StaffAudit } from "@/components/staff-console";
export const metadata = {
  title: "সিদ্ধান্তের ইতিহাস",
  robots: { index: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<StaffFilters>;
}) {
  const filters = await searchParams;
  const result = await staffConsole<{
    rows: AuditEntry[];
    next: string | null;
  }>("audit", filters);
  return (
    <section className="card content-card">
      <h1>সিদ্ধান্তের ইতিহাস</h1>
      <StaffSearch filters={filters} />
      <h2 className="sr-only">সিদ্ধান্তের তালিকা</h2>
      <StaffAudit entries={result.rows} />
      <StaffNext next={result.next} filters={filters} />
    </section>
  );
}
