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
      — `MembersPage` lists all users in the subscription and lets an admin
      change their role per group; there's no email-invite step, members must
      already have signed in once to appear
- [x] Cloud Function: role assignment/revocation (superadmin-only, per group)
      — `assignRole`
- [x] Fixed a real bug: `RegisterPage` originally wrote the Subscription/Group/
      user docs directly from the client, but `firestore.rules` correctly
      blocks that (`subscriptions: allow write: if false`, and `groups` write
      requires already being superadmin of the group you're trying to
      create — impossible on first creation). Added the `registerSubscription`
      Cloud Function (Admin SDK, bypasses rules) to do this atomically instead;
      `RegisterPage` now just calls it.

## Phase 2 — Catalog management (web)
- [x] Classes CRUD (e.g. dress, shoes, trousers, shirt, boots)
- [x] Types CRUD (variant + gender + **image upload** to Cloud Storage)
- [x] Items CRUD (type, size, gender, condition, **image**, **rfidTag**,
      owner, holder) — holder defaults to sentinel `"storage"` on creation
- [x] Kits CRUD (name, gender, size, required `typeIds`, description) —
      originally built (and documented) as `classIds`, corrected to reference
      specific Types instead of broad Classes (a kit needs "Red Dress", not
      just any "Dress"); also simplified `requestKit` by removing the
      now-unneeded classId→typeIds resolution step
- [x] Image upload/preview component (reused for types, items, avatars)

## Phase 3 — Browsing & detail (web)
- [x] Dashboard: list all items, filter by class / type / search (client-side
      filtering over the subscription's items — fine at current scale)
- [x] Item detail view: all properties + current holder/owner
- [x] Detail Tab: Comments (list + add form, any user)
- [x] Detail Tab: Holder history (chronological, shows who initiated if admin)
- [ ] Composite Firestore indexes for the filter combinations — not yet
      needed since Dashboard filters client-side; revisit if/when filtering
      moves server-side (`where` queries on class/type/size together)

## Phase 4 — Requests & transfers
- [x] "Request kit" button → Cloud Function (`requestKit`) auto-picks
      available items by size/gender per required type; fails with
      `failed-precondition` if a type has none available
- [x] "Request item" flow (single item, from `ItemDetail`)
- [x] Request inbox: approve / decline (holder or admin) — approve calls
      `transferItem`, decline is a direct client update restricted by rules
- [x] Cloud Function: on approve → update `holderId`, append `holderHistory`,
      mark request `transferred` — `transferItem`
- [ ] Admin direct transfer (change holder, auto-logged) — **backend supports
      it** (`transferItem` accepts `transferType: 'admin'` with no
      `requestId`), but no UI screen calls it outside the request-approval
      flow yet. Needs e.g. a "Change holder" action on `ItemsPage`/`ItemDetail`.
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

## Phase 8 — Platform Administration (SaaS operator layer)
- [x] `platformAdmins/{uid}` allowlist collection — doc existence is the grant;
      first entry bootstrapped manually via the Firestore REST API for
      `edgarsma@gmail.com` (UID `doN9q1ratTZjrHGNWMBAuEJfuSf2`) since nothing
      inside the app can grant the first Platform Admin
- [x] `plans/{planId}` collection (name, priceMonthly, maxMembers, maxItems) —
      metadata only, no payment processor integration
- [x] `subscriptions` gained `planId`/`status` fields, Platform-Admin-editable
- [x] Firestore rules: `isPlatformAdmin()` helper ORed into every tenant-scoped
      rule (read + write), so a Platform Admin can access any subscription's
      data directly
- [x] Cloud Functions: server-side `isPlatformAdmin(uid)` bypass added to
      `transferItem`, `requestKit`, `assignRole` — independent of the client
      illusion below, this is the actual enforcement
- [x] `AuthContext` extended with `isPlatformAdmin` + impersonation state:
      "Manage as" synthesizes a `userData` with the target subscription's ID
      and every one of its real groups mapped to `superadmin`, so all existing
      tenant-scoped pages work unmodified while impersonating
- [x] `PlatformAdminPage` — lists all subscriptions, edit
      name/status/planId/ownerUserId, "Manage as" button
- [x] `PlansPage` — pricing/limit plan CRUD
- [x] `MetricsPage` — site-wide aggregate counts (subscriptions/groups/users/
      items/kits/requests) via `getCountFromServer`
- [x] Persistent "Impersonating: {name} — Exit" banner in `App.tsx`; menu items
      for the three screens above only shown to Platform Admin
- [x] Deployed rules + functions + hosting; verified via `firebase functions:list`
      and hosting route checks

### Known gaps / not done
- [ ] No UI to grant/revoke *additional* Platform Admins (only one exists by
      design today) — would need a callable function restricted to existing
      Platform Admins, or manual Firestore doc creation like the bootstrap step
- [ ] `plan.maxMembers`/`maxItems` are metadata only — nothing enforces them
      (e.g. `ItemsPage`'s "Add Item" doesn't check against the assigned plan)
- [ ] `requestKit` while impersonating: a Platform Admin has no `size`/`gender`
      of their own, so kit auto-fulfillment while impersonating won't match
      any items — pre-existing edge case, not fixed (impersonation is for
      admin/support tasks, not for placing requests as if a member)
- [ ] No real payment processor integration (Stripe etc.) — explicitly out of
      scope for this pass, see agents.md/CLAUDE.md for the decision

## Data model doc/code discrepancies (found while writing web/src/types/models.ts)
Writing real TypeScript interfaces against the actual imported code surfaced
two places where the implementation quietly diverged from what CLAUDE.md/
agents.md document:
- [ ] `groupId` is documented on `classes`/`types`/`items`/`kits`, but no page
      (`ClassesPage`, `TypesPage`, `ItemsPage`, `KitsPage`) ever actually
      writes it - catalog data is only ever scoped by `subscriptionId` in
      practice. `ItemDetail`'s single-item request flow writes
      `groupId: item.groupId` when creating a request, which is therefore
      always `undefined` today. Decide: add real `groupId` support to the
      catalog pages, or drop it from the documented schema for these
      collections (a subscription-only scope may be all that's needed).
- [ ] `ownerId` (the long-term "owner" half of the Owner-vs-Holder model) is
      documented on `items` but never read or written anywhere in the UI -
      only `holderId` is actually tracked. Decide: implement the owner
      concept for real, or simplify the docs to describe only `holderId`.

## Open questions / decisions to revisit
- [ ] Kit "size" model — one kit size, or per-item sizing at fulfillment time?
- [ ] What quick action is the scanner's default on tap (identify vs check-out)?
- [ ] Booking for future events (reserve kits for a date) — in scope later?
- [ ] Notifications for pending requests (email / push)?
- [ ] Admin direct-transfer UI (see Phase 4 note above)
- [ ] Should `MembersPage` support inviting a user by email who hasn't signed
      in yet, or is "sign in once, then get assigned a role" acceptable?
