"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { PostCard } from "./post-card";
import { Composer, Mutation, Result } from "./forms";
import { Avatar } from "./avatar";
import { RichText } from "./rich-text";
import { bn } from "@/lib/config";
import { readSocial } from "@/lib/social";
import type { Comment, Post, SocialResult, Viewer } from "@/lib/types";
export function Discussion({
  post,
  viewer,
  initialReplies,
}: {
  post: Post;
  viewer: Viewer | null;
  initialReplies: Comment[];
}) {
  const [replies, setReplies] = useState(initialReplies);
  const [count, setCount] = useState(post.comment_count);
  const [deleted, setDeleted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState({ ok: false, message: "" });
  const lockRef = useRef(false);
  const previousRef = useRef({
    replies: initialReplies,
    count: post.comment_count,
  });
  function begin() {
    if (lockRef.current) return false;
    lockRef.current = true;
    previousRef.current = { replies, count };
    setPending(true);
    setError({ ok: false, message: "" });
    return true;
  }
  async function settle(result: SocialResult, showError = false) {
    if (result.ok && result.comments && result.stats) {
      setReplies(result.comments);
      setCount(result.stats.comment_count);
    } else {
      setReplies(previousRef.current.replies);
      setCount(previousRef.current.count);
      if (!result.ok && showError) setError(result);
    }
    if (result.ok && result.stats === null) setDeleted(true);
    if (result.uncertain) {
      const fresh = await readSocial({ id: post.id });
      if (fresh.ok && fresh.post) {
        setReplies(fresh.comments ?? []);
        setCount(fresh.post.comment_count);
      } else if (fresh.ok) setDeleted(true);
    }
    lockRef.current = false;
    setPending(false);
  }
  return (
    <>
      <PostCard
        post={post}
        viewer={viewer}
        detail
        commentCount={count}
        onDeleteState={setDeleted}
        unavailable={deleted}
      />
      {!deleted && (
        <section className="card content-card reply-section">
          <h2>{bn(count)}টা উত্তর</h2>
          {viewer ? (
            <Composer
              replyTo={post.id}
              disabled={pending}
              interaction={{
                start(form) {
                  if (!begin()) return false;
                  setReplies((items) => [
                    {
                      id: `pending-${crypto.randomUUID()}`,
                      post_id: post.id,
                      author_id: viewer.id,
                      body: String(form.get("body")).trim(),
                      created_at: new Date().toISOString(),
                      profiles: viewer.profile,
                    },
                    ...items,
                  ]);
                  setCount((value) => value + 1);
                },
                settle,
              }}
            />
          ) : (
            <p className="muted">
              <Link href="/login">লগইন করো</Link>, তারপর কথা হবে।
            </p>
          )}
          {!replies.length && (
            <p className="reply-empty">সবাই চুপ। প্রথম কথাটা তুমি বলবে?</p>
          )}
          {replies.map((c) => (
            <article
              key={c.id}
              className="comment"
              aria-busy={c.id.startsWith("pending-") || undefined}
            >
              <Link className="post-person" href={`/u/${c.profiles.username}`}>
                <Avatar profile={c.profiles} />
                <span>
                  <b>{c.profiles.display_name}</b>
                  <small>@{c.profiles.username}</small>
                </span>
              </Link>
              <p className="post-body">
                <RichText text={c.body} />
              </p>
              {viewer &&
                (viewer.id === c.author_id ? (
                  <Mutation
                    action="delete_comment"
                    values={{ id: c.id, post_id: post.id }}
                    label="মুছে দিই"
                    confirm="এই উত্তর মুছে দেবে?"
                    disabled={pending || c.id.startsWith("pending-")}
                    interaction={{
                      start() {
                        if (!begin()) return false;
                        setReplies((items) =>
                          items.filter((item) => item.id !== c.id),
                        );
                        setCount((value) => Math.max(0, value - 1));
                      },
                      settle: (result) => settle(result, true),
                    }}
                  />
                ) : (
                  <Link
                    className="small muted"
                    href={`/report?type=comment&id=${c.id}`}
                  >
                    রিপোর্ট করি
                  </Link>
                ))}
            </article>
          ))}
          <Result state={error} />
        </section>
      )}
    </>
  );
}
