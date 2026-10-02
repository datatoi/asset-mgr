import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  DocumentData,
  Transaction,
  Query,
} from "firebase-admin/firestore";

initializeApp();
setGlobalOptions({region: "europe-west1"});
const db = getFirestore();
db.settings({ignoreUndefinedProperties: true});
type Data = DocumentData;
const now = () => FieldValue.serverTimestamp();
const roles = ["joiner", "user", "admin", "superadmin"];
const activeRoles = ["user", "admin", "superadmin"];
const catalogs = ["categories", "products", "items", "kits"];

/**
 * Validate object payloads before reading any fields.
 * @param {unknown} value Validated operation input.
 * @return {Data} Validated operation result.
 */
function object(value: unknown): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "Expected an object.");
  }
  return value as Data;
}

/**
 * Strings are bounded at the server boundary.
 * @param {unknown} value Validated operation input.
 * @param {string} label Validated operation input.
 * @param {number} max Validated operation input.
 * @param {boolean} empty Validated operation input.
 * @return {string} Validated operation result.
 */
function text(value: unknown, label: string, max = 200, empty = false): string {
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    value.length > max
  ) {
    throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  }
  return value.trim();
}

/**
 * IDs cannot contain path separators or group-map field delimiters.
 * @param {unknown} value Validated operation input.
 * @param {string} label Validated operation input.
 * @return {string} Validated operation result.
 */
function id(value: unknown, label: string): string {
  const result = text(value, label, 128);
  if (!/^[A-Za-z0-9_-]+$/.test(result)) {
    throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  }
  return result;
}

/**
 * Only HTTPS images or a cleared value may be stored.
 * @param {unknown} value Validated operation input.
 * @return {string|null} Validated operation result.
 */
function imageUrl(value: unknown): string | null {
  if (value === null || value === "") return value;
  const result = text(value, "image URL", 2048);
  const localEmulator = process.env.FUNCTIONS_EMULATOR === "true" &&
    /^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(result);
  if (!result.startsWith("https://") && !localEmulator) {
    throw new HttpsError("invalid-argument", "Image URL must use HTTPS.");
  }
  return result;
}

/**
 * Authenticate every operation using the actual callable auth context.
 * @param {CallableRequest} request Validated operation input.
 * @return {string} Validated operation result.
 */
function caller(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }
  object(request.data);
  return request.auth.uid;
}

/**
 * Reject unexpected fields, including client-supplied authority metadata.
 * @param {Data} data Validated operation input.
 * @param {Array<string>} allowed Validated operation input.
 * @return {void} Validated operation result.
 */
function fields(data: Data, allowed: string[]): void {
  if (Object.keys(data).some((key) => !allowed.includes(key))) {
    throw new HttpsError("invalid-argument", "Unexpected fields.");
  }
}

/**
 * Authorization reads participate in transaction conflict detection.
 * @param {Transaction} tx Validated operation input.
 * @param {string} path Validated operation input.
 * @return {Promise<Data>} Validated operation result.
 */
async function read(tx: Transaction, path: string): Promise<Data> {
  const snapshot = await tx.get(db.doc(path));
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Document not found.");
  }
  return snapshot.data() as Data;
}

/**
 * Owner authority and group roles always stay within the same tenant.
 * @param {Transaction} tx Validated operation input.
 * @param {string} uid Validated operation input.
 * @param {string} groupId Validated operation input.
 * @param {Array<string>} allowed Validated operation input.
 * @return {Promise<object>} Validated operation result.
 */
async function scope(
  tx: Transaction,
  uid: string,
  groupId: string,
  allowed: string[] = activeRoles
) {
  const user = await read(tx, `users/${uid}`);
  const group = await read(tx, `groups/${id(groupId, "groupId")}`);
  if (!user.subscriptionId || user.subscriptionId !== group.subscriptionId) {
    throw new HttpsError("permission-denied", "Outside your organization.");
  }
  const subscription = await read(tx, `subscriptions/${group.subscriptionId}`);
  const isOwner = subscription.ownerUserId === uid;
  if (!isOwner && !allowed.includes(user.groups?.[groupId])) {
    throw new HttpsError(
      "permission-denied",
      "Your group role cannot do this."
    );
  }
  return {
    user,
    group,
    subscription,
    isOwner,
    isAdmin:
      isOwner || ["admin", "superadmin"].includes(user.groups?.[groupId]),
  };
}

/**
 * Catalog relationships must point within their tenant and group.
 * @param {Data} data Validated operation input.
 * @param {string} subscriptionId Validated operation input.
 * @param {string} groupId Validated operation input.
 * @return {void} Validated operation result.
 */
function sameScope(data: Data, subscriptionId: string, groupId?: string): void {
  if (
    data.subscriptionId !== subscriptionId ||
    (groupId !== undefined && data.groupId !== groupId)
  ) {
    throw new HttpsError("permission-denied", "Invalid catalog relationship.");
  }
}

/**
 * Holder and owner references must resolve to a real member.
 * @param {Transaction} tx Validated operation input.
 * @param {string} uid Validated operation input.
 * @param {string} subscriptionId Validated operation input.
 * @return {Promise<Data>} Validated operation result.
 */
async function member(tx: Transaction, uid: string, subscriptionId: string) {
  const user = await read(tx, `users/${id(uid, "userId")}`);
  sameScope(user, subscriptionId);
  return user;
}

/**
 * Resolve an item's actual scope rather than trusting a payload.
 * @param {Transaction} tx Validated operation input.
 * @param {string} uid Validated operation input.
 * @param {string} itemId Validated operation input.
 * @return {Promise<object>} Validated operation result.
 */
async function itemScope(tx: Transaction, uid: string, itemId: string) {
  const item = await read(tx, `items/${itemId}`);
  const access = await scope(tx, uid, item.groupId);
  sameScope(item, access.group.subscriptionId, item.groupId);
  return {...access, item};
}

/** Concurrent registration and joining contend on the same user document. */
export const registerSubscription = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["orgName", "groupName"]);
  const name = text(request.data.orgName, "organization name");
  const groupName = text(request.data.groupName, "group name");
  const userRef = db.doc(`users/${uid}`);
  const subRef = db.collection("subscriptions").doc();
  const groupRef = db.collection("groups").doc();
  await db.runTransaction(async (tx) => {
    const existing = (await tx.get(userRef)).data();
    if (existing?.subscriptionId) {
      throw new HttpsError(
        "already-exists",
        "You already belong to an organization."
      );
    }
    tx.create(subRef, {name, ownerUserId: uid, createdAt: now()});
    tx.create(groupRef, {
      subscriptionId: subRef.id,
      name: groupName,
      description: "",
      createdAt: now(),
    });
    tx.set(userRef, {
      name: existing?.name || request.auth?.token.name || "Member",
      email: request.auth?.token.email || "",
      avatarUrl: existing?.avatarUrl || request.auth?.token.picture || null,
      subscriptionId: subRef.id,
      groups: {[groupRef.id]: "superadmin"},
      sizes: {},
      createdAt: existing?.createdAt || now(),
    });
  });
  return {subscriptionId: subRef.id, groupId: groupRef.id};
});

/** Invitation joining checks and sets membership atomically. */
export const joinSubscription = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["subscriptionId"]);
  const subscriptionId = id(request.data.subscriptionId, "subscriptionId");
  return db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const existing = (await tx.get(userRef)).data();
    if (existing?.subscriptionId) {
      throw new HttpsError(
        "already-exists",
        "You already belong to an organization."
      );
    }
    const sub = await read(tx, `subscriptions/${subscriptionId}`);
    const groups = await tx.get(
      db.collection("groups").where("subscriptionId", "==", subscriptionId)
    );
    if (groups.empty || groups.size > 100) {
      throw new HttpsError(
        "failed-precondition",
        "This organization cannot accept members."
      );
    }
    tx.set(userRef, {
      subscriptionId,
      name: existing?.name || request.auth?.token.name || "Member",
      email: request.auth?.token.email || "",
      avatarUrl: existing?.avatarUrl || request.auth?.token.picture || null,
      groups: Object.fromEntries(groups.docs.map((g) => [g.id, "joiner"])),
      sizes: {},
      createdAt: existing?.createdAt || now(),
    });
    return {
      subscriptionId,
      subscriptionName: sub.name,
      groupCount: groups.size,
    };
  });
});

/** Owners and existing superadmins can create groups within their tenant. */
export const createGroup = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["name", "description"]);
  const name = text(request.data.name, "group name");
  const description = text(
    request.data.description ?? "",
    "description",
    2000,
    true
  );
  const ref = db.collection("groups").doc();
  await db.runTransaction(async (tx) => {
    const user = await read(tx, `users/${uid}`);
    const subscriptionId = id(user.subscriptionId, "subscriptionId");
    const sub = await read(tx, `subscriptions/${subscriptionId}`);
    const groups = await tx.get(
      db.collection("groups").where("subscriptionId", "==", subscriptionId)
    );
    if (
      sub.ownerUserId !== uid &&
      !groups.docs.some((g) => user.groups?.[g.id] === "superadmin")
    ) {
      throw new HttpsError(
        "permission-denied",
        "Only owners or superadmins can create groups."
      );
    }
    if (groups.size >= 100) {
      throw new HttpsError("resource-exhausted", "Maximum 100 groups.");
    }
    tx.create(ref, {subscriptionId, name, description, createdAt: now()});
    tx.update(db.doc(`users/${uid}`), {[`groups.${ref.id}`]: "superadmin"});
  });
  return {groupId: ref.id};
});

/**
 * Validate every profile field and every dynamic size entry.
 * @param {Data} data Validated operation input.
 * @return {Data} Validated operation result.
 */
function profile(data: Data): Data {
  fields(data, ["name", "avatarUrl", "gender", "sizes"]);
  const result: Data = {};
  if ("name" in data) result.name = text(data.name, "name");
  if ("avatarUrl" in data) result.avatarUrl = imageUrl(data.avatarUrl);
  if ("gender" in data) {
    if (!["male", "female"].includes(data.gender)) {
      throw new HttpsError("invalid-argument", "Choose male or female.");
    }
    result.gender = data.gender;
  }
  if ("sizes" in data) {
    const sizes = object(data.sizes);
    if (Object.keys(sizes).length > 200) {
      throw new HttpsError("invalid-argument", "Too many sizes.");
    }
    result.sizes = Object.fromEntries(
      Object.entries(sizes).map(([key, value]) => [
        id(key, "categoryId"),
        text(value, "size", 50, true),
      ])
    );
  }
  return result;
}

/** Self profile edits never accept role or subscription fields. */
export const updateProfile = onCall(async (request) => {
  const uid = caller(request);
  const data = profile(request.data);
  await db.runTransaction(async (tx) => {
    await read(tx, `users/${uid}`);
    tx.update(db.doc(`users/${uid}`), {...data, updatedAt: now()});
  });
  return {success: true};
});

/** Admin profile edits cannot change authority or edit superiors. */
export const updateMember = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["targetUid", "groupId", "profile"]);
  const targetUid = id(request.data.targetUid, "targetUid");
  const groupId = id(request.data.groupId, "groupId");
  const data = profile(object(request.data.profile));
  await db.runTransaction(async (tx) => {
    const access = await scope(tx, uid, groupId, ["admin", "superadmin"]);
    const target = await member(tx, targetUid, access.group.subscriptionId);
    if (
      !target.groups?.[groupId] ||
      (targetUid !== uid &&
        !access.isOwner &&
        (targetUid === access.subscription.ownerUserId ||
          target.groups[groupId] === "superadmin" ||
          (access.user.groups[groupId] === "admin" &&
            target.groups[groupId] === "admin")))
    ) {
      throw new HttpsError("permission-denied", "You cannot edit this member.");
    }
    tx.update(db.doc(`users/${targetUid}`), {...data, updatedAt: now()});
  });
  return {success: true};
});

/** Catalog schemas and every parent relationship are validated server-side. */
export const saveCatalog = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["collection", "id", "values"]);
  const collection = text(request.data.collection, "collection");
  if (!catalogs.includes(collection)) {
    throw new HttpsError("invalid-argument", "Invalid collection.");
  }
  const values = object(request.data.values);
  const allowed: Record<string, string[]> = {
    categories: ["groupId", "name", "gender"],
    products: ["groupId", "categoryId", "name", "gender", "imageUrl"],
    items: [
      "groupId",
      "productId",
      "size",
      "gender",
      "condition",
      "imageUrl",
      "rfidTag",
      "description",
      "ownerId",
    ],
    kits: ["groupId", "name", "gender", "productIds", "description"],
  };
  fields(values, allowed[collection]);
  const editing = request.data.id !== undefined;
  const ref = editing ?
    db.doc(`${collection}/${id(request.data.id, "id")}`) :
    db.collection(collection).doc();
  await db.runTransaction(async (tx) => {
    const old = editing ? await read(tx, ref.path) : {};
    const data: Data = {...old, ...values};
    const groupId = id(data.groupId, "groupId");
    const access = await scope(tx, uid, groupId, ["admin", "superadmin"]);
    const subscriptionId = access.group.subscriptionId;
    if (editing) {
      sameScope(old, subscriptionId);
      if (old.groupId) sameScope(old, subscriptionId, groupId);
      else if (!access.isOwner) {
        throw new HttpsError(
          "permission-denied",
          "Only the owner can assign a legacy record's group."
        );
      }
    }
    const cleaned: Data = {subscriptionId, groupId};
    if (collection !== "items") cleaned.name = text(data.name, "name");
    if (!["male", "female", "unisex"].includes(data.gender)) {
      throw new HttpsError("invalid-argument", "Invalid gender.");
    }
    cleaned.gender = data.gender;
    if (collection === "products") {
      cleaned.categoryId = id(data.categoryId, "categoryId");
      sameScope(
        await read(tx, `categories/${cleaned.categoryId}`),
        subscriptionId,
        groupId
      );
    }
    if (collection === "items") {
      cleaned.productId = id(data.productId, "productId");
      sameScope(
        await read(tx, `products/${cleaned.productId}`),
        subscriptionId,
        groupId
      );
      cleaned.size = text(data.size, "size", 50);
      if (data.condition !== undefined) {
        if (!["new", "good", "worn", "damaged"].includes(data.condition)) {
          throw new HttpsError("invalid-argument", "Invalid condition.");
        }
        cleaned.condition = data.condition;
      }
      if (data.rfidTag !== undefined) {
        cleaned.rfidTag = text(data.rfidTag, "RFID tag", 128, true);
      }
      if (data.ownerId != null) {
        cleaned.ownerId = id(data.ownerId, "ownerId");
        await member(tx, cleaned.ownerId, subscriptionId);
      } else if ("ownerId" in data) cleaned.ownerId = null;
    }
    if (collection === "kits") {
      if (
        !Array.isArray(data.productIds) ||
        !data.productIds.length ||
        data.productIds.length > 30 ||
        new Set(data.productIds).size !== data.productIds.length
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Choose 1–30 distinct products."
        );
      }
      cleaned.productIds = data.productIds.map((p: unknown) =>
        id(p, "productId")
      );
      for (const productId of cleaned.productIds) {
        sameScope(
          await read(tx, `products/${productId}`),
          subscriptionId,
          groupId
        );
      }
    }
    if (data.imageUrl !== undefined) cleaned.imageUrl = imageUrl(data.imageUrl);
    if (data.description !== undefined) {
      cleaned.description = text(data.description, "description", 2000, true);
    }
    if (editing) tx.update(ref, {...cleaned, updatedAt: now()});
    else {
      tx.create(ref, {
        ...cleaned,
        createdAt: now(),
        updatedAt: now(),
        ...(collection === "items" ?
          {holderId: "storage", holderVersion: 0} :
          {}),
      });
    }
  });
  return {id: ref.id};
});

/** Reject deletion while records are referenced or garments are checked out. */
export const deleteCatalog = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["collection", "id"]);
  const collection = text(request.data.collection, "collection");
  const documentId = id(request.data.id, "id");
  if (!catalogs.includes(collection)) {
    throw new HttpsError("invalid-argument", "Invalid collection.");
  }
  const ref = db.doc(`${collection}/${documentId}`);
  await db.runTransaction(async (tx) => {
    const data = await read(tx, ref.path);
    const access = await scope(tx, uid, data.groupId, ["admin", "superadmin"]);
    sameScope(data, access.group.subscriptionId, data.groupId);
    const checks: Query[] = [];
    if (collection === "categories") {
      checks.push(
        db.collection("products").where("categoryId", "==", documentId)
      );
    }
    if (collection === "products") {
      checks.push(db.collection("items").where("productId", "==", documentId));
      checks.push(
        db.collection("kits").where("productIds", "array-contains", documentId)
      );
    }
    if (["items", "kits"].includes(collection)) {
      checks.push(
        db
          .collection("transfers")
          .where(collection === "items" ? "itemId" : "kitId", "==", documentId)
          .where("status", "==", "pending")
      );
    }
    for (const check of checks) {
      if (!(await tx.get(check.limit(1))).empty) {
        throw new HttpsError(
          "failed-precondition",
          "Remove references or close pending transfers before deleting."
        );
      }
    }
    if (collection === "items" && data.holderId !== "storage") {
      throw new HttpsError(
        "failed-precondition",
        "Return this item to storage before deleting it."
      );
    }
    tx.delete(ref);
  });
  if (collection === "items") await db.recursiveDelete(ref);
  return {success: true};
});

/** Persist genuine requests/offers, binding authority to actual item state. */
export const createTransfer = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["itemId", "targetUserId"]);
  const itemId = id(request.data.itemId, "itemId");
  const targetUserId =
    request.data.targetUserId === undefined ?
      undefined :
      id(request.data.targetUserId, "targetUserId");
  const ref = db.collection("transfers").doc();
  await db.runTransaction(async (tx) => {
    const {item, group} = await itemScope(tx, uid, itemId);
    if (targetUserId) {
      if (item.holderId !== uid && item.ownerId !== uid) {
        throw new HttpsError(
          "permission-denied",
          "Only the holder or owner can offer this item."
        );
      }
      if (targetUserId === item.holderId) {
        throw new HttpsError(
          "failed-precondition",
          "This person already holds the item."
        );
      }
      await member(tx, targetUserId, group.subscriptionId);
    } else if (item.holderId === uid) {
      throw new HttpsError(
        "failed-precondition",
        "You already hold this item."
      );
    }
    const existing = await tx.get(
      db
        .collection("transfers")
        .where("itemId", "==", itemId)
        .where("requestedByUserId", "==", uid)
        .where("status", "==", "pending")
    );
    if (
      existing.docs.some(
        (d) => (d.data().targetUserId || null) === (targetUserId || null)
      )
    ) {
      throw new HttpsError(
        "already-exists",
        "You already have a pending request for this item."
      );
    }
    tx.create(ref, {
      subscriptionId: group.subscriptionId,
      groupId: item.groupId,
      itemId,
      requestedByUserId: uid,
      currentHolderId: item.holderId,
      targetUserId: targetUserId || null,
      status: "pending",
      requestedAt: now(),
      holderVersion: item.holderVersion || 0,
      schemaVersion: 2,
    });
  });
  return {transferId: ref.id};
});

/** First valid approval wins; stale/replayed requests cannot move the item. */
export const transferItem = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["itemId", "newHolderId", "transferType", "transferId"]);
  const itemId = id(request.data.itemId, "itemId");
  const transferId =
    request.data.transferId === undefined ?
      undefined :
      id(request.data.transferId, "transferId");
  return db.runTransaction(async (tx) => {
    const {item, group, isAdmin} = await itemScope(tx, uid, itemId);
    let newHolderId: string;
    let transfer: Data | undefined;
    if (transferId) {
      transfer = await read(tx, `transfers/${transferId}`);
      sameScope(transfer, group.subscriptionId, item.groupId);
      if (transfer.itemId !== itemId || transfer.status !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          "This request is no longer pending for this item."
        );
      }
      if (transfer.schemaVersion !== 2) {
        throw new HttpsError(
          "failed-precondition",
          "Cancel this old request and create it again."
        );
      }
      if (
        transfer.currentHolderId !== item.holderId ||
        transfer.holderVersion !== (item.holderVersion || 0)
      ) {
        throw new HttpsError(
          "failed-precondition",
          "The item changed holders. Create a new request."
        );
      }
      const canAccept = transfer.targetUserId ?
        transfer.targetUserId === uid :
        item.holderId === uid;
      if (!isAdmin && !canAccept) {
        throw new HttpsError(
          "permission-denied",
          "You cannot approve this request."
        );
      }
      newHolderId = id(
        transfer.targetUserId || transfer.requestedByUserId,
        "recipient"
      );
      if (
        request.data.newHolderId !== undefined &&
        request.data.newHolderId !== newHolderId
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Recipient does not match this request."
        );
      }
    } else {
      newHolderId = id(request.data.newHolderId, "newHolderId");
      if (!isAdmin && !(item.holderId === uid && newHolderId === "storage")) {
        throw new HttpsError(
          "permission-denied",
          "Send an offer for the recipient to accept."
        );
      }
    }
    if (newHolderId !== "storage") {
      await member(tx, newHolderId, group.subscriptionId);
    }
    if (newHolderId === item.holderId) {
      throw new HttpsError(
        "failed-precondition",
        "This person already holds the item."
      );
    }
    const pending = await tx.get(
      db
        .collection("transfers")
        .where("itemId", "==", itemId)
        .where("status", "==", "pending")
    );
    if (pending.size > 400) {
      throw new HttpsError(
        "resource-exhausted",
        "Close pending requests first."
      );
    }
    tx.update(db.doc(`items/${itemId}`), {
      holderId: newHolderId,
      holderVersion: (item.holderVersion || 0) + 1,
      updatedAt: now(),
    });
    tx.create(db.collection(`items/${itemId}/holderHistory`).doc(), {
      previousHolderId: item.holderId,
      newHolderId,
      transferDate: now(),
      initiatedByUserId: uid,
      transferType: transfer ? "request" : isAdmin ? "admin" : "return",
      subscriptionId: group.subscriptionId,
      groupId: item.groupId,
    });
    for (const record of pending.docs) {
      tx.update(
        record.ref,
        record.id === transferId ?
          {
            status: "transferred",
            approvedAt: now(),
            transferredAt: now(),
          } :
          {
            status: "declined",
            declinedAt: now(),
            declineReason: "holder-changed",
          }
      );
    }
    return {success: true};
  });
});

/** Validate actual participants and scope for declines and cancellations. */
export const declineTransfer = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["transferId"]);
  const transferId = id(request.data.transferId, "transferId");
  await db.runTransaction(async (tx) => {
    const transfer = await read(tx, `transfers/${transferId}`);
    const user = await read(tx, `users/${uid}`);
    sameScope(transfer, user.subscriptionId);
    const subscription = await read(
      tx,
      `subscriptions/${id(transfer.subscriptionId, "subscriptionId")}`
    );
    const access =
      subscription.ownerUserId === uid ?
        {isAdmin: true} :
        await scope(tx, uid, transfer.groupId);
    if (
      !access.isAdmin &&
      ![
        transfer.requestedByUserId,
        transfer.currentHolderId,
        transfer.targetUserId,
      ].includes(uid)
    ) {
      throw new HttpsError(
        "permission-denied",
        "You cannot decline this request."
      );
    }
    if (transfer.status !== "pending") {
      throw new HttpsError("failed-precondition", "This request is closed.");
    }
    tx.update(db.doc(`transfers/${transferId}`), {
      status: "declined",
      declinedAt: now(),
      declineReason:
        uid === transfer.requestedByUserId ? "cancelled" : "declined",
    });
  });
  return {success: true};
});

/** Products can appear in many kits; pending requests do not reserve items. */
export const requestKit = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["kitId"]);
  const kitId = id(request.data.kitId, "kitId");
  return db.runTransaction(async (tx) => {
    const kit = await read(tx, `kits/${kitId}`);
    const {user, group} = await scope(tx, uid, kit.groupId);
    sameScope(kit, group.subscriptionId, kit.groupId);
    if (!["male", "female"].includes(user.gender)) {
      throw new HttpsError(
        "failed-precondition",
        "Set your gender in Profile first."
      );
    }
    if (kit.gender !== "unisex" && kit.gender !== user.gender) {
      throw new HttpsError(
        "failed-precondition",
        "This kit does not match your gender."
      );
    }
    if (
      !Array.isArray(kit.productIds) ||
      !kit.productIds.length ||
      kit.productIds.length > 30 ||
      new Set(kit.productIds).size !== kit.productIds.length
    ) {
      throw new HttpsError("failed-precondition", "Invalid kit definition.");
    }
    const existing = await tx.get(
      db
        .collection("transfers")
        .where("kitId", "==", kitId)
        .where("requestedByUserId", "==", uid)
        .where("status", "==", "pending")
    );
    if (!existing.empty) {
      throw new HttpsError("already-exists", "You already requested this kit.");
    }
    const selected: {itemId: string; version: number}[] = [];
    for (const productId of kit.productIds) {
      const product = await read(tx, `products/${id(productId, "productId")}`);
      sameScope(product, group.subscriptionId, kit.groupId);
      const category = await read(
        tx,
        `categories/${id(product.categoryId, "categoryId")}`
      );
      sameScope(category, group.subscriptionId, kit.groupId);
      const size = user.sizes?.[product.categoryId];
      if (!size) {
        throw new HttpsError(
          "failed-precondition",
          `Set your size for ${category.name} in Profile.`
        );
      }
      const items = await tx.get(
        db
          .collection("items")
          .where("subscriptionId", "==", group.subscriptionId)
          .where("groupId", "==", kit.groupId)
          .where("productId", "==", productId)
          .where("holderId", "==", "storage")
          .where("size", "==", size)
          .where("gender", "in", [user.gender, "unisex"])
      );
      const chosen = items.docs.find((d) => d.data().condition !== "damaged");
      if (!chosen) {
        throw new HttpsError(
          "failed-precondition",
          `No available ${product.name} in size ${size}.`
        );
      }
      selected.push({
        itemId: chosen.id,
        version: chosen.data().holderVersion || 0,
      });
    }
    const transferIds: string[] = [];
    for (const item of selected) {
      const ref = db.collection("transfers").doc();
      tx.create(ref, {
        subscriptionId: group.subscriptionId,
        groupId: kit.groupId,
        itemId: item.itemId,
        kitId,
        requestedByUserId: uid,
        currentHolderId: "storage",
        targetUserId: null,
        holderVersion: item.version,
        schemaVersion: 2,
        status: "pending",
        requestedAt: now(),
      });
      transferIds.push(ref.id);
    }
    return {success: true, transferIds};
  });
});

/** Roles stay in one tenant, accept only the enum, and retain a superadmin. */
export const assignRole = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["targetUid", "groupId", "role"]);
  const targetUid = id(request.data.targetUid, "targetUid");
  const groupId = id(request.data.groupId, "groupId");
  const role = request.data.role;
  if (role !== null && !roles.includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.");
  }
  await db.runTransaction(async (tx) => {
    const access = await scope(tx, uid, groupId, ["superadmin"]);
    const target = await member(tx, targetUid, access.group.subscriptionId);
    if (!access.isOwner && targetUid === access.subscription.ownerUserId) {
      throw new HttpsError(
        "permission-denied",
        "Only the owner can change their own roles."
      );
    }
    if (target.groups?.[groupId] === "superadmin" && role !== "superadmin") {
      const admins = await tx.get(
        db
          .collection("users")
          .where("subscriptionId", "==", access.group.subscriptionId)
          .where(`groups.${groupId}`, "==", "superadmin")
      );
      if (admins.size <= 1) {
        throw new HttpsError(
          "failed-precondition",
          "Promote another superadmin first."
        );
      }
    }
    tx.update(db.doc(`users/${targetUid}`), {
      [`groups.${groupId}`]: role === null ? FieldValue.delete() : role,
    });
  });
  return {success: true};
});

/** Author identity comes from the saved profile, not a supplied user ID. */
export const addComment = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["itemId", "text"]);
  const itemId = id(request.data.itemId, "itemId");
  const comment = text(request.data.text, "comment", 2000);
  await db.runTransaction(async (tx) => {
    const {user} = await itemScope(tx, uid, itemId);
    tx.create(db.collection(`items/${itemId}/comments`).doc(), {
      userId: uid,
      userName: user.name || "Member",
      avatarUrl: user.avatarUrl || null,
      text: comment,
      timestamp: now(),
    });
  });
  return {success: true};
});

/** Group metadata edits cannot change its tenant. */
export const updateGroup = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["groupId", "name", "description"]);
  const groupId = id(request.data.groupId, "groupId");
  const name = text(request.data.name, "name");
  const description = text(
    request.data.description ?? "",
    "description",
    2000,
    true
  );
  await db.runTransaction(async (tx) => {
    await scope(tx, uid, groupId, ["superadmin"]);
    tx.update(db.doc(`groups/${groupId}`), {
      name,
      description,
      updatedAt: now(),
    });
  });
  return {success: true};
});

/** Delete empty groups and their role-map entries atomically. */
export const deleteGroup = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["groupId"]);
  const groupId = id(request.data.groupId, "groupId");
  await db.runTransaction(async (tx) => {
    const {group} = await scope(tx, uid, groupId, ["superadmin"]);
    const groups = await tx.get(
      db
        .collection("groups")
        .where("subscriptionId", "==", group.subscriptionId)
    );
    if (groups.size <= 1) {
      throw new HttpsError("failed-precondition", "Keep at least one group.");
    }
    for (const collection of [...catalogs, "transfers"]) {
      let q = db.collection(collection).where("groupId", "==", groupId);
      if (collection === "transfers") q = q.where("status", "==", "pending");
      if (!(await tx.get(q.limit(1))).empty) {
        throw new HttpsError(
          "failed-precondition",
          "Remove this group's catalog and close its transfers first."
        );
      }
    }
    const members = await tx.get(
      db.collection("users").where("subscriptionId", "==", group.subscriptionId)
    );
    if (members.size > 400) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many members for group deletion."
      );
    }
    tx.delete(db.doc(`groups/${groupId}`));
    for (const user of members.docs) {
      if (user.data().groups?.[groupId]) {
        tx.update(user.ref, {
          [`groups.${groupId}`]: FieldValue.delete(),
        });
      }
    }
  });
  return {success: true};
});

/** Owners can release members after resolving their inventory and requests. */
export const removeMember = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["targetUid"]);
  const targetUid = id(request.data.targetUid, "targetUid");
  await db.runTransaction(async (tx) => {
    const user = await read(tx, `users/${uid}`);
    const subscriptionId = id(user.subscriptionId, "subscriptionId");
    const sub = await read(tx, `subscriptions/${subscriptionId}`);
    if (sub.ownerUserId !== uid || targetUid === uid) {
      throw new HttpsError(
        "permission-denied",
        "Only the owner can remove other members."
      );
    }
    const target = await member(tx, targetUid, subscriptionId);
    for (const field of ["holderId", "ownerId"]) {
      if (
        !(
          await tx.get(
            db
              .collection("items")
              .where("subscriptionId", "==", subscriptionId)
              .where(field, "==", targetUid)
              .limit(1)
          )
        ).empty
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Reassign this member's held and owned items first."
        );
      }
    }
    for (const field of [
      "requestedByUserId",
      "targetUserId",
      "currentHolderId",
    ]) {
      if (
        !(
          await tx.get(
            db
              .collection("transfers")
              .where("subscriptionId", "==", subscriptionId)
              .where(field, "==", targetUid)
              .where("status", "==", "pending")
              .limit(1)
          )
        ).empty
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Close this member's pending transfers first."
        );
      }
    }
    for (const [groupId, role] of Object.entries(target.groups || {})) {
      if (role === "superadmin") {
        const admins = await tx.get(
          db
            .collection("users")
            .where("subscriptionId", "==", subscriptionId)
            .where(`groups.${id(groupId, "groupId")}`, "==", "superadmin")
        );
        if (admins.size <= 1) {
          throw new HttpsError(
            "failed-precondition",
            "Promote another superadmin first."
          );
        }
      }
    }
    tx.update(db.doc(`users/${targetUid}`), {
      subscriptionId: FieldValue.delete(),
      groups: {},
      sizes: {},
      updatedAt: now(),
    });
  });
  return {success: true};
});

/** Mirror owner authority for scoped Storage uploads using two reads. */
export const prepareImageUpload = onCall(async (request) => {
  const uid = caller(request);
  fields(request.data, ["groupId", "kind"]);
  const groupId = id(request.data.groupId, "groupId");
  const kind = request.data.kind;
  if (!["items", "products"].includes(kind)) {
    throw new HttpsError("invalid-argument", "Invalid image kind.");
  }
  return db.runTransaction(async (tx) => {
    const access = await scope(tx, uid, groupId, ["admin", "superadmin"]);
    tx.update(db.doc(`groups/${groupId}`), {
      subscriptionOwnerId: access.subscription.ownerUserId,
    });
    return {
      folder: ["subscriptions", access.group.subscriptionId,
        "groups", groupId, kind].join("/"),
    };
  });
});
