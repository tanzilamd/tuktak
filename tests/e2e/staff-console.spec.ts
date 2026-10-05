import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
const admin = "00000000-0000-4000-8000-000000000001";
const mod = "00000000-0000-4000-8000-000000000003";
const suspended = "00000000-0000-4000-8000-000000000002";
const sql = (query: string) =>
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
      query,
    ],
    { encoding: "utf8" },
  ).trim();
async function login(page: Page, name = "rafi") {
  await page.goto("/login");
  await page
    .getByLabel("ইমেইল", { exact: true })
    .fill(`${name}@example.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(/\/$/);
}
test.beforeEach(({ baseURL }) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Disposable local stack only",
  );
  expect(new URL(baseURL!).hostname).toBe("localhost");
});
test("normal users cannot enter staff routes and moderators keep limited team access", async ({
  page,
}) => {
  sql(
    `update user_roles set role='user',suspended=false where user_id in ('${admin}','${mod}')`,
  );
  await login(page);
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "আড্ডা সামলাই →" })).toHaveCount(
    0,
  );
  for (const path of [
    "/moderation",
    "/moderation/reports",
    "/moderation/suspended",
    "/moderation/audit",
    "/moderation/team",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
  }
  sql(`update user_roles set role='moderator' where user_id='${admin}'`);
  try {
    await page.goto("/settings");
    await page.getByRole("link", { name: "আড্ডা সামলাই →" }).click();
    await expect(
      page.getByRole("heading", { name: "আড্ডা সামলাই" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "দল পরিচালনা", exact: true }),
    ).toHaveCount(0);
    await page.goto("/moderation/team");
    await expect(page).toHaveURL(/\/$/);
  } finally {
    sql(`update user_roles set role='user' where user_id='${admin}'`);
  }
});
test("staff filters, audit actor, unsuspension and mobile settings work", async ({
  page,
}) => {
  const report = sql(
    `insert into reports(target_type,target_id,reason,notes) values('user','${suspended}','অন্যান্য','staff-control-fixture') returning id`,
  );
  sql(
    `update user_roles set role='admin' where user_id='${admin}'; update user_roles set suspended=true where user_id='${suspended}'`,
  );
  try {
    await login(page);
    await page.goto("/moderation/reports?q=staff-control-fixture");
    await expect(page.locator("article")).toHaveCount(1);
    await page.getByRole("button", { name: "বন্ধ করি" }).click();
    await expect(page.locator("article")).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "অবস্থা", exact: true })
      .selectOption("dismissed");
    await page.getByRole("button", { name: "দেখি", exact: true }).click();
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "বন্ধ করি" })).toHaveCount(0);
    await page.goto("/moderation/audit");
    await expect(page.getByText("বন্ধ করা · user").first()).toBeVisible();
    await expect(
      page.locator(".audit-row").filter({ hasText: report }).first(),
    ).toHaveCount(0); // Report IDs are not the action target.
    await page.goto("/moderation/suspended?q=mithi");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "ফিরিয়ে আনি" }).click();
    await expect(page.getByRole("button", { name: "ফিরিয়ে আনি" })).toHaveCount(
      0,
    );
    await page.goto("/moderation/team?q=ayon");
    await page.getByRole("combobox").selectOption("moderator");
    await page.getByRole("button", { name: "দায়িত্ব রাখি" }).click();
    await expect(page.getByRole("status")).toContainText("হয়ে গেছে");
  } finally {
    sql(
      `delete from reports where notes='staff-control-fixture'; update user_roles set role='user',suspended=false where user_id in ('${admin}','${mod}','${suspended}')`,
    );
  }
});
test("compact staff pages retain responsive layout and accessible controls in both themes", async ({
  page,
}) => {
  test.setTimeout(120000);
  sql(`update user_roles set role='admin' where user_id='${admin}'`);
  try {
    await login(page);
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
        for (const path of [
          "/moderation",
          "/moderation/reports",
          "/moderation/suspended",
          "/moderation/audit",
          "/moderation/team",
        ]) {
          await page.goto(path);
          await expect(page.locator("main h1")).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (width === 320 || width === 1280)
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
        }
        await page.screenshot({
          path: `test-results/staff-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  } finally {
    sql(`update user_roles set role='user' where user_id='${admin}'`);
  }
});
