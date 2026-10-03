# Validation evidence

Validation performed in this cloud workspace on 4 October 2026 (Asia/Dhaka). No production credentials were provided.

## Passed

- `npm ci`: frozen lockfile installation, including after updating the lint toolchain.
- `npm run lint`: current ESLint 10, TypeScript, React and Hooks rules; no errors or warnings.
- `npm run typecheck`: strict TypeScript.
- `npm test`: **24 tests passed**, no skips. Executes the actual SQL migration in PostgreSQL (PGlite), with isolated anonymous/authenticated roles, plus server-boundary validators. Covers email-verification guards, usernames/reserved names, Unicode length limits/blank text, privacy, posts/duplicates/rates, replies/deletion, reaction switching/removal, follows/self-follow, symmetric blocks, mute/unmute, reports/staff/admin authorization, suspension/unsuspension, cascading deletion, notification read scope, Bengali hashtags and topic spam constraints. Includes cleanup of one's own follows/mutes after a target is suspended.
- Fresh local PostgreSQL 17 / Supabase GoTrue / PostgREST migration and fictional seed initialization using `npm run local:start`.
- Repeated `npm run local:start`: preserved local configuration/data; did not rerun initial schema or seed.
- `npm run build`: successful optimized production build; authenticated application pages remain dynamic.
- `npm start`: portable standalone Node server, serving the compiled app and self-hosted fonts. `/api/health` returned HTTP 200 and `{"status":"ok"}`.
- Complete Playwright suite on the production server: **9 tests passed**, no skips. Includes signup → Mailpit verification email → PKCE callback → optional onboarding, recovery → new password login, account deletion, protected routes, posting/counters/moods, reaction switching, comment/post deletion, follow feed, block/unblock, reports, moderation audit and admin role management. Tests use real local GoTrue sessions and real PostgREST requests.
- HTTP API checks: anonymous private queries fail, another user's private account returns no rows, public profile rows contain neither phone nor email, session metadata contains no phone, forged table writes and normal-user moderation/admin calls fail, caller identity overrides forged authors, and overlength/whitespace RPC posts fail. Concurrent follow/reaction/block requests leave no mutual follow or notification records.
- Automated axe WCAG A/AA checks: public screens in both themes and authenticated forms/settings at **320px**, in both themes. No violations in the selected screens; this does not imply every assistive-technology/device combination is certified.
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

No unresolved failures remain in the selected local workflow. Hosted-provider acceptance checks are deliberately separate; do not treat local results as proof a public deployment is live.
