import { test, expect, type Page, type Route } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";

const me = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
let own: string, foreign: string;
let quoteIds: string[] = [];
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
async function hold(page: Page, action: string, reject = false) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  const handler = async (route: Route) => {
    if (
      route.request().method() !== "POST" ||
      route.request().postDataJSON().action !== action
    )
      return route.continue();
    requests++;
    await gate;
    if (reject)
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          message: "কাজটা করা গেল না। আবার চেষ্টা করো।",
        }),
      });
    else await route.continue();
  };
  await page.route("**/api/social", handler);
  return {
    release,
    count: () => requests,
    close: () => page.unroute("**/api/social", handler),
  };
}
test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Disposable fictional local stack only",
  );
  if (
    process.env.E2E_BASE_URL &&
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.E2E_BASE_URL)
  )
    throw new Error("Fictional fixtures require loopback");
  own = randomUUID();
  foreign = randomUUID();
  quoteIds = [];
  sql(
    `delete from action_receipts where user_id='${me}' and action in ('post','comment','edit_post','vote_poll'); insert into posts(id,author_id,body) values('${own}','${me}','engagement: নিজের কথা ${own}'),('${foreign}','${other}','engagement: অন্য কথা ${foreign}');`,
  );
  await login(page);
});
test.afterEach(() => {
  if (process.env.LOCAL_SUPABASE_TESTS === "1" && own)
    sql(
      `delete from posts where author_id='${me}' and quoted_post_id='${foreign}'; delete from posts where id in ('${own}','${foreign}'${quoteIds.map((id) => `, '${id}'`).join("")}) or (author_id='${me}' and body like 'engagement:%');`,
    );
});

test("thread replies are instant, flatten reply-to-reply, notify, and safely rollback", async ({
  page,
}) => {
  const root = sql(
    `insert into comments(post_id,author_id,body) values('${own}','${other}','মূল উত্তর') returning id`,
  ).split("\n")[0];
  await page.goto(`/post/${own}`);
  await page
    .locator(`#comment-${root}`)
    .getByRole("button", { name: "জবাব দিই" })
    .click();
  const form = page.locator(".thread-composer form");
  await expect(form.getByRole("textbox")).toBeFocused();
  await form.getByRole("textbox").fill("প্রথম জবাব @mithi");
  const gate = await hold(page, "comment");
  await form.getByRole("button", { name: "উত্তর দিই", exact: true }).click();
  await expect(page.locator(".comment-reply[aria-busy=true]")).toContainText(
    "প্রথম জবাব",
  );
  await expect(page.locator(".reply-section h2")).toHaveText("২টা উত্তর");
  gate.release();
  await expect(page.locator(".comment-reply")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await gate.close();
  const child = sql(`select id from comments where parent_id='${root}'`);
  expect(
    sql(
      `select kind from notifications where recipient_id='${other}' and comment_id='${child}'`,
    ),
  ).toBe("reply");
  await expect(page.locator(`#comment-${child} .mention`)).toHaveAttribute(
    "href",
    "/u/mithi",
  );
  await page
    .locator(`#comment-${child}`)
    .getByRole("button", { name: "জবাব দিই" })
    .click();
  await expect(form.getByRole("textbox")).toHaveValue("@rafi ");
  await form.getByRole("textbox").fill("দ্বিতীয় জবাব");
  await form.getByRole("button", { name: "উত্তর দিই", exact: true }).click();
  await expect(page.locator(".comment-reply")).toHaveCount(2);
  await expect(form).toHaveCount(0);
  expect(
    sql(
      `select count(*) from comments where post_id='${own}' and parent_id='${root}'`,
    ),
  ).toBe("2");
  await page
    .locator(`#comment-${root}`)
    .getByRole("button", { name: "জবাব দিই" })
    .click();
  await form.getByRole("textbox").fill("ব্যর্থ জবাবের খসড়া");
  const fail = await hold(page, "comment", true);
  await form.getByRole("button", { name: "উত্তর দিই", exact: true }).click();
  await expect(page.locator(".comment-reply")).toHaveCount(3);
  fail.release();
  await expect(page.locator(".comment-reply")).toHaveCount(2);
  await expect(form.getByRole("textbox")).toHaveValue("ব্যর্থ জবাবের খসড়া");
  await expect(form.getByRole("alert")).toBeVisible();
  await fail.close();
  await page.goto(`/post/${own}?comment=${child}#comment-${child}`);
  await expect(page.locator(`#comment-${child}`)).toBeVisible();
});

test("own post edits preserve creation time and mention/hashtag rules, while failed edits retain drafts", async ({
  page,
}) => {
  await page.goto(`/post/${own}`);
  const card = page.locator(".post-card");
  await card.getByLabel("পোস্টের আরও অপশন").click();
  await card.getByRole("button", { name: "সম্পাদনা করি" }).click();
  const editor = card.locator(".post-editor");
  await expect(editor.getByRole("textbox")).toBeFocused();
  const body = "engagement: বদলে বলি @mithi @missing_person #আড্ডা";
  await editor.getByRole("textbox").fill(body);
  const fail = await hold(page, "edit_post", true);
  await editor.getByRole("button", { name: "রেখে দিই" }).click();
  fail.release();
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(editor.getByRole("textbox")).toHaveValue(body);
  await fail.close();
  await editor.getByRole("button", { name: "রেখে দিই" }).click();
  await expect(editor).toHaveCount(0);
  await expect(card.locator(".edited-label")).toHaveText("সম্পাদিত");
  await expect(card.locator(".mention")).toHaveCount(1);
  await expect(card.locator(".mention")).toHaveAttribute("href", "/u/mithi");
  expect(
    sql(
      `select count(*) from notifications where recipient_id='${other}' and post_id='${own}' and kind='mention'`,
    ),
  ).toBe("1");
  expect(sql(`select tag from post_hashtags where post_id='${own}'`)).toBe(
    "আড্ডা",
  );
  await card.getByLabel("পোস্টের আরও অপশন").click();
  await card.getByRole("button", { name: "সম্পাদনা করি" }).click();
  sql(
    `update posts set created_at=now()-interval '16 minutes' where id='${own}'`,
  );
  await editor.getByRole("textbox").fill("engagement: সময় পার");
  await editor.getByRole("button", { name: "রেখে দিই" }).click();
  await expect(editor.getByRole("alert")).toContainText("১৫ মিনিট");
  expect(sql(`select body from posts where id='${own}'`)).toBe(body);
});

test("quote/repost accepts optional commentary, flattens references and handles a deleted original", async ({
  page,
}) => {
  sql(
    `insert into polls values('${foreign}',now()+interval '1 day'); insert into poll_options(post_id,position,body) values('${foreign}',1,'চা'),('${foreign}',2,'কফি');`,
  );
  await page.goto(`/post/${foreign}`);
  await page.getByLabel("পোস্টের আরও অপশন").click();
  await page.getByLabel("আবার শেয়ার করি").click();
  await expect(page).toHaveURL(new RegExp(`/compose\\?quote=${foreign}`));
  await expect(page.locator(".quote-preview")).toContainText("অন্য কথা");
  await page.getByRole("button", { name: "বলে ফেলি", exact: true }).click();
  await expect(page).toHaveURL(/\/post\/[0-9a-f-]{36}$/);
  const quoteId = sql(
    `select id from posts where author_id='${me}' and quoted_post_id='${foreign}'`,
  );
  quoteIds.push(quoteId);
  await page.goto(`/post/${quoteId}`);
  await expect(page.locator(".quote-preview")).toHaveCount(1);
  await expect(page.locator(".poll-card")).toHaveCount(0);
  await page.getByRole("link", { name: "পোল · মূল পোস্টে দেখি →" }).click();
  await expect(page).toHaveURL(new RegExp(`/post/${foreign}$`));
  await expect(page.locator(".poll-option")).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/post/${quoteId}$`));
  await page.getByLabel("পোস্টের আরও অপশন").click();
  await page.getByLabel("আবার শেয়ার করি").click();
  await expect(page).toHaveURL(new RegExp(`/compose\\?quote=${foreign}`));
  await page.getByLabel("মাথায় কী ঘুরছে?").fill("engagement: আমার কথাও");
  await page.getByRole("button", { name: "বলে ফেলি", exact: true }).click();
  await expect(page).toHaveURL(/\/post\/[0-9a-f-]{36}$/);
  expect(
    sql(
      `select count(*) from notifications where recipient_id='${other}' and kind='quote' and post_id in(select id from posts where quoted_post_id='${foreign}')`,
    ),
  ).toBe("2");
  sql(`delete from posts where id='${foreign}'`);
  await page.goto(`/post/${quoteId}`);
  await expect(page.locator(".quote-preview")).toContainText(
    "মূল পোস্টটি এখন দেখা যাচ্ছে না।",
  );
  sql(`delete from posts where id='${quoteId}'`);
});

test("poll creation, instant/change votes, rollback and final expiration preserve the parent post", async ({
  page,
}) => {
  const body = `engagement: চা না কফি ${randomUUID()} #পোল`;
  await page.getByLabel("মাথায় কী ঘুরছে?").fill(body);
  await page.getByRole("button", { name: "+ পোল", exact: true }).click();
  await page.getByLabel("উত্তর ১", { exact: true }).fill("চা");
  await page.getByLabel("উত্তর ২", { exact: true }).fill("কফি");
  await page.getByRole("button", { name: "বলে ফেলি", exact: true }).click();
  const card = page.locator(".post-card").filter({ hasText: body });
  await expect(card.locator(".poll-option")).toHaveCount(2);
  const id = sql(`select id from posts where body='${body}'`);
  await expect(card).not.toHaveAttribute("aria-busy", "true");
  const gate = await hold(page, "vote_poll");
  await card.locator(".poll-option").first().click();
  await expect(card.locator(".poll-option").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(card.locator(".poll-summary")).toContainText("১ ভোট");
  await expect(card.locator(".poll-option").last()).toBeDisabled();
  await expect.poll(gate.count).toBe(1);
  gate.release();
  await expect(card.locator(".poll-option").last()).toBeEnabled();
  await gate.close();
  await card.locator(".poll-option").last().click();
  await expect(card.locator(".poll-option").last()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(card.locator(".poll-option").first()).toBeEnabled();
  expect(
    sql(
      `select count(*) from poll_votes where post_id='${id}' and user_id='${me}'`,
    ),
  ).toBe("1");
  const fail = await hold(page, "vote_poll", true);
  await card.locator(".poll-option").first().click();
  await expect(card.locator(".poll-option").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fail.release();
  await expect(card.locator(".poll-option").last()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(card.locator(".poll-card [role=alert]")).toBeVisible();
  await fail.close();
  sql(
    `update polls set expires_at=now()-interval '1 second' where post_id='${id}'`,
  );
  // The server rejects a vote even if this mounted client still thinks it is open.
  await card.locator(".poll-option").first().click();
  await expect(card.locator(".poll-summary")).toContainText("ভোটগ্রহণ শেষ");
  await expect(card.locator(".poll-summary")).toContainText("১ ভোট");
  await expect(card.locator(".poll-option").first()).toBeDisabled();
  expect(
    sql(`select count(*) from posts where id='${id}' and not hidden`),
  ).toBe("1");
  for (const path of ["/", "/u/rafi", "/discover", "/tag/পোল", `/post/${id}`]) {
    await page.goto(path);
    const pollCard = page.locator(".post-card").filter({ hasText: body });
    await expect(pollCard.locator(".poll-summary")).toContainText(
      "ভোটগ্রহণ শেষ",
    );
    await expect(pollCard.locator(".poll-summary")).toContainText("১ ভোট");
  }
});

test("reply, quote and poll layouts preserve themes, mobile widths and accessible controls", async ({
  page,
}) => {
  test.setTimeout(120000);
  const root = sql(
    `insert into comments(post_id,author_id,body) values('${own}','${other}','একটু লম্বা বাংলা উত্তর') returning id`,
  ).split("\n")[0];
  sql(
    `insert into comments(post_id,author_id,body,parent_id) values('${own}','${me}','অনেক লম্বা বাংলা কথার সঙ্গে @mithi — এক লাইনে না ধরলেও ঠিকমতো পড়া যায় 🌿','${root}'); update posts set is_quote=true,quoted_post_id='${foreign}',updated_at=now() where id='${own}'; insert into polls values('${own}',now()+interval '1 day'); insert into poll_options(post_id,position,body) values('${own}',1,'বাংলা লম্বা উত্তর — চা দিয়ে সকাল'),('${own}',2,'কফি দিয়ে আড্ডা');`,
  );
  await page.goto(`/post/${own}`);
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
      await page.emulateMedia({ reducedMotion: "reduce" });
      const accessibility = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      await page.screenshot({
        path: `test-results/engagement-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  await page.getByRole("button", { name: "জবাব দিই" }).first().click();
  await expect(page.locator(".thread-composer textarea")).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "+ পোল", exact: true }).click();
  await page.getByRole("button", { name: "উত্তর যোগ করি" }).click();
  await page.getByRole("button", { name: "উত্তর যোগ করি" }).click();
  await expect(page.locator(".poll-input-row")).toHaveCount(4);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const a11y = await new AxeBuilder({ page })
    .include(".composer")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
});

test("mounted polls close with a single bounded expiry refresh and retain late final votes", async ({
  page,
}) => {
  sql(
    `insert into polls(post_id,expires_at) values('${own}',now()+interval '6 seconds'),('${foreign}',now()+interval '6 seconds'); insert into poll_options(post_id,position,body) select post_id,i,'উত্তর '||i from polls cross join generate_series(1,2) i where post_id in('${own}','${foreign}');`,
  );
  let reads = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/social?stats=")) reads++;
  });
  await page.goto("/");
  const ownCard = page
    .locator(".post-card")
    .filter({ hasText: `নিজের কথা ${own}` });
  await expect(ownCard.locator(".poll-option").first()).toBeEnabled();
  sql(
    `insert into poll_votes(post_id,user_id,option_id) select '${own}','${other}',id from poll_options where post_id='${own}' and position=1;`,
  );
  await expect(ownCard.locator(".poll-summary")).toContainText("ভোটগ্রহণ শেষ");
  await expect(ownCard.locator(".poll-summary")).toContainText("১ ভোট");
  await expect(ownCard.locator(".poll-option").first()).toBeDisabled();
  expect(reads).toBe(1);
  expect(
    sql(
      `select count(*) from posts where id in('${own}','${foreign}') and not hidden`,
    ),
  ).toBe("2");
});

test("a lost edit response reconciles an actual commit without replaying the write", async ({
  page,
}) => {
  await page.goto(`/post/${own}`);
  await page.getByLabel("পোস্টের আরও অপশন").click();
  await page.getByRole("button", { name: "সম্পাদনা করি" }).click();
  const editor = page.locator(".post-editor");
  await editor.getByRole("textbox").fill("engagement: হারানো রেসপন্সের কথা");
  let writes = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/social**", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      request.postDataJSON().action === "edit_post"
    ) {
      writes++;
      const committed = await route.fetch();
      expect(committed.ok()).toBe(true);
      await route.abort();
    } else if (
      request.method() === "GET" &&
      new URL(request.url()).searchParams.get("id") === own
    ) {
      await gate;
      await route.continue();
    } else await route.continue();
  });
  await editor.getByRole("button", { name: "রেখে দিই" }).click();
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(editor.getByRole("button", { name: "রাখছি…" })).toBeDisabled();
  expect(sql(`select body from posts where id='${own}'`)).toBe(
    "engagement: হারানো রেসপন্সের কথা",
  );
  release();
  await expect(editor.getByRole("button", { name: "রেখে দিই" })).toBeEnabled();
  await editor.getByRole("button", { name: "থাক", exact: true }).click();
  await expect(page.locator(".post-body")).toContainText(
    "হারানো রেসপন্সের কথা",
  );
  await expect(page.locator(".edited-label")).toBeVisible();
  expect(writes).toBe(1);
});

test("canonical unavailability after an edit hides the card rather than restoring removed content", async ({
  page,
}) => {
  await page.goto(`/post/${own}`);
  await page.getByLabel("পোস্টের আরও অপশন").click();
  await page.getByRole("button", { name: "সম্পাদনা করি" }).click();
  await page.locator(".post-editor textarea").fill("engagement: আর নেই");
  await page.route("**/api/social", async (route) => {
    if (
      route.request().method() !== "POST" ||
      route.request().postDataJSON().action !== "edit_post"
    )
      return route.continue();
    const committed = await route.fetch();
    expect(committed.ok()).toBe(true);
    // Simulate removal between the committed write and canonical serialization.
    sql(`delete from posts where id='${own}'`);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, message: "হয়ে গেছে ✨" }),
    });
  });
  await page.getByRole("button", { name: "রেখে দিই" }).click();
  await expect(page.locator(".post-card")).toHaveCount(0);
  await expect(page.locator(".reply-section")).toHaveCount(0);
});

test("a restored inbox clears old rows before checking the current session", async ({
  page,
}) => {
  const eventKey = `engagement:restore:${randomUUID()}`;
  sql(
    `insert into notifications(recipient_id,actor_id,kind,event_key) values('${me}','${other}','follow','${eventKey}')`,
  );
  try {
    await page.goto("/notifications");
    await expect(page.locator(".notification.entry-new").first()).toBeVisible();
    await page.context().clearCookies();
    // Simulates bfcache lifecycle; native Next back/forward is covered separately.
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await expect(page.locator(".notification")).toHaveCount(0);
    await expect(page.locator("#main").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "আবার চেষ্টা করি" }),
    ).toBeVisible();
  } finally {
    sql(`delete from notifications where event_key='${eventKey}'`);
  }
});
