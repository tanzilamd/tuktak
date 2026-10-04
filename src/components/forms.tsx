"use client";
import { useActionState, useState, useRef, useId, type ReactNode } from "react";
import { mutate, authenticate } from "@/app/actions";
import {
  ACCENTS,
  EDUCATION,
  HOBBIES,
  MOODS,
  REPORT_REASONS,
  bn,
  charCount,
} from "@/lib/config";
import type { ActionState, Profile } from "@/lib/types";
import { Send, Check, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Captcha } from "./captcha";
import { useInteraction, type InteractionCallbacks } from "./interaction";
import { useFollowScope } from "./follow-state";
import { readSocial } from "@/lib/social";
const initial: ActionState = { ok: false, message: "" };
export function Result({ state }: { state: ActionState }) {
  return state.message ? (
    <p
      role={state.ok ? "status" : "alert"}
      className={`form-message ${state.ok ? "success" : "danger"}`}
    >
      {state.message}
    </p>
  ) : null;
}
export function Mutation({
  action,
  values = {},
  children,
  label = "ঠিক আছে",
  className = "",
  confirm,
  pressed,
  ariaLabel,
  interaction,
  disabled = false,
}: {
  action: string;
  values?: Record<string, string | boolean>;
  children?: ReactNode;
  label?: string;
  className?: string;
  confirm?: string;
  pressed?: boolean;
  ariaLabel?: string;
  interaction?: InteractionCallbacks;
  disabled?: boolean;
}) {
  const [serverState, submit, serverPending] = useActionState(mutate, initial);
  const core = ["react", "follow", "delete_post", "delete_comment"].includes(
    action,
  );
  const [follow, setFollow] = useState({
    source: pressed,
    value: pressed ?? false,
  });
  const following =
    follow.source === pressed ? follow.value : (pressed ?? false);
  const previousRef = useRef(following);
  const scope = useFollowScope();
  const social = useInteraction({
    start(form) {
      if (action === "follow") {
        previousRef.current = following;
        const enabled = form.get("enabled") === "true";
        setFollow({ source: pressed, value: enabled });
        if (scope?.id === values.id) scope.start(enabled);
      }
      return interaction?.start?.(form);
    },
    async settle(result) {
      if (action === "follow") {
        setFollow({
          source: pressed,
          value: result.ok
            ? (result.following ?? previousRef.current)
            : previousRef.current,
        });
        if (scope?.id === values.id) scope.settle(result);
        if (result.uncertain) {
          const fresh = await readSocial({ follow: String(values.id) });
          if (fresh.ok) {
            setFollow({
              source: pressed,
              value: fresh.following ?? previousRef.current,
            });
            if (scope?.id === values.id) scope.settle(fresh);
          }
        }
      }
      await interaction?.settle?.(result);
    },
  });
  const state = core ? social.state : serverState;
  const pending = core ? social.pending : serverPending;
  const displayedValues =
    action === "follow" ? { ...values, enabled: !following } : values;
  const displayedLabel =
    action === "follow" ? (following ? "সাথে আছি ✓" : "সাথে থাকি +") : label;
  return (
    <form
      action={submit}
      onSubmit={(e) => {
        if (disabled || pending) {
          e.preventDefault();
          return;
        }
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        if (core) {
          e.preventDefault();
          void social.run(new FormData(e.currentTarget));
        }
      }}
      className={`mutation ${className}`}
    >
      <input type="hidden" name="action" value={action} />
      {Object.entries(displayedValues).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={String(value)} />
      ))}
      {children}
      <button
        disabled={pending || disabled}
        aria-pressed={action === "follow" ? following : pressed}
        aria-label={ariaLabel}
        className={
          className.includes("reaction")
            ? "reaction-button"
            : "button button-small button-quiet"
        }
        type="submit"
      >
        {pending && !core ? "একটু…" : displayedLabel}
      </button>
      <Result state={state} />
    </form>
  );
}
export function Composer({
  prompt = "",
  replyTo,
  standalone = false,
  interaction,
  disabled = false,
}: {
  prompt?: string;
  replyTo?: string;
  standalone?: boolean;
  interaction?: InteractionCallbacks;
  disabled?: boolean;
}) {
  const [body, setBody] = useState(prompt);
  const [mood, setMood] = useState("");
  const [serverState, submit, serverPending] = useActionState(
    async (prev: ActionState, data: FormData) => {
      const result = await mutate(prev, data);
      if (result.ok) {
        setBody("");
        setMood("");
      }
      return result;
    },
    initial,
  );
  const draftRef = useRef({ body, mood });
  const social = useInteraction({
    start(form) {
      if (interaction?.start?.(form) === false) return false;
      draftRef.current = { body, mood };
      setBody("");
      setMood("");
    },
    async settle(result) {
      if (!result.ok) {
        setBody(draftRef.current.body);
        setMood(draftRef.current.mood);
      }
      await interaction?.settle?.(result);
    },
  });
  const immediate = !!interaction && !standalone;
  const pending = immediate ? social.pending : serverPending;
  const state = immediate ? social.state : serverState;
  const max = replyTo ? 180 : 240;
  const count = charCount(body);
  return (
    <form
      action={submit}
      onSubmit={(event) => {
        if (pending || disabled) {
          event.preventDefault();
          return;
        }
        if (immediate) {
          event.preventDefault();
          void social.run(new FormData(event.currentTarget));
        }
      }}
      className={`composer ${replyTo ? "reply-composer" : "card"}`}
    >
      <input type="hidden" name="action" value={replyTo ? "comment" : "post"} />
      {replyTo && <input type="hidden" name="id" value={replyTo} />}
      {standalone && <input type="hidden" name="redirect" value="true" />}
      <label
        htmlFor={replyTo ? "reply" : "post-body"}
        className="composer-heading"
      >
        {replyTo ? "কথায় কথা বাড়ুক" : "মাথায় কী ঘুরছে?"}{" "}
        <span>{replyTo ? "💬" : "✦"}</span>
      </label>
      <textarea
        id={replyTo ? "reply" : "post-body"}
        name="body"
        readOnly={pending}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          replyTo ? "প্রথম কথাটা তুমি বলবে?" : "আজকের আজাইরা ভাবনা কী?"
        }
        rows={replyTo ? 2 : 3}
        required
        aria-describedby="composer-count"
      />
      <div className="composer-bottom">
        {!replyTo ? (
          <label className="mood-select">
            <span>মুড</span>
            <select
              aria-label="মুড বেছে নাও"
              name="mood"
              disabled={pending}
              value={mood}
              onChange={(e) => setMood(e.target.value)}
            >
              <option value="">আজকে যেমন</option>
              {MOODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
        <div className="composer-submit">
          <span
            id="composer-count"
            aria-live="polite"
            className={`counter ${count > max ? "danger" : ""}`}
          >
            {bn(count)} / {bn(max)}
          </span>
          <button
            className="button button-primary"
            type="submit"
            disabled={disabled || pending || !body.trim() || count > max}
          >
            {pending ? "যাচ্ছে…" : replyTo ? "উত্তর দিই" : "বলে ফেলি"}
            <Send size={16} />
          </button>
        </div>
      </div>
      <Result state={state} />
    </form>
  );
}
export function AuthForm({
  kind,
  next = "/",
}: {
  kind: "login" | "signup" | "forgot" | "update_password";
  next?: string;
}) {
  const [state, submit, pending] = useActionState(authenticate, initial);
  const signup = kind === "signup";
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return (
    <form action={submit} className="stack">
      <input name="action" type="hidden" value={kind} />
      <input name="next" type="hidden" value={next} />
      {signup && (
        <>
          <Field
            label="তোমাকে কী নামে ডাকব?"
            name="display_name"
            autoComplete="name"
            required
            maxLength={40}
          />
          <Field
            label="Username"
            name="username"
            hint="৩–২০টি ইংরেজি অক্ষর, সংখ্যা বা _"
            autoComplete="username"
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]{3,20}"
            required
          />
        </>
      )}
      {kind !== "update_password" && (
        <Field
          label="ইমেইল"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      )}
      {signup && (
        <Field
          label="ব্যক্তিগত মোবাইল নম্বর"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          hint="শুধু তোমার অ্যাকাউন্টে থাকবে। কাউকে দেখানো বা খুঁজতে দেওয়া হবে না।"
          required
        />
      )}
      {kind !== "forgot" && (
        <Field
          label={kind === "update_password" ? "নতুন password" : "Password"}
          name="password"
          type="password"
          autoComplete={kind === "login" ? "current-password" : "new-password"}
          minLength={10}
          maxLength={128}
          hint="অন্তত ১০ অক্ষর; দীর্ঘ ও আলাদা password বেছে নাও।"
          required
        />
      )}
      {key && kind !== "update_password" && <Captcha siteKey={key} />}
      {signup && (
        <p className="muted small">
          যোগ দিলে আমাদের <Link href="/community">আড্ডার নিয়ম</Link> ও{" "}
          <Link href="/privacy">গোপনীয়তা নীতি</Link> মেনে নিচ্ছ।
        </p>
      )}
      <button
        type="submit"
        className="button button-primary button-wide"
        disabled={pending}
      >
        {pending
          ? "একটু অপেক্ষা…"
          : signup
            ? "আড্ডায় যোগ দিই"
            : kind === "login"
              ? "ঢুকে পড়ি"
              : kind === "forgot"
                ? "লিংক পাঠাও"
                : "Password বদলাই"}
        <ArrowRight size={18} />
      </button>
      <Result state={state} />
    </form>
  );
}
function Field({
  label,
  hint,
  ...props
}: {
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function ProfileForm({
  profile,
  privateData,
  onboarding = false,
}: {
  profile: Profile;
  privateData: { institution: string; institution_visible: boolean };
  onboarding?: boolean;
}) {
  const [education, setEducation] = useState(profile.education);
  const [hobbies, setHobbies] = useState(profile.hobbies);
  const [state, submit, pending] = useActionState(mutate, initial);
  const school = education === EDUCATION[0] || education === EDUCATION[2];
  const college = education === EDUCATION[1];
  const uni = education === EDUCATION[3];
  const admission = education === EDUCATION[4];
  const institutional = school || college || uni;
  return (
    <form action={submit} className="stack profile-form">
      <input type="hidden" name="action" value="profile" />
      <input type="hidden" name="onboarding" value={String(onboarding)} />
      <div className="form-grid">
        <Field
          label="ডাকনাম / display name"
          name="display_name"
          defaultValue={profile.display_name}
          maxLength={40}
          required
        />
        <Field
          label="Username"
          name="username"
          defaultValue={profile.username}
          pattern="[A-Za-z0-9_]{3,20}"
          required
          hint="৩–২০টি ইংরেজি অক্ষর, সংখ্যা বা _"
        />
      </div>
      <label className="field">
        <span>
          নিজের কথা <small>১০০ অক্ষর</small>
        </span>
        <textarea
          name="bio"
          defaultValue={profile.bio}
          maxLength={100}
          rows={2}
        />
      </label>
      <fieldset>
        <legend>
          পড়াশোনার গল্প <span className="muted">· চাইলে বলো</span>
        </legend>
        <label className="field">
          <span>এখন কোথায় আছ?</span>
          <select
            name="education"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
          >
            <option value="">এখন না</option>
            {EDUCATION.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        {institutional ? (
          <>
            <Field
              label="প্রতিষ্ঠান · পুরোপুরি ঐচ্ছিক"
              name="institution"
              defaultValue={privateData.institution}
              maxLength={100}
            />
            <label className="check">
              <input
                type="checkbox"
                name="institution_visible"
                defaultChecked={privateData.institution_visible}
              />{" "}
              প্রোফাইলে দেখাও ও প্রতিষ্ঠানের আড্ডায় যোগ দাও
            </label>
            <Field
              label={uni ? "বর্ষ / সেমিস্টার · ঐচ্ছিক" : "ক্লাস · ঐচ্ছিক"}
              name="class_year"
              defaultValue={profile.class_year}
              maxLength={40}
            />
          </>
        ) : (
          <>
            <input type="hidden" name="institution" value="" />
            <input type="hidden" name="class_year" value="" />
            <p className="muted small">
              কোনো প্রতিষ্ঠানে থাকতেই হবে এমন কথা নেই। তোমার জন্যও জায়গা আছে। 🌱
            </p>
          </>
        )}
        {school ? (
          <Field
            label="SSC batch · ঐচ্ছিক"
            name="ssc_batch"
            defaultValue={profile.ssc_batch}
            inputMode="numeric"
            pattern="[12][0-9]{3}|"
            maxLength={4}
          />
        ) : (
          <input type="hidden" name="ssc_batch" value="" />
        )}
        {college || admission ? (
          <Field
            label="HSC batch · ঐচ্ছিক"
            name="hsc_batch"
            defaultValue={profile.hsc_batch}
            inputMode="numeric"
            pattern="[12][0-9]{3}|"
            maxLength={4}
          />
        ) : (
          <input type="hidden" name="hsc_batch" value="" />
        )}
      </fieldset>
      <fieldset>
        <legend>
          যা যা ভালো লাগে <small>সর্বোচ্চ ৫টা · {bn(hobbies.length)} / ৫</small>
        </legend>
        <div className="hobby-picker">
          {HOBBIES.map((h) => (
            <label
              key={h}
              className={`chip ${hobbies.includes(h) ? "selected" : ""}`}
            >
              <input
                type="checkbox"
                name="hobbies"
                value={h}
                checked={hobbies.includes(h)}
                disabled={!hobbies.includes(h) && hobbies.length >= 5}
                onChange={(e) =>
                  setHobbies(
                    e.target.checked
                      ? [...hobbies, h]
                      : hobbies.filter((v) => v !== h),
                  )
                }
              />
              {hobbies.includes(h) && <Check size={12} />} {h}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-grid">
        <Field
          label="ছোট্ট emoji / status"
          name="status"
          defaultValue={profile.status}
          maxLength={12}
        />
        <label className="field">
          <span>তোমার রং</span>
          <select name="accent" defaultValue={profile.accent}>
            {ACCENTS.map((a, i) => (
              <option value={a} key={a}>
                {["আমের রোদ", "পুদিনা", "জামরং", "আকাশ"][i]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="discoverable"
          defaultChecked={profile.discoverable}
        />{" "}
        খুঁজে দেখি পাতায় আমাকে পাওয়া যাবে
      </label>
      <div className="privacy-note">
        <ShieldCheck size={20} />
        <p>
          ইমেইল আর মোবাইল নম্বর কখনো পাবলিক প্রোফাইলে যায় না। প্রতিষ্ঠান দেখানোর
          সিদ্ধান্ত তোমার।
        </p>
      </div>
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "রাখছি…" : onboarding ? "এবার আড্ডায় যাই" : "পরিবর্তন রাখি"}
        <Check size={16} />
      </button>
      <Result state={state} />
    </form>
  );
}
export function ReportForm({ id, type }: { id: string; type: string }) {
  const [state, submit, pending] = useActionState(mutate, initial);
  return (
    <form action={submit} className="stack">
      <input type="hidden" name="action" value="report" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="target_type" value={type} />
      <label className="field">
        <span>কী হয়েছে?</span>
        <select name="reason">
          {REPORT_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>আরেকটু বলবে? · ঐচ্ছিক</span>
        <textarea name="notes" maxLength={500} rows={4} />
        <small>সর্বোচ্চ ৫০০ অক্ষর। ব্যক্তিগত তথ্য লিখো না।</small>
      </label>
      <p className="muted small">
        কে রিপোর্ট করেছে তা অন্য ব্যবহারকারীদের দেখানো হয় না।
      </p>
      <button className="button button-primary" disabled={pending}>
        রিপোর্ট পাঠাই
      </button>
      <Result state={state} />
    </form>
  );
}
export function PrivatePhoneForm({ phone }: { phone: string }) {
  const [state, submit, pending] = useActionState(mutate, initial);
  return (
    <form action={submit} className="stack">
      <input type="hidden" name="action" value="phone" />
      <Field
        label="ব্যক্তিগত মোবাইল নম্বর"
        name="phone"
        defaultValue={phone}
        type="tel"
        required
        hint="নম্বরটি যাচাই করা হয়নি। V1-এ OTP নেই।"
      />
      <button disabled={pending} className="button button-small">
        নম্বর রাখি
      </button>
      <Result state={state} />
    </form>
  );
}
