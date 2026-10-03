import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
const base = "http://localhost:55421";
const encode = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const message =
  encode({ alg: "HS256", typ: "JWT" }) +
  "." +
  encode({ role: "anon", iss: "supabase", iat: 1700000000, exp: 2100000000 });
const key =
  message +
  "." +
  createHmac("sha256", "local-only-jwt-secret-at-least-32-characters-long")
    .update(message)
    .digest("base64url");
test("real HTTP API denies forged authors, private queries and unauthorized moderation", async ({
  request,
}) => {
  test.skip(
    process.env.LOCAL_SUPABASE_TESTS !== "1",
    "Disposable local stack only",
  );
  const anon = { apikey: key, Authorization: `Bearer ${key}` };
  const auth = await request.post(`${base}/auth/v1/token?grant_type=password`, {
    headers: anon,
    data: {
      email: "rafi@example.invalid",
      password: "Local-only-demo-Password!32",
    },
  });
  expect(auth.ok()).toBe(true);
  const session = await auth.json();
  expect(session.user.user_metadata).not.toHaveProperty("phone");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${session.access_token}`,
  };
  const profiles = await request.get(`${base}/rest/v1/profiles?select=*`, {
    headers: anon,
  });
  expect(profiles.ok()).toBe(true);
  for (const p of await profiles.json()) {
    expect(p).not.toHaveProperty("phone");
    expect(p).not.toHaveProperty("email");
  }
  const privateAnon = await request.get(
    `${base}/rest/v1/account_private?select=*`,
    { headers: anon },
  );
  expect(privateAnon.ok()).toBe(false);
  const cross = await request.get(
    `${base}/rest/v1/account_private?user_id=eq.00000000-0000-4000-8000-000000000002`,
    { headers },
  );
  expect(await cross.json()).toEqual([]);
  for (const table of ["reports", "moderation_actions"]) {
    const result = await request.get(`${base}/rest/v1/${table}?select=*`, {
      headers,
    });
    expect(await result.json()).toEqual([]);
  }
  const write = await request.patch(
    `${base}/rest/v1/profiles?id=eq.00000000-0000-4000-8000-000000000002`,
    { headers, data: { display_name: "forged" } },
  );
  expect(write.ok()).toBe(false);
  const staff = await request.post(`${base}/rest/v1/rpc/moderation_queue`, {
    headers,
    data: {},
  });
  expect(staff.ok()).toBe(false);
  const role = await request.post(`${base}/rest/v1/rpc/command`, {
    headers,
    data: {
      action: "role",
      payload: {
        id: "00000000-0000-4000-8000-000000000002",
        role: "moderator",
      },
    },
  });
  expect(role.ok()).toBe(false);
  const post = await request.post(`${base}/rest/v1/rpc/command`, {
    headers,
    data: {
      action: "post",
      payload: {
        body: `HTTP boundary ${Date.now()}`,
        mood: "",
        author_id: "00000000-0000-4000-8000-000000000002",
      },
    },
  });
  expect(post.ok()).toBe(true);
  const { id } = await post.json();
  const author = await request.get(
    `${base}/rest/v1/posts?id=eq.${id}&select=author_id`,
    { headers: anon },
  );
  expect((await author.json())[0].author_id).toBe(session.user.id);
  const oversized = await request.post(`${base}/rest/v1/rpc/command`, {
    headers,
    data: { action: "post", payload: { body: "🙂".repeat(241), mood: "" } },
  });
  expect(oversized.ok()).toBe(false);
  const whitespace = await request.post(`${base}/rest/v1/rpc/command`, {
    headers,
    data: { action: "post", payload: { body: "\u00a0", mood: "" } },
  });
  expect(whitespace.ok()).toBe(false);
  const remove = await request.post(`${base}/rest/v1/rpc/command`, {
    headers,
    data: { action: "delete_post", payload: { id } },
  });
  expect(remove.ok()).toBe(true);
  const authB = await request.post(
    `${base}/auth/v1/token?grant_type=password`,
    {
      headers: anon,
      data: {
        email: "mithi@example.invalid",
        password: "Local-only-demo-Password!32",
      },
    },
  );
  expect(authB.ok()).toBe(true);
  const sessionB = await authB.json();
  const headersB = {
    apikey: key,
    Authorization: `Bearer ${sessionB.access_token}`,
  };
  const rpc = (h: Record<string, string>, action: string, payload: object) =>
    request.post(`${base}/rest/v1/rpc/command`, {
      headers: h,
      data: { action, payload },
    });
  const bPost = await rpc(headersB, "post", {
    body: `Concurrent block ${Date.now()}`,
    mood: "",
  });
  expect(bPost.ok()).toBe(true);
  const postId = (await bPost.json()).id;
  const concurrent = await Promise.all([
    rpc(headers, "follow", { id: sessionB.user.id, enabled: true }),
    rpc(headers, "react", { id: postId, kind: "love" }),
    rpc(headersB, "block", { id: session.user.id, enabled: true }),
  ]);
  expect(concurrent[2].ok()).toBe(true);
  const remaining = execFileSync(
    "docker",
    [
      "exec",
      "tuktak-test-db-1",
      "psql",
      "-U",
      "postgres",
      "-Atc",
      "select (select count(*) from follows where follower_id='00000000-0000-4000-8000-000000000001' and following_id='00000000-0000-4000-8000-000000000002')+(select count(*) from notifications where recipient_id='00000000-0000-4000-8000-000000000002' and actor_id='00000000-0000-4000-8000-000000000001')",
    ],
    { encoding: "utf8" },
  ).trim();
  expect(remaining).toBe("0");
  expect(
    (
      await rpc(headersB, "block", { id: session.user.id, enabled: false })
    ).ok(),
  ).toBe(true);
  expect((await rpc(headersB, "delete_post", { id: postId })).ok()).toBe(true);
});
