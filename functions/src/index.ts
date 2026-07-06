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
 * Joins the caller to an existing Subscription via its invite link
 * (/join/{subscriptionId}), as a plain 'user' in every one of that
 * subscription's groups. Firestore rules block direct client writes to
 * `users.groups`/`subscriptionId` (see firestore.rules), so this - like
 * registerSubscription - must go through the Admin SDK. Rejects if the
 * caller already belongs to a subscription or if the link is invalid.
 */
export const joinSubscription = onCall(async (request) => {
  const {auth} = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {subscriptionId} = request.data;
  if (!subscriptionId) {
    throw new HttpsError("invalid-argument", "Missing subscriptionId.");
  }

  const userRef = db.collection("users").doc(auth.uid);
  const existingUser = await userRef.get();
  if (existingUser.exists && existingUser.data()?.subscriptionId) {
    throw new HttpsError(
      "already-exists",
      "This account already belongs to a subscription."
    );
  }

  const subRef = db.collection("subscriptions").doc(subscriptionId);
  const subDoc = await subRef.get();
  if (!subDoc.exists) {
    throw new HttpsError("not-found", "Invalid or expired invite link.");
  }

  const groupsSnap = await db.collection("groups")
    .where("subscriptionId", "==", subscriptionId)
    .get();
  if (groupsSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "This organization has no groups to join."
    );
  }

  const groups: Record<string, string> = {};
  groupsSnap.docs.forEach((g) => {
    groups[g.id] = "user";
  });

  await userRef.set({
    subscriptionId,
    name: auth.token.name || "Anonymous",
    email: auth.token.email,
    avatarUrl: auth.token.picture || null,
    groups,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  logger.info(`${auth.uid} joined subscription ${subscriptionId} via invite`);

  return {
    subscriptionId,
    subscriptionName: subDoc.data()?.name || "",
    groupCount: groupsSnap.size,
  };
});

/**
 * Creates a new Group within the caller's Subscription (e.g. age divisions
 * like "Seniors"/"Youth"/"Middle-aged"). Firestore rules only let a user
 * write an existing group they're already superadmin of (`hasRole(groupId,
 * ['superadmin'])`), which can never match a brand-new groupId - so creating
 * a group, and granting the creator superadmin of it, must go through the
 * Admin SDK here, same as registerSubscription/joinSubscription.
 */
export const createGroup = onCall(async (request) => {
  const {auth} = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {name, description} = request.data;
  if (!name) {
    throw new HttpsError("invalid-argument", "Missing name.");
  }

  const callerDoc = await db.collection("users").doc(auth.uid).get();
  const callerData = callerDoc.data();
  const subscriptionId = callerData?.subscriptionId;
  if (!subscriptionId) {
    throw new HttpsError(
      "failed-precondition",
      "You must belong to a subscription to create a group."
    );
  }

  const callerGroups: Record<string, string> = callerData?.groups || {};
  const isSuperAdmin = Object.values(callerGroups).some(
    (role) => role === "superadmin"
  );
  if (!isSuperAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Only superadmins can create groups."
    );
  }

  const groupRef = db.collection("groups").doc();
  const batch = db.batch();
  batch.set(groupRef, {
    subscriptionId,
    name,
    description: description || "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.update(callerDoc.ref, {
    [`groups.${groupRef.id}`]: "superadmin",
  });
  await batch.commit();

  logger.info(`Group ${groupRef.id} created by ${auth.uid}`);

  return {groupId: groupRef.id};
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
  // Items aren't actually scoped to a specific group in practice (groupId is
  // never set by any catalog page - see todo.md), so admin status is
  // "admin/superadmin in any of the caller's groups," matching how isAdmin is
  // computed everywhere else in this app (client checks, isAnyAdmin() in
  // firestore.rules) - not a lookup keyed by itemData.groupId, which would
  // always miss since that field doesn't exist on real items.
  const userGroups: Record<string, string> = userData?.groups || {};
  const isAdmin = Object.values(userGroups).some(
    (role) => role === "admin" || role === "superadmin"
  );

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
 * Automatically picks one available item per required product for a kit and
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
  const {productIds, subscriptionId, groupId} = kitData;
  const userGender = userData.gender;
  const userSizes: Record<string, string> = userData.sizes || {};

  const batch = db.batch();
  const requestsCreated: string[] = [];

  for (const productId of productIds) {
    // Sizes are per-category (a shoe size and a dress size aren't the same
    // scale), so first resolve which category this product belongs to.
    const productDoc = await db.collection("products").doc(productId).get();
    if (!productDoc.exists) {
      throw new HttpsError("not-found", `Product ${productId} not found.`);
    }
    const categoryId = productDoc.data()?.categoryId;
    const userSize = userSizes[categoryId];
    if (!userSize) {
      throw new HttpsError(
        "failed-precondition",
        `Set your size for category ${categoryId} in your profile ` +
        "before requesting this kit."
      );
    }

    const itemsQuery = await db.collection("items")
      .where("subscriptionId", "==", subscriptionId)
      .where("productId", "==", productId)
      .where("holderId", "==", "storage")
      .where("size", "==", userSize)
      .where("gender", "==", userGender)
      .get();

    const availableItem = itemsQuery.docs[0];
    if (!availableItem) {
      throw new HttpsError(
        "failed-precondition",
        `No available item for product ${productId} in size ${userSize}`
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
