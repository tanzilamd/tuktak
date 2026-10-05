import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
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
const rafi = "00000000-0000-4000-8000-000000000001";
const mithi = "00000000-0000-4000-8000-000000000002";
const ayon = "00000000-0000-4000-8000-000000000003";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(/\/$/);
}
test.beforeEach(() => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Requires fictional local stack",
  );
  if (
    process.env.E2E_BASE_URL &&
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.E2E_BASE_URL)
  )
    throw new Error("Fictional fixture tests require loopback");
});

test("inbox entry reads only its snapshot, keeps entry highlights, and preserves later/foreign unread rows", async ({
  page,
}) => {
  sql("truncate public.notifications");
  const post = sql(
    `insert into public.posts(author_id,body) values('${rafi}','launch notification fixture') returning id`,
  ).split("\n")[0];
  sql(
    `insert into notifications(recipient_id,actor_id,kind,post_id,event_key) values ('${rafi}','${mithi}','reaction','${post}','launch:reaction1'),('${rafi}','${ayon}','reaction','${post}','launch:reaction2'),('${rafi}','${mithi}','follow',null,'launch:follow'),('${mithi}','${rafi}','follow',null,'launch:foreign')`,
  );
  await login(page);
  await expect(
    page
      .locator(".desktop-nav")
      .getByRole("link", { name: "খবর, ৩টি অপঠিত", exact: true }),
  ).toBeVisible();
  // A normal RSC prefetch must never invoke inbox_open.
  await page
    .locator(".desktop-nav")
    .getByRole("link", { name: "খবর, ৩টি অপঠিত", exact: true })
    .hover();
  expect(
    sql(
      `select count(*) from notifications where recipient_id='${rafi}' and read_at is null`,
    ),
  ).toBe("3");
  await page.goto("/notifications");
  await expect(page.locator(".notification.entry-new")).toHaveCount(2);
  await expect(page.locator(".notification.unread")).toHaveCount(0);
  await expect(page.locator(".notification-badge")).toHaveCount(0);
  expect(
    sql(
      `select count(*) from notifications where recipient_id='${rafi}' and read_at is null`,
    ),
  ).toBe("0");
  sql(
    `insert into notifications(recipient_id,actor_id,kind,event_key) values('${rafi}','${ayon}','follow','launch:later')`,
  );
  await page.getByRole("heading", { name: "খবর 🔔" }).focus();
  await expect(page.locator(".notification.entry-new")).toHaveCount(2);
  expect(
    sql(
      `select count(*) from notifications where recipient_id='${rafi}' and read_at is null`,
    ),
  ).toBe("1");
  await page
    .locator(".notification")
    .filter({ hasText: "প্রতিক্রিয়া" })
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(new RegExp(`/post/${post}`));
  await page.goBack();
  await expect(page.locator(".notification.entry-new")).toHaveCount(1);
  expect(
    sql(
      `select count(*) from notifications where recipient_id='${rafi}' and read_at is null`,
    ),
  ).toBe("0");
  await page.reload();
  await expect(page.locator(".notification")).toHaveCount(3);
  await expect(page.locator(".notification.entry-new")).toHaveCount(0);
  expect(
    sql(
      `select count(*) from notifications where recipient_id='${mithi}' and read_at is null`,
    ),
  ).toBe("1");
  sql(
    `delete from posts where id='${post}'; delete from notifications where event_key like 'launch:%'`,
  );
});

test("badge caps at 99+ with stable mobile/desktop placement and accessible names", async ({
  page,
}) => {
  sql(
    `delete from public.notifications where event_key like 'launch:cap:%'; insert into notifications(recipient_id,actor_id,kind,event_key) select '${rafi}','${mithi}','follow','launch:cap:'||i from generate_series(1,105) i`,
  );
  await login(page);
  for (const width of [320, 360, 768, 1280])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((t) => {
        localStorage.setItem("tuktak-theme", t);
        document.documentElement.dataset.theme = t;
      }, theme);
      const nav = page.locator(width > 760 ? ".desktop-nav" : ".bottom-nav");
      await expect(
        nav.getByRole("link", { name: "খবর, ৯৯+টি অপঠিত", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.mouse.move(0, 0);
      // Hidden/offscreen feed transitions need not finish for a navigation scan.
      await page.waitForFunction(
        (selector) =>
          !document
            .querySelector(selector)
            ?.getAnimations({ subtree: true })
            .some((animation) => animation.playState === "running"),
        width > 760 ? ".desktop-nav" : ".bottom-nav",
        { timeout: 5000 },
      );
      const accessibility = await new AxeBuilder({ page })
        .include(width > 760 ? ".desktop-nav" : ".bottom-nav")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      await page.screenshot({
        path: `test-results/polish-badge-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  await page.goto("/notifications");
  await expect
    .poll(() =>
      sql(
        `select count(*) from notifications where recipient_id='${rafi}' and read_at is null`,
      ),
    )
    .toBe("5");
  await page.getByRole("button", { name: "সব পড়া হয়েছে" }).click();
  await expect(page.locator(".notification-badge")).toHaveCount(0);
  expect(
    sql(
      `select count(*) from notifications where recipient_id='${rafi}' and read_at is null`,
    ),
  ).toBe("0");
  sql(`delete from public.notifications where event_key like 'launch:cap:%'`);
});

test("login/signup redirect valid viewers while guests and recovery utilities remain available", async ({
  page,
}) => {
  for (const route of ["/login", "/signup"]) {
    await page.goto(route);
    await expect(page.locator(".auth-card")).toBeVisible();
  }
  await login(page);
  for (const route of ["/login", "/signup"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/$/);
  }
  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: "লিংক পাঠাও" })).toBeVisible();
  await page.goto("/reset-password");
  await expect(page.getByLabel("নতুন password")).toBeVisible();
  await page.goto("/auth/callback?code=invalid&next=//evil.test");
  await expect(page).toHaveURL(/\/$/);
  await page.context().clearCookies();
  await page.goto("/auth/callback?code=invalid&next=//evil.test");
  await expect(page).toHaveURL(/\/login\?error=verification/);
});

test("signup errors appear beside fields, focus the first error, and do not reveal account email existence", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("তোমাকে কী নামে ডাকব?").fill("");
  await page.getByLabel("Username", { exact: true }).fill("bad-name");
  await page.getByLabel("ইমেইল", { exact: true }).fill("bad");
  await page.getByLabel("ব্যক্তিগত মোবাইল নম্বর", { exact: true }).fill("123");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "আড্ডায় যোগ দিই" }).click();
  await expect(page.locator(".field-error")).toHaveCount(5);
  await expect(page.getByLabel("তোমাকে কী নামে ডাকব?")).toBeFocused();
  await expect(
    page.getByLabel("ব্যক্তিগত মোবাইল নম্বর", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".form-summary")).toContainText("চিহ্ন দেওয়া");
  for (const width of [320, 360, 768, 1280])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.mouse.move(0, 0);
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => {})),
        ),
      );
      const result = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      await page.screenshot({
        path: `test-results/polish-errors-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  await page.getByLabel("তোমাকে কী নামে ডাকব?").fill("নতুন নাম");
  await page.getByLabel("Username", { exact: true }).fill("rafi");
  await page
    .getByLabel("ইমেইল", { exact: true })
    .fill("launch-unused@example.invalid");
  await page
    .getByLabel("ব্যক্তিগত মোবাইল নম্বর", { exact: true })
    .fill("01700000000");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-unused-password!32");
  await page.getByRole("button", { name: "আড্ডায় যোগ দিই" }).click();
  await expect(page.locator("#error-username")).toContainText(
    "কেউ নিয়ে ফেলেছে",
  );
  await expect(page.getByLabel("Username", { exact: true })).toBeFocused();
});

test("profile batches normalize Bengali digits, status limits use codepoints, and accents keep their IDs", async ({
  page,
}) => {
  const baseline = JSON.parse(
    sql(`select row_to_json(p) from profiles p where id='${rafi}'`),
  );
  await login(page);
  await page.goto("/settings/profile");
  await page.getByLabel("এখন কোথায় আছ?").selectOption("স্কুলে পড়ি");
  await page.getByLabel("SSC batch · ঐচ্ছিক").fill("20x৫");
  await page.getByLabel("আজ কেমন আছ? · ঐচ্ছিক").fill("a".repeat(41));
  await page.getByRole("button", { name: "পরিবর্তন রাখি" }).click();
  await expect(page.locator("#error-ssc_batch")).toBeVisible();
  await expect(page.locator("#error-status")).toBeVisible();
  await page.getByLabel("SSC batch · ঐচ্ছিক").fill("২০২৫");
  await page.getByLabel("আজ কেমন আছ? · ঐচ্ছিক").fill("🙂".repeat(40));
  await page.getByLabel("তোমার রঙ").selectOption("berry");
  await page.getByRole("button", { name: "পরিবর্তন রাখি" }).click();
  await expect(page.locator(".form-summary")).toContainText("হয়ে গেছে");
  expect(
    JSON.parse(
      sql(
        `select json_build_object('batch',ssc_batch,'status',status,'accent',accent) from profiles where id='${rafi}'`,
      ),
    ),
  ).toEqual({ batch: "2025", status: "🙂".repeat(40), accent: "berry" });
  await page.reload();
  await expect(page.getByLabel("SSC batch · ঐচ্ছিক")).toHaveValue("2025");
  await page.goto("/u/rafi");
  for (const width of [320, 360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  sql(
    `update profiles set status=${"'" + baseline.status.replaceAll("'", "''") + "'"},accent='${baseline.accent}',education=${"'" + baseline.education.replaceAll("'", "''") + "'"},ssc_batch='${baseline.ssc_batch}',hsc_batch='${baseline.hsc_batch}' where id='${rafi}'`,
  );
});

test("launch policy, branding, sidebar and sharing metadata are consistent", async ({
  page,
  request,
}) => {
  for (const route of ["/", "/privacy", "/community", "/terms"]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.locator('link[rel="canonical"]').getAttribute("href"),
    ).toBe("http://localhost:3000" + (route === "/" ? "" : route));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /og-image\.png/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  }
  await page.goto("/");
  await expect(page.locator(".vibe-card")).toHaveCount(0);
  await expect(
    page.locator(".hero-doodle svg.lucide-message-circle"),
  ).toHaveCount(1);
  expect(await page.locator("body").innerText()).not.toMatch(
    /Claude|Anthropic|OpenAI|ChatGPT|✺|✳/i,
  );
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /forgot-password");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/terms");
  expect(await sitemap.text()).not.toMatch(
    /settings|admin|notifications|login/,
  );
  const image = await request.get("/og-image.png");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const icon = await request.get("/icon.svg");
  expect(icon.status()).toBe(200);
  expect(await icon.text()).not.toMatch(/next|vercel|claude/i);
  await login(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/settings");
  await expect(
    page.getByRole("link", { name: "গোপনীয়তা ও সহায়তা" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ব্যবহারের শর্ত", exact: true }).last(),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("link", { name: "গোপনীয়তা ও সহায়তা" }).click();
  await expect(page).toHaveURL(/\/privacy#support$/);
});

test("onboarding reveals and focuses invalid status/batch fields without making optional fields required", async ({
  page,
}) => {
  const prior = sql(
    `select onboarding_complete from account_private where user_id='${rafi}'`,
  );
  sql(
    `update account_private set onboarding_complete=false where user_id='${rafi}'`,
  );
  try {
    await login(page);
    await page.goto("/onboarding");
    const status = page.locator('[data-field="status"]');
    await status.fill("a".repeat(41));
    await page.getByRole("button", { name: "পরের ধাপ →" }).click();
    await expect(page.locator("#error-status")).toBeVisible();
    await expect(status).toBeFocused();
    await status.fill("");
    await page.getByRole("button", { name: "পরের ধাপ →" }).click();
    await page.getByLabel("এখন কোথায় আছ?").selectOption("স্কুলে পড়ি");
    await page.getByRole("button", { name: "পরের ধাপ →" }).click();
    const batch = page.locator('[data-field="ssc_batch"]');
    await batch.fill("20x৫");
    await page.getByRole("button", { name: "পরের ধাপ →" }).click();
    await expect(page.locator("#error-ssc_batch")).toBeVisible();
    await expect(batch).toBeFocused();
    await batch.fill("২০২৫");
    await page.getByRole("button", { name: "পরের ধাপ →" }).click();
    await expect(
      page.getByRole("heading", { name: "যা যা ভালো লাগে।" }),
    ).toBeVisible();
    await expect(page.locator(".form-summary")).toHaveCount(0);
    // No profile save: the existing fictional seed profile is preserved.
  } finally {
    sql(
      `update account_private set onboarding_complete=${prior === "t" ? "true" : "false"} where user_id='${rafi}'`,
    );
  }
});
