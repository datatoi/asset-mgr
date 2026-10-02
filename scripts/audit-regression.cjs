// Run only against emulators: see docs/audit-fixes.md.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const project = 'demo-asset-mgr-audit';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('Start the Auth, Firestore and Storage emulators first.');
}
process.env.GCLOUD_PROJECT = project;
const fr = createRequire(path.join(root, 'functions/package.json'));
const wr = createRequire(path.join(root, 'web/package.json'));
const api = fr(path.join(root, 'functions/lib/index.js'));
const adminApp = fr('firebase-admin/app');
const db = fr('firebase-admin/firestore').getFirestore();
const appSdk = wr('firebase/app');
const authSdk = wr('firebase/auth');
const sdk = wr('firebase/firestore');
const storageSdk = wr('firebase/storage');
const clients = [];
const failures = [];
let passed = 0;
const call = (fn, uid, data) => api[fn].run({ auth: { uid, token: { name: 'Test Member', email: 'test@example.org' } }, data });
const denied = (operation, code = 'permission-denied') => assert.rejects(operation, e => e.code === code);
async function test(name, operation) {
  try { await operation(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failures.push(name); console.error(`FAIL ${name}: ${e.stack}`); }
}
async function client(name, signedIn = true) {
  const app = appSdk.initializeApp({ projectId: project, apiKey: 'demo-key', storageBucket: `${project}.appspot.com` }, name);
  const auth = authSdk.getAuth(app);
  authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9299', { disableWarnings: true });
  const uid = signedIn ? (await authSdk.signInAnonymously(auth)).user.uid : undefined;
  const store = sdk.getFirestore(app);
  sdk.connectFirestoreEmulator(store, '127.0.0.1', 8180);
  const storage = storageSdk.getStorage(app);
  storageSdk.connectStorageEmulator(storage, '127.0.0.1', 9298);
  const result = { app, store, storage, uid };
  clients.push(result);
  return result;
}
(async () => {
  const owner = await client('owner');
  const manager = await client('manager');
  const user = await client('user');
  const other = await client('other');
  const foreign = await client('foreign');
  const anonymous = await client('anonymous', false);
  const A = 'subA'; const G = 'groupA';
  await db.doc(`subscriptions/${A}`).set({ ownerUserId: owner.uid, name: 'A' });
  await db.doc('subscriptions/subB').set({ ownerUserId: foreign.uid, name: 'B' });
  await db.doc(`groups/${G}`).set({ subscriptionId: A, name: 'A' });
  await db.doc('groups/groupB').set({ subscriptionId: 'subB', name: 'B' });
  await db.doc('groups/unmanaged').set({ subscriptionId: A, name: 'Other A group' });
  for (const [c, role, sub, group] of [[owner, 'superadmin', A, G], [manager, 'admin', A, G], [user, 'user', A, G], [other, 'user', A, G], [foreign, 'superadmin', 'subB', 'groupB']]) {
    await db.doc(`users/${c.uid}`).set({ subscriptionId: sub, groups: { [group]: role }, name: c.app.name, email: 'test@example.org', gender: 'male', sizes: { categoryA: 'M' } });
  }
  const cat = await call('saveCatalog', owner.uid, { collection: 'categories', values: { groupId: G, name: 'Shirt', gender: 'unisex' } });
  // Use a fixed ID for the per-category profile fixture.
  await db.doc('categories/categoryA').set((await db.doc(`categories/${cat.id}`).get()).data());
  const product = await call('saveCatalog', owner.uid, { collection: 'products', values: { groupId: G, categoryId: 'categoryA', name: 'Shared shirt', gender: 'unisex' } });
  const newItem = async () => (await call('saveCatalog', owner.uid, { collection: 'items', values: { groupId: G, productId: product.id, size: 'M', gender: 'unisex', condition: 'good' } })).id;
  const itemId = await newItem();
  await test('Bulk requests bind exact items and current holders', async () => {
    const a = await newItem(); const b = await newItem();
    await call('transferItem', owner.uid, { itemId: b, newHolderId: other.uid });
    const result = await call('requestItems', user.uid, { itemIds: [a, b] });
    assert.equal(result.transferIds.length, 2);
    const records = await Promise.all(result.transferIds.map(x => db.doc(`transfers/${x}`).get()));
    assert.deepEqual(records.map(x => x.data().itemId).sort(), [a, b].sort());
    assert.equal(records.find(x => x.data().itemId === b).data().currentHolderId, other.uid);
    for (const record of records) {
      assert.equal(record.data().requestedByUserId, user.uid);
      assert.equal(record.data().schemaVersion, 2);
      assert.equal(record.data().status, 'pending');
    }
  });
  await test('Bulk requests skip held and already requested garments', async () => {
    const a = await newItem(); const b = await newItem(); const c = await newItem();
    await call('transferItem', owner.uid, { itemId: a, newHolderId: user.uid });
    await call('createTransfer', user.uid, { itemId: b });
    const result = await call('requestItems', user.uid, { itemIds: [a, b, c] });
    assert.equal(result.skipped, 2); assert.equal(result.transferIds.length, 1);
    assert.equal((await db.doc(`transfers/${result.transferIds[0]}`).get()).data().itemId, c);
    const retry = await call('requestItems', user.uid, { itemIds: [a, b, c] });
    assert.equal(retry.skipped, 3); assert.equal(retry.transferIds.length, 0);
  });
  await test('Bulk requests validate authentication, bounds and authority fields', async () => {
    await denied(() => api.requestItems.run({ data: { itemIds: [itemId] } }), 'unauthenticated');
    for (const data of [{ itemIds: [] }, { itemIds: [itemId, itemId] }, { itemIds: Array(101).fill(itemId) }, { itemIds: ['bad/id'] }, { itemIds: [itemId], requestedByUserId: other.uid }]) {
      await denied(() => call('requestItems', user.uid, data), 'invalid-argument');
    }
  });
  await test('An unauthorized or missing item aborts the whole bulk request', async () => {
    const a = await newItem();
    await db.doc('items/foreign-bulk').set({ subscriptionId: 'subB', groupId: 'groupB', productId: 'foreign', holderId: 'storage' });
    await denied(() => call('requestItems', user.uid, { itemIds: [a, 'foreign-bulk'] }));
    await denied(() => call('requestItems', user.uid, { itemIds: [a, 'missing-bulk'] }), 'not-found');
    assert.equal((await db.collection('transfers').where('itemId', '==', a).get()).size, 0);
  });
  await test('Bulk requests reject joiners and concurrent duplicate requests', async () => {
    const a = await newItem();
    await db.doc('users/bulk-joiner').set({ subscriptionId: A, groups: { [G]: 'joiner' } });
    await denied(() => call('requestItems', 'bulk-joiner', { itemIds: [a] }));
    const results = await Promise.all([call('requestItems', user.uid, { itemIds: [a] }), call('requestItems', user.uid, { itemIds: [a] })]);
    assert.equal(results.reduce((n, r) => n + r.transferIds.length, 0), 1);
  });
  await test('Unauthenticated catalog query denied', () => denied(() => sdk.getDocs(sdk.collection(anonymous.store, 'items'))));
  await test('Foreign tenant catalog read denied', () => denied(() => sdk.getDoc(sdk.doc(foreign.store, 'items', itemId))));
  await test('Direct catalog create/update/delete denied even for admins', async () => {
    await denied(() => sdk.setDoc(sdk.doc(foreign.store, 'items', 'injected'), { subscriptionId: A, holderId: foreign.uid }));
    await denied(() => sdk.updateDoc(sdk.doc(foreign.store, 'items', itemId), { ownerId: foreign.uid }));
    await denied(() => sdk.deleteDoc(sdk.doc(owner.store, 'items', itemId)));
  });
  await test('Foreign tenant admin cannot save/delete catalog', async () => {
    await denied(() => call('saveCatalog', foreign.uid, { collection: 'items', id: itemId, values: { ownerId: foreign.uid } }));
    await denied(() => call('deleteCatalog', foreign.uid, { collection: 'items', id: itemId }));
  });
  await test('Group admin cannot manage an unrelated group', () => denied(() => call('saveCatalog', manager.uid, { collection: 'categories', values: { groupId: 'unmanaged', name: 'No', gender: 'unisex' } })));
  await test('Regular member cannot write catalog', () => denied(() => call('saveCatalog', user.uid, { collection: 'categories', values: { groupId: G, name: 'No', gender: 'unisex' } })));
  await test('Initial holder is storage; injected holder is rejected', async () => {
    assert.equal((await db.doc(`items/${itemId}`).get()).data().holderId, 'storage');
    await denied(() => call('saveCatalog', owner.uid, { collection: 'items', values: { groupId: G, holderId: user.uid } }), 'invalid-argument');
  });
  await test('Catalog validation rejects extra fields, types and oversized text', async () => {
    for (const values of [{ groupId: G, name: 42, gender: 'unisex' }, { groupId: G, name: 'x'.repeat(201), gender: 'unisex' }, { groupId: G, name: 'No', gender: 'unisex', subscriptionId: 'subB' }]) {
      await denied(() => call('saveCatalog', owner.uid, { collection: 'categories', values }), 'invalid-argument');
    }
  });
  await test('Catalog relationships cannot cross groups', () => denied(() => call('saveCatalog', owner.uid, { collection: 'products', values: { groupId: 'unmanaged', categoryId: 'categoryA', name: 'No', gender: 'male' } })));
  await test('Direct forged transfer documents denied', () => denied(() => sdk.setDoc(sdk.doc(user.store, 'transfers', 'forged'), { itemId, targetUserId: user.uid, status: 'pending', schemaVersion: 2 })));
  await test('Non-holder cannot forge an offer through the callable', () => denied(() => call('createTransfer', user.uid, { itemId, targetUserId: other.uid })));
  await test('Foreign tenant admin direct transfer denied', () => denied(() => call('transferItem', foreign.uid, { itemId, newHolderId: foreign.uid })));
  await test('Nonexistent recipient rejected', () => denied(() => call('transferItem', owner.uid, { itemId, newHolderId: 'missing-user' }), 'not-found'));
  await test('Ordinary direct handover cannot bypass recipient acceptance', () => denied(() => call('transferItem', user.uid, { itemId, newHolderId: other.uid })));
  const req = await call('createTransfer', user.uid, { itemId });
  await test('Duplicate request blocked', () => denied(() => call('createTransfer', user.uid, { itemId }), 'already-exists'));
  await test('Subscription-scoped regular inbox query works', async () => {
    const rows = await sdk.getDocs(sdk.query(sdk.collection(user.store, 'transfers'), sdk.where('subscriptionId', '==', A), sdk.where('requestedByUserId', '==', user.uid)));
    assert(rows.size > 0);
  });
  await test('Old unsafe inbox query remains denied', () => denied(() => sdk.getDocs(sdk.query(sdk.collection(user.store, 'transfers'), sdk.where('targetUserId', '==', user.uid)))));
  await test('Recipient must match the validated request', () => denied(() => call('transferItem', owner.uid, { itemId, transferId: req.transferId, newHolderId: other.uid }), 'invalid-argument'));
  await test('Requester cannot approve own pull from storage', () => denied(() => call('transferItem', user.uid, { itemId, transferId: req.transferId })));
  await call('transferItem', owner.uid, { itemId, transferId: req.transferId });
  await test('Approval updates holder, version and history atomically', async () => {
    const item = (await db.doc(`items/${itemId}`).get()).data();
    assert.equal(item.holderId, user.uid); assert.equal(item.holderVersion, 1);
    const history = await db.collection(`items/${itemId}/holderHistory`).get();
    assert.equal(history.size, 1); assert.equal(history.docs[0].data().initiatedByUserId, owner.uid);
  });
  await test('Replay and unrelated transfer IDs rejected', async () => {
    await denied(() => call('transferItem', owner.uid, { itemId, transferId: req.transferId }), 'failed-precondition');
    const another = await newItem();
    await denied(() => call('transferItem', owner.uid, { itemId: another, transferId: req.transferId }), 'failed-precondition');
  });
  const offer = await call('createTransfer', user.uid, { itemId, targetUserId: other.uid });
  await test('Only named recipient or group admin accepts an offer', () => denied(() => call('transferItem', user.uid, { itemId, transferId: offer.transferId })));
  await call('transferItem', other.uid, { itemId, transferId: offer.transferId });
  await test('Holder can return to storage', async () => { await call('transferItem', other.uid, { itemId, newHolderId: 'storage' }); assert.equal((await db.doc(`items/${itemId}`).get()).data().holderId, 'storage'); });
  const kit1 = await call('saveCatalog', owner.uid, { collection: 'kits', values: { groupId: G, name: 'Kit one', gender: 'male', productIds: [product.id] } });
  const kit2 = await call('saveCatalog', owner.uid, { collection: 'kits', values: { groupId: G, name: 'Kit two', gender: 'male', productIds: [product.id] } });
  await test('Shared products across kit definitions and unisex fulfillment work', async () => {
    const a = await call('requestKit', user.uid, { kitId: kit1.id });
    const b = await call('requestKit', other.uid, { kitId: kit2.id });
    const x = (await db.doc(`transfers/${a.transferIds[0]}`).get()).data();
    const y = (await db.doc(`transfers/${b.transferIds[0]}`).get()).data();
    assert.equal(x.itemId, y.itemId); assert.equal(x.status, 'pending'); assert.equal(y.status, 'pending');
    const outcomes = await Promise.allSettled([call('transferItem', owner.uid, { itemId: x.itemId, transferId: a.transferIds[0] }), call('transferItem', manager.uid, { itemId: y.itemId, transferId: b.transferIds[0] })]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    const records = await Promise.all([db.doc(`transfers/${a.transferIds[0]}`).get(), db.doc(`transfers/${b.transferIds[0]}`).get()]);
    assert.deepEqual(records.map(r => r.data().status).sort(), ['declined', 'transferred']);
  });
  await test('Foreign kit request denied', () => denied(() => call('requestKit', foreign.uid, { kitId: kit1.id })));
  await test('Foreign and invalid role assignments rejected', async () => {
    await denied(() => call('assignRole', owner.uid, { targetUid: foreign.uid, groupId: G, role: 'superadmin' }));
    await denied(() => call('assignRole', owner.uid, { targetUid: user.uid, groupId: G, role: 'invented' }), 'invalid-argument');
    await denied(() => call('assignRole', manager.uid, { targetUid: user.uid, groupId: G, role: 'admin' }));
  });
  await test('Last superadmin cannot be revoked', () => denied(() => call('assignRole', owner.uid, { targetUid: owner.uid, groupId: G, role: null }), 'failed-precondition'));
  await test('Owner retains authority without roles', async () => {
    await db.doc(`users/${owner.uid}`).update({ groups: {} });
    await call('assignRole', owner.uid, { targetUid: owner.uid, groupId: G, role: 'superadmin' });
  });
  await test('Group tenancy cannot change', async () => {
    await denied(() => sdk.updateDoc(sdk.doc(owner.store, 'groups', G), { subscriptionId: 'subB' }));
    await denied(() => call('updateGroup', owner.uid, { groupId: G, name: 'No', subscriptionId: 'subB' }), 'invalid-argument');
  });
  await test('Comments reject spoofing and cross-tenant posting', async () => {
    await denied(() => sdk.setDoc(sdk.doc(user.store, 'items', itemId, 'comments', 'spoofed'), { userId: other.uid, text: 'no' }));
    await denied(() => call('addComment', foreign.uid, { itemId, text: 'no' }));
    await denied(() => call('addComment', user.uid, { itemId, text: 'no', userId: other.uid }), 'invalid-argument');
    await call('addComment', user.uid, { itemId, text: 'Valid comment' });
    const comments = await db.collection(`items/${itemId}/comments`).get();
    assert.equal(comments.docs[0].data().userId, user.uid);
  });
  await test('Profile protects authority fields and saves avatars', async () => {
    await denied(() => sdk.updateDoc(sdk.doc(user.store, 'users', user.uid), { groups: { [G]: 'superadmin' } }));
    await denied(() => call('updateProfile', user.uid, { groups: { [G]: 'superadmin' } }), 'invalid-argument');
    await denied(() => call('updateProfile', user.uid, { sizes: { categoryA: 42 } }), 'invalid-argument');
    await call('updateProfile', user.uid, { avatarUrl: 'https://example.org/avatar.png' });
    assert.equal((await sdk.getDoc(sdk.doc(user.store, 'users', user.uid))).data().avatarUrl, 'https://example.org/avatar.png');
  });
  await test('Concurrent onboarding creates one organization', async () => {
    const uid = 'concurrent-new-user';
    const outcomes = await Promise.allSettled([call('registerSubscription', uid, { orgName: 'One', groupName: 'One' }), call('registerSubscription', uid, { orgName: 'Two', groupName: 'Two' })]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    const memberships = (await db.doc(`users/${uid}`).get()).data();
    assert.equal(Object.keys(memberships.groups).length, 1);
    assert.equal((await db.collection('subscriptions').where('ownerUserId', '==', uid).get()).size, 1);
  });
  await test('Referenced catalog records cannot be deleted', () => denied(() => call('deleteCatalog', owner.uid, { collection: 'products', id: product.id }), 'failed-precondition'));
  await test('Direct legacy transfers are rejected', async () => {
    const x = await newItem();
    await db.doc('transfers/legacy').set({ subscriptionId: A, groupId: G, itemId: x, requestedByUserId: user.uid, currentHolderId: 'storage', status: 'pending' });
    await denied(() => call('transferItem', owner.uid, { itemId: x, transferId: 'legacy' }), 'failed-precondition');
    await call('declineTransfer', owner.uid, { transferId: 'legacy' });
  });
  await test('Owner can repair records without a legacy group ID', async () => {
    await db.doc('categories/legacy').set({ subscriptionId: A, name: 'Legacy', gender: 'unisex' });
    await call('saveCatalog', owner.uid, { collection: 'categories', id: 'legacy', values: { groupId: G } });
    assert.equal((await db.doc('categories/legacy').get()).data().groupId, G);
  });
  await test('Holder-version check rejects an old offer after a round trip', async () => {
    const x = await newItem();
    await call('transferItem', owner.uid, { itemId: x, newHolderId: user.uid });
    const offer = await call('createTransfer', user.uid, { itemId: x, targetUserId: other.uid });
    await call('transferItem', owner.uid, { itemId: x, newHolderId: 'storage' });
    await call('transferItem', owner.uid, { itemId: x, newHolderId: user.uid });
    // Simulate a stale pending record to independently exercise version validation.
    await db.doc(`transfers/${offer.transferId}`).update({ status: 'pending' });
    await denied(() => call('transferItem', other.uid, { itemId: x, transferId: offer.transferId }), 'failed-precondition');
    await call('declineTransfer', owner.uid, { transferId: offer.transferId });
  });
  await test('Concurrent role revocations preserve one superadmin', async () => {
    await call('assignRole', owner.uid, { targetUid: user.uid, groupId: G, role: 'superadmin' });
    const outcomes = await Promise.allSettled([
      call('assignRole', owner.uid, { targetUid: owner.uid, groupId: G, role: 'user' }),
      call('assignRole', owner.uid, { targetUid: user.uid, groupId: G, role: 'user' }),
    ]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    const admins = await db.collection('users').where('subscriptionId', '==', A).where(`groups.${G}`, '==', 'superadmin').get();
    assert.equal(admins.size, 1);
    await call('assignRole', owner.uid, { targetUid: owner.uid, groupId: G, role: 'superadmin' });
    await call('assignRole', owner.uid, { targetUid: user.uid, groupId: G, role: 'user' });
  });
  await test('Concurrent registration and invitation joining cannot mix tenants', async () => {
    const uid = 'register-join-race';
    const outcomes = await Promise.allSettled([
      call('registerSubscription', uid, { orgName: 'Race', groupName: 'Race' }),
      call('joinSubscription', uid, { subscriptionId: A }),
    ]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    const u = (await db.doc(`users/${uid}`).get()).data();
    for (const groupId of Object.keys(u.groups)) assert.equal((await db.doc(`groups/${groupId}`).get()).data().subscriptionId, u.subscriptionId);
  });
  await test('Unavailable kit product creates no partial requests', async () => {
    const missing = await call('saveCatalog', owner.uid, { collection: 'products', values: { groupId: G, categoryId: 'categoryA', name: 'Missing garment', gender: 'male' } });
    const kit = await call('saveCatalog', owner.uid, { collection: 'kits', values: { groupId: G, name: 'Incomplete kit', gender: 'male', productIds: [product.id, missing.id] } });
    await denied(() => call('requestKit', user.uid, { kitId: kit.id }), 'failed-precondition');
    assert.equal((await db.collection('transfers').where('kitId', '==', kit.id).get()).size, 0);
  });
  await test('Valid group/member management and clean member removal work', async () => {
    const group = await call('createGroup', owner.uid, { name: 'Temporary group' });
    await call('updateGroup', owner.uid, { groupId: group.groupId, name: 'Renamed group' });
    await call('deleteGroup', owner.uid, { groupId: group.groupId });
    assert.equal((await db.doc(`groups/${group.groupId}`).get()).exists, false);
    assert.equal((await db.doc(`users/${owner.uid}`).get()).data().groups[group.groupId], undefined);
    await call('updateMember', manager.uid, { targetUid: other.uid, groupId: G, profile: { name: 'Edited member' } });
    await db.doc('users/removable').set({ subscriptionId: A, groups: { [G]: 'user' } });
    await call('removeMember', owner.uid, { targetUid: 'removable' });
    assert.equal((await db.doc('users/removable').get()).data().subscriptionId, undefined);
  });
  const bytes = new Uint8Array([1, 2, 3]);
  const upload = (c, p, metadata = { contentType: 'image/png' }, data = bytes) => storageSdk.uploadBytes(storageSdk.ref(c.storage, p), data, metadata);
  await test('Storage allows own avatar and group-admin image upload', async () => {
    await upload(user, `avatars/${user.uid}/valid`);
    await upload(manager, `subscriptions/${A}/groups/${G}/items/valid`);
  });
  await test('Storage denies foreign avatar and foreign/unmanaged group writes', async () => {
    await denied(() => upload(foreign, `avatars/${user.uid}/foreign`), 'storage/unauthorized');
    await denied(() => upload(foreign, `subscriptions/${A}/groups/${G}/items/foreign`), 'storage/unauthorized');
    await denied(() => upload(manager, `subscriptions/${A}/groups/unmanaged/products/foreign`), 'storage/unauthorized');
  });
  await test('Storage enforces size/type limits on create and update', async () => {
    await denied(() => upload(user, `avatars/${user.uid}/text`, { contentType: 'text/plain' }), 'storage/unauthorized');
    await denied(() => upload(user, `avatars/${user.uid}/valid`, { contentType: 'text/plain' }), 'storage/unauthorized');
    await denied(() => upload(user, `avatars/${user.uid}/huge`, { contentType: 'image/png' }, new Uint8Array(5 * 1024 * 1024 + 1)), 'storage/unauthorized');
  });
  await test('Owner uploads to an unmanaged group with two-document authorization', async () => {
    const ready = await call('prepareImageUpload', owner.uid, { groupId: 'unmanaged', kind: 'products' });
    await upload(owner, `${ready.folder}/owner-valid`);
    await denied(() => call('prepareImageUpload', manager.uid, { groupId: 'unmanaged', kind: 'products' }));
  });
  await test('Legacy catalog image uploads denied' , () => denied(() => upload(owner, 'products/old-path'), 'storage/unauthorized'));
  console.log(`${passed} checks passed; ${failures.length} failed`);
  for (const c of clients) { await sdk.terminate(c.store); await appSdk.deleteApp(c.app); }
  await adminApp.deleteApp(adminApp.getApp());
  if (failures.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
