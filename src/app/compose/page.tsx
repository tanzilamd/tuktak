import { requireViewer } from "@/lib/data";
import { Composer } from "@/components/forms";
export const metadata = { title: "বলে ফেলি", robots: { index: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  await requireViewer();
  const p = await searchParams;
  return (
    <>
      <div className="page-top">
        <div>
          <span className="eyebrow">২৪০ অক্ষরের একটু তুমি</span>
          <h1>বলে ফেলি ✍️</h1>
        </div>
      </div>
      <Composer
        prompt={Array.from(p.prompt ?? "")
          .slice(0, 240)
          .join("")}
        standalone
      />
      <p className="feed-end">কোনো ছবি না, কোনো চাপ না। শুধু কথা।</p>
    </>
  );
}
