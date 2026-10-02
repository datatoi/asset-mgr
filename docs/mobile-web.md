# Mobile web interface

The React web app selects a separate phone interface below **768 CSS pixels**. At 768px and wider, the existing desktop layout and table views remain available. The layout adapts when the viewport crosses that boundary, including rotation. Changing layouts remounts the current screen; save form edits before crossing the breakpoint.

## Phone navigation

- **My items:** garments currently held by you, with quick Available/All views.
- **Kits:** required products, group and gender, profile size link, request action.
- **Transfers:** pending approvals, your outgoing requests/offers, and history.
- **Profile:** avatar upload, name, gender and category sizes.
- **More:** browse inventory, categories/products, permitted administration links, invite link and sign-out. Members awaiting promotion see only their profile and sign-out.

Inventory uses photo cards. Search matches product names or NFC tag text; the filter drawer supports group, category, product, holder, owner and size. Selecting a holder switches to All so the My items/Available quick filter does not hide that person's garments.

Item details show owner/holder, size, gender, condition, description and tag; comments and holder history use stacked entries. Members can request items, offer owned/held items, and return held items to storage. Administrators can change owner metadata and directly change holder, with the same history logging and backend authorization as desktop.

Transfer cards display garment names and photos instead of bare item IDs. The first valid approval still wins; shared kit definitions and competing pending requests are unchanged. Legacy pending requests must be canceled and recreated.

Administration uses the existing form and cell/action logic with card lists and full-screen editors on phones. Desktop continues using Ant Design tables and dialogs. `/manage/items` and `/manage/kits` links also resolve on desktop after a resize.

## Implementation

- `web/src/App.tsx`: viewport selection, mobile chunk loaded on demand.
- `web/src/DesktopApp.tsx`: retained desktop shell/routes.
- `web/src/mobile/`: phone shell, screens, styles and item activity subscriptions.
- `web/src/hooks/useTenantCollection.ts`: subscription-scoped live reads, cleanup and error/loading states.
- `web/src/components/PresentationTable.tsx`: mobile administration cards using existing field/action renderers; desktop Table props are passed through.

Styles are scoped to the mobile shell or mobile editor classes. The viewport supports display safe areas, bottom navigation reserves content space, fields use 16px text, and primary controls use 48px heights.

Authentication, image upload and all writes reuse the existing Firebase SDK setup and callable APIs. No database schema, functions, Firestore rules or Storage rules were changed for this interface. This is the **mobile web UI**; the planned React Native NFC scanner is a separate application.

## Delivery status — 2 October 2026

Each iteration is committed and pushed to `main`. Production TypeScript/Vite builds completed, and lint completed with the pre-existing AuthContext Fast Refresh warning. The large main bundle warning remains. Automated tests and browser/device checks were not run for this work; real iPhone/Android checks are still recommended, including keyboard behavior, rotation, uploads and transfer actions.

The mobile web interface was deployed to [dressmanager-540ba.web.app](https://dressmanager-540ba.web.app) on 2 October 2026. The live HTML, mobile JavaScript chunk and mobile stylesheet returned HTTP 200 after release.
