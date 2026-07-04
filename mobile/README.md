# Mobile NFC Scanner

Not yet a scaffolded project (no `package.json`/Expo config here yet) — Phase 6
work, see [../todo.md](../todo.md). `App.tsx` is a **draft component** carried
over from an earlier prototype, kept as a starting reference. It requires a
native build; NFC does not work in Expo Go or a web wrapper. See
[../CLAUDE.md](../CLAUDE.md) for the architecture.

**Known issues in `App.tsx` to fix before this actually runs:**
1. `readTag()` calls `NfcManager.requestTechnology(NfcEvents.DiscoverTag)` —
   `NfcEvents.DiscoverTag` is an event-listener constant, not a valid
   `NfcTech` value. Should be `NfcManager.requestTechnology(NfcTech.Ndef)` (or
   the relevant tech), per `react-native-nfc-manager`'s actual API.
2. It looks up the item by `doc(db, 'items', tag.id)`, treating the tag's raw
   hardware UID as the Firestore document ID. That contradicts the project's
   NFC convention (tags store the item's Firestore ID as a written NDEF
   payload, not a lookup key derived from the tag's serial). Fix by either:
   writing the `itemId` into the tag's NDEF record and reading that payload, or
   — if using the hardware UID is intentional for simplicity — querying
   `items` where `rfidTag == tag.id` instead of using it as the doc ID.
3. Firebase client import (`../web/src/lib/firebase`) reaches across into the
   web app's source tree — once this becomes a real RN project, it needs its
   own Firebase init (RN can't share Vite's `import.meta.env`).
