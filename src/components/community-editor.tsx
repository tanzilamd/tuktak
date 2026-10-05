"use client";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  cloneElement,
  type ReactElement,
} from "react";
import { mutate } from "@/app/actions";
import {
  communitySaveSchema,
  communityInput,
  COMMUNITY_FIELD_MESSAGES,
  dhakaInput,
  type CommunityEntry,
  type CommunityKind,
} from "@/lib/community";
import { FeedbackForm, useFieldError } from "./form-feedback";
import type { ActionState } from "@/lib/types";
import { bn } from "@/lib/config";
const initial: ActionState = { ok: false, message: "" };
function EditorField({
  name,
  label,
  children,
  hint,
}: {
  name: string;
  label: string;
  children: ReactElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
  hint?: string;
}) {
  const error = useFieldError(name);
  const errorId = useId();
  return (
    <label className="field">
      <span>{label}</span>
      {/* Only the editor's own intrinsic control is cloned, preserving its handlers. */}
      {/* eslint-disable-next-line @eslint-react/no-clone-element */}
      {cloneElement(children, {
        "aria-invalid": !!error,
        "aria-describedby":
          [hint ? `${errorId}-hint` : "", error ? errorId : ""]
            .filter(Boolean)
            .join(" ") || undefined,
      })}
      {hint && (
        <small className="muted" id={`${errorId}-hint`}>
          {hint}
        </small>
      )}
      {error && (
        <small id={errorId} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function CommunityEditor({
  kind,
  entry,
  start,
}: {
  kind: CommunityKind;
  entry?: CommunityEntry;
  start: string;
}) {
  const [state, submit, pending] = useActionState(mutate, initial);
  const lockRef = useRef(false);
  const resetRef = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState(entry?.body ?? "");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [priority, setPriority] = useState(entry?.priority ?? 1);
  const [dismissible, setDismissible] = useState(entry?.dismissible ?? true);
  useEffect(() => {
    if (!pending) lockRef.current = false;
  }, [pending, state]);
  useEffect(() => {
    if (state.ok && !entry) {
      resetRef.current = true;
      formRef.current?.querySelector("form")?.reset();
      resetRef.current = false;
    }
  }, [state, entry]);
  const limit = kind === "questions" ? 160 : kind === "prompts" ? 120 : 240;
  const field = (
    name: string,
    label: string,
    node: ReactElement<{ "aria-describedby"?: string }>,
  ) => (
    <EditorField name={name} label={label}>
      {node}
    </EditorField>
  );
  return (
    <div ref={formRef}>
      <FeedbackForm
        state={pending ? initial : state}
        schema={communitySaveSchema}
        input={communityInput}
        fieldMessages={COMMUNITY_FIELD_MESSAGES}
        className="community-editor"
        onReset={(event) => {
          // React resets resolved Actions even when they return a validation/rate failure.
          // Preserve edit/draft values; only our confirmed new-entry reset is allowed.
          if (!resetRef.current) {
            event.preventDefault();
            return;
          }
          setBody("");
          setTitle("");
          setPriority(1);
          setDismissible(true);
        }}
        action={(form) => {
          if (lockRef.current) return;
          lockRef.current = true;
          submit(form);
        }}
      >
        <input type="hidden" name="action" value="community_save" />
        <input type="hidden" name="kind" value={kind} />
        {entry && <input type="hidden" name="id" value={entry.id} />}
        {(kind === "questions" ||
          kind === "prompts" ||
          kind === "announcements") && (
          <EditorField
            name="body"
            label={
              kind === "questions"
                ? "প্রশ্ন"
                : kind === "prompts"
                  ? "প্রম্পট"
                  : "ঘোষণার লেখা"
            }
            hint={`সর্বোচ্চ ${bn(limit)} অক্ষর`}
          >
            <textarea
              name="body"
              rows={kind === "announcements" ? 3 : 2}
              defaultValue={entry?.body ?? ""}
              onChange={(e) => setBody(e.target.value)}
            />
          </EditorField>
        )}
        {kind === "moods" && (
          <div className="form-grid">
            {field(
              "label",
              "মুডের নাম",
              <input name="label" defaultValue={entry?.label} />,
            )}
            {field(
              "emoji",
              "ইমোজি · ঐচ্ছিক",
              <input name="emoji" defaultValue={entry?.emoji} />,
            )}
          </div>
        )}
        {kind === "topics" && (
          <>
            {field(
              "tag",
              "বিষয়",
              <input
                name="tag"
                defaultValue={entry?.tag}
                placeholder="#টুকটাক"
              />,
            )}
            {field(
              "expires_at",
              "শেষের সময় · ঐচ্ছিক, বাংলাদেশ সময়",
              <input
                type="datetime-local"
                name="expires_at"
                defaultValue={
                  entry?.expires_at ? dhakaInput(entry.expires_at) : ""
                }
              />,
            )}
          </>
        )}
        {kind === "announcements" && (
          <>
            {field(
              "title",
              "শিরোনাম · ঐচ্ছিক",
              <input
                name="title"
                defaultValue={entry?.title}
                onChange={(e) => setTitle(e.target.value)}
              />,
            )}
            {field(
              "priority",
              "ধরন",
              <select
                name="priority"
                defaultValue={entry?.priority ?? 1}
                onChange={(e) => setPriority(Number(e.target.value))}
              >
                <option value="1">সাধারণ</option>
                <option value="2">গুরুত্বপূর্ণ</option>
                <option value="3">জরুরি</option>
              </select>,
            )}
            <div className="form-grid">
              {field(
                "starts_at",
                "শুরু · বাংলাদেশ সময়",
                <input
                  type="datetime-local"
                  name="starts_at"
                  defaultValue={
                    entry?.starts_at ? dhakaInput(entry.starts_at) : start
                  }
                />,
              )}
              {field(
                "ends_at",
                "শেষ · ঐচ্ছিক, বাংলাদেশ সময়",
                <input
                  type="datetime-local"
                  name="ends_at"
                  defaultValue={entry?.ends_at ? dhakaInput(entry.ends_at) : ""}
                />,
              )}
            </div>
            {field(
              "link",
              "লিংক · ঐচ্ছিক",
              <input
                name="link"
                defaultValue={entry?.link}
                placeholder="https:// বা /community"
              />,
            )}
            <label className="check">
              <input
                type="checkbox"
                name="dismissible"
                defaultChecked={entry?.dismissible ?? true}
                onChange={(e) => setDismissible(e.target.checked)}
              />
              দেখার পরে সরিয়ে রাখা যাবে
            </label>
            <div
              className={`announcement-preview announcement-priority-${priority}`}
              aria-label="ঘোষণার নমুনা"
            >
              <span className="eyebrow">
                নমুনা ·{" "}
                {priority === 3
                  ? "জরুরি"
                  : priority === 2
                    ? "গুরুত্বপূর্ণ"
                    : "সাধারণ"}
              </span>
              {title && <strong>{title}</strong>}
              <p>{body || "ঘোষণার লেখা এখানে দেখা যাবে।"}</p>
              {dismissible && <small className="muted">সরিয়ে রাখা যাবে</small>}
            </div>
          </>
        )}
        <div className="community-editor-bottom">
          <label className="check">
            <input
              type="checkbox"
              name="active"
              defaultChecked={entry?.active ?? true}
            />
            সক্রিয় রাখি
          </label>
          {kind !== "announcements" &&
            field(
              "position",
              "ক্রম",
              <input
                type="number"
                name="position"
                min="0"
                max="9999"
                defaultValue={entry?.position ?? 0}
              />,
            )}
          <button className="button button-primary" disabled={pending}>
            {pending ? "একটু…" : entry ? "বদল রাখি" : "যোগ করি"}
          </button>
        </div>
      </FeedbackForm>
    </div>
  );
}
