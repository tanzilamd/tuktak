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
let post: string, second: string, option: string;
test.beforeEach(() => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Disposable fictional local stack only",
  );
  if (
    process.env.E2E_BASE_URL &&
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.E2E_BASE_URL)
  )
    throw new Error("Fixtures require loopback");
  post = randomUUID();
  second = randomUUID();
  option = randomUUID();
  sql(
    `insert into posts(id,author_id,body) values('${post}','${author}','ফলোআপ পোল'),('${second}','${author}','ফলোআপ দ্বিতীয় কথা'); insert into polls(post_id,expires_at) values('${post}',now()+interval '1 day'); insert into poll_options(id,post_id,position,body) values('${option}','${post}',1,'প্রথম উত্তর'),('${randomUUID()}','${post}',2,'দ্বিতীয় উত্তর')`,
  );
});
test.afterEach(() => {
  if (post) sql(`delete from posts where id in('${post}','${second}')`);
});
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("মাথায় কী ঘুরছে?")).toBeVisible();
}
async function theme(page: Page, mode: string) {
  await page.evaluate((value) => {
    localStorage.setItem("tuktak-theme", value);
    document.documentElement.dataset.theme = value;
  }, mode);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a instanceof CSSTransition)
      .every((a) => a.playState === "finished"),
  );
}
test("post menus are exclusive, close outside/Escape/navigation and edit leaves no popup", async ({
  page,
}) => {
  await login(page);
  const cards = [
    page.locator(".post-card").filter({ hasText: "ফলোআপ পোল" }),
    page.locator(".post-card").filter({ hasText: "ফলোআপ দ্বিতীয় কথা" }),
  ];
  await cards[0].locator("summary").click();
  await expect(page.locator(".post-menu[open]")).toHaveCount(1);
  await cards[1].locator("summary").click();
  await expect(page.locator(".post-menu[open]")).toHaveCount(1);
  await expect(cards[0].locator("details")).not.toHaveAttribute("open", "");
  await page.getByLabel("মাথায় কী ঘুরছে?").click();
  await expect(page.locator(".post-menu[open]")).toHaveCount(0);
  await cards[0].locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".post-menu[open]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".post-menu[open]")).toHaveCount(0);
  await expect(cards[0].locator("summary")).toBeFocused();
  await cards[0].locator("summary").click();
  await cards[0].getByRole("button", { name: "সম্পাদনা করি" }).click();
  await expect(page.locator(".post-menu[open]")).toHaveCount(0);
  await expect(cards[0].locator(".post-editor textarea")).toBeVisible();
  await page
    .locator(".desktop-nav")
    .getByRole("link", { name: "খুঁজে দেখি" })
    .click();
  await expect(page).toHaveURL(/discover/);
  await expect(page.locator(".post-menu[open]")).toHaveCount(0);
});
test("guest poll goes to login and returns to context without voting; reactions, replies, quotes, reports and follow gate", async ({
  page,
}) => {
  await page.goto(`/post/${post}`);
  await page.getByRole("button", { name: /^প্রথম উত্তর/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/login\\?next=${encodeURIComponent(`/post/${post}`)}`),
  );
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(new RegExp(`/post/${post}$`));
  expect(sql(`select count(*) from poll_votes where post_id='${post}'`)).toBe(
    "0",
  );
  await page.context().clearCookies();
  for (const action of [
    "reaction",
    "comment",
    "quote",
    "report",
    "follow",
    "compose",
  ]) {
    await page.goto(
      action === "follow"
        ? "/u/rafi"
        : action === "compose"
          ? "/"
          : `/post/${post}`,
    );
    if (action === "reaction")
      await page.locator(".reactions a").first().click();
    if (action === "comment")
      await page
        .locator(".reply-section")
        .getByRole("link", { name: "লগইন করো", exact: true })
        .click();
    if (action === "quote" || action === "report") {
      await page.locator(".post-menu summary").click();
      await page
        .getByRole("link", {
          name: action === "quote" ? "আবার শেয়ার করি" : "রিপোর্ট করি",
          exact: true,
        })
        .click();
    }
    if (action === "follow")
      await page.getByRole("link", { name: "সাথে থাকি +" }).click();
    if (action === "compose") await page.locator(".sidebar-compose").click();
    await expect(page).toHaveURL(/\/login\?next=/);
    const next = new URL(page.url()).searchParams.get("next");
    expect(next).toBe(
      action === "follow"
        ? "/u/rafi"
        : action === "quote"
          ? `/compose?quote=${post}`
          : action === "report"
            ? `/report?type=post&id=${post}`
            : action === "compose"
              ? "/compose"
              : `/post/${post}`,
    );
  }
});
test("signup has neutral specific inline guidance which clears on correction without submitting", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("তোমাকে কী নামে ডাকব?").fill("বন্ধু");
  await page.getByLabel("Username", { exact: true }).fill("student friend");
  await page
    .getByLabel("ইমেইল", { exact: true })
    .fill("student@example.invalid");
  await page
    .getByLabel("ব্যক্তিগত মোবাইল নম্বর", { exact: true })
    .fill("01700000000");
  await page
    .getByLabel("Password", { exact: true })
    .fill("NeutralPassword!123");
  let submissions = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") submissions++;
  });
  await page.getByRole("button", { name: "আড্ডায় যোগ দিই" }).click();
  await expect(page.locator("#error-username")).toContainText(
    "স্পেস দেওয়া যাবে না",
  );
  await expect(page.locator("#error-username")).toContainText("student_01");
  await expect(page.getByLabel("Username", { exact: true })).toBeFocused();
  await page.getByLabel("Username", { exact: true }).fill("student-friend");
  await expect(page.locator("#error-username")).toContainText("ইংরেজি");
  await page.getByLabel("Username", { exact: true }).fill("student_01");
  await expect(page.locator("#error-username")).toHaveCount(0);
  expect(submissions).toBe(0);
  for (const mode of ["light", "dark"]) {
    await theme(page, mode);
    expect(
      (await new AxeBuilder({ page }).include(".auth-card").analyze())
        .violations,
    ).toEqual([]);
  }
});
test("guest and authenticated shells keep compact mobile layout and simplified desktop rail across themes", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  for (const signed of [false, true]) {
    if (signed) await login(page);
    else await page.goto("/");
    for (const mode of ["light", "dark"])
      for (const [w, h] of [
        [320, 568],
        [360, 800],
        [390, 844],
        [768, 1024],
        [1280, 720],
        [1366, 768],
        [1440, 900],
        [1920, 1080],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await theme(page, mode);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (w > 1180) {
          await expect(page.locator(".rail-profile")).toHaveCount(
            signed ? 1 : 0,
          );
          await expect(
            page
              .locator(".right-rail")
              .getByRole("link", { name: /যোগ দিই|যোগ দাও/ }),
          ).toHaveCount(0);
          if (signed) {
            await expect(page.locator(".rail-profile")).toHaveAttribute(
              "href",
              "/u/rafi",
            );
            expect(
              await page
                .locator(".right-rail")
                .evaluate((e) => e.firstElementChild?.className),
            ).toContain("rail-profile");
          }
        }
        if (w > 760) {
          const bounds = await page.locator(".sidebar").evaluate((e) => {
            const selectors = [
              ".brand-tagline",
              ".sidebar-middle",
              ".sidebar-compose",
              ".sidebar-bottom",
            ];
            return selectors.map((s) => {
              const r = e.querySelector(s)!.getBoundingClientRect();
              return [r.top, r.bottom];
            });
          });
          for (let i = 1; i < bounds.length; i++)
            expect(bounds[i][0]).toBeGreaterThanOrEqual(bounds[i - 1][1] - 1);
          expect(bounds.at(-1)![1]).toBeLessThanOrEqual(h);
          expect(
            await page
              .locator(".sidebar-middle")
              .evaluate((e) => e.scrollHeight - e.clientHeight),
          ).toBeLessThanOrEqual(1);
        }
        await page.screenshot({
          path: info.outputPath(`shell-${signed}-${w}-${mode}.png`),
        });
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
      }
  }
});
test("login/logout refreshes identity, badge and private controls without cross-session feed state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".rail-profile")).toHaveCount(0);
  await login(page);
  await expect(page.locator(".rail-profile")).toHaveCount(1);
  await page.goto("/settings");
  await page.getByRole("button", { name: "লগআউট", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".rail-profile")).toHaveCount(0);
  await expect(page.getByLabel("মাথায় কী ঘুরছে?")).toHaveCount(0);
  await expect(page.locator(".post-editor")).toHaveCount(0);
  await expect(page.locator(".desktop-nav .notification-badge")).toHaveCount(0);
  await page.goto(`/post/${post}`);
  await page.getByRole("button", { name: /^প্রথম উত্তর/ }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
});
test("reduced mobile form viewport and extreme desktop fallback remain keyboard reachable", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 360, height: 360 });
  await page.goto("/settings/profile");
  const input = page.getByLabel("ডাকনাম / display name", { exact: true });
  await input.focus();
  const nav = await page.locator(".bottom-nav").boundingBox();
  await expect
    .poll(async () => {
      const b = await input.boundingBox();
      return b!.y >= 0 && b!.y + b!.height <= nav!.y;
    })
    .toBe(true);
  const submit = page.getByRole("button", {
    name: "পরিবর্তন রাখি",
    exact: true,
  });
  await submit.focus();
  await expect
    .poll(async () => {
      const b = await submit.boundingBox();
      return b!.y >= 0 && b!.y + b!.height <= nav!.y;
    })
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.locator(".sidebar-bottom a").last().focus();
  const footer = await page.locator(".sidebar-bottom a").last().boundingBox();
  expect(footer!.y).toBeGreaterThanOrEqual(0);
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(400);
});
test("guest desktop zoom layouts retain Settings and legal footer without inner scrolling", async ({
  page,
}, info) => {
  await page.goto("/");
  for (const mode of ["light", "dark"])
    for (const [w, h] of [
      [1280, 720],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({
        width: Math.floor(w / 1.25),
        height: Math.floor(h / 1.25),
      });
      await theme(page, mode);
      const nav = page.locator(".desktop-nav"),
        middle = page.locator(".sidebar-middle");
      await expect(
        nav.getByRole("link", { name: "সেটিংস", exact: true }),
      ).toBeVisible();
      expect(
        await middle.evaluate((e) => e.scrollHeight - e.clientHeight),
      ).toBeLessThanOrEqual(1);
      const footer = await page.locator(".sidebar-bottom").boundingBox(),
        cta = await page.locator(".sidebar-compose").boundingBox();
      expect(cta!.y + cta!.height).toBeLessThanOrEqual(footer!.y);
      expect(footer!.y + footer!.height).toBeLessThanOrEqual(
        Math.floor(h / 1.25),
      );
      await expect(page.locator(".rail-profile")).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath(`guest-zoom-${w}-${mode}.png`),
      });
    }
});
