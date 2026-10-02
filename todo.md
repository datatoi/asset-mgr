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
- [x] Group creation (sub-owner creates one or more groups) — first Group is
      created as part of `RegisterPage`/`registerSubscription`; additional
      Groups (e.g. age divisions like "Seniors"/"Youth"/"Middle-aged") are
      created later via `GroupsPage` → `createGroup` Cloud Function, which
      also grants the creator `superadmin` of the new group (Admin SDK, since
      `firestore.rules` can never let a direct client write create a group —
      `hasRole(groupId, ['superadmin'])` can't match a groupId that doesn't
      exist yet)
- [x] Member invite flow + role assignment (per-group: superadmin/admin/user/
      joiner) — `MembersPage` lets an admin change a member's role per group;
      joining itself is now via **invite link** (`/join/{subscriptionId}`,
      shown with a copy button on the Dashboard for admins → `JoinPage` →
      `joinSubscription` Cloud Function adds the visitor as `'joiner'` in
      every group of that subscription), so members no longer need to be
      manually added first — they just need to have signed in once via the link
- [x] Added a `'joiner'` role: previously new invite-link joiners got `'user'`
      immediately, which already granted them full read access to the whole
      app (browse catalog, request items, etc.) before an admin had actually
      vetted them. `joiner` is a holding state with no access beyond their
      own Profile page — enforced client-side in `ProtectedRoute` (redirects
      any other route to `/profile`) and in `App`'s nav (only shows the
      Profile link) — until an admin grants a real role via `MembersPage`.
      Deliberately left as a client-side restriction, not a Firestore rules
      change: reads have always been subscription-wide regardless of role
      (see Authorization principles in CLAUDE.md), so this doesn't weaken
      any existing security boundary, just the in-app navigation surface.
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
- [x] Added required `gender` (male/female/unisex) to Category, matching
      Product/Item. Drives a new filter on `ProfilePage`: a user only sees a
      size input for `unisex` categories plus ones matching their own
      gender — previously every category showed for every user regardless of
      fit. The user's own `gender` field on Profile was narrowed to
      male/female only (no "unisex person"). Caveat: categories created
      before this change have no `gender` set, so they won't match any
      user's gender and will disappear from Profile's size list until an
      admin edits them to set one (same class of gap as the earlier
      `groupId` rollout — see "Data model doc/code discrepancies" below).
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
- [x] Dashboard: Holder and Owner filters as dropdowns (populated from
      subscription members, Holder also offers "Storage") instead of relying
      on the free-text search to fuzzy-match names. Holder defaults to the
      signed-in user on load ("what do I have?") — clear it to browse
      everyone's items. Selecting a Category also narrows the Product
      dropdown to that category's products, resetting the Product filter if
      the previous selection no longer belongs to it.
- [x] Item detail view: all properties + current holder/owner
- [x] Detail Tab: Comments (list + add form, any user)
- [x] Detail Tab: Holder history (chronological, shows who initiated if admin)
- [ ] Composite Firestore indexes for the filter combinations — not yet
      needed since Dashboard filters client-side; revisit if/when filtering
      moves server-side (`where` queries on category/product/size together)

## Phase 4 — Transfers

Renamed throughout from "Requests" to "Transfers" — `requests` Firestore
collection → `transfers`, `RequestInbox.tsx` → `TransferInbox.tsx`
(`/requests` route → `/transfers`, nav label "Requests" → "Transfers"),
`requestId` param/field on `transferItem` → `transferId`, `firestore.rules`
`match /requests/{reqId}` → `match /transfers/{transferId}`. Rationale: every
document here represents a holder change, initiated by either side (a
non-holder requesting an item, or the holder/owner pushing it to someone) —
"request" only described the first case. No migration needed (dev-only, no
existing `requests` documents at rename time). The `TransferRequest` TS type
name and `requestedByUserId`/`currentHolderId`/`targetUserId` field names
were kept as-is (already accurate/unambiguous).

- [x] "Request kit" button → Cloud Function (`requestKit`) auto-picks
      available items by size/gender per required product; fails with
      `failed-precondition` if a product has none available
- [x] "Request item" flow (single item, from `ItemDetail`)
- [x] Request inbox: approve / decline (holder or admin) — approve calls
      `transferItem`, decline is a direct client update restricted by rules
- [x] Cloud Function: on approve → update `holderId`, append `holderHistory`,
      mark request `transferred` — `transferItem`
- [x] Fixed a real production bug (not just an emulator quirk, confirmed via
      `firebase functions:log`): `transferItem` threw `INTERNAL` for any item
      created before `groupId` became a required field, since its
      `holderHistory` write includes `groupId: itemData.groupId`, and the
      Admin SDK - unlike the client SDK, which already has
      `ignoreUndefinedProperties: true` (`web/src/lib/firebase.ts`) - rejects
      `undefined` field values outright. Added the same setting to the Admin
      SDK's Firestore instance in `functions/src/index.ts`.
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
- [x] Holder/owner-initiated "push" transfer with recipient acceptance —
      previously the only way to move an item was the "pull" flow (a
      non-holder requests it, current holder/admin approves) or an admin's
      direct dropdown transfer; there was no way for the actual holder/owner
      to proactively hand an item to a specific person without an admin, nor
      any acceptance step for the recipient. Added a "Transfer to..." control
      on `ItemDetail` (visible to the current holder or owner) that creates a
      `requests` doc with a new `targetUserId` field naming the recipient;
      it shows up in their `RequestInbox` to accept ("Accept & Transfer",
      calling `transferItem` with that request's `id`) or decline. Required
      widening `transferItem`'s authorization (previously only the item's
      current holder or an admin could call it) to also allow the caller when
      they're the `targetUserId` of the matching pending request, and adding
      `targetUserId` to the `requests` update rule's decline-allowed actors.

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
- [x] ~~`groupId` documented on `categories`/`products`/`items`/`kits` but
      never written~~ — **resolved**: added a required `groupId` `<Select>`
      (populated from a new `GroupsPage`) to the create/edit forms on
      `CategoriesPage`, `ProductsPage`, `ItemsPage`, and `KitsPage`, and made
      the field non-optional on the corresponding TS interfaces. Since there
      was previously no UI to create a Group beyond the one `registerSubscription`
      makes, also added `GroupsPage` (list + superadmin-only create form) and
      a `createGroup` Cloud Function, enabling multiple Groups per Subscription
      (e.g. age divisions: "Seniors"/"Youth"/"Middle-aged"). `ItemDetail`'s
      single-item request flow now writes a real `groupId` instead of
      `undefined`.
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


## October 2026 audit remediation

- [x] Preserve shared products/items across kit definitions; allow competing pending
      requests and enforce first-valid-approval semantics without reservations.
- [x] Route all document writes through validated callables; enforce tenant/group
      boundaries, immutable scope, bounded schemas, and catalog references.
- [x] Transactional onboarding, transfer approval, and roles; protect last superadmin
      and retain subscription-owner authority.
- [x] Fix regular-user transfer inbox, outgoing status/cancellation, unisex kit
      fulfillment, spoofed comments, and auth listener cleanup.
- [x] Add group edit/delete, member profile edit/removal, dashboard group filter,
      item product/category/gender/history actor, and sign-out control.
- [x] Scope catalog uploads to tenant/group, enforce image type/5 MB limits, keep
      legacy images readable, and save profile avatars immediately.
- [x] Update dependencies and add emulator regression checks.
- [x] Deploy the coordinated functions/rules/indexes/web update to
      `dressmanager-540ba` on 2 October 2026 (commit `00a8ca6`); kit index READY.

Earlier entries describe historical implementation paths (including direct client
writes). CLAUDE.md and docs/audit-fixes.md describe the replacement implementation.
The mobile NFC project remains the separately planned Phase 6 work.

## Mobile web interface — October 2026

- [x] Separate mobile shell below 768px, bottom navigation and More drawer;
      desktop presentation retained in DesktopApp.
- [x] Dedicated inventory, kit and transfer cards with mobile filters/actions.
- [x] Dedicated item detail/profile views and compact administration access.
- [x] Mobile administration cards, full-screen editors, safe areas and invite link.
- [x] Deploy the mobile web interface to `dressmanager-540ba` on 2 October 2026.
