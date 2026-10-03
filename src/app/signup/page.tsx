import Link from "next/link";
import { AuthForm } from "@/components/forms";
import { safeNext } from "@/lib/config";
export const metadata = {
  title: "আড্ডায় তোমাকে চাই।",
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
      <span className="auth-emoji">🌱</span>
      <h1>আড্ডায় তোমাকে চাই।</h1>
      <p className="muted">কিছু বলার থাকুক, না-ই থাকুক—এসো। 🌱</p>
      {p.error && (
        <p role="alert" className="danger">
          লিংকটি মেয়াদোত্তীর্ণ বা সঠিক নয়। আবার চেষ্টা করো।
        </p>
      )}
      {p.reset && <p role="status">Password বদলে গেছে। এবার লগইন করো।</p>}
      <AuthForm kind="signup" next={safeNext(p.next)} />
      <div className="auth-footer">
        <Link href="/login">লগইন পাতায় যাই ↗</Link>
      </div>
    </section>
  );
}
