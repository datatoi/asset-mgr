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
  `admin` | `user` | `joiner`. The subscription owner is the highest authority
  for their sub. `joiner` is the default role granted by the invite-link join
  flow (see Groups/Invite link below) — a holding state with no access beyond
  the joiner's own Profile page (client-side route restriction in
  `ProtectedRoute`, since Firestore reads stay subscription-wide regardless
  of role — see Authorization principles) until an admin grants a real role
  via `MembersPage`.
- Every tenant-scoped document carries a `subscriptionId`.
- All document writes go through authenticated callable functions with bounded
  schemas, tenant/group authorization, and reference validation. Firestore client
  rules allow scoped reads and deny document writes. Storage uploads remain direct
  SDK operations with separate scoped rules.
- Products and their physical items may be reused across multiple kit definitions.
  Kits describe product requirements; they do not own or permanently allocate items.
  Competing pending requests are allowed. The first valid approval wins; changing
  an item's holder closes the other pending requests for that item. No reservation
  is created merely by requesting a kit.

## Data model (Firestore)

Catalog hierarchy: **Category → Product → Item**, plus **Kit** (checkout unit).

- `subscriptions/{subId}` — `ownerUserId`, `name`, `createdAt`
- `groups/{groupId}` — `subscriptionId`, `name`, `description`, `createdAt`,
  `subscriptionOwnerId?` (server-derived owner mirror for Storage authorization)
- `users/{uid}` — `subscriptionId`, `name`, `email`, `avatarUrl`,
  `groups` (map: `{ groupId: 'superadmin'|'admin'|'user' }`), `gender`,
  `sizes` (map: `{ categoryId: sizeString }` — **per-category**, since a shoe
  size and a dress size aren't the same scale)
- `categories/{categoryId}` — `subscriptionId`, `groupId`, `name`, `gender`
  (e.g. dress, shoes) — `gender` here is `'male'|'female'|'unisex'` like
  Product/Item, and drives which categories `ProfilePage` shows a size input
  for (a user only sees `unisex` categories plus ones matching their own
  gender). Unlike Product/Item, a *user's own* `gender` only ever offers
  `male`/`female` on Profile — "unisex" describes a garment that fits
  either, not a person
- `products/{productId}` — `subscriptionId`, `groupId`, `categoryId`, `name`,
  `gender`, `imageUrl`  (e.g. "red dress")
- `items/{itemId}` — `subscriptionId`, `groupId`, `productId`, `size`, `gender`,
  `condition`, `imageUrl`, `rfidTag`, `ownerId`, `holderId`, `holderVersion`, `createdAt`, `updatedAt`
  - subcollection `comments/{id}` — `userId`, `text`, `timestamp`
  - subcollection `holderHistory/{id}` — `previousHolderId`, `newHolderId`,
    `transferDate`, `initiatedByUserId`, `transferType` (`request` | `admin` | `scan` | `return`)
- `kits/{kitId}` — `subscriptionId`, `groupId`, `name`, `gender`,
  `productIds` (the specific Products a complete kit requires — one of each —
  not Categories; e.g. "Red Dress" + "Black Shoes", not "Dress" + "Shoes"),
  `description` — no flat `size` field; fulfillment matches per-category
  against the requester's `sizes` map (see Kit request / checkout below)
- `transfers/{transferId}` — `subscriptionId`, `itemId`, `kitId?`,
  `requestedByUserId` (the initiator — the requester in a "pull", or the
  holder/owner in a "push"), `currentHolderId`, `targetUserId?` (set only
  for a holder/owner-initiated "push" transfer — see Kit request / checkout
  below), `status` (`pending`|`approved`|`declined`|`transferred`),
  `requestedAt`, `approvedAt?`, `declinedAt?`, `transferredAt?`, `groupId`,
  `holderVersion`, `schemaVersion: 2`, `declineReason?`. Named
  `transfers` (not `requests`) because every document here represents a
  holder change in progress, regardless of which side initiated it — the
  `TransferRequest` TS type already used this name before the collection
  itself did.

### Owner vs Holder
Both are **people**. `ownerId` = long-term assigned person; `holderId` = who
physically has it right now. **History tracks holder changes** (`holderHistory`)
— owner changes are plain metadata, not audited.

Both are editable by the subscription owner or an `admin`/`superadmin` of
that item's actual group on `ItemDetail`. Holder changes call `transferItem`
and always write `holderHistory`; owner changes call `saveCatalog` as metadata
updates without a holder-history entry. Both people must belong to the same
subscription. Ordinary holders can return an item to Storage, but offering it
to another member requires a recipient-accepted request.

`holderId` uses the sentinel value **`"storage"`** to mean "not currently
checked out / available" (rather than null or a separate `available` boolean).
Kit fulfillment and dashboards filter on `holderId == "storage"` to find
available items.

## Key workflows
- **Onboarding**: Google login → create Subscription (owner) → create Group(s) →
  build catalog (categories → products → items, with photos + NFC tags) → invite members.
- **Groups**: registration creates the first group. Owners/superadmins use
  `createGroup`, `updateGroup`, and `deleteGroup`; only empty groups can be deleted,
  at least one group must remain, and membership-map entries are removed atomically.
  Catalog forms require an authorized group. Existing group assignments are
  immutable; the subscription owner can assign a group to legacy catalog records
  that predate this field, in category → product → item/kit order.
- **Invite link**: `/join/{subscriptionId}`, shown with a copy button on the
  Dashboard for admins. Visiting it (after signing in) calls the
  `joinSubscription` Cloud Function, which adds the caller as `'joiner'` in
  every group of that subscription — `ProtectedRoute` confines a joiner to
  their own Profile page until an admin grants them a real role via
  `MembersPage`/`assignRole` (only the owner or a group superadmin can change roles). Rejects if the caller already belongs to a
  subscription. Like `registerSubscription`, this must go through a Cloud
  Function: `firestore.rules` blocks `users.subscriptionId`/`groups` from
  being set directly by the client, on both `create` and `update` (see
  Authorization principles) — otherwise anyone could self-grant a role in any
  group just by knowing its ID.
- **Kit request / checkout**: user requests a kit → backend resolves each
  required product's category, looks up the requester's `sizes[categoryId]`
  (rejecting with a clear error if not set), then **auto-picks an available
  item** of that product matching that size and the user's **gender** (including unisex garments), fails
  gracefully if none available → generates one `transfers` doc per item. This operation creates all requests
  atomically, supports shared product requirements across kits, and does not reserve
  inventory. Duplicate pending requests for the same kit from the same user are rejected.
- **Approval ("pull")**: a non-holder calls `createTransfer` from `ItemDetail`
  (`requestedByUserId` = requester, no `targetUserId`); the current holder (or
  admin) approves/declines. On approval, backend updates `holderId`, appends
  `holderHistory`, marks the transfer `transferred`.
- **Transfer offer ("push")**: the current holder or the owner picks a
  specific person from `ItemDetail`'s "Transfer to..." control and sends them
  a transfer offer (`requestedByUserId` = holder/owner who initiated it,
  `targetUserId` = offered recipient). It appears in the recipient's
  `TransferInbox`; they must accept through `transferItem` before `holderId` changes — the backend
  checks the validated request's named recipient, tenant, group, pending status,
  current holder, and holder version inside a transaction. Direct client transfer
  creation is denied. Cancellation and decline use `declineTransfer`.
- **Approval conflicts**: all holder updates increment `holderVersion`. Requests
  capture the current version; stale approvals fail even if an item returns to the
  same holder. After a transfer, competing pending requests become declined with
  `declineReason: 'holder-changed'`. Transfers created before schema version 2 must
  be cancelled and recreated because their client-supplied authority is untrusted.
- **Admin transfer**: admin/superadmin changes `holderId` directly; backend logs it.
- **NFC scan**: tap tag → resolve `itemId` → show item → optional quick transfer.

## Authorization principles
- All authenticated users in a subscription can **read** catalog data.
- Only the subscription owner or `admin`/`superadmin` of the actual group can
  write catalog documents through `saveCatalog`/`deleteCatalog`. Catalog relationships
  remain within a group and tenant. Deletion rejects referenced records, checked-out
  garments, and records with pending transfers.
- Active group members may add comments and create requests through `addComment`
  and `createTransfer`; the server supplies the author/initiator identity.
- `updateProfile` validates self profile fields and never accepts roles or tenancy.
  `updateMember` provides authorized admin profile edits; only the subscription owner
  can remove members via `removeMember`, after held/owned items and pending requests
  are resolved. `assignRole` validates target membership and the role enum and protects
  the last group superadmin. Owner authority survives role-map changes.
- **All holder/role changes go through Cloud Functions** — never trust client-side
  writes for these, even during early iteration.
- **`users.subscriptionId`/`groups` can never be set by a direct client
  write** — blocked on both `create` and `update` in `firestore.rules`.
  Joining a subscription (registration or invite link) always goes through
  `registerSubscription`/`joinSubscription` (Admin SDK, bypasses rules).

## Status
Core web app scaffolded and functional (Firebase project, auth, subscription
onboarding, catalog CRUD, dashboard, item detail with comments/history,
kit/item transfer requests, transfer inbox, member/role management, group management,
security rules).
Mobile NFC scanner not started (draft-only reference in `mobile/App.tsx`, has
known issues — see [mobile/README.md](mobile/README.md)). See [todo.md](todo.md)
for what's left. Original brief preserved in [agents.md](agents.md) (pre-revision;
superseded here).

## Uploads and validation

New catalog images use `subscriptions/{subId}/groups/{groupId}/{items|products}/{id}`.
`prepareImageUpload` validates group-admin/owner authority and stores the subscription
owner mirror in the group so Storage rules need only the group and caller documents
([Storage permits two Firestore reads](https://firebase.google.com/docs/storage/security/rules-conditions)).
Avatars use `avatars/{uid}/{id}` and persist immediately through `updateProfile`.
Only JPG, PNG, WebP, or GIF files up to 5 MB are accepted. Old catalog image paths
remain readable for authenticated users and reject writes.

Callable limits: names 200 characters, descriptions/comments 2,000, size values 50,
RFID values 128, image URLs 2,048 (HTTPS), profiles up to 200 size entries, kits 1–30
distinct products, and subscriptions up to 100 groups. IDs cannot contain path or
field delimiters. See [docs/audit-fixes.md](docs/audit-fixes.md) for validation and
rollout instructions.
