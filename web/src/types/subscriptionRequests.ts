export type SubscriptionRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export interface SubscriptionApplication {
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  orgName: string;
  groupName: string;
  description: string;
  revision: number;
  status: SubscriptionRequestStatus;
  requestedAt: string | null;
  reviewedAt: string | null;
  reviewReason: string;
  subscriptionId: string | null;
}
