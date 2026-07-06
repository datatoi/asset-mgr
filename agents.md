# Project: Dress Asset Management Application

> Canonical architecture/data-model reference lives in [CLAUDE.md](CLAUDE.md);
> the build plan lives in [todo.md](todo.md). This document is the full product
> brief (v2, revised after scoping).

## Objective
Build a multi-tenant, **open-source, self-hosted** web + mobile application to
manage shared costumes for organizations such as folk dance groups. Each
deployer runs their own Firebase project (see
[docs/installation.md](docs/installation.md)) — there is no hosted SaaS and no
site-wide operator role; whoever deploys it already has full Console/`gcloud`
access to their own instance. A group may have ~30 members but only a limited
number of complete costume **kits** (e.g. 10 male + 10 female of each kind), so
the core mechanic is **availability + checkout/booking** of kits and items.
**NFC RFID tags** provide fast physical identification of garments. The app
supports role-based access (per-group superadmin / admin / user) and asset
transfers between people.

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
*   **File Storage**: Cloud Storage for Firebase (product images, item images, avatars).
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
**Category → Product → Item**, plus **Kit** as the checkout unit.
*   **Category** — broad grouping (dress, shoes, trousers, shirt, boots).
*   **Product** — specific variant with a picture ("red dress", "black shoes").
    Belongs to a category; has a gender.
*   **Item** — the physical garment. Has a picture, an **NFC RFID tag**, size,
    gender, condition. Belongs to a product. Has an **owner** and a **holder**.
*   **Kit** — a complete outfit set (male/female) made of one item per required
    **product** (not category — a kit needs a specific "Red Dress", not just
    any "Dress"). This is what a member checks out. Limited quantity drives
    booking.

### Owner vs Holder
Both are **people**. `ownerId` = long-term assigned person; `holderId` = who
physically has the item right now. **History tracks holder changes** — owner
changes are plain metadata, not audited. Both are editable via dropdown by
admin/superadmin on the Item Detail view.

## Frontend (Web) Requirements

**Technology Stack:** React.js, Ant Design, Firebase JS SDK (Auth, Firestore, Storage).

**Key Views/Forms:**

1.  **Login Page** — Ant Design "Login with Google" button; redirect on success.

2.  **Registration** — subscription admin registers and a new Subscription is
    created for them as owner; they then create groups and invite users.

3.  **Dashboard / Main View** (all authenticated users) — list all items; filter by
    holder, owner, group, category, product.

4.  **Item Detail View** (all authenticated users) — all properties (product,
    category, size, gender, condition, description, image), current owner and holder.
    *   **Tab: Comments** — list existing; form for any user to add one.
    *   **Tab: Holder History** — chronological past holders + transfer dates,
        including who initiated the change (if admin/superadmin).
    *   **Request Item / Kit Button** — a regular user requests an item, or a kit
        (which auto-generates individual item requests, see backend).

5.  **User Profile / Settings** — edit own gender; set **size per category**
    (a shoe size and a dress size aren't the same scale, so one size input
    per category defined in the subscription, not one flat size field);
    view/change avatar (Cloud Storage upload).

6.  **Admin Management Forms** (admin/superadmin roles):
    *   Categories management (create/edit/delete).
    *   Products management (create/edit/delete, with image).
    *   Items management (create/edit/delete, with image + RFID tag).
    *   Kits management (create/edit/delete; required products, gender, size).
    *   Members management (edit member properties; assign per-group roles).
    *   **Invite link** (`/join/{subscriptionId}`) — shown with a copy button
        on the Dashboard; anyone who visits it and signs in joins as a plain
        `user` in every group of the subscription, promoted afterward via
        Members management.
    *   **Transfer window** — regular users: approve/decline receive/hand-over
        requests; admins/superadmins: directly change an item's holder with an
        automatic holder-history log (who, when).

7.  **Subscription/Group Administration** (subscription owner / superadmin) —
    manage groups and members within the subscription.

## Backend (Cloud Functions) Requirements

**Technology Stack:** Node.js Firebase Cloud Functions 2.0.

**Functionality:**
*   **Kit request auto-fulfillment** — when a user requests a kit, auto-pick one
    **available item of each required product** matching the requester's size/gender;
    fail gracefully if a product has nothing available; create the per-item requests.
*   **Request processing** — handle approval/decline by the current holder (or
    admin). On approval: update `holderId`, append a `holderHistory` entry, mark
    the request `transferred`.
*   **Admin direct transfer** — admin/superadmin changes an item's holder without a
    request; must log the change in holder history.
*   **Role assignment/revocation** — securely update a user's per-group role, only
    callable by a superadmin for that group.
*   **Subscription/group setup** — initialize a subscription for a new owner and
    the first group.
*   **Invite link join** — add the caller as `'user'` in every group of an
    existing subscription via its invite link; rejects if the caller already
    belongs to a subscription or the link is invalid.

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
*   `categories/{categoryId}` — `subscriptionId`, `groupId`, `name`.
*   `products/{productId}` — `subscriptionId`, `groupId`, `categoryId`, `name`,
    `gender`, `imageUrl`.
*   `items/{itemId}` — `subscriptionId`, `groupId`, `productId`, `size`, `gender`,
    `condition`, `imageUrl`, `rfidTag`, `ownerId`, `holderId`, `createdAt`,
    `updatedAt`.
    *   Subcollection `comments/{id}` — `userId`, `text`, `timestamp`.
    *   Subcollection `holderHistory/{id}` — `previousHolderId`, `newHolderId`,
        `transferDate`, `initiatedByUserId`, `transferType`
        (`request` | `admin` | `scan`).
*   `kits/{kitId}` — `subscriptionId`, `groupId`, `name`, `gender`, `size`,
    `productIds` (the specific Products a complete kit requires — one of each —
    not Categories), `description`.
*   `requests/{reqId}` — `subscriptionId`, `itemId`, `kitId?`, `requestedByUserId`,
    `currentHolderId`, `status` (`pending`|`approved`|`declined`|`transferred`),
    `requestedAt`, `approvedAt?`, `declinedAt?`, `transferredAt?`.

## Authentication & Authorization

**Authentication:** Firebase Authentication — Google Sign-in.

**Authorization (Firestore Security Rules):**
*   Authenticated users can **read** catalog data (categories, products, items,
    kits, comments, holderHistory) within their subscription.
*   Only `admin`/`superadmin` (per group) can **write** catalog collections
    (categories, products, items, kits, groups).
*   Any authenticated user can create `comments` on an item and create `requests`.
*   Privileged writes (holder/role changes) are performed by Cloud Functions and
    allowed only from the trusted service account.
*   Users can only update their own `users` profile data.
*   `users.subscriptionId`/`groups` can never be set directly by the client,
    on either `create` or `update` — otherwise anyone could self-grant a role
    in any group just by knowing its ID. Joining a subscription (registration
    or invite link) always goes through a Cloud Function.

## Mobile NFC Scanner Requirements
*   React Native app (Expo dev build or bare) sharing the same Firebase project and
    Google auth so scans are attributed to the signed-in user.
*   `react-native-nfc-manager` for read (and admin-side write) of NFC tags.
*   Read tag → resolve `itemId` → fetch and display the item → optional quick
    action (identify / check-out / return / transfer) via Cloud Functions.
*   Admin tag-writing utility writes `itemId` to a new washable tag.
*   Requires physical iOS/Android devices to test (NFC needs real hardware).

## File Storage (Cloud Storage)
*   Store product images, item images, and user avatars.
*   Rules: authenticated read; scoped upload/delete (item images by admins; avatars
    by the owning user).

---
**Note to AI:** The project prioritizes simplicity and quick iteration, with lower
security requirements initially (e.g. no strict UI security on role display). Core
validation happens client-side but must be reinforced by Cloud Functions for all
critical backend operations (holder transfers, role changes, kit fulfillment).
