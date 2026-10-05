import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const author = "00000000-0000-4000-8000-000000000001";
const sql = (q: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "tuktak-test-db-1",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atc",
      q,
    ],
    { encoding: "utf8" },
  ).trim();
let post: string;
test.beforeEach(() => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Disposable local stack only",
  );
  if (
    process.env.E2E_BASE_URL &&
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.E2E_BASE_URL)
  )
    throw Error("Fixtures require loopback");
  post = randomUUID();
  sql(
    `insert into posts(id,author_id,body) values('${post}','${author}','শেয়ার পরীক্ষার গোপন না হওয়া কথা')`,
  );
});
test.afterEach(() => {
  if (post) sql(`delete from posts where id='${post}'`);
});
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page.getByLabel("মাথায় কী ঘুরছে?")).toBeVisible();
}
async function mockShare(
  page: Page,
  mode: "native" | "copy" | "manual" | "cancel",
) {
  await page.addInitScript((mode) => {
    const state = window as typeof window & {
      shareCalls?: ShareData[];
      copiedLinks?: string[];
      activeShare?: boolean;
    };
    state.shareCalls = [];
    state.copiedLinks = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value:
        mode === "native" || mode === "cancel"
          ? async (data: ShareData) => {
              state.shareCalls!.push(data);
              state.activeShare = navigator.userActivation.isActive;
              if (mode === "cancel")
                throw new DOMException("Cancelled", "AbortError");
            }
          : undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (url: string) => {
          if (mode === "manual") throw Error("denied");
          state.copiedLinks!.push(url);
        },
      },
    });
  }, mode);
}
async function clickPostShare(page: Page) {
  const card = page
    .locator(".post-card")
    .filter({ hasText: "শেয়ার পরীক্ষার গোপন না হওয়া কথা" });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "শেয়ার", exact: true }).click();
  await expect(page.locator(".post-menu[open]")).toHaveCount(0);
  await expect(card.locator("summary")).toBeFocused();
}
test("guest and signed-in post/detail sharing sends exact text+canonical URL without body or writes", async ({
  page,
}) => {
  await mockShare(page, "native");
  await page.setViewportSize({ width: 360, height: 800 });
  for (const signed of [false, true]) {
    if (signed) await login(page);
    for (const route of [
      "/",
      `/post/${post}?comment=${randomUUID()}#private-context`,
    ]) {
      await page.goto(route);
      let writes = 0;
      const listener = (r: { method: () => string }) => {
        if (r.method() === "POST") writes++;
      };
      page.on("request", listener);
      await clickPostShare(page);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as typeof window & { shareCalls: ShareData[] })
                .shareCalls,
          ),
        )
        .toEqual([
          { text: "টুকটাকে দেখো", url: `http://localhost:3000/post/${post}` },
        ]);
      expect(
        await page.evaluate(
          () =>
            (window as typeof window & { activeShare: boolean }).activeShare,
        ),
      ).toBe(true);
      expect(writes).toBe(0);
      page.off("request", listener);
    }
  }
});
test("own, other and guest public profile share use the current username only", async ({
  page,
}) => {
  await mockShare(page, "native");
  for (const signed of [false, true]) {
    if (signed) await login(page);
    for (const username of ["rafi", "mithi"]) {
      await page.goto(`/u/${username}`);
      await page
        .locator(".profile-share")
        .getByRole("button", { name: "শেয়ার", exact: true })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as typeof window & { shareCalls: ShareData[] })
                .shareCalls,
          ),
        )
        .toEqual([
          { text: "টুকটাকে দেখো", url: `http://localhost:3000/u/${username}` },
        ]);
    }
  }
});
test("copy fallback remains visible after menu closes; clipboard failure exposes selectable canonical link", async ({
  page,
}) => {
  await mockShare(page, "copy");
  await page.goto(`/post/${post}`);
  await clickPostShare(page);
  await expect(
    page.getByRole("status").filter({ hasText: "লিংক কপি হয়েছে" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as typeof window & { copiedLinks: string[] }).copiedLinks,
    ),
  ).toEqual([`http://localhost:3000/post/${post}`]);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error("denied");
        },
      },
    }),
  );
  await page.goto("/u/rafi");
  await page.locator(".profile-share button").click();
  const link = page.getByLabel("শেয়ার করার লিংক");
  await expect(link).toHaveValue("http://localhost:3000/u/rafi");
  await link.focus();
  expect(await link.evaluate((e) => (e as HTMLInputElement).selectionEnd)).toBe(
    "http://localhost:3000/u/rafi".length,
  );
});
test("native cancellation is silent and does not copy or open login", async ({
  page,
}) => {
  await mockShare(page, "cancel");
  await page.goto(`/post/${post}`);
  await clickPostShare(page);
  expect(
    await page.evaluate(
      () => (window as typeof window & { copiedLinks: string[] }).copiedLinks,
    ),
  ).toEqual([]);
  await expect(page.locator(".share-feedback")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/post/${post}$`));
});
test("hidden/deleted links remain unavailable and never render share or private content", async ({
  page,
}) => {
  sql(`update posts set hidden=true where id='${post}'`);
  await page.goto(`/post/${post}`);
  await expect(
    page.getByText("লিংকটা বদলেছে, কনটেন্ট সরেছে অথবা দেখার অনুমতি নেই।"),
  ).toBeVisible();
  await expect(page.locator(".share-button,.post-card")).toHaveCount(0);
  await expect(page.getByText("শেয়ার পরীক্ষার গোপন না হওয়া কথা")).toHaveCount(
    0,
  );
  sql(`delete from posts where id='${post}'`);
  await page.reload();
  await expect(page.locator(".share-button,.post-card")).toHaveCount(0);
});
test("profile and post fallback controls remain accessible at mobile/desktop widths in both themes", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await mockShare(page, "manual");
  for (const route of ["/u/rafi", `/post/${post}`]) {
    await page.goto(route);
    if (route.startsWith("/post/")) await clickPostShare(page);
    else await page.locator(".profile-share button").click();
    for (const width of [320, 360, 768, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate((t) => {
          localStorage.setItem("tuktak-theme", t);
          document.documentElement.dataset.theme = t;
        }, theme);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() =>
          document
            .getAnimations()
            .filter((a) => a instanceof CSSTransition)
            .every((a) => a.playState === "finished"),
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          (await new AxeBuilder({ page }).include("main").analyze()).violations,
        ).toEqual([]);
        await page.screenshot({
          path: info.outputPath(
            `share-${route.startsWith("/u/") ? "profile" : "post"}-${width}-${theme}.png`,
          ),
        });
      }
  }
});
