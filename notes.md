https://dressmanager-540ba.web.app


npm --prefix web run build          
firebase deploy --project dressmanager-540ba



# Firestore security rules only
firebase deploy --only firestore:rules --project dressmanager-540ba

# Storage security rules only
firebase deploy --only storage --project dressmanager-540ba

# Cloud Functions only (lint+build run automatically as a predeploy hook)
firebase deploy --only functions --project dressmanager-540ba
# single function: firebase deploy --only functions:requestKit --project dressmanager-540ba

# Web app to Hosting (build first — not automatic)
npm --prefix web run build
firebase deploy --only hosting --project dressmanager-540ba

# Everything at once
npm --prefix web run build
firebase deploy --project dressmanager-540ba
