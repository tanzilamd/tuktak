import Link from "next/link";
import { mentionPattern } from "@/lib/engagement";
export function RichText({
  text,
  mentions = [],
}: {
  text: string;
  mentions?: string[];
}) {
  const validMentions = new Set(mentions);
  const mentionPositions = new Set(
    [
      ...text
        .replace(/https?:\/\/[^\s<>]+/gi, (url) => " ".repeat(url.length))
        .matchAll(mentionPattern()),
    ].map((m) => m.index + m[0].indexOf("@")),
  );
  const parts: { text: string; position: number }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(
    /https?:\/\/[^\s<>]+|#[\p{L}\p{M}\p{N}_]{1,40}|@[A-Za-z0-9_]{3,20}(?![A-Za-z0-9_])/gu,
  )) {
    const position = match.index;
    if (position > cursor)
      parts.push({ text: text.slice(cursor, position), position: cursor });
    parts.push({ text: match[0], position });
    cursor = position + match[0].length;
  }
  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), position: cursor });
  return (
    <>
      {parts.map(({ text: part, position }) => {
        if (
          part.startsWith("@") &&
          mentionPositions.has(position) &&
          validMentions.has(part.slice(1).toLowerCase())
        )
          return (
            <Link
              key={position}
              className="mention"
              href={`/u/${part.slice(1).toLowerCase()}`}
              prefetch={false}
            >
              {part}
            </Link>
          );
        if (/^https?:\/\//.test(part)) {
          try {
            const url = new URL(part);
            if (["https:", "http:"].includes(url.protocol))
              return (
                <a
                  key={position}
                  href={url.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                >
                  {part}
                </a>
              );
          } catch {
            /* Invalid URLs remain escaped text. */
          }
        }
        if (/^#[\p{L}\p{M}\p{N}_]+$/u.test(part))
          return (
            <Link
              key={position}
              href={`/tag/${encodeURIComponent(part.slice(1).toLowerCase())}`}
            >
              {part}
            </Link>
          );
        return <span key={position}>{part}</span>;
      })}
    </>
  );
}
