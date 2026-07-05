# Project: Dress Asset Management Application

> Canonical architecture/data-model reference lives in [CLAUDE.md](CLAUDE.md);
> the build plan lives in [todo.md](todo.md). This document is the full product
> brief (v2, revised after scoping).

## Objective
Build a multi-tenant **SaaS** web + mobile application to manage shared costumes
for organizations such as folk dance groups. A group may have ~30 members but
only a limited number of complete costume **kits** (e.g. 10 male + 10 female of
each kind), so the core mechanic is **availability + checkout/booking** of kits
and items. **NFC RFID tags** provide fast physical identification of garments.
The app supports role-based access (per-group superadmin / admin / user) and
asset transfers between people, plus a site-wide **Platform Admin** who operates
the SaaS itself (see "Platform Administration" below) — distinct from the
per-group `superadmin` role, which only has authority within one subscription.

## Overall Architecture — two surfaces, one backend
*   **Web app** (management-heavy): React.js + Ant Design, hosted on Firebase
    Hosting. All catalog and member management, browsing, requests, transfers.
*   **Mobile NFC scanner** (thin, single-purpose): React Native with
    `react-native-nfc-manager`. Tap a garment's NFC tag → resolve the item →
    quick action. Requires a native build (Expo dev build or bare RN); NFC does
    not work in Expo Go or web. iOS uses Core NFC (iPhone 7+, iOS 13+).
*   **Backend**: Firebase Cloud Functions 2.0 (Node.js) for all privileged writes.
*   **Database**: Cloud Firestore.
*   **Authentication**: Firebase Authentication (Google Login).
*   **File Storage**: Cloud Storage for Firebase (type images, item images, avatars).
*   **Authorization**: Firebase Security Rules based on per-group roles in Firestore.

### NFC conventions
*   Tags store **only the `itemId`** (or a deep-link URL containing it) — a dumb
    pointer. All real data lives in Firestore, so items can be relabeled or
    reassigned without re-writing tags.
*   Use **washable laundry NFC tags** that survive the wash cycle.

## Tenancy & Roles
*   **Subscription** is the top-level tenant. A subscription admin registers via
    Google login; a new Subscription is created with them as **owner**. They build
    the whole ecosystem for their subscription, then invite other users.
*   A Subscription **owns many Groups**.
*   Roles are **per-group**, stored in the user's `groups` map:
    `superadmin` | `admin` | `user`. The subscription owner is the highest
    authority for their subscription.
*   Every tenant-scoped document carries a `subscriptionId`.

## Catalog hierarchy
**Class → Type → Item**, plus **Kit** as the checkout unit.
*   **Class** — broad category (dress, shoes, trousers, shirt, boots).
*   **Type** — specific variant with a picture ("red dress", "black shoes").
    Belongs to a class; has a gender.
*   **Item** — the physical garment. Has a picture, an **NFC RFID tag**, size,
    gender, condition. Belongs to a type. Has an **owner** and a **holder**.
*   **Kit** — a complete outfit set (male/female) made of one item per required
    **type** (not class — a kit needs a specific "Red Dress", not just any
    "Dress"). This is what a member checks out. Limited quantity drives booking.

### Owner vs Holder
Both are **people**. `ownerId` = long-term assigned person; `holderId` = who
physically has the item right now. **History tracks holder changes.**

## Frontend (Web) Requirements

**Technology Stack:** React.js, Ant Design, Firebase JS SDK (Auth, Firestore, Storage).

**Key Views/Forms:**

1.  **Login Page** — Ant Design "Login with Google" button; redirect on success.

2.  **Registration** — subscription admin registers and a new Subscription is
    created for them as owner; they then create groups and invite users.

3.  **Dashboard / Main View** (all authenticated users) — list all items; filter by
    holder, owner, group, class, type.

4.  **Item Detail View** (all authenticated users) — all properties (type, class,
    size, gender, condition, description, image), current owner and holder.
    *   **Tab: Comments** — list existing; form for any user to add one.
    *   **Tab: Holder History** — chronological past holders + transfer dates,
        including who initiated the change (if admin/superadmin).
    *   **Request Item / Kit Button** — a regular user requests an item, or a kit
        (which auto-generates individual item requests, see backend).

5.  **User Profile / Settings** — edit own size/gender; view/change avatar (Cloud
    Storage upload).

6.  **Admin Management Forms** (admin/superadmin roles):
    *   Classes management (create/edit/delete).
    *   Types management (create/edit/delete, with image).
    *   Items management (create/edit/delete, with image + RFID tag).
    *   Kits management (create/edit/delete; required types, gender, size).
    *   Members management (edit member properties; assign per-group roles).
    *   **Transfer window** — regular users: approve/decline receive/hand-over
        requests; admins/superadmins: directly change an item's holder with an
        automatic holder-history log (who, when).

7.  **Subscription/Group Administration** (subscription owner / superadmin) —
    manage groups and members within the subscription.

8.  **Platform Admin screens** (Platform Admin only — a single, site-wide role,
    separate from any subscription):
    *   **Subscriptions list** — every subscription on the site; edit `name`,
        `status` (active/suspended), `planId`, `ownerUserId` directly.
    *   **"Manage as" / impersonation** — act as full admin inside any one
        subscription's data (catalog, members, requests) to support/debug it.
        A persistent banner shows which subscription is being impersonated,
        with an explicit exit action.
    *   **Plans management** — CRUD pricing/limit plans (`name`,
        `priceMonthly`, `maxMembers`, `maxItems`); metadata only, no payment
        processor integration in this pass.
    *   **Metrics dashboard** — site-wide counts (subscriptions, users, items,
        requests) across all tenants.

## Backend (Cloud Functions) Requirements

**Technology Stack:** Node.js Firebase Cloud Functions 2.0.

**Functionality:**
*   **Kit request auto-fulfillment** — when a user requests a kit, auto-pick one
    **available item of each required type** matching the requester's size/gender;
    fail gracefully if a type has nothing available; create the per-item requests.
*   **Request processing** — handle approval/decline by the current holder (or
    admin). On approval: update `holderId`, append a `holderHistory` entry, mark
    the request `transferred`.
*   **Admin direct transfer** — admin/superadmin changes an item's holder without a
    request; must log the change in holder history.
*   **Role assignment/revocation** — securely update a user's per-group role, only
    callable by a superadmin for that group.
*   **Subscription/group setup** — initialize a subscription for a new owner and
    the first group.

**Implementation Details:**
*   Trigger via callable/HTTP requests from the frontend and Firestore triggers as
    appropriate.
*   Enforce permission checks based on the caller's per-group role.
*   **All holder/role changes go through Cloud Functions** — never trust client
    writes for these, even during early iteration.

## Database (Cloud Firestore)

*   `subscriptions/{subId}` — `ownerUserId`, `name`, `createdAt`.
*   `groups/{groupId}` — `subscriptionId`, `name`, `description`, `createdAt`.
*   `users/{uid}` (doc ID = Firebase Auth UID) — `subscriptionId`, `name`, `email`,
    `avatarUrl`, `groups` (map `{ groupId: 'superadmin'|'admin'|'user' }`),
    `size`, `gender`.
*   `classes/{classId}` — `subscriptionId`, `groupId`, `name`.
*   `types/{typeId}` — `subscriptionId`, `groupId`, `classId`, `name`, `gender`,
    `imageUrl`.
*   `items/{itemId}` — `subscriptionId`, `groupId`, `typeId`, `size`, `gender`,
    `condition`, `imageUrl`, `rfidTag`, `ownerId`, `holderId`, `createdAt`,
    `updatedAt`.
    *   Subcollection `comments/{id}` — `userId`, `text`, `timestamp`.
    *   Subcollection `holderHistory/{id}` — `previousHolderId`, `newHolderId`,
        `transferDate`, `initiatedByUserId`, `transferType`
        (`request` | `admin` | `scan`).
*   `kits/{kitId}` — `subscriptionId`, `groupId`, `name`, `gender`, `size`,
    `typeIds` (the specific Types a complete kit requires — one of each — not
    Classes), `description`.
*   `requests/{reqId}` — `subscriptionId`, `itemId`, `kitId?`, `requestedByUserId`,
    `currentHolderId`, `status` (`pending`|`approved`|`declined`|`transferred`),
    `requestedAt`, `approvedAt?`, `declinedAt?`, `transferredAt?`.
*   `subscriptions/{subId}` additionally carries `planId?`, `status`
    (`active`|`suspended`) — Platform-Admin-managed.
*   `plans/{planId}` — `name`, `description`, `priceMonthly`, `maxMembers`,
    `maxItems`.
*   `platformAdmins/{uid}` — `grantedAt`, `grantedBy`. Doc existence (keyed by
    Auth UID) is the grant itself — an allowlist, not a role field.

## Authentication & Authorization

**Authentication:** Firebase Authentication — Google Sign-in.

**Authorization (Firestore Security Rules):**
*   Authenticated users can **read** catalog data (classes, types, items, kits,
    comments, holderHistory) within their subscription.
*   Only `admin`/`superadmin` (per group) can **write** catalog collections
    (classes, types, items, kits, groups).
*   Any authenticated user can create `comments` on an item and create `requests`.
*   **Platform Admin** (per `platformAdmins/{uid}` doc existence) bypasses the
    per-subscription checks entirely — both in security rules (every
    tenant-scoped rule ORs in an `isPlatformAdmin()` check) and inside the
    privileged Cloud Functions (`transferItem`, `requestKit`, `assignRole`
    each OR in a server-side `isPlatformAdmin(uid)` check). This is what makes
    full impersonation ("Manage as") possible while still keeping the
    enforcement server-side, not just a client-side illusion.
*   Privileged writes (holder/role changes) are performed by Cloud Functions and
    allowed only from the trusted service account.
*   Users can only update their own `users` profile data.

## Mobile NFC Scanner Requirements
*   React Native app (Expo dev build or bare) sharing the same Firebase project and
    Google auth so scans are attributed to the signed-in user.
*   `react-native-nfc-manager` for read (and admin-side write) of NFC tags.
*   Read tag → resolve `itemId` → fetch and display the item → optional quick
    action (identify / check-out / return / transfer) via Cloud Functions.
*   Admin tag-writing utility writes `itemId` to a new washable tag.
*   Requires physical iOS/Android devices to test (NFC needs real hardware).

## File Storage (Cloud Storage)
*   Store type images, item images, and user avatars.
*   Rules: authenticated read; scoped upload/delete (item images by admins; avatars
    by the owning user).

---
**Note to AI:** The project prioritizes simplicity and quick iteration, with lower
security requirements initially (e.g. no strict UI security on role display). Core
validation happens client-side but must be reinforced by Cloud Functions for all
critical backend operations (holder transfers, role changes, kit fulfillment).
