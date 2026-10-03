import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
