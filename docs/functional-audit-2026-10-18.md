# Functional audit — 18 October 2026

Audited revision: `bb4a363` on `main` (category size templates, item image
layering, product-driven gender default, group-first item/kit forms). Three
defects were found and fixed in the working tree; one deployment-ordering
risk remains.

## Verification

| Suite | Result |
|---|---|
| `scripts/audit-regression.cjs` (Auth/Firestore/Storage emulators) | 68 passed at `bb4a363`; 69 passed, 0 failed with the fixes |
| `scripts/inventory-regression.mjs` | passed |
| `scripts/functional-ui-regression.cjs` (mocked Firebase, 1280/390) | 13 passed |
| Ad-hoc browser checks of the new features (mocked Firebase, 1280/390) | 12 passed after fixes |
| Web `tsc` + lint, functions build | pass (existing Fast Refresh warning only) |

The ad-hoc checks covered: size template entry by Enter and comma and the
saved payload; the Sizes column; Add Item with a single managed group
preselected, gender following the chosen product, the product image preview,
template suggestions limited to the product's category, and free-text sizes;
removing an item image (sends `imageUrl: ''`, rendered as product-image
fallback); and item detail showing both product image and item photo.

## Findings

### 1. Size field label was not linked to its input — fixed

[SizeInput.tsx](../web/src/components/SizeInput.tsx) did not forward the
`id` that `Form.Item` injects. The "Size" label had no associated control, so
clicking it did nothing, assistive technology announced an unnamed field, and
validation scroll-to-field could not find it. The `id` is now passed to the
inner input.

### 2. Existing size hid the rest of the template — fixed

Opening the size dropdown on a field that already held a template value (e.g.
editing an item sized `M`) filtered the list down to that value, so choosing a
different size required clearing the field first. An exact template match now
shows the whole list; partial input still filters case-insensitively.

### 3. Deployment order: Functions before Hosting (open)

Production Hosting is at `a6abf58`. `bb4a363` adds `sizes` to the
`saveCatalog` category schema. If Hosting is deployed without Functions,
saving any category fails with an unexpected-field error because the client
always sends `sizes`. Deploy Functions first, then Hosting.

### 4. Backend accepted `unisex` kits — fixed

[KitsPage.tsx](../web/src/pages/KitsPage.tsx) offers only male/female, but
`saveCatalog` accepted `unisex` for kits. Kits are single-gender outfit
definitions (their garments may still be unisex), so `saveCatalog` now
rejects `unisex` kits, with an emulator regression check. An existing unisex
kit, if any, must be switched to male or female the next time it is edited.

## Not covered

Production Google sign-in, real Storage uploads against production rules,
NFC hardware, and production index readiness were not exercised. The ad-hoc
feature checks are not yet part of `functional-ui-regression.cjs`.
