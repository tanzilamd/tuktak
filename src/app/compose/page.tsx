import { getPost, requireViewer } from "@/lib/data";
import { Composer } from "@/components/forms";
import { z } from "zod";
import { notFound } from "next/navigation";
export const metadata = { title: "বলে ফেলি", robots: { index: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string; quote?: string }>;
}) {
  const p = await searchParams;
  await requireViewer(
    false,
    p.quote ? `/compose?quote=${encodeURIComponent(p.quote)}` : "/compose",
  );
  const parsed = z.string().uuid().safeParse(p.quote);
  const source = p.quote
    ? parsed.success
      ? await getPost(parsed.data)
      : undefined
    : undefined;
  if (p.quote && (!source || (source.is_quote && !source.quote))) notFound();
  const quote = source
    ? source.is_quote
      ? source.quote!
      : {
          id: source.id,
          body: source.body,
          created_at: source.created_at,
          profiles: source.profiles,
          has_poll: !!source.poll,
        }
    : undefined;
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
        quote={quote}
        standalone
      />
      <p className="feed-end">কোনো ছবি না, কোনো চাপ না। শুধু কথা।</p>
    </>
  );
}
