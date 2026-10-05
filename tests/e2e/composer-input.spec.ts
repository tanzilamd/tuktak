import {
  test,
  expect,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { bn, charCount } from "../../src/lib/config";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ইমেইল", { exact: true }).fill("rafi@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-demo-Password!32");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page.locator(".composer textarea")).toBeVisible();
  // Prove hydration rather than mistaking the static HTML preview for readiness.
  await page.getByRole("button", { name: "+ পোল", exact: true }).click();
  await expect(page.locator(".poll-compose")).toBeVisible();
  await page.getByRole("button", { name: "পোল বাদ দিই", exact: true }).click();
}

async function synced(
  form: Locator,
  body: string,
  max = 240,
  allowEmpty = false,
) {
  await expect(form.locator("textarea[name=body]")).toHaveValue(body);
  await expect(form.locator(".counter")).toHaveText(
    `${bn(charCount(body))} / ${bn(max)}`,
  );
  const enabled = (allowEmpty || !!body.trim()) && charCount(body) <= max;
  if (enabled) await expect(form.locator("button[type=submit]")).toBeEnabled();
  else await expect(form.locator("button[type=submit]")).toBeDisabled();
}

// Model a DOM value already seen by React's tracker, followed by an input event.
// This is event-sequence coverage, not a claim about a particular keyboard/device.
async function visibleInput(input: Locator, body: string, event = "input") {
  await input.evaluate(
    (element, data) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.value = data.body;
      textarea.dispatchEvent(
        data.event === "compositionend"
          ? new CompositionEvent("compositionend", {
              bubbles: true,
              data: data.body,
            })
          : new InputEvent("input", {
              bubbles: true,
              inputType: "insertText",
              data: data.body,
            }),
      );
    },
    { body, event },
  );
}

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Disposable local Auth only",
  );
  if (
    process.env.E2E_BASE_URL &&
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.E2E_BASE_URL)
  )
    throw new Error("Local credentials cannot target a hosted app");
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
});

test("visible tracked input synchronizes text, counter and submit even when synthetic change is skipped", async ({
  page,
}) => {
  const form = page.locator(".composer"),
    input = form.locator("textarea");
  for (const body of [
    "Hello",
    "বাংলা কথা",
    "Hello বাংলা 🙂",
    "প্রথম লাইন\nsecond line",
    "",
    "🙂".repeat(240),
    "🙂".repeat(241),
  ]) {
    await visibleInput(input, body);
    await synced(form, body);
  }
});

test("composition updates and end-only commits synchronize without forcing or truncating the IME", async ({
  page,
}) => {
  const form = page.locator(".composer"),
    input = form.locator("textarea");
  await input.dispatchEvent("compositionstart", { data: "" });
  await input.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(textarea, "কি");
    textarea.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        isComposing: true,
        data: "কি",
        inputType: "insertCompositionText",
      }),
    );
  });
  await synced(form, "কি");
  await visibleInput(input, "কিছু English 🙂", "compositionend");
  await synced(form, "কিছু English 🙂");
  await visibleInput(input, "", "compositionend");
  await synced(form, "");
});

test("normal English/Bengali typing, multiline paste, deletion and codepoint boundaries remain synchronized", async ({
  page,
  context,
}) => {
  const form = page.locator(".composer"),
    input = form.locator("textarea");
  await input.pressSequentially("English");
  await synced(form, "English");
  for (const body of [
    "বাংলা",
    "বাংলা English 🙂",
    "লাইন এক\nline two",
    "🙂".repeat(240),
    "🙂".repeat(241),
    " \n ",
  ]) {
    await input.fill(body);
    await synced(form, body);
  }
  await input.press("Control+A");
  await input.press("Backspace");
  await synced(form, "");
  const pasted = "paste বাংলা 🙂\nআরেক লাইন";
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate((text) => navigator.clipboard.writeText(text), pasted);
  await input.focus();
  await input.press("Control+V");
  await synced(form, pasted);
  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(input).toBeFocused();
    await synced(form, pasted);
    await page.screenshot({
      path: `test-results/composer-input-${theme}.png`,
      animations: "disabled",
    });
  }
  await input.press("Control+A");
  await input.press("Delete");
  await synced(form, "");
});

for (const body of ["Early English text", "আগে লেখা বাংলা 🙂"]) {
  test(`text entered before hydration is adopted without losing the draft: ${body}`, async ({
    page,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hold = async (route: Route) => {
      await gate;
      await route.continue();
    };
    await page.route("**/_next/static/**/*.js", hold);
    try {
      await page.goto("/", { waitUntil: "commit" });
      const form = page.locator(".composer"),
        input = form.locator("textarea");
      await input.fill(body);
      await expect(input).toHaveValue(body);
      await expect(form.locator(".counter")).toHaveText("০ / ২৪০");
      release();
      await synced(form, body);
      // A separate rerender must retain the adopted draft.
      await page.getByRole("button", { name: "+ পোল", exact: true }).click();
      await expect(page.locator(".poll-compose")).toBeVisible();
      await expect(input).toHaveValue(body);
      await page
        .getByRole("button", { name: "পোল বাদ দিই", exact: true })
        .click();
      await synced(form, body);
    } finally {
      release();
      await page.unroute("**/_next/static/**/*.js", hold);
    }
  });
}

test("shared comments/replies/quote composer and post edit synchronize the same event paths", async ({
  page,
}) => {
  const id = randomUUID(),
    parent = randomUUID();
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
    );
  sql(
    `insert into posts(id,author_id,body) values('${id}','00000000-0000-4000-8000-000000000001','Input regression'); insert into comments(id,post_id,author_id,body) values('${parent}','${id}','00000000-0000-4000-8000-000000000002','Parent regression');`,
  );
  try {
    await page.goto(`/post/${id}`);
    const reply = page.locator(".reply-composer").first();
    await visibleInput(reply.locator("textarea"), "উত্তর English 🙂");
    await synced(reply, "উত্তর English 🙂", 180);
    await visibleInput(reply.locator("textarea"), "🙂".repeat(181));
    await synced(reply, "🙂".repeat(181), 180);
    await page
      .locator(`#comment-${parent}`)
      .getByRole("button", { name: "জবাব দিই", exact: true })
      .click();
    const child = page.locator(".thread-composer .reply-composer");
    await visibleInput(
      child.locator("textarea"),
      "সরাসরি উত্তর",
      "compositionend",
    );
    await synced(child, "সরাসরি উত্তর", 180);
    const card = page.locator(".post-card").first();
    await card.locator(".post-menu summary").click();
    await card
      .getByRole("button", { name: "সম্পাদনা করি", exact: true })
      .click();
    const editor = page.locator(".post-editor");
    await visibleInput(editor.locator("textarea"), "বদল English 🙂");
    await synced(editor, "বদল English 🙂");
    await visibleInput(editor.locator("textarea"), "", "compositionend");
    await synced(editor, "");
    await page.goto(`/compose?quote=${id}`);
    const quote = page.locator(".composer");
    await visibleInput(quote.locator("textarea"), "quote বাংলা 🙂");
    await synced(quote, "quote বাংলা 🙂", 240, true);
    await visibleInput(quote.locator("textarea"), "", "compositionend");
    await synced(quote, "", 240, true);
  } finally {
    sql(`delete from posts where id='${id}'`);
  }
});
