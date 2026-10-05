"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AdminBadge } from "./admin-badge";
import { useRouter } from "next/navigation";
import { markNotificationsRead, openInbox } from "@/app/actions";
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
export function NotificationList() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [entryIds, setEntryIds] = useState(() => new Set<string>());
  const openRef = useRef<ReturnType<typeof openInbox> | null>(null);
  const generationRef = useRef(0);
  const [pending, setPending] = useState(false);
  const lockRef = useRef(false);
  const [state, setState] = useState({ ok: false, message: "" });
  const { count, update } = useNotificationCount();
  const router = useRouter();
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  }, [update]);
  useEffect(() => {
    let active = true;
    function enter() {
      const generation = ++generationRef.current;
      openRef.current ??= openInbox();
      void openRef.current
        .then((result) => {
          if (!active || generation !== generationRef.current) return;
          if (result.ok && result.entries && result.entryUnreadIds) {
            setItems(result.entries);
            setEntryIds(new Set(result.entryUnreadIds));
            updateRef.current(result.unreadCount ?? 0);
          } else setState({ ok: false, message: result.message });
          setLoading(false);
        })
        .catch(() => {
          if (active && generation === generationRef.current) {
            setState({
              ok: false,
              message: "খবরগুলো খোলা গেল না। আবার চেষ্টা করো।",
            });
            setLoading(false);
          }
        });
    }
    enter();
    function restored(event: PageTransitionEvent) {
      if (!event.persisted) return;
      openRef.current = null;
      setItems([]);
      setEntryIds(new Set());
      setState({ ok: false, message: "" });
      setLoading(true);
      enter();
    }
    window.addEventListener("pageshow", restored);
    return () => {
      active = false;
      window.removeEventListener("pageshow", restored);
    };
  }, [attempt]);
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
      setItems(
        items.map((n) =>
          !ids || ids.includes(n.id)
            ? { ...n, read_at: n.read_at ?? new Date().toISOString() }
            : n,
        ),
      );
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
        {count > 0 && !loading && (
          <button
            type="button"
            className="button button-small button-quiet"
            disabled={pending}
            onClick={() => void read()}
          >
            সব পড়া হয়েছে
          </button>
        )}
      </div>
      <Result state={state} />
      {loading ? (
        <p className="muted" role="status">
          খবরগুলো আসছে…
        </p>
      ) : state.message && !items.length ? (
        <button
          className="button button-small button-quiet"
          type="button"
          onClick={() => {
            openRef.current = null;
            setState({ ok: false, message: "" });
            setLoading(true);
            setAttempt((n) => n + 1);
          }}
        >
          আবার চেষ্টা করি
        </button>
      ) : !items.length ? (
        <Empty
          emoji="😌"
          title="এখনো কোনো খবর নাই।"
          text="শান্তির জীবন। আড্ডা জমলে খবরও আসবে।"
        />
      ) : (
        <div className="notification-list card" aria-busy={pending}>
          {notificationGroups(items, entryIds).map((group) => {
            const n = group[0],
              href = notificationHref(n);
            return (
              <article
                key={group.map((entry) => entry.id).join(":")}
                className={`notification ${entryIds.has(n.id) ? "entry-new" : n.read_at ? "" : "unread"}`}
              >
                <Avatar profile={n.profiles} />
                <div>
                  {entryIds.has(n.id) && (
                    <span className="sr-only">নতুন খবর। </span>
                  )}
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
                    <b>
                      {n.profiles.display_name}
                      <AdminBadge admin={n.profiles.is_admin} />
                    </b>
                    {group.length > 1
                      ? ` এবং আরও ${bn(group.length - 1)} জন`
                      : ""}
                    {n.kind === "reply"
                      ? " তোমার উত্তরে জবাব দিয়েছে।"
                      : n.kind === "mention"
                        ? " তোমাকে উল্লেখ করেছে।"
                        : n.kind === "quote"
                          ? " তোমার কথা আবার শেয়ার করেছে।"
                          : n.kind === "follow"
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
