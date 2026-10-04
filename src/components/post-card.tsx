"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, MoreHorizontal, ArrowUpRight } from "lucide-react";
import { Avatar } from "./avatar";
import { RichText } from "./rich-text";
import { Mutation, Result } from "./forms";
import { toggleReaction, readSocial } from "@/lib/social";
import { REACTIONS, bn } from "@/lib/config";
import type { Post, Viewer, Profile } from "@/lib/types";
export function PostCard({
  post,
  viewer,
  detail = false,
  commentCount,
  optimistic = false,
  onDeleteState,
  unavailable = false,
}: {
  post: Post;
  viewer: Viewer | null;
  detail?: boolean;
  commentCount?: number;
  optimistic?: boolean;
  onDeleteState?: (deleted: boolean) => void;
  unavailable?: boolean;
}) {
  const [local, setLocal] = useState({ source: post, stats: post });
  const [reactionPending, setReactionPending] = useState(false);
  const reactionLockRef = useRef(false);
  const [deleted, setDeleted] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState({ ok: false, message: "" });
  const stats = local.source === post || reactionPending ? local.stats : post;
  if (deleted || unavailable) return null;
  const mine = viewer?.id === post.author_id;
  const date = new Date(post.created_at);
  return (
    <>
      <article className="post-card card" aria-busy={optimistic || undefined}>
        <div className="post-header">
          <Link className="post-person" href={`/u/${post.profiles.username}`}>
            <Avatar profile={post.profiles} />
            <span>
              <b>
                {post.profiles.display_name}
                <span className="person-status">{post.profiles.status}</span>
              </b>
              <small>
                @{post.profiles.username} <span>·</span>{" "}
                <time dateTime={post.created_at}>
                  {new Intl.DateTimeFormat("bn-BD", {
                    month: "short",
                    day: "numeric",
                    timeZone: "Asia/Dhaka",
                  }).format(date)}
                </time>
              </small>
            </span>
          </Link>
          {viewer && (
            <details className="post-menu">
              <summary aria-label="পোস্টের আরও অপশন">
                <MoreHorizontal size={20} />
              </summary>
              <div className="menu-panel">
                {mine ? (
                  <Mutation
                    action="delete_post"
                    values={{ id: post.id }}
                    label="পোস্ট মুছে দিই"
                    confirm="এই পোস্ট আর তার সব উত্তর মুছে যাবে। নিশ্চিত?"
                    disabled={optimistic || reactionPending || deletePending}
                    interaction={{
                      start() {
                        setDeleteError({ ok: false, message: "" });
                        setDeleted(true);
                        setDeletePending(true);
                        onDeleteState?.(true);
                      },
                      async settle(result) {
                        if (!result.ok) {
                          setDeleted(false);
                          onDeleteState?.(false);
                          setDeleteError(result);
                        }
                        if (result.uncertain) {
                          const fresh = await readSocial({ id: post.id });
                          if (fresh.ok && !fresh.post) {
                            setDeleted(true);
                            onDeleteState?.(true);
                          }
                        }
                        setDeletePending(false);
                      },
                    }}
                  />
                ) : (
                  <>
                    <Link href={`/report?type=post&id=${post.id}`}>
                      রিপোর্ট করি
                    </Link>
                    <Mutation
                      action="mute"
                      values={{ id: post.author_id, enabled: true }}
                      label="চুপ রাখি (mute)"
                    />
                    <Mutation
                      action="block"
                      values={{ id: post.author_id, enabled: true }}
                      label="ব্লক করি"
                      confirm="একে অন্যের পোস্ট আর দেখতে পাবে না। ব্লক করবে?"
                    />
                  </>
                )}
              </div>
            </details>
          )}
        </div>
        {post.mood && <p className="post-mood">{post.mood}</p>}
        <p className="post-body">
          <RichText text={post.body} />
        </p>
        <div className="post-actions">
          <div className="reactions">
            {REACTIONS.map((r) => {
              const count = stats.reaction_counts[r.key] ?? 0;
              const selected = stats.current_reaction === r.key;
              const label = `${r.emoji} ${bn(count)}`;
              return viewer ? (
                <Mutation
                  key={r.key}
                  action="react"
                  values={{ id: post.id, kind: r.key }}
                  label={label}
                  className={`reaction ${selected ? "selected" : ""}`}
                  pressed={selected}
                  ariaLabel={`${r.label}, ${bn(count)}টি`}
                  disabled={optimistic || reactionPending || deletePending}
                  interaction={{
                    start() {
                      if (reactionLockRef.current) return false;
                      reactionLockRef.current = true;
                      setReactionPending(true);
                      setLocal({
                        source: post,
                        stats: { ...post, ...toggleReaction(stats, r.key) },
                      });
                    },
                    async settle(result) {
                      setLocal({
                        source: post,
                        stats: {
                          ...post,
                          ...(result.ok && result.stats ? result.stats : stats),
                        },
                      });
                      if (result.ok && result.stats === null) {
                        setDeleted(true);
                        onDeleteState?.(true);
                      }
                      if (result.uncertain) {
                        const fresh = await readSocial({ id: post.id });
                        if (fresh.ok) {
                          if (fresh.post)
                            setLocal({ source: post, stats: fresh.post });
                          else {
                            setDeleted(true);
                            onDeleteState?.(true);
                          }
                        }
                      }
                      reactionLockRef.current = false;
                      setReactionPending(false);
                    },
                  }}
                >
                  <span className="sr-only">{r.label}</span>
                </Mutation>
              ) : (
                <Link
                  key={r.key}
                  href="/login"
                  className="reaction-button"
                  aria-label={`${r.label}, ${bn(count)}টি`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <Link
            className="reply-link"
            href={`/post/${post.id}`}
            aria-label={`${bn(commentCount ?? stats.comment_count)}টি উত্তর`}
            prefetch={optimistic ? false : undefined}
            aria-disabled={optimistic || undefined}
            onClick={optimistic ? (event) => event.preventDefault() : undefined}
          >
            <MessageCircle size={17} />
            <span>{bn(commentCount ?? stats.comment_count)}</span>
          </Link>
          {!detail && (
            <Link
              className="open-post"
              href={`/post/${post.id}`}
              aria-label="পোস্ট খুলে দেখি"
              prefetch={optimistic ? false : undefined}
              aria-disabled={optimistic || undefined}
              onClick={
                optimistic ? (event) => event.preventDefault() : undefined
              }
            >
              <ArrowUpRight size={17} />
            </Link>
          )}
        </div>
      </article>
      <Result state={deleteError} />
    </>
  );
}
export function PersonCard({
  profile,
  viewer,
  following = false,
}: {
  profile: Profile;
  viewer: Viewer | null;
  following?: boolean;
}) {
  return (
    <article className="person-card card">
      <Link href={`/u/${profile.username}`} className="post-person">
        <Avatar profile={profile} />
        <span>
          <b>
            {profile.display_name} {profile.status}
          </b>
          <small>@{profile.username}</small>
        </span>
      </Link>
      <p className="muted">{profile.bio || "কথা হবে আড্ডায়।"}</p>
      <div className="person-bottom">
        <span className="small muted">
          {profile.hobbies.slice(0, 2).join(" · ")}
        </span>
        {viewer && viewer.id !== profile.id ? (
          <Mutation
            action="follow"
            values={{ id: profile.id, enabled: !following }}
            label={following ? "সাথে আছি ✓" : "সাথে থাকি +"}
            pressed={following}
          />
        ) : (
          <Link className="small" href={`/u/${profile.username}`}>
            দেখি ↗
          </Link>
        )}
      </div>
    </article>
  );
}
