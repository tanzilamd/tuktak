import { SITE_URL } from "./config";

export type ShareTarget = { kind: "post" | "profile"; id: string };
export type ShareResult = "shared" | "copied" | "cancelled" | "manual";
type ShareBrowser = {
  share?: Navigator["share"];
  canShare?: Navigator["canShare"];
  clipboard?: Pick<Clipboard, "writeText">;
};

export function publicShareUrl({ kind, id }: ShareTarget) {
  return new URL(
    kind === "post"
      ? `/post/${encodeURIComponent(id)}`
      : `/u/${encodeURIComponent(id.toLowerCase())}`,
    SITE_URL,
  ).href;
}

export async function sharePublicLink(
  url: string,
  browser: ShareBrowser,
): Promise<ShareResult> {
  const data: ShareData = { text: "টুকটাকে দেখো", url };
  if (typeof browser.share === "function") {
    try {
      if (!browser.canShare || browser.canShare(data)) {
        await browser.share(data);
        return "shared";
      }
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError"
      )
        return "cancelled";
      // Unsupported/denied sharing still has a useful, non-destructive fallback.
    }
  }
  try {
    if (!browser.clipboard) return "manual";
    await browser.clipboard.writeText(url);
    return "copied";
  } catch {
    return "manual";
  }
}
