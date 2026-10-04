"use client";
import { useId } from "react";
import { useInstall } from "./pwa-provider";
export function InstallCard() {
  const { mode, pending, install, dismiss } = useInstall();
  const titleId = useId();
  function focusFeed() {
    document
      .querySelector<HTMLAnchorElement>(".feed-tabs a[aria-current='page']")
      ?.focus({ preventScroll: true });
  }
  if (!mode) return null;
  return (
    <section className="card install-card" aria-labelledby={titleId}>
      <div className="install-copy">
        <h2 id={titleId}>টুকটাক ফোনে রাখুন</h2>
        <p className="muted">হোম স্ক্রিন থেকে এক ট্যাপে খুলুন।</p>
        {mode === "ios" && (
          <p className="muted install-instructions">
            Safari-র Share → Add to Home Screen বেছে নিন।
          </p>
        )}
      </div>
      <div className="install-actions">
        {mode === "chromium" && (
          <button
            type="button"
            className="button button-small button-primary"
            disabled={pending}
            onClick={() => void install().then(focusFeed)}
          >
            {pending ? "অপেক্ষা করুন…" : "ইনস্টল করুন"}
          </button>
        )}
        <button
          type="button"
          className="button button-small button-quiet"
          disabled={pending}
          onClick={() => {
            dismiss();
            focusFeed();
          }}
        >
          এখন না
        </button>
      </div>
    </section>
  );
}
