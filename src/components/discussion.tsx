"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { loginHref } from "@/lib/config";
import { AdminBadge } from "./admin-badge";
import { PostCard } from "./post-card";
import { Composer, Mutation, Result } from "./forms";
import { Timestamp } from "./timestamp";
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
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
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
                      parent_id: null,
                      reply_count: 0,
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
              <Link href={loginHref(`/post/${post.id}`)}>লগইন করো</Link>, তারপর
              কথা হবে।
            </p>
          )}
          {!replies.length && (
            <p className="reply-empty">সবাই চুপ। প্রথম কথাটা তুমি বলবে?</p>
          )}
          {replies
            .filter((c) => !c.parent_id)
            .map((root) => (
              <div className="comment-thread" key={root.id}>
                {[
                  root,
                  ...replies
                    .filter((c) => c.parent_id === root.id)
                    .sort(
                      (a, b) =>
                        a.created_at.localeCompare(b.created_at) ||
                        a.id.localeCompare(b.id),
                    ),
                ].map((c) => (
                  <article
                    key={c.id}
                    id={`comment-${c.id}`}
                    className={`comment ${c.parent_id ? "comment-reply" : ""}`}
                    aria-busy={c.id.startsWith("pending-") || undefined}
                  >
                    <Link
                      className="post-person"
                      href={`/u/${c.profiles.username}`}
                    >
                      <Avatar profile={c.profiles} />
                      <span>
                        <b>
                          {c.profiles.display_name}
                          <AdminBadge admin={c.profiles.is_admin} />
                        </b>
                        <small>
                          @{c.profiles.username} ·{" "}
                          <Timestamp value={c.created_at} />
                        </small>
                      </span>
                    </Link>
                    <p className="post-body">
                      <RichText text={c.body} mentions={c.mentions} />
                    </p>
                    {!viewer && (
                      <div className="comment-actions">
                        <Link
                          className="button button-small button-quiet"
                          href={loginHref(
                            `/post/${post.id}?comment=${c.id}#comment-${c.id}`,
                          )}
                        >
                          জবাব দিই
                        </Link>
                        <Link
                          className="small muted"
                          href={loginHref(`/report?type=comment&id=${c.id}`)}
                          prefetch={false}
                        >
                          রিপোর্ট করি
                        </Link>
                      </div>
                    )}
                    {viewer && (
                      <div className="comment-actions">
                        <button
                          type="button"
                          className="button button-small button-quiet"
                          disabled={pending || c.id.startsWith("pending-")}
                          onClick={() => setReplyTarget(c)}
                        >
                          জবাব দিই
                        </button>
                        {viewer.id === c.author_id ? (
                          <Mutation
                            action="delete_comment"
                            values={{ id: c.id, post_id: post.id }}
                            label="মুছে দিই"
                            confirm={
                              c.parent_id
                                ? "এই উত্তর মুছে দেবে?"
                                : "এই উত্তর আর এর নিচের সব জবাব মুছে যাবে। নিশ্চিত?"
                            }
                            disabled={pending || c.id.startsWith("pending-")}
                            interaction={{
                              start() {
                                if (!begin()) return false;
                                if (
                                  replyTarget &&
                                  (replyTarget.parent_id ?? replyTarget.id) ===
                                    c.id
                                )
                                  return;
                                setReplies((items) =>
                                  items
                                    .filter(
                                      (item) =>
                                        item.id !== c.id &&
                                        item.parent_id !== c.id,
                                    )
                                    .map((item) =>
                                      item.id === c.parent_id
                                        ? {
                                            ...item,
                                            reply_count: Math.max(
                                              0,
                                              (item.reply_count ?? 0) - 1,
                                            ),
                                          }
                                        : item,
                                    ),
                                );
                                setCount((value) =>
                                  Math.max(
                                    0,
                                    value -
                                      1 -
                                      (!c.parent_id ? (c.reply_count ?? 0) : 0),
                                  ),
                                );
                              },
                              settle: (result) => settle(result, true),
                            }}
                          />
                        ) : (
                          <Link
                            className="small muted"
                            href={`/report?type=comment&id=${c.id}`}
                            prefetch={false}
                          >
                            রিপোর্ট করি
                          </Link>
                        )}
                      </div>
                    )}
                  </article>
                ))}
                {viewer &&
                  replyTarget &&
                  (replyTarget.parent_id ?? replyTarget.id) === root.id && (
                    <div className="thread-composer">
                      <div className="comment-actions">
                        <span className="small muted">
                          @{replyTarget.profiles.username}-কে জবাব
                        </span>
                        <button
                          type="button"
                          className="button button-small button-quiet"
                          disabled={pending}
                          onClick={() => setReplyTarget(null)}
                        >
                          থাক
                        </button>
                      </div>
                      <Composer
                        key={replyTarget.id}
                        replyTo={post.id}
                        parentId={root.id}
                        prompt={
                          replyTarget.parent_id
                            ? `@${replyTarget.profiles.username} `
                            : ""
                        }
                        disabled={pending}
                        interaction={{
                          start(form) {
                            if (!begin()) return false;
                            setReplies((items) => [
                              ...items.map((c) =>
                                c.id === root.id
                                  ? {
                                      ...c,
                                      reply_count: (c.reply_count ?? 0) + 1,
                                    }
                                  : c,
                              ),
                              {
                                id: `pending-${crypto.randomUUID()}`,
                                post_id: post.id,
                                parent_id: root.id,
                                author_id: viewer.id,
                                body: String(form.get("body")).trim(),
                                created_at: new Date().toISOString(),
                                profiles: viewer.profile,
                              },
                            ]);
                            setCount((value) => value + 1);
                          },
                          async settle(result) {
                            await settle(result);
                            if (result.ok) setReplyTarget(null);
                          },
                        }}
                      />
                    </div>
                  )}
              </div>
            ))}
          <Result state={error} />
        </section>
      )}
    </>
  );
}
