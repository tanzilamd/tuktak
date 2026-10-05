# আড্ডা সামলাই — controlled Phase 2 checkpoints

Phase 1 sharing is published at `3d6fc556b1fdd521cb60983361e58e2f8018e548`; its GitHub CI and Vercel Production deployment succeeded. Phase 2 is developed in tested local checkpoints. Do not push/deploy an incomplete Phase 2 checkpoint to the production-connected `main` branch.

## Checkpoint 1: moderation navigation and bounded reads

- `/moderation` is a compact overview of waiting reports, suspended accounts and five recent audit entries. Empty reports use one short line, not a large empty card.
- `/moderation/reports` supports status/type/search/order filters and 50-row keyset pages. Current hidden content remains available only to authorized staff through the existing moderation trust boundary. Deleted targets have an unavailable placeholder. Polls and quotes remain post reports; replies remain comment reports.
- `/moderation/suspended` supports public-name search and explicit authorized unsuspension; no timed suspension is added.
- `/moderation/audit` shows the action, current actor public name, target UUID, note and exact/relative Dhaka timestamp with filters and bounded pages. Historical null actors remain usable. Hidden/removed-content history is available through action search (`hide` / `remove`) and report status filters.
- `/moderation/team` reuses existing admin-only team management. `/admin` remains compatible. Current roles are visible; assignment remains user/moderator only. Creating/demoting admins or changing one's own role remains an owner-only operation under existing SQL protections.
- Settings adds a staff-only “আড্ডা সামলাই” link. Mobile bottom navigation is unchanged.

`20261006000100_staff_console.sql` adds a staff-only read RPC, a history index and a partial suspended-account index. It changes no existing command, account, public-profile projection, RLS policy or table grant. Dashboard counts cap at 1,000; previews have five entries; list reads have 50 rows plus one continuation sentinel. Timestamp/UUID keyset cursors preserve order without offset pagination. Search is literal and bounded to 60 characters. Staff receive current public target/actor context and existing report notes, never private account/Auth fields or poll voters. User/demoted/suspended callers are denied by live SQL role checks as well as route guards.

## Remaining checkpoints

1. Add complete forward-only dynamic-content infrastructure and direct RPC/RLS tests before committing it. Use admin-only `command` actions, rate receipts, live authorization after locking and immutable audit writes. Revoke helper/direct writes. Preserve legacy commands by delegating to a private, revoked implementation; no social API allowlist expansion.
2. Add consistent admin content subpages: questions, prompts, moods, featured topics and announcements. Each supports only applicable CRUD/status/order/pin/schedule controls with existing form feedback.
3. Integrate one request-scoped community read with Home/compose/topics. Dhaka daily rotation is stable; today's pin expires at Dhaka midnight. Moods remain historical post-text snapshots when disabled/removed. Featured topics augment organic topics without duplicate reads. One scheduled highest-priority announcement occupies the center column above question/composer and leaves no placeholder when absent; dismissals write only public revision preferences locally.
4. Complete responsive/axe/full regression, performance/query and role/security review, then perform a compatible schema-first production release and scoped live verification. No production role/bootstrap/secret/seed/reset operation is needed.

Unrelated startup-audit changes in `VALIDATION.md`, `tests/pwa.test.ts` and `tests/e2e/startup.spec.ts` are preserved separately. Keep them out of Phase 2 commits. The original Android startup report remains unconfirmed; Phase 2 does not alter PWA or Auth/session behavior.
