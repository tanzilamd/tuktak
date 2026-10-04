# Owner handoff — টুকটাক

The application and local development workflow are implemented. **No hosted Supabase project or Vercel deployment has been created.** Local validation does not establish hosted email delivery, deployment or domain readiness. [VALIDATION.md](VALIDATION.md) records executed checks.

## What you need to supply

- [ ] A Supabase project in your own account.
- [ ] A Vercel project linked to `tanzilamd/tuktak` (repository root).
- [ ] A verified owner/admin account.
- [ ] A production app origin (a Vercel domain is sufficient; custom domain is optional).
- [ ] Production SMTP configuration and sender/domain verification for reliable Auth emails.
- [ ] An operator support/appeals contact and a staffed moderation process; set `NEXT_PUBLIC_SUPPORT_EMAIL` to a public operator mailbox before public launch.
- [ ] Review the privacy/community policy for your operation, especially retention and student safety.
- [ ] Optional: Turnstile keys, DNS access for a custom domain, backup/monitoring settings appropriate to usage.

Do not post any secret in GitHub issues, chat, screenshots, source files or client code.

## 1. Create Supabase and apply the schema

1. Create a new Supabase project. Choose a suitable nearby region and save the generated **database password privately**.
2. Open **Project Settings → API / API Keys**. Record the project URL and **publishable key** (or legacy **anon** key). These two values are public safe. **Do not use service-role or secret API keys.**
3. In Supabase **SQL Editor**, run the **entire** contents of each migration once, in filename order: first `supabase/migrations/202610040001_core.sql`, then `supabase/migrations/20261004000200_preproduction_guards.sql`. The first creates all 15 tables, constraints, indexes, RLS policies, profile-creation trigger and command/read functions. The second preserves authorization while enforcing null-safe deletion confirmation and rejecting stale onboarding submissions after completion. It creates no media bucket. For an existing project with the initial schema already applied, run only the new pre-production migration; preserve all existing accounts/data.
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

Use **either** SQL Editor **or** CLI-managed migrations. `db push` applies the full pending chain. If you initially use SQL Editor and later adopt CLI, mark each migration as applied only after verifying that its complete contents were run:

```sh
npx supabase migration repair --status applied 202610040001
npx supabase migration repair --status applied 20261004000200
```

Never use `db reset` against production. After initial deployment, add new migration files; do not edit already-applied migrations or reset real accounts. The fictional local stack's `tuktak_local.migrations` ledger is not the hosted migration workflow; do not create it on production.

## 2. Configure Supabase Auth

In **Authentication → Providers / Sign In**, enable email/password and **Confirm email**. Disable unused providers. Require at least 10-character passwords and retain refresh-token rotation. Recommended: enable secure password change/re-authentication and available leaked-password protection.

In **Authentication → URL Configuration**:

- **Site URL**: your canonical app origin, e.g. `https://YOUR_APP.vercel.app`.
- **Redirect URLs**: `https://YOUR_APP.vercel.app/auth/callback`, `https://YOUR_APP.vercel.app/reset-password`.
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

1. Push the implementation branch using the commands below. The cloud work includes local incremental commits; it has not pushed to GitHub. If the branch is `work`, select it for staging or merge it into your chosen production branch before deploying.
2. In Vercel, **Add New → Project → Import** `tanzilamd/tuktak`. Root directory: repository root. Framework: **Next.js**. Node.js: **24**.
3. Install command: `npm ci`. Build command: `npm run build`. Keep the framework's output-directory default.
4. Add the three required **public safe** environment values for the correct environment (Production and separately Preview): Supabase URL, publishable key and canonical `NEXT_PUBLIC_SITE_URL`. Set the site URL to your app's chosen Vercel origin; do not leave localhost or use an unrelated preview URL. Add the optional Turnstile site key only if Supabase CAPTCHA is enabled, and set `NEXT_PUBLIC_SUPPORT_EMAIL` to a public support/appeals mailbox.
5. If using this cloud machine with a hosted project, add the exact `YOUR_PROJECT_REF.supabase.co` hostname to its environment network allowlist. Deployment CLI access additionally needs your provider's API/auth domains. Deploy. If you changed any `NEXT_PUBLIC_` values after a build, **redeploy**; Next.js inlines these values.
6. Set the matching exact Auth Site/Redirect URLs in Supabase. When adding a custom domain later, update both providers and redeploy.
7. Request `/api/health`; it must return HTTP 200 and `{"status":"ok"}`. Open the app, register a real test account, verify email, sign in, and complete the checklist below.

Push the local commits without rewriting remote history:

```sh
git status --short
git log --oneline -5
git push -u origin HEAD
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

No Vercel-specific APIs, Redis, AI APIs, paid services or media storage are required. Ordinary Node hosting and a standalone Dockerfile are also provided. Actual deployment requires your account; it has not been attempted with invented credentials.

## 5. Bootstrap the first admin

Create and email-verify your account through the app. In Supabase SQL Editor as the project database owner, replace **only** the example email below with your own verified email. This is a trusted one-time console operation; never add it to client code.

```sql
begin;
lock table public.user_roles in exclusive mode;
do $$
declare owner_id uuid;
begin
  if exists(select 1 from public.user_roles where role='admin') then
    raise exception 'An admin already exists; review roles instead of re-bootstrapping';
  end if;
  select id into owner_id from auth.users
  where email='YOUR_VERIFIED_OWNER_EMAIL' and email_confirmed_at is not null;
  if owner_id is null then raise exception 'Verified owner account not found'; end if;
  update public.user_roles set role='admin' where user_id=owner_id;
  insert into public.moderation_actions(actor_id,action,target_type,target_id,note)
  values(owner_id,'bootstrap_admin','user',owner_id,'Owner console bootstrap');
end $$;
commit;
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
- [ ] Direct deletion RPC calls with missing, null or incorrect confirmation fail; only exact `DELETE` succeeds. Verify both migrations were applied before enabling public registration.
- [ ] Owner support/appeals contact is published, moderation coverage exists, Auth abuse limits are configured, and backup/retention procedures are reviewed.

## Operations and remaining boundaries

Read `SECURITY.md`. Supabase Auth/provider logs can retain operational metadata; the app does not publish IPs or collect GPS. Blocking applies to signed-in users and cannot conceal inherently public posts from someone logged out. Discovery opt-out is not a private-account feature. Free text in retained reports/audits and provider backups needs an explicit owner retention policy.

Pagination is bounded for MVP: feed pages have 20 posts, guest feed 8, discussions and lists 100, tag lookup 200, and following/institution lookups 1,000 people. Plan measured pagination improvements before exceeding those bounds. There is no realtime push, phone OTP, Google OAuth, automated content moderation or email notification service beyond Auth. Optional CAPTCHA, hosted SMTP, custom domain, Docker image packaging and real-device testing still need owner/provider validation.
