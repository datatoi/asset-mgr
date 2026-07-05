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
  (classes/types/items/kits), member management, browsing, requests, transfers.
  Deployed to **Firebase Hosting**.
- **`mobile/`** is intentionally thin: tap an NFC tag → resolve `itemId` →
  show the item → one quick action. Not built yet (Phase 6) because it needs a
  native build; NFC doesn't work in a browser on iOS.
- **`functions/`** is the only place allowed to perform privileged writes
  (holder transfers, role changes, kit fulfillment) — clients never write those
  fields directly, enforced by `firestore.rules`.
- Both clients authenticate with the same Firebase Auth (Google Sign-in) so every
  action — including an NFC scan — is attributed to a real user.
- A **Platform Admin** layer sits above all subscriptions (this is a SaaS
  product): one site-wide operator, granted via a `platformAdmins/{uid}`
  allowlist doc, can list/edit any subscription, fully impersonate one via
  "Manage as," manage pricing plans, and view site-wide metrics. Enforced
  server-side in both `firestore.rules` and the Cloud Functions — see
  [CLAUDE.md#platform-administration-saas-operator-layer](CLAUDE.md).

See [CLAUDE.md](CLAUDE.md) for the full Firestore collection schema and
[CLAUDE.md#key-workflows](CLAUDE.md) for how a kit request/approval flows through
these pieces.

## Repository layout

```
asset-mgr/
├── agents.md                Product brief (source of truth for requirements)
├── CLAUDE.md                 Data model, workflows, conventions (source of truth)
├── ARCHITECTURE.md            This file — system + repo structure
├── todo.md                    Phased build plan / progress tracker
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
│       ├── App.tsx               Route defs + sidebar nav (role-aware menu)
│       ├── index.css              Global reset
│       ├── lib/
│       │   └── firebase.ts        app/auth/db/storage/functions init + emulator wiring
│       ├── types/
│       │   └── models.ts           TypeScript interfaces for every Firestore document
│       │                            shape (Item, Subscription, Kit, UserProfile, etc.) -
│       │                            the entire "data model" layer; pages import these
│       │                            instead of using `any` for Firestore data
│       ├── auth/
│       │   ├── AuthContext.tsx     onAuthStateChanged + Firestore user profile sync
│       │   └── ProtectedRoute.tsx   Route guard: /login if signed out, /register if no profile
│       ├── components/
│       │   └── ImageUpload.tsx      Shared AntD Upload → Cloud Storage widget
│       ├── pages/
│       │   ├── Login.tsx            "Login with Google"
│       │   ├── RegisterPage.tsx      Calls registerSubscription (Subscription+Group+owner)
│       │   ├── Dashboard.tsx         Item grid, filter by class/type/search
│       │   ├── ClassesPage.tsx       Class CRUD (admin)
│       │   ├── TypesPage.tsx         Type CRUD + image (admin)
│       │   ├── ItemsPage.tsx         Item CRUD + image + rfidTag (admin)
│       │   ├── ItemDetail.tsx        Item view: Comments tab, Holder History tab, request button
│       │   ├── KitsPage.tsx          Kit CRUD (admin) + "Request Kit" (user, calls requestKit)
│       │   ├── RequestInbox.tsx      Approve (calls transferItem) / decline pending requests
│       │   ├── MembersPage.tsx       Per-group role assignment (calls assignRole)
│       │   ├── ProfilePage.tsx       Edit own size/gender/avatar
│       │   ├── PlatformAdminPage.tsx  All subscriptions: edit metadata, "Manage as" impersonation
│       │   ├── PlansPage.tsx          Pricing/limit plan CRUD (Platform Admin only)
│       │   └── MetricsPage.tsx        Site-wide aggregate counts (Platform Admin only)
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
        └── index.ts             registerSubscription, transferItem, requestKit,
                                   assignRole (all onCall; region europe-west1)
```

### Where things will grow

Landed so far (see [todo.md](todo.md) for exact phase status): subscription
onboarding, full catalog CRUD, dashboard browsing, item detail with
comments/history, kit and item requests, request inbox, member/role management,
Firestore + Storage security rules. Still ahead:

- Composite Firestore indexes once filtering moves server-side (Dashboard
  currently fetches per-subscription and filters client-side).
- An admin "direct transfer" UI — `transferItem` supports `transferType: 'admin'`
  today but no screen calls it outside the request-approval flow.
- `functions/src/` splitting into one file per concern as it grows, re-exported
  from `index.ts`.
- `mobile/` becoming a real Expo/React Native project (Phase 6), fixing the
  known issues in `mobile/App.tsx` and mirroring `web/src/lib/firebase.ts` /
  `web/src/auth/` patterns adapted for RN.

## Conventions
- One Firebase project per environment; currently a single project
  (`dressmanager-540ba`) is used for dev. No separate staging/prod split yet —
  revisit before real users onboard.
- Client code (`web/`, future `mobile/`) never writes `holderId`, roles, or
  history subcollections directly — always through a Cloud Function. Security
  rules enforce this; see [CLAUDE.md#authorization-principles](CLAUDE.md).
- Emulator suite (`firebase emulators:start`) covers auth/firestore/storage/
  functions/hosting for local dev; toggle with `VITE_USE_EMULATORS` in `web/.env`.
