# TODO — Dress Asset Management

Build plan. Phases are roughly sequential; check items off as you go.
See [CLAUDE.md](CLAUDE.md) for the canonical architecture and data model, and
[ARCHITECTURE.md](ARCHITECTURE.md) for the current file layout.

## Phase 0 — Project setup
- [x] Create Firebase project (`dressmanager-540ba`) — Firestore, Functions,
      Storage, Hosting configured; web app registered
- [x] Enable Google Sign-in provider — confirmed enabled
- [x] Provision Storage bucket — the console's free-tier "Get started" flow
      auto-provisions a fixed `us-east1` bucket with no EU option. Fixed
      properly (not just worked around) by calling the Firebase Storage API's
      `defaultBucket:create` directly with `location: europe-west1` — the
      same call the console button makes — which created the project's real
      default bucket `dressmanager-540ba.firebasestorage.app` in
      `EUROPE-WEST1`. (Billing/Blaze was already enabled on the project, so
      no plan upgrade was actually needed.) An earlier workaround bucket
      created via manual `addFirebase` linking was deleted once this proper
      fix was in place — `web/src/lib/firebase.ts` uses plain `getStorage(app)`.
- [x] Init repo structure: `web/`, `mobile/`, `functions/`, `firestore.rules`,
      `storage.rules`, `firestore.indexes.json`, `firebase.json`
- [x] Configure Firebase emulator suite for local dev (auth/firestore/storage/
      functions/hosting + UI) — verified boots cleanly, including after the
      `storage.bucket` config change
- [x] Set up `.env` / config handling for web (`web/.env`, `web/.env.example`,
      `VITE_USE_EMULATORS` flag); mobile config deferred to Phase 6

## Phase 1 — Auth & tenancy
- [x] Web: Google login page + auth state / protected routes
- [x] Subscription registration flow (first login → create Subscription as owner)
- [x] Create `users` doc on first login with `subscriptionId` + default role
- [x] Group creation (sub-owner creates one or more groups) — done as part of
      `RegisterPage` (creates Subscription + first Group + owner user doc in
      one batch); a dedicated "add another group" flow doesn't exist yet
- [x] Member invite flow + role assignment (per-group: superadmin/admin/user)
      — `MembersPage` lets an admin change a member's role per group; joining
      itself is now via **invite link** (`/join/{subscriptionId}`, shown with
      a copy button on the Dashboard for admins → `JoinPage` → `joinSubscription`
      Cloud Function adds the visitor as `'user'` in every group of that
      subscription), so members no longer need to be manually added first —
      they just need to have signed in once via the link
- [x] Cloud Function: role assignment/revocation (superadmin-only, per group)
      — `assignRole`
- [x] Fixed a real bug: `RegisterPage` originally wrote the Subscription/Group/
      user docs directly from the client, but `firestore.rules` correctly
      blocks that (`subscriptions: allow write: if false`, and `groups` write
      requires already being superadmin of the group you're trying to
      create — impossible on first creation). Added the `registerSubscription`
      Cloud Function (Admin SDK, bypasses rules) to do this atomically instead;
      `RegisterPage` now just calls it.
- [x] Fixed a real security gap while adding the invite link: the `users`
      collection's `create` rule let any authenticated user self-write their
      own profile doc with **any** `subscriptionId`/`groups` value, bypassing
      Cloud Functions entirely — anyone could self-grant `superadmin` in any
      group just by knowing its ID. Tightened `create` (to match `update`,
      which already blocked this) to reject `subscriptionId`/`groups` on
      direct client writes; both join paths already go through Cloud
      Functions (Admin SDK bypasses rules), so nothing legitimate changes.

## Phase 2 — Catalog management (web)
- [x] Categories CRUD (e.g. dress, shoes, trousers, shirt, boots) — originally
      named "Classes"/`classes`, renamed to Categories/`categories` (dev-only,
      no backward compatibility needed)
- [x] Products CRUD (variant + gender + **image upload** to Cloud Storage) —
      originally named "Types"/`types`, renamed to Products/`products`
- [x] Items CRUD (product, size, gender, condition, **image**, **rfidTag**,
      owner, holder) — holder defaults to sentinel `"storage"` on creation
- [x] Kits CRUD (name, gender, size, required `productIds`, description) —
      went through two renames: originally `classIds` (wrong level - a kit
      needs a specific "Red Dress", not just any "Dress"), corrected to
      `typeIds` referencing the Type/Product entity, then renamed again to
      `productIds` when Type→Product; also simplified `requestKit` by
      removing the now-unneeded category→product resolution step
- [x] Image upload/preview component (reused for products, items, avatars)
- [x] Fixed a real bug: "Add Product" (and equally Items/Profile avatar) failed
      with a generic "Operation failed" whenever no image was uploaded. Cause:
      the Firestore JS SDK throws client-side on any field with value
      `undefined` (e.g. `imageUrl` before `ImageUpload`'s `onChange` ever
      fires), and the SDK doesn't do this by default. Fixed at the root by
      switching `web/src/lib/firebase.ts` from `getFirestore(app)` to
      `initializeFirestore(app, { ignoreUndefinedProperties: true })`. Also
      made every CRUD page's generic catch surface the real error message
      instead of a static string, so this class of bug fails loudly next time.
- [x] Fixed a second real bug, found right after the first thanks to the
      better error surfacing: actual image *uploads* (not just missing ones)
      failed with `storage/unauthorized`, even for a confirmed `superadmin`
      user and correctly-deployed rules. Root cause: `storage.rules` calls
      `firestore.get()` (cross-service Security Rules) to check the caller's
      role - the Console's "Publish" button auto-grants the IAM role this
      needs to the Storage service account, but our CLI-only deploys never
      did. Fixed by granting `roles/firebaserules.firestoreServiceAgent` to
      `service-{PROJECT_NUMBER}@gcp-sa-firebasestorage.iam.gserviceaccount.com`
      directly via `gcloud projects add-iam-policy-binding`. Diagnosed by
      testing the rules logic itself against the emulator first (proved
      correct in both positive/negative cases) before looking at IAM, and
      folded the grant into `scripts/install.sh` + `docs/installation.md` so
      new deployments don't hit this.

## Phase 3 — Browsing & detail (web)
- [x] Dashboard: list all items, filter by category / product / search
      (client-side filtering over the subscription's items — fine at current scale)
- [x] Item detail view: all properties + current holder/owner
- [x] Detail Tab: Comments (list + add form, any user)
- [x] Detail Tab: Holder history (chronological, shows who initiated if admin)
- [ ] Composite Firestore indexes for the filter combinations — not yet
      needed since Dashboard filters client-side; revisit if/when filtering
      moves server-side (`where` queries on category/product/size together)

## Phase 4 — Requests & transfers
- [x] "Request kit" button → Cloud Function (`requestKit`) auto-picks
      available items by size/gender per required product; fails with
      `failed-precondition` if a product has none available
- [x] "Request item" flow (single item, from `ItemDetail`)
- [x] Request inbox: approve / decline (holder or admin) — approve calls
      `transferItem`, decline is a direct client update restricted by rules
- [x] Cloud Function: on approve → update `holderId`, append `holderHistory`,
      mark request `transferred` — `transferItem`
- [x] Admin direct transfer (change holder, auto-logged) — `ItemDetail` shows
      Holder as a dropdown (any subscription member, or "Storage") for
      admin/superadmin, calling `transferItem` with `transferType: 'admin'`
      and no `requestId`, same as before but now with a real UI entry point
- [x] Admin direct owner reassignment — `ItemDetail` also shows Owner as an
      admin-only dropdown; resolves the long-standing doc/code discrepancy
      where `ownerId` was documented but never implemented (see "Data model
      doc/code discrepancies" below - now resolved). Owner changes are a
      plain `updateDoc` (rules already allow it — only `holderId`/
      `subscriptionId` are blocked from direct client writes), not routed
      through a Cloud Function or logged to history, since owner isn't part
      of the audited checkout workflow the way holder is
- [x] User profile/settings: edit own size/gender + avatar upload

## Phase 5 — Security
- [x] Firestore security rules (per-subscription read; admin-only catalog
      writes; user-owned profile; comments/requests creatable by any authed
      user; privileged writes only via Cloud Functions) — imported, then
      fixed two real issues: (1) the `items` write rule used
      `resource.data.diff()` combined for create+update, which errors on
      create since no prior resource exists — split into separate
      create/update/delete rules; (2) the `requests` update rule restricted
      which *fields* could change but not their *values*, letting a
      requester set their own request to `status: 'approved'` directly,
      bypassing holder consent and the Cloud Function entirely — tightened to
      only allow `pending → declined` with just `status`/`declinedAt` touched
- [x] Storage security rules (authed read; scoped upload/delete) — imported
- [x] Verify rules against emulator — confirmed both rule files parse and the
      emulator suite boots cleanly; no scripted rules *unit tests* yet (e.g.
      `@firebase/rules-unit-testing`), just structural validation
- [x] Deploy rules to the live project — Firestore and Storage rules both
      deployed to `dressmanager-540ba`

## Phase 6 — Mobile NFC scanner
- [ ] React Native app scaffold (Expo dev build or bare) + Firebase + Google auth
- [ ] Integrate `react-native-nfc-manager` (iOS Core NFC entitlement + Android)
- [ ] Read tag → resolve `itemId` → fetch + show item
- [ ] Quick actions: identify / check-out / return / transfer (via Functions)
- [ ] Tag-writing utility (admin writes `itemId` to a new washable tag)
- [ ] Build & test on physical iOS + Android device (NFC needs real hardware)

  **Not started** — `mobile/App.tsx` is a draft reference carried over from
  the same earlier prototype the web app was imported from, not a scaffolded
  project. It has known issues (wrong `NfcManager` API call, looks up items by
  the tag's raw hardware UID instead of the `rfidTag` field or a written NDEF
  payload) — see [mobile/README.md](mobile/README.md) before using it as a
  starting point.

## Phase 7 — Polish & deploy
- [x] Deploy Firestore + Storage rules
- [x] Deploy Cloud Functions (`transferItem`, `requestKit`, `assignRole`) —
      live in `europe-west1` (colocated with Firestore `eur3` and Storage
      `europe-west1`, set via `setGlobalOptions({region: "europe-west1"})`;
      client SDK's `getFunctions(app, 'europe-west1')` must match). Along the
      way: removed the unused `firebase-functions-test` devDependency, whose
      `jest` peer dependency resolved inconsistently between local npm and
      Cloud Build's npm and was failing `npm ci` remotely with "out of sync"
      even though it was fine locally.
- [x] Deploy web to Firebase Hosting — live at https://dressmanager-540ba.web.app
- [ ] Distribute mobile builds (TestFlight / internal track)
- [ ] Seed/demo data script
- [ ] Basic end-to-end walkthrough of the full checkout → return loop

## Phase 8 — Platform Administration (reverted)
Built, then fully removed: a site-wide "Platform Admin" role
(`platformAdmins/{uid}` allowlist), a `plans` collection + `Subscription.planId`/
`status`, an `isPlatformAdmin()` bypass in `firestore.rules` and in
`transferItem`/`requestKit`/`assignRole`, "Manage as" impersonation in
`AuthContext`, and three UI pages (`PlatformAdminPage`, `PlansPage`,
`MetricsPage`). Reason: this became an **open-source, self-hosted** app —
each deployer already has full Console/`gcloud` access to their own Firebase
project, so a separate in-app operator role/impersonation layer added
complexity without adding capability. See [docs/installation.md](docs/installation.md)
for the self-hosting model. `scripts/install.sh` was written for this simpler
world — no "bootstrap the first Platform Admin" step needed.

## Data model doc/code discrepancies (found while writing web/src/types/models.ts)
Writing real TypeScript interfaces against the actual imported code surfaced
two places where the implementation quietly diverged from what CLAUDE.md/
agents.md document:
- [ ] `groupId` is documented on `categories`/`products`/`items`/`kits`, but no
      page (`CategoriesPage`, `ProductsPage`, `ItemsPage`, `KitsPage`) ever
      actually writes it - catalog data is only ever scoped by
      `subscriptionId` in practice. `ItemDetail`'s single-item request flow
      writes `groupId: item.groupId` when creating a request, which is
      therefore always `undefined` today. Decide: add real `groupId` support
      to the catalog pages, or drop it from the documented schema for these
      collections (a subscription-only scope may be all that's needed).
- [x] ~~`ownerId` documented but never implemented~~ — **resolved**: added
      `ownerId` to the `Item` model and an admin/superadmin dropdown on
      `ItemDetail` to set it directly (see Phase 4).

## Open questions / decisions to revisit
- [x] ~~Kit "size" model — one kit size, or per-item sizing at fulfillment
      time?~~ — **resolved**: per-**category** sizing. `UserProfile.sizes` is
      a `{ categoryId: size }` map (a shoe size and a dress size aren't the
      same scale); `requestKit` resolves each required product's category and
      matches against that category's stored size.
- [ ] What quick action is the scanner's default on tap (identify vs check-out)?
- [ ] Booking for future events (reserve kits for a date) — in scope later?
- [ ] Notifications for pending requests (email / push)?
- [x] ~~Should `MembersPage` support inviting a user by email who hasn't
      signed in yet~~ — **resolved**: invite link (`/join/{subscriptionId}`)
      lets anyone sign in and join directly, no pre-existing account needed.
