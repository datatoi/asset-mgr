import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

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

  if (!isAdmin && currentHolderId !== auth.uid) {
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
 * Automatically picks one available item per required class for a kit and
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
  if (!userData) {
    throw new HttpsError("not-found", "User data not found.");
  }

  const kitDoc = await db.collection("kits").doc(kitId).get();
  if (!kitDoc.exists) {
    throw new HttpsError("not-found", "Kit not found.");
  }

  const kitData = kitDoc.data()!;
  const {classIds, subscriptionId, groupId} = kitData;
  const userSize = userData.size;
  const userGender = userData.gender;

  const batch = db.batch();
  const requestsCreated: string[] = [];

  for (const classId of classIds) {
    // Items don't carry classId directly (only typeId), so resolve the set of
    // types belonging to this class first, then find an available item of one
    // of those types matching the requester's size and gender.
    const typesInClass = await db.collection("types")
      .where("subscriptionId", "==", subscriptionId)
      .where("classId", "==", classId)
      .get();

    const typeIds = typesInClass.docs.map((d) => d.id);
    if (typeIds.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        `No types found for class ${classId}`
      );
    }

    const itemsQuery = await db.collection("items")
      .where("subscriptionId", "==", subscriptionId)
      .where("typeId", "in", typeIds)
      .where("holderId", "==", "storage")
      .where("size", "==", userSize)
      .where("gender", "==", userGender)
      .get();

    const availableItem = itemsQuery.docs[0];
    if (!availableItem) {
      throw new HttpsError(
        "failed-precondition",
        `No available item for class ${classId} in size ${userSize}`
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

  if (callerRole !== "superadmin") {
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
