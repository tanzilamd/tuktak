# টুকটাক ✦

**মাথায় যা, ২৪০-এর মাঝে তা।** A Bengali-first, text-only social network for Bangladeshi students and people connected to student life. Institutions and education details are always optional.

## Start here

- [HANDOFF.md](HANDOFF.md): owner checklist, exact Supabase setup and Vercel deployment.
- [SECURITY.md](SECURITY.md): authorization, privacy, threat boundaries and operations.
- [supabase/migrations/](supabase/migrations/): ordered schema, RLS and RPC migrations; apply the entire chain, including the pre-production guards.
- [VALIDATION.md](VALIDATION.md): checks actually executed and deployment checks still required.

## Requirements

Node **24 LTS** (see `.nvmrc`), npm **11**, and optionally Docker with Compose for a full local backend. `package-lock.json` pins the dependency tree. Next.js 16, React 19, strict TypeScript, CSS design tokens, self-hosted Hind Siliguri, Zod and Supabase. ESLint 10 uses current TypeScript/React/Hooks rules. Browser accessibility checks use axe. The Next.js lint preset was excluded because its current transitive `braces` dependency has an unpatched advisory.

```sh
npm ci
npm run dev
```

Without Supabase values the application shows clearly labelled fictional sample content. Authentication and mutations require Supabase; this mode is for viewing the design, not a replacement authentication or storage implementation. The health endpoint returns 503 until a real backend is configured.

## Full local workflow (small, tested stack)

Docker must be running. This stack uses real PostgreSQL 17, GoTrue (Supabase Auth), PostgREST and Mailpit. It has no hosted credentials and only fictional data. It deliberately omits storage, analytics, realtime and Studio to keep disk use small. All backend ports bind to loopback.

```sh
npm ci
npm run local:start
npm run dev
```

The startup script creates `.env.local` with a **local-only public anon key**, applies the full ordered migration chain, loads fictional seed accounts only on a fresh schema, and starts a small route gateway. It refuses to overwrite hosted configuration. Repeating it applies pending migrations while preserving data/configuration. The shared local/test runner records checksums in owner-only `tuktak_local.migrations`, adopts the original untracked schema after baseline checks, and rejects rewritten applied migrations. Hosted projects use Supabase's own migration history. The stack is exclusively for development; never deploy its compose file or local keys.

- Application: port 3000.
- Mailpit inbox: port 55424. Open locally to read verification/recovery emails.
- Local Supabase-compatible gateway: port 55421.
- PostgreSQL: port 55432.
- Seed login: `rafi@example.invalid`, password `Local-only-demo-Password!32`.
- Other fictional logins: `mithi`, `ayon`, `tisha`, `niloy`, `samia` at `example.invalid`, same development password.

`npm run local:stop` stops containers. Stop the gateway with the PID in `.local/gateway.pid` **only after confirming it belongs to `scripts/local/gateway.mjs`**. For a complete destructive reset of this fictional local database:

```sh
docker compose -p tuktak-test -f scripts/local/compose.yml down -v
npm run local:start
```

Committed migrations are immutable: add a new forward migration, then run `npm run local:start` to upgrade without resetting. Never point reset commands at a production database. Database containers/volumes may not survive cloud snapshots; startup recreates them if necessary.

## Standard Supabase CLI alternative

Use a separate checkout/configuration when switching between local stacks. The standard stack needs more disk space and access to Supabase container registries.

```sh
npx supabase start
# In local Studio / CLI status, obtain the local URL and public publishable/anon key.
# Put those two public values in .env.local without printing or sharing secret keys.
npx supabase db reset
npm run dev
```

`db reset` applies the migrations and `supabase/seed.sql`; it deletes local database data. The checked-in config enables email verification and contains no storage buckets. Standard local inbox port is 54324. The smaller stack above is the workflow validated in this cloud workspace; the standard CLI stack could not start here due to Docker disk capacity.

## Environment values

Copy `.env.example` to `.env.local` only if you do not already have a configuration. `.env*` is ignored except `.env.example`.

| Variable                               | Meaning                                              | Classification                |
| -------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project API URL                                      | Public safe                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; legacy anon JWT also works | Public safe; protected by RLS |
| `NEXT_PUBLIC_SITE_URL`                 | Canonical origin, e.g. your deployed HTTPS URL       | Public safe                   |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       | Optional CAPTCHA site key                            | Public safe                   |
| `NEXT_PUBLIC_SUPPORT_EMAIL`            | Optional public operator support/appeals mailbox     | Public safe                   |

No service-role key or database password is used by the application. Supabase SMTP passwords, Turnstile secret, database password, deployment tokens and Supabase CLI tokens belong only in their respective secure settings/terminal prompts. Never use a `NEXT_PUBLIC_` variable for a secret.

Enable Turnstile in **Supabase Auth CAPTCHA settings**, put its secret there, and set only the site key in the app. The configured GoTrue integration validates CAPTCHA server-side, including direct Auth API requests. Leave the site key unset for local development. Google OAuth and phone OTP are future integrations, not enabled in V1.

## Commands and checks

```sh
npm run lint             # React, Hooks and TypeScript lint rules
npm run typecheck        # Strict TypeScript compilation without emitting code
npm test                 # Validation, data contracts, PostgreSQL/RLS and migration tests
npm run db:test          # Database + fresh-install/upgrade tests; no Docker needed
npm audit --omit=dev --audit-level=moderate
npm run build            # Production Next.js build
npm start                # Run the built application on port 3000
```

Full browser checks require the fictional local stack and a running application:

```sh
npm run local:start
# In another terminal: npm run dev (or npm run build && npm start)
PLAYWRIGHT_USE_PACKAGED_CHROMIUM=1 LOCAL_SUPABASE_TESTS=1 npm run test:e2e
```

The packaged Chromium is a dev dependency for environments that cannot download Playwright browsers. Alternatively run `npx playwright install --with-deps chromium` and omit `PLAYWRIGHT_USE_PACKAGED_CHROMIUM`. `LOCAL_SUPABASE_TESTS=1` **resets social fixtures in the specifically named `tuktak-test-db-1` container**, and temporarily assigns local moderation roles. Never use it with real data. Without that flag, local-credential flows are explicitly skipped. Browser traces and screenshots are ignored and may contain local test-session data. CI runs the complete local suite on a production build.

## Product and architecture

Server-rendered App Router pages, authenticated Server Actions and the same-origin social endpoint use the caller's Supabase session. PostgreSQL `command()` is the only app mutation path. Direct table writes are revoked. It derives identity from the signed session, requires verified email, checks suspension/roles, serializes per-user commands, enforces database constraints, applies rate limits and maintains notifications.

Public profiles contain no phone/email or hidden institution. Private accounts and roles have separate tables and own-account RLS. Profile discovery opt-out removes a person from search, while public post/profile URLs remain public. An institution feed appears only after institution publication and matches normalized institution text. All feeds are chronological. Recent topics count at most one author per hashtag over seven days; a post indexes up to five distinct tags. Posts have 240 Unicode codepoints; replies have 180. A Bengali vowel sign and an emoji sequence's component codepoints each count, matching PostgreSQL `char_length`.

Posts use one aggregate view model (`reaction_counts`, `current_reaction`, `comment_count`) from `post_stats()`, also used by fictional previews. Discover ranks the bounded recent feed by total reactions, preserving chronological ties. Displayed users' follow relationships are fetched in one session-scoped query. Returning users visit profile editing instead of the first-time wizard; SQL rejects stale onboarding submissions after completion.

All primary screens, empty/loading/error states, adaptive profiles, in-app notifications, safety tools, moderator/admin dashboards and light/dark/system themes are included. Daily questions rotate using the Dhaka calendar date. Brand, labels, moods, interests and reactions are centralized in `src/lib/config.ts`. Avatars are generated text/CSS; there are no uploads or storage buckets.

## First administrator

See the exact guarded SQL in [HANDOFF.md](HANDOFF.md). The owner must create and verify their account first, then run the bootstrap from the Supabase SQL editor as the database owner. No email is hardcoded in application code. Other moderator roles are managed through `/admin`, with database authorization and audit entries.

## Deployment

Vercel instructions are in [HANDOFF.md](HANDOFF.md). The app is portable: `npm run build && npm start` runs on a normal Node 24 host. A multi-stage `Dockerfile` emits a non-root standalone server. For Docker, pass public environment values as build arguments, then supply the same values at runtime. They must be present at build time because Next.js inlines `NEXT_PUBLIC_` values.

```sh
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
  -t tuktak .
docker run --rm -p 3000:3000 --env-file .env.local tuktak
```

Use TLS termination, preserve the canonical host/forwarded host, and do not cache authenticated HTML or session responses. Multi-instance hosts should set the same server-only `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time for each instance, following Next.js self-hosting guidance. The Docker image itself was not built in this workspace; native production build/start were tested.

## Troubleshooting

- **Fictional feed / health 503:** Supabase URL/key are absent. Configure them and rebuild/restart.
- **Database request failed:** confirm migration was applied, RLS and RPC grants exist, and the correct public key is used. Server output intentionally omits private query details.
- **Registration fails:** username may be taken/reserved; phone must be a valid BD mobile number; inspect Supabase Auth logs privately if needed. The signup trigger must exist before registration.
- **No verification email:** check inbox/spam, enable confirmation, set redirect URLs and configure custom SMTP for production. Supabase default email service is not suitable for public-launch delivery.
- **Expired callback:** request a new email/recovery link; complete PKCE links in the browser used to start the flow. Callback origin uses the configured canonical site URL.
- **Rate limit:** wait ten minutes. Production Auth has its own independent limits/CAPTCHA settings.
- **Docker disk/registry failure:** use the small local stack; do not disable TLS/checksums. In this workspace browser downloads were denied, so tests use npm-distributed packaged Chromium.
- **Local DB changed:** add a forward migration and run `npm run local:start`. If history checks fail, inspect the discrepancy; do not rewrite applied files or reset real data.

## Non-goals

No DMs, group chat, anonymous confession, media/file uploads, stories, reels, streaming, marketplace, notes, courses, tutoring, AI APIs, dating/matching, precise location, public phone discovery, contact sync or advertising trackers. DMs and anonymous posting need a separate future moderation design. There is no email notification system beyond authentication mail and no recommendation algorithm.

## Social interaction state

Home posts, reactions, replies, follows/counts and own content deletion update locally while a small same-origin `/api/social` request validates and executes the existing caller-session RPC. Rejections restore the draft/snapshot; uncertain responses trigger a fresh read rather than retrying an insert or toggle. Server responses return public canonical rows or aggregate counts, preserving RLS, private phone storage and database authorization. Standalone composition, authentication, account changes, moderation and safety actions retain server-confirmed behavior.

Feed tabs use local selection/history, bounded per-mounted-session prefetch and a five-second in-memory cache. Writes invalidate stale in-flight reads. Safety revalidation resets client snapshots; a route refresh is used only when navigation races an outstanding write or back/forward restores a snapshot from before a write. No CSS, copy, schema or dependencies changed for this workflow. `tests/e2e/interactions.spec.ts` holds requests to verify immediate updates, serialization, rollback, authoritative confirmation and cross-route reconciliation against the disposable local stack.
