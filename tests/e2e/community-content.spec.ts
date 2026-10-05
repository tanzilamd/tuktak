import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { dhakaInput } from "../../src/lib/community";
const admin = "00000000-0000-4000-8000-000000000001";
const marker = "কন্ট্রোল পরীক্ষা";
const kinds = ["questions", "prompts", "moods", "topics", "announcements"];
function sql(query: string) {
  return execFileSync(
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
      query,
    ],
    { encoding: "utf8" },
  ).trim();
}
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(/\/$/);
}
async function add(page: Page, kind: string) {
  await page.goto(`/moderation/content/${kind}?add=1`);
  return page.locator(".community-editor");
}
async function save(page: Page) {
  await page
    .locator(".community-editor")
    .getByRole("button", { name: /যোগ করি|বদল রাখি/ })
    .click();
  await expect(
    page.locator(".community-editor").getByRole("status"),
  ).toContainText("হয়ে গেছে");
}
test.beforeEach(({ baseURL }) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Disposable fictional stack only",
  );
  expect(new URL(baseURL!).hostname).toBe("localhost");
  sql(
    `update user_roles set role='admin',suspended=false where user_id='${admin}'; delete from action_receipts where user_id='${admin}' and action in ('community_manage','post')`,
  );
});
test.afterEach(() => {
  if (process.env.LOCAL_SUPABASE_TESTS !== "1") return;
  sql(
    `delete from community_questions where body like '${marker}%'; delete from community_prompts where body like '${marker}%'; update community_prompts set active=true; delete from community_moods where label like '${marker}%'; delete from community_topics where tag='কন্ট্রোলপরীক্ষা'; delete from community_announcements where body like '${marker}%'; delete from posts where body like '${marker}%'; delete from community_question_override; update user_roles set role='user',suspended=false where user_id='${admin}'`,
  );
});
test("question validation, editing, daily pin/release and audit use live admin authority", async ({
  page,
}) => {
  await login(page);
  const form = await add(page, "questions");
  await form.getByRole("button", { name: "যোগ করি" }).click();
  await expect(form.getByRole("textbox", { name: /^প্রশ্ন/ })).toBeFocused();
  await expect(form.locator(".field-error")).toBeVisible();
  await form
    .getByRole("textbox", { name: /^প্রশ্ন/ })
    .fill(`${marker} — আজ কী কথা?`);
  await save(page);
  const row = page
    .locator(".community-row")
    .filter({ hasText: `${marker} — আজ কী কথা?` });
  await row.getByRole("link", { name: "সম্পাদনা" }).click();
  await expect(
    page.locator(".community-editor").getByRole("button", { name: "বদল রাখি" }),
  ).toBeVisible();
  await page
    .locator(".community-editor textarea")
    .fill(`${marker} — নতুন প্রশ্ন?`);
  await save(page);
  await page
    .locator(".community-row")
    .filter({ hasText: `${marker} — নতুন প্রশ্ন?` })
    .getByRole("button", { name: "আজকের প্রশ্ন করি" })
    .click();
  await expect(
    page.getByRole("button", { name: "আবার স্বয়ংক্রিয় বাছাই" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".daily-question h2")).toHaveText(
    `${marker} — নতুন প্রশ্ন?`,
  );
  await page.reload();
  await expect(page.locator(".daily-question h2")).toHaveText(
    `${marker} — নতুন প্রশ্ন?`,
  );
  await page.goto("/moderation/content/questions");
  await page.getByRole("button", { name: "আবার স্বয়ংক্রিয় বাছাই" }).click();
  await expect(
    page.getByRole("button", { name: "আবার স্বয়ংক্রিয় বাছাই" }),
  ).toHaveCount(0);
  await page.goto("/moderation/audit?q=community_pin");
  await expect(page.locator(".audit-row").first()).toContainText(
    "আজকের প্রশ্ন বাছাই · আজকের প্রশ্ন",
  );
});
test("managed prompts, mood snapshots and featured/organic topics reach the existing composer/feed", async ({
  page,
}) => {
  await login(page);
  sql("update community_prompts set active=false");
  await add(page, "prompts");
  await page
    .locator(".community-editor textarea")
    .fill(`${marker} — ছোট্ট কথা বলি`);
  await save(page);
  await add(page, "moods");
  await page.getByRole("textbox", { name: /^মুডের নাম/ }).fill(`${marker} মুড`);
  await page.getByRole("textbox", { name: /^ইমোজি/ }).fill("🪁");
  await save(page);
  await add(page, "topics");
  await page
    .locator(".community-editor")
    .getByRole("textbox", { name: "বিষয়" })
    .fill("#কন্ট্রোলপরীক্ষা");
  await save(page);
  await page.goto("/");
  await expect(page.locator(".composer textarea")).toHaveAttribute(
    "placeholder",
    `${marker} — ছোট্ট কথা বলি`,
  );
  await page
    .getByRole("combobox", { name: "মুড বেছে নাও" })
    .selectOption(`🪁 ${marker} মুড`);
  await page
    .locator(".composer textarea")
    .fill(`${marker} — পুরোনো মুড রেখে দিই #আড্ডা`);
  const confirmedPost = page.waitForResponse(
    (r) => r.url().endsWith("/api/social") && r.request().method() === "POST",
  );
  await page
    .locator(".composer")
    .getByRole("button", { name: "বলে ফেলি" })
    .click();
  const response = await confirmedPost;
  expect(response.ok()).toBe(true);
  expect((await response.json()).ok).toBe(true);
  await expect(
    page
      .locator(".post-card")
      .filter({ hasText: `${marker} — পুরোনো মুড রেখে দিই` })
      .first(),
  ).toContainText(`🪁 ${marker} মুড`);
  await expect(page.locator(".composer textarea")).toHaveValue("");
  await page.reload();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page
      .locator(".mobile-topics")
      .getByRole("link", { name: "#কন্ট্রোলপরীক্ষা", exact: true }),
  ).toHaveAttribute(
    "href",
    "/tag/%E0%A6%95%E0%A6%A8%E0%A7%8D%E0%A6%9F%E0%A7%8D%E0%A6%B0%E0%A7%8B%E0%A6%B2%E0%A6%AA%E0%A6%B0%E0%A7%80%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE",
  );
  await expect(
    page
      .locator(".mobile-topics")
      .getByRole("link", { name: "#আড্ডা", exact: true }),
  ).toBeVisible();
  await page.goto("/moderation/content/moods");
  const moodRow = page
    .locator(".community-row")
    .filter({ hasText: `🪁 ${marker} মুড` });
  await moodRow.getByRole("button", { name: "বন্ধ রাখি" }).click();
  await expect(
    moodRow.getByRole("button", { name: "সক্রিয় করি" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page
      .locator(".composer select[name=mood] option")
      .filter({ hasText: marker }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".post-card")
      .filter({ hasText: `${marker} — পুরোনো মুড রেখে দিই` })
      .first(),
  ).toContainText(`🪁 ${marker} মুড`);
  await page.goto("/moderation/content/topics");
  page.once("dialog", (d) => d.accept());
  await page
    .locator(".community-row")
    .filter({ hasText: "#কন্ট্রোলপরীক্ষা" })
    .getByRole("button", { name: "মুছে দিই" })
    .click();
  await expect(
    page.locator(".community-row").filter({ hasText: "#কন্ট্রোলপরীক্ষা" }),
  ).toHaveCount(0);
});
test("announcement scheduling, priority, public dismissal/revision and no-gap/expiry states", async ({
  page,
  context,
}) => {
  await login(page);
  await add(page, "announcements");
  await page
    .getByRole("textbox", { name: /^ঘোষণার লেখা/ })
    .fill(`${marker} — ঘোষণা`);
  await page.getByRole("textbox", { name: /^শিরোনাম/ }).fill("সবাই একটু দেখি");
  await page
    .locator(".community-editor select[name=priority]")
    .selectOption("3");
  await page
    .locator(".community-editor input[name=link]")
    .fill("javascript:alert(1)");
  await page
    .locator(".community-editor")
    .getByRole("button", { name: "যোগ করি" })
    .click();
  await expect(
    page.locator(".community-editor input[name=link]"),
  ).toBeFocused();
  await page.locator(".community-editor input[name=link]").fill("/community");
  const future = dhakaInput(new Date(Date.now() + 3600000).toISOString());
  await page.locator(".community-editor input[name=starts_at]").fill(future);
  await save(page);
  await page.goto("/");
  await expect(page.locator(".community-announcement")).toHaveCount(0);
  await page.goto("/moderation/content/announcements");
  await page
    .locator(".community-row")
    .filter({ hasText: `${marker} — ঘোষণা` })
    .getByRole("link", { name: "সম্পাদনা" })
    .click();
  await expect(
    page.locator(".community-editor").getByRole("button", { name: "বদল রাখি" }),
  ).toBeVisible();
  await page
    .locator(".community-editor input[name=starts_at]")
    .fill(dhakaInput(new Date(Date.now() - 60000).toISOString()));
  await save(page);
  await page.goto("/");
  const banner = page.locator(".community-announcement");
  await expect(banner).toHaveCount(1);
  await expect(banner.getByRole("link", { name: "আরও দেখি" })).toHaveAttribute(
    "href",
    "/community",
  );
  expect(
    await banner.evaluate(
      (el) =>
        el.compareDocumentPosition(document.querySelector(".daily-question")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBeTruthy();
  await banner.getByRole("button", { name: "ঘোষণা সরিয়ে রাখি" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await page.goto("/moderation/content/announcements");
  await page
    .locator(".community-row")
    .filter({ hasText: `${marker} — ঘোষণা` })
    .getByRole("link", { name: "সম্পাদনা" })
    .click();
  await page.locator(".community-editor input[name=dismissible]").uncheck();
  await save(page);
  await page.goto("/");
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("button")).toHaveCount(0);
  const guest = await context.browser()!.newContext();
  try {
    const other = await guest.newPage();
    await other.goto("http://localhost:3000/");
    await expect(other.locator(".community-announcement")).toBeVisible();
  } finally {
    await guest.close();
  }
  sql(
    `update community_announcements set ends_at=clock_timestamp()+interval '2 seconds' where body='${marker} — ঘোষণা'`,
  );
  await page.reload();
  await expect(banner).toHaveCount(0, { timeout: 10000 });
});
test("normal users and moderators cannot navigate into any content-management route", async ({
  page,
}) => {
  await login(page);
  for (const role of ["user", "moderator"]) {
    sql(`update user_roles set role='${role}' where user_id='${admin}'`);
    for (const kind of kinds) {
      await page.goto(`/moderation/content/${kind}?add=1`);
      await expect(page).toHaveURL(/\/$/);
    }
    await page.goto(role === "user" ? "/settings" : "/moderation");
    await expect(
      page.getByRole("navigation", { name: "কনটেন্ট পরিচালনা" }),
    ).toHaveCount(0);
  }
});
test("all content editors and compact banner preserve responsive layout and accessible controls in both themes", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page);
  sql(
    `insert into community_announcements(title,body,priority,dismissible) values('একটু দেখি','${marker} — সংক্ষিপ্ত ঘোষণা',2,true)`,
  );
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      localStorage.setItem("tuktak-theme", t);
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const [width, height] of [
      [320, 568],
      [360, 800],
      [390, 844],
      [768, 1024],
      [1280, 720],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      for (const kind of kinds) {
        await add(page, kind);
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (width === 320 || width === 1280)
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
        if (width === 320 || width === 1280)
          await page.screenshot({
            path: `test-results/community-${kind}-${width}-${theme}.png`,
          });
      }
      await page.goto("/");
      await expect(page.locator(".community-announcement")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator(".community-announcement")
          .evaluate((el) => el.getBoundingClientRect().height),
      ).toBeLessThan(180);
      if (width === 320 || width === 1280)
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
      await page.screenshot({
        path: `test-results/community-home-${width}-${theme}.png`,
      });
    }
  }
});
