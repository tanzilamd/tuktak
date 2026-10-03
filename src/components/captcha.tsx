"use client";
import Script from "next/script";
import { useEffect, useRef } from "react";
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: { sitekey: string; theme: string; size: string },
      ) => string;
      remove: (id: string) => void;
    };
  }
}
export function Captcha({ siteKey }: { siteKey: string }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (widgetRef.current && window.turnstile)
        window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    },
    [],
  );
  const render = () => {
    if (elementRef.current && window.turnstile && !widgetRef.current)
      widgetRef.current = window.turnstile.render(elementRef.current, {
        sitekey: siteKey,
        theme: "auto",
        size: "flexible",
      });
  };
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={render}
      />
      <div ref={elementRef} aria-label="নিরাপত্তা যাচাই" />
    </>
  );
}
