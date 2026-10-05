import Link from "next/link";
import { requireStaff } from "@/lib/staff";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const v = await requireStaff();
  return (
    <>
      <nav className="staff-nav" aria-label="আড্ডা সামলাই">
        <Link href="/moderation">সারাংশ</Link>
        <Link href="/moderation/reports">রিপোর্ট</Link>
        <Link href="/moderation/suspended">স্থগিত</Link>
        <Link href="/moderation/audit">ইতিহাস</Link>
        {v.role === "admin" && <Link href="/moderation/team">দল পরিচালনা</Link>}
      </nav>
      {children}
    </>
  );
}
