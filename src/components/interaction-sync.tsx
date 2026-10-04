"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SocialResult } from "@/lib/types";
/** Refresh only when navigation raced an outstanding write. Ordinary social
 * actions and local feed tab changes never refresh the RSC tree. */
export function InteractionSync() {
  const pathname = usePathname();
  const router = useRouter();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  const pendingRef = useRef(new Map<string, string>());
  const refreshRef = useRef(false);
  useEffect(() => {
    function changed(event: Event) {
      const { phase, id, result } = (
        event as CustomEvent<{
          phase: string;
          id: string;
          result?: SocialResult;
        }>
      ).detail;
      if (phase === "start") pendingRef.current.set(id, pathRef.current);
      else {
        const start = pendingRef.current.get(id);
        pendingRef.current.delete(id);
        if (
          start &&
          start !== pathRef.current &&
          (result?.ok || result?.uncertain)
        )
          refreshRef.current = true;
        if (!pendingRef.current.size && refreshRef.current) {
          refreshRef.current = false;
          router.refresh();
        }
      }
    }
    window.addEventListener("tuktak:social-change", changed);
    return () => window.removeEventListener("tuktak:social-change", changed);
  }, [router]);
  return null;
}
