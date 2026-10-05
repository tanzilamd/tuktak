# টুকটাক ✦

**মাথায় যা, ২৪০-এর মাঝে তা।** A Bengali-first, text-only social network for Bangladeshi students and people connected to student life. Institutions and education details are always optional.

## Start here

Production is [tuktakbd.vercel.app](https://tuktakbd.vercel.app), deployed from `main` in `tanzilamd/tuktak` through the connected Vercel project. Its Supabase project reference is `guqzypztckfnapmptjpu` (a public identifier). Production credentials live in secure provider/environment settings. Read [AGENTS.md](AGENTS.md) for permanent product/UI/security rules and the future-feature checklist before modifying the project.

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

`db reset` applies the migrations and `supabase/seed.sql`; it deletes local database data. The checked-in config enables email verification and contains no storage buckets. Standard local inbox port is 54324. The CLI also requires a writable per-user configuration directory: this managed cloud run rejected even `--help` while saving telemetry to its read-only home. Use a writable owner terminal for hosted CLI operations, or the trusted SQL Editor/authorized Management API workflow in HANDOFF; do not repurpose `HOME` or bypass filesystem/TLS policy. The smaller stack above is the workflow validated in this cloud workspace; the standard CLI stack could not start here due to Docker disk capacity.

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

Format changed supported files with `npx prettier --write` followed by `npx prettier --check` and their file paths. SQL retains the committed migration style; use `bash -n scripts/local/start.sh` for shell syntax. The root agent file defines the feature/release checks.

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

Posts use one aggregate view model (`reaction_counts`, `current_reaction`, `comment_count`, resolved mentions, poll state and visible root-quote preview) from `post_stats()`, also used by fictional previews. Discover ranks the bounded recent feed by total reactions, preserving chronological ties. Displayed users' follow relationships are fetched in one session-scoped query. Returning users visit profile editing instead of the first-time wizard; SQL rejects stale onboarding submissions after completion.

All primary screens, empty/loading/error states, adaptive profiles, in-app notifications, safety tools, moderator/admin dashboards and light/dark/system themes are included. Daily questions rotate using the Dhaka calendar date. Brand, labels, moods, interests and reactions are centralized in `src/lib/config.ts`. Avatars are generated text/CSS; there are no uploads or storage buckets.

## First administrator

Use the guarded owner-console [first-admin.sql](scripts/production/first-admin.sql) following [HANDOFF.md](HANDOFF.md). The owner must create and verify their account first, then run the bootstrap from the Supabase SQL editor as the database owner. No email is hardcoded in application code. Other moderator roles are managed through `/admin`, with database authorization and audit entries.

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
- **Rate limit:** application command limits use ten-minute windows; Supabase Auth has independent email/password/IP limits and CAPTCHA. Inspect the provider error/log privately and follow its retry window; application success/failure copy alone does not diagnose SMTP or provider throttling.
- **Account lookup failed:** compare Auth, public profile, private account and role integrity. Manually deleting a profile leaves Auth behind while private/role rows cascade away. This is not evidence of signup-trigger failure; do not automatically repair deliberately removed accounts.
- **CI startup fails / role already exists:** the startup script must not depend on ripgrep being installed. Read the exact failing command and container health/logs; a warmed local database alone does not prove fresh CI startup. See current evidence and failure-diagnostic procedure in [VALIDATION.md](VALIDATION.md).
- **Docker disk/registry failure:** use the small local stack; do not disable TLS/checksums. In this workspace browser downloads were denied, so tests use npm-distributed packaged Chromium.
- **Local DB changed:** add a forward migration and run `npm run local:start`. If history checks fail, inspect the discrepancy; do not rewrite applied files or reset real data.

## Non-goals

No DMs, group chat, anonymous confession, media/file uploads, stories, reels, streaming, marketplace, notes, courses, tutoring, AI APIs, dating/matching, precise location, public phone discovery, contact sync or advertising trackers. DMs and anonymous posting need a separate future moderation design. There is no email notification system beyond authentication mail and no recommendation algorithm.

## Social interaction state

Home posts, reactions, replies, follows/counts and own content deletion update locally while a small same-origin `/api/social` request validates and executes the existing caller-session RPC. Rejections restore the draft/snapshot; uncertain responses trigger a fresh read rather than retrying an insert or toggle. Server responses return public canonical rows or aggregate counts, preserving RLS, private phone storage and database authorization. Standalone composition, authentication, account changes, moderation and safety actions retain server-confirmed behavior.

Feed tabs use local selection/history, bounded per-mounted-session prefetch and a five-second in-memory cache. Writes invalidate stale in-flight reads. Safety revalidation resets client snapshots; a route refresh is used only when navigation races an outstanding write or back/forward restores a snapshot from before a write. No CSS, copy, schema or dependencies changed for this workflow. `tests/e2e/interactions.spec.ts` holds requests to verify immediate updates, serialization, rollback, authoritative confirmation and cross-route reconciliation against the disposable local stack.

## Launch polish

Opening the mounted inbox captures up to 100 visible entries and automatically reads only the snapshot's unread IDs. Those entries keep a subtle new highlight for that visit; later arrivals stay unread. Rendering/prefetching the route does not read notifications. Explicit mark-all-read remains for older backlog, and legacy individual/group reads remain supported. Desktop/mobile navigation shows a capped unread badge (৯৯+) from at most 100 RLS-filtered IDs, without polling. Reaction groups do not mix read and unread events; reply links target their comment anchors.

SSC/HSC batches accept Bengali and ASCII digits and store ASCII years under the existing 1000–2999 rule. Optional status allows 40 Unicode codepoints, trimmed on save. Accent IDs remain unchanged; only their display names are simplified. Posts, replies and notifications share Dhaka relative timestamps and exact-time titles. Daily questions rotate through 31 curated questions once per Dhaka calendar day.

Public launch pages: `/privacy`, `/terms`, `/community`, with the configured support/appeals mailbox. Canonicals and social sharing default to the production origin; a custom canonical origin still comes from `NEXT_PUBLIC_SITE_URL`. The existing app icon is retained and the sharing image reuses it.

Apply every ordered migration, including the two launch refinements, before deploying this version. See HANDOFF and VALIDATION for the deployment evidence and limits.

## Safe PWA V1

The standalone manifest and 192/512px standard, maskable and Apple icons reuse the existing SVG. The compact Home card sits between the composer and feed tabs. On supported phones/tablets, Chromium's real install event enables a user-triggered native prompt; iPhone/iPad Safari gets Share → Add to Home Screen instructions. Android platform/client hints preserve tablet/foldable support regardless of width; MacIntel plus multi-touch identifies desktop-like iPadOS. Ordinary desktops/laptops get no card, even with touch or an install event, and browser-level installation remains available. Standalone/installed state hides it; dismissal or a declined/accepted prompt suppresses reminders for 30 days. Only a completed install/standalone launch records installed state. Browsers cannot reliably report uninstalling, so clearing site preferences may be needed to show the card again after uninstall. Blocked storage falls back to session-local suppression.

`public/sw.js` caches only generic offline HTML and its licensed self-hosted Bengali font, fetched without credentials. Public document navigations use the network and get that fallback only on connection failure. API, mutation, RSC, Auth utility and private-page requests bypass it; HTTP authorization/errors are preserved. No app JavaScript, feed/profile/notification/private data is stored by the worker. Client navigation still uses the existing app error handling; PWA V1 is not an offline social app or push service.

The worker checks for updates on registration and at most once an hour on foreground return, with HTTP cache bypass. It precaches before immediate activation, removes only older owned offline caches, and never reloads tabs or retries writes. Bump its cache version when the offline bundle changes. Keep this policy conservative; see HANDOFF and SECURITY for deployment/authorization boundaries and VALIDATION for actual installability/device evidence.

## Performance baseline

Vercel functions are pinned to Mumbai (`bom1`) beside the existing Supabase `ap-south-1` project. Discovery and the right rail share a request-scoped topics read. No social/private caching, dependency, SQL or UI redesign was introduced. See [PERFORMANCE.md](PERFORMANCE.md) for the measured before/after results, device simulation limits and free monitoring checklist.

## Public sharing

Public posts and profiles offer compact Share controls, including for guests. Native Web Share receives only `টুকটাকে দেখো` and the canonical post/profile URL; unsupported/denied sharing falls back to URL copy, then a selectable link when clipboard access is unavailable. Cancellation is silent. There are no share writes, counts or tracking. Post UUID links survive display-name/username changes. Profile links use the current username; editing it does not reserve/redirect the old username, which may later belong to another account. This release preserves that existing routing model rather than introducing aliases.

## Controlled engagement batch

Apply `20261005000300_engagement.sql` then `20261005000400_mention_boundaries.sql` before releasing this app version. It adds nullable parent/edit/reference fields and four RLS-enabled tables; old normal-post/comment/reaction/read payloads remain valid. No dependency or PWA architecture changes are required.

- **Replies:** one level, 180 codepoints. Replying to a reply belongs to its root. Deleting a root deletes its child replies; hidden or unavailable roots conceal their threads. A discussion returns up to 100 recent comments plus missing roots (at most 200), with a focused target for notification links. It does not load unlimited history.
- **Mentions:** up to five distinct existing usernames in posts/comments/replies. Valid visible names link to public profiles; other names stay plain text. Self/repeated mentions do not notify. Recipient block/mute/suspension and content visibility apply. Internal per-content receipts suppress re-notification on remove/re-add edits; an existing reply/comment/quote notification to the same recipient takes precedence.
- **Editing:** own post body only, during the first 15 minutes, under the existing 240-codepoint rule. The database enforces the deadline; creation time stays unchanged, hashtags are reindexed and a small `সম্পাদিত` label appears. Newly added eligible mentions notify once. Comments are not editable; mood, poll choices/type and quoted reference remain unchanged.
- **Quote/repost:** choose `আবার শেয়ার করি` in the existing post menu, then use the existing composer with optional commentary and one compact root preview. Quote-of-quote flattens to the original; deleted/hidden/unavailable sources get a generic placeholder. Quoting a poll shows a compact poll marker linking to the original, not another poll. Original authors receive an eligible notification; self-quotes do not notify. A repost count is omitted to keep this version small.
- **Polls:** optional post text plus 2–4 distinct, trimmed answers (60 codepoints each), single choice, default one day; presets also include 1h/6h/3d/7d. Counts/percentages are visible before voting to keep one consistent compact card. Logged-in verified unsuspended users, including the owner, may vote/change one vote while open. Voting is optimistic with rollback/canonical recovery. Expiry closes voting only: the parent post remains in ordinary feeds/profile/discovery/discussion and final results stay visible while it exists. The local timer never authorizes voting; the database clock does. Counts reflect retained votes; account deletion also removes that account's votes. There is no public voter list, live polling or automatic post deletion.

The same caller-session command and aggregate stats RPC power these features. Quote/poll/mention state comes with the existing bounded stats request; there are no per-card browser queries. Edit confirmation and standalone quote composition retain server-confirmed behavior; ordinary post/reply/vote interactions preserve scoped optimistic rollback. See SECURITY, PERFORMANCE, HANDOFF and VALIDATION for boundaries and rollout evidence.

## Public identity and compact discovery

Current public display names come from `profiles.display_name`; signup-time Auth metadata is not synchronized or used as the current name. The small `অ্যাডমিন` badge derives only from the current admin role through safe read projections; moderators do not receive it. Apply `20261005000500_public_admin_identity.sql` before deploying this UI.

Home shows a single compact, horizontally scrolling topic row when the desktop right rail is hidden. Both use the same request-scoped `topics()` read. The install card retains its existing platform/state rules and remains directly after the composer. The desktop legal footer stays reachable; the compact self-profile now appears at the right-rail top, with constrained-height behavior described below. Shared field alignment and focus treatment use the existing theme tokens.

## UI follow-up: navigation, action menus and guests

Desktop navigation keeps Home, discover, inbox and Settings (plus staff moderation), one compose CTA and legal footer. The compact current-profile shortcut is at the right-rail top only for signed-in users; guests receive no duplicate signup card. Mobile navigation and the compact topic strip are unchanged. A local mobile scroll margin keeps focused form controls above the bottom navigation without keyboard JavaScript or layout changes. Normal laptop layouts fit without inner scrolling; short/high-zoom layouts adjust spacing locally, with an unobtrusive keyboard-reachable overflow fallback only when necessary.

Post menus are exclusive and close on outside click, Escape, action selection and navigation. Guests attempting open-poll voting, reactions, replies, follows, quotes or reports reach login with a validated local destination. Login returns to that context without replaying the attempted action. Signup username errors explain spaces, unsupported characters, length or reserved names inline, with neutral examples; correcting a shown field updates its error. Public names remain profile-authoritative and no Auth metadata synchronization is added.
