import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

admin.initializeApp();

// Keep functions colocated with Firestore (eur3) and Storage (europe-west1)
// to avoid unnecessary cross-region latency and keep data in the EU.
setGlobalOptions({region: "europe-west1"});

const db = admin.firestore();

/**
 * Site-wide operator check - separate from the per-group 'superadmin' role.
 * Mirrors the isPlatformAdmin() rule in firestore.rules; enforcement here is
 * independent of anything the client claims (the client's "impersonation" of
 * a subscription is purely a UI illusion - this is the real check).
 * @param {string} uid Firebase Auth UID to check.
 * @return {Promise<boolean>} Whether the UID is a granted platform admin.
 */
async function isPlatformAdmin(uid: string): Promise<boolean> {
  const doc = await db.collection("platformAdmins").doc(uid).get();
  return doc.exists;
}

/**
 * Bootstraps a new Subscription + first Group for the caller, and makes them
 * superadmin of that group. Firestore rules deliberately block direct client
 * writes to `subscriptions` and `groups` (you can't create a group unless
 * you're already superadmin of it), so this one-time setup must go through
 * the Admin SDK. Rejects if the caller already belongs to a subscription.
 */
export const registerSubscription = onCall(async (request) => {
  const {auth} = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {orgName, groupName} = request.data;
  if (!orgName || !groupName) {
    throw new HttpsError("invalid-argument", "Missing orgName or groupName.");
  }

  const userRef = db.collection("users").doc(auth.uid);
  const existingUser = await userRef.get();
  if (existingUser.exists && existingUser.data()?.subscriptionId) {
    throw new HttpsError(
      "already-exists",
      "This account already belongs to a subscription."
    );
  }

  const subRef = db.collection("subscriptions").doc();
  const groupRef = db.collection("groups").doc();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const batch = db.batch();
  batch.set(subRef, {
    name: orgName,
    ownerUserId: auth.uid,
    createdAt: now,
  });
  batch.set(groupRef, {
    subscriptionId: subRef.id,
    name: groupName,
    description: "Default group",
    createdAt: now,
  });
  batch.set(userRef, {
    subscriptionId: subRef.id,
    name: auth.token.name || "Anonymous",
    email: auth.token.email,
    avatarUrl: auth.token.picture || null,
    groups: {[groupRef.id]: "superadmin"},
    createdAt: now,
  }, {merge: true});

  await batch.commit();
  logger.info(
    `Subscription ${subRef.id} + group ${groupRef.id} created by ${auth.uid}`
  );

  return {subscriptionId: subRef.id, groupId: groupRef.id};
});

/**
 * Transfers an item to a new holder. Callable by the current holder (self
 * hand-over) or by an admin/superadmin of the item's group.
 */
export const transferItem = onCall(async (request) => {
  const {auth} = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {itemId, newHolderId, transferType, requestId} = request.data;
  if (!itemId || !newHolderId || !transferType) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  const itemRef = db.collection("items").doc(itemId);
  const itemDoc = await itemRef.get();

  if (!itemDoc.exists) {
    throw new HttpsError("not-found", "Item not found.");
  }

  const itemData = itemDoc.data()!;
  const currentHolderId = itemData.holderId;
  const groupId = itemData.groupId;
  const subscriptionId = itemData.subscriptionId;

  const userDoc = await db.collection("users").doc(auth.uid).get();
  const userData = userDoc.data();
  const userRole = userData?.groups?.[groupId];
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const canTransfer = isAdmin || currentHolderId === auth.uid ||
    (await isPlatformAdmin(auth.uid));
  if (!canTransfer) {
    throw new HttpsError(
      "permission-denied",
      "Only the current holder or an admin can transfer this item."
    );
  }

  const batch = db.batch();

  batch.update(itemRef, {
    holderId: newHolderId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const historyRef = itemRef.collection("holderHistory").doc();
  batch.set(historyRef, {
    previousHolderId: currentHolderId,
    newHolderId: newHolderId,
    transferDate: admin.firestore.FieldValue.serverTimestamp(),
    initiatedByUserId: auth.uid,
    transferType: transferType,
    subscriptionId: subscriptionId,
    groupId: groupId,
  });

  if (requestId) {
    const requestRef = db.collection("requests").doc(requestId);
    batch.update(requestRef, {
      status: "transferred",
      transferredAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  logger.info(
    `Item ${itemId} transferred to ${newHolderId} by ${auth.uid}` +
    `${requestId ? ` (Req: ${requestId})` : ""}`
  );

  return {success: true};
});

/**
 * Automatically picks one available item per required type for a kit and
 * creates a pending request for each, matching the requester's size/gender.
 * "storage" is the sentinel holderId meaning "not currently checked out."
 */
export const requestKit = onCall(async (request) => {
  const {auth} = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {kitId} = request.data;
  if (!kitId) {
    throw new HttpsError("invalid-argument", "Missing kitId.");
  }

  const userDoc = await db.collection("users").doc(auth.uid).get();
  const userData = userDoc.data();
  if (!userData && !(await isPlatformAdmin(auth.uid))) {
    throw new HttpsError("not-found", "User data not found.");
  }

  const kitDoc = await db.collection("kits").doc(kitId).get();
  if (!kitDoc.exists) {
    throw new HttpsError("not-found", "Kit not found.");
  }

  const kitData = kitDoc.data()!;
  const {typeIds, subscriptionId, groupId} = kitData;
  const userSize = userData?.size;
  const userGender = userData?.gender;

  const batch = db.batch();
  const requestsCreated: string[] = [];

  for (const typeId of typeIds) {
    const itemsQuery = await db.collection("items")
      .where("subscriptionId", "==", subscriptionId)
      .where("typeId", "==", typeId)
      .where("holderId", "==", "storage")
      .where("size", "==", userSize)
      .where("gender", "==", userGender)
      .get();

    const availableItem = itemsQuery.docs[0];
    if (!availableItem) {
      throw new HttpsError(
        "failed-precondition",
        `No available item for type ${typeId} in size ${userSize}`
      );
    }

    const reqRef = db.collection("requests").doc();
    batch.set(reqRef, {
      subscriptionId,
      groupId,
      itemId: availableItem.id,
      kitId: kitId,
      requestedByUserId: auth.uid,
      currentHolderId: "storage",
      status: "pending",
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    requestsCreated.push(reqRef.id);
  }

  await batch.commit();
  logger.info(
    `Kit ${kitId} requested by ${auth.uid}. ` +
    `Created ${requestsCreated.length} requests.`
  );

  return {success: true, requestIds: requestsCreated};
});

/**
 * Assigns or revokes a user's role in a specific group.
 * Caller must be a superadmin for that group.
 */
export const assignRole = onCall(async (request) => {
  const {auth} = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {targetUid, groupId, role} = request.data;
  if (!targetUid || !groupId) {
    throw new HttpsError("invalid-argument", "Missing targetUid or groupId.");
  }

  const callerDoc = await db.collection("users").doc(auth.uid).get();
  const callerData = callerDoc.data();
  const callerRole = callerData?.groups?.[groupId];

  if (callerRole !== "superadmin" && !(await isPlatformAdmin(auth.uid))) {
    throw new HttpsError(
      "permission-denied",
      "Only superadmins can manage roles."
    );
  }

  const userRef = db.collection("users").doc(targetUid);

  if (role) {
    await userRef.update({
      [`groups.${groupId}`]: role,
    });
  } else {
    await userRef.update({
      [`groups.${groupId}`]: admin.firestore.FieldValue.delete(),
    });
  }

  logger.info(
    `Role ${role || "revoked"} assigned to ${targetUid} ` +
    `in group ${groupId} by ${auth.uid}`
  );

  return {success: true};
});
