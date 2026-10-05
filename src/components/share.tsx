"use client";
import { useId, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import {
  publicShareUrl,
  sharePublicLink,
  type ShareTarget,
  type ShareResult,
} from "@/lib/share";

export type ShareFeedbackState = { result: ShareResult; url: string } | null;

export function ShareButton({
  target,
  onFeedback,
}: {
  target: ShareTarget;
  onFeedback: (state: ShareFeedbackState) => void;
}) {
  const lockRef = useRef(false);
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className="button button-small button-quiet share-button"
      disabled={pending}
      onClick={async (event) => {
        if (lockRef.current) return;
        const summary = event.currentTarget
          .closest("details")
          ?.querySelector<HTMLElement>("summary");
        lockRef.current = true;
        setPending(true);
        onFeedback(null);
        try {
          const url = publicShareUrl(target);
          // Called directly from the click: preserve native user activation.
          const result = await sharePublicLink(url, navigator);
          onFeedback({ result, url });
        } finally {
          lockRef.current = false;
          setPending(false);
          if (summary?.isConnected) summary.focus({ preventScroll: true });
        }
      }}
    >
      <Share2 size={16} aria-hidden="true" /> শেয়ার
    </button>
  );
}

export function ShareFeedback({ state }: { state: ShareFeedbackState }) {
  const id = useId();
  if (!state || state.result === "shared" || state.result === "cancelled")
    return null;
  return (
    <div className="share-feedback">
      <p
        role="status"
        className={`form-message ${state.result === "copied" ? "success" : "muted"}`}
      >
        {state.result === "copied"
          ? "লিংক কপি হয়েছে"
          : "লিংকটা কপি করে শেয়ার করো।"}
      </p>
      {state.result === "manual" && (
        <label className="field" htmlFor={id}>
          <span className="sr-only">শেয়ার করার লিংক</span>
          <input
            id={id}
            readOnly
            value={state.url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </div>
  );
}

export function ProfileShare({ username }: { username: string }) {
  const [state, setState] = useState<ShareFeedbackState>(null);
  return (
    <div className="profile-share">
      <ShareButton
        target={{ kind: "profile", id: username }}
        onFeedback={setState}
      />
      <ShareFeedback state={state} />
    </div>
  );
}
