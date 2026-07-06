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

**Open source, self-hosted**: each deployer runs their own Firebase project
(see [docs/installation.md](docs/installation.md)). There is no hosted
multi-tenant SaaS and no site-wide operator role — whoever deploys the
project already has full Firebase Console/`gcloud` access to their own
instance, so there's nothing a separate in-app "platform admin" would add.
Multi-tenancy (Subscriptions/Groups, see below) exists so one deployed
instance can serve more than one organization if desired, not to support a
hosted-SaaS billing/operator model.

## Architecture — two surfaces, one backend

1. **Web app** (management-heavy): React + Ant Design + Firebase client SDKs.
   Handles subscription setup, catalog management (categories/products/items/
   kits), member management, browsing/filtering, comments, history, requests,
   and holder transfers. Hosted on Firebase Hosting.

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

## Data model (Firestore)

Catalog hierarchy: **Category → Product → Item**, plus **Kit** (checkout unit).

- `subscriptions/{subId}` — `ownerUserId`, `name`, `createdAt`
- `groups/{groupId}` — `subscriptionId`, `name`, `description`, `createdAt`
- `users/{uid}` — `subscriptionId`, `name`, `email`, `avatarUrl`,
  `groups` (map: `{ groupId: 'superadmin'|'admin'|'user' }`), `gender`,
  `sizes` (map: `{ categoryId: sizeString }` — **per-category**, since a shoe
  size and a dress size aren't the same scale)
- `categories/{categoryId}` — `subscriptionId`, `groupId`, `name`  (e.g. dress, shoes)
- `products/{productId}` — `subscriptionId`, `groupId`, `categoryId`, `name`,
  `gender`, `imageUrl`  (e.g. "red dress")
- `items/{itemId}` — `subscriptionId`, `groupId`, `productId`, `size`, `gender`,
  `condition`, `imageUrl`, `rfidTag`, `ownerId`, `holderId`, `createdAt`, `updatedAt`
  - subcollection `comments/{id}` — `userId`, `text`, `timestamp`
  - subcollection `holderHistory/{id}` — `previousHolderId`, `newHolderId`,
    `transferDate`, `initiatedByUserId`, `transferType` (`request` | `admin` | `scan`)
- `kits/{kitId}` — `subscriptionId`, `groupId`, `name`, `gender`,
  `productIds` (the specific Products a complete kit requires — one of each —
  not Categories; e.g. "Red Dress" + "Black Shoes", not "Dress" + "Shoes"),
  `description` — no flat `size` field; fulfillment matches per-category
  against the requester's `sizes` map (see Kit request / checkout below)
- `requests/{reqId}` — `subscriptionId`, `itemId`, `kitId?`, `requestedByUserId`,
  `currentHolderId`, `status` (`pending`|`approved`|`declined`|`transferred`),
  `requestedAt`, `approvedAt?`, `declinedAt?`, `transferredAt?`

### Owner vs Holder
Both are **people**. `ownerId` = long-term assigned person; `holderId` = who
physically has it right now. **History tracks holder changes** (`holderHistory`)
— owner changes are plain metadata, not audited.

Both are editable by `admin`/`superadmin` on `ItemDetail` via dropdowns. They
go through different paths: **holder** always calls the `transferItem` Cloud
Function (`transferType: 'admin'`, no `requestId`) so it's logged to
`holderHistory` the same as a request-approval transfer; **owner** is a plain
direct `updateDoc` (allowed by rules — only `holderId`/`subscriptionId` are
blocked from direct client writes on `items`), since it's not part of the
checkout workflow and doesn't need an audit trail.

`holderId` uses the sentinel value **`"storage"`** to mean "not currently
checked out / available" (rather than null or a separate `available` boolean).
Kit fulfillment and dashboards filter on `holderId == "storage"` to find
available items.

## Key workflows
- **Onboarding**: Google login → create Subscription (owner) → create Group(s) →
  build catalog (categories → products → items, with photos + NFC tags) → invite members.
- **Invite link**: `/join/{subscriptionId}`, shown with a copy button on the
  Dashboard for admins. Visiting it (after signing in) calls the
  `joinSubscription` Cloud Function, which adds the caller as `'user'` in
  every group of that subscription — an admin promotes them afterward via
  `MembersPage`/`assignRole`. Rejects if the caller already belongs to a
  subscription. Like `registerSubscription`, this must go through a Cloud
  Function: `firestore.rules` blocks `users.subscriptionId`/`groups` from
  being set directly by the client, on both `create` and `update` (see
  Authorization principles) — otherwise anyone could self-grant a role in any
  group just by knowing its ID.
- **Kit request / checkout**: user requests a kit → backend resolves each
  required product's category, looks up the requester's `sizes[categoryId]`
  (rejecting with a clear error if not set), then **auto-picks an available
  item** of that product matching that size and the user's **gender**, fails
  gracefully if none available → generates per-item requests.
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
- **`users.subscriptionId`/`groups` can never be set by a direct client
  write** — blocked on both `create` and `update` in `firestore.rules`.
  Joining a subscription (registration or invite link) always goes through
  `registerSubscription`/`joinSubscription` (Admin SDK, bypasses rules).

## Status
Core web app scaffolded and functional (Firebase project, auth, subscription
onboarding, catalog CRUD, dashboard, item detail with comments/history,
kit/item requests, request inbox, member/role management, security rules).
Mobile NFC scanner not started (draft-only reference in `mobile/App.tsx`, has
known issues — see [mobile/README.md](mobile/README.md)). See [todo.md](todo.md)
for what's left. Original brief preserved in [agents.md](agents.md) (pre-revision;
superseded here).
