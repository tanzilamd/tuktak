import { notFound } from "next/navigation";
import { feed, viewer } from "@/lib/data";
import { PostCard } from "@/components/post-card";
import { Empty } from "@/components/empty";
function decodeTag(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  return {
    title: `#${decodeTag(tag).slice(0, 40)}`,
    description: "একই বিষয়ে ছোট ছোট কথা।",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const tag = decodeTag((await params).tag);
  if (!/^[\p{L}\p{M}\p{N}_]{1,40}$/u.test(tag)) notFound();
  const [posts, v] = await Promise.all([feed({ tag }), viewer()]);
  return (
    <>
      <div className="page-top">
        <div>
          <span className="eyebrow">একটা বিষয়, অনেক গল্প</span>
          <h1>#{tag}</h1>
        </div>
      </div>
      <div className="post-list">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} viewer={v} />
        ))}
        {!posts.length && <Empty />}
      </div>
    </>
  );
}
