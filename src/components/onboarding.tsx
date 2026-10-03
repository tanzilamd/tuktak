"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { mutate } from "@/app/actions";
import { EDUCATION, HOBBIES, ACCENTS, bn } from "@/lib/config";
import type { Profile } from "@/lib/types";
export function Onboarding({ profile }: { profile: Profile }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    display_name: profile.display_name,
    username: profile.username,
    bio: profile.bio,
    education: profile.education,
    institution: "",
    institution_visible: false,
    class_year: "",
    ssc_batch: "",
    hsc_batch: "",
    hobbies: profile.hobbies,
    status: profile.status,
    accent: profile.accent,
    discoverable: profile.discoverable,
  });
  const [state, submit, pending] = useActionState(mutate, {
    ok: false,
    message: "",
  });
  const update = (key: string, value: string | boolean | string[]) =>
    setValues((v) =>
      key === "education"
        ? {
            ...v,
            education: String(value),
            institution: "",
            institution_visible: false,
            class_year: "",
            ssc_batch: "",
            hsc_batch: "",
          }
        : { ...v, [key]: value },
    );
  const school = [EDUCATION[0], EDUCATION[2]].includes(
    values.education as (typeof EDUCATION)[0],
  );
  const college = values.education === EDUCATION[1];
  const uni = values.education === EDUCATION[3];
  const admission = values.education === EDUCATION[4];
  const input = (
    key:
      | "display_name"
      | "username"
      | "bio"
      | "institution"
      | "class_year"
      | "ssc_batch"
      | "hsc_batch"
      | "status",
    label: string,
    max: number,
    required = false,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        value={values[key]}
        onChange={(e) => update(key, e.target.value)}
        maxLength={max}
        required={required}
        pattern={key === "username" ? "[A-Za-z0-9_]{3,20}" : undefined}
      />
    </label>
  );
  return (
    <form action={submit} className="stack onboarding-form">
      <input type="hidden" name="action" value="profile" />
      <input type="hidden" name="onboarding" value="true" />
      {Object.entries(values)
        .filter(([k]) => k !== "hobbies")
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={String(v)} />
        ))}
      {values.hobbies.map((h) => (
        <input key={h} type="hidden" name="hobbies" value={h} />
      ))}
      <ol className="onboarding-steps" aria-label="পরিচয়ের ধাপ">
        {["পরিচয়", "পড়াশোনা", "নিজের পথ", "ভালো লাগা"].map((label, i) => (
          <li
            key={label}
            className={i === step ? "active" : i < step ? "done" : ""}
            aria-current={i === step ? "step" : undefined}
          >
            <span>{bn(i + 1)}</span>
            {label}
          </li>
        ))}
      </ol>
      <section key={step} className="stack wizard-step">
        {step === 0 && (
          <>
            <h2>তোমাকে কী নামে ডাকব?</h2>
            {input("display_name", "ডাকনাম", 40, true)}
            {input("username", "Username", 20, true)}
            {input("bio", "একটু নিজের কথা · ঐচ্ছিক", 100)}
            <div className="privacy-note">
              <p>
                তোমার ব্যক্তিগত মোবাইল নম্বর registration-এ রাখা হয়েছে। শুধু{" "}
                <Link href="/settings">নিজের settings</Link>-এ দেখা বা বদলানো
                যাবে।
              </p>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2>তোমার পথ, তোমার গল্প।</h2>
            <label className="field">
              <span>এখন কোথায় আছ?</span>
              <select
                value={values.education}
                onChange={(e) => update("education", e.target.value)}
              >
                <option value="">এখন না</option>
                {EDUCATION.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </label>
            <p className="muted">
              কোনো প্রতিষ্ঠানের নাম দরকার নেই। যে অবস্থায় আছ, সেখান থেকেই আড্ডা
              শুরু।
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <h2>
              {school || college || uni
                ? "আরেকটু বলবে?"
                : "নিজের গতিতে, নিজের পথে।"}
            </h2>
            {school || college || uni ? (
              <>
                {input("institution", "প্রতিষ্ঠান · ঐচ্ছিক", 100)}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={values.institution_visible}
                    onChange={(e) =>
                      update("institution_visible", e.target.checked)
                    }
                  />{" "}
                  প্রোফাইলে দেখাও ও প্রতিষ্ঠানের আড্ডায় যোগ দাও
                </label>
                {input(
                  "class_year",
                  uni ? "বর্ষ / সেমিস্টার · ঐচ্ছিক" : "ক্লাস · ঐচ্ছিক",
                  40,
                )}
              </>
            ) : (
              <p className="muted">
                একটা institution দিয়ে তোমাকে বোঝানো যায় না। এই ধাপে কিছু পূরণ না
                করলেও হবে। 🌱
              </p>
            )}
            {school && input("ssc_batch", "SSC batch · ঐচ্ছিক", 4)}
            {(college || admission) &&
              input("hsc_batch", "HSC batch · ঐচ্ছিক", 4)}
          </>
        )}
        {step === 3 && (
          <>
            <h2>যা যা ভালো লাগে।</h2>
            <p className="muted small">
              সর্বোচ্চ ৫টা বেছে নাও · {bn(values.hobbies.length)} / ৫
            </p>
            <div className="hobby-picker">
              {HOBBIES.map((h) => (
                <label
                  key={h}
                  className={`chip ${values.hobbies.includes(h) ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={values.hobbies.includes(h)}
                    disabled={
                      !values.hobbies.includes(h) && values.hobbies.length >= 5
                    }
                    onChange={(e) =>
                      update(
                        "hobbies",
                        e.target.checked
                          ? [...values.hobbies, h]
                          : values.hobbies.filter((v) => v !== h),
                      )
                    }
                  />
                  {h}
                </label>
              ))}
            </div>
            {input("status", "ছোট্ট emoji / status · ঐচ্ছিক", 12)}
            <label className="field">
              <span>তোমার রং</span>
              <select
                value={values.accent}
                onChange={(e) => update("accent", e.target.value)}
              >
                {ACCENTS.map((a, i) => (
                  <option key={a} value={a}>
                    {["আমের রোদ", "পুদিনা", "জামরং", "আকাশ"][i]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </section>
      <div className="wizard-actions">
        {step > 0 && (
          <button
            className="button"
            type="button"
            onClick={() => setStep(step - 1)}
          >
            ← আগের ধাপ
          </button>
        )}
        {step < 3 ? (
          <>
            <button
              className="button button-primary"
              type="button"
              onClick={(e) => {
                if (e.currentTarget.form?.reportValidity()) setStep(step + 1);
              }}
            >
              পরের ধাপ →
            </button>
            {step > 0 && (
              <button
                className="skip-step"
                type="button"
                onClick={() => setStep(step + 1)}
              >
                এখন না
              </button>
            )}
          </>
        ) : (
          <button
            className="button button-primary"
            type="submit"
            disabled={pending}
          >
            {pending ? "রাখছি…" : "এবার আড্ডায় যাই"}
          </button>
        )}
      </div>
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className="form-message danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
