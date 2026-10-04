"use client";
import { useRef, useState } from "react";
import { requestSocial, socialChanged } from "@/lib/social";
import type { SocialResult } from "@/lib/types";
export type InteractionCallbacks = {
  start?: (form: FormData) => void | boolean;
  settle?: (result: SocialResult) => void | Promise<void>;
};
export function useInteraction(callbacks: InteractionCallbacks = {}) {
  const lockRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<SocialResult>({ ok: false, message: "" });
  async function run(form: FormData) {
    if (lockRef.current) return;
    lockRef.current = true;
    if (callbacks.start?.(form) === false) {
      lockRef.current = false;
      return;
    }
    setPending(true);
    setState({ ok: false, message: "" });
    const id = crypto.randomUUID();
    socialChanged("start", undefined, id);
    try {
      const result = await requestSocial(form);
      setState(result);
      try {
        await callbacks.settle?.(result);
      } finally {
        socialChanged("settled", result, id);
      }
      return result;
    } finally {
      lockRef.current = false;
      setPending(false);
    }
  }
  return { pending, state, run };
}
