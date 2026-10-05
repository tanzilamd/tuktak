import Link from "next/link";
import { topics } from "@/lib/data";
export async function MobileTopics() {
  const tags = await topics();
  if (!tags.length) return null;
  return (
    <section className="mobile-topics" aria-labelledby="mobile-topics-heading">
      <h2 id="mobile-topics-heading">আলোচনায়</h2>
      <div className="topic-strip">
        {tags.map(({ tag }) => (
          <Link
            key={tag}
            href={`/tag/${encodeURIComponent(tag)}`}
            prefetch={false}
          >
            #{tag}
          </Link>
        ))}
      </div>
    </section>
  );
}
