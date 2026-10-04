# Owner handoff — টুকটাক

The application is deployed and the local development workflow is implemented. Treat this file as production operations guidance; [AGENTS.md](AGENTS.md) owns permanent development rules and [VALIDATION.md](VALIDATION.md) separates current checks, historical evidence and unverified items.

## Current production

| Setting                          | Intended value                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Repository / production branch   | `tanzilamd/tuktak` / `main`                                                            |
| Production URL                   | `https://tuktakbd.vercel.app`                                                          |
| Supabase project reference / URL | `guqzypztckfnapmptjpu` / `https://guqzypztckfnapmptjpu.supabase.co`                    |
| Deployment source                | Connected GitHub → Vercel project; pushes to `main` trigger production builds          |
| Migration history                | `202610040001`, `20261004000200`, `20261004000300`, `20261005000100`, `20261005000200` |

All three migrations were applied and their stored sources/catalog checked against Git. Production signup/confirmation/onboarding, private-phone protection, dedicated admin/moderation and social-interaction flows have received verification. Auth email delivery was owner-confirmed; SMTP credentials/configuration remain owner-managed. None of this is a permanent guarantee: recheck the affected flows after each change. An existing admin is already bootstrapped; do not run first-admin setup again or recreate/reset this project.

## Owner responsibilities and new-environment prerequisites

- Existing production Supabase/Vercel resources are listed above. Create separate resources only for a deliberately new/staging environment.
- Preserve the verified owner/admin account, canonical origin and custom SMTP integration. Verify SMTP sender/domain, delivery and quotas with mailboxes you own; the app does not provision or operate your mail service.
- [ ] An operator support/appeals contact and a staffed moderation process; set `NEXT_PUBLIC_SUPPORT_EMAIL` to a public operator mailbox before public launch.
- [ ] Review the privacy/community policy for your operation, especially retention and student safety.
- [ ] Optional: Turnstile keys, DNS access for a custom domain, backup/monitoring settings appropriate to usage.

Do not post any secret in GitHub issues, chat, screenshots, source files or client code.

## 1. Verify an existing project or initialize a new one

1. For current production, verify the project reference above before any command; inspect native history and take an appropriate recoverable backup before changes. For a new environment only, create a separate project in a suitable nearby region and save its **database password privately**.
2. Open **Project Settings → API / API Keys**. Record the project URL and **publishable key** (or legacy **anon** key). These two values are public safe. **Do not use service-role or secret API keys.**
3. For a fresh project, apply the entire ordered chain: `202610040001_core.sql`, `20261004000200_preproduction_guards.sql`, then `20261004000300_auth_phone_privacy.sql` under `supabase/migrations/`. The first creates the 15-table schema and RLS/RPCs. The second enforces null-safe deletion consent and stale-onboarding protection. The third prevents GoTrue from restoring phone metadata after signup and cleans existing metadata only where private phone storage already exists. For an existing project, inspect native migration history and apply only pending files; preserve all accounts/data and original version records. There is no media bucket.
4. Do **not** run `supabase/seed.sql` in production. It contains only development users with shared development passwords.
5. Verify the schema with the SQL below. All 15 rows must have `relrowsecurity = true`.

```sql
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
```

An alternative migration workflow using the locked dev CLI:

```sh
npm ci
npx supabase login
# Enter the access token only in the CLI's secure login flow.
npx supabase link --project-ref YOUR_PROJECT_REF
# Enter the database password privately when prompted.
npx supabase db push
```

Prefer the locked CLI's ordered migration workflow. Inspect `npx supabase migration list` and `npx supabase db push --dry-run` before applying pending files. Current production already has native records: do not run migration repair, replace statements or mark versions applied without executing them. Adopting historically untracked SQL requires a separate reviewed owner operation, complete source/catalog verification and explicit authorization; it is not normal deployment.

Read-only native history check in the intended project's SQL Editor:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

Expect all five versions listed above. A version record alone is insufficient: compare its stored `statements` to the committed file and verify the changed tables/constraints/policies/functions/triggers. Never print private table contents, credentials or Auth tokens as part of this check.

Never use `db reset` against production. After initial deployment, add new migration files; do not edit already-applied migrations or reset real accounts. The fictional local stack's `tuktak_local.migrations` ledger is not the hosted migration workflow; do not create it on production.

### Retesting signup safely

Use a completely new email you own to retest signup and confirmation. Supabase deliberately returns generic success for some existing confirmed addresses and does not send another confirmation email. Check provider logs before diagnosing email delivery or trigger failure. A verified user needs a profile, private account and role row; owner deletion of `profiles` cascades the latter two while leaving Auth intact and can cause `Account lookup failed`. Use the app's authorized account-deletion flow for deliberate cleanup, or sign out and use a fresh test account. Do not automatically recreate manually removed account data.

The original production signup incident followed such a manual deletion, not a failed Auth insertion or trigger. A separate reproduced provider behavior restored phone in Auth metadata after the AFTER INSERT trigger; the third migration prevents this on later metadata saves. Email confirmation, RLS, role authorization and the phone value in `account_private` remain unchanged.

## 2. Configure Supabase Auth

In **Authentication → Providers / Sign In**, enable email/password and **Confirm email**. Disable unused providers. Require at least 10-character passwords and retain refresh-token rotation. Recommended: enable secure password change/re-authentication and available leaked-password protection.

In **Authentication → URL Configuration**:

- **Site URL**: `https://tuktakbd.vercel.app` for current production.
- **Redirect URLs**: `https://tuktakbd.vercel.app/auth/callback`, `https://tuktakbd.vercel.app/reset-password`. Use the equivalent exact origins for deliberately separate deployments.
- For local development with this hosted project: add `http://localhost:3000/auth/callback` and `http://localhost:3000/reset-password`.
- For staging: add exact staging origins; keep production and staging data separate. Avoid broad wildcard production redirects.

The app uses server-generated PKCE verification and recovery links, then exchanges the code at `/auth/callback`. Default Supabase confirmation/recovery email templates must keep the `{{ .ConfirmationURL }}` link. Complete the link in the same browser used to request it; if a different device is needed, verify the email and then sign in with email/password in the original app. No phone OTP is configured; registration collects a private BD mobile number.

In **Auth → SMTP Settings**, configure your sender, SMTP host/port and credentials through the secure dashboard. Verify the sender domain with your mail provider. Confirm SPF/DKIM and delivery using real mailboxes you own. Keep Auth rate limits appropriate for expected registration volumes; add Turnstile for public signup/recovery protection.

## 3. Configure local hosted-project values

If `.env.local` is already using the fictional local stack, keep it privately as a backup before replacing it. Copy `.env.example` and fill only:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
NEXT_PUBLIC_SUPPORT_EMAIL=YOUR_PUBLIC_SUPPORT_MAILBOX
```

**PUBLIC SAFE VALUES**: all five variables above. A public key grants no protected access without RLS/session authorization. The site key is optional; publish an operator support mailbox before launch.

**SECRET VALUES**: database password, Supabase service-role/secret key, CLI access token, SMTP password, Turnstile secret, Vercel token, and optional Next.js multi-instance action encryption key. The app needs **none** of the Supabase privileged keys. Keep secrets in their provider's settings or server-only environment settings. Never name them `NEXT_PUBLIC_*`.

```sh
npm ci
npm run dev
```

Register a test account, verify its email, and exercise the acceptance checklist below before deploying.

## 4. Deploy to Vercel

1. Current production builds come from `main`; work is already pushed. Push only when the task explicitly authorizes it, after checking branch/remote/clean tree, committed build state and secrets. Use a PR/Preview for unapproved production work; never force-push.
2. Verify the existing connected Vercel project; import `tanzilamd/tuktak` only for a new project. Root directory: repository root. Framework: **Next.js**. Node.js: **24**.
3. Install command: `npm ci`. Build command: `npm run build`. Keep the framework's output-directory default.
4. Add the three required **public safe** environment values for the correct environment (Production and separately Preview): Supabase URL, publishable key and canonical `NEXT_PUBLIC_SITE_URL`. Set the site URL to your app's chosen Vercel origin; do not leave localhost or use an unrelated preview URL. Add the optional Turnstile site key only if Supabase CAPTCHA is enabled, and set `NEXT_PUBLIC_SUPPORT_EMAIL` to a public support/appeals mailbox.
5. If using this cloud machine with a hosted project, add the exact `YOUR_PROJECT_REF.supabase.co` hostname to its environment network allowlist. Deployment CLI access additionally needs your provider's API/auth domains. Deploy. If you changed any `NEXT_PUBLIC_` values after a build, **redeploy**; Next.js inlines these values.
6. Set the matching exact Auth Site/Redirect URLs in Supabase. When adding a custom domain later, update both providers and redeploy.
7. Request `/api/health`; it must return HTTP 200 and `{"status":"ok"}`. Open the app, register a real test account, verify email, sign in, and complete the checklist below.

Push the local commits without rewriting remote history:

```sh
git status --short
git log --oneline -5
git branch --show-current
git remote get-url origin
# Only when main and the intended remote are verified and push is authorized:
git push origin main
```

CLI alternative from your own authenticated terminal:

```sh
npx vercel login
npx vercel link
# Add values interactively; do not put secret literals in shell command arguments.
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add NEXT_PUBLIC_SITE_URL production
npx vercel deploy --prod
```

No Vercel-specific APIs, Redis, AI APIs, paid services or media storage are required. Ordinary Node hosting and a standalone Dockerfile are also provided. The connected production deployment has been verified; Vercel status and GitHub CI are separate checks. A passing deployment does not turn a failed CI run green.

## 5. Bootstrap the first admin

For a **new environment with no admin**, create and email-verify your own account through the app. The canonical procedure is [scripts/production/first-admin.sql](scripts/production/first-admin.sql). Replace only `YOUR_VERIFIED_OWNER_EMAIL` privately and execute it in the intended project's Supabase SQL Editor as the database owner. It locks role assignment, requires a complete verified unsuspended account, refuses when any admin already exists and writes a `bootstrap_admin` audit entry atomically. A successful bootstrap is a one-time operation; repeating it safely rejects. Never put a real email into the committed file, turn it into a migration or use an application/service-role client for it.

Verify the resulting role/audit from the trusted owner console without publishing private email/phone data:

```sql
select p.username, r.role, r.suspended
from public.profiles p join public.user_roles r on r.user_id=p.id
where r.role='admin';
select action, actor_id, target_id, created_at
from public.moderation_actions
where action='bootstrap_admin'
order by created_at desc;
```

Sign in again and open `/moderation` and `/admin`. Admins can grant/remove **moderator** roles from `/admin`; normal users and moderators cannot. The app cannot create additional admins or remove the last admin. Further admin assignments require another deliberate owner-console operation with an audit entry.

## 6. Public-launch acceptance checklist

- [ ] `/api/health` returns 200; no sample-content note appears.
- [ ] Real email verification, login, password recovery and logout work on the deployed domain.
- [ ] Registration requires username/private phone/password; invalid/reserved/duplicate usernames fail.
- [ ] Optional onboarding works for school, university, admission, gap year and not currently studying; no institution is required.
- [ ] Revisiting `/onboarding` redirects a completed account to profile editing with saved institution, visibility and education values intact. A stale wizard submission cannot overwrite them.
- [ ] 240-codepoint posts and 180-codepoint comments work; overlength requests fail at the database.
- [ ] Reaction switching/removal, comment/post deletion and chronological following feed work with two test accounts.
- [ ] Hidden institutions, phone and email do not appear in public profiles, API queries, search or metadata.
- [ ] Institution feed appears only with voluntary publication; normalized institution matches work.
- [ ] Block works in both directions; mute is private; unblock/unmute work.
- [ ] Reports are private; normal users cannot query reports, impersonate authors or use moderation/admin RPCs.
- [ ] Moderator can dismiss/hide/remove/suspend/unsuspend; admin role changes generate audit records.
- [ ] Notifications mark one, an aggregate group or all read without marking unrelated groups.
- [ ] Mobile navigation, Bengali typography, light/dark/system appearance and keyboard focus work on real Android/iOS browsers.
- [ ] Account deletion requires `DELETE` plus confirmation and removes related private/social rows.
- [ ] Direct deletion RPC calls with missing, null or incorrect confirmation fail; only exact `DELETE` succeeds. Verify the entire three-migration chain, including the phone-metadata guard, before enabling public registration.
- [ ] Owner support/appeals contact is published, moderation coverage exists, Auth abuse limits are configured, and backup/retention procedures are reviewed.

## Operations and remaining boundaries

Read `SECURITY.md`. Supabase Auth/provider logs can retain operational metadata; the app does not publish IPs or collect GPS. Blocking applies to signed-in users and cannot conceal inherently public posts from someone logged out. Discovery opt-out is not a private-account feature. Free text in retained reports/audits and provider backups needs an explicit owner retention policy.

Pagination is bounded for MVP: feed pages have 20 posts, guest feed 8, discussions and lists 100, tag lookup 200, and following/institution lookups 1,000 people. Plan measured pagination improvements before exceeding those bounds. There is no realtime push, phone OTP, Google OAuth, automated content moderation or email notification service beyond Auth. SMTP delivery and production hosting have prior evidence; owner configuration/quotas and fresh recovery delivery still need periodic verification. CAPTCHA, an additional custom domain, Docker application packaging, real devices and backup/load recovery are separate acceptance items, not implied by a passing local test suite.

## Safe production QA and maintenance

Use only explicitly designated accounts and uniquely labelled test content. Keep `PRODUCTION_ADMIN_EMAIL/PASSWORD`, `PRODUCTION_TEST_EMAIL/PASSWORD` and any disposable `PRODUCTION_QA_EMAIL/PASSWORD/PHONE` in secure environment settings, never Git/chat/logs. A fresh signup → confirmation → recovery → account-deletion test needs a disposable owned mailbox with secure inbox access or an operator completing the links; existing test/admin accounts must not be deleted to simulate signup. PKCE links and session cookies are secrets: do not attach them to reports or traces.

Persist the affected designated test baseline privately **before the first write**, and verify cleanup independently even when a browser/helper assertion fails. Report any unrecovered test-state change rather than claiming restoration. Snapshot only the affected designated test state privately; restore profile/follow/mute changes and delete only that run's owned posts/comments. Blocking removes bilateral follows/notifications, so avoid repeating it on existing accounts unnecessarily. Reuse prior dedicated moderation evidence and read-only authorization checks unless a regression justifies new destructive tests. Reports/audits and abuse receipts can intentionally remain; do not delete trusted audit history for a clean-looking test run.

Verify `/api/health`, the pushed commit's Vercel Production status and affected live flows after deployment. Check GitHub CI separately; use the failure diagnosis in [VALIDATION.md](VALIDATION.md). Never point `LOCAL_SUPABASE_TESTS=1`, seeds, local reset scripts or owner bypasses at production. Catalog/RLS/history comparisons are read-only. Do not automatically repair the deliberately orphaned historical test account.

For a managed cloud audit, management credentials need the operation's specific scopes. Database read/write access does not imply `auth_config_read`; a 403 means an unverified configuration read, not that Auth is broken. Inspect only setting names/presence and safe public URLs, not SMTP passwords/API secrets. GitHub signed-log downloads use an additional results-storage host; authorize that host through environment settings rather than bypassing network/TLS policy.

## Launch polish deployment

The new forward files are `20261005000100_launch_polish.sql` (40-codepoint status, profile-input trigger and partial unread index) and `20261005000200_batch_whitespace.sql` (match JavaScript Unicode whitespace trimming for numeric batches). They do not backfill or alter existing account/profile/accent values, RLS, grants or Auth. Preserve all previously applied migration bytes. Apply both in order, atomically with native history, before pushing the app build. Never load local seed/test data or the local migration ledger on production.

Unread badges are recipient-scoped and capped at ৯৯+, with no polling. Inbox visits do not read entries; following a link or its read button reads only that group. Mark-all-read remains explicit. Optional status is 40 Unicode codepoints; Bengali/ASCII batches store ASCII under existing year limits. New Terms and refined privacy/community wording are factual product guidance, not legal review. The operator owns mail delivery, moderation coverage, appeals and retention.

## Safe PWA V1 deployment

Manifest and install icons use the canonical `NEXT_PUBLIC_SITE_URL` and existing Tuktak identity. Keep it aligned with the deployed origin. `/sw.js` must remain JavaScript with no-cache/no-store headers and root scope; static PWA resources bypass Auth session refresh. The worker stores only `/offline/index.html` and its licensed Bengali font, fetched without credentials. App code and social/private/Auth/RSC responses remain network-authoritative. Offline fallback covers public document navigations, not callback/recovery/API/private routes or client RSC navigation.

Changing the offline bundle requires a new `tuktak-offline-*` cache version in `public/sw.js`. Installation precaches before activation; activation removes only older caches with that prefix and never reloads a user's tab. Browser update checks on registration plus throttled foreground checks bypass HTTP worker caches. Do not add app-code caching to this activation strategy without a separate safety review. Verify manifest/icons, native installability where tooling permits, standalone launch, cache contents, Auth utilities, CI and canonical Production after deployment. Real Android/iOS device behavior remains separate from desktop automation.
