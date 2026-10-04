"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Composer, Result } from "./forms";
import { PostCard } from "./post-card";
import { Empty } from "./empty";
import Loading from "@/app/loading";
import { FeedCache } from "@/lib/feed-cache";
import { SOCIAL_ERROR } from "@/lib/social";
import type { FeedMode, Post, SocialResult, Viewer } from "@/lib/types";
function feedKey(mode: string, before = "") {
  return `${mode}|${before}`;
}
export function HomeFeed({
  initialPosts,
  initialMode,
  initialBefore = "",
  viewer,
  configured,
}: {
  initialPosts: Post[];
  initialMode: FeedMode;
  initialBefore?: string;
  viewer: Viewer | null;
  configured: boolean;
}) {
  const params = useSearchParams();
  const mode: FeedMode =
    params.get("feed") === "following"
      ? "following"
      : params.get("feed") === "institution"
        ? "institution"
        : "all";
  const key = feedKey(mode, params.get("before") ?? "");
  const activeKeyRef = useRef(key);
  useEffect(() => {
    activeKeyRef.current = key;
  }, [key]);
  const [cache] = useState(() => {
    const cache = new FeedCache();
    cache.seed(feedKey(initialMode, initialBefore), initialPosts);
    return cache;
  });
  const [data, setData] = useState(() => ({
    key: feedKey(initialMode, initialBefore),
    posts: initialPosts,
  }));
  const [added, setAdded] = useState<{ post: Post; pending: boolean }[]>([]);
  const [error, setError] = useState({ ok: false, message: "" });
  const draftIdRef = useRef("");
  const load = useCallback(
    (target: string) =>
      cache.load(target, async () => {
        const [feed, before] = target.split("|");
        // The cursor itself contains '|'; preserve the complete remainder.
        const cursor = target.slice(feed.length + 1);
        const response = await fetch(
          `/api/social?feed=${feed}${before ? `&before=${encodeURIComponent(cursor)}` : ""}`,
          { cache: "no-store" },
        );
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error("Feed unavailable");
        return result.posts;
      }),
    [cache],
  );
  const apply = useCallback((target: string, posts: Post[] | null) => {
    if (posts && activeKeyRef.current === target) {
      setData({ key: target, posts });
      setAdded((items) => items.filter((item) => item.pending));
      setError({ ok: false, message: "" });
    }
  }, []);
  useEffect(() => {
    let active = true;
    void load(key)
      .then((posts) => {
        if (active) apply(key, posts);
      })
      .catch(() => {
        if (active) setError({ ok: false, message: SOCIAL_ERROR });
      });
    return () => {
      active = false;
    };
  }, [key, load, apply]);
  useEffect(() => {
    function changed(event: Event) {
      const { phase, result } = (
        event as CustomEvent<{ phase: string; result?: SocialResult }>
      ).detail;
      cache.clear();
      if (phase === "settled" && (result?.uncertain || data.key !== key))
        void load(key)
          .then((posts) => apply(key, posts))
          .catch(() => setError({ ok: false, message: SOCIAL_ERROR }));
    }
    window.addEventListener("tuktak:social-change", changed);
    function foreground() {
      if (document.visibilityState === "visible") {
        cache.clear();
        void load(key)
          .then((posts) => apply(key, posts))
          .catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", foreground);
    return () => {
      window.removeEventListener("tuktak:social-change", changed);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [cache, load, apply, key, data.key]);
  useEffect(() => {
    if (!viewer || viewer.suspended || !configured) return;
    const other = mode === "all" ? "following" : "all";
    const timer = window.setTimeout(() => {
      void load(feedKey(other)).catch(() => {});
    }, 400);
    return () => window.clearTimeout(timer);
  }, [viewer, configured, mode, load]);
  function select(
    event: React.MouseEvent<HTMLAnchorElement>,
    target: FeedMode,
  ) {
    if (
      event.button ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    window.history.pushState(
      null,
      "",
      target === "all" ? "/" : `/?feed=${target}`,
    );
  }
  function warm(target: FeedMode) {
    if (configured && viewer) void load(feedKey(target)).catch(() => {});
  }
  const base = data.key === key ? data.posts : cache.peek(key);
  const local = mode === "all" && !params.has("before") ? added : [];
  const ids = new Set(local.map((item) => item.post.id));
  const posts = [
    ...local.map((item) => item.post),
    ...(base ?? []).filter((post) => !ids.has(post.id)),
  ];
  const loading = data.key !== key && !error.message;
  return (
    <>
      {viewer && !viewer.suspended && (
        <Composer
          interaction={{
            start(form) {
              const id = `pending-${crypto.randomUUID()}`;
              draftIdRef.current = id;
              // Own posts cannot belong to the following-only feed. Show the new post
              // in its authoritative home feed, including when composing on a cursor.
              if (mode !== "all" || params.has("before"))
                window.history.pushState(null, "", "/");
              setAdded((items) => [
                {
                  pending: true,
                  post: {
                    id,
                    author_id: viewer.id,
                    body: String(form.get("body")).trim(),
                    mood: String(form.get("mood") ?? "") || null,
                    created_at: new Date().toISOString(),
                    profiles: viewer.profile,
                    reaction_counts: {},
                    current_reaction: null,
                    comment_count: 0,
                  },
                },
                ...items,
              ]);
            },
            settle(result) {
              setAdded((items) =>
                items.flatMap((item) =>
                  item.post.id === draftIdRef.current
                    ? result.ok && result.post
                      ? [{ post: result.post, pending: false }]
                      : []
                    : [item],
                ),
              );
            },
          }}
        />
      )}
      <nav className="feed-tabs" aria-label="আড্ডার ধরন">
        <Link
          href="/"
          prefetch={false}
          className={mode === "all" ? "active" : ""}
          aria-current={mode === "all" ? "page" : undefined}
          onClick={(event) => select(event, "all")}
          onMouseEnter={() => warm("all")}
          onFocus={() => warm("all")}
        >
          সবার <Sparkles size={14} />
        </Link>
        <Link
          href={viewer ? "/?feed=following" : "/login"}
          prefetch={false}
          className={mode === "following" ? "active" : ""}
          aria-current={mode === "following" ? "page" : undefined}
          onClick={viewer ? (event) => select(event, "following") : undefined}
          onMouseEnter={() => warm("following")}
          onFocus={() => warm("following")}
        >
          যাদের সাথে আছি
        </Link>
        {viewer?.profile.institution && (
          <Link
            href="/?feed=institution"
            prefetch={false}
            className={mode === "institution" ? "active" : ""}
            aria-current={mode === "institution" ? "page" : undefined}
            onClick={(event) => select(event, "institution")}
            onMouseEnter={() => warm("institution")}
            onFocus={() => warm("institution")}
          >
            আমার প্রতিষ্ঠান
          </Link>
        )}
        <span>নতুন কথা আগে ↓</span>
      </nav>
      {!configured && (
        <p className="sample-note">
          আড্ডার এক ঝলক · নিচের মানুষ আর গল্পগুলো কাল্পনিক নমুনা।
        </p>
      )}
      <div className="post-list" aria-busy={loading || undefined}>
        {!base && loading && !local.length ? (
          <Loading />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              viewer={viewer}
              optimistic={local.some(
                (item) => item.post.id === post.id && item.pending,
              )}
            />
          ))
        )}
        {!posts.length && !loading && (
          <Empty href="/compose" label="কিছু একটা বলি" />
        )}
        <Result state={error} />
      </div>
      {configured && (base?.length ?? 0) >= 20 && (
        <Link
          className="button load-more"
          href={`/?feed=${mode}&before=${encodeURIComponent(`${base!.at(-1)!.created_at}|${base!.at(-1)!.id}`)}`}
        >
          আরও কিছু কথা ↓
        </Link>
      )}
      <p className="feed-end">✦ এইটুকুই আপাতত। এবার একটু চা হোক?</p>
    </>
  );
}
