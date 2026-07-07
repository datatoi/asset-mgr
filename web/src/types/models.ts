import type { Timestamp } from 'firebase/firestore'

// These interfaces describe the shape of documents *as read* from Firestore
// (after `{ id: doc.id, ...doc.data() }`), where a stored timestamp always
// comes back as a real Timestamp. Write payloads are declared inline at each
// call site (often using serverTimestamp(), which yields a FieldValue
// sentinel) rather than conforming to these interfaces.

export type Role = 'superadmin' | 'admin' | 'user'
export type Gender = 'male' | 'female' | 'unisex'
export type Condition = 'new' | 'good' | 'worn' | 'damaged'
export type TransferType = 'request' | 'admin' | 'scan'
export type RequestStatus = 'pending' | 'approved' | 'declined' | 'transferred'

/** holderId sentinel meaning "not currently checked out / available". See CLAUDE.md. */
export const STORAGE_HOLDER = 'storage'

export interface Subscription {
  id: string
  name: string
  ownerUserId: string
  createdAt?: Timestamp
}

export interface Group {
  id: string
  subscriptionId: string
  name: string
  description?: string
  createdAt?: Timestamp
}

export interface UserProfile {
  id: string
  subscriptionId?: string
  name?: string
  email?: string
  avatarUrl?: string | null
  groups?: Record<string, Role>
  // Per-Category size (categoryId -> size string), not one flat size - a
  // shoe size and a dress size are different scales entirely.
  sizes?: Record<string, string>
  gender?: Gender
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface Category {
  id: string
  subscriptionId: string
  groupId: string
  name: string
}

export interface Product {
  id: string
  subscriptionId: string
  groupId: string
  categoryId: string
  name: string
  gender: Gender
  imageUrl?: string
}

export interface Item {
  id: string
  subscriptionId: string
  groupId: string
  productId: string
  size?: string
  gender?: Gender
  condition?: Condition
  imageUrl?: string
  rfidTag?: string
  description?: string
  holderId: string
  // Long-term assigned person, distinct from holderId (who has it right now).
  // Admin/superadmin-editable directly (no Cloud Function/history - unlike
  // holderId, owner changes aren't audited, by design).
  ownerId?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface ItemComment {
  id: string
  userId: string
  userName?: string
  avatarUrl?: string | null
  text: string
  timestamp?: Timestamp
}

export interface HolderHistoryEntry {
  id: string
  previousHolderId: string
  newHolderId: string
  transferDate?: Timestamp
  initiatedByUserId: string
  transferType: TransferType
  subscriptionId?: string
  groupId?: string
}

export interface Kit {
  id: string
  subscriptionId: string
  groupId: string
  name: string
  gender: Gender
  // Concrete Products this kit requires one of each (e.g. "Red Dress",
  // "Black Shoes") - not the broader Category. A Category is a general
  // grouping; a Product is the specific variant that's actually checked out.
  productIds: string[]
  description?: string
}

export interface TransferRequest {
  id: string
  subscriptionId: string
  groupId?: string
  itemId: string
  kitId?: string
  requestedByUserId: string
  currentHolderId: string
  // Set only for holder/owner-initiated "push" transfers (ItemDetail's
  // "Transfer to..." control): the person being offered the item, who must
  // accept before it moves. Absent for the older "pull" flow, where a
  // non-holder requests the item from whoever currently holds it and
  // `currentHolderId` themselves approves.
  targetUserId?: string
  status: RequestStatus
  requestedAt?: Timestamp
  declinedAt?: Timestamp
  transferredAt?: Timestamp
}
