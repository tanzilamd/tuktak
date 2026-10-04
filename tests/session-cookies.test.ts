import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const jar = vi.hoisted(() => ({
  getAll: vi.fn(() => []),
  set: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
import { db } from "@/lib/supabase";
import { proxy } from "../src/proxy";

const user = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  aud: "authenticated",
  role: "authenticated",
  email: "qa@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-10-04T00:00:00Z",
};
function session(expired = false) {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600);
  const token =
    [
      { alg: "HS256", typ: "JWT" },
      { sub: user.id, aud: "authenticated", role: "authenticated", exp },
    ]
      .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
      .join(".") + ".fictional-test-signature";
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: "fictional-refresh-token",
    user,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://testproject.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fictional-public-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(url.includes("/token") ? session() : user),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

for (const [origin, secure] of [
  ["https://tuktak.example", true],
  ["http://localhost:3000", false],
] as const) {
  it(`writes ${secure ? "HTTPS-only" : "local HTTP"} signup/login cookies through the actual SSR adapter`, async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
    const client = (await db())!;
    const result = await client.auth.signInWithPassword({
      email: user.email,
      password: "fictional-password!32",
    });
    expect(result.error).toBeNull();
    expect(jar.set).toHaveBeenCalled();
    for (const call of jar.set.mock.calls)
      expect(call[2]).toMatchObject({ secure, sameSite: "lax", path: "/" });
  });

  it(`refreshes expired ${secure ? "HTTPS" : "local HTTP"} sessions with the same cookie policy in proxy`, async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
    const value =
      "base64-" +
      Buffer.from(JSON.stringify(session(true))).toString("base64url");
    const request = new NextRequest(origin + "/", {
      headers: { Cookie: `sb-testproject-auth-token=${value}` },
    });
    const response = await proxy(request);
    const cookies = response.cookies
      .getAll()
      .filter((cookie) => cookie.name.startsWith("sb-testproject-auth-token"));
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies)
      expect(cookie).toMatchObject({ secure, sameSite: "lax", path: "/" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
}
