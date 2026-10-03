import { createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
// Public local-only anon JWT. The secret is in the test-only compose, never a hosted project key.
const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
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
if (existsSync(".env.local")) {
  if (
    !readFileSync(".env.local", "utf8").includes(
      "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421",
    )
  )
    throw new Error(
      "Preserve existing .env.local; use another checkout for the fictional local stack.",
    );
  console.log("Reusing local test configuration.");
  process.exit(0);
}
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nNEXT_PUBLIC_SITE_URL=http://localhost:3000\n`,
  { mode: 0o600 },
);
console.log("Local test configuration written; values were not printed.");
