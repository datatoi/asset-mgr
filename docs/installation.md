# Installation — Deploying to Google Cloud / Firebase

Step-by-step guide to stand up a fresh instance of this app on your own
Firebase project. This is the exact sequence used to set up
`dressmanager-540ba`, generalized so it works for a new project. See
[../CLAUDE.md](../CLAUDE.md) for architecture and [../ARCHITECTURE.md](../ARCHITECTURE.md)
for the repo layout.

**Fast path**: [`../scripts/install.sh`](../scripts/install.sh) automates
steps 1, 3, 4, and 6–11 below (project creation, Firestore, Storage, web app
registration + `.env`, dependency install, rules/functions/hosting deploy):

```bash
./scripts/install.sh YOUR-PROJECT-ID europe-west1 YOUR-BILLING-ACCOUNT-ID
```

It's safe to re-run (skips steps whose resources already exist). Steps 2
(enable Google sign-in) and 5 (create a billing account, if you don't have
one) can't be automated — no CLI exists for either — so do those manually
either before or after running the script; it'll tell you if billing is
missing. Read on for what the script is doing, or to run the steps by hand.

## Prerequisites

- Node.js 24+ and npm (matches the configured Cloud Functions runtime)
- A Google account
- [`gcloud` CLI](https://cloud.google.com/sdk/docs/install), logged in: `gcloud auth login`
- [`firebase` CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`, logged in: `firebase login`
- A GCP **billing account** (needed later for Cloud Functions — see step 5).
  Check you have one: `gcloud billing accounts list`

## 1. Create the Firebase project

```bash
firebase projects:create YOUR-PROJECT-ID --display-name "Your App Name"
firebase use YOUR-PROJECT-ID
```

Replace `YOUR-PROJECT-ID` everywhere below with your actual project ID.

## 2. Enable Google Sign-in

No CLI command for this — it's a manual step:
[console.firebase.google.com/project/YOUR-PROJECT-ID/authentication/providers](https://console.firebase.google.com/project/YOUR-PROJECT-ID/authentication/providers) →
**Authentication → Sign-in method → Google → Enable**.

## 3. Set up Firestore

```bash
firebase firestore:databases:create '(default)' --location=eur3 --project=YOUR-PROJECT-ID
```

Pick any [supported location](https://firebase.google.com/docs/firestore/locations) —
`eur3` (Belgium+Netherlands) is what this project uses for EU data residency.
The location is **permanent** once set.

## 4. Set up Cloud Storage

**Do not** just click "Get started" in the Storage console tab if you need a
specific region — that flow auto-provisions a free-tier bucket that's
**locked to `us-east1`**, with no location picker. To get a bucket in your
chosen region instead, call the same API the console button uses, directly:

```bash
TOKEN=$(gcloud auth print-access-token)
curl -X POST \
  "https://firebasestorage.googleapis.com/v1beta/projects/YOUR-PROJECT-ID/defaultBucket" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "x-goog-user-project: YOUR-PROJECT-ID" \
  -d '{"location": "europe-west1"}'
```

Use a region matching your Firestore location for co-location (e.g.
`europe-west1` sits inside the `eur3` multi-region). Verify it exists:

```bash
gcloud storage buckets describe gs://YOUR-PROJECT-ID.firebasestorage.app \
  --format="value(name,location,storageClass)"
```

## 5. Enable billing (Blaze plan)

Cloud Functions **2nd gen** (what this project uses) cannot run on the free
Spark plan at all — it requires Blaze (pay-as-you-go). Link an existing
billing account:

```bash
gcloud billing accounts list
gcloud billing projects link YOUR-PROJECT-ID --billing-account=YOUR-ACCOUNT-ID
```

If you don't have a billing account yet, create one in the
[Cloud Console](https://console.cloud.google.com/billing) (requires a credit
card). Low-volume dev usage typically stays within the free monthly quotas
even on Blaze.

## 6. Register a web app and get its config

```bash
firebase apps:create WEB "Your App Web" --project=YOUR-PROJECT-ID
firebase apps:sdkconfig WEB <the-app-id-printed-above> --project=YOUR-PROJECT-ID
```

Copy the printed values into `web/.env` (create it from `web/.env.example`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=YOUR-PROJECT-ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR-PROJECT-ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR-PROJECT-ID.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_USE_EMULATORS=false
```

## 7. Point the repo config at your project

```bash
cd asset-mgr
firebase use --add   # pick YOUR-PROJECT-ID, alias it "default"
```

This updates `.firebaserc`. Also check `functions/src/index.ts`'s
`setGlobalOptions({region: "europe-west1"})` — change the region string to
match wherever you put Firestore/Storage in steps 3–4, so Cloud Functions
runs colocated (and update the matching `getFunctions(app, 'europe-west1')`
call in `web/src/lib/firebase.ts`).

## 8. Install dependencies

```bash
npm --prefix web install
npm --prefix functions install
```

## 9. Deploy security rules

```bash
firebase deploy --only firestore:rules --project=YOUR-PROJECT-ID
firebase deploy --only storage --project=YOUR-PROJECT-ID
```

`storage.rules` calls `firestore.get()` to check the caller's role (cross-service
Security Rules). Deploying this via the Console's "Publish" button
auto-grants the required IAM role to the Storage service account, but
deploying via the **CLI does not** — you must grant it manually, once, or
every upload will fail with `storage/unauthorized` even though the rule logic
and the user's role are both correct:

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR-PROJECT-ID --format="value(projectNumber)")
gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebasestorage.iam.gserviceaccount.com" \
  --role="roles/firebaserules.firestoreServiceAgent" \
  --condition=None
```

IAM changes can take a few minutes to propagate.

## 10. Deploy Cloud Functions

```bash
firebase deploy --only functions --project=YOUR-PROJECT-ID
```

First deploy takes a few minutes (provisions Cloud Run services under the
hood). If it fails with an `npm ci` "out of sync" error even though it works
locally, delete `functions/node_modules` + `functions/package-lock.json` and
run `npm install` again — this happened once in this project because of a
`jest` peer dependency (from an unused `firebase-functions-test` dev
dependency) resolving differently between local npm and Cloud Build's npm.

## 11. Build and deploy the web app

```bash
npm --prefix web run build
firebase deploy --only hosting --project=YOUR-PROJECT-ID
```

Your app is now live at `https://YOUR-PROJECT-ID.web.app`.

## 12. First run — register an organization

Sign in and go through `/register` to create the first Subscription, Group,
and owner — this makes you `superadmin` of that group. There's no separate
site-wide admin role: whoever deploys this instance already has full
Console/`gcloud` access to it. See [../CLAUDE.md](../CLAUDE.md) for how
registration and roles work.

## Troubleshooting

- **"Firebase Storage has not been set up"** on `firebase deploy --only
  storage` — the project's default bucket isn't registered yet; redo step 4.
- **`npm ci` fails remotely but works locally** during functions deploy — see
  the note in step 10.
- **Functions region mismatch** (client calls time out / 404) — the region in
  `setGlobalOptions` (functions) and `getFunctions(app, region)` (web client)
  must match exactly.
- **EU Storage bucket needs Blaze** — the free-tier auto-provisioned bucket
  only supports `us-east1`; any other region requires Blaze billing enabled
  first (step 5 before step 4, if starting from scratch on the free tier).


## Updating an existing installation after the audit fixes

See [audit-fixes.md](audit-fixes.md) before rolling out this update. Deploy functions,
Firestore rules/indexes, Storage rules, and the rebuilt web app together during a
maintenance window: the web now sends all document writes through callables.
Existing pending transfers must be cancelled and recreated; new approval handlers
reject the old unvalidated request schema. Old catalog image paths remain readable,
but new uploads use tenant/group paths. The subscription owner can assign missing
legacy catalog groups through the existing edit forms, starting with categories.
