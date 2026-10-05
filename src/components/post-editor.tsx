"use client";
import { useEffect, useId } from "react";
import type { Post } from "@/lib/types";
import { bn, charCount } from "@/lib/config";
import { mentionNames } from "@/lib/engagement";
import { readSocial } from "@/lib/social";
import { useInteraction } from "./interaction";
import { Result } from "./forms";
import { useBodyInput } from "./use-body-input";
export function PostEditor({
  post,
  begin,
  end,
  cancel,
}: {
  post: Post;
  begin: () => boolean;
  end: (post?: Post | null) => void;
  cancel: () => void;
}) {
  const { body, inputRef, inputProps } = useBodyInput(post.body);
  const id = useId();
  const interaction = useInteraction({
    start: begin,
    async settle(result) {
      let current = result.ok ? (result.post ?? null) : undefined;
      if (result.uncertain) {
        const fresh = await readSocial({ id: post.id });
        if (fresh.ok) current = fresh.post ?? null;
      }
      end(current);
      if (result.ok && current) cancel();
    },
  });
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [inputRef]);
  return (
    <form
      className="post-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (interaction.pending) return;
        const form = new FormData(event.currentTarget);
        void interaction.run(form);
      }}
    >
      <input type="hidden" name="action" value="edit_post" />
      <input type="hidden" name="id" value={post.id} />
      <label htmlFor={id}>কথাটা সম্পাদনা করি</label>
      <textarea
        {...inputProps}
        id={id}
        name="body"
        rows={3}
        value={body}
        readOnly={interaction.pending}
        aria-describedby={`${id}-count`}
      />
      <div className="editor-actions">
        <span
          className={`counter ${charCount(body) > 240 ? "danger" : ""}`}
          id={`${id}-count`}
        >
          {bn(charCount(body))} / ২৪০
        </span>
        <button
          type="button"
          className="button button-small button-quiet"
          onClick={cancel}
          disabled={interaction.pending}
        >
          থাক
        </button>
        <button
          type="submit"
          className="button button-small button-primary"
          disabled={
            interaction.pending ||
            (!post.is_quote && !body.trim()) ||
            charCount(body) > 240 ||
            mentionNames(body).length > 5
          }
        >
          {interaction.pending ? "রাখছি…" : "রেখে দিই"}
        </button>
      </div>
      <Result state={interaction.state} />
    </form>
  );
}
