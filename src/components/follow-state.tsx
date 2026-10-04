"use client";
import { createContext, use, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { bn } from "@/lib/config";
import type { FollowCounts as Counts, SocialResult } from "@/lib/types";
const FollowContext = createContext<{
  id: string;
  counts: Counts;
  start: (enabled: boolean) => void;
  settle: (result: SocialResult) => void;
} | null>(null);
export function FollowScope({
  id,
  initial,
  children,
}: {
  id: string;
  initial: Counts;
  children: ReactNode;
}) {
  const [counts, setCounts] = useState(initial);
  const previousRef = useRef(initial);
  return (
    <FollowContext
      value={{
        id,
        counts,
        start(enabled) {
          previousRef.current = counts;
          setCounts({
            ...counts,
            followers: Math.max(0, counts.followers + (enabled ? 1 : -1)),
          });
        },
        settle(result) {
          setCounts(
            result.ok && result.counts ? result.counts : previousRef.current,
          );
        },
      }}
    >
      {children}
    </FollowContext>
  );
}
export function useFollowScope() {
  return use(FollowContext);
}
export function FollowCounts({ username }: { username: string }) {
  const scope = useFollowScope()!;
  return (
    <div className="profile-links">
      <Link href={`/u/${username}/followers`}>
        <b>{bn(scope.counts.followers)}</b> জন সাথে আছে
      </Link>
      <Link href={`/u/${username}/following`}>
        <b>{bn(scope.counts.following)}</b> জনের সাথে আছি
      </Link>
    </div>
  );
}
