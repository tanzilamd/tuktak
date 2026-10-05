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
  await page.goto("/discover?q=mithi");
  await expect(
    page.getByRole("button", { name: "সাথে আছি ✓" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/u/rafi/following");
  await expect(
    page.getByRole("button", { name: "সাথে আছি ✓" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/u/mithi/followers");
  await expect(page.locator(".people-grid")).toContainText("রাফি আহমেদ");
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
    await page.getByRole("link", { name: "অপেক্ষায় রিপোর্ট" }).click();
    const report = page
      .locator("article")
      .filter({ hasText: "স্প্যাম" })
      .first();
    await report.getByRole("button", { name: "বন্ধ করি" }).click();
    await expect(report).not.toBeVisible();
    await page.goto("/moderation/audit");
    await expect(page.getByText("বন্ধ করা · user")).toBeVisible();
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

for (const visible of [false, true]) {
  test(`returning onboarding preserves saved profile fields and institution visibility=${visible}`, async ({
    page,
  }) => {
    test.skip(
      process.env.LOCAL_SUPABASE_TESTS !== "1",
      "Disposable local stack only",
    );
    const id = "00000000-0000-4000-8000-000000000001";
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
    const snapshotSQL = `select jsonb_build_object('profile',row_to_json(p),'private',jsonb_build_object('institution',a.institution,'institution_visible',a.institution_visible,'onboarding_complete',a.onboarding_complete)) from profiles p join account_private a on a.user_id=p.id where p.id='${id}'`;
    const original = JSON.parse(sql(snapshotSQL));
    const literal = (value: unknown) =>
      "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
    try {
      sql(
        `update profiles set education='স্কুলে পড়ি',class_year='দশম',ssc_batch='2027',hsc_batch='2029',bio='আগের নিজের কথা',hobbies=array['বই'],status='🌱',institution=${visible ? "'আগের স্কুল'" : "null"},institution_key=${visible ? "'আগের স্কুল'" : "null"} where id='${id}'; update account_private set institution='আগের স্কুল',institution_visible=${visible},onboarding_complete=true where user_id='${id}'`,
      );
      const saved = JSON.parse(sql(snapshotSQL));
      await login(page);
      await page.goto("/onboarding");
      await expect(page).toHaveURL(/\/settings\/profile$/);
      await expect(
        page.getByLabel("প্রতিষ্ঠান · পুরোপুরি ঐচ্ছিক", { exact: true }),
      ).toHaveValue("আগের স্কুল");
      await expect(
        page.getByLabel("ক্লাস · ঐচ্ছিক", { exact: true }),
      ).toHaveValue("দশম");
      await expect(
        page.getByLabel("SSC batch · ঐচ্ছিক", { exact: true }),
      ).toHaveValue("2027");
      const checkbox = page.getByLabel(
        "প্রোফাইলে দেখাও ও প্রতিষ্ঠানের আড্ডায় যোগ দাও",
        { exact: true },
      );
      if (visible) await expect(checkbox).toBeChecked();
      else await expect(checkbox).not.toBeChecked();
      expect(await page.content()).not.toContain("+8801700000000");
      expect(JSON.parse(sql(snapshotSQL))).toEqual(saved);
    } finally {
      sql(
        `update profiles p set (education,class_year,ssc_batch,hsc_batch,bio,hobbies,status,institution,institution_key)=(select x.education,x.class_year,x.ssc_batch,x.hsc_batch,x.bio,x.hobbies,x.status,x.institution,x.institution_key from jsonb_populate_record(null::profiles,${literal(original.profile)}) x) where p.id='${id}'; update account_private a set (institution,institution_visible,onboarding_complete)=(select x.institution,x.institution_visible,x.onboarding_complete from jsonb_populate_record(null::account_private,${literal(original.private)}) x) where a.user_id='${id}'`,
      );
    }
  });
}

test("Discover ranks older posts with more aggregate reactions above newer posts", async ({
  page,
}) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Disposable local stack only",
  );
  const high = "20000000-0000-4000-8000-000000000001";
  const low = "20000000-0000-4000-8000-000000000002";
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
        "-c",
        statement,
      ],
      { stdio: "pipe" },
    );
  try {
    sql(
      `insert into posts(id,author_id,body,created_at) values('${high}','00000000-0000-4000-8000-000000000001','আগের জনপ্রিয় কথা',now()-interval '1 minute'),('${low}','00000000-0000-4000-8000-000000000001','নতুন কম প্রতিক্রিয়ার কথা',now()); insert into reactions(post_id,user_id,kind) select '${high}',id,case when username='mithi' then 'haha' else 'love' end from profiles; insert into reactions(post_id,user_id,kind) values('${low}','00000000-0000-4000-8000-000000000002','love'),('${low}','00000000-0000-4000-8000-000000000003','fire')`,
    );
    await page.goto("/discover");
    await expect(
      page.getByText("আগের জনপ্রিয় কথা", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("নতুন কম প্রতিক্রিয়ার কথা", { exact: true }),
    ).toBeVisible();
    const bodies = await page
      .locator(".post-list .post-body")
      .allTextContents();
    expect(bodies.indexOf("আগের জনপ্রিয় কথা")).toBeLessThan(
      bodies.indexOf("নতুন কম প্রতিক্রিয়ার কথা"),
    );
  } finally {
    sql(`delete from posts where id in ('${high}','${low}')`);
  }
});
