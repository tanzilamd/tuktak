import { Support } from "@/components/support";
import Link from "next/link";
import { requireViewer } from "@/lib/data";
import { redirect } from "next/navigation";
export const metadata = {
  title: "অ্যাকাউন্ট স্থগিত",
  robots: { index: false },
};
export default async function Page() {
  const v = await requireViewer(true);
  if (!v.suspended) redirect("/");
  return (
    <section className="card content-card">
      <span className="auth-emoji">🛡️</span>
      <h1>আপাতত একটু বিরতি।</h1>
      <p>
        নিরাপত্তা দলের সিদ্ধান্তে তোমার অ্যাকাউন্ট স্থগিত আছে। প্রকাশ বা
        প্রতিক্রিয়া দেওয়া যাবে না।
      </p>
      <p>অ্যাকাউন্টের তথ্য দেখা, লগআউট বা অ্যাকাউন্ট মুছে ফেলা যাবে।</p>
      <Support />
      <Link className="button" href="/settings">
        সেটিংসে যাই
      </Link>
    </section>
  );
}
