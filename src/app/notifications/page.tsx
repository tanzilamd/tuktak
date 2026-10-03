import Link from "next/link";
import { inbox } from "@/lib/data";
import { Mutation } from "@/components/forms";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { bn } from "@/lib/config";
export const metadata = { title: "খবর", robots: { index: false } };
export default async function Page() {
  const entries = await inbox();
  const groups = new Map<string, typeof entries>();
  for (const n of entries) {
    const key =
      n.kind === "reaction"
        ? `${n.kind}:${n.post_id}:${n.read_at ? "read" : "unread"}`
        : n.id;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  return (
    <>
      <div className="page-top">
        <h1>খবর 🔔</h1>
        <Mutation action="read" label="সব পড়া হয়েছে" />
      </div>
      {!entries.length ? (
        <Empty
          emoji="😌"
          title="এখনো কোনো খবর নাই।"
          text="শান্তির জীবন। আড্ডা জমলে খবরও আসবে।"
        />
      ) : (
        <div className="notification-list card">
          {[...groups].map(([key, items]) => {
            const n = items[0];
            return (
              <article
                key={key}
                className={`notification ${n.read_at ? "" : "unread"}`}
              >
                <Avatar profile={n.profiles} />
                <div>
                  <Link
                    href={
                      n.post_id
                        ? `/post/${n.post_id}`
                        : `/u/${n.profiles.username}`
                    }
                  >
                    <b>{n.profiles.display_name}</b>
                    {items.length > 1
                      ? ` এবং আরও ${bn(items.length - 1)} জন`
                      : ""}
                    {n.kind === "follow"
                      ? " তোমার সাথে আছে।"
                      : n.kind === "comment"
                        ? " তোমার কথায় উত্তর দিয়েছে।"
                        : " তোমার পোস্টে প্রতিক্রিয়া দিয়েছে।"}
                  </Link>
                  <small>
                    {new Intl.DateTimeFormat("bn-BD", {
                      dateStyle: "medium",
                      timeZone: "Asia/Dhaka",
                    }).format(new Date(n.created_at))}
                  </small>
                </div>
                {!n.read_at && (
                  <Mutation
                    action="read"
                    values={
                      items.length > 1
                        ? { ids: JSON.stringify(items.map((x) => x.id)) }
                        : { id: n.id }
                    }
                    label="পড়েছি ✓"
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
