"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Poll, PostStats, Viewer } from "@/lib/types";
import { bn, loginHref } from "@/lib/config";
import { pollRemaining, voteOptimistically } from "@/lib/engagement";
import { readSocial } from "@/lib/social";
import { useInteraction } from "./interaction";
import { Result } from "./forms";

export function PollCard({
  id,
  poll,
  viewer,
  disabled,
  begin,
  end,
}: {
  id: string;
  poll: Poll;
  viewer: Viewer | null;
  disabled: boolean;
  begin: () => boolean;
  end: (stats?: PostStats | null) => void;
}) {
  const router = useRouter();
  const [local, setLocal] = useState({ source: poll, poll });
  const value = local.source === poll ? local.poll : poll;
  const [now, setNow] = useState(() => Date.now());
  const [forcedClosed, setForcedClosed] = useState(false);
  const lockRef = useRef(false);
  const previousRef = useRef(value);
  const interaction = useInteraction({
    start(form) {
      if (lockRef.current || !begin()) return false;
      lockRef.current = true;
      previousRef.current = value;
      setLocal({
        source: poll,
        poll: voteOptimistically(value, String(form.get("option_id"))),
      });
    },
    async settle(result) {
      let stats = result.ok ? result.stats : undefined;
      if (result.uncertain || result.message === "ভোটগ্রহণ শেষ হয়েছে।") {
        const fresh = await readSocial({ stats: id });
        if (fresh.ok) stats = fresh.batchStats?.[id] ?? null;
      }
      if (result.message === "ভোটগ্রহণ শেষ হয়েছে।") setForcedClosed(true);
      setLocal({ source: poll, poll: stats?.poll ?? previousRef.current });
      end(stats);
      lockRef.current = false;
    },
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      const current = Date.now();
      setNow(current);
      const left = Date.parse(poll.expires_at) - current;
      if (left <= 0) {
        window.dispatchEvent(
          new CustomEvent("tuktak:poll-expired", { detail: id }),
        );
        return;
      }
      timer = setTimeout(tick, Math.min(60000, left + 5));
    }
    const left = Date.parse(poll.expires_at) - Date.now();
    if (left > 0) timer = setTimeout(tick, Math.min(60000, left + 5));
    function fresh(event: Event) {
      const stats = (event as CustomEvent<Record<string, PostStats>>).detail[
        id
      ];
      if (!lockRef.current && stats?.poll)
        setLocal({ source: poll, poll: stats.poll });
    }
    window.addEventListener("tuktak:poll-fresh", fresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("tuktak:poll-fresh", fresh);
    };
  }, [id, poll]);
  const remaining = pollRemaining(value.expires_at, now);
  const closed = forcedClosed || remaining.closed;
  const total = value.options.reduce((sum, o) => sum + o.votes, 0);
  return (
    <section className="poll-card" role="group" aria-label="পোল">
      <div className="poll-options" role="group" aria-label="পোলের উত্তর">
        {value.options.map((option) => {
          const percent = total ? Math.round((option.votes / total) * 100) : 0;
          const selected = value.selected_option === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`poll-option ${selected ? "selected" : ""}`}
              disabled={
                viewer?.suspended || closed || disabled || interaction.pending
              }
              aria-pressed={selected}
              aria-label={`${option.body}, ${bn(percent)} শতাংশ, ${bn(option.votes)} ভোট${selected ? ", তোমার ভোট" : ""}`}
              onClick={() => {
                if (!viewer) {
                  router.push(loginHref(`/post/${id}`));
                  return;
                }
                const form = new FormData();
                form.set("action", "vote_poll");
                form.set("id", id);
                form.set("option_id", option.id);
                void interaction.run(form);
              }}
            >
              <span
                className="poll-progress"
                style={{ width: `${percent}%` }}
                aria-hidden="true"
              />
              <span className="poll-option-text">
                {option.body}
                {selected && <span aria-hidden="true"> ✓</span>}
              </span>
              <span className="poll-number">
                {bn(percent)}% · {bn(option.votes)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="small muted poll-summary">
        {bn(total)} ভোট ·{" "}
        {closed
          ? "ভোটগ্রহণ শেষ"
          : `${bn(remaining.value)} ${remaining.unit} বাকি`}
      </p>
      {!viewer && !closed && (
        <Link href={loginHref(`/post/${id}`)} className="small">
          ভোট দিতে লগইন করো
        </Link>
      )}
      {!interaction.state.ok && <Result state={interaction.state} />}
    </section>
  );
}
