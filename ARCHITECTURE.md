# ARCHITECTURE.md

System architecture and repository layout for the Dress Asset Management project.
For the product brief see [agents.md](agents.md); for the data model, workflows,
and conventions see [CLAUDE.md](CLAUDE.md); for the build plan see
[todo.md](todo.md). This file answers "where does X live" and "how do the pieces
talk to each other."

## System overview

Two client surfaces share one Firebase backend and one Firestore data model.

```
┌────────────────────┐        ┌────────────────────┐
│   web/  (React)     │        │  mobile/ (React     │
│   Ant Design         │        │  Native, Phase 6)   │
│   management-heavy   │        │  NFC scanner only   │
└──────────┬──────────┘        └──────────┬──────────┘
           │  Firebase JS SDK              │  Firebase SDK
           │  (Auth, Firestore, Storage)   │  (Auth, Firestore)
           ▼                                ▼
        ┌─────────────────────────────────────┐
        │        Firebase (dressmanager)       │
        │  Auth · Firestore · Storage · Hosting │
        └────────────────┬──────────────────────┘
                          │ callable / triggers
                          ▼
        ┌─────────────────────────────────────┐
        │   functions/  Cloud Functions (Gen2)  │
        │   privileged writes: transfers, role  │
        │   changes, kit auto-fulfillment        │
        └─────────────────────────────────────┘
```

- **`web/`** is the primary app: subscription/group setup, catalog CRUD
  (categories/products/items/kits), member management, browsing, transfers,
  subscription approval. Deployed to **Firebase Hosting**.
- **`mobile/`** is intentionally thin: tap an NFC tag → resolve `itemId` →
  show the item → one quick action. Not built yet (Phase 6) because it needs a
  native build; NFC doesn't work in a browser on iOS.
- **`functions/`** is the only place allowed to perform privileged writes
  (holder transfers, role changes, kit fulfillment) — clients never write those
  fields directly, enforced by `firestore.rules`.
- Both clients authenticate with the same Firebase Auth (Google Sign-in) so every
  action — including an NFC scan — is attributed to a real user.
- **Open source, self-hosted**: each deployer owns their Firebase project
  (Console/`gcloud` access). A separately provisioned site administrator reviews
  registration requests and manages the subscription directory in `/site-admin`.
  See [docs/installation.md](docs/installation.md) for provisioning.

See [CLAUDE.md](CLAUDE.md) for the full Firestore collection schema and
[CLAUDE.md#key-workflows](CLAUDE.md) for how a kit request/approval flows through
these pieces.

## User roles and authorization

Authority has three scopes: installation, subscription and group. Site access,
subscription ownership and group roles are stored separately; one does not
automatically grant the others. A person can be a site administrator and an
organization member, or have different roles in different groups.

| Role | Scope | Source of authority | Permissions |
| --- | --- | --- | --- |
| **Site administrator** | Entire installation | Firebase Auth custom claim `siteAdmin: true`, assigned using trusted deployer credentials | Review subscription requests; approve new subscriptions; decline with feedback; list subscriptions and inspect group/member summaries; rename subscriptions. Uses `/site-admin`, including without subscription membership. |
| **Subscription owner** | Their subscription and all its groups | `subscriptions/{id}.ownerUserId` equals the caller's Auth UID | Manage the catalog, members and groups throughout their subscription; assign/revoke group roles; perform administrative transfers; remove members once their inventory and transfers are resolved. Ownership remains effective regardless of the owner's group-role map. |
| **Superadmin** | Assigned group | `users/{uid}.groups[groupId] = 'superadmin'` | Group catalog/member management, direct transfers, group metadata editing/deletion subject to constraints, and group role assignment/revocation. Can create an additional group in their subscription and becomes its superadmin. Cannot remove subscription members or change the subscription owner's roles. |
| **Admin** | Assigned group | `users/{uid}.groups[groupId] = 'admin'` | Manage the group's categories, products, items and kits; edit member profiles; share invitation links; approve/decline transfers and directly change item holders with history. Cannot assign roles, create/manage group definitions or remove subscription members. |
| **User** | Assigned group | `users/{uid}.groups[groupId] = 'user'` | Browse inventory and kits, comment, request items, manage their own profile and participate in transfers. Can approve requests for items they currently hold, accept offers addressed to them, and return held items to Storage. Cannot manage the catalog or other members. |
| **Joiner** | Assigned group, awaiting promotion | `users/{uid}.groups[groupId] = 'joiner'`, granted by invitation joining | Profile-only app access while awaiting a role from the subscription owner or the group's superadmin. Cannot create item requests/comments or use normal group operations. |

Site administrators use explicit site callables; their claim does not bypass
existing catalog, transfer, member or role authorization in another subscription.
They need subscription ownership or an appropriate group role to perform those
operations through the organization app. Site callables read the live Auth user's
claims, so revoking site access rejects subsequent operations even with an old
ID token.

Group permissions apply to the resource's actual `groupId`, not whichever group
happens to give the caller their highest role. Both resource and caller must
belong to the same subscription. Removing a group role deletes its map entry;
it does not remove subscription membership. Role changes protect the last group
superadmin. Only the subscription owner can remove a member, and only after held
or owned items and pending transfers have been resolved.

`ownerId` and `holderId` on an item are relationships, not administrative roles.
They permit specific actions such as offering an item to another member; the
recipient must accept before its holder changes. An item's owner is distinct
from the subscription owner. Administrative direct transfers require the
subscription owner or the item's group admin/superadmin and always append history.

### Users without active membership

These are account/application states, not additional role values:

- **Signed out:** can reach sign-in, invitation and explicit registration pages;
  no tenant data or privileged operations are available.
- **Signed in, no subscription:** the main site shows an invitation-required
  message with no subscription creation option. `/register` is an explicit URL
  for submitting an organization name, first group name and explanation.
- **Pending applicant:** can read their own submission/status at `/register`;
  has no subscription, groups or tenant privileges. Site-admin approval atomically
  creates the subscription, first group and owner membership. Decline provides
  feedback and permits a revised submission. Joining an existing subscription
  closes a pending application.
- **Invited member:** invitation joining attaches the account to the subscription
  with `joiner` roles in its groups. The subscription owner or a group superadmin
  then promotes them.
  The role is per group: a person with an active role in one group can use the app
  while still being a joiner in another.

The app restricts accounts with only `joiner` roles to Profile through
`ProtectedRoute`; this is a navigation restriction. Firestore catalog/member reads
remain subscription-wide, including for joiners. The backend separately requires
an active role (`user`, `admin` or `superadmin`) for normal group operations;
subscription ownership supplies authority across that subscription.

### Enforcement and implementation

All Firestore document writes use validated Cloud Functions; clients cannot
self-assign `subscriptionId`, group roles or item holders. Firestore rules enforce
subscription-scoped reads and deny direct document writes. Storage uses separate
rules for own avatars and authorized group catalog image uploads.

| Concern | Implementation |
| --- | --- |
| Auth identity, site claim, profile and subscription ownership | `web/src/auth/AuthContext.tsx` |
| Membership and profile-only route access | `web/src/auth/ProtectedRoute.tsx` |
| Group-management UI permissions | `web/src/auth/permissions.ts` |
| Trusted tenant/group authorization | `scope()` in `functions/src/index.ts` |
| Live site-administrator authorization | `siteAdmin()` in `functions/src/index.ts` |
| Role assignment and last-superadmin protection | `assignRole` callable |
| Application submission and approval | `registerSubscription`, `getMySubscriptionRequest`, `listSubscriptionRequests`, `reviewSubscriptionRequest` callables |
| Trusted site-role provisioning/revocation | `scripts/site-admin.cjs` |

See [CLAUDE.md](CLAUDE.md) for the canonical schemas and write paths, and
[subscription onboarding UX](docs/subscription-onboarding-ux.md) for the applicant
and administrator screens. Site administration, invitation-only default entry and registration approval
were deployed together to `dressmanager-540ba` on 7 October 2026.

## Repository layout

```
asset-mgr/
├── agents.md                Product brief (source of truth for requirements)
├── CLAUDE.md                 Data model, workflows, conventions (source of truth)
├── ARCHITECTURE.md            This file — system + repo structure
├── todo.md                    Phased build plan / progress tracker
├── docs/
│   └── installation.md        Step-by-step guide: deploying a fresh instance
│                                to your own Firebase/GCP project
├── scripts/
│   └── install.sh              Automates most of installation.md end to end
│                                (idempotent, safe to re-run)
│
├── firebase.json              Firebase project config: firestore/storage/
│                               hosting/functions/emulators wiring
├── .firebaserc                Firebase project alias → dressmanager-540ba
├── firestore.rules            Firestore security rules
├── firestore.indexes.json     Firestore composite index definitions
├── storage.rules              Cloud Storage security rules
│
├── web/                        Management web app (React + Vite + Ant Design)
│   ├── index.html
│   ├── vite.config.ts
│   ├── .env                    Local Firebase client config (gitignored)
│   ├── .env.example             Template for .env
│   └── src/
│       ├── main.tsx             App entry: AntD ConfigProvider, Router, AuthProvider
│       ├── App.tsx               Selects desktop/mobile presentation
│       ├── index.css              Global reset
│       ├── lib/
│       │   └── firebase.ts        app/auth/db/storage/functions init + emulator wiring
│       ├── types/
│       │   └── models.ts           TypeScript interfaces for every Firestore document
│       │                            shape (Item, Subscription, Kit, UserProfile, etc.) -
│       │                            the entire "data model" layer; pages import these
│       │                            instead of using `any` for Firestore data
│       ├── auth/
│       │   ├── AuthContext.tsx     Auth token/claim + Firestore profile/ownership sync
│       │   └── ProtectedRoute.tsx   Sign-in/membership guard; joiners restricted to Profile
│       ├── components/
│       │   └── ImageUpload.tsx      Shared AntD Upload → Cloud Storage widget
│       ├── pages/
│       │   ├── Login.tsx            "Login with Google"
│       │   ├── RegisterPage.tsx      Registration application/status; approval required
│       │   ├── InvitationRequiredPage.tsx  No-membership invitation message
│       │   ├── AdministrationPage.tsx      Organization management hub
│       │   ├── SiteAdminPage.tsx           Site-wide requests/subscription directory
│       │   ├── SubscriptionRequestQueue.tsx  Site application reviews
│       │   ├── JoinPage.tsx           /join/:subscriptionId — calls joinSubscription
│       │   ├── Dashboard.tsx         Item grid, filter by category/product/search;
│       │   │                          shows the invite link + copy button for admins
│       │   ├── CategoriesPage.tsx    Category CRUD (admin)
│       │   ├── ProductsPage.tsx      Product CRUD + image (admin)
│       │   ├── ItemsPage.tsx         Item CRUD + image + rfidTag (admin)
│       │   ├── ItemDetail.tsx        Item view: Comments tab, Holder History tab, request/transfer buttons
│       │   ├── KitsPage.tsx          Kit definitions and CRUD (admin)
│       │   ├── TransferInbox.tsx     Approve/accept (calls transferItem) / decline pending transfers
│       │   ├── MembersPage.tsx       Per-group role assignment (calls assignRole)
│       │   └── ProfilePage.tsx       Edit own size/gender/avatar
│       └── assets/                   Static assets
│
├── mobile/                     NFC scanner — draft only, not a scaffolded project yet
│   ├── README.md                 Notes + known issues in App.tsx (see file)
│   └── App.tsx                    Draft scan → lookup → display component (Phase 6)
│
└── functions/                  Cloud Functions 2.0 (Node.js + TypeScript)
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── index.ts             registerSubscription, joinSubscription,
                                   transferItem, requestKit, assignRole
                                   (all onCall; region europe-west1)
```

### Where things will grow

Landed so far (see [todo.md](todo.md) for exact phase status): subscription
onboarding, full catalog CRUD, dashboard browsing, item detail with
comments/history, kit and item transfer requests, transfer inbox, member/role management,
Firestore + Storage security rules. Still ahead:

- Composite Firestore indexes once filtering moves server-side (Dashboard
  currently fetches per-subscription and filters client-side).
- `functions/src/` splitting into one file per concern as it grows, re-exported
  from `index.ts`.
- `mobile/` becoming a real Expo/React Native project (Phase 6), fixing the
  known issues in `mobile/App.tsx` and mirroring `web/src/lib/firebase.ts` /
  `web/src/auth/` patterns adapted for RN.

## Conventions
- One Firebase project per environment; currently a single project
  (`dressmanager-540ba`) is used for dev. No separate staging/prod split yet —
  revisit before real users onboard.
- Client code (`web/`, future `mobile/`) never writes Firestore documents
  directly — all document mutations go through validated Cloud Functions. Security
  rules enforce this; see [CLAUDE.md#authorization-principles](CLAUDE.md).
- Emulator suite (`firebase emulators:start`) covers auth/firestore/storage/
  functions/hosting for local dev; toggle with `VITE_USE_EMULATORS` in `web/.env`.


## Shared kits and write validation (October 2026)

Kit definitions reference products that can be reused in many kits. Inventory is
shared, and pending requests may compete for one item. Transactional approval
increments the holder version and closes the other pending requests for that item.
All Firestore writes now pass through callable functions; client rules are read-only.
Catalog/role/transfer operations validate tenancy and the actual group role, with
subscription-owner authority. See CLAUDE.md and docs/audit-fixes.md for the current
function endpoints, data limits, image paths, and rollout steps.
