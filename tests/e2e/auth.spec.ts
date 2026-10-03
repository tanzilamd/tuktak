import { test, expect } from "@playwright/test";
test("registration, real verification email, optional onboarding, recovery and account deletion", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Local Auth and mail inbox required",
  );
  const username = `test_${Date.now()}`;
  const email = `${username}@example.invalid`;
  const password = "Local-signup-password!32";
  await page.goto("/signup");
  await page.getByLabel("তোমাকে কী নামে ডাকব?").fill("নতুন আড্ডাবাজ");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("ইমেইল", { exact: true }).fill(email);
  await page
    .getByLabel("ব্যক্তিগত মোবাইল নম্বর", { exact: true })
    .fill("01700000000");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "আড্ডায় যোগ দিই" }).click();
  await expect(page).toHaveURL(/verify-email/);
  async function emailLink() {
    let id = "";
    await expect
      .poll(async () => {
        const result = await request.get(
          "http://localhost:55424/api/v1/messages",
        );
        const inbox = await result.json();
        const message = inbox.messages.find(
          (m: { ID: string; To: { Address: string }[] }) =>
            m.To.some((t) => t.Address === email),
        );
        id = message?.ID ?? "";
        return !!id;
      })
      .toBe(true);
    const response = await request.get(
      `http://localhost:55424/api/v1/message/${id}`,
    );
    const message = await response.json();
    const link = message.HTML.match(/href="([^"]+)"/)[1].replaceAll(
      "&amp;",
      "&",
    );
    await request.delete(`http://localhost:55424/api/v1/messages`, {
      data: { IDs: [id] },
    });
    return link;
  }
  await page.goto(await emailLink());
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole("button", { name: "পরের ধাপ" }).click();
  await page
    .getByLabel("এখন কোথায় আছ?")
    .selectOption("বর্তমানে পড়াশোনা করছি না");
  await page.getByRole("button", { name: "পরের ধাপ" }).click();
  await page.getByRole("button", { name: "পরের ধাপ" }).click();
  await page.getByRole("button", { name: "এবার আড্ডায় যাই" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(`/u/${username}`);
  await expect(page.locator("main")).toContainText("বর্তমানে পড়াশোনা করছি না");
  await expect(page.locator("main")).not.toContainText("+880");
  await expect(page.locator("main")).not.toContainText(email);
  await page.goto("/forgot-password");
  await page.getByLabel("ইমেইল", { exact: true }).fill(email);
  await page.getByRole("button", { name: "লিংক পাঠাও" }).click();
  await expect(page.getByRole("status")).toContainText("ইমেইলে");
  await page.goto(await emailLink());
  await expect(page).toHaveURL(/reset-password/);
  await page
    .getByLabel("নতুন password", { exact: true })
    .fill("New-local-password!55");
  await page.getByRole("button", { name: "Password বদলাই" }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("ইমেইল", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("New-local-password!55");
  await page.getByRole("button", { name: "ঢুকে পড়ি" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings");
  await page.getByText("অ্যাকাউন্ট মুছে ফেলতে চাই", { exact: true }).click();
  await page.getByLabel("নিশ্চিত করতে DELETE লিখো").fill("DELETE");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "স্থায়ীভাবে মুছে দিই" }).click();
  await expect(page).toHaveURL(/deleted=1/);
  await page.goto(`/u/${username}`);
  await expect(
    page.getByText("এই পেজটা মনে হয়", { exact: false }),
  ).toBeVisible();
});
