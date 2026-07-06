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
  size?: string
  gender?: Gender
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface AssetClass {
  id: string
  subscriptionId: string
  name: string
}

export interface ItemType {
  id: string
  subscriptionId: string
  classId: string
  name: string
  gender: Gender
  imageUrl?: string
}

export interface Item {
  id: string
  subscriptionId: string
  typeId: string
  size?: string
  gender?: Gender
  condition?: Condition
  imageUrl?: string
  rfidTag?: string
  holderId: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
  // Written by the single-item request flow (ItemDetail) but never actually
  // set on the item itself anywhere - see todo.md for this known gap.
  groupId?: string
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
  name: string
  gender: Gender
  // Concrete ItemTypes this kit requires one of each (e.g. "Red Dress",
  // "Black Shoes") - not the broader AssetClass. A Class is a general
  // category; a Type is the specific product-like variant that's actually
  // checked out.
  typeIds: string[]
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
  status: RequestStatus
  requestedAt?: Timestamp
  declinedAt?: Timestamp
  transferredAt?: Timestamp
}
