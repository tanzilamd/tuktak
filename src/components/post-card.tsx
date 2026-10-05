"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminBadge } from "./admin-badge";
import {
  MessageCircle,
  MoreHorizontal,
  ArrowUpRight,
  Repeat2,
} from "lucide-react";
import { Timestamp } from "./timestamp";
import { Avatar } from "./avatar";
import { RichText } from "./rich-text";
import { Mutation, Result } from "./forms";
import { toggleReaction, readSocial } from "@/lib/social";
import { REACTIONS, bn, loginHref } from "@/lib/config";
import { EDIT_WINDOW } from "@/lib/engagement";
import { exactTime } from "@/lib/time";
import { QuoteCard } from "./quote-preview";
import { PollCard } from "./poll-card";
import { PostEditor } from "./post-editor";
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
  const [editing, setEditing] = useState(false);
  const [editable, setEditable] = useState(
    () => Date.now() < Date.parse(post.created_at) + EDIT_WINDOW,
  );
  useEffect(() => {
    const left = Date.parse(post.created_at) + EDIT_WINDOW - Date.now();
    const timer = setTimeout(() => setEditable(false), Math.max(0, left));
    return () => clearTimeout(timer);
  }, [post.created_at]);
  const reactionLockRef = useRef(false);
  const [deleted, setDeleted] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState({ ok: false, message: "" });
  const stats = local.source === post || reactionPending ? local.stats : post;
  if (deleted || unavailable) return null;
  const mine = viewer?.id === post.author_id;
  function beginWrite() {
    if (reactionLockRef.current || deletePending || optimistic) return false;
    reactionLockRef.current = true;
    setReactionPending(true);
    return true;
  }
  return (
    <>
      <article className="post-card card" aria-busy={optimistic || undefined}>
        <div className="post-header">
          <Link className="post-person" href={`/u/${post.profiles.username}`}>
            <Avatar profile={post.profiles} />
            <span>
              <b>
                {post.profiles.display_name}
                <AdminBadge
                  admin={stats.author_is_admin ?? post.profiles.is_admin}
                />
                <span className="person-status">{post.profiles.status}</span>
              </b>
              <small>
                @{post.profiles.username} <span>·</span>{" "}
                <Timestamp value={post.created_at} />
                {stats.updated_at && (
                  <span
                    className="edited-label"
                    title={exactTime(stats.updated_at)}
                  >
                    সম্পাদিত
                  </span>
                )}
              </small>
            </span>
          </Link>
          <details className="post-menu" name="post-actions">
            <summary aria-label="পোস্টের আরও অপশন">
              <MoreHorizontal size={20} />
            </summary>
            <div className="menu-panel">
              {!optimistic && (!post.is_quote || stats.quote) && (
                <Link
                  className="quote-menu"
                  href={
                    viewer
                      ? `/compose?quote=${post.quoted_post_id ?? post.id}`
                      : loginHref(
                          `/compose?quote=${post.quoted_post_id ?? post.id}`,
                        )
                  }
                  aria-label="আবার শেয়ার করি"
                  prefetch={false}
                >
                  <Repeat2 size={16} aria-hidden="true" /> আবার শেয়ার করি
                </Link>
              )}
              {mine ? (
                <>
                  {editable && (
                    <button
                      type="button"
                      className="button button-small button-quiet"
                      disabled={optimistic || reactionPending || deletePending}
                      onClick={(event) => {
                        setEditing(true);
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                      }}
                    >
                      সম্পাদনা করি
                    </button>
                  )}
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
                </>
              ) : (
                <>
                  <Link
                    href={
                      viewer
                        ? `/report?type=post&id=${post.id}`
                        : loginHref(`/report?type=post&id=${post.id}`)
                    }
                    prefetch={false}
                  >
                    রিপোর্ট করি
                  </Link>
                  {viewer && (
                    <Mutation
                      action="mute"
                      values={{ id: post.author_id, enabled: true }}
                      label="চুপ রাখি (mute)"
                    />
                  )}
                  {viewer && (
                    <Mutation
                      action="block"
                      values={{ id: post.author_id, enabled: true }}
                      label="ব্লক করি"
                      confirm="একে অন্যের পোস্ট আর দেখতে পাবে না। ব্লক করবে?"
                    />
                  )}
                </>
              )}
            </div>
          </details>
        </div>
        {post.mood && <p className="post-mood">{post.mood}</p>}
        {editing ? (
          <PostEditor
            post={stats}
            begin={beginWrite}
            cancel={() => setEditing(false)}
            end={(fresh) => {
              if (fresh) setLocal({ source: post, stats: fresh });
              if (fresh === null) {
                setDeleted(true);
                onDeleteState?.(true);
              }
              reactionLockRef.current = false;
              setReactionPending(false);
            }}
          />
        ) : (
          stats.body && (
            <p className="post-body">
              <RichText text={stats.body} mentions={stats.mentions} />
            </p>
          )
        )}
        {post.is_quote && <QuoteCard quote={stats.quote} />}
        {stats.poll && (
          <PollCard
            id={post.id}
            poll={stats.poll}
            viewer={viewer}
            disabled={optimistic || deletePending || reactionPending}
            begin={beginWrite}
            end={(fresh) => {
              if (fresh)
                setLocal({ source: post, stats: { ...stats, ...fresh } });
              if (fresh === null) {
                setDeleted(true);
                onDeleteState?.(true);
              }
              reactionLockRef.current = false;
              setReactionPending(false);
            }}
          />
        )}
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
                      if (!beginWrite()) return false;
                      setLocal({
                        source: post,
                        stats: { ...stats, ...toggleReaction(stats, r.key) },
                      });
                    },
                    async settle(result) {
                      setLocal({
                        source: post,
                        stats: {
                          ...stats,
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
                  href={loginHref(`/post/${post.id}`)}
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
            {profile.display_name}
            <AdminBadge admin={profile.is_admin} /> {profile.status}
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
        ) : !viewer ? (
          <Link
            className="button button-small"
            href={loginHref(`/u/${profile.username}`)}
          >
            সাথে থাকি +
          </Link>
        ) : (
          <Link className="small" href={`/u/${profile.username}`}>
            দেখি ↗
          </Link>
        )}
      </div>
    </article>
  );
}
