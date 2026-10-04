import { notFound } from "next/navigation";
import { getProfile, followList, viewer, relationships } from "@/lib/data";
import { PersonCard } from "@/components/post-card";
import { Empty } from "@/components/empty";
export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const p = await getProfile((await params).username);
  if (!p) notFound();
  const [v, list] = await Promise.all([
    viewer(),
    followList(p.id, "followers"),
  ]);
  const following = await relationships(list.map((p) => p.id));
  return (
    <>
      <div className="page-top">
        <h1>যারা সাথে আছে</h1>
      </div>
      <div className="people-grid">
        {list.map((p) => (
          <PersonCard
            key={p.id}
            profile={p}
            viewer={v}
            following={following.has(p.id)}
          />
        ))}
      </div>
      {!list.length && <Empty text="আড্ডা থেকে পরিচয়, পরিচয় থেকে বন্ধুত্ব।" />}
    </>
  );
}
