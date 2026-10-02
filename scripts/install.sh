#!/usr/bin/env bash
# Automates docs/installation.md steps 1, 3, 4, 6-11 for a fresh self-hosted
# deployment. Idempotent where practical (safe to re-run).
#
# Usage:
#   scripts/install.sh PROJECT_ID [REGION] [BILLING_ACCOUNT_ID]
#
#   PROJECT_ID          new or existing Firebase/GCP project ID
#   REGION              GCP region for Firestore/Storage/Functions
#                        (default: europe-west1)
#   BILLING_ACCOUNT_ID   required only if the project isn't already linked to
#                        billing (Cloud Functions 2nd gen needs Blaze).
#                        List yours with: gcloud billing accounts list
#
# Manual steps NOT automated here (see docs/installation.md):
#   - Enabling the Google sign-in provider (no CLI for this)
#   - Creating a billing account if you don't have one yet

set -euo pipefail

PROJECT_ID="${1:?Usage: $0 PROJECT_ID [REGION] [BILLING_ACCOUNT_ID]}"
REGION="${2:-europe-west1}"
BILLING_ACCOUNT="${3:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

step() { echo; echo "==> $*"; }

step "Checking prerequisites"
command -v gcloud >/dev/null || { echo "gcloud CLI not found. See https://cloud.google.com/sdk/docs/install"; exit 1; }
command -v firebase >/dev/null || { echo "firebase CLI not found. Run: npm install -g firebase-tools"; exit 1; }
command -v npm >/dev/null || { echo "npm not found. Install Node.js 24+."; exit 1; }
gcloud auth print-access-token >/dev/null 2>&1 || { echo "Not logged in to gcloud. Run: gcloud auth login"; exit 1; }
firebase projects:list >/dev/null 2>&1 || { echo "Not logged in to firebase. Run: firebase login"; exit 1; }

TOKEN() { gcloud auth print-access-token; }

step "1/9 Firebase project: $PROJECT_ID"
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Project already exists, skipping creation."
else
  firebase projects:create "$PROJECT_ID" --display-name "$PROJECT_ID"
fi

step "2/9 Billing"
CURRENT_BILLING=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null || echo "false")
if [ "$CURRENT_BILLING" != "True" ]; then
  if [ -z "$BILLING_ACCOUNT" ]; then
    echo "No billing account linked and none provided as an argument."
    echo "Cloud Functions 2nd gen requires Blaze billing. List accounts with:"
    echo "  gcloud billing accounts list"
    echo "Then re-run: $0 $PROJECT_ID $REGION <BILLING_ACCOUNT_ID>"
    exit 1
  fi
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
else
  echo "Billing already enabled, skipping."
fi

step "3/9 Firestore database in $REGION"
if firebase firestore:databases:get '(default)' --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Firestore database already exists, skipping."
else
  firebase firestore:databases:create '(default)' --location="$REGION" --project="$PROJECT_ID"
fi

step "4/9 Storage bucket in $REGION"
if curl -sf "https://firebasestorage.googleapis.com/v1beta/projects/$PROJECT_ID/defaultBucket" \
    -H "Authorization: Bearer $(TOKEN)" -H "x-goog-user-project: $PROJECT_ID" >/dev/null 2>&1; then
  echo "Default Storage bucket already exists, skipping."
else
  curl -sf -X POST \
    "https://firebasestorage.googleapis.com/v1beta/projects/$PROJECT_ID/defaultBucket" \
    -H "Authorization: Bearer $(TOKEN)" -H "Content-Type: application/json" \
    -H "x-goog-user-project: $PROJECT_ID" \
    -d "{\"location\": \"$REGION\"}" >/dev/null
fi

step "5/9 Register web app + write web/.env"
EXISTING_APP_ID=$(firebase apps:list WEB --project="$PROJECT_ID" --json 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const r=JSON.parse(d);console.log(r.result?.[0]?.appId||'')}catch{console.log('')}})" || echo "")
if [ -n "$EXISTING_APP_ID" ]; then
  APP_ID="$EXISTING_APP_ID"
  echo "Web app already registered ($APP_ID), reusing."
else
  APP_ID=$(firebase apps:create WEB "$PROJECT_ID Web" --project="$PROJECT_ID" --json \
    | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).result.appId)})")
fi

CONFIG_JSON=$(firebase apps:sdkconfig WEB "$APP_ID" --project="$PROJECT_ID" --json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.stringify(JSON.parse(d).result.sdkConfig))})")

node -e "
const cfg = JSON.parse(process.argv[1]);
const fs = require('fs');
const lines = [
  'VITE_FIREBASE_API_KEY=' + cfg.apiKey,
  'VITE_FIREBASE_AUTH_DOMAIN=' + cfg.authDomain,
  'VITE_FIREBASE_PROJECT_ID=' + cfg.projectId,
  'VITE_FIREBASE_STORAGE_BUCKET=' + cfg.storageBucket,
  'VITE_FIREBASE_MESSAGING_SENDER_ID=' + cfg.messagingSenderId,
  'VITE_FIREBASE_APP_ID=' + cfg.appId,
  'VITE_USE_EMULATORS=false',
  ''
].join('\n');
fs.writeFileSync('web/.env', lines);
" "$CONFIG_JSON"
echo "Wrote web/.env"

step "6/9 Point repo config at $PROJECT_ID"
# Written directly rather than via `firebase use --add`, which is an
# interactive prompt and would hang a non-interactive script.
echo "{\"projects\": {\"default\": \"$PROJECT_ID\"}}" > .firebaserc

# Keep Cloud Functions colocated with Firestore/Storage.
sed -i.bak "s/region: \"[a-z0-9-]*\"/region: \"$REGION\"/" functions/src/index.ts && rm -f functions/src/index.ts.bak
sed -i.bak "s/getFunctions(app, '[a-z0-9-]*')/getFunctions(app, '$REGION')/" web/src/lib/firebase.ts && rm -f web/src/lib/firebase.ts.bak

step "7/9 Install dependencies"
npm --prefix web install
npm --prefix functions install

step "8/9 Deploy security rules and Cloud Functions"
firebase deploy --only firestore --project="$PROJECT_ID"
firebase deploy --only storage --project="$PROJECT_ID"

# storage.rules calls firestore.get() (cross-service rules) to check the
# caller's role. The Console's "Publish" button auto-grants this IAM role to
# the Storage service account, but a CLI deploy does not - without it every
# upload fails with storage/unauthorized even though the rule logic and the
# user's role are both correct. Safe to re-run (idempotent).
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebasestorage.iam.gserviceaccount.com" \
  --role="roles/firebaserules.firestoreServiceAgent" \
  --condition=None >/dev/null

firebase deploy --only functions --project="$PROJECT_ID"

step "9/9 Build and deploy the web app"
npm --prefix web run build
firebase deploy --only hosting --project="$PROJECT_ID"

step "Done"
echo "Your app is live at: https://$PROJECT_ID.web.app"
echo
echo "Two things left to do manually:"
echo "  1. Enable Google sign-in:"
echo "     https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
echo "  2. Sign in and go through /register to create your organization."
