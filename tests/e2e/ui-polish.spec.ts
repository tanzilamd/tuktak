import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const me = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
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
async function theme(page: Page, value: string) {
  await page.evaluate((t) => {
    localStorage.setItem("tuktak-theme", t);
    document.documentElement.dataset.theme = t;
  }, value);
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
let originalRole: string;
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
  originalRole = sql(`select role from user_roles where user_id='${me}'`);
});
test.afterEach(() => {
  if (process.env.LOCAL_SUPABASE_TESTS === "1" && originalRole)
    sql(`update user_roles set role='${originalRole}' where user_id='${me}'`);
});
test("stable sidebar footer at laptop heights, keyboard reachability and effective 125% zoom layouts", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  sql(`update user_roles set role='admin' where user_id='${me}'`);
  await login(page);
  for (const mode of ["light", "dark"])
    for (const [w, h] of [
      [1280, 720],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
    ])
      for (const zoom of [1, 1.25]) {
        // A 125% zoom layout has fewer CSS pixels. This tests reflow, not a physical browser's zoom UI.
        await page.setViewportSize({
          width: Math.floor(w / zoom),
          height: Math.floor(h / zoom),
        });
        await theme(page, mode);
        const footer = await page.locator(".sidebar-bottom").boundingBox();
        expect(footer).not.toBeNull();
        expect(footer!.y + footer!.height).toBeLessThanOrEqual(
          Math.floor(h / zoom),
        );
        const middle = page.locator(".sidebar-middle");
        expect(
          (await middle.boundingBox())!.y +
            (await middle.boundingBox())!.height,
        ).toBeLessThanOrEqual(footer!.y + 1);
        const compose = await page.locator(".sidebar-compose").boundingBox();
        expect(compose!.y).toBeGreaterThanOrEqual(0);
        expect(compose!.y + compose!.height).toBeLessThanOrEqual(footer!.y);
        expect(
          await page
            .locator(".sidebar-compose")
            .evaluate((e) => e.parentElement!.className),
        ).toBe("sidebar");
        await page.locator(".desktop-nav a").last().focus();
        expect(
          await page
            .locator(".desktop-nav a")
            .last()
            .evaluate((e) => {
              const r = e.getBoundingClientRect(),
                p = e.closest(".sidebar-middle")!.getBoundingClientRect();
              return r.top >= p.top && r.bottom <= p.bottom;
            }),
        ).toBe(true);
        await page.locator(".sidebar-compose").focus();
        expect(
          await page.locator(".sidebar-compose").evaluate((e) => {
            const r = e.getBoundingClientRect(),
              p = e.parentElement!.getBoundingClientRect();
            return r.top >= p.top && r.bottom <= p.bottom;
          }),
        ).toBe(true);
        await page.locator(".mini-profile").focus();
        await expect(page.locator(".mini-profile")).toBeFocused();
        await noOverflow(page);
        await page.screenshot({
          path: info.outputPath(`sidebar-${w}-${zoom}-${mode}.png`),
        });
      }
  expect(
    (await new AxeBuilder({ page }).include(".sidebar").analyze()).violations,
  ).toEqual([]);
});
test("mobile topics stay one compact row, links work, focus does not shift layout and no desktop gap", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const pid = randomUUID();
  sql(
    `insert into posts(id,author_id,body)values('${pid}','${me}','ছোট্ট কথা #পলিশ #আড্ডা');insert into hashtags(tag)values('পলিশ'),('আড্ডা')on conflict do nothing;insert into post_hashtags(post_id,tag) values('${pid}','পলিশ'),('${pid}','আড্ডা')`,
  );
  try {
    await login(page);
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
        await noOverflow(page);
        const section = page.locator(".mobile-topics");
        const composer = page.locator(".main-column > .composer");
        const tabs = page.locator(".feed-tabs");
        if (w <= 1180) {
          await expect(section).toBeVisible();
          expect((await section.boundingBox())!.height).toBeLessThanOrEqual(60);
          const rows = await section
            .locator("a")
            .evaluateAll(
              (es) =>
                new Set(
                  es.map((e) => Math.round(e.getBoundingClientRect().top)),
                ).size,
            );
          expect(rows).toBe(1);
          expect(
            (await tabs.boundingBox())!.y -
              ((await composer.boundingBox())!.y +
                (await composer.boundingBox())!.height),
          ).toBeLessThanOrEqual(70);
          await expect(
            section.getByRole("link", { name: "#পলিশ", exact: true }),
          ).toHaveAttribute("href", `/tag/${encodeURIComponent("পলিশ")}`);
        } else {
          await expect(section).toBeHidden();
          expect(
            (await tabs.boundingBox())!.y -
              ((await composer.boundingBox())!.y +
                (await composer.boundingBox())!.height),
          ).toBeLessThanOrEqual(24);
        }
        const input = page.getByLabel("মাথায় কী ঘুরছে?");
        const before = await input.boundingBox();
        await input.focus();
        expect(
          await input.evaluate((e) => getComputedStyle(e).boxShadow),
        ).not.toBe("none");
        expect(await input.boundingBox()).toEqual(before);
        await page.screenshot({
          path: info.outputPath(`home-${w}-${mode}.png`),
        });
        expect(
          (await new AxeBuilder({ page }).include(".main-column").analyze())
            .violations,
        ).toEqual([]);
      }
    await page.setViewportSize({ width: 360, height: 800 });
    await page
      .locator(".mobile-topics")
      .getByRole("link", { name: "#পলিশ", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp("/tag/"));
    await expect(
      page.locator(".post-card").filter({ hasText: "ছোট্ট কথা" }),
    ).toBeVisible();
  } finally {
    sql(`delete from posts where id='${pid}'`);
  }
});
test("shared profile controls align, edit and poll controls fit, comments preserve keyboard focus", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const pid = randomUUID();
  sql(
    `insert into posts(id,author_id,body)values('${pid}','${me}','পলিশ সম্পাদনা')`,
  );
  try {
    await login(page);
    await page.goto("/settings/profile");
    await expect(page.locator(".profile-form")).toBeVisible();
    for (const mode of ["light", "dark"])
      for (const width of [320, 360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await theme(page, mode);
        await noOverflow(page);
        const fields = await page
          .locator(".form-grid .field")
          .evaluateAll((es) =>
            es.map((e) => ({
              top: e.getBoundingClientRect().top,
              input: e
                .querySelector("input,select,textarea")
                ?.getBoundingClientRect().top,
              width: e.getBoundingClientRect().width,
            })),
          );
        for (let i = 0; i < fields.length; i++)
          for (let j = i + 1; j < fields.length; j++)
            if (Math.abs(fields[i].top - fields[j].top) < 1)
              expect(
                Math.abs((fields[i].input ?? 0) - (fields[j].input ?? 0)),
              ).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: info.outputPath(`profile-${width}-${mode}.png`),
          fullPage: true,
        });
        expect(
          (await new AxeBuilder({ page }).include(".profile-form").analyze())
            .violations,
        ).toEqual([]);
      }
    await page.goto(`/post/${pid}`);
    await page.locator(".post-menu summary").click();
    await page
      .getByRole("button", { name: "সম্পাদনা করি", exact: true })
      .click();
    for (const mode of ["light", "dark"])
      for (const width of [320, 360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await theme(page, mode);
        await noOverflow(page);
        const editor = page.locator(".post-editor");
        const box = await editor.locator("textarea").boundingBox(),
          form = await editor.boundingBox();
        expect(Math.abs(box!.x - form!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(box!.width - form!.width)).toBeLessThanOrEqual(1);
        await editor.locator("textarea").focus();
        expect(
          await editor
            .locator("textarea")
            .evaluate((e) => getComputedStyle(e).outlineWidth),
        ).toBe("2px");
        await page.screenshot({
          path: info.outputPath(`editor-${width}-${mode}.png`),
        });
        expect(
          (await new AxeBuilder({ page }).include(".post-editor").analyze())
            .violations,
        ).toEqual([]);
      }
    await page.getByRole("button", { name: "থাক", exact: true }).click();
    await page.goto("/");
    await page.getByRole("button", { name: "+ পোল", exact: true }).click();
    await page.setViewportSize({ width: 320, height: 800 });
    await noOverflow(page);
    for (const input of await page.locator(".poll-input-row input").all())
      expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      (await new AxeBuilder({ page }).include(".composer").analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath("poll-controls-320.png") });
  } finally {
    sql(`delete from posts where id='${pid}'`);
  }
});
test("current public names and role badges propagate to profiles, posts, replies, quotes and notifications", async ({
  page,
}, info) => {
  const pid = randomUUID(),
    qid = randomUUID(),
    cid = randomUUID(),
    rid = randomUUID(),
    nid = randomUUID();
  const name = sql(
    `select display_name from profiles where id='${me}'`,
  ).replaceAll("'", "''");
  sql(
    `update user_roles set role='admin' where user_id='${me}';update profiles set display_name='বর্তমান নাম' where id='${me}';insert into posts(id,author_id,body)values('${pid}','${me}','পরিচয় পরীক্ষা');insert into posts(id,author_id,body,is_quote,quoted_post_id)values('${qid}','${other}','কথা',true,'${pid}');insert into comments(id,author_id,post_id,body)values('${cid}','${me}','${pid}','প্রথম উত্তর');insert into comments(id,author_id,post_id,body,parent_id)values('${rid}','${me}','${pid}','জবাব','${cid}');insert into notifications(id,recipient_id,actor_id,kind,post_id,event_key)values('${nid}','${other}','${me}','quote','${pid}','${nid}');`,
  );
  try {
    await login(page);
    await page.goto(`/post/${pid}`);
    await expect(page.locator(".post-header .admin-badge")).toHaveText(
      "অ্যাডমিন",
    );
    await expect(page.locator(".post-header")).toContainText("বর্তমান নাম");
    await expect(page.locator(".comment .admin-badge")).toHaveCount(2);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      (await new AxeBuilder({ page }).include(".main-column").analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath("identity-admin-320-light.png"),
    });
    await theme(page, "dark");
    await page.screenshot({
      path: info.outputPath("identity-admin-320-dark.png"),
    });
    // Legitimate 40-codepoint unbroken names must wrap beside a badge at phone widths.
    sql(
      `update profiles set display_name='${"W".repeat(40)}' where id='${me}'`,
    );
    for (const mode of ["light", "dark"])
      for (const path of [`/post/${pid}`, "/u/rafi"]) {
        await page.goto(path);
        await expect(
          page
            .locator(
              path.startsWith("/post") ? ".post-header" : ".profile-content h1",
            )
            .first(),
        ).toContainText("W".repeat(40));
        await theme(page, mode);
        const identity = page
          .locator(
            path.startsWith("/post") ? ".post-header" : ".profile-content",
          )
          .first();
        await expect(identity).toBeVisible();
        await expect(identity).toContainText("W".repeat(40));
        await noOverflow(page);
        await identity.screenshot({
          path: info.outputPath(
            `long-name-${path.startsWith("/post") ? "post" : "profile"}-${mode}.png`,
          ),
        });
        expect(
          (await new AxeBuilder({ page }).include(".main-column").analyze())
            .violations,
        ).toEqual([]);
      }
    sql(`update profiles set display_name='বর্তমান নাম' where id='${me}'`);
    await page.goto(`/post/${qid}`);
    await expect(page.locator(".post-header .admin-badge")).toHaveCount(0);
    await expect(page.locator(".quote-preview .admin-badge")).toHaveText(
      "অ্যাডমিন",
    );
    await expect(page.locator(".quote-preview")).toContainText("বর্তমান নাম");
    await page.goto("/u/rafi");
    await expect(page.locator("h1 .admin-badge")).toHaveText("অ্যাডমিন");
    const recipient = await page
      .context()
      .browser()!
      .newContext({ baseURL: "http://localhost:3000" });
    try {
      const inbox = await recipient.newPage();
      await login(inbox, "mithi@example.invalid");
      await inbox.goto("/notifications");
      await expect(
        inbox
          .locator(".notification")
          .filter({ hasText: "বর্তমান নাম" })
          .locator(".admin-badge"),
      ).toContainText(["অ্যাডমিন"]);
    } finally {
      await recipient.close();
    }
    sql(`update user_roles set role='moderator' where user_id='${me}'`);
    await page.goto(`/post/${pid}`);
    await expect(page.locator(".admin-badge")).toHaveCount(0);
    await page.goto("/u/rafi");
    await expect(page.locator(".profile-content h1")).toContainText(
      "বর্তমান নাম",
    );
    await expect(page.locator("h1 .admin-badge")).toHaveCount(0);
  } finally {
    sql(
      `delete from posts where id in('${pid}','${qid}');delete from notifications where id='${nid}';update profiles set display_name='${name}' where id='${me}'`,
    );
  }
});

test("report links navigate directly to the correct utility form without partial background prefetch", async ({
  page,
}) => {
  const pid = randomUUID(),
    cid = randomUUID();
  sql(
    `insert into posts(id,author_id,body)values('${pid}','${other}','রিপোর্ট নেভিগেশন');insert into comments(id,post_id,author_id,body)values('${cid}','${pid}','${other}','রিপোর্ট উত্তর')`,
  );
  try {
    await login(page);
    for (const kind of ["user", "post", "comment"]) {
      await page.goto(kind === "user" ? "/u/mithi" : `/post/${pid}`);
      const requests: string[] = [];
      const observe = (request: import("@playwright/test").Request) => {
        if (
          new URL(request.url()).pathname === "/report" &&
          request.headers()["next-router-prefetch"] === "1"
        )
          requests.push(request.url());
      };
      page.on("request", observe);
      if (kind === "user") await page.getByText("নিরাপত্তা ও অপশন").click();
      else if (kind === "post")
        await page.locator(".post-menu summary").click();
      const link =
        kind === "comment"
          ? page
              .locator(`#comment-${cid}`)
              .getByRole("link", { name: "রিপোর্ট করি", exact: true })
          : page
              .locator(kind === "user" ? ".safety-options" : ".post-menu")
              .getByRole("link", { name: "রিপোর্ট করি", exact: true });
      await link.hover();
      await page.waitForTimeout(400);
      expect(requests).toEqual([]);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/report\\?type=${kind}&id=`));
      await expect(page.getByRole("combobox")).toBeVisible();
      await expect(page.locator('input[name="target_type"]')).toHaveValue(kind);
      page.off("request", observe);
    }
  } finally {
    sql(`delete from posts where id='${pid}'`);
  }
});
