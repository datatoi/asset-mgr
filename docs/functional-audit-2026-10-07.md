# Functional audit — 7 October 2026

Audited revision: `92c29ab` on `main`. Five functional defects were confirmed.
The existing backend/rules suite passed, but did not cover these editor, token
refresh, recipient-role and live legacy-data cases.

## Remediation

The user subsequently requested fixes for all five findings:

- Catalog editors now reset their forms before editing another record. All four
  catalog editors guard concurrent submissions, show Save loading and retain
  drafts after errors.
- Same-UID token refresh updates claims while retaining profile listeners and
  mounted pages. Sign-out and UID changes still clear the previous session.
- Offer creation now validates the recipient's active group access, with the
  subscription-owner exception. Both recipient pickers use the same eligibility
  rule; owner/holder administration retains its existing member choices.
- The live kit's `groupId` was repaired to `vtWgusfIEKhlb7Dtotz6` (Visi), after
  verifying every required product belongs to that group and subscription. The
  update used the document's previous update time as a precondition. A readback
  verified only `groupId` changed. Backup:
  kept outside the repository.
- Four new emulator checks cover ineligible recipients, owner acceptance without
  a group role, role revocation, and legacy-kit repair followed by checkout.
  The expanded suite passes **68 checks with 0 failures**.
- `scripts/functional-ui-regression.cjs` provides permanent mocked-Firebase
  browser coverage for consecutive edits, duplicate-submit prevention, error
  retry, both offer pickers, token-refresh drafts and account switching.
  All **13 browser checks passed** at desktop/mobile widths. Web/functions builds
  and lint, and the inventory regression checks also pass (the existing web
  bundle-size and React Fast Refresh warnings remain).
- The updated `createTransfer` callable and Firebase Hosting web build were
  deployed to `dressmanager-540ba` / atver.lv on 7 October 2026.

The findings below describe the original audit observations, before remediation.

## Findings

All findings below are P2: affected workflows fail or can produce incorrect data,
but no instance-wide outage was demonstrated. Address the silent catalog data
change first, then the live kit and transfer blockers.

### 1. Editing another product can silently copy the previous product's image

Source: [ProductsPage.tsx](../web/src/pages/ProductsPage.tsx#L66).

Reproduction, confirmed in Chrome at widths 1280 and 390:

1. Edit product A, which has an image, then cancel.
2. Edit product B, which has no `imageUrl` field.
3. Save B without adding an image.

Actual: B's outgoing `saveCatalog` payload includes A's image URL. Ant Design
`setFieldsValue(record)` merges into the existing form state; it does not clear
fields missing from the next record. This can silently change unrelated data.

[ItemsPage.tsx](../web/src/pages/ItemsPage.tsx#L62) and
[KitsPage.tsx](../web/src/pages/KitsPage.tsx#L80) use the same edit pattern with
optional fields. Their individual field combinations were not browser-reproduced.

Recommended fix: reset the form before loading each edit record, and explicitly
initialize optional fields. Verify editing two consecutive records cannot carry
over images, item descriptions/RFID tags or kit descriptions.

### 2. A same-user auth token refresh erases unsaved form input

Source: [AuthContext.tsx](../web/src/auth/AuthContext.tsx#L39),
[ProtectedRoute.tsx](../web/src/auth/ProtectedRoute.tsx#L10),
[RegisterPage.tsx](../web/src/pages/RegisterPage.tsx#L97).

Reproduction, confirmed with the real AuthProvider and registration component,
using mocked Firebase auth/snapshot callbacks:

1. Sign in without membership and open `/register`.
2. Enter an organization name and request explanation.
3. Emit `onIdTokenChanged` for the same authenticated UID.
4. Wait for the profile and claim reads to finish.

Actual: both fields are empty. The auth callback resets profile/claim state and
sets global loading; the registration component is replaced with a spinner and
unmounted. It is subsequently recreated with an empty form. Protected pages also
unmount their children during this loading state, putting their local drafts at
risk. A token refresh should update credentials/claims without recreating the
entire same-user session.

Recommended fix: separate identity changes from same-UID token refresh. Retain
the resolved profile and page tree during refresh, while updating claims safely.
Continue to clear tenant state immediately on sign-out or UID change. Verify both
draft preservation and account-switch isolation.

### 3. Repeated catalog Save clicks can create duplicate records

Source: [ProductsPage.tsx](../web/src/pages/ProductsPage.tsx#L72),
[product modal](../web/src/pages/ProductsPage.tsx#L132),
[saveCatalog](../functions/src/index.ts#L619).

Reproduction, confirmed at widths 1280 and 390 with a held callable response:

1. Fill out a valid new product form.
2. Click OK twice while the first request is still pending.

Actual: two creation calls are sent. There is no submission lock or modal
`confirmLoading`; the backend allocates a new document ID for each create call.
Both valid requests can therefore create separate products. Categories, items
and kits use the same unguarded submit pattern; their duplicate writes were not
individually browser-reproduced.

Recommended fix: guard against concurrent submissions and disable/show loading
on Save until completion. Consider a stable creation request ID if retry
deduplication is required. Verify rapid clicks result in one document and that
errors leave the draft available for retry.

### 4. An offer can target a member who cannot accept it

Source: [createTransfer](../functions/src/index.ts#L796),
[transferItem](../functions/src/index.ts#L898),
[desktop recipient list](../web/src/pages/ItemDetail.tsx#L171),
[mobile recipient list](../web/src/mobile/MobileItemDetail.tsx#L66).

Reproduction, confirmed using the actual compiled callables in isolated emulators:

1. Give the holder an active role in the item's group.
2. Give the recipient membership in the same subscription, but an active role
   only in a different group.
3. Have the holder offer the item to that recipient.
4. Have the recipient accept using `transferItem` and the offer's `transferId`.

Actual: offer creation succeeds, but acceptance fails with `permission-denied:
Your group role cannot do this.` The offer remains pending. Creation validates
tenant membership only, while acceptance requires an active role in the item's
group. Both UI recipient lists include subscription members without checking
that acceptance requirement. A `joiner`-only member is also offered as a target
despite being unable to access the transfer inbox.

Recommended fix: align offer creation, recipient selection and acceptance
eligibility. With current group authorization, reject ineligible recipients on
the server and filter them in both UIs, including the subscription owner where
appropriate. Verify eligible acceptance, ineligible target rejection and role
revocation after an offer is created.

### 5. One live kit has no group and cannot be requested

Source: [requestKit](../functions/src/index.ts#L1060).

Read-only inspection of `dressmanager-540ba` found kit
`cTjZrywTPcV1OWAHClV3`, **Balti sv veste**, without `groupId`. Its referenced
product belongs to group `vtWgusfIEKhlb7Dtotz6` (Visi).

An equivalent legacy kit in the emulator was rejected by the real `requestKit`
callable with `invalid-argument: Invalid groupId.` This happens before size,
gender or availability checks, so profile changes cannot resolve it.

Recommended fix: have the subscription owner verify and assign the kit's group
through the existing catalog edit path, then verify its required products and
checkout. Do not derive authorization from an arbitrary product on every request.
Production data was left unchanged during this audit.

## Verification and coverage

| Check | Result |
| --- | --- |
| Web build and lint | Passed; existing bundle-size and React Fast Refresh warnings |
| Functions build and lint | Passed |
| `node scripts/inventory-regression.mjs` | Passed |
| Auth/Firestore/Storage emulator suite, `scripts/audit-regression.cjs` | 64 passed, 0 failed |
| Product editor browser probes, desktop and mobile | Both stale-image and duplicate-submit defects reproduced |
| Registration token-refresh browser probe | Unsaved organization name and explanation erased |
| Additional callable emulator probes | Ineligible recipient and groupless kit failures reproduced |

The regression suite exercises subscription approval/revision handling, site-admin
authorization, tenant/group boundaries, catalog reference validation, role
management, member removal, holder history, competing requests, kit fulfillment,
profile/comment writes, and Storage access/type/size limits. Passing those checks
does not establish full end-to-end production correctness.

Read-only live data inspection found one subscription, seven user documents,
four categories, ten products, six items, two kits and eight transfers. No pending
transfers or registration applications were present. Product-to-category and
item-to-product references had matching scopes. Two items lack `holderVersion`,
which the current transfer implementation explicitly treats as version zero;
this was not classified as a blocker.

## Limits and remaining product work

- Browser probes run the actual local React components with controlled Firebase
  fixtures. They do not perform a real Google popup login or production writes.
- Emulator calls invoke compiled callable handlers and rules; production callable
  transport, Google account switching and a long-lived browser session were not
  end-to-end tested in this audit.
- Native NFC scanner hardware behavior remains outside this audit. The native
  scanner is planned work rather than a verified production feature.
- No new critical authorization defect was demonstrated by the checks run.
  This is a functional audit, not a comprehensive security assessment.

## Repeating the repository checks

```sh
npm --prefix web run build
npm --prefix web run lint
npm --prefix functions run build
npm --prefix functions run lint
node scripts/inventory-regression.mjs
npx -y firebase-tools@latest emulators:exec \
  --project demo-asset-mgr-audit --config firebase.test.json \
  --only auth,firestore,storage 'node scripts/audit-regression.cjs'
```

The original targeted probes used temporary files under `/tmp`; their manual
reproduction steps and observed outcomes are recorded above. To run the permanent
browser checks added with the fixes, install web dependencies and start Vite:

```sh
npm --prefix web run dev -- --host 127.0.0.1 --port 5175
node scripts/functional-ui-regression.cjs
```

`AUDIT_BASE_URL` can select another local Vite URL. `CHROME_PATH` can select a
Chrome executable; the default is macOS Google Chrome when present, otherwise
Playwright's installed Chromium (`npm --prefix web exec playwright install chromium`).
These browser checks use mocked Firebase responses and do not write production data.
