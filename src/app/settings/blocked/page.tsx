import { safetyList } from "@/lib/data";
import { Mutation } from "@/components/forms";
import { Empty } from "@/components/empty";
export const metadata = {
  title: "ব্লক করা অ্যাকাউন্ট",
  robots: { index: false },
};
export default async function Page() {
  const list = await safetyList("blocks");
  return (
    <>
      <div className="page-top">
        <h1>ব্লক করা অ্যাকাউন্ট</h1>
      </div>
      {list.length ? (
        <div className="card content-card">
          {list.map((p) => (
            <div className="safety-row" key={p.id}>
              <span>
                {p.display_name}
                <small>@{p.username}</small>
              </span>
              <Mutation
                action="block"
                values={{ id: p.id, enabled: false }}
                label="আবার দেখতে চাই"
              />
            </div>
          ))}
        </div>
      ) : (
        <Empty emoji="🍃" title="এখানে কেউ নেই।" text="শান্তির আড্ডা চলুক।" />
      )}
    </>
  );
}
