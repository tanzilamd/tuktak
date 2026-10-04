# Validation evidence

## Production signup investigation — 4 October 2026

The owner confirmed a fresh production signup, confirmation email, verification and onboarding work at `https://tuktakbd.vercel.app`. Provider logs show the earlier signup succeeded and sent email; database statement statistics record an owner-role direct profile deletion affecting one row. Private/role rows cascaded away while Auth remained. `viewer()` correctly rejected that incomplete account. Repeating signup for an already confirmed address can return generic success without another confirmation email. No authentication repair, profile restoration or RLS change was needed or performed.

A separate phone-privacy defect was reproduced on a fresh, non-deleted local account and observed on a complete production account: GoTrue restored original phone metadata after the AFTER INSERT trigger stripped it. The forward migration `20261004000300_auth_phone_privacy.sql` adds an invoker trigger that strips phone on metadata updates, with a fixed search path and no public execute grant. It cleans stored metadata only for accounts that already have private storage, preserving accounts, private phones, roles, confirmation and manually orphaned test-account state.

The new real Auth browser assertion failed before the migration (`phone_in_metadata: true`) and passed afterward. The extended flow checks Auth/profile/private/role creation, unconfirmed state, real email, PKCE callback, confirmed state, session/JWT phone privacy and working onboarding/account lookup. Upgrade coverage verifies preserved complete and manually orphaned accounts; direct database coverage verifies subsequent metadata saves and authorized private-phone changes.

Current checks passed: formatting, lint, typecheck, 45 automated tests, 33 database/RLS/migration tests, all 14 Playwright tests including three axe checks, production build and production-dependency audit (zero vulnerabilities). Local tests use only the fixed disposable stack. Hosted migration/deployment evidence is reported separately after execution; these results alone do not prove deployment.

Validation performed in this cloud workspace on 4 October 2026 (Asia/Dhaka), including the targeted pre-production fixes. No production credentials were provided.

## Passed

- `npm ci`: frozen lockfile installation, including after updating the lint toolchain.
- `npm run lint`: current ESLint 10, TypeScript, React and Hooks rules; no errors or warnings.
- `npm run typecheck`: strict TypeScript.
- Formatting: Prettier wrote and checked changed supported files; `git diff --check` passed. SQL retains the existing migration style; no formatter plugin or dependency was added.
- `npm test`: **43 tests passed**, no skips. Applies the full ordered SQL migration chain in PostgreSQL (PGlite), with isolated anonymous/authenticated roles, plus server-boundary validators and data-contract tests. Covers email-verification guards, usernames/reserved names, Unicode length limits/blank text, privacy, posts/duplicates/rates, replies/deletion, reaction switching/removal, follows/self-follow, symmetric blocks, mute/unmute, reports/staff/admin authorization, suspension/unsuspension, cascading deletion, notification read scope, Bengali hashtags and topic spam constraints. Includes cleanup of one's own follows/mutes after a target is suspended.
- `npm run db:test`: **31 database/migration tests passed**, no skips (also included in `npm test`). Direct RPC deletion rejects missing, null, incorrect, lowercase and padded confirmations and a null payload; exact `DELETE` succeeds. Stale onboarding submissions preserve saved profile/private values, while deliberate editing remains available.
- Four migration regression tests prove later guards execute on fresh installs and upgrades from the original schema, existing profiles/private data/posts survive, repeat application is idempotent, the local ledger is private, unknown partial schemas are rejected and rewritten applied migration checksums fail.
- Seven data-contract tests cover aggregate Discover ranking with different reaction totals, normal feed ordering, post-detail/demo consistency, visibility changes between row/stat reads, one deduplicated session-scoped follow query, guest/empty behavior and error propagation.
- Native PostgreSQL 17 fresh ordered-chain application and repeat application passed in an isolated disposable database, which was removed afterward. The existing real GoTrue/PostgREST local stack upgraded from the original untracked schema using `npm run local:start`.
- Repeated `npm run local:start`: preserved local configuration/data, applied pending migrations and did not rerun recorded migrations or seed existing accounts. The original migration file remains unchanged.
- `npm run build`: successful optimized production build; authenticated application pages remain dynamic.
- `npm start`: portable standalone Node server, serving the compiled app and self-hosted fonts. `/api/health` returned HTTP 200 and `{"status":"ok"}`.
- Complete Playwright suite on the production server: **14 tests passed**, no skips. Includes signup → Mailpit verification email → PKCE callback → optional onboarding, recovery → new password login, account deletion, protected routes, posting/counters/moods, reaction switching, comment/post deletion, follow feed, block/unblock, reports, moderation audit and admin role management. New regressions exercise direct HTTP/RPC deletion confirmation, Discover aggregate ranking, batched follow displays and returning onboarding with both institution visibility settings. Tests use real local GoTrue sessions and real PostgREST requests.
- HTTP API checks: anonymous private queries fail, another user's private account returns no rows, public profile rows contain neither phone nor email, session metadata contains no phone, forged table writes and normal-user moderation/admin calls fail, caller identity overrides forged authors, and overlength/whitespace RPC posts fail. Concurrent follow/reaction/block requests leave no mutual follow or notification records.
- Three automated axe WCAG A/AA tests: public screens in both themes, authenticated forms/settings at **320px** in both themes, and first-time onboarding at **320px** in both themes. No violations in the selected screens; this does not imply every assistive-technology/device combination is certified. An initial existing test raced the new streamed onboarding redirect; it now waits for the destination before evaluating layout or scanning accessibility, and the full rerun passed.
- Browser responsiveness/typography: 320px/360px phones and 1280px desktop, self-hosted Hind Siliguri loading, mobile bottom navigation, light/dark themes and absence of horizontal overflow in selected screens.
- Visual review of actual desktop light and mobile dark rendering; subsequent screenshot refresh waits for streamed feed content rather than capturing loading skeletons.
- `npm audit --audit-level=moderate` and production-only audit: **0 reported vulnerabilities**. An unpatched `braces` advisory in Next's old lint preset was resolved by using the current independent ESLint/TypeScript/React toolchain, without suppressing the advisory.
- `.env.local` and local logs are ignored; only `.env.example` is tracked. Source scan found no service-role keys, production secret prefixes, private keys or unsafe HTML rendering.
- Reusable cloud `install_script` and `start_skill` were saved to the environment configuration draft. This save did not publish an environment or prove fresh-task restoration.

## Not verified or provisioned

- Hosted Supabase project/schema/Auth, external SMTP delivery, hosted CAPTCHA, Vercel deployment and production/custom domain. Owner account/configuration is required; exact steps are in HANDOFF.md.
- Real Android/iOS device behavior, all browser engines, all screen readers, production abuse/load capacity and disaster recovery.
- Docker application image build itself. The native standalone production build/server and small backend container stack were tested.
- Full Supabase CLI service stack in this workspace: its large PostgreSQL image exceeded Docker disk capacity. The smaller real Auth/PostgreSQL/PostgREST stack was used successfully instead.
- Remote Git push, GitHub-hosted CI execution, environment publication and restoration in a new cloud task. All implementation commits remain local until the owner pushes them.

## Scope of the pre-production change

All five requested fixes are complete: null-safe deletion consent, one aggregate post contract/Discover ranking, ordered fresh/upgrade migrations, batched displayed-user relationships, and protection against returning/stale onboarding overwrites. The new forward migration is `supabase/migrations/20261004000200_preproduction_guards.sql`. Its replacement RPC retains the original identity, grants, RLS checks, role checks, transaction locks, rate limits and other command branches; only the two guards change. Phone privacy is preserved. No feature-folder reorganization, CSS splitting, broad type refactor or dependency change was performed.

No remaining code launch blocker was found by these checks. Deployment still requires the owner to create/configure hosted Supabase, apply both migrations, configure production SMTP/Auth redirects and Vercel values, establish moderation/support coverage, and complete hosted acceptance in `HANDOFF.md`.

No unresolved failures remain in the selected local workflow. Hosted-provider acceptance checks are deliberately separate; do not treat local results as proof a public deployment is live.
