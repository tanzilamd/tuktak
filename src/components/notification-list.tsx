"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markNotificationsRead } from "@/app/actions";
import {
  notificationGroups,
  notificationHref,
  type Notification,
} from "@/lib/notifications";
import { bn } from "@/lib/config";
import { Avatar } from "./avatar";
import { Timestamp } from "./timestamp";
import { Empty } from "./empty";
import { Result } from "./forms";
import { useNotificationCount } from "./notification-count";
export function NotificationList({
  entries,
  unreadCount,
}: {
  entries: Notification[];
  unreadCount: number;
}) {
  const [local, setLocal] = useState({ source: entries, entries });
  const items = local.source === entries ? local.entries : entries;
  const [pending, setPending] = useState(false);
  const lockRef = useRef(false);
  const [state, setState] = useState({ ok: false, message: "" });
  const { count, update } = useNotificationCount();
  const router = useRouter();
  useEffect(() => update(unreadCount), [unreadCount, update]);
  async function read(ids?: string[], href?: string) {
    if (lockRef.current) return;
    lockRef.current = true;
    setPending(true);
    setState({ ok: false, message: "" });
    try {
      const result = await markNotificationsRead(ids);
      if (!result.ok) {
        setState(result);
        return;
      }
      update(result.unreadCount ?? count);
      setLocal({
        source: entries,
        entries: items.map((n) =>
          !ids || ids.includes(n.id)
            ? { ...n, read_at: n.read_at ?? new Date().toISOString() }
            : n,
        ),
      });
      if (href) router.push(href);
    } catch {
      setState({
        ok: false,
        message: "পড়া হয়েছে হিসেবে রাখা যায়নি। আবার চেষ্টা করো।",
      });
    } finally {
      lockRef.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <div className="page-top">
        <h1>খবর 🔔</h1>
        <button
          type="button"
          className="button button-small button-quiet"
          disabled={pending || count === 0}
          onClick={() => void read()}
        >
          সব পড়া হয়েছে
        </button>
      </div>
      <Result state={state} />
      {!items.length ? (
        <Empty
          emoji="😌"
          title="এখনো কোনো খবর নাই।"
          text="শান্তির জীবন। আড্ডা জমলে খবরও আসবে।"
        />
      ) : (
        <div className="notification-list card" aria-busy={pending}>
          {notificationGroups(items).map((group) => {
            const n = group[0],
              href = notificationHref(n);
            return (
              <article
                key={group.map((entry) => entry.id).join(":")}
                className={`notification ${n.read_at ? "" : "unread"}`}
              >
                <Avatar profile={n.profiles} />
                <div>
                  <Link
                    href={href}
                    onClick={(event) => {
                      if (n.read_at) return;
                      // Keep native modified-click/new-tab navigation working; still mark this group.
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      ) {
                        void read(group.map((entry) => entry.id));
                        return;
                      }
                      event.preventDefault();
                      void read(
                        group.map((entry) => entry.id),
                        href,
                      );
                    }}
                    onAuxClick={(event) => {
                      if (event.button === 1 && !n.read_at)
                        void read(group.map((entry) => entry.id));
                    }}
                  >
                    <b>{n.profiles.display_name}</b>
                    {group.length > 1
                      ? ` এবং আরও ${bn(group.length - 1)} জন`
                      : ""}
                    {n.kind === "follow"
                      ? " তোমার সাথে আছে।"
                      : n.kind === "comment"
                        ? " তোমার কথায় উত্তর দিয়েছে।"
                        : " তোমার পোস্টে প্রতিক্রিয়া দিয়েছে।"}
                  </Link>
                  <small>
                    <Timestamp value={n.created_at} />
                  </small>
                </div>
                {!n.read_at && (
                  <button
                    className="button button-small button-quiet"
                    type="button"
                    disabled={pending}
                    onClick={() => void read(group.map((entry) => entry.id))}
                  >
                    পড়েছি ✓
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
