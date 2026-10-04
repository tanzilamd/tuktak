# Validation evidence

Evidence is dated and scoped, not a permanent launch guarantee. [AGENTS.md](AGENTS.md) defines release rules; [README.md](README.md) gives local commands; [HANDOFF.md](HANDOFF.md) owns production operations and acceptance. Never infer hosted success from local tests or Vercel success from GitHub CI.

## Final pre-launch audit — 4 October 2026

Audited `https://tuktakbd.vercel.app`, Supabase project `guqzypztckfnapmptjpu`, and `main` starting at `1e54074`. Only designated accounts and uniquely labelled owned fixtures were used. No production reset, reseed, account repair/deletion, migration rewrite or real-content moderation occurred.

### Reproducible defects and focused fixes

1. **GitHub CI startup:** both the starting commit (run `37207427244`, job `111451436097`) and preceding interaction commit (run `37200310657`, job `111430468842`) failed in `npm run local:start`. Their retrieved logs contain `scripts/local/start.sh: line 11: rg: command not found`, then `ERROR: role "anon" already exists`, exit 3. The negated pipeline treated a missing executable as an absent database role and reran bootstrap. This was reproduced locally by making `rg` unavailable. Startup now uses shell built-in comparisons and fails closed on catalog-query errors. Two shell-orchestration regressions cover missing ripgrep and failed catalog reads; CI additionally repeats real startup without ripgrep and checks data preservation. No backend/browser tests were removed or weakened.
2. **HTTPS auth-cookie transport:** fresh production login produced two session-cookie chunks without `Secure`, despite the HTTPS canonical origin. Both the server Supabase adapter and refresh proxy now set `Secure` when `NEXT_PUBLIC_SITE_URL` is HTTPS; HTTP loopback remains supported. Four real-SDK tests exercise login and expired-session refresh on both origins. Cookie encoding/session behavior and RLS are unchanged. Fresh hosted sign-in must verify the deployed flags; old evidence cannot prove a new build's cookie policy.
3. **Admin onboarding documentation:** the repository had only inline bootstrap SQL, not the previously described committed file. The canonical `scripts/production/first-admin.sql` now requires a complete verified unsuspended account, locks role assignment, rejects an existing admin and atomically records a bootstrap audit. Four database tests cover successful one-time bootstrap and rejection of repeated, unverified, suspended and manually orphaned accounts. It was not executed on production, where an admin already exists.

No new product feature, CSS, layout, Bengali copy, dependencies or migration was introduced. Deployment/CI evidence for the audit commit is recorded after push; these local results do not by themselves establish that the fixes are deployed.

### Local validation actually executed

- Node 24.19.0 / npm 11.9.0; Docker Compose with PostgreSQL 17, real GoTrue, PostgREST and Mailpit. `npm run local:start` and repeat startup without ripgrep passed without reseeding existing accounts.
- A separate fresh fictional backend applied the full ordered chain and seed successfully. The regular stack preserved existing data; PGlite exercises fresh installs, upgrades, later guards and immutable applied-file checksums.
- Formatting of changed supported files, shell syntax, lint and strict typecheck passed.
- `npm test`: **69 tests passed**, no skips. `npm run db:test`: **37 tests passed**, no skips, included in the full suite.
- `npm run build`: optimized production build passed; `npm start` served it with health 200.
- Full real-backend Playwright suite against that production build: **27 passed**, no skips. Includes signup → Auth/profile/private/role creation → Mailpit confirmation → PKCE callback/session → optional onboarding, recovery/new-password login, exact-confirmation account deletion, returning-onboarding preservation, aggregate Discover ranking, moderation and direct API authorization. Thirteen interaction tests cover immediate state, serialization, rollback, navigation/history freshness and uncertain-response recovery.
- Three axe suites passed for public screens and authenticated/first-time onboarding at 320px in light/dark themes. Selected screens had no automated WCAG A/AA violations. This does not certify every screen reader/device combination.
- Built starting commit `1e54074` separately and compared it with the audit build using the same fictional data. **20/20 screenshot pairs were pixel-identical**, with identical visible-element geometry/styles and no horizontal overflow: home, profile, discussion, Discover and community; 360/1280px; light/dark. Fonts/transitions settled, reduced motion and equal decorative live-dot masking were used. Browser tests separately cover 320px.
- Both full and production dependency audits reported **zero vulnerabilities**. No dependency/lockfile change.
- Documentation relative links and npm command names were checked against real paths/package scripts; committed migration bytes are unchanged. Supabase CLI help checks were blocked by a telemetry write to the cloud read-only home (`EROFS`), so CLI execution in this run is explicitly unverified; README documents the writable-owner-terminal alternative.

### Hosted database/security evidence

- Native history contains exactly `202610040001`, `20261004000200`, `20261004000300`; their stored SQL sources match committed files. No pending migration or schema drift found.
- Read-only comparison with a freshly migrated PostgreSQL catalog matched all 15 application tables, 83 columns, 70 constraints, 27 indexes, 14 policies, 15 functions and two Auth triggers. All 15 tables have RLS; direct anonymous/authenticated INSERT/UPDATE/DELETE grants remain revoked. Anonymous command execution is denied; authenticated execution remains caller-authorized.
- Read-only role/claim probes rejected normal-user admin/moderation/unsuspend forgeries, staff/private-table reads and missing/null/incorrect account-deletion consent. Admin/moderator authorization derives from `user_roles`, not claimed metadata. Production phone-update protection is active; public profiles contain neither phone nor email, and private accounts have own-account SELECT policy.
- Zero complete accounts retained phone in Auth metadata. One deliberately orphaned historical test Auth account still has old metadata, intentionally excluded from the earlier cleanup because private storage was manually deleted. It is not a valid working application account; do not automatically repair it or publish its data. Any owner cleanup needs a separate reviewed action.
- Designated account roles, verification and unsuspended state were checked privately. Existing trusted audit history confirms the prior bootstrap/hide/remove/role/suspend/unsuspend work. No destructive moderation replay or audit deletion was necessary.

### Hosted acceptance and remaining limits

Fresh live results are separate from local/previous evidence. Normal-user sign-in/session persistence/logout/returning login, invalid callbacks/guest recovery rejection, protected staff routes, returning onboarding, profile/hobby editing, stale wizard and privileged-action rejection passed. Posts/duplicate prevention/canonical IDs, Unicode counters, mood/hashtag, reactions/rollback, replies/counts/history freshness, follow/counts/rollback, local feed tabs/drafts, chronological/Discover/search/empty states and notifications-route privacy passed. Phone/email absence and no overflow were checked at 320/360/1280px in both themes. Sixteen live mobile screen/theme axe scans had no violations; the combined keyboard assertion incorrectly expected non-focusable main to gain focus, so native fragment/next-tab behavior is checked separately. Test fixtures were cleaned; final deployed cookie and full live completion must still be recorded after push.

The earlier dedicated production moderation audit passed its 13 checks and cleaned its fixtures; the owner explicitly confirmed that prior acceptance. This audit rechecks server authorization, normal-user route restriction, role integrity and audit history without repeating destructive moderation. **The currently configured admin login is rejected**; its database account is complete, verified, unsuspended and still admin. Confirm the designated secure credentials with the owner before claiming a fresh authenticated admin session. No speculative auth changes or password reset were made.

Outstanding operator acceptance:

- Configure disposable `PRODUCTION_QA_EMAIL`, `PRODUCTION_QA_PASSWORD`, `PRODUCTION_QA_PHONE` securely plus owned inbox access, or complete verification/recovery links as the mailbox owner. Fresh production signup/email verification/recovery/account deletion were not repeated: deleting/resetting the existing admin or normal test account is not acceptable QA. The owner previously confirmed fresh production signup/confirmation/onboarding and custom SMTP delivery; local complete-flow coverage passed again.
- The scoped Management API token can inspect the database but **Auth configuration reads return 403 for missing `auth_config_read`**. Grant that read scope securely or check exact Site URL/redirects, confirmation/password settings, SMTP sender/delivery/quotas and CAPTCHA in the dashboard. A denied config read is not evidence that Auth is broken. No secret setting values should be printed.
- `NEXT_PUBLIC_SUPPORT_EMAIL` is absent from the deployed privacy/community pages. Set a public operator support/appeals mailbox in Vercel Production and redeploy; ensure moderation coverage and retention/appeals procedures before public launch.
- Live notification route/privacy is checkable with the normal test account; two-recipient creation/group/read/navigation acceptance needs the second designated actor. Local database/browser notification scope coverage passed. Do not mark all existing production notifications read for convenience.
- A live QA helper initially failed to restore the designated test profile because of multipart streaming-field order; the helper was corrected and its later writes restore a persisted baseline. The temporary QA bio was removed, but the initial education/hobby snapshot was not persisted, so original education/hobby/institution-related test values require owner review. No real user, phone, role or suspension state was changed by that profile test.
- Real Android/iOS devices, other browser engines/screen readers, production load/abuse capacity, backup restoration, optional CAPTCHA/custom domain and the application Docker image remain separate acceptance. The native standalone build and small backend are tested; the full Supabase CLI stack exceeded workspace disk capacity during the initial build.

### Interaction/performance review

The existing architecture uses a caller-session six-action social endpoint, canonical public mutation payloads, scoped optimistic state/rollback and serialized writes. The five-second per-mounted-feed cache is bounded and coalesces reads; mutation generations reject stale in-flight responses. Tab selection/history is local. Route refresh is reserved for navigation racing a pending write or restoring a pre-write history snapshot; settings/safety/moderation keep authoritative revalidation. React request caching avoids repeated metadata/page reads. Follow relationships are batched and exact counts remain SQL/RLS derived.

No evidence justified a speculative cache/query rewrite. Tests hold responses to distinguish immediate UI from confirmed database state, exercise real rejection and lost-response reconciliation, and assert that ordinary feed-tab changes issue no document reload. There is no realtime cross-user push: bounded feed/list sizes and foreground refetch behavior are intentional MVP limits, not a guarantee of instantaneous remote updates.

## CI failure diagnosis for maintainers

1. Find the run for the **exact commit**, failing job/step and complete logs; compare with the preceding commit. Vercel deployment and local passing checks are separate evidence.
2. Separate repository failures from image pulls, disk capacity, unavailable Docker/proxy/registry/network hosts and provider timeouts. Preserve the underlying error instead of inventing an Auth/schema fix.
3. Reproduce from a fresh fictional stack as well as repeated startup. Do not use production data, weaken tests, disable TLS/RLS or remove services to get green status.
4. GitHub signed-log downloads can redirect to a results-storage hostname. Add the exact host through approved environment settings; never bypass proxy/TLS. These downloads were initially blocked in this audit but later succeeded, exposing the confirmed missing-ripgrep failure above.
5. After a fix, verify the new hosted run, not just a local rerun. CI retains full backend, production build/start, browser/axe and audit checks.

## Historical build and production lessons

These are prior evidence, not current test counts or unprovisioned-resource claims:

- Initial pre-production work passed 43 unit/database tests, 31 DB/migration tests and 14 browser tests. It fixed null-safe deletion confirmation, aggregate post/Discover contracts, ordered fresh/upgrade migrations, batched follow displays and returning/stale-onboarding protection via `20261004000200_preproduction_guards.sql`. No broad feature-folder/CSS/type rewrite occurred.
- The 4 October signup investigation found that Auth insertion and mail sending succeeded. An owner manually deleted a profile, cascading private/role rows while Auth remained; `viewer()` correctly reported `Account lookup failed`. Fresh owner-tested signup/confirmation/onboarding worked. No automatic repair or RLS weakening was performed. An existing confirmed email can yield generic signup success without a new email; provider rate limits are independent of app mutation limits.
- A separate real GoTrue defect restored original phone metadata after the projection trigger. `20261004000300_auth_phone_privacy.sql` strips later metadata updates with controlled permissions/search path. The real Auth assertion failed before and passed after; upgrade tests preserve complete and intentionally orphaned accounts. Production migration/source/catalog checks passed without account/credential changes. Existing JWT claims require refresh/sign-out/in before privacy rechecks.
- Prior social work passed 59 tests and 27 browser tests, introduced scoped optimistic interactions and verified live designated-account flows. Commit `1e54074` subsequently verified cached-history reply freshness live. Its CI startup failure is now diagnosed above; its successful Vercel deployment never implied passing GitHub CI.
- Earlier accessibility failures included running axe before a streamed onboarding redirect settled; tests now assert destination URL/content. Packaged Chromium must not use `--single-process`, `--disable-web-security` or `--allow-running-insecure-content`; those flags broke contexts or realistic Origin enforcement. Registry/CDN constraints are not permission to substitute mocked production acceptance.
- The lint preset was replaced after a transitive `braces` advisory; current audits pass without advisory suppression. Runtime processes may not survive cloud snapshots. Saved cloud configuration is a draft until published and tested in a fresh run.

## Fresh-context maintainer review

The canonical documents now answer all fifteen onboarding questions without chat history:

| Question                                                    | Canonical source                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Product, users, existing features, V1 non-goals             | README product/architecture/non-goals; AGENTS product scope       |
| What must not casually change                               | AGENTS stable UI contract and product/privacy invariants          |
| Authentication and callback/session flow                    | AGENTS auth; HANDOFF Auth setup and signup troubleshooting        |
| Public/private profiles and phone storage                   | SECURITY privacy model; AGENTS profile/phone rules                |
| Mutation gateway, optimistic state and authoritative writes | README social interaction state; AGENTS architecture              |
| RLS, roles, moderation and privileged authorization         | SECURITY; AGENTS authorization; HANDOFF bootstrap                 |
| Safe new-feature workflow                                   | AGENTS future feature development workflow                        |
| Forward-only database changes/fresh and upgrade paths       | AGENTS schema rules; HANDOFF ordered native history               |
| Local startup, environment and dependencies                 | README requirements/local workflow/environment/commands           |
| Full validation and safety                                  | AGENTS checks; this document's scoped evidence and limits         |
| Main → GitHub CI/Vercel deployment                          | HANDOFF deployment; AGENTS GitHub rules                           |
| Safe production/admin operations                            | HANDOFF canonical guarded first-admin SQL and QA procedure        |
| Known incidents and traps                                   | README troubleshooting; AGENTS lessons; historical evidence above |

Commands and referenced paths must be checked against the actual checkout when these documents change. Existing five canonical documents are sufficient; no competing architecture guide was added. AGENTS retains its structure and Next.js-managed instruction block. Stale claims that hosted Supabase/SMTP/Vercel/Git push were never verified were corrected; detailed history stays here rather than becoming permanent guarantee language in AGENTS.
