import Link from "next/link";
import { AuthForm } from "@/components/forms";
import { safeNext } from "@/lib/config";
export const metadata = {
  title: "আবার দেখা হলো!",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const p = await searchParams;
  return (
    <section className="auth-card card">
      <span className="auth-emoji">☕</span>
      <h1>আবার দেখা হলো!</h1>
      <p className="muted">চেনা আড্ডায় ফিরে এসো। ☕</p>
      {p.error && (
        <p role="alert" className="danger">
          লিংকটি মেয়াদোত্তীর্ণ বা সঠিক নয়। আবার চেষ্টা করো।
        </p>
      )}
      {p.reset && <p role="status">Password বদলে গেছে। এবার লগইন করো।</p>}
      <AuthForm kind="login" next={safeNext(p.next)} />
      <div className="auth-footer">
        <Link href="/forgot-password">Password ভুলে গেছি</Link>
        <span>
          নতুন এখানে? <Link href="/signup">যোগ দিই ↗</Link>
        </span>
      </div>
    </section>
  );
}
