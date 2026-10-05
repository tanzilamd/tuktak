# Mobile/tablet PWA targeting and latency audit

Audit: 5 October 2026, Asia/Dhaka. Baseline production SHA: `c1949e77e9788c938a3ce356a6f33b380aba6d10`.

## Scope and PWA behavior

The existing card, Bengali copy, manifest, icons, font, worker, offline fallback, update strategy and preference format remain unchanged. No CSS or social feature was added. Home remains composer → install card → tabs → feed on supported phones/tablets; desktop renders composer → tabs → feed with no placeholder.

Android uses layered UA, navigator platform and optional UA Client Hints signals. `mobile: false` does not exclude Android tablets. A real `beforeinstallprompt` provides capability separately; only a click opens it. iPhone/iPad Safari retains concise Share → Add to Home Screen guidance, including iPadOS presenting `MacIntel` with multiple touch points. Touch alone and viewport width are never device classifiers. Other mobile browsers can use a real native opportunity; unsupported browsers/in-app iOS browsers get no misleading action. Ordinary Windows/macOS/Linux desktops retain their browser-level install control because Tuktak leaves their install events uncancelled.

Standalone/completed installs hide immediately. Dismissal and native-prompt choice retain the existing 30-day suppression; blocked storage remains session-local. No new polling, persistent account data or automatic prompt was introduced. Browser identity can be spoofed/reduced and browsers cannot reliably report an uninstall; clearing site preferences remains the existing recovery. No physical Android/iOS installation was performed: device/event tests are simulations in real Chromium, separate from physical-device validation.

The unchanged worker caches only generic offline HTML and its Bengali font using credential-free precaching. App HTML/RSC, JavaScript, feeds, private data, Auth/session, API and mutations are not cached. Auth utilities/private routes bypass interception. Immediate activation remains safe under that offline-only policy; no reload loop or write replay was added.

## Measurement method and limits

Production was measured through this managed cloud environment's TLS-verified outbound proxy, whose Vercel edge responses identify Cleveland (`cle1`). This is **not a Bangladesh access-network benchmark**. Baseline function responses identify Northern Virginia (`iad1`); Supabase Management API confirms `ap-south-1` (Mumbai), `ACTIVE_HEALTHY`.

Browser samples use a production build on the canonical HTTPS origin, a 360px Chromium viewport and a designated account. Three repeated full-document reads per flow measure navigation start until the relevant feed/composer/heading is visible, plus browser Navigation Timing TTFB. Request counts include browser cache hits, static assets and automatic Next.js prefetch starting within that measurement window; they are not DB round-trip counts or all unique wire transfers. Slowest completed requests are recorded separately. Feed API and social-write measurements await parsed canonical responses. Small samples are directional observations, not a load test, percentile SLA or isolated causal experiment. Hydration/rendering and server/upstream time cannot be independently isolated without a trace; do not subtract unrelated probes and present the result as DB/network time.

Existing production data was protected with a private baseline before writes. Only uniquely labelled owned posts, self-reactions and owned replies were created, then removed using normal caller-session commands. Profile/private/notification fingerprints were checked afterwards. Rate/audit receipts intentionally remain. The second configured QA identity has no current public profile; it was not repaired. Follow/unfollow, notification single/all-read and profile/status writes were measured against the real **disposable local stack and production build**, avoiding existing production relationship/read/profile changes. These local times cannot predict hosted network latency.

## Baseline findings

- Authenticated document latency and social response times are much larger than measured SQL execution. Supabase and the Vercel function were separated by a US–Mumbai path; sequential authorized Auth/DB round trips amplify that path. Browser/proxy, cold/warm runtime and network variation remain mixed into totals.
- Database snapshot: about 12.5 MB, 10 open connections against maximum 60, one executing connection at sampling. Cumulative buffer hits 6,338,218 versus 1,615 reads (not a current RAM/CPU metric). Representative statement means: profile reads about 0.7–0.8 ms, feed-related reads about 1.6–7 ms, `post_stats` about 5.3–6.1 ms, `popular_topics` about 1.6–2.1 ms; historical command means about 10 ms. These are cumulative `pg_stat_statements` aggregates, **not per-browser-request DB time**. Slow schema/introspection statements also exist; they do not establish a slow feed query. No evidence justified an index, migration or compute upgrade.
- Caller-role `EXPLAIN ANALYZE` SELECT probes ran inside explicit read-only, rolled-back transactions: bounded feed-ID scan used `posts_feed` (9 rows, 11.801 ms execution, 0.787 ms planning); bounded unread scan used `notifications_unread` (0 rows, 0.098 ms execution, 1.077 ms planning). The feed probe omits the author projection and stats RPC, so it is not the full feed execution time. Existing indexes were effective; no index or migration was needed.
- Discover and the right rail called the same `popular_topics` RPC independently. `topics()` now uses existing request-scoped React `cache`, eliminating that duplicate within one server render. This cache is neither global nor persistent and uses the caller's session/RLS.
- Existing independent profile/count/list reads are already parallel; metadata/page post/profile reads already share request-scoped caches. Post rows → stats and following IDs → filtered feed are dependent steps. No N+1 notification query was found. Unread count remains recipient-scoped and bounded at 100.
- Feed tabs already use local history, coalesced prefetch and the five-second mounted/session cache. Warm switches issued zero requests in baseline observations. Core optimistic social writes already use canonical API responses and avoid a full `router.refresh`. The authenticated proxy/viewer `getUser` checks were preserved rather than weakening authorization to save a round trip.
- Server Action profile/notification changes retain authoritative revalidation. No unsafe removal of refresh/revalidation, public authenticated caching or new logging was used.

## Changes and comparison

1. Gate in-product install promotion to mobile/tablet platform signals before cancelling any native install event.
2. Request-scoped topics deduplication.
3. `vercel.json` pins the existing function to Mumbai (`bom1`), colocated with Supabase. This is a single-region deployment configuration, not an infrastructure purchase. Deprecated Next.js `preferredRegion` exports were not used.

The hosted before/after results and deployment evidence follow below. Region and request-cache effects are deployed together; the comparison cannot assign a precise portion of improvement to each change.

## Lightweight monitoring baseline

Use existing provider dashboards and logs; no paid monitoring service or application telemetry was added.

| Surface     | Daily launch check                                                                                                                                | When to investigate                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase    | CPU/RAM graphs, active connections vs limit, DB size, slow-query execution/plans, DB errors, Auth errors/rate limits and usage                    | Sustained pressure, rising execution time, connection exhaustion, unexpected Auth/DB errors or quota approaching; distinguish query/index problems from compute/network |
| Vercel      | Latest Production SHA/status, runtime errors, visible request/function duration and cold/warm variation, bandwidth/usage, failed deployments      | Error spikes, sustained slow functions or usage limits; verify the function region before paying for compute                                                            |
| Brevo       | Daily transactional-mail usage, failed/bounced deliveries, SMTP authentication and Auth email delivery health                                     | Delivery failures or quota risk; use an owned mailbox when a confirmation/recovery probe is required                                                                    |
| Application | HTTPS `/api/health` → 200/ok; existing operator/provider evidence for signup/login/recovery and major errors; affected flow after each deployment | Non-200 health, repeated failed journeys or runtime errors; do not log passwords, phone, session/cookies or recovery links                                              |

Record a small same-method weekly latency sample and a Bangladesh phone/network sample after launch. Keep private traces/baselines ignored. Dashboard CPU/RAM, cold-start breakdown, provider quota consumption and actual Bangladesh RTT were unavailable in this task and are not inferred from the small DB snapshot.

## Infrastructure decision

Answer to **“Would paying for Supabase or Vercel materially improve the current user-visible latency?”**: current evidence does not establish a paid compute/usage bottleneck. Query/network placement improvements come first. Paying alone does not relocate a function or remove repeated round trips. Reconsider only with sustained CPU/RAM/connections/quotas, slow execution or measured runtime pressure. A quiet, small dataset is not evidence of future load capacity.

## Measured baseline table

Times are milliseconds; medians of three samples unless noted. DB time is not isolated per flow. Document slowest-request medians describe completed requests, while counts describe requests initiated before useful content.

| Flow                             | Useful/confirmed median | Slowest request                                       | Browser request count               | DB time / main contributor                                    | Evidence                                     |
| -------------------------------- | ----------------------: | ----------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| Home guest                       |                     962 | document ~894                                         | 22–40 incl. assets/prefetch         | Not isolated; server/upstream/network dominate observed waits | 3 live samples; median TTFB 865              |
| Home signed in                   |                    2739 | document ~2693                                        | 26–41 incl. assets/prefetch         | Not isolated; server/upstream/network dominate observed waits | 3 live samples; median TTFB 2669             |
| Notifications                    |                    1770 | document ~1738                                        | 34–40 incl. assets/prefetch         | Not isolated; server/upstream/network dominate observed waits | 3 live samples; median TTFB 1720             |
| Profile                          |                    2549 | document ~1968                                        | 35–42 incl. assets/prefetch         | Not isolated; server/upstream/network dominate observed waits | 3 live samples; median TTFB 1731             |
| Discover                         |                    1729 | document ~1665                                        | 33–41 incl. assets/prefetch         | Not isolated; server/upstream/network dominate observed waits | 3 live samples; median TTFB 1365             |
| Search                           |                    2142 | document ~1781                                        | 32–42 incl. assets/prefetch         | Not isolated; server/upstream/network dominate observed waits | 3 live samples; median TTFB 1348             |
| Hashtag                          |                    1785 | document ~1759                                        | 26–37 incl. assets/prefetch         | Not isolated; server/upstream/network dominate observed waits | 3 live samples; median TTFB 1744             |
| Discussion                       |                    1842 | document ~1810                                        | 30–42 incl. assets/prefetch         | Not isolated; server/upstream/network dominate observed waits | 3 live samples; median TTFB 1467             |
| Feed API all                     |                    2123 | API ~2123                                             | 1 explicit API call                 | Not isolated; server/upstream/network dominate observed waits | 3 live canonical JSON samples                |
| Feed API following               |                    1564 | API ~1564                                             | 1 explicit API call                 | Not isolated; server/upstream/network dominate observed waits | 3 live canonical JSON samples                |
| Feed tab following observation 1 |                    1832 | API 1596                                              | 5                                   | First uncached selection vs mounted-cache reuse               | Live UI + request events                     |
| Feed tab all observation 2       |                     801 | no request                                            | 0                                   | First uncached selection vs mounted-cache reuse               | Live UI + request events                     |
| Feed tab following observation 3 |                      37 | no request                                            | 0                                   | First uncached selection vs mounted-cache reuse               | Live UI + request events                     |
| Feed tab all observation 4       |                      63 | no request                                            | 0                                   | First uncached selection vs mounted-cache reuse               | Live UI + request events                     |
| Create post                      |                    1098 | social API ~1098                                      | 1 explicit mutation                 | Not isolated; server/upstream/network                         | 3 live owned-fixture samples, confirmed JSON |
| Reaction add                     |                     835 | social API ~835                                       | 1 explicit mutation                 | Not isolated; server/upstream/network                         | 3 live owned-fixture samples, confirmed JSON |
| Reaction switch                  |                     917 | social API ~917                                       | 1 explicit mutation                 | Not isolated; server/upstream/network                         | 3 live owned-fixture samples, confirmed JSON |
| Reaction remove                  |                     893 | social API ~893                                       | 1 explicit mutation                 | Not isolated; server/upstream/network                         | 3 live owned-fixture samples, confirmed JSON |
| Reply                            |                     875 | social API ~875                                       | 1 explicit mutation                 | Not isolated; server/upstream/network                         | 3 live owned-fixture samples, confirmed JSON |
| Delete own reply                 |                     913 | social API ~913                                       | 1 explicit mutation                 | Not isolated; server/upstream/network                         | 3 live owned-fixture samples, confirmed JSON |
| Delete own post                  |                     611 | social API ~611                                       | 1 explicit mutation                 | Not isolated; server/upstream/network                         | 3 live owned-fixture samples, confirmed JSON |
| Notification read (local)        |                     264 | POST headers + confirmed UI (stream end not isolated) | 1 mutation; 9–12 including prefetch | Local server/loopback; not production network                 | 3 local real-stack samples                   |
| Mark all read (local)            |                     293 | POST headers + confirmed UI (stream end not isolated) | 1 mutation; 9–13 including prefetch | Local server/loopback; not production network                 | 3 local real-stack samples                   |
| Profile/status update (local)    |                     365 | POST headers + confirmed UI (stream end not isolated) | 1 mutation; 5–9 including prefetch  | Local server/loopback; not production network                 | 3 local real-stack samples                   |
| Follow (local)                   |                     252 | POST headers + confirmed UI (stream end not isolated) | 1 mutation; 1–10 including prefetch | Local server/loopback; not production network                 | 3 local real-stack samples                   |
| Unfollow (local)                 |                     254 | POST headers + confirmed UI (stream end not isolated) | 1 mutation; 1–13 including prefetch | Local server/loopback; not production network                 | 3 local real-stack samples                   |

Separate five-sample TLS-verified probes: generic static offline document median **314 ms**; `/api/health` (one bounded DB read) median **603 ms**, range **537–1,035 ms**. Different endpoint/protocol conditions mean their difference is not a precise DB network measurement.

For mutations, optimistic UI is already immediate in regression tests; canonical response time above is the server-confirmation wait, not a claim that the UI waits that long to show a draft/reaction. Notification/profile Server Action streams can remain open after useful content, so local timings use response headers plus confirmed controls instead of assuming stream completion equals perceived latency.

## Hosted comparison and deployment evidence

Implementation commit `97223174429257e7a918c7e641b0e7e65d6644e9` was pushed to `main`. Vercel commit status and Production deployment `6847379492` report success. Canonical `/api/health` returns 200/ok and headers changed from `cle1::iad1` to **`cle1::bom1`**. No paid plan or provider purchase was made.

The following are same-method observed medians, not guaranteed improvements for every user. Three browser read samples were repeated after deployment; the first deployed-write series ran near other read/PWA verification, so a second three-sample series was collected. All six after-write observations are retained below rather than selecting only the fastest series. Physical Bangladesh/network latency remains unmeasured.

| Flow               | Before ms | After ms | Change | After slowest request / count          | Confidence                                         |
| ------------------ | --------: | -------: | -----: | -------------------------------------- | -------------------------------------------------- |
| Home guest         |       962 |     1523 | +58.3% | document ~1334; 22–37 browser requests | 3 samples; TTFB 865 → 1074; proxy path only        |
| Home signed in     |      2739 |     1702 | -37.9% | document ~1556; 26–33 browser requests | 3 samples; TTFB 2669 → 1348; proxy path only       |
| Notifications      |      1770 |      923 | -47.9% | document ~895; 27–29 browser requests  | 3 samples; TTFB 1720 → 872; proxy path only        |
| Profile            |      2549 |     1086 | -57.4% | document ~1055; 25–28 browser requests | 3 samples; TTFB 1731 → 895; proxy path only        |
| Discover           |      1729 |     1870 |  +8.2% | document ~1254; 28–32 browser requests | 3 samples; TTFB 1365 → 1043; proxy path only       |
| Search             |      2142 |     1637 | -23.6% | document ~1056; 27–31 browser requests | 3 samples; TTFB 1348 → 849; proxy path only        |
| Hashtag            |      1785 |      921 | -48.4% | document ~892; 25–32 browser requests  | 3 samples; TTFB 1744 → 874; proxy path only        |
| Discussion         |      1842 |     1096 | -40.5% | document ~1078; 24–32 browser requests | 3 samples; TTFB 1467 → 949; proxy path only        |
| Feed API all       |      2123 |      724 | -65.9% | 1 explicit API call; private/no-store  | 3 canonical JSON samples; proxy path only          |
| Feed API following |      1564 |      862 | -44.9% | 1 explicit API call; private/no-store  | 3 canonical JSON samples; proxy path only          |
| Create post        |      1098 |     1016 |  -7.5% | social API; 1 explicit mutation        | 3 before / 6 after; owned fixtures, canonical JSON |
| Reaction add       |       835 |     1190 | +42.5% | social API; 1 explicit mutation        | 3 before / 6 after; owned fixtures, canonical JSON |
| Reaction switch    |       917 |     1222 | +33.3% | social API; 1 explicit mutation        | 3 before / 6 after; owned fixtures, canonical JSON |
| Reaction remove    |       893 |     1018 | +14.0% | social API; 1 explicit mutation        | 3 before / 6 after; owned fixtures, canonical JSON |
| Reply              |       875 |      844 |  -3.5% | social API; 1 explicit mutation        | 3 before / 6 after; owned fixtures, canonical JSON |
| Delete own reply   |       913 |     1162 | +27.3% | social API; 1 explicit mutation        | 3 before / 6 after; owned fixtures, canonical JSON |
| Delete own post    |       611 |      960 | +57.1% | social API; 1 explicit mutation        | 3 before / 6 after; owned fixtures, canonical JSON |

Authenticated Home, Profile, Notifications, hashtag/discussion and both feed API reads improved in this sample. **Guest Home, Discover useful-content time, and several write confirmations did not improve.** Discover TTFB improved even though useful-content median increased, illustrating client/streaming/network variability. Do not describe this as a universal speed-up. Mumbai is retained for the measured multi-round-trip read benefit and database colocation, with the explicit tradeoff that the cloud proxy is farther from the function. A Bangladesh phone/network read-and-write sample is the next check before further latency changes or any paid-infrastructure recommendation.

After-tab observations: following selection 34 ms with three request starts (including prefetch), then warm following 30 ms / zero requests; all selections 58 and 63 ms / zero requests. Prefetch may complete before selection, so this is not a guarantee of a 34 ms uncached fetch. Same five-sample health protocol: median **603 → 514 ms**, range after **361–531 ms**; generic static document **314 → 263 ms**, showing that ambient network conditions also varied. A first post-deployment health request took about 1.9 seconds upstream; cold-start execution cannot be separated from that request using the available evidence.

Live checks passed: manifest/canonical URLs/icons/worker headers and Chromium native installability criteria (no errors), actual worker offline font/fallback/reconnect, safe cache contents/exclusions, designated login and Auth utility routes, simulated Android phone/tablet/client-hints/iPhone/iPad/desktop/standalone behavior, successful-install/dismiss persistence and eight width/theme install-card axe checks. Headless Chromium emitted **zero real install opportunities**; native OS install/standalone launch is not claimed. No existing production profile/private/read/follow state changed; before/after fingerprints match and temporary owned social fixtures were cleaned.

## Recommendation and remaining checks

**Infrastructure recommendation: No paid upgrade needed for the presently measured problem.** The measured indexed SQL times, small DB/connection snapshot, substantial feed-read gains from a configuration change, and mixed remote write/network results do not justify paying for Supabase compute, Vercel runtime or both. Neither provider has a demonstrated current CPU/RAM/connection/usage bottleneck in this audit. This is a bounded recommendation, not a future capacity guarantee. Paid plans would require new evidence of sustained pressure/limits; they do not automatically solve client distance or sequential application work.

Remaining post-launch work: physical Android/iPhone/iPad install checks, Bangladesh mobile-network samples for reads and writes, slow/fast-device hydration traces if guest/Discover delay persists, and a routine dashboard/usage/backup/mail-health review. Do not add Redis, broad caching or paid monitoring to resolve an unmeasured bottleneck.

## Controlled engagement follow-up — 5 October 2026

This section describes the six-feature engagement build; earlier sections record the prior targeting/latency audit. The engagement changes retain request-scoped topic/post/profile deduplication, chronological cursors, Mumbai deployment settings and the mounted-session feed cache. PWA worker/provider/install resources remain unchanged. No paid service, new dependency, global authenticated cache or social polling is added.

`post_stats` now includes visible mentions, a root quote preview and anonymous poll aggregates in its existing bounded request. Plain posts take an indexed poll-presence lookup; quote originals use primary-key visibility checks. Counts use the poll/option index, not downloaded voter rows. Selected votes use the `(post_id,user_id)` key. New parent/reference/receipt indexes support thread selection, root cascades and content deletion. There is no per-card network fetch or recursive quote/comment query. New mention/embedded-original links disable speculative prefetch, so they do not add background profile/discussion reads for each preview. A seventh forward migration subsequently aligned URL-adjacent Unicode mention boundaries; the measured plain-post path has no mentions, so that parser correction does not add work there. A discussion selects 100 recent/focused comments plus missing roots (at most 200). Mention notification fan-out is at most five distinct names; inbox entry captures/updates at most 100 visible IDs. Poll expiry coalesces mounted cards into one-shot batches of at most 20 IDs, not periodic network reads.

Controlled query comparison used fresh PGlite PostgreSQL instances with the five-migration baseline versus the six-migration engagement chain, identical two-account fixtures, 100 plain posts, 1,000 comments and 100 reactions. Ten timed warm reads followed two warm-ups. Times include the local WASM/query/result boundary and are **not hosted Supabase execution/network estimates**:

| Read                            | Before median | After median | Observation                                             |
| ------------------------------- | ------------: | -----------: | ------------------------------------------------------- |
| Stats for 20 plain posts        |       8.97 ms |      9.81 ms | About 0.84 ms additional local work                     |
| Stats for 10 polls + 10 quotes  |           N/A |     10.72 ms | Four options/poll; one vote/poll; bounded root previews |
| One discussion with 10 comments |           N/A |      2.21 ms | One bounded RPC                                         |

Local production-build Chromium Home samples (five repeated authenticated document navigations, useful composer/first card visible) had medians 536 ms before and 456 ms after, ranges 305–626 ms and 361–1,146 ms. Each window recorded one completed document/social-API response; static assets and requests completing after the window are excluded. These small loopback samples use changing fictional fixtures and mixed browser/server work, **so they do not establish a speed improvement or production percentile**. The controlled SQL comparison and unchanged request graph provide stronger evidence that normal-post reads do not incur a material new hot-path cost at this fixture size. No unrelated optimization was justified.

Browser tests verify native tab/history behavior, serialized writes, optimistic rollback/canonical recovery, concurrent private votes, atomic inbox snapshot scope, and a single coalesced expiry read that picks up late final votes. Final checks and deployment status are in VALIDATION. Hosted-scale popular-poll aggregation, actual Bangladesh mobile-data latency and real installed-device interactions still need operator observation through the existing monitoring baseline; no premium recommendation follows from these local samples.

## UI polish and public admin identity — 5 October 2026

The Home mobile topic strip is server-rendered and reuses the existing request-scoped `topics()` cache with the right rail. Temporary, ignored local fetch instrumentation measured one `popular_topics` RPC for a direct Home document. No client topic request, polling, carousel dependency or global cache is introduced. Hidden desktop/empty topic output leaves no spacing gap.

The admin badge does not add per-card role requests: feed/detail use their existing bounded `post_stats` call, and discussion/quote/inbox actor projections join the role primary key in their existing profile read. Public profile/discovery/follow-list results add one `public_admin_ids` batch per result (at most 200 requested IDs), not one call per person. The public-profile lookup remains request-scoped and shared by metadata/page; this additional round trip is an explicit cost. The private role table is neither publicly queried nor serialized. No indexes, mutation paths, feed cursors, mounted feed caches, PWA caches or Mumbai deployment settings change.

Five read-only hosted `EXPLAIN ANALYZE` samples of stats for 20 existing posts had medians **41.423 ms before → 35.213 ms after** (ranges 39.160–60.665 ms and 33.478–38.679 ms). This owner-context SQL timing excludes network/rendering and is not an authenticated workload or a load test. The small sample does not establish a speed improvement; it provides no evidence of a material cost in this bounded read. The SQL samples select the then-current newest posts, not a controlled fixed workload. Five guest complete-document requests through the managed cloud proxy had medians **Home 899.0 → 653.8 ms** and **public profile 1,107.2 → 707.5 ms**, with after ranges 581.1–819.6 ms and 613.9–1,194.6 ms. Network, server streaming, warmed routes and changing public traffic are mixed; the sample does not establish a UI speed gain or a production percentile. There is no evidence here of a material hot-path regression, and no unrelated optimization or infrastructure change was made. Physical Bangladesh mobile-data latency remains outside this cloud-run validation.
