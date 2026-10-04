import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import manifest from "../src/app/manifest";
import {
  DISMISS_DURATION,
  INSTALL_PREFERENCE,
  installSuppressed,
  iosSafari,
  mobileInstallDevice,
  saveInstallPreference,
} from "../src/lib/pwa";

describe("install preferences and supported instructions", () => {
  it.each([
    [
      "Android phone",
      "Android Mobile Chrome Safari",
      "Linux armv8l",
      5,
      undefined,
      true,
    ],
    [
      "Android tablet",
      "Android Chrome Safari",
      "Linux aarch64",
      10,
      { platform: "Android", mobile: false },
      true,
    ],
    [
      "Android reduced agent",
      "Chrome Safari",
      "Linux",
      5,
      { platform: "Android", mobile: false },
      true,
    ],
    [
      "Android platform fallback",
      "Chrome Safari",
      "Android",
      5,
      undefined,
      true,
    ],
    [
      "mobile client hints",
      "Chrome Safari",
      "Linux",
      5,
      { mobile: true },
      true,
    ],
    ["iPhone", "iPhone Mobile Safari", "iPhone", 5, undefined, true],
    ["iPad", "iPad Safari", "iPad", 5, undefined, true],
    [
      "desktop-like iPadOS",
      "Macintosh Version/18 Safari",
      "MacIntel",
      5,
      undefined,
      true,
    ],
    [
      "Windows touchscreen",
      "Windows Chrome Safari",
      "Win32",
      10,
      { platform: "Windows", mobile: false },
      false,
    ],
    ["Windows Edge", "Windows Edg Safari", "Win32", 0, undefined, false],
    ["Mac laptop", "Macintosh Safari", "MacIntel", 0, undefined, false],
    [
      "Mac Chrome with touch",
      "Macintosh Chrome/153.0 Safari/537.36",
      "MacIntel",
      5,
      { platform: "macOS", mobile: false },
      false,
    ],
    [
      "Linux touchscreen",
      "Linux Chrome Safari",
      "Linux x86_64",
      10,
      undefined,
      false,
    ],
    [
      "ChromeOS tablet",
      "CrOS Chrome Safari",
      "Linux x86_64",
      10,
      { platform: "Chrome OS", mobile: false },
      false,
    ],
  ])(
    "classifies %s without viewport or touch-only guessing",
    (_name, userAgent, platform, maxTouchPoints, userAgentData, expected) => {
      expect(
        mobileInstallDevice({
          userAgent,
          platform,
          maxTouchPoints,
          userAgentData,
        }),
      ).toBe(expected);
    },
  );
  it("remembers dismissal for 30 days and installation without storing account data", () => {
    let value = "";
    const storage = {
      getItem: vi.fn(() => value),
      setItem: vi.fn((key, input) => {
        expect(key).toBe(INSTALL_PREFERENCE);
        value = input;
      }),
    };
    expect(installSuppressed(storage, 100)).toBe(false);
    saveInstallPreference(storage, "dismissed", 100);
    expect(installSuppressed(storage, 100 + DISMISS_DURATION - 1)).toBe(true);
    expect(installSuppressed(storage, 100 + DISMISS_DURATION)).toBe(false);
    saveInstallPreference(storage, "installed", 100);
    expect(installSuppressed(storage, 100 + DISMISS_DURATION * 20)).toBe(true);
    expect(JSON.parse(value)).toEqual({ kind: "installed" });
  });
  it("handles blocked/malformed storage without breaking the app", () => {
    expect(installSuppressed({ getItem: () => "broken" })).toBe(false);
    expect(
      installSuppressed({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(false);
    expect(() =>
      saveInstallPreference(
        {
          setItem: () => {
            throw new Error("blocked");
          },
        },
        "dismissed",
      ),
    ).not.toThrow();
  });
  it.each([
    ["iPhone AppleWebKit Version/18.0 Mobile Safari/604.1", "iPhone", 5, true],
    ["Macintosh AppleWebKit Version/18.0 Safari/605.1", "MacIntel", 5, true],
    ["Macintosh AppleWebKit Version/18.0 Safari/605.1", "MacIntel", 0, false],
    ["iPhone CriOS/153.0 Mobile Safari/604.1", "iPhone", 5, false],
    ["iPhone AppleWebKit Mobile", "iPhone", 5, false],
    ["iPhone AppleWebKit Mobile Safari/604.1 Instagram", "iPhone", 5, false],
    ["Linux Android Chrome/153.0 Mobile Safari/537.36", "Linux", 5, false],
  ])(
    "recognizes appropriate iOS Safari scenarios: %s",
    (userAgent, platform, maxTouchPoints, expected) => {
      expect(iosSafari({ userAgent, platform, maxTouchPoints })).toBe(expected);
    },
  );
});
it("manifest uses current branding, production identity and standard/maskable PNG icons", () => {
  const app = manifest();
  expect(app).toMatchObject({
    name: "টুকটাক",
    short_name: "টুকটাক",
    display: "standalone",
    id: "https://tuktakbd.vercel.app/",
    scope: "https://tuktakbd.vercel.app/",
    start_url: "https://tuktakbd.vercel.app/",
    lang: "bn",
    theme_color: "#f8f6f1",
    background_color: "#f8f6f1",
  });
  expect(app.icons?.map((icon) => [icon.sizes, icon.purpose])).toEqual([
    ["192x192", "any"],
    ["512x512", "any"],
    ["512x512", "maskable"],
  ]);
  for (const icon of app.icons ?? []) {
    const file = readFileSync(`public${icon.src}`);
    expect(file.subarray(1, 4).toString()).toBe("PNG");
    expect(file.readUInt32BE(16)).toBe(Number(icon.sizes?.split("x")[0]));
    expect(file.readUInt32BE(20)).toBe(Number(icon.sizes?.split("x")[1]));
  }
  expect(JSON.stringify(app)).not.toMatch(/localhost|token|phone|session/);
});

function worker(network = vi.fn(async () => new Response("fresh"))) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const fallback = new Response("generic offline");
  const match = vi.fn(async () => fallback);
  const addAll = vi.fn(async () => {});
  const open = vi.fn(async () => ({ match, addAll }));
  const remove = vi.fn(async () => true);
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn(async () => {});
  // Resolve relative precache URLs as a browser worker does.
  class WorkerRequest extends Request {
    constructor(input: string, init?: RequestInit) {
      super(new URL(input, "https://tuktakbd.vercel.app"), init);
    }
  }
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      location: { origin: "https://tuktakbd.vercel.app" },
      addEventListener: (type: string, callback: (event: unknown) => void) => {
        listeners[type] = callback;
      },
      clients: { claim },
      skipWaiting,
    },
    caches: {
      open,
      keys: async () => [
        "tuktak-offline-old",
        "tuktak-offline-v1",
        "unrelated-cache",
      ],
      delete: remove,
    },
    Request: WorkerRequest,
    Response,
    URL,
    fetch: network,
  });
  function fetchEvent(path: string, overrides = {}) {
    const respondWith = vi.fn();
    listeners.fetch({
      request: {
        url: new URL(path, "https://tuktakbd.vercel.app").href,
        method: "GET",
        mode: "navigate",
        ...overrides,
      },
      respondWith,
    });
    return respondWith;
  }
  return {
    listeners,
    fetchEvent,
    fallback,
    match,
    addAll,
    open,
    remove,
    claim,
    skipWaiting,
    network,
  };
}
describe("offline-only worker privacy and updates", () => {
  it("precaches only generic offline resources without credentials; activates without reloading", async () => {
    const sw = worker();
    const waitUntil = vi.fn();
    sw.listeners.install({ waitUntil });
    await waitUntil.mock.calls[0][0];
    const requests = sw.addAll.mock.calls[0] as unknown as [Request[]];
    expect(requests[0].map((request) => new URL(request.url).pathname)).toEqual(
      ["/offline/index.html", "/offline/hind-siliguri-bengali-400.woff2"],
    );
    expect(
      requests[0].every(
        (request) =>
          request.credentials === "omit" && request.cache === "reload",
      ),
    ).toBe(true);
    expect(sw.skipWaiting).toHaveBeenCalledOnce();
    waitUntil.mockClear();
    sw.listeners.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(sw.remove.mock.calls).toEqual([["tuktak-offline-old"]]);
    expect(sw.claim).toHaveBeenCalledOnce();
  });
  it.each([
    "/login",
    "/signup",
    "/auth/callback?code=secret",
    "/reset-password",
    "/forgot-password",
    "/verify-email",
    "/settings",
    "/notifications",
    "/onboarding",
    "/admin",
    "/api/social",
    "https://guqzypztckfnapmptjpu.supabase.co/auth/v1/user",
  ])("does not intercept protected/API/Auth navigation %s", (path) => {
    const sw = worker();
    expect(sw.fetchEvent(path)).not.toHaveBeenCalled();
    expect(sw.network).not.toHaveBeenCalled();
    expect(sw.open).not.toHaveBeenCalled();
  });
  it("does not intercept mutations, assets or personalized RSC fetches", () => {
    const sw = worker();
    expect(sw.fetchEvent("/", { method: "POST" })).not.toHaveBeenCalled();
    expect(
      sw.fetchEvent("/?_rsc=personal", { mode: "cors" }),
    ).not.toHaveBeenCalled();
    expect(
      sw.fetchEvent("/_next/static/app.js", { mode: "cors" }),
    ).not.toHaveBeenCalled();
  });
  it("passes the exact navigation request to the network and never caches HTML", async () => {
    const sw = worker();
    const response = sw.fetchEvent("/u/someone");
    expect(await response.mock.calls[0][0]).toBeInstanceOf(Response);
    expect(sw.network).toHaveBeenCalledOnce();
    expect(sw.open).not.toHaveBeenCalled();
  });
  it("preserves server authorization/error responses instead of replacing them", async () => {
    const denial = new Response("denied", { status: 403 });
    const sw = worker(vi.fn(async () => denial));
    expect(await sw.fetchEvent("/post/example").mock.calls[0][0]).toBe(denial);
    expect(sw.open).not.toHaveBeenCalled();
  });
  it("uses a generic fallback only after a navigation network failure; font stays available offline", async () => {
    const sw = worker(
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await sw.fetchEvent("/").mock.calls[0][0]).toBe(sw.fallback);
    expect(sw.match).toHaveBeenCalledWith("/offline/index.html");
    expect(
      await sw.fetchEvent("/offline/hind-siliguri-bengali-400.woff2", {
        mode: "cors",
      }).mock.calls[0][0],
    ).toBe(sw.fallback);
    expect(sw.network).toHaveBeenCalledOnce();
  });
});
