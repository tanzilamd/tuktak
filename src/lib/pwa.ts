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
type InstallPlatform = Pick<
  Navigator,
  "userAgent" | "platform" | "maxTouchPoints"
> & { userAgentData?: { platform?: string; mobile?: boolean } };
function iosDevice({ userAgent, platform, maxTouchPoints }: InstallPlatform) {
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    /^(iPhone|iPad|iPod)$/.test(platform) ||
    (platform === "MacIntel" &&
      maxTouchPoints > 1 &&
      /Safari/.test(userAgent) &&
      !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(userAgent))
  );
}
// Platform signals identify phones/tablets; an actual browser opportunity
// supplies install capability separately. Touch or viewport width alone cannot.
export function mobileInstallDevice(navigator: InstallPlatform) {
  return (
    iosDevice(navigator) ||
    /Android/i.test(navigator.userAgent) ||
    /Android/i.test(navigator.platform) ||
    navigator.userAgentData?.platform === "Android" ||
    (navigator.userAgentData?.mobile === true &&
      !/Windows|macOS|Chrome OS/i.test(
        navigator.userAgentData.platform ?? navigator.platform,
      ))
  );
}
export function iosSafari({
  userAgent,
  platform,
  maxTouchPoints,
}: InstallPlatform) {
  const ios = iosDevice({ userAgent, platform, maxTouchPoints });
  return (
    ios &&
    /Safari/.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|FBAN|FBAV|Instagram|GSA\//.test(
      userAgent,
    )
  );
}
