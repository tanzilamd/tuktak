# Project instructions — টুকটাক

This root file is the persistent instruction file for future agents working anywhere in this repository. Follow the user's current task and preserve these product and security invariants. Inspect the working tree first, protect unrelated changes, and make routine reversible decisions without repeatedly requesting approval. Complete credential-independent work; document owner-only configuration rather than inventing credentials.

## Read first and keep accurate

- `README.md`: architecture, development commands and local-stack operation.
- `SECURITY.md`: authorization, privacy boundaries and incident response.
- `HANDOFF.md`: hosted Supabase, SMTP, first-admin bootstrap and Vercel setup.
- `VALIDATION.md`: historical evidence and explicitly unverified areas, not proof that today's checkout or a hosted deployment passes.
- Read the affected code and SQL before changing behavior. Update this file and the relevant documents when architectural decisions change. Preserve the Next.js-managed instruction block at the end.

## Product and scope

টুকটাক is a Bengali-first, text-only social space for Bangladeshi students and people connected to student life: short thoughts, jokes, moods, hobbies and everyday experiences. Keep it warm, youthful, expressive and inclusive of school, college, madrasa, university, admission, gap year, study breaks, completed education, not studying and other paths.

- Never require an institution, class/year or SSC/HSC batch to participate. Keep onboarding optional and skippable.
- Preserve feeds, profiles, reactions, flat comments, follows, discovery, hashtags, daily questions, in-app notifications and safety tools as working features. Do not replace real backend behavior with mock controls to finish a task.
- Do not introduce education-platform features, study tracking, notes, courses, tutoring, professional networking, DMs/group chat, anonymous confessions, media/uploads, stories/reels/streaming, marketplaces, dating/matching, AI APIs, precise location, phone discovery, contact sync or advertising/fingerprinting without an explicit scope change. There are no media buckets, recommendation algorithms or social notification emails in V1.
- Branding and curated moods/reactions/education/hobbies/accents live in `src/lib/config.ts`. Keep product changes centralized; synchronize corresponding SQL checks and validators.

## Bengali UX and visual quality

- Product copy is conversational Bengali, with natural English/Banglish where already appropriate. Preserve Bengali labels, numerals via `bn()`, and Dhaka calendar behavior (`Asia/Dhaka`, `questionOfDay()`). Avoid corporate or academically serious copy and implementation details in user flows.
- Use self-hosted Hind Siliguri from `@fontsource/hind-siliguri`; verify Bengali combining marks and emoji render correctly. Do not add remote font dependencies casually.
- Extend the existing CSS tokens in `src/app/globals.css`: warm cream/coral/sage light theme, intentional charcoal/coral dark theme, rounded cards, gentle depth, restrained emoji and motion. Maintain light/dark/system modes and curated profile accents. Avoid generic dashboard aesthetics, visual copies of X, excessive neon/glass, arbitrary user CSS and heavy animation libraries.
- Review changed screens visually, including empty/loading/error/success, hover/focus/pressed/pending states. Every visible control must work. Screenshots should be credible launch material; wait for streamed content and fonts before capturing them.
- Work at 320px/360px phones, tablets and desktop. Preserve constrained feed widths, desktop sidebar, mobile bottom navigation and safe-area padding; content and focused fields must remain reachable above the bottom bar. Check long text, keyboards and horizontal overflow.
- Use semantic HTML, labelled forms, meaningful names for icon/reaction controls, keyboard navigation, skip link, visible focus, sufficient contrast and roughly 44px touch targets. Respect `prefers-reduced-motion`. Automated axe checks complement visual/keyboard review; they do not certify all assistive technologies.

## Text and social invariants

- Posts: **240 Unicode codepoints**; flat replies: **180**. `charCount()` uses `Array.from()`, matching PostgreSQL `char_length()`, not JavaScript UTF-16 `.length` or grapheme counting. Bengali vowel signs and emoji-sequence components count separately. Keep frontend counters, Zod boundaries, RPC checks and table constraints aligned; reject Unicode-whitespace-only bodies and duplicate submissions.
- Text only, with optional curated mood. Render through escaped React nodes in `src/components/rich-text.tsx`; only HTTP(S) links with safe external-link attributes. No unsafe HTML, link-preview metadata downloads or uploads.
- One active reaction per user/post: another switches it; clicking the current one removes it. Prevent self/duplicate follows. Own post/comment deletion must preserve cascades and notification cleanup.
- `Post` always includes aggregate `reaction_counts`, `current_reaction` and `comment_count`, including demo fixtures. Never restore reactor/comment arrays or rank by their lengths. Discover ranks the bounded recent feed by summed reaction counts, with chronological ties; it is not an all-history popularity query. Batch displayed users' follow status with `relationships()` rather than querying each card.
- Feeds are chronological with stable descending timestamp plus UUID pagination. Institution feed requires voluntary institution publication and normalized text matching, never GPS. Keep its tab hidden when unavailable.
- Hashtag links/routes accept Unicode letters, combining marks, numbers and underscore; current SQL indexing covers Latin/Bengali tags. Encode links and safely decode/validate routes. SQL indexes up to five distinct tags per post; topics count distinct authors over seven days. Preserve Bengali marks and align indexing with rendering when extending supported scripts.
- Preserve grouped reaction notifications and individual/group/all-read behavior. Group updates must use only that group's IDs, scoped to the current recipient.

## Profiles, phone and privacy

- Required account data: email/password, unique username, display name and a private BD mobile number at registration. Current normalization accepts local formats and stores `+8801[3-9]…`; there is **no phone OTP** in V1. `phone_verified_at` is reserved and cleared on number changes. Do not imply verification.
- Phone must never be public, searchable, in public APIs/metadata, or serialized to client components except the authenticated owner's **account settings**. The signup trigger stores it in `account_private` and removes it from Auth user metadata/session claims. Preserve this protection; never serialize an Auth `User` object to the app client.
- `profiles` contains public fields only, no email/phone. `account_private` stores phone and private institution state; `user_roles` stores role/suspension separately. Use `PUBLIC_PROFILE`'s explicit column list rather than broad private joins. Profile editing passes only needed institution fields; onboarding receives public profile data, not the private settings object.
- Education and related fields remain optional and adaptive. Current limits: display name 40, bio 100, institution 100, class/year 40, status 12 codepoints; up to five distinct curated hobbies. Usernames are case-insensitive, stored lowercase, unique, 3–20 Latin letters/numbers/underscore, with reserved names enforced in both Zod and SQL.
- Completed onboarding redirects to `/settings/profile`, whose initial values include saved public fields and only the required private institution fields. Preserve the `onboarding` submission flag and the atomic SQL guard rejecting stale first-time wizard submissions after completion; empty wizard defaults must not overwrite returning users' data.
- Only opted-in institution text/key is copied into `profiles`; hidden values must stay private across search, feeds and metadata. Discovery opt-out excludes search results, not public profile/post URLs. Do not claim a private-account feature.
- Do not collect birthday/exact age, IDs, family/address/GPS, private photos or contacts. Avatars are text/CSS, not user uploads. No sensitive forms, sessions, phone/email values, recovery links or environment values in logs or artifacts.

## Architecture and code conventions

- Next.js 16 App Router, React 19, strict TypeScript, lightweight plain CSS, Zod and Supabase Auth/PostgreSQL. Keep portable Node hosting; no separate production backend, Redis, paid APIs or Vercel-only data services without a concrete requirement.
- `src/app/`: routes, metadata, server actions in `actions.ts`, health endpoint and PKCE callback. `src/components/`: reusable UI, minimal client components for interactivity. `src/lib/`: config, types, validation, server-only data/Supabase access and labelled demo fixtures. `src/proxy.ts`: session refresh and private/no-store responses. `supabase/`: schema/config/fictional seeds. `scripts/`: standalone startup and local backend. `tests/`: Vitest/PGlite and Playwright suites.
- Prefer server components and caller-session data access. Keep server-only boundaries; no cross-user global caching of viewers/private results. `viewer()` uses request-scoped React caching and `getUser()` for identity validation.
- Use the `@/*` alias, clear types/names and existing components; avoid duplicated rules, oversized components, excessive abstractions and unrelated rewrites. Prettier conventions: two spaces, double quotes, semicolons, trailing commas. ESLint covers TypeScript, React and Hooks.
- Validate server actions with schemas in `src/lib/validation.ts`, then let the database independently authorize/enforce rules. Return safe Bengali errors, not raw query details or production stacks. Preserve current security headers, safe redirects, same-origin actions and no-store session responses.

## Supabase authorization and safety

- All application tables require explicit RLS, including any new table. Current schema has 15 tables. Direct writes are revoked from `anon`/`authenticated`; application data mutations go through `public.command(action,payload)` using the caller's session. Never bypass authorization with a service-role client.
- Derive authors/actors from `auth.uid()`, require verified email, check live role/suspension and ownership in SQL. UI/route guards are additional protection, never the authority. Do not trust client IDs, JWT metadata roles or hidden buttons.
- Security-definer functions need a controlled `search_path`, narrow grants, bounded output and explicit visibility/role checks. Read RPCs such as `post_stats`, `popular_topics`, `safety_accounts`, `moderation_queue` and `admin_accounts` must not leak inaccessible rows or private fields. Reports/audits remain staff-only; private accounts, notifications and safety lists remain scoped appropriately.
- Preserve per-user transaction locks and bilateral user-pair locks. Blocks are symmetric for signed-in visibility/interactions, remove both follow directions and mutual notifications, and must hold under concurrent follows/reactions/replies/reports. They cannot conceal public content from logged-out viewers. Mutes are private; users must still be able to remove their own follow/mute when a target is suspended.
- Current per-user ten-minute limits: posts 10, comments 20, each follow/block/mute action 40, reports 5, reactions 100. Identical recent posts/comments are rejected; deleting content must not erase abuse receipts. Auth provider limits/CAPTCHA are separate. Do not weaken these protections to make tests pass.
- Moderators review/dismiss reports, hide/remove content, suspend ordinary users and unsuspend eligible accounts. Admins manage user/moderator assignments; the app cannot create admins or modify another admin/self role. Preserve privilege checks and trusted immutable audit writes. Bootstrap the first verified admin only through the guarded owner-console SQL in `HANDOFF.md`, never a hardcoded email or signup field.
- Account deletion requires exactly `DELETE` at the SQL boundary plus explicit browser confirmation. Missing, null, incorrect, padded or differently cased values must reject deletion; retain null-safe `IS DISTINCT FROM`. Deletion safely cascades Auth/private/social data. Reports/audits retain history with null reporter/actor references; free text/target IDs/backups can remain. Document retention and appeals honestly; do not promise complete erasure or automated moderation. Suspended users must retain the permitted account-deletion path.

## Schema and migration changes

- Treat committed migrations as immutable history. Add ordered forward migrations under `supabase/migrations/`; do not rewrite `202610040001_core.sql` or reset real data. Review constraints, indexes, foreign keys/cascades, RLS, RPC grants and security-definer behavior together.
- Align SQL, `src/lib/types.ts`, Zod, config constants, forms, queries, seed data and tests for every schema/business-rule change. Plan existing-row compatibility/backfills and staging rollout. Destructive production operations need explicit owner authorization and a reviewed recovery plan.
- `scripts/migrations.mjs` reads the full ordered chain for PGlite tests and `scripts/local/migrate.mjs`. Local startup applies pending migrations atomically and records checksums in owner-only `tuktak_local.migrations`; changed applied files are rejected. Existing untracked initial schemas are adopted only after baseline checks. Hosted projects use Supabase's own CLI history, not this local ledger. Do not collapse migrations or bypass the shared runner in tests.
- Test both fresh installation and upgrading existing data, with anonymous, owner, other-user, moderator, admin and suspended sessions as relevant. Exercise direct API/RPC attempts and concurrent safety operations, not just button visibility. Never grant public writes or disable RLS to solve migration/test failures.
- Fictional `supabase/seed.sql`, local compose credentials and test fixtures are development-only. Never load or deploy them to a hosted production project. Never run `db reset`, truncate tests or volume deletion against real accounts.

## Auth, environment and secrets

- Supabase email/password signup, required email confirmation, PKCE callback, recovery, session refresh and logout are the current model. Password validation is 10–128 characters. Keep Auth provider password/confirmation settings aligned. Google OAuth/phone OTP require a separate future implementation.
- Callback redirects use canonical `NEXT_PUBLIC_SITE_URL` and `safeNext()`, rejecting external/protocol-relative/control-character/backslash paths. Keep exact Supabase redirect allowlists and default confirmation/recovery email links. PKCE completion normally needs the originating browser; preserve safe expiry/failure handling and recovery global sign-out.
- Public-safe variables are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable or legacy anon key), `NEXT_PUBLIC_SITE_URL`, optional `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and `NEXT_PUBLIC_SUPPORT_EMAIL` (operator mailbox, not a user's private email). Keep `.env.example` placeholders only.
- `.env*` is ignored except `.env.example`; do not overwrite existing `.env.local`. Never commit/print keys, tokens, passwords, session cookies or recovery links, including in shell arguments/screenshots. The app needs no Supabase service-role key or database password. SMTP/database/CLI/deployment/Turnstile secrets belong in secure provider/server settings, never `NEXT_PUBLIC_*`.
- If CAPTCHA is enabled, Supabase Auth validates it server-side; only the Turnstile site key enters the app. Keep explicit widget rendering/cleanup for client navigation. Local development must work with CAPTCHA unset.
- Missing Supabase configuration means a clearly labelled read-only fictional preview, no fake successful authentication/mutations, and health 503. A configured failing backend must surface failure rather than silently substitute demo data.

## Performance and packages

- Target ordinary Bangladeshi mobile connections: small client bundles, server rendering, self-hosted fonts, bounded/indexed queries, safe code splitting and useful skeletons. Avoid new dependencies/services for decoration. Never cache authenticated HTML, sessions or private responses publicly.
- Keep aggregate `post_stats()` counts rather than downloading every reactor ID or trusting truncated row counts. Preserve stable cursors. Existing bounds include feed 20 (guest 8), discussions/lists 100, tag lookup 200, following/institution lookups 1,000; document and test measured pagination improvements before expanding scale.
- Use Node 24 (`.nvmrc`, `package.json`), npm 11 and `package-lock.json`; install with `npm ci`, commit lockfile changes with dependency changes, and do not introduce another package manager. Use a writable npm cache if a cloud home directory is read-only. Keep TLS/checksum verification enabled.
- The independent ESLint 10/TypeScript/React/Hooks toolchain replaced Next's lint preset after a transitive `braces` advisory during the build. Recheck audits and peer compatibility before changing it; do not suppress advisories or blindly force major upgrades. Run both full and production dependency audits for dependency work.

## Verified local workflow and lessons

```sh
npm ci
npm run local:start  # Requires Docker Compose; fictional local backend only.
npm run dev
```

- The small tested stack is PostgreSQL 17 + GoTrue + PostgREST + Mailpit behind `scripts/local/gateway.mjs`, with loopback-only ports. App: 3000; gateway: 55421; inbox: 55424; database: 55432. It is not a production replacement for hosted Supabase.
- Startup preserves local data/configuration, applies pending migrations and seeds only fresh schemas. It refuses hosted `.env.local`. Use a separate checkout/configuration when switching stacks. Check readiness, readable mounted SQL, role grants and schema reload when diagnosing container startup.
- The initial full Supabase CLI stack exceeded workspace Docker disk capacity. Prefer the small stack in constrained cloud environments; do not delete unrelated containers/volumes or relax registry/TLS verification. `npm run local:stop` stops its containers; gateway shutdown is separate and requires verifying the PID belongs to this project.
- Standard Playwright browser download was blocked in the initial environment. The checked-in packaged Chromium fallback works; retain removal of `--single-process`, which caused reused browser contexts to fail. Do not replace integration checks with mocks because a CDN is unavailable.
- Next.js can stream a redirect after `page.goto()` resolves. Browser tests must assert the final URL and destination content before evaluating layout or running axe; retain separate first-time onboarding coverage when completed accounts redirect to editing.
- Other resolved regressions: bind-address callback redirects (`0.0.0.0`), private phone in serialized profile/onboarding props or Auth metadata, Bengali tag percent-decoding/combining marks, blank Unicode bodies, mobile icon accessible names, wrong notification read scope, truncated reaction totals and block/interaction races. Preserve tests for these boundaries.
- Runtime containers/processes may not survive cloud snapshots. Restart and verify services; saving an environment configuration draft does not prove publication/restoration. Avoid restarting the backend mid-suite or killing an unknown port owner.

## Checks before completing work

For application, schema or dependency changes, run from the repository root:

```sh
npm run lint
npm run typecheck
npm test
npm audit --omit=dev --audit-level=moderate
npm run build
git diff --check
```

`npm run db:test` runs the PGlite database and migration suites without Docker, including fresh installs, upgrades preserving existing data, later-migration behavior and immutable history. Add meaningful regression tests for changed behavior; preserve SQL-enforced Unicode limits, privacy, forged-author/role denial, report access, blocks/concurrency, suspension, deletion and notification scope. Do not write tests that merely mirror implementation, skip critical flows to achieve green checks, or treat old test counts as a permanent acceptance target.

For auth/social/UI changes, also exercise the real local stack and relevant Playwright/axe flows. Release validation uses the full suite against a production build:

```sh
npm run local:start
npm run build
npm start  # Separate terminal; waits on the standalone server, port 3000.
# With that server running, in another terminal:
PLAYWRIGHT_USE_PACKAGED_CHROMIUM=1 LOCAL_SUPABASE_TESTS=1 npm run test:e2e
```

**Test safety:** `LOCAL_SUPABASE_TESTS=1` truncates social fixtures and changes roles in `tuktak-test-db-1`. Use only the disposable fictional stack and an app configured for it; never production/staging user data. Without the flag, protected local integration tests are skipped, so that run is not full acceptance. Browser traces/screenshots may contain session/private data; keep them ignored or scrub before sharing. Health should return 200 with `{"status":"ok"}` only with a functioning backend; confirm UI/Auth separately.

For documentation-only changes, verify commands against `package.json` and actual scripts, validate referenced paths, formatting, secrets and `git diff --check`, and run a quick repository check appropriate to the change. A full backend reset/browser/build cycle is unnecessary when runtime code is unchanged. Report checks actually run and any unresolved failures; never claim hosted success from local results.

## GitHub, deployment and handoff

- Use focused incremental commits, inspect staged changes for secrets/unrelated work, and preserve the user's branch/history. Do not force-push, reset production, merge or deploy beyond the user's authorization; this file does not grant publication permission. Report commit hash and working-tree status when committing.
- GitHub CI is `.github/workflows/ci.yml`: Node 24, `npm ci`, lint/type/Vitest/audit, small backend, production build/start and full browser suite. Keep action revisions pinned and update deliberately. Local passing checks do not prove GitHub-hosted CI ran.
- Vercel is the preferred deployment provider, using repository root, Next.js defaults, Node 24, `npm ci` and `npm run build`. Public environment values are baked into builds; redeploy after changing them. Use exact canonical origins, verified SMTP, configured Auth redirects, owner-admin bootstrap and support/appeals contact per `HANDOFF.md`.
- Preserve portability: `output: "standalone"`, `scripts/start.mjs` copies static/public assets and runs the Node server; `Dockerfile` supplies a non-root alternative. Self-hosting needs TLS/canonical forwarded host, safe caching and consistent action encryption keys across instances per Next.js guidance.
- Initial validation covered native production startup and the small backend; hosted Supabase/SMTP/CAPTCHA/Vercel, real devices, full CLI stack, Docker application image and cloud restoration were not all verified. Reassess current evidence rather than carrying these results forward as a guarantee. Keep exact owner actions and limitations in the handoff; never claim the app is fully secure or live without verification.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
