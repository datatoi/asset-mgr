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
│       ├── App.tsx               Route definitions
│       ├── index.css              Global reset
│       ├── lib/
│       │   └── firebase.ts        Firebase app/auth/db/storage init (+ emulator wiring)
│       ├── auth/
│       │   ├── AuthContext.tsx     onAuthStateChanged + Google sign-in/out
│       │   └── ProtectedRoute.tsx   Route guard, redirects to /login
│       ├── pages/
│       │   ├── Login.tsx            "Login with Google" page
│       │   └── Dashboard.tsx         Placeholder authenticated landing page
│       └── assets/                   Static assets
│
├── mobile/                     NFC scanner app — placeholder (Phase 6)
│   └── README.md                Notes: React Native, native build required
│
└── functions/                  Cloud Functions 2.0 (Node.js + TypeScript)
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── index.ts             Function exports (empty scaffold so far)
```

### Where things will grow

As features land (see [todo.md](todo.md) phases 2–5), expect:

- `web/src/pages/` to gain: catalog management screens (classes/types/items/kits),
  item detail (with Comments/History tabs), user profile, member/role management,
  the transfer/request inbox.
- `web/src/components/` (new) for shared pieces: image upload widget, filters,
  role-gated UI wrappers.
- `functions/src/` to split into one file per concern, e.g. `requests.ts`
  (kit auto-fulfillment, approve/decline), `transfers.ts` (admin direct transfer),
  `roles.ts` (role assignment), `subscriptions.ts` (onboarding), re-exported from
  `index.ts`.
- `mobile/` to become a real Expo/React Native app once Phase 6 starts, mirroring
  `web/src/lib/firebase.ts` and `web/src/auth/` patterns adapted for RN.

## Conventions
- One Firebase project per environment; currently a single project
  (`dressmanager-540ba`) is used for dev. No separate staging/prod split yet —
  revisit before real users onboard.
- Client code (`web/`, future `mobile/`) never writes `holderId`, roles, or
  history subcollections directly — always through a Cloud Function. Security
  rules enforce this; see [CLAUDE.md#authorization-principles](CLAUDE.md).
- Emulator suite (`firebase emulators:start`) covers auth/firestore/storage/
  functions/hosting for local dev; toggle with `VITE_USE_EMULATORS` in `web/.env`.
