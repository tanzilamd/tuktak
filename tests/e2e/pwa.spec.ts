import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function android(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgentData", {
      value: { platform: "Android", mobile: false },
    });
    const state = window as typeof window & { pwaProviderReady?: boolean };
    state.pwaProviderReady = false;
    const register = navigator.serviceWorker.register.bind(
      navigator.serviceWorker,
    );
    navigator.serviceWorker.register = (...args) => {
      // The provider attaches install listeners before registering its worker.
      // Forward the real registration; only the test records initialization.
      state.pwaProviderReady = true;
      return register(...args);
    };
  });
}
async function opportunity(
  page: Page,
  outcome: "accepted" | "dismissed" = "dismissed",
  complete = false,
) {
  // A streamed document can load before its client effect attaches listeners.
  await page.waitForFunction(
    () =>
      (window as typeof window & { pwaProviderReady?: boolean })
        .pwaProviderReady !== false,
  );
  await page.evaluate(
    ({ outcome, complete }) => {
      const state = window as typeof window & { pwaPrompts?: number };
      state.pwaPrompts = 0;
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          state.pwaPrompts!++;
          if (complete) dispatchEvent(new Event("appinstalled"));
        },
        userChoice: Promise.resolve({ outcome }),
      });
      dispatchEvent(event);
    },
    { outcome, complete },
  );
}
async function ready(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}
async function cachePaths(page: Page) {
  return page.evaluate(async () => {
    const paths = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        paths.push(new URL(request.url).pathname);
    return paths.sort();
  });
}
test("phone/tablet opportunities promote install; desktops retain native browser control without a card or gap", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const scenarios = [
    {
      name: "Android phone",
      ua: "Android Mobile Chrome Safari",
      platform: "Linux armv8l",
      touch: 5,
      width: 360,
      hints: undefined,
      shown: true,
    },
    {
      name: "Android tablet/foldable",
      ua: "Android Chrome Safari",
      platform: "Linux aarch64",
      touch: 10,
      width: 1280,
      hints: undefined,
      shown: true,
    },
    {
      name: "Android client hints fallback",
      ua: "Chrome Safari",
      platform: "Linux",
      touch: 5,
      width: 768,
      hints: { platform: "Android", mobile: false },
      shown: true,
    },
    {
      name: "Windows Chrome touchscreen",
      ua: "Windows Chrome Safari",
      platform: "Win32",
      touch: 10,
      width: 320,
      hints: { platform: "Windows", mobile: false },
      shown: false,
    },
    {
      name: "Windows Edge",
      ua: "Windows Chrome Edg Safari",
      platform: "Win32",
      touch: 0,
      width: 1280,
      hints: undefined,
      shown: false,
    },
    {
      name: "macOS laptop",
      ua: "Macintosh Version/18 Safari",
      platform: "MacIntel",
      touch: 0,
      width: 1280,
      hints: undefined,
      shown: false,
    },
    {
      name: "Linux desktop",
      ua: "Linux Chrome Safari",
      platform: "Linux x86_64",
      touch: 0,
      width: 360,
      hints: undefined,
      shown: false,
    },
    {
      name: "Mac desktop Chrome with touch",
      ua: "Macintosh Chrome/153.0 Safari/537.36",
      platform: "MacIntel",
      touch: 5,
      width: 1280,
      hints: { platform: "macOS", mobile: false },
      shown: false,
    },
  ];
  for (const device of scenarios) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: 900 },
    });
    await context.addInitScript(({ ua, platform, touch, hints }) => {
      Object.defineProperties(navigator, {
        userAgent: { value: ua },
        platform: { value: platform },
        maxTouchPoints: { value: touch },
        userAgentData: { value: hints },
      });
    }, device);
    const page = await context.newPage();
    await page.goto("http://localhost:3000/");
    await ready(page);
    const prevented = await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented, device.name).toBe(device.shown);
    await expect(page.locator(".install-card"), device.name).toHaveCount(
      device.shown ? 1 : 0,
    );
    if (!device.shown) {
      await expect(page.locator(".feed-tabs:visible")).toBeVisible();
      // The conditional card has no wrapper or placeholder when hidden.
      expect(
        await page.locator(".install-card, .install-card-placeholder").count(),
      ).toBe(0);
    }
    await context.close();
  }
});
test("manifest/icons and native Chromium installability checks", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await ready(page);
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "টুকটাক",
    short_name: "টুকটাক",
    display: "standalone",
    lang: "bn",
    start_url: "http://localhost:3000/",
    scope: "http://localhost:3000/",
    id: "http://localhost:3000/",
  });
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).status()).toBe(200);
  expect((await request.get("/icons/apple-touch-icon.png")).status()).toBe(200);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /apple-touch-icon\.png/,
  );
  const script = await request.get("/sw.js");
  expect(script.headers()["cache-control"]).toContain("no-store");
  expect(script.headers()["content-type"]).toContain("javascript");
  const client = await page.context().newCDPSession(page);
  const app = await client.send("Page.getAppManifest");
  expect(app.errors).toEqual([]);
  expect(
    (await client.send("Page.getInstallabilityErrors")).installabilityErrors,
  ).toEqual([]);
});
test("card is compact between composer and tabs, accessible in both themes at four widths", async ({
  page,
}) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Fictional local account only",
  );
  test.setTimeout(90000);
  await android(page);
  await page.goto("/login");
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(/\/$/);
  await opportunity(page);
  await expect(page.locator(".install-card")).toBeVisible();
  expect(
    await page.locator(".composer + .install-card + .feed-tabs").count(),
  ).toBe(1);
  for (const width of [320, 360, 768, 1280])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((t) => {
        localStorage.setItem("tuktak-theme", t);
        document.documentElement.dataset.theme = t;
      }, theme);
      await page.mouse.move(0, 0);
      await page.waitForFunction(
        () =>
          !document
            .querySelector(".install-card")
            ?.getAnimations({ subtree: true })
            .some((a) => a.playState === "running"),
      );
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const install = page.getByRole("button", {
        name: "ইনস্টল করুন",
        exact: true,
      });
      expect((await install.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(
        (await page.locator(".install-card").boundingBox())!.height,
      ).toBeLessThan(160);
      const axe = await new AxeBuilder({ page })
        .include(".install-card")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(axe.violations).toEqual([]);
      await page.screenshot({
        path: `test-results/pwa-home-${width}-${theme}.png`,
        fullPage: true,
      });
    }
});
test("native prompt only follows a click; decline/dismiss persists across navigation and reload", async ({
  page,
}) => {
  await android(page);
  await page.goto("/");
  await opportunity(page);
  expect(
    await page.evaluate(
      () => (window as typeof window & { pwaPrompts: number }).pwaPrompts,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "ইনস্টল করুন", exact: true }).click();
  await expect(page.locator(".install-card")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as typeof window & { pwaPrompts: number }).pwaPrompts,
    ),
  ).toBe(1);
  await page.goto("/discover");
  await page.goto("/");
  await opportunity(page);
  await expect(page.locator(".install-card")).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.removeItem("tuktak-install-preference"),
  );
  await page.reload();
  await opportunity(page);
  await page.getByRole("button", { name: "এখন না", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".install-card")).toHaveCount(0);
  // Streaming can temporarily retain a hidden copy of the feed markup.
  await expect(
    page.locator(".feed-tabs:visible a[aria-current=page]"),
  ).toBeFocused();
  await page.reload();
  await opportunity(page);
  await expect(page.locator(".install-card")).toHaveCount(0);
});
test("completed installs hide immediately and accepted-choice races do not overwrite installed state", async ({
  page,
}) => {
  await android(page);
  await page.goto("/");
  await opportunity(page, "accepted", true);
  await page.getByRole("button", { name: "ইনস্টল করুন", exact: true }).click();
  await expect(page.locator(".install-card")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("tuktak-install-preference")!).kind,
    ),
  ).toBe("installed");
  await page.reload();
  await opportunity(page);
  await expect(page.locator(".install-card")).toHaveCount(0);
});
test("standalone and unsupported browsers hide the card; blocked storage remains usable", async ({
  page,
}) => {
  await android(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.goto("/");
  await opportunity(page);
  await expect(page.locator(".install-card")).toHaveCount(0);
  const guest = await page.context().browser()!.newContext();
  const unsupported = await guest.newPage();
  await unsupported.route("**/manifest.webmanifest", (route) => route.abort());
  await unsupported.goto("http://localhost:3000/");
  await expect(unsupported.locator(".feed-tabs")).toBeVisible();
  await expect(unsupported.locator(".install-card")).toHaveCount(0);
  await guest.close();
});
test("iPhone/iPad Safari shows concise instructions instead of a fake install button", async ({
  browser,
}) => {
  for (const device of ["iphone", "ipad", "ipad-classic"]) {
    const context = await browser.newContext({
      viewport: { width: device === "iphone" ? 320 : 768, height: 900 },
      userAgent:
        device === "iphone"
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
          : device === "ipad"
            ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15"
            : "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    });
    if (device === "ipad")
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "platform", { value: "MacIntel" });
        Object.defineProperty(navigator, "maxTouchPoints", { value: 5 });
      });
    const page = await context.newPage();
    await page.goto("http://localhost:3000/");
    await expect(page.locator(".install-card")).toContainText(
      "Share → Add to Home Screen",
    );
    await expect(
      page.getByRole("button", { name: "ইনস্টল করুন", exact: true }),
    ).toHaveCount(0);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      await page.waitForFunction(
        () =>
          !document
            .querySelector(".install-card")
            ?.getAnimations({ subtree: true })
            .some((animation) => animation.playState === "running"),
      );
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include(".install-card")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/pwa-${device}-${theme}.png`,
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "এখন না", exact: true }).click();
    await page.reload();
    await expect(page.locator(".install-card")).toHaveCount(0);
    await context.close();
  }
});
test("authenticated desktop Home puts tabs directly after composer in both themes", async ({
  page,
}) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Fictional local account only",
  );
  await page.goto("/login");
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(/\/$/);
  await opportunity(page);
  await expect(page.locator(".install-card")).toHaveCount(0);
  // The redirect can stream Home before React removes its temporary markers.
  await expect(page.locator(".composer + .feed-tabs")).toHaveCount(1);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `test-results/pwa-desktop-${theme}.png`,
      fullPage: true,
    });
    expect(
      (
        await new AxeBuilder({ page })
          .include("#main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});
test("real offline fallback/font works, retry reconnects, and only generic resources are cached", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await ready(page);
  const expected = [
    "/offline/hind-siliguri-bengali-400.woff2",
    "/offline/index.html",
  ];
  expect(await cachePaths(page)).toEqual(expected);
  await context.setOffline(true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "ইন্টারনেট সংযোগ নেই" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.fonts.check('16px "Hind Siliguri"')),
  ).toBe(true);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/pwa-offline-${theme}.png`,
      fullPage: true,
    });
  }
  expect(await cachePaths(page)).toEqual(expected);
  await context.setOffline(false);
  await page.getByRole("button", { name: "আবার চেষ্টা করুন" }).click();
  await expect(page.locator(".feed-tabs")).toBeVisible();
  for (const path of [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/notifications",
    "/settings",
    "/auth/callback?code=invalid",
  ]) {
    await page.goto(path);
    if (
      path === "/notifications" ||
      path === "/settings" ||
      path.startsWith("/auth/callback")
    )
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await cachePaths(page)).toEqual(expected);
  }
  const direct = await page.evaluate(async () => {
    await fetch("/api/social?feed=all");
    return fetch("/api/health").then((response) => response.status);
  });
  expect(direct).toBe(200);
  expect(await cachePaths(page)).toEqual(expected);
  await context.setOffline(true);
  for (const path of ["/login", "/auth/callback?code=invalid", "/api/health"]) {
    await expect(page.goto(path)).rejects.toThrow();
    await expect(
      page.getByRole("heading", { name: "ইন্টারনেট সংযোগ নেই" }),
    ).toHaveCount(0);
  }
  await context.setOffline(false);
});
