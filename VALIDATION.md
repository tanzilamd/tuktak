# Validation evidence

Evidence is dated and scoped, not a permanent launch guarantee. [AGENTS.md](AGENTS.md) defines release rules; [README.md](README.md) gives local commands; [HANDOFF.md](HANDOFF.md) owns production operations and acceptance. Never infer hosted success from local tests or Vercel success from GitHub CI.

## Final pre-launch audit — 4 October 2026

Audited `https://tuktakbd.vercel.app`, Supabase project `guqzypztckfnapmptjpu`, and `main` starting at `1e54074`. Only designated accounts and uniquely labelled owned fixtures were used. No production reset, reseed, account repair/deletion, migration rewrite or real-content moderation occurred.

### Reproducible defects and focused fixes

1. **GitHub CI startup:** both the starting commit (run `37207427244`, job `111451436097`) and preceding interaction commit (run `37200310657`, job `111430468842`) failed in `npm run local:start`. Their retrieved logs contain `scripts/local/start.sh: line 11: rg: command not found`, then `ERROR: role "anon" already exists`, exit 3. The negated pipeline treated a missing executable as an absent database role and reran bootstrap. This was reproduced locally by making `rg` unavailable. Startup now uses shell built-in comparisons and fails closed on catalog-query errors. Two shell-orchestration regressions cover missing ripgrep and failed catalog reads; CI additionally repeats real startup without ripgrep and checks data preservation. No backend/browser tests were removed or weakened.
2. **HTTPS auth-cookie transport:** fresh production login produced two session-cookie chunks without `Secure`, despite the HTTPS canonical origin. Both the server Supabase adapter and refresh proxy now set `Secure` when `NEXT_PUBLIC_SITE_URL` is HTTPS; HTTP loopback remains supported. Four real-SDK tests exercise login and expired-session refresh on both origins. Cookie encoding/session behavior and RLS are unchanged. Fresh hosted sign-in and real refresh after an expired client session verified Secure after the audit deployment; invalid refresh was rejected on a protected route. Old evidence cannot prove a future build's cookie policy.
3. **Admin onboarding documentation:** the repository had only inline bootstrap SQL, not the previously described committed file. The canonical `scripts/production/first-admin.sql` now requires a complete verified unsuspended account, locks role assignment, rejects an existing admin and atomically records a bootstrap audit. Four database tests cover successful one-time bootstrap and rejection of repeated, unverified, suspended and manually orphaned accounts. It was not executed on production, where an admin already exists.

No new product feature, CSS, layout, Bengali copy, dependencies or migration was introduced. Audit implementation commit `36f3e840c79e12703776bcf31c240ced60cbe68c` was pushed to `main`; [GitHub CI run 37212900315](https://github.com/tanzilamd/tuktak/actions/runs/37212900315) succeeded, including real startup/restart and full browser steps. Vercel Production deployment `6842871982` succeeded for the same commit, and the canonical live domain was exercised afterward. A subsequent evidence-only documentation commit must have its own CI/deployment status verified; these local results alone never establish hosted deployment.

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

Fresh live results are separate from local/previous evidence. Normal-user sign-in/session persistence/logout/returning login, invalid callbacks/guest recovery rejection, protected staff routes, returning onboarding, profile/hobby editing, stale wizard and privileged-action rejection passed. Posts/duplicate prevention/canonical IDs, Unicode counters, mood/hashtag, reactions/rollback, replies/counts/history freshness, follow/counts/rollback, local feed tabs/drafts, chronological/Discover/search/empty states and notifications-route privacy passed. Phone/email absence and no overflow were checked at 320/360/1280px in both themes. After deployment, all 25 live check groups including cleanup passed. Sixteen live mobile screen/theme axe scans had no violations; keyboard skip-link fragment navigation and next-tab focus passed. Own post deletion, actual guest/foreign-Origin/privileged-action rejection, fresh Secure cookies, real expired-session refresh retaining Secure and invalid-refresh route rejection passed. Uniquely labelled posts/comments were removed and the original follow relationship, persisted profile baseline, private phones, roles and suspension state were restored/unchanged. The initial profile-baseline limitation remains explicitly recorded below.

The earlier dedicated production moderation audit passed its 13 checks and cleaned its fixtures; the owner explicitly confirmed that prior acceptance. This audit rechecks server authorization, normal-user route restriction, role integrity and audit history without repeating destructive moderation. **At the end of that audit, the configured admin login was rejected**; its database account is complete, verified, unsuspended and still admin. Confirm the designated secure credentials with the owner before claiming a fresh authenticated admin session. No speculative auth changes or password reset were made.

Operator acceptance still outstanding at that audit (the follow-up below supersedes this list):

- Configure disposable `PRODUCTION_QA_EMAIL`, `PRODUCTION_QA_PASSWORD`, `PRODUCTION_QA_PHONE` securely plus owned inbox access, or complete verification/recovery links as the mailbox owner. Fresh production signup/email verification/recovery/account deletion were not repeated: deleting/resetting the existing admin or normal test account is not acceptable QA. The owner previously confirmed fresh production signup/confirmation/onboarding and custom SMTP delivery; local complete-flow coverage passed again.
- The scoped Management API token can inspect the database but **Auth configuration reads return 403 for missing `auth_config_read`**. Grant that read scope securely or check exact Site URL/redirects, confirmation/password settings, SMTP sender/delivery/quotas and CAPTCHA in the dashboard. A denied config read is not evidence that Auth is broken. No secret setting values should be printed.
- `NEXT_PUBLIC_SUPPORT_EMAIL` is absent from the deployed privacy/community pages. Set a public operator support/appeals mailbox in Vercel Production and redeploy; ensure moderation coverage and retention/appeals procedures before public launch.
- Live notification route/privacy is checkable with the normal test account; two-recipient creation/group/read/navigation acceptance needs the second designated actor. Local database/browser notification scope coverage passed. Do not mark all existing production notifications read for convenience.
- A live QA helper initially failed to restore the designated test profile because of multipart streaming-field order; the helper was corrected and its later writes restore a persisted baseline. The temporary QA bio was removed, but the initial education/hobby snapshot was not persisted, so original education/hobby/institution-related test values require owner review. No real user, phone, role or suspension state was changed by that profile test.
- Real Android/iOS devices, other browser engines/screen readers, production load/abuse capacity, backup restoration, optional CAPTCHA/custom domain and the application Docker image remain separate acceptance. The native standalone build and small backend are tested; the full Supabase CLI stack exceeded workspace disk capacity during the initial build.

### Interaction/performance review

The existing architecture uses a caller-session six-action social endpoint, canonical public mutation payloads, scoped optimistic state/rollback and serialized writes. The five-second per-mounted-feed cache is bounded and coalesces reads; mutation generations reject stale in-flight responses. Tab selection/history is local. Route refresh is reserved for navigation racing a pending write or restoring a pre-write history snapshot; settings/safety/moderation keep authoritative revalidation. React request caching avoids repeated metadata/page reads. Follow relationships are batched and exact counts remain SQL/RLS derived.

No evidence justified a speculative cache/query rewrite. Tests hold responses to distinguish immediate UI from confirmed database state, exercise real rejection and lost-response reconciliation, and assert that ordinary feed-tab changes issue no document reload. There is no realtime cross-user push: bounded feed/list sizes and foreground refetch behavior are intentional MVP limits, not a guarantee of instantaneous remote updates.

## Launch-acceptance follow-up — 4 October 2026

Rechecked the same production origin/project on committed `main` at `2096b0a7a0d8149e08e5de08d9353182a0cbdfcb`, after the owner configured the public support mailbox and redeployed. No application code, environment setting, migration, credential, real user or real content was changed by this follow-up.

### Acceptance closed with fresh hosted evidence

- **Support:** privacy/community pages render one consistent valid `mailto:` contact matching its displayed address. The conditional `Support` component demonstrates that production `NEXT_PUBLIC_SUPPORT_EMAIL` is active; the variable is not injected into this cloud shell. Health remains 200. Mailbox delivery itself was not tested.
- **Admin:** the current designated secure credentials complete fresh login, `/admin` and `/moderation` access, logout/login and role persistence. Normal-user access is denied. Both designated accounts are verified, complete and unsuspended. The earlier rejection is not reproducible; its historical cause cannot be established from retained evidence, so no password reset or speculative Auth fix was made.
- **Notifications:** two separately authenticated designated actors verified follow, switched reaction and comment events: correct recipient, no incorrect actor/self notification, correct profile/post/reply navigation, follow deduplication, one reaction event after switching, and scoped persisted read/unread behavior. Reaction removal deletes its event. Owned post/comment/notification fixtures were removed; the original follows and every pre-existing notification's read state/timestamps matched their privately saved baselines afterward. Phones, roles and suspension state were unchanged. No destructive moderation replay occurred.
- **Session/recovery request:** fresh normal login, logout removing session cookies, guest route denial, safe invalid callback, returning login and HTTPS Secure cookies passed. One recovery request to the designated existing test mailbox was accepted and updated Auth's recovery timestamp; login with the unchanged password afterward passed. No recovery link was opened or password changed. Phone was absent from session/JWT metadata; private phones/emails were absent from authenticated inbox/public pages and the public feed response. Only own settings showed the phone.
- **Database:** native versions `202610040001`, `20261004000200`, `20261004000300` and stored migration sources still match Git. The catalog matches the previously verified fresh-chain catalog; all 15 tables retain RLS, public/private grants remain intentional, and the Auth phone guard is active. Read-only probes rejected forged staff claims/actions and missing/null/incorrect deletion confirmation. No complete account has phone metadata. The historical orphan incident remains documented; the current read-only count finds zero Auth accounts without application profiles. No repair, deletion or cleanup of historical accounts was performed by this run.
- **Profile:** the designated test profile contains no obvious QA marker text. Its current values differ from the older persisted later baseline; they were left unchanged rather than overwriting possible owner edits. The uncaptured original optional education/hobby/institution baseline remains an owner-review item, not evidence of a product defect.

### Acceptance still requiring operator access

- `PRODUCTION_QA_EMAIL`, `PRODUCTION_QA_PASSWORD`, `PRODUCTION_QA_PHONE` are absent, and no secure inbox integration is available. Fresh disposable hosted signup → delivered confirmation → callback/session → completed password recovery/new-password login → exact-`DELETE` account deletion/cascade/rejected subsequent login **was not performed**. Existing designated admin/normal accounts were not deleted or reset; historical owner-confirmed signup/delivery and local complete-flow tests remain separate evidence.
- Auth configuration inspection still returns 403 for missing `auth_config_read`. Exact current SMTP sender/configuration, Site URL/redirect allowlist and email/password/confirmation settings need authorized read access or owner dashboard confirmation. The successful recovery request proves provider acceptance, not inbox delivery. Hosted log queries did not yield usable diagnostics; no historical password/provider cause is inferred from that limitation.

### Focused checks actually run

`git diff --check`, lint and strict typecheck passed. The six selected Vitest suites passed **55 tests**, including all **37 DB/RLS/migration/bootstrap tests**, validation, social-route security and real-SDK session-cookie regressions. Live browser checks exercised the acceptance above. Four additional axe scans of the support/community screen at 360/1280px in light/dark found no WCAG A/AA violations or horizontal overflow. The runtime source, dependencies, configuration and migration bytes are unchanged, so the already verified production build/full local browser suite was not repeated. GitHub CI and Production deployment for `2096b0a` remain successful; the owner redeploy's updated support contact was verified on the canonical live domain.

QA-probe corrections were confined to ignored helpers: select the form's error instead of Next.js's empty route announcer, use the existing `haha` reaction key and canonical returned comment list, match session-cookie chunks without the PKCE verifier, and run notification checks separately from same-account logout (which can revoke their session). The final isolated notification sequence and fixture cleanup passed. No reproducible application defect was found, and unrelated UI/design/copy/security behavior was preserved.

**Verdict at this follow-up: B — minor operator-access acceptance items remained (superseded by the closure below).** Support, fresh admin access and two-actor notifications are closed. Disposable hosted confirmation/recovery/deletion and current Auth/SMTP configuration/delivery acceptance remain unverified. Repository handoff remains A; unverified checks must not be promoted to passing results.

## Disposable hosted Auth acceptance closure — 4 October 2026

This follow-up supersedes the earlier B verdict and missing-QA-variable status above. It used only the securely designated disposable QA account against the canonical production origin and intended Supabase project, starting from committed `main` at `2adf6b7e2df97b66f4e2b1cb643faefb7ff3d2cb`. No application code, environment configuration, migration, real account/content or historical orphan record was changed.

- **Fresh signup and confirmation:** the previously absent disposable Auth account was created through the production signup form, together with its public profile, private account and ordinary role. It initially required confirmation; the owner received the confirmation email and the database subsequently confirmed verified state. The original signup callback/session was not instrumented successfully and is not claimed as an automated pass. The owner explicitly approved continuing this confirmed account rather than repeating signup or resetting its verification.
- **Confirmed-account session:** fresh login, optional onboarding, logout/session removal, protected-route rejection and returning login passed in the production browser. Optional education/institution fields were not required. Phone remained absent from Auth metadata and session/JWT claims; only the owner's settings exposed the private phone.
- **Recovery:** the production recovery request was accepted and its new send timestamp verified. The owner explicitly confirmed receipt, a working recovery link and successful password reset. Delivery, recovery-link/callback completion and password reset are **manual owner evidence**, not an automated inbox test. Recovery was not repeated after this confirmation. A fresh automated login using the securely configured post-recovery password passed with Secure session cookies.
- **Deletion:** only QA-owned post, reply and reaction fixtures were created, and their profile/private/role/social rows and abuse receipts were verified before deletion. The actual settings form used exact `DELETE` plus its browser confirmation. Auth deletion and session clearing passed; login with the previously working post-recovery password was rejected afterward.
- **Cascades:** read-only queries scoped to that disposable UUID and owned post found zero remaining profiles, private accounts, roles, posts, comments, reactions, follows, blocks, mutes, notifications or action receipts. Follow/block/mute/report/audit fixtures were not created in this acceptance, so their zero counts are absence checks, not new non-vacuous cascade tests. Existing reports/audit history and real users were untouched; local database coverage separately verifies retained-history rules.
- **SMTP/Auth:** current configuration reads still return HTTP 403 for missing `auth_config_read`. The successful owner-confirmed confirmation/recovery delivery and recovery completion, observed email-verification requirement and fresh email/password sessions provide runtime acceptance evidence. Exact SMTP sender/domain/quotas and the complete Site URL/redirect allowlist were not directly inspected; the owner remains responsible for dashboard settings and provider operations. No secret configuration was read or printed.
- **Final checks:** lint, strict typecheck and `git diff --check` passed. Five focused Vitest suites passed **46 tests**, including all **37 DB/RLS/migration/bootstrap tests**, validation and real-SDK session-cookie regressions. Live browser checks passed post-recovery login, phone privacy, exact-confirmation deletion, deleted-login rejection and fixture cleanup. Health returned 200 with `{"status":"ok"}`. An initial lint failure came solely from browser-global declarations/one unused import in ignored QA helpers; those helpers were corrected without changing tracked application files or weakening lint. Runtime code/configuration/dependencies/migrations are unchanged, so the previously verified production build/full browser suite was not unnecessarily repeated.

Support configuration, fresh designated admin access and two-actor notification acceptance remain covered by the preceding hosted follow-up; destructive moderation was not replayed. The old optional education/hobby baseline still requires owner review if restoration is desired; no baseline was fabricated. Unrelated UI, Bengali copy, behavior, privacy and authorization boundaries were preserved.

**Launch verdict: A — ready to launch on the scoped acceptance evidence above.** Direct Auth-configuration inspection remains permission-limited; real devices, broader load/backup recovery and ongoing mail/moderation operations retain the existing documented limits. This is dated evidence, not a permanent guarantee. Repository handoff remains A.

## CI failure diagnosis for maintainers

1. Find the run for the **exact commit**, failing job/step and complete logs; compare with the preceding commit. Vercel deployment and local passing checks are separate evidence.
2. Separate repository failures from image pulls, disk capacity, unavailable Docker/proxy/registry/network hosts and provider timeouts. Preserve the underlying error instead of inventing an Auth/schema fix.
3. Reproduce from a fresh fictional stack as well as repeated startup. Do not use production data, weaken tests, disable TLS/RLS or remove services to get green status.
4. GitHub signed-log downloads can redirect to a results-storage hostname. Add the exact host through approved environment settings; never bypass proxy/TLS. The two failing-run downloads were initially blocked in this audit but later succeeded, exposing the confirmed missing-ripgrep failure above. The fixed run's job/step API reports success; a further raw-log download redirected to another blocked storage host, which does not negate that hosted status.
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

## Final launch polish — 4 October 2026

This milestone starts from `2dfae262de840c47b4c1a987b0244a54e8a9c240` and preserves the production theme, navigation structure, Bengali-first identity and caller-session/RLS architecture. Root instructions and the canonical repository documents were audited before implementation; previous acceptance is historical evidence, not a substitute for these checks.

### Product audit and implementation

| Area                    | Result                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unread notifications    | Small absolute-position badges in both existing navigations; Bengali count/accessible label, capped at ৯৯+. One request-cached, recipient-filtered query reads at most 100 IDs. No polling or full count.                                                                                                                          |
| Notification read rules | Visiting the inbox leaves notifications unread. Opening an unread link or its read button marks only its group IDs, then updates the badge from the server. Reaction groups preserve post/read-state boundaries; replies have comment anchors. Explicit mark-all-read remains. Unrelated recipients/entries remain unread.         |
| Daily question          | Existing homepage placement retained. Explicit Asia/Dhaka calendar selection; same-day stable, changes at Dhaka midnight, 31 unique curated questions before repetition. No storage/API.                                                                                                                                           |
| Accents                 | Only labels changed: mango→কমলা, mint→সবুজ, berry→বেগুনি, sky→নীল. Existing IDs, colors and selections preserved.                                                                                                                                                                                                                  |
| Bengali copy            | Focused corrections to optional status, phone/privacy hints, institution/onboarding wording, topic counts and retention/report guidance. Existing approved landing/auth tone otherwise retained. Topics count distinct authors, so their label now describes people.                                                               |
| Validation/errors       | Auth, private phone, profile and onboarding reuse existing Zod rules with safe field errors, visible summary, announcements and first-visible-field focus/scroll. Username conflict is explicit because usernames are public; email existence remains undisclosed. Internal/provider errors are never returned verbatim.           |
| Bengali years           | SSC/HSC accept ASCII/Bengali digits and normalize to ASCII; mixed digits valid, letters/other numeral scripts/out-of-range invalid. Existing 1000–2999/empty SQL rule retained. Unicode whitespace trim agrees in frontend/server/SQL. Free text is untouched.                                                                     |
| Status/emoji            | Optional, trimmed plain text, 40 Unicode codepoints in Zod/SQL. Earlier profile/onboarding placement and natural encouragement. Empty whitespace clears status; old values preserved. Long profile text wraps without altering short emoji decoration.                                                                             |
| Timestamps              | Shared formatter and semantic time element: এইমাত্র, 1–59 minutes, 1–23 hours, then compact Dhaka date. Exact Dhaka time in title; used for posts, replies and notifications.                                                                                                                                                      |
| Claude-like decoration  | Root cause was the Unicode sunbursts `✺`/`✳`, not an imported logo asset. Replaced locally by existing Lucide MessageCircle icons. Source/UI audit found no unintended AI-provider branding.                                                                                                                                       |
| Right panel             | Removed static redundant আজকের vibe without adding a query/section. Existing আলোচনায় and guidance remain; daily question stays in its original home position.                                                                                                                                                                      |
| Auth routes             | Valid users visiting login/signup redirect home. Guest access and callback/recovery/reset utilities retained.                                                                                                                                                                                                                      |
| Branding                | Existing Tuktak SVG/tab icon preserved; no default Next branding. Theme-color metadata follows current tokens. New 1200×630 share image reuses existing SVG, font, colors and tagline.                                                                                                                                             |
| Metadata/SEO            | Public routes get canonical/OG/Twitter metadata, defaulting to https://tuktakbd.vercel.app. Sitemap lists only public launch pages; robots excludes private/auth/API pages. Existing private-page noindex retained; no private account fields in metadata.                                                                         |
| Privacy                 | Existing Bengali page refined for private phone/no discovery and honest report/audit/provider-backup retention.                                                                                                                                                                                                                    |
| Terms                   | New concise Bengali /terms page describes actual features, responsibilities, moderation, appeals and deletion limits; no invented legal entity or legal-review claim. Posts/replies can be deleted; profile can be edited.                                                                                                         |
| Community/moderation    | Existing /community rules and reporting retained; report identity hidden from other users, accessible to authorized staff. Appeals use configured support.                                                                                                                                                                         |
| Support                 | Existing NEXT_PUBLIC_SUPPORT_EMAIL component retained, shared with Terms. Signup/desktop legal links and small settings links make policy/support discoverable on mobile. No separate help system or operator secret.                                                                                                              |
| PWA                     | No manifest/service worker/install system existed. Icon/theme metadata verified; full install/offline support remains post-launch, as requested.                                                                                                                                                                                   |
| UI/accessibility        | Local badge, error hierarchy, status wrapping/location, reply anchors and legal links only. Existing theme/typography/cards/layout retained. Reviewed actual production before screenshots versus local after at 320/360/768/1280 in light/dark. Axe, focus, touch targets, Bengali/long content and overflow regressions covered. |
| Performance/privacy     | Bounded indexed unread lookup; request-scoped viewer/count caching. No N+1, polling, service-role runtime client, global auth cache or new full-page refresh. Existing authorization, same-origin social protection and public/private separation retained.                                                                        |

### Files and migrations

Changes are confined to config/validation/data/actions, shared notification/error/time/metadata helpers, the affected auth/profile/onboarding/home/sidebar/navigation/policy components and routes, OG image, regression tests and canonical documentation. No dependency, core palette/font, hosting configuration or old migration changes.

Two new forward files: `20261005000100_launch_polish.sql` (status constraint, narrow normalization trigger, partial unread index) and `20261005000200_batch_whitespace.sql` (Unicode batch trim alignment). The second preserves the already locally applied first file's immutable bytes. Fresh-chain and upgrade tests preserve saved rows/accents and check boundaries, trigger privileges, RLS, grants and repeated migration startup. Production PostgreSQL accepted both migrations in a trial transaction that was completely rolled back. Both were then applied atomically with their exact sources in native migration history. Existing profile rows were fingerprint-checked inside the transaction and preserved; historical migration sources, policies, table grants and all 15 RLS tables remain unchanged. Native history now contains the three previous versions plus `20261005000100` and `20261005000200`. A schema/catalog recovery snapshot was saved privately before deployment; it is not a full data/backup-restore rehearsal.

### Validation and limits

- Formatting, lint (zero warnings), strict typecheck, production build and git diff --check passed.
- Vitest: **105 passed across 10 suites**, including authorization/privacy, single/group/all reads, unrelated recipients/counts, fresh/upgrade/history preservation, Bengali years/status, Dhaka questions and time boundaries.
- Browser suite: **34 passed (2.2 minutes)**, including existing social/Auth/security behavior plus seven focused launch-polish regressions. The additional badge axe check initially timed out while awaiting unrelated hidden/offscreen feed transitions; its wait now scopes to visible navigation. No app animation or accessibility rule was disabled.
- Runtime dependency audit: **zero vulnerabilities**, with no dependency changes.
- Visual evidence is retained in ignored `.local/polish-production-before`, `.local/polish-before`, `.local/polish-after` and Playwright screenshots. Automated scans supplement visual review; real-device/assistive-technology certification is not claimed.
- A proposed persistent proxy-CA installation was rejected by automatic approval review because it would broaden HTTPS trust. It was not performed. Production browser requests instead use the existing proxy and TLS-verified request/response interception; no TLS validation is disabled.
- No new realtime notification delivery: counts refresh on new server renders/inbox loads and immediately on read actions. No email notification/phone OTP/PWA introduced. Existing feed/inbox bounds, operator mail/moderation/retention duties and broader device/load/backup recovery limits remain. Legal pages are factual product guidance, not professional legal review. Fresh hosted destructive signup/recovery/deletion is not replayed on existing accounts for this milestone; local complete-flow regressions cover unchanged utilities.

### Changed-file inventory

- `public/og-image.png`
- `src/app/terms/page.tsx`
- `src/components/form-feedback.tsx`
- `src/components/notification-count.tsx`
- `src/components/notification-list.tsx`
- `src/components/timestamp.tsx`
- `src/lib/form-errors.ts`
- `src/lib/metadata.ts`
- `src/lib/notifications.ts`
- `src/lib/time.ts`
- `supabase/migrations/20261005000100_launch_polish.sql`
- `supabase/migrations/20261005000200_batch_whitespace.sql`
- `tests/e2e/launch-polish.spec.ts`
- `tests/launch-polish.test.ts`
- `AGENTS.md`
- `HANDOFF.md`
- `README.md`
- `VALIDATION.md`
- `src/app/actions.ts`
- `src/app/community/page.tsx`
- `src/app/discover/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/notifications/page.tsx`
- `src/app/page.tsx`
- `src/app/post/[id]/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/robots.ts`
- `src/app/settings/page.tsx`
- `src/app/signup/page.tsx`
- `src/app/sitemap.ts`
- `src/app/tag/[tag]/page.tsx`
- `src/app/u/[username]/page.tsx`
- `src/components/discussion.tsx`
- `src/components/forms.tsx`
- `src/components/navigation.tsx`
- `src/components/onboarding.tsx`
- `src/components/post-card.tsx`
- `src/components/right-rail.tsx`
- `src/components/support.tsx`
- `src/lib/commands.ts`
- `src/lib/config.ts`
- `src/lib/data.ts`
- `src/lib/types.ts`
- `src/lib/validation.ts`
- `tests/data.test.ts`
- `tests/database.test.ts`
- `tests/migrations.test.ts`

### Hosted deployment and live acceptance

Implementation commit `a7bf863ee2d8866dabc756f6c73fab08123e0440` was pushed as a fast-forward to `main`. GitHub CI [37227987217](https://github.com/tanzilamd/tuktak/actions/runs/37227987217) completed successfully, including clean dependency installation, lint/type/Vitest/audit, fresh local stack, repeated startup without ripgrep, production build/start and the full browser suite. Vercel's commit status and GitHub Production deployment `6845555146` both report success for this exact SHA. The canonical live origin serves the new Terms, metadata, SVG icon and share image; health returns 200/ok.

Live TLS-verified browser acceptance passed:

- Home/signup/Terms visual, axe and horizontal-overflow checks at 320/360/768/1280px in light/dark. The original theme remains recognizable against actual production-before screenshots. Policies have canonical/OG/Twitter metadata and configured support links; robots/sitemap contain the production origin and public Terms.
- Signup empty submission exposes all five field errors and focuses the first visible invalid field without creating an account. Existing-user fresh login works; login/signup redirect home; forgot/reset utilities remain reachable without sending mail or changing a password. Optional status rejects 41 characters beside its field, and all accent IDs remain intact.
- Mobile settings exposes policy/support; its link reaches the actual public support paragraph. Settings axe scan passes.
- Two designated actors created only a temporary owned post, reaction and reply. The inbox left their events unread. Opening the reply notification marked only that entry, navigated to its comment anchor and immediately reduced the badge; the unrelated reaction stayed unread. Opening that reaction marked it and navigated to the post. Local regressions separately verify two-actor grouped reactions and explicit mark-all-read; production mark-all-read was not replayed on pre-existing notifications.
- All owned post/reply/reaction/notification fixtures were removed. Privately saved baseline comparison proves every pre-existing notification ID/read timestamp, the designated public profile, private account and role exactly preserved. No real users' content, phone, role, suspension or historical account was changed.

The verification-only documentation follow-up does not change app/migration/dependency bytes. Final commit/push/deployment status is also provided in the task report. Post-launch candidates remain measured pagination/realtime improvements, PWA/install/offline support if prioritized, real-device/assistive-technology checks, legal review and operational load/backup/mail/moderation exercises. No additional product feature was added to pursue those ideas.

**Verdict: A — launch polish complete on the scoped local and hosted evidence above.**

## Safe PWA V1 — 5 October 2026 (Asia/Dhaka)

This focused milestone supersedes the historical PWA deferral above. The checkout began clean on `a5bf8c7a6fe3a7d55b258d1d8a9ff1d7a216717e`; existing production branding and authenticated Home were inspected before changes. No database migration, dependency, Auth/RLS change or unrelated product refinement is included.

### Behavior and safety

- `/manifest.webmanifest` identifies টুকটাক, with Bengali language, standalone display, root identity/start/scope and the existing cream theme/background. URLs use the existing canonical configuration (production defaults to `https://tuktakbd.vercel.app`). Standard 192/512px, 512px maskable and 180px Apple PNGs derive from the unchanged existing SVG. Existing favicon and branding remain intact.
- A compact existing-style card sits **composer → install card → feed tabs → feed**. It appears only after a real Chromium install opportunity or in appropriate iPhone/iPad Safari; unsupported and standalone contexts hide it. Native prompting requires a click. Safari gets concise Share → Add to Home Screen instructions, not a fake install action. Dismissal and native prompt choices suppress reminders for 30 days; completed installation hides immediately and records only a nonidentifying installed flag. Blocked storage preserves session-local behavior. Browser uninstall detection and cross-browser/device preference synchronization are not claimed.
- The worker caches exactly `/offline/index.html` and `/offline/hind-siliguri-bengali-400.woff2`, with credential-free precaching and the font's existing OFL license. The fallback uses the existing glyph, palette and Bengali typeface, honors light/dark preferences, explicitly shows no old posts and offers a user-triggered retry.
- Allowlisted public **document navigations** are network-authoritative and receive the generic fallback only on network exceptions. Auth/login/signup/recovery/callback, private pages, APIs, mutations, RSC fetches, build assets and cross-origin Supabase requests bypass interception. HTTP authorization/error responses pass through. No live response is stored, including authenticated public-page HTML, feed/profile/notification/account/session data.
- Worker registration bypasses HTTP caches; foreground update checks are throttled to once an hour without timers. Precaching finishes before immediate activation, which removes only older owned offline caches and never reloads a tab, replays a write or changes app-code caching. Future offline-bundle changes require a new cache version. Existing Vercel application assets remain fresh through normal network requests.

### Validation and evidence

- Formatting, lint (zero warnings), strict typecheck, production build, runtime dependency audit (zero vulnerabilities) and git diff --check passed. No lockfile/dependency changes.
- Vitest: **132 passed across 11 suites**, including 27 new manifest/preferences/iOS/actual-worker-source regressions. Existing fresh/upgrade/RLS/security suites also pass; no schema change was needed.
- Seven focused PWA browser regressions exercise native CDP manifest/installability checks, PNG/Apple icons and worker headers; card placement, four widths and both themes; user-triggered event handling, decline/dismiss/reload, completed-install race and standalone/blocked storage; iPhone/iPad instruction fallback; actual controlled-worker offline fallback/font/reconnect and exact cache contents after auth utilities and APIs. Event/platform simulations are explicitly distinct from OS installation.
- Full production-build browser release suite: **41 passed (2.3 minutes)**, including unchanged signup/email verification/onboarding/recovery/deletion, social/API authorization and notification behavior. The added iOS axe scan initially sampled an in-progress theme transition; it now awaits the affected card's existing transitions and fonts before scanning. No animation or accessibility rule was disabled; the corrected focused and full suites pass.
- Actual production-before Home screenshots were compared against local after at **320/360/768/1280px, light/dark**. The card wraps locally, with 44px action targets and existing tokens; navigation, composer, feed cards and sidebar styling are untouched. Axe scans cover the card and offline page; keyboard dismissal returns focus to the active feed tab. iOS instruction scenarios also receive light/dark axe/overflow checks. Screenshots remain ignored in `.local/pwa-before`, `.local/pwa-after` and Playwright artifacts.
- Chromium's real `Page.getAppManifest` reports no errors and `Page.getInstallabilityErrors` returns an empty list. The packaged headless browser does not expose `PWA.install`; actual OS installation/standalone launch on physical Android/iPhone/iPad is **not verified**. Standalone visibility and successful-install handling are covered by explicit platform/event simulation. No browser installation is fabricated.
- Production browser verification uses the session-supplied CA inside a disposable browser container, keeping TLS verification enabled and executor home/system trust unchanged. Local fictional database tests never use hosted credentials/data. The cloud onboarding workflow and existing reusable install/start instructions were inspected; existing saved instructions already support the validated current instance, so no configuration replacement was necessary. Publication/fresh-task restoration is a separate platform operation.

### Changed-file inventory

`AGENTS.md`, `README.md`, `HANDOFF.md`, `SECURITY.md`, `VALIDATION.md`; `next.config.ts`, `src/proxy.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/home-feed.tsx`; new `src/app/manifest.ts`, `src/lib/pwa.ts`, `src/components/pwa-provider.tsx`, `src/components/install-card.tsx`; new `public/sw.js`, `public/icons/{icon-192.png,icon-512.png,icon-maskable-512.png,apple-touch-icon.png}`, `public/offline/{index.html,hind-siliguri-bengali-400.woff2,FONT-LICENSE.txt}`; new `tests/pwa.test.ts`, `tests/e2e/pwa.spec.ts`.

Release-suite and hosted deployment evidence will be recorded after those checks complete. Post-launch PWA candidates are physical-device/assistive-technology testing and platform-specific install wording if real usage warrants it. Push notifications, background social synchronization and offline feeds remain outside Safe PWA V1.
