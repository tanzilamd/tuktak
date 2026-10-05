"use client";
import { useCallback, useRef, useState, type SyntheticEvent } from "react";

// Read the visible value, not React's change-tracker history. Browsers can restore
// or edit server-rendered text before hydration, and composition can end without
// a final change event. Never rewrite/truncate the DOM or interrupt composition.
export function useBodyInput(initial: string) {
  const [body, setBody] = useState(initial);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attach = useCallback((input: HTMLTextAreaElement | null) => {
    inputRef.current = input;
    if (input) setBody(input.value);
  }, []);
  const sync = useCallback((event: SyntheticEvent<HTMLTextAreaElement>) => {
    setBody(event.currentTarget.value);
  }, []);
  return {
    body,
    setBody,
    inputRef,
    inputProps: {
      ref: attach,
      onChange: sync,
      onInput: sync,
      onCompositionEnd: sync,
    },
  };
}
