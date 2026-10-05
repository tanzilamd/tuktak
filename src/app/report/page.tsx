import { notFound } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/data";
import { ReportForm } from "@/components/forms";
export const metadata = { title: "রিপোর্ট করি", robots: { index: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; type?: string }>;
}) {
  await requireViewer();
  const p = await searchParams;
  if (
    !z.string().uuid().safeParse(p.id).success ||
    !["post", "comment", "user"].includes(p.type ?? "")
  )
    notFound();
  return (
    <section className="card content-card">
      <span className="eyebrow">সবার আড্ডা নিরাপদ থাকুক</span>
      <h1>কিছু ঠিক লাগছে না?</h1>
      <p className="muted">
        রিপোর্টটা moderation দলের কাছে যাবে। জরুরি সাহায্যের বিকল্প নয়।
      </p>
      <ReportForm id={p.id!} type={p.type!} />
    </section>
  );
}
