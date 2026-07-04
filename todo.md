# TODO — Dress Asset Management

Build plan. Phases are roughly sequential; check items off as you go.
See [CLAUDE.md](CLAUDE.md) for the canonical architecture and data model, and
[ARCHITECTURE.md](ARCHITECTURE.md) for the current file layout.

## Phase 0 — Project setup
- [x] Create Firebase project (`dressmanager-540ba`) — Firestore, Functions,
      Storage, Hosting configured; web app registered
- [x] Enable Google Sign-in provider — confirmed enabled
- [x] Provision Storage bucket — done via `dressmanager-540ba-eu`
      (europe-west1), created manually and linked to Firebase because the
      auto-provisioned free-tier bucket is fixed to `us-east1` with no EU
      option on the free plan. Billing (Blaze) was already enabled on the
      project, so no plan upgrade was actually needed. App points at this
      bucket explicitly via `getStorage(app, 'gs://dressmanager-540ba-eu')`
      since the project's registered default bucket alias still resolves
      to a US bucket.
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

## Phase 2 — Catalog management (web)
- [x] Classes CRUD (e.g. dress, shoes, trousers, shirt, boots)
- [x] Types CRUD (variant + gender + **image upload** to Cloud Storage)
- [x] Items CRUD (type, size, gender, condition, **image**, **rfidTag**,
      owner, holder) — holder defaults to sentinel `"storage"` on creation
- [x] Kits CRUD (name, gender, size, required `classIds`, description)
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
      available items by size/gender per required class; fails with
      `failed-precondition` if a class has none available
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
- [ ] Deploy rules to the live project (currently local-only)

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
- [ ] Deploy Firestore + Storage rules
- [ ] Deploy Cloud Functions (`transferItem`, `requestKit`, `assignRole`)
- [ ] Deploy web to Firebase Hosting
- [ ] Distribute mobile builds (TestFlight / internal track)
- [ ] Seed/demo data script
- [ ] Basic end-to-end walkthrough of the full checkout → return loop

## Open questions / decisions to revisit
- [ ] Kit "size" model — one kit size, or per-item sizing at fulfillment time?
- [ ] What quick action is the scanner's default on tap (identify vs check-out)?
- [ ] Booking for future events (reserve kits for a date) — in scope later?
- [ ] Notifications for pending requests (email / push)?
- [ ] Admin direct-transfer UI (see Phase 4 note above)
- [ ] Should `MembersPage` support inviting a user by email who hasn't signed
      in yet, or is "sign in once, then get assigned a role" acceptable?
