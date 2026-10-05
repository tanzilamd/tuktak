import Link from "next/link";
import type { QuotePreview } from "@/lib/types";

export function QuoteCard({
  quote,
}: {
  quote: QuotePreview | null | undefined;
}) {
  return (
    <div className="quote-preview">
      {quote ? (
        <>
          <Link
            href={`/u/${quote.profiles.username}`}
            className="small"
            prefetch={false}
          >
            <b>{quote.profiles.display_name}</b>{" "}
            <span className="muted">@{quote.profiles.username}</span>
          </Link>
          <Link
            href={`/post/${quote.id}`}
            className="quote-body"
            prefetch={false}
          >
            {quote.body}
          </Link>
          {quote.has_poll && (
            <Link
              href={`/post/${quote.id}`}
              className="small muted"
              prefetch={false}
            >
              পোল · মূল পোস্টে দেখি →
            </Link>
          )}
        </>
      ) : (
        <p className="muted small">মূল পোস্টটি এখন দেখা যাচ্ছে না।</p>
      )}
    </div>
  );
}
