# Audit fixes — 1 October 2026

This records the local implementation following [the original audit](audit-2026-10-01.md). The original findings and security score describe the earlier code. These changes were deployed to **`dressmanager-540ba` on 2 October 2026** from commit `00a8ca6`.

## Kit sharing

Products may appear in several kit definitions. A physical item may satisfy any compatible kit request. Kits specify required products; they do not permanently own or reserve garments.

Different users may have pending requests for the same available item. The first valid approval changes its holder and closes competing requests. Later approvals cannot take it from that holder. An incomplete kit creates no partial requests. Unisex items can fulfill male/female requirements when their product and size match.

## Completed fixes

| Original finding | Resolution |
| --- | --- |
| A01 — Forged transfer offers | Transfer creation uses a callable with authoritative item, holder, tenant and recipient checks. Direct transfer document writes are denied. |
| A02 — Authority across groups/tenants | Catalog, transfers, member administration and image uploads validate the actual subscription and resource group. Subscription owners retain authority within their subscription. |
| A03 — Broken regular-user inbox | Queries include subscription scope. Pending, outgoing and historical requests are visible to their participants or authorized administrators. |
| A04 — Foreign kit requests | Kit, product, category and selected item relationships are checked against the caller's subscription and group membership. |
| A05 — Stale, replayed or mismatched transfers | Approval is transactional; it verifies request state, item ID, saved holder and holder version, derives the recipient, appends history, and closes competing requests atomically. |
| A06 — Overlapping kit requests | Shared kit requirements and competing pending requests are intentional. A05 prevents a second approval from overwriting the first. |
| A07 — Onboarding races | Registration and joining transactionally enforce membership in one subscription; concurrent operations cannot combine roles from different tenants. |
| A08 — Invalid/foreign role assignment | Allowed role values and the target's tenant are checked. Only the subscription owner or that group's superadmin can assign roles. |
| A09 — Administrative lockout | Concurrent role removals preserve a group superadmin. Subscription owner authority is independent of their role map; other members cannot demote the owner. |
| A10 — Unisex selection | Fulfillment queries include the requester's gender and unisex items. |
| A11 — Comment impersonation | Comment author identity and display data come from the authenticated caller's saved profile; parent item scope and bounded text are checked. |
| A12 — Group reassignment | Group subscription is immutable. Updates accept only the supported metadata fields. |
| A13 — Stale auth listeners | Profile/subscription listeners are cleaned up on account changes and sign-out; generation checks discard old callbacks. |
| A14 — Missing validation/limits | Callables enforce field allowlists, types, references and bounded text/arrays. Storage restricts image MIME types and uploads to 5 MB. |

All web document mutations now use Cloud Functions; Firestore rules deny direct client writes, including for administrators. Reads remain subscription scoped as required by the product brief. Avatar files remain writable only by their owner. Catalog uploads use group-scoped paths and live group roles. `prepareImageUpload` derives and stores the subscription owner on the group so Storage authorization stays within its two-document lookup limit.

Additional web flows now include sign-out, group editing/deletion, member profile editing/removal, outgoing request history/cancellation, returning a held item to storage, and readable owner/holder/history actor names. Deletion rejects referenced catalog records and unsafe group/member removal. Avatar upload persists immediately, reports completion only after saving, and preserves other unsaved profile fields.

## Validation

- Backend TypeScript build and ESLint passed.
- Web TypeScript/production build and lint passed. Existing warnings remain for a large JavaScript bundle and the AuthContext Fast Refresh export convention.
- Both backend and web `npm audit` reports contain **0 known vulnerabilities** after dependency updates. This is a dependency advisory result, not a guarantee against application bugs.
- **45 emulator regression checks passed, 0 failed** using fake tenants/accounts in `demo-asset-mgr-audit`. Coverage includes direct-write denial, tenant/group authorization, transfer forgery/replay, holder round trips, simultaneous role removals, onboarding races, kit overlap/unisex/atomic failure, profiles/comments, group/member flows and Storage authorization/type/size limits.
- Browser validation uses local Auth, Firestore, Storage and Functions emulators and the actual HTTP callable path. It checks avatar upload, profile re-entry, reload and preservation of other unsaved profile fields.

Reproduce the regression checks from the repository root (Node.js 24+, Java 21+ for the emulators):

```sh
npm --prefix functions ci
npm --prefix web ci
npm --prefix functions run build
npx -y firebase-tools@latest emulators:exec --project demo-asset-mgr-audit --config firebase.test.json --only auth,firestore,storage 'node scripts/audit-regression.cjs'
```

The regression script refuses to run without emulator endpoints and the demo project ID. It invokes callable handlers against an emulated database and uses real client SDKs for rules checks. It does not validate production deployment, Google login, NFC hardware, or production composite-index readiness.

## Deployment — 2 October 2026

- Commit `00a8ca6` pushed to `origin/main`.
- All 17 Node.js 24 Cloud Functions deployed in `europe-west1`.
- Firestore and Storage rules released, and the kit lookup composite index is `READY`.
- Hosting released at https://dressmanager-540ba.web.app; its HTML serves the current production bundle.
- The live profile callable rejects unauthenticated requests. No production user records were changed for this check.

The checks above confirm rollout status, not a full authenticated production acceptance test.

## Rollout and existing data

Deploy functions, rules, indexes and the rebuilt web app together, as described in [installation](installation.md). The old web app uses direct writes and is incompatible with the new Firestore rules. Wait for required indexes to finish building before kit fulfillment is used.

Existing pending transfers lack the new trusted request schema/holder version. They cannot be approved; cancel them and recreate requests. Subscription owners can cancel legacy requests even when their old group information is absent.

Legacy catalog records without `groupId` can be repaired by the subscription owner through the edit forms. Assign categories first, then their products, items and kits to the same group. Legacy image URLs remain readable; new product/item uploads require the scoped path. User avatars retain their existing path.

Node.js 24 is required by the updated backend dependencies. The mobile NFC application remains the planned Phase 6 implementation in `todo.md`; this remediation does not deliver that phase. Large installations may need pagination and smaller administrative batches; current limits are documented in `CLAUDE.md`.

## Onboarding and site administration deployment — 7 October 2026

The live site was still serving an older bundle that sent signed-in accounts
without membership to organization setup. Deployed the validated current web
build and eight coordinated callables: `registerSubscription`, `joinSubscription`,
`getMySubscriptionRequest`, `listSubscriptionRequests`, `reviewSubscriptionRequest`,
`listSiteSubscriptions`, `getSiteSubscription`, and `updateSiteSubscription`.

Default sign-in now leads accounts without subscription membership to the
invitation-required message, without a registration option. Explicit `/register`
submissions require a description and site-administrator approval before tenant
creation. Site administrators review requests in `/site-admin`.

Validation: web/backend builds and lint passed (existing web bundle-size and
Fast Refresh warnings remain); prior emulator regression covered 64 cases, and
16 browser fixture checks covered desktop/mobile application and review flows.
The production `getMySubscriptionRequest`, `listSubscriptionRequests` and
`listSiteSubscriptions` endpoints reject unauthenticated requests with HTTP 401.
Verified both `www.atver.lv` and the Firebase Hosting domain serve the new bundle
with the invitation route/message, approval callables, and no old setup screen.
These release checks do not simulate a fresh production Google sign-in.

## Browser cache correction — 7 October 2026

The deployed HTML was using Firebase Hosting's default `Cache-Control:
max-age=3600`. A browser could reopen an older HTML document and its older app
bundle, whose sign-in flow still navigated to registration. Refreshing loaded
the corrected flow.

Hosting now sends `Cache-Control: no-store` for app pages and rewrites, including
`/`, `/login`, `/register`, and `/join/...`. Vite's hashed `/assets/**` files use
`public, max-age=31536000, immutable`; their filenames change when content changes.
Header rules match the requested URL before SPA rewrites, so the policy covers
all routes. Existing tabs already executing an older bundle require one refresh;
response headers cannot replace JavaScript already loaded in a browser.
