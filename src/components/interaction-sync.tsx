"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SocialResult } from "@/lib/types";
/** Ordinary social actions/tabs never refresh the RSC tree. Refresh only when
 * navigation raced a write, or history restores a snapshot predating a write. */
export function InteractionSync() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  // The home feed owns its tab/cursor cache. Elsewhere include public search/
  // cursor changes; never retain auth callback/recovery parameters here.
  const route =
    pathname === "/"
      ? "/"
      : `${pathname}|${params.get("q") ?? ""}|${params.get("before") ?? ""}`;
  const routeRef = useRef(route);
  const pendingRef = useRef(new Map<string, string>());
  const refreshRef = useRef(false);
  const epochRef = useRef(0);
  const snapshotsRef = useRef(new Map<string, number>());
  const historyRef = useRef(false);
  const restoredRef = useRef({ route, stale: false });
  useEffect(() => {
    const stale =
      epochRef.current > 0 &&
      snapshotsRef.current.get(route) !== epochRef.current;
    // Next can flush the restored route before our popstate handler. Retain
    // its previous version until that handler identifies a history traversal.
    restoredRef.current = { route, stale };
    const staleHistory = historyRef.current && stale;
    historyRef.current = false;
    routeRef.current = route;
    snapshotsRef.current.set(route, epochRef.current);
    if (snapshotsRef.current.size > 32)
      snapshotsRef.current.delete(snapshotsRef.current.keys().next().value!);
    if (staleHistory) {
      restoredRef.current.stale = false;
      router.refresh();
    }
  }, [route, router]);
  useEffect(() => {
    function history() {
      const target = new URL(window.location.href);
      const destination =
        target.pathname === "/"
          ? "/"
          : `${target.pathname}|${target.searchParams.get("q") ?? ""}|${target.searchParams.get("before") ?? ""}`;
      if (destination === routeRef.current) {
        if (
          restoredRef.current.route === destination &&
          restoredRef.current.stale
        ) {
          restoredRef.current.stale = false;
          router.refresh();
        }
      } else historyRef.current = true;
    }
    function changed(event: Event) {
      const { phase, id, result } = (
        event as CustomEvent<{
          phase: string;
          id: string;
          result?: SocialResult;
        }>
      ).detail;
      if (phase === "start") pendingRef.current.set(id, routeRef.current);
      else {
        const start = pendingRef.current.get(id);
        pendingRef.current.delete(id);
        if (result?.ok || result?.uncertain) {
          epochRef.current++;
          // Current local controls have reconciled; earlier history snapshots
          // still contain pre-mutation props and must be re-read on return.
          snapshotsRef.current.set(routeRef.current, epochRef.current);
          restoredRef.current.stale = false;
          if (start && start !== routeRef.current) refreshRef.current = true;
        }
        if (!pendingRef.current.size && refreshRef.current) {
          refreshRef.current = false;
          router.refresh();
        }
      }
    }
    // Prefer capture; the retained version also covers Next restoring the
    // cached route before this listener runs.
    window.addEventListener("popstate", history, { capture: true });
    window.addEventListener("tuktak:social-change", changed);
    return () => {
      window.removeEventListener("popstate", history, { capture: true });
      window.removeEventListener("tuktak:social-change", changed);
    };
  }, [router]);
  return null;
}
