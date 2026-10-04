export const INSTALL_PREFERENCE = "tuktak-install-preference";
export const DISMISS_DURATION = 30 * 86400000;
export function installSuppressed(
  storage: Pick<Storage, "getItem">,
  now = Date.now(),
) {
  try {
    const preference = JSON.parse(
      storage.getItem(INSTALL_PREFERENCE) ?? "null",
    );
    return (
      preference?.kind === "installed" ||
      (preference?.kind === "dismissed" &&
        typeof preference.until === "number" &&
        preference.until > now)
    );
  } catch {
    return false;
  }
}
export function saveInstallPreference(
  storage: Pick<Storage, "setItem">,
  kind: "installed" | "dismissed",
  now = Date.now(),
) {
  try {
    storage.setItem(
      INSTALL_PREFERENCE,
      JSON.stringify({
        kind,
        ...(kind === "dismissed" ? { until: now + DISMISS_DURATION } : {}),
      }),
    );
  } catch {
    /* A session-local choice still works when storage is unavailable. */
  }
}
export function iosSafari({
  userAgent,
  platform,
  maxTouchPoints,
}: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">) {
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1);
  return (
    ios &&
    /Safari/.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|FBAN|FBAV|Instagram|GSA\//.test(
      userAgent,
    )
  );
}
