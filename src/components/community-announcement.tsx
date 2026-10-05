"use client";
import { useEffect, useId, useState } from "react";
import type { Announcement } from "@/lib/community";
const storageKey = "tuktak-announcement-dismissals";
function previousDismissals(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter((v) => typeof v === "string").slice(-20)
      : [];
  } catch {
    return [];
  }
}
export function CommunityAnnouncement({
  announcement: a,
}: {
  announcement: Announcement;
}) {
  const titleId = useId();
  const revision = `${a.id}:${a.updated_at}`;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const check = () =>
      setHidden(
        (current) =>
          current ||
          (a.dismissible && previousDismissals().includes(revision)) ||
          (!!a.ends_at && Date.parse(a.ends_at) <= Date.now()),
      );
    const frame = requestAnimationFrame(check);
    // Expiry is local presentation only: no polling, refresh or write replay.
    const remaining = a.ends_at ? Date.parse(a.ends_at) - Date.now() : Infinity;
    const timer =
      Number.isFinite(remaining) && remaining <= 2147483647
        ? window.setTimeout(check, Math.max(0, remaining))
        : undefined;
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [a.dismissible, a.ends_at, revision]);
  if (hidden) return null;
  return (
    <section
      className={`card community-announcement announcement-priority-${a.priority}`}
      aria-labelledby={titleId}
    >
      <div>
        <h2 id={titleId}>
          {a.title && a.priority > 1 && (
            <>{a.priority === 3 ? "জরুরি" : "গুরুত্বপূর্ণ"} · </>
          )}
          {a.title ||
            (a.priority === 3
              ? "জরুরি ঘোষণা"
              : a.priority === 2
                ? "গুরুত্বপূর্ণ ঘোষণা"
                : "ঘোষণা")}
        </h2>
        <p>{a.body}</p>
        {a.link && (
          <a
            className="small"
            href={a.link}
            {...(a.link.startsWith("https://")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            আরও দেখি →
          </a>
        )}
      </div>
      {a.dismissible && (
        <button
          type="button"
          className="button button-small button-quiet"
          aria-label="ঘোষণা সরিয়ে রাখি"
          onClick={() => {
            try {
              localStorage.setItem(
                storageKey,
                JSON.stringify(
                  [
                    ...previousDismissals().filter(
                      (v) => !v.startsWith(`${a.id}:`),
                    ),
                    revision,
                  ].slice(-20),
                ),
              );
            } catch {
              /* Session dismissal still works when storage is unavailable. */
            }
            setHidden(true);
            document
              .querySelector<HTMLElement>(
                ".composer textarea, .daily-question a, .feed-tabs a",
              )
              ?.focus({ preventScroll: true });
          }}
        >
          ×
        </button>
      )}
    </section>
  );
}
