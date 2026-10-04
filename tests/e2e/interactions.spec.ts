import { test, expect, type Page, type Route } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const me = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
let own: string, foreign: string;
function sql(statement: string) {
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
      statement,
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
          message: "কাজটা করা গেল না। অনুমতি ও তথ্য দেখে আবার চেষ্টা করো।",
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
    "Disposable local database only",
  );
  if (
    process.env.E2E_BASE_URL &&
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.E2E_BASE_URL)
  )
    throw new Error("Local fixtures cannot target a hosted app");
  own = randomUUID();
  foreign = randomUUID();
  sql(
    `insert into posts(id,author_id,body) values('${own}','${me}','UX own ${own}'),('${foreign}','${other}','UX other ${foreign}'); delete from follows where follower_id='${me}' and following_id='${other}';`,
  );
  await login(page);
});
test.afterEach(() => {
  if (process.env.LOCAL_SUPABASE_TESTS === "1" && own && foreign)
    sql(
      `delete from posts where id in ('${own}','${foreign}'); delete from follows where follower_id='${me}' and following_id='${other}'; update user_roles set suspended=false where user_id='${me}'; delete from mutes where muter_id='${me}' and muted_id='${other}';`,
    );
});

test("post appears before response, duplicate submit is blocked and confirmed ID replaces the draft", async ({
  page,
}) => {
  const gate = await hold(page, "post");
  const body = `তাৎক্ষণিক কথা ${randomUUID()}`;
  await page.getByLabel("মাথায় কী ঘুরছে?").fill(body);
  await page.getByRole("button", { name: "বলে ফেলি", exact: true }).click();
  const card = page.locator(".post-card").filter({ hasText: body });
  await expect(card).toBeVisible({ timeout: 750 });
  await expect(card).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".composer button[type=submit]")).toBeDisabled();
  await page
    .locator(".composer")
    .evaluate((form) =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  await expect.poll(gate.count).toBe(1);
  gate.release();
  await expect(card).not.toHaveAttribute("aria-busy", "true");
  await expect(card.getByLabel("পোস্ট খুলে দেখি")).toHaveAttribute(
    "href",
    /^\/post\/[0-9a-f-]{36}$/,
  );
  await expect(card).toHaveCount(1);
  const id = (await card.getByLabel("পোস্ট খুলে দেখি").getAttribute("href"))!
    .split("/")
    .at(-1)!;
  expect(
    sql(`select count(*) from posts where id='${id}' and author_id='${me}'`),
  ).toBe("1");
  await gate.close();
  page.on("dialog", (d) => d.accept());
  await card.getByLabel("পোস্টের আরও অপশন").click();
  const deleted = await hold(page, "delete_post");
  await card.getByRole("button", { name: "পোস্ট মুছে দিই" }).click();
  await expect(card).toHaveCount(0, { timeout: 750 });
  deleted.release();
  await expect
    .poll(() => sql(`select count(*) from posts where id='${id}'`))
    .toBe("0");
  await deleted.close();
});

test("reaction add/switch/remove is immediate, serialized and rolls back rejected writes", async ({
  page,
}) => {
  const card = page
    .locator(".post-card")
    .filter({ hasText: `UX other ${foreign}` });
  for (const [kind, label, selected] of [
    ["love", /ভালো লাগলো/, "true"],
    ["haha", /সেই/, "true"],
    ["haha", /সেই/, "false"],
  ] as const) {
    const gate = await hold(page, "react");
    await card.getByLabel(label).click();
    await expect(card.getByLabel(label)).toHaveAttribute(
      "aria-pressed",
      selected,
      { timeout: 750 },
    );
    await expect(card.getByLabel(/বুঝি ভাই/)).toBeDisabled();
    await card
      .locator("form")
      .filter({ has: page.locator('input[value="relate"]') })
      .evaluate((form) =>
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
    await expect.poll(gate.count).toBe(1);
    gate.release();
    await expect(card.getByLabel(label)).toBeEnabled();
    expect(
      sql(
        `select coalesce((select kind from reactions where post_id='${foreign}' and user_id='${me}'),'none')`,
      ),
    ).toBe(selected === "true" ? kind : "none");
    await gate.close();
  }
  const failed = await hold(page, "react", true);
  await card.getByLabel(/ভালো লাগলো/).click();
  await expect(card.getByLabel(/ভালো লাগলো/)).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 750 },
  );
  failed.release();
  await expect(card.getByLabel(/ভালো লাগলো/)).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(card.getByRole("alert")).toBeVisible();
  await failed.close();
});

test("comments and counts appear immediately, reconcile, and restore on failed deletion", async ({
  page,
}) => {
  await page.goto(`/post/${foreign}`);
  const body = `তাৎক্ষণিক উত্তর ${randomUUID()}`;
  const gate = await hold(page, "comment");
  await page.getByLabel("কথায় কথা বাড়ুক").fill(body);
  await page.getByRole("button", { name: "উত্তর দিই", exact: true }).click();
  const comment = page.locator(".comment").filter({ hasText: body });
  await expect(comment).toBeVisible({ timeout: 750 });
  await expect(page.locator(".reply-section h2")).toHaveText("১টা উত্তর");
  await expect(page.locator(".reply-link span")).toHaveText("১");
  gate.release();
  await expect(
    comment.getByRole("button", { name: "মুছে দিই", exact: true }),
  ).toBeEnabled();
  await gate.close();
  page.on("dialog", (d) => d.accept());
  const failed = await hold(page, "delete_comment", true);
  await comment.getByRole("button", { name: "মুছে দিই", exact: true }).click();
  await expect(comment).toHaveCount(0, { timeout: 750 });
  await expect(page.locator(".reply-section h2")).toHaveText("০টা উত্তর");
  failed.release();
  await expect(comment).toBeVisible();
  await expect(page.locator(".reply-section h2")).toHaveText("১টা উত্তর");
  await failed.close();
  const rejected = await hold(page, "comment", true);
  await page.getByLabel("কথায় কথা বাড়ুক").fill("ব্যর্থ উত্তর");
  await page.getByRole("button", { name: "উত্তর দিই", exact: true }).click();
  await expect(
    page.locator(".comment").filter({ hasText: "ব্যর্থ উত্তর" }),
  ).toBeVisible({ timeout: 750 });
  rejected.release();
  await expect(
    page.locator(".comment").filter({ hasText: "ব্যর্থ উত্তর" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("কথায় কথা বাড়ুক")).toHaveValue("ব্যর্থ উত্তর");
  await expect(page.locator(".reply-section h2")).toHaveText("১টা উত্তর");
  await rejected.close();
});

test("follow counts update instantly and rollback; feed selection is local and history-safe", async ({
  page,
}) => {
  await page.goto("/u/mithi");
  const followers = page.locator(".profile-links a").first().locator("b");
  const initial = await followers.textContent();
  const gate = await hold(page, "follow");
  await page.getByRole("button", { name: "সাথে থাকি +" }).click();
  await expect(page.getByRole("button", { name: "সাথে আছি ✓" })).toBeVisible({
    timeout: 750,
  });
  await expect(followers).not.toHaveText(initial!);
  gate.release();
  await expect(page.getByRole("button", { name: "সাথে আছি ✓" })).toBeEnabled();
  await gate.close();
  const failed = await hold(page, "follow", true);
  await page.getByRole("button", { name: "সাথে আছি ✓" }).click();
  await expect(page.getByRole("button", { name: "সাথে থাকি +" })).toBeVisible({
    timeout: 750,
  });
  await expect(followers).toHaveText(initial!);
  failed.release();
  await expect(page.getByRole("button", { name: "সাথে আছি ✓" })).toBeVisible();
  await failed.close();
  const unfollow = await hold(page, "follow");
  await page.getByRole("button", { name: "সাথে আছি ✓" }).click();
  await expect(page.getByRole("button", { name: "সাথে থাকি +" })).toBeVisible({
    timeout: 750,
  });
  await expect(followers).toHaveText(initial!);
  unfollow.release();
  await expect(page.getByRole("button", { name: "সাথে থাকি +" })).toBeEnabled();
  expect(
    sql(
      `select count(*) from follows where follower_id='${me}' and following_id='${other}'`,
    ),
  ).toBe("0");
  await unfollow.close();
  await page.getByRole("button", { name: "সাথে থাকি +" }).click();
  await expect(page.getByRole("button", { name: "সাথে আছি ✓" })).toBeEnabled();
  await page.goto("/");
  let release!: () => void;
  const wait = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/social?feed=following", async (route) => {
    await wait;
    await route.continue();
  });
  await page.getByLabel("মাথায় কী ঘুরছে?").fill("খসড়া থাকে");
  await page
    .locator(".feed-tabs")
    .getByRole("link", { name: "যাদের সাথে আছি" })
    .click();
  await expect(page.locator(".feed-tabs .active")).toHaveText(
    "যাদের সাথে আছি",
    { timeout: 750 },
  );
  await expect(page.getByLabel("মাথায় কী ঘুরছে?")).toHaveValue("খসড়া থাকে");
  await page.locator(".feed-tabs").getByRole("link", { name: /সবার/ }).click();
  await expect(page.locator(".feed-tabs .active")).toContainText("সবার", {
    timeout: 750,
  });
  release();
  await page.waitForTimeout(300);
  await expect(page.locator(".feed-tabs .active")).toContainText("সবার");
  await page.goBack();
  await expect(page.locator(".feed-tabs .active")).toHaveText("যাদের সাথে আছি");
  await expect(
    page.getByText(`UX other ${foreign}`, { exact: true }),
  ).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
});

test("real suspended-user rejection rolls back post; own post delete failure restores content", async ({
  page,
}) => {
  const gate = await hold(page, "post");
  await page.getByLabel("মাথায় কী ঘুরছে?").fill("অনুমতি ছাড়া সফল নয়");
  await page.getByRole("button", { name: "বলে ফেলি", exact: true }).click();
  const draft = page
    .locator(".post-card")
    .filter({ hasText: "অনুমতি ছাড়া সফল নয়" });
  await expect(draft).toBeVisible({ timeout: 750 });
  sql(`update user_roles set suspended=true where user_id='${me}'`);
  gate.release();
  await expect(draft).toHaveCount(0);
  await expect(page.getByLabel("মাথায় কী ঘুরছে?")).toHaveValue(
    "অনুমতি ছাড়া সফল নয়",
  );
  await expect(page.locator(".composer").getByRole("alert")).toContainText(
    "স্থগিত",
  );
  sql(`update user_roles set suspended=false where user_id='${me}'`);
  await gate.close();
  const card = page.locator(".post-card").filter({ hasText: `UX own ${own}` });
  page.on("dialog", (d) => d.accept());
  await card.getByLabel("পোস্টের আরও অপশন").click();
  const failed = await hold(page, "delete_post", true);
  await card.getByRole("button", { name: "পোস্ট মুছে দিই" }).click();
  await expect(card).toHaveCount(0, { timeout: 750 });
  failed.release();
  await expect(card).toBeVisible();
  expect(sql(`select count(*) from posts where id='${own}'`)).toBe("1");
  await failed.close();
});

test("navigation during a pending follow reconciles the destination after confirmation", async ({
  page,
}) => {
  await page.goto("/discover?q=mithi");
  const gate = await hold(page, "follow");
  await page.getByRole("button", { name: "সাথে থাকি +" }).click();
  await expect(page.getByRole("button", { name: "সাথে আছি ✓" })).toBeDisabled();
  await page.locator(".people-grid .post-person").click();
  await expect(page).toHaveURL(/\/u\/mithi$/);
  await expect(page.getByRole("button", { name: "সাথে থাকি +" })).toBeVisible();
  gate.release();
  await expect(page.getByRole("button", { name: "সাথে আছি ✓" })).toBeEnabled();
  await gate.close();
});

test("mute revalidation replaces the feed's local snapshot and enforces visibility", async ({
  page,
}) => {
  const card = page
    .locator(".post-card")
    .filter({ hasText: `UX other ${foreign}` });
  await card.getByLabel("পোস্টের আরও অপশন").click();
  await card.getByRole("button", { name: "চুপ রাখি (mute)" }).click();
  await expect(card).toHaveCount(0);
  await expect(
    page.locator(".post-card").filter({ hasText: `UX own ${own}` }),
  ).toBeVisible();
});

test("lost mutation responses keep writes serialized until canonical recovery completes", async ({
  page,
}) => {
  await page.goto(`/post/${foreign}`);
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  let writes = 0;
  await page.route("**/api/social", async (route) => {
    if (route.request().method() === "POST") {
      writes++;
      return route.abort("failed");
    }
    await route.continue();
  });
  await page.route(`**/api/social?id=${foreign}`, async (route) => {
    await gate;
    await route.continue();
  });
  const reaction = page.locator(".post-card").getByLabel(/ভালো লাগলো/);
  await reaction.click();
  await expect(reaction).toHaveAttribute("aria-pressed", "false");
  await expect(reaction).toBeDisabled();
  expect(writes).toBe(1);
  release();
  await expect(reaction).toBeEnabled();
  await expect(reaction).toHaveAttribute("aria-pressed", "false");
  await page.unrouteAll({ behavior: "wait" });
});

for (const action of [
  "follow",
  "comment",
  "delete_post",
  "delete_comment",
] as const) {
  test(`lost ${action} response rolls back and guards new writes during recovery`, async ({
    page,
  }) => {
    if (action === "delete_comment")
      sql(
        `insert into comments(post_id,author_id,body) values('${foreign}','${me}','Recovery fixture reply')`,
      );
    await page.goto(
      action === "follow"
        ? "/u/mithi"
        : `/post/${action === "delete_post" ? own : foreign}`,
    );
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    let writes = 0;
    await page.route("**/api/social", async (route) => {
      if (route.request().method() === "POST") {
        writes++;
        return route.abort("failed");
      }
      await route.continue();
    });
    const query =
      action === "follow"
        ? `follow=${other}`
        : `id=${action === "delete_post" ? own : foreign}`;
    await page.route(`**/api/social?${query}`, async (route) => {
      await gate;
      await route.continue();
    });
    let control;
    if (action === "follow") {
      await page.getByRole("button", { name: "সাথে থাকি +" }).click();
      control = page.getByRole("button", { name: "সাথে থাকি +" });
    } else if (action === "comment") {
      await page.getByLabel("কথায় কথা বাড়ুক").fill("Recovery pending reply");
      await page
        .getByRole("button", { name: "উত্তর দিই", exact: true })
        .click();
      await expect(page.getByLabel("কথায় কথা বাড়ুক")).toHaveValue(
        "Recovery pending reply",
      );
      await expect(page.locator(".comment")).toHaveCount(0);
      control = page.locator(".reply-composer button[type=submit]");
    } else {
      page.on("dialog", (d) => d.accept());
      if (action === "delete_post") {
        await page.getByLabel("পোস্টের আরও অপশন").click();
        await page.getByRole("button", { name: "পোস্ট মুছে দিই" }).click();
        await expect(
          page.getByText(`UX own ${own}`, { exact: true }),
        ).toBeVisible();
        await page.getByLabel("পোস্টের আরও অপশন").click();
        control = page.getByRole("button", { name: "পোস্ট মুছে দিই" });
      } else {
        await page
          .getByRole("button", { name: "মুছে দিই", exact: true })
          .click();
        await expect(
          page.getByText("Recovery fixture reply", { exact: true }),
        ).toBeVisible();
        control = page.getByRole("button", { name: "মুছে দিই", exact: true });
      }
    }
    await expect(control).toBeDisabled();
    expect(writes).toBe(1);
    release();
    await expect(control).toBeEnabled();
    expect(writes).toBe(1);
    await page.unrouteAll({ behavior: "wait" });
  });
}

test("browser back to the feed reconciles a confirmed reply without manual reload", async ({
  page,
}) => {
  const card = page
    .locator(".post-card")
    .filter({ hasText: `UX other ${foreign}` });
  await expect(card.locator(".reply-link span")).toHaveText("০");
  await card.getByLabel("পোস্ট খুলে দেখি").click();
  await page.getByLabel("কথায় কথা বাড়ুক").fill(`Back navigation ${foreign}`);
  await page.getByRole("button", { name: "উত্তর দিই", exact: true }).click();
  await expect(
    page
      .locator(".comment")
      .getByRole("button", { name: "মুছে দিই", exact: true }),
  ).toBeEnabled();
  await page.goBack();
  await expect(card.locator(".reply-link span")).toHaveText("১");
});
