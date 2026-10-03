import Link from "next/link";
import { Onboarding } from "@/components/onboarding";
import { requireViewer } from "@/lib/data";
export const metadata = { title: "তোমার মতো করে", robots: { index: false } };
export default async function Page() {
  const v = await requireViewer();
  return (
    <section className="card content-card">
      <span className="eyebrow">স্বাগতম, নতুন আড্ডাবাজ 🌱</span>
      <h1>তোমার মতো করে।</h1>
      <p className="muted">
        নাম আর username তৈরি। মোবাইল নম্বরও ব্যক্তিগতভাবে রাখা আছে। বাকিটা
        পুরোপুরি ঐচ্ছিক—প্রতিষ্ঠান না থাকলেও আড্ডা জমবে।
      </p>
      <Onboarding profile={v.profile} />
      <Link href="/" className="skip-onboarding">
        এখন না, আড্ডায় যাই ↗
      </Link>
    </section>
  );
}
