import { publicMetadata } from "@/lib/metadata";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPost, viewer, comments, socialRevision } from "@/lib/data";
import { Discussion } from "@/components/discussion";
import { z } from "zod";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return { title: "পোস্ট পাওয়া যায়নি" };
  const p = await getPost(id);
  return p
    ? publicMetadata(
        `/post/${p.id}`,
        `${p.profiles.display_name}-এর কথা`,
        p.body || undefined,
      )
    : { title: "পোস্ট পাওয়া যায়নি", robots: { index: false } };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ comment?: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const p = await getPost(id);
  if (!p) notFound();
  const focus = z
    .string()
    .uuid()
    .safeParse((await searchParams).comment);
  const [v, replies] = await Promise.all([
    viewer(),
    comments(id, focus.success ? focus.data : undefined),
  ]);
  return (
    <>
      <div className="page-top">
        <div>
          <Link className="eyebrow" href="/">
            ← আড্ডায় ফিরে যাই
          </Link>
          <h1>কথায় কথায় 💬</h1>
        </div>
      </div>
      <Discussion
        key={socialRevision([p, v, replies])}
        post={p}
        viewer={v}
        initialReplies={replies}
      />
    </>
  );
}
