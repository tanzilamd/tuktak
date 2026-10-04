"use client";
import { createContext, use, useEffect, useRef, useState } from "react";
import { installSuppressed, saveInstallPreference } from "@/lib/pwa";
import { iosSafari } from "@/lib/pwa";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const InstallContext = createContext<{
  mode: "chromium" | "ios" | null;
  pending: boolean;
  install: () => Promise<void>;
  dismiss: () => void;
}>({ mode: null, pending: false, install: async () => {}, dismiss: () => {} });
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"chromium" | "ios" | null>(null);
  const [pending, setPending] = useState(false);
  const eventRef = useRef<InstallEvent | null>(null);
  const suppressedRef = useRef(false);
  const installedRef = useRef(false);
  const pendingRef = useRef(false);
  function remember(kind: "installed" | "dismissed") {
    if (installedRef.current && kind !== "installed") return;
    if (kind === "installed") installedRef.current = true;
    suppressedRef.current = true;
    eventRef.current = null;
    setMode(null);
    try {
      saveInstallPreference(localStorage, kind);
    } catch {
      /* Storage can be blocked. */
    }
  }
  useEffect(() => {
    try {
      suppressedRef.current = installSuppressed(localStorage);
    } catch {
      /* Storage can be blocked. */
    }
    const standalone = matchMedia("(display-mode: standalone)");
    const isStandalone = () =>
      standalone.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    function displayChanged() {
      if (isStandalone()) remember("installed");
      else
        setMode(
          suppressedRef.current
            ? null
            : eventRef.current
              ? "chromium"
              : iosSafari(navigator)
                ? "ios"
                : null,
        );
    }
    function opportunity(event: Event) {
      const installEvent = event as InstallEvent;
      if (typeof installEvent.prompt !== "function") return;
      event.preventDefault();
      if (suppressedRef.current || isStandalone()) return;
      eventRef.current = installEvent;
      setMode("chromium");
    }
    function installed() {
      remember("installed");
    }
    const frame = requestAnimationFrame(displayChanged);
    window.addEventListener("beforeinstallprompt", opportunity);
    window.addEventListener("appinstalled", installed);
    standalone.addEventListener("change", displayChanged);
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    let lastCheck = Date.now();
    if (isSecureContext && "serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((value) => {
          if (active) registration = value;
        })
        .catch(() => {
          /* Installation remains progressive enhancement. */
        });
    function foreground() {
      if (
        document.visibilityState === "visible" &&
        registration &&
        Date.now() - lastCheck >= 3600000
      ) {
        lastCheck = Date.now();
        void registration.update().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", foreground);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", opportunity);
      window.removeEventListener("appinstalled", installed);
      standalone.removeEventListener("change", displayChanged);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, []);
  async function install() {
    const event = eventRef.current;
    if (!event || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    eventRef.current = null;
    try {
      // A native prompt is invoked only from the user's button click.
      await event.prompt();
      await event.userChoice;
      // Acceptance starts installation; appinstalled confirms completion.
      remember("dismissed");
    } catch {
      // The one-shot browser event cannot safely be reused after a failure.
      suppressedRef.current = true;
      setMode(null);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return (
    <InstallContext
      value={{ mode, pending, install, dismiss: () => remember("dismissed") }}
    >
      {children}
    </InstallContext>
  );
}
export const useInstall = () => use(InstallContext);
