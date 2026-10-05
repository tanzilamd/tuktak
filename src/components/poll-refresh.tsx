"use client";
import { useEffect } from "react";
import { readSocial } from "@/lib/social";

/** One-shot expiry reads, coalesced for mounted cards. No polling or data cache. */
export function PollRefresh() {
  useEffect(() => {
    const ids = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    async function flush() {
      timer = undefined;
      const batch = [...ids].slice(0, 20);
      for (const id of batch) ids.delete(id);
      const result = await readSocial({ stats: batch.join(",") });
      if (active && result.ok && result.batchStats)
        window.dispatchEvent(
          new CustomEvent("tuktak:poll-fresh", { detail: result.batchStats }),
        );
      if (active && ids.size) timer = setTimeout(() => void flush(), 100);
    }
    function expired(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return;
      ids.add(id);
      timer ??= setTimeout(() => void flush(), 100);
    }
    window.addEventListener("tuktak:poll-expired", expired);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("tuktak:poll-expired", expired);
    };
  }, []);
  return null;
}
