import { relativeTime, exactTime } from "@/lib/time";
export function Timestamp({ value }: { value: string }) {
  return (
    <time dateTime={value} title={exactTime(value)} suppressHydrationWarning>
      {relativeTime(value)}
    </time>
  );
}
