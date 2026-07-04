# TODO — Dress Asset Management

Build plan. Phases are roughly sequential; check items off as you go.
See [CLAUDE.md](CLAUDE.md) for the canonical architecture and data model.

## Phase 0 — Project setup
- [x] Create Firebase project (`dressmanager-540ba`) — Firestore, Functions,
      Storage, Hosting configured; web app registered
- [ ] Enable Google Sign-in provider — **manual step, see below**
- [ ] Provision default Storage bucket — **manual step, see below**
- [x] Init repo structure: `web/` (Vite+React+TS+AntD scaffold with Login/Dashboard
      pages, auth context, protected routes), `mobile/` (placeholder, Phase 6),
      `functions/` (TS scaffold), `firestore.rules`, `storage.rules`,
      `firestore.indexes.json`, `firebase.json`
- [x] Configure Firebase emulator suite for local dev (auth/firestore/storage/
      functions/hosting + UI) — verified boots cleanly
- [x] Set up `.env` / config handling for web (`web/.env`, `web/.env.example`,
      `VITE_USE_EMULATORS` flag); mobile config deferred to Phase 6

  **Manual steps required in Firebase Console before Phase 1 works end-to-end:**
  1. Authentication → Sign-in method → enable **Google**
     (console.firebase.google.com/project/dressmanager-540ba/authentication/providers)
  2. Storage → click **Get started** to provision the default bucket
     (console.firebase.google.com/project/dressmanager-540ba/storage)

## Phase 1 — Auth & tenancy
- [ ] Web: Google login page + auth state / protected routes
- [ ] Subscription registration flow (first login → create Subscription as owner)
- [ ] Create `users` doc on first login with `subscriptionId` + default role
- [ ] Group creation (sub-owner creates one or more groups)
- [ ] Member invite flow + role assignment (per-group: superadmin/admin/user)
- [ ] Cloud Function: role assignment/revocation (superadmin-only, per group)

## Phase 2 — Catalog management (web)
- [ ] Classes CRUD (e.g. dress, shoes, trousers, shirt, boots)
- [ ] Types CRUD (variant + gender + **image upload** to Cloud Storage)
- [ ] Items CRUD (type, size, gender, condition, **image**, **rfidTag**,
      owner, holder)
- [ ] Kits CRUD (name, gender, size, required `classIds`, description)
- [ ] Image upload/preview component (reused for types, items, avatars)

## Phase 3 — Browsing & detail (web)
- [ ] Dashboard: list all items, filter by holder / owner / group / class / type
- [ ] Item detail view: all properties + current holder/owner
- [ ] Detail Tab: Comments (list + add form, any user)
- [ ] Detail Tab: Holder history (chronological, shows who initiated if admin)
- [ ] Composite Firestore indexes for the filter combinations

## Phase 4 — Requests & transfers
- [ ] "Request kit" button → Cloud Function auto-picks available items by
      size/gender per required class; graceful fail if a class has none
- [ ] "Request item" flow (single item)
- [ ] Request inbox: approve / decline (holder or admin)
- [ ] Cloud Function: on approve → update `holderId`, append `holderHistory`,
      mark request `transferred`
- [ ] Admin direct transfer (change holder, auto-logged)
- [ ] User profile/settings: edit own size/gender + avatar upload

## Phase 5 — Security
- [ ] Firestore security rules (per-subscription read; admin-only catalog writes;
      user-owned profile; comments/requests creatable by any authed user;
      privileged writes only via Functions service account)
- [ ] Storage security rules (authed read; scoped upload/delete)
- [ ] Verify rules against emulator test cases

## Phase 6 — Mobile NFC scanner
- [ ] React Native app scaffold (Expo dev build or bare) + Firebase + Google auth
- [ ] Integrate `react-native-nfc-manager` (iOS Core NFC entitlement + Android)
- [ ] Read tag → resolve `itemId` → fetch + show item
- [ ] Quick actions: identify / check-out / return / transfer (via Functions)
- [ ] Tag-writing utility (admin writes `itemId` to a new washable tag)
- [ ] Build & test on physical iOS + Android device (NFC needs real hardware)

## Phase 7 — Polish & deploy
- [ ] Deploy web to Firebase Hosting
- [ ] Deploy Functions
- [ ] Distribute mobile builds (TestFlight / internal track)
- [ ] Seed/demo data script
- [ ] Basic end-to-end walkthrough of the full checkout → return loop

## Open questions / decisions to revisit
- [ ] Kit "size" model — one kit size, or per-item sizing at fulfillment time?
- [ ] What quick action is the scanner's default on tap (identify vs check-out)?
- [ ] Booking for future events (reserve kits for a date) — in scope later?
- [ ] Notifications for pending requests (email / push)?
