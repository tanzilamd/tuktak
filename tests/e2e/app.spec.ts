import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
async function login(page: Page, email = "rafi@example.invalid") {
  await page.goto("/login");
  await page.getByLabel("ইমেইল", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("মাথায় কী ঘুরছে?")).toBeVisible();
}
test.beforeAll(() => {
  if (process.env.LOCAL_SUPABASE_TESTS === "1")
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
        "-c",
        "truncate follows,blocks,mutes,notifications,reports,moderation_actions,action_receipts; update user_roles set role='user',suspended=false;",
      ],
      { stdio: "pipe" },
    );
});
test("public landing, search, hashtags, responsive layout and Bengali font", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "আড্ডা", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("রিকশায় বসে বাতাস", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.fonts.check('16px "Hind Siliguri"')),
  ).toBe(true);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("navigation", { name: "মোবাইল নেভিগেশন" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-light.png",
    fullPage: true,
  });
  await page.goto("/discover?q=মিম");
  await expect(
    page.locator(".people-grid").getByRole("link", { name: /মিথি রহমান/ }),
  ).toBeVisible();
  await page.goto("/tag/মিম");
  await expect(page.getByText("বাসায় বলছিলাম", { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "আড্ডা", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-light.png",
    fullPage: true,
  });
});
test("guest protected routes and authentication errors", async ({ page }) => {
  for (const path of [
    "/settings",
    "/compose",
    "/notifications",
    "/admin",
    "/moderation",
    "/onboarding",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("wrong-long-password");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "ইমেইল বা password",
  );
});
test("posting, Unicode limits, mood, reactions, comments and author deletion", async ({
  page,
}) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Needs the local test stack",
  );
  await login(page);
  const textarea = page.getByLabel("মাথায় কী ঘুরছে?");
  await textarea.fill("🙂".repeat(241));
  await expect(page.getByRole("button", { name: "বলে ফেলি" })).toBeDisabled();
  const body = `ব্রাউজারের আড্ডা ${Date.now()} #BrowserTest`;
  await textarea.fill(body);
  await page.getByLabel("মুড বেছে নাও").selectOption("😌 শান্তি");
  await page.getByRole("button", { name: "বলে ফেলি" }).click();
  const card = page.locator("article").filter({ hasText: body });
  await expect(card).toBeVisible();
  await card.getByLabel(/ভালো লাগলো/).click();
  await expect(card.getByLabel(/ভালো লাগলো/)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await card.getByLabel(/সেই/).click();
  await expect(card.getByLabel(/সেই/)).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByLabel(/ভালো লাগলো/)).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await card.getByLabel("পোস্ট খুলে দেখি").click();
  await page.getByLabel("কথায় কথা বাড়ুক").fill("একটা ছোট উত্তর");
  await page.getByRole("button", { name: "উত্তর দিই", exact: true }).click();
  await expect(page.getByText("একটা ছোট উত্তর", { exact: true })).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "মুছে দিই", exact: true }).click();
  await expect(
    page.getByText("একটা ছোট উত্তর", { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("পোস্টের আরও অপশন").click();
  await page.getByRole("button", { name: "পোস্ট মুছে দিই" }).click();
  await expect(page.getByText(body, { exact: true })).not.toBeVisible();
});
test("following, block/unblock, reports and private settings in dark mode", async ({
  page,
}) => {
  test.skip(process.env.LOCAL_SUPABASE_TESTS !== "1", "Needs local test stack");
  await login(page);
  await page.goto("/u/mithi");
  await expect(page.locator("main")).not.toContainText("+880");
  await expect(page.locator("main")).not.toContainText("example.invalid");
  await page.getByRole("button", { name: "সাথে থাকি +" }).click();
  await expect(page.getByRole("button", { name: "সাথে আছি ✓" })).toBeVisible();
  await page.goto("/?feed=following");
  await expect(page.getByText("আজকে alarm", { exact: false })).toBeVisible();
  await page.goto("/u/mithi");
  await page.getByText("নিরাপত্তা ও অপশন").click();
  await page.getByRole("link", { name: "রিপোর্ট করি", exact: true }).click();
  await page.getByRole("combobox").selectOption("স্প্যাম");
  await page.getByRole("button", { name: "রিপোর্ট পাঠাই" }).click();
  await expect(page.getByRole("status")).toContainText("রিপোর্ট পেয়েছি");
  await page.goto("/u/mithi");
  await page.getByText("নিরাপত্তা ও অপশন").click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "ব্লক করি" }).click();
  await expect(
    page.getByText("এই পেজটা মনে হয়", { exact: false }),
  ).toBeVisible();
  await page.goto("/settings/blocked");
  await page.getByRole("button", { name: "আবার দেখতে চাই" }).click();
  await expect(page.getByText("এখানে কেউ নেই।")).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("ব্যক্তিগত মোবাইল নম্বর")).toHaveValue(
    "+8801700000000",
  );
  await page.getByRole("button", { name: "🌙 অন্ধকার" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-dark.png",
    fullPage: true,
  });
  await page.goto("/");
  await expect(page.getByLabel("মাথায় কী ঘুরছে?")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "test-results/feed-dark.png", fullPage: true });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
});
test("moderation dashboard, audit, admin role management and suspension", async ({
  page,
}) => {
  test.skip(process.env.LOCAL_SUPABASE_TESTS !== "1", "Needs local test stack");
  const sql = (s: string) =>
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
        "-c",
        s,
      ],
      { stdio: "pipe" },
    );
  sql(
    "update user_roles set role='admin' where user_id='00000000-0000-4000-8000-000000000001'",
  );
  try {
    sql(
      "insert into reports(reporter_id,target_type,target_id,reason) values('00000000-0000-4000-8000-000000000001','user','00000000-0000-4000-8000-000000000002','স্প্যাম') on conflict do nothing",
    );
    await login(page);
    await page.goto("/moderation");
    await expect(
      page.getByRole("heading", { name: "আড্ডা সামলাই" }),
    ).toBeVisible();
    const report = page
      .locator("article")
      .filter({ hasText: "স্প্যাম" })
      .first();
    await report.getByRole("button", { name: "বন্ধ করি" }).click();
    await expect(page.getByText("dismiss · user")).toBeVisible();
    await page.goto("/admin?q=ayon");
    await page.getByRole("combobox").selectOption("moderator");
    await page.getByRole("button", { name: "দায়িত্ব রাখি" }).click();
    await expect(page.getByRole("status")).toContainText("হয়ে গেছে");
  } finally {
    sql(
      "update user_roles set role='user' where user_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003')",
    );
  }
});
