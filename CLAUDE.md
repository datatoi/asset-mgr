# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. This is the canonical
source of truth for architecture and data model decisions. Keep it up to date as
the project evolves.

## Project

**Dress Asset Management** — a multi-tenant web + mobile application for managing
shared costumes (e.g. a folk dance group). A group may have ~30 members but only a
limited number of complete costume **kits** (e.g. 10 male + 10 female of each kind),
so the core mechanic is **availability + checkout/booking** of kits and items, with
**NFC RFID tags** for fast physical identification.

## Architecture — two surfaces, one backend

1. **Web app** (management-heavy): React + Ant Design + Firebase client SDKs.
   Handles subscription setup, catalog management (classes/types/items/kits),
   member management, browsing/filtering, comments, history, requests, and holder
   transfers. Hosted on Firebase Hosting.

2. **Mobile NFC scanner** (thin, single-purpose): React Native with
   `react-native-nfc-manager`. Tap a garment's NFC tag → resolve the item →
   quick action (identify / check-out / return / transfer). Signs into the same
   Firebase Auth so every scan is attributed to a user.
   - Requires a native build (Expo **dev build** or bare RN) — NFC does **not**
     work in Expo Go or a web wrapper. iOS uses Core NFC (iPhone 7+, iOS 13+).

3. **Backend**: Firebase Cloud Functions (Node.js) for all **privileged writes** —
   holder transfers, request approval/fulfillment, role changes, and kit
   auto-fulfillment. Cloud Firestore for data; Cloud Storage for images.

### NFC conventions
- Tags store **only the `itemId`** (or a deep-link URL containing it) — a dumb
  pointer. All real data lives in Firestore so items can be relabeled/reassigned
  without re-writing tags.
- Use **washable laundry NFC tags** (survive the wash cycle).

## Tech stack
- Frontend (web): React.js, Ant Design, Firebase JS SDK (Auth, Firestore, Storage)
- Mobile: React Native + `react-native-nfc-manager` (dev build / bare)
- Backend: Firebase Cloud Functions 2.0 (Node.js)
- Auth: Firebase Authentication — Google Sign-in
- Database: Cloud Firestore
- Storage: Cloud Storage for Firebase
- Hosting: Firebase Hosting

## Tenancy & roles
- **Subscription** is the top-level tenant. A sub-owner registers (Google login) and
  a new Subscription is created for them. The Subscription **owns many Groups**.
- Roles are **per-group**, stored in the user's `groups` map: `superadmin` |
  `admin` | `user`. The subscription owner is the highest authority for their sub.
- Every tenant-scoped document carries a `subscriptionId`.
- **Platform Admin** is a separate, site-wide role that sits *above* all
  subscriptions (this is a SaaS product — Platform Admin is the operator of the
  whole site, not a tenant). Deliberately named differently from the per-group
  `superadmin` role so the two are never confused: `superadmin` is the top role
  *within one subscription*; Platform Admin spans *all* subscriptions. See
  "Platform Administration" below.

## Data model (Firestore)

Catalog hierarchy: **Class → Type → Item**, plus **Kit** (checkout unit).

- `subscriptions/{subId}` — `ownerUserId`, `name`, `createdAt`
- `groups/{groupId}` — `subscriptionId`, `name`, `description`, `createdAt`
- `users/{uid}` — `subscriptionId`, `name`, `email`, `avatarUrl`,
  `groups` (map: `{ groupId: 'superadmin'|'admin'|'user' }`), `size`, `gender`
- `classes/{classId}` — `subscriptionId`, `groupId`, `name`  (e.g. dress, shoes)
- `types/{typeId}` — `subscriptionId`, `groupId`, `classId`, `name`, `gender`,
  `imageUrl`  (e.g. "red dress")
- `items/{itemId}` — `subscriptionId`, `groupId`, `typeId`, `size`, `gender`,
  `condition`, `imageUrl`, `rfidTag`, `ownerId`, `holderId`, `createdAt`, `updatedAt`
  - subcollection `comments/{id}` — `userId`, `text`, `timestamp`
  - subcollection `holderHistory/{id}` — `previousHolderId`, `newHolderId`,
    `transferDate`, `initiatedByUserId`, `transferType` (`request` | `admin` | `scan`)
- `kits/{kitId}` — `subscriptionId`, `groupId`, `name`, `gender`, `size`,
  `typeIds` (the specific Types a complete kit requires — one of each — not
  Classes; e.g. "Red Dress" + "Black Shoes", not "Dress" + "Shoes"),
  `description`
- `requests/{reqId}` — `subscriptionId`, `itemId`, `kitId?`, `requestedByUserId`,
  `currentHolderId`, `status` (`pending`|`approved`|`declined`|`transferred`),
  `requestedAt`, `approvedAt?`, `declinedAt?`, `transferredAt?`
- `subscriptions/{subId}` also carries `planId?` (ref to `plans`) and `status`
  (`active`|`suspended`, default `active`) — both Platform-Admin-managed.
- `plans/{planId}` — `name`, `description`, `priceMonthly`, `maxMembers`,
  `maxItems`. Metadata only for now — no payment processor integration;
  Platform Admin assigns a plan to a subscription manually.
- `platformAdmins/{uid}` — `grantedAt`, `grantedBy`. Existence of a doc here
  (doc ID = Firebase Auth UID) is the *entire* grant — an allowlist, not a
  role value. The very first entry must be created manually (Console/`gcloud`,
  since nothing can grant the first Platform Admin from within the app);
  see [todo.md](todo.md) for the bootstrap step actually used.

### Owner vs Holder
Both are **people**. `ownerId` = long-term assigned person; `holderId` = who
physically has it right now. **History tracks holder changes** (`holderHistory`).

`holderId` uses the sentinel value **`"storage"`** to mean "not currently
checked out / available" (rather than null or a separate `available` boolean).
Kit fulfillment and dashboards filter on `holderId == "storage"` to find
available items.

## Key workflows
- **Onboarding**: Google login → create Subscription (owner) → create Group(s) →
  build catalog (classes → types → items, with photos + NFC tags) → invite members.
- **Kit request / checkout**: user requests a kit → backend **auto-picks available
  items** of each required type matching the user's **size/gender**, fails
  gracefully if a type has none available → generates per-item requests.
- **Approval**: current holder (or admin) approves/declines. On approval, backend
  updates `holderId`, appends `holderHistory`, marks request `transferred`.
- **Admin transfer**: admin/superadmin changes `holderId` directly; backend logs it.
- **NFC scan**: tap tag → resolve `itemId` → show item → optional quick transfer.

## Authorization principles
- All authenticated users in a subscription can **read** catalog data.
- Only `admin`/`superadmin` (per group) can write catalog collections.
- Any authenticated user may add `comments` and create `requests`.
- **All holder/role changes go through Cloud Functions** — never trust client-side
  writes for these, even during early iteration.
- **Platform Admin bypasses per-subscription checks everywhere** — both in
  Firestore rules (an `isPlatformAdmin()` check ORed into every tenant-scoped
  rule) and inside `transferItem`/`requestKit`/`assignRole` (an
  `isPlatformAdmin(uid)` bypass alongside the normal per-group role check).
  This is what makes full impersonation possible.

## Platform Administration (SaaS operator layer)

A single Platform Admin operates the whole site (see [todo.md](todo.md) for
why "single admin, allowlist doc" was chosen over custom claims or a
multi-admin model — kept intentionally minimal since there's exactly one
operator today).

- **Grant mechanism**: existence of `platformAdmins/{uid}` (doc ID = the
  Firebase Auth UID). No other fields matter for authorization — `grantedAt`/
  `grantedBy` are just audit metadata.
- **Full impersonation model**: from the Platform Admin screen, clicking
  "Manage as" on a subscription sets client-side impersonation state. While
  impersonating, `AuthContext` presents a *synthesized* `userData` — real
  `subscriptionId` and `groups` map replaced with the target subscription's ID
  and every one of its real `groupId`s mapped to `'superadmin'` — so every
  existing tenant-scoped page (Dashboard, Items/Types/Classes/KitsPage,
  MembersPage, RequestInbox, ItemDetail) works completely unmodified while
  impersonating; they just read `userData` as always.
  - This client-side illusion is **not** what enforces security. The real
    enforcement is server-side: Firestore rules check the actual
    `platformAdmins/{uid}` doc (independent of anything the client claims),
    and the three privileged Cloud Functions do the same before falling back
    to the normal per-group role check.
  - A persistent "Impersonating: {subscription name} — Exit" banner is shown
    globally whenever impersonation is active, so it's never ambiguous whose
    data is on screen.
- **Subscription management**: Platform Admin can list all subscriptions and
  edit `name`/`status`/`planId`/`ownerUserId` directly (simple metadata, no
  Cloud Function needed — plain Firestore writes allowed by rules).
- **Plans**: Platform Admin CRUDs the `plans` collection and assigns a
  `planId` to each subscription. No enforcement of `maxMembers`/`maxItems`
  limits yet — metadata only, for future use.
- **Metrics**: a basic site-wide dashboard (subscription/user/item/request
  counts across *all* tenants) — only Platform Admin can query without a
  `subscriptionId` filter, per the rules bypass above.

## Status
Core web app scaffolded and functional (Firebase project, auth, subscription
onboarding, catalog CRUD, dashboard, item detail with comments/history,
kit/item requests, request inbox, member/role management, security rules).
Mobile NFC scanner not started (draft-only reference in `mobile/App.tsx`, has
known issues — see [mobile/README.md](mobile/README.md)). See [todo.md](todo.md)
for what's left. Original brief preserved in [agents.md](agents.md) (pre-revision;
superseded here).
