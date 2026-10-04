import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
test("public screens meet automated WCAG AA checks in light and dark", async ({
  page,
}) => {
  for (const mode of ["light", "dark"]) {
    await page.goto("/");
    await page.evaluate((t) => {
      localStorage.setItem("tuktak-theme", t);
      document.documentElement.dataset.theme = t;
    }, mode);
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/forgot-password",
      "/discover",
      "/u/rafi",
      "/privacy",
      "/community",
      "/a-missing-page",
    ]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page })
        .exclude("nextjs-portal")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations,
        `${mode} ${path}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) })))}`,
      ).toEqual([]);
    }
  }
});

test("authenticated mobile forms and settings meet automated WCAG AA", async ({
  page,
}) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Fictional local accounts only",
  );
  test.setTimeout(90000);
  await page.goto("/login");
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.setViewportSize({ width: 320, height: 760 });
  for (const mode of ["light", "dark"]) {
    await page.evaluate((t) => {
      localStorage.setItem("tuktak-theme", t);
      document.documentElement.dataset.theme = t;
    }, mode);
    for (const path of [
      "/",
      "/compose",
      "/notifications",
      "/settings",
      "/settings/profile",
      "/settings/blocked",
      "/settings/muted",
      "/onboarding",
      "/u/rafi/followers",
      "/u/rafi/following",
      "/report?type=user&id=00000000-0000-4000-8000-000000000002",
    ]) {
      await page.goto(path);
      if (path === "/onboarding") {
        await expect(page).toHaveURL(/\/settings\/profile$/);
        await expect(
          page.getByRole("heading", { name: "এটাই আমি 🌱" }),
        ).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${mode} ${path} should fit 320px`,
      ).toBe(true);
      const results = await new AxeBuilder({ page })
        .exclude("nextjs-portal")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        `${mode} ${path}`,
      ).toEqual([]);
    }
  }
});

test("first-time onboarding remains accessible at 320px in both themes", async ({
  page,
}) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Fictional local accounts only",
  );
  const sql = (statement: string) =>
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
        statement,
      ],
      { encoding: "utf8" },
    ).trim();
  const condition = "user_id='00000000-0000-4000-8000-000000000001'";
  const completed = sql(
    `select onboarding_complete from account_private where ${condition}`,
  );
  expect(["t", "f"]).toContain(completed);
  try {
    sql(
      `update account_private set onboarding_complete=false where ${condition}`,
    );
    await page.goto("/login");
    await page
      .getByLabel("ইমেইল", { exact: true })
      .fill("rafi@example.invalid");
    await page
      .getByLabel("Password", { exact: true })
      .fill("Local-only-demo-Password!32");
    await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.setViewportSize({ width: 320, height: 760 });
    for (const mode of ["light", "dark"]) {
      await page.evaluate((theme) => {
        localStorage.setItem("tuktak-theme", theme);
      }, mode);
      await page.goto("/onboarding");
      await expect(
        page.getByRole("heading", { name: "তোমার মতো করে" }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations, `${mode} first-time onboarding`).toEqual([]);
      expect(await page.content()).not.toContain("+8801700000000");
    }
  } finally {
    sql(
      `update account_private set onboarding_complete=${completed === "t"} where ${condition}`,
    );
  }
});
