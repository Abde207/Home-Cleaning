import { backendForAdmin } from './session';
export { queryString } from './query';

export type AdminDashboard = {
  generatedAt: string;
  range: { from: string; to: string };
  bookingsByStatus: { status: string; count: number }[];
  assignmentsByStatus: { status: string; count: number }[];
  attention: { noTeamAvailable: number; rejected: number; teamNoShow: number; paymentReconciliation: number; refundPending: number };
  finance: { paymentPending: number; paymentFailed: number; cashExpected: number; cashCollectedUnreconciled: number; settlementsReadyForReview: number; settlementDiscrepancies: number };
  providers: { companiesByStatus: { status: string; count: number }[]; teamsByStatus: { status: string; count: number }[]; staleTeamLocations: number };
  notifications: { pending: number; failed: number };
  recentDispatchAttempts: { id: string; bookingId: string; bookingNumber: string; sequence: number; outcome: string; reason: string | null; createdAt: string }[];
};

export type AdminBookingSummary = {
  id: string;
  bookingNumber: string;
  status: string;
  paymentMethod: string | null;
  price: string;
  currency: string;
  scheduledAt: string;
  estimatedEndAt: string;
  createdAt: string;
  customer: { id: string; name: string | null; phone: string; status: string };
  service: { id: string; name: string; nameAr: string };
  currentAssignment: { id: string; status: string; expiresAt: string; company: { id: string; name: string }; team: { id: string; name: string } } | null;
  payment: { id: string; method: string; status: string } | null;
};

export type BookingDetail = {
  id: string;
  bookingNumber: string;
  status: string;
  paymentMethod: string | null;
  price: string;
  currency: string;
  scheduledAt: string;
  estimatedEndAt: string;
  createdAt: string;
  updatedAt: string;
  customerId: string;
  serviceId: string;
  propertyId: string;
  addressId: string;
  version: number;
  history: { id: string; previousStatus: string | null; newStatus: string; changedByUserId: string | null; changedByRole: string | null; reason: string | null; metadata: unknown; createdAt: string }[];
  assignments: { id: string; companyId: string; teamId: string; status: string; startsAt: string; endsAt: string; assignedAt: string; expiresAt: string; acceptedAt: string | null; reason: string | null }[];
};

export type AdminBookingDetail = {
  id: string;
  bookingNumber: string;
  customerId: string;
  serviceId: string;
  propertyId: string;
  addressId: string;
  status: string;
  paymentMethod: string | null;
  price: string;
  currency: string;
  scheduledAt: string;
  estimatedEndAt: string;
  instructions: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  addressSnapshot: unknown;
  propertySnapshot: unknown;
  serviceSnapshot: unknown;
  locationLatitude: string;
  locationLongitude: string;
  customer: { id: string; userId: string; name: string | null; phone: string; status: string };
  service: { id: string; name: string; nameAr: string };
  extras: { id: string; serviceExtraId: string | null; name: string; quantity: number; price: string }[];
  priceSnapshot: { pricingVersion: string; basePrice: string; extrasTotal: string; adjustments: string; fees: string; discount: string; total: string; currency: string; breakdown: unknown } | null;
  history: { id: string; previousStatus: string | null; newStatus: string; changedByUserId: string | null; changedByRole: string | null; reason: string | null; metadata: unknown; createdAt: string }[];
  assignments: {
    id: string; companyId: string; teamId: string; status: string; startsAt: string; endsAt: string; assignedAt: string; expiresAt: string; acceptedAt: string | null; reason: string | null;
    company: { id: string; name: string; status: string }; team: { id: string; name: string; status: string; active: boolean };
    events: { id: string; type: string; metadata: unknown; createdAt: string }[];
    proofs: { id: string; storageKey: string; mimeType: string; byteSize: number; createdAt: string }[];
  }[];
  dispatchAttempts: { id: string; sequence: number; outcome: string; reason: string | null; candidates: unknown; createdAt: string }[];
  payments: {
    id: string; method: string; status: string; amount: string; currency: string; provider: string | null; transactionReference: string | null; createdAt: string; updatedAt: string;
    transactions: { id: string; type: string; amount: string; reference: string | null; createdAt: string }[];
    refunds: { id: string; amount: string; status: string; reference: string | null; reason: string | null; createdAt: string; updatedAt: string }[];
    cashCollection: { id: string; amount: string; collectedByUserId: string; collectedAt: string; reconciledAt: string | null; collectorCompanyId: string | null; collectorTeamId: string | null } | null;
  }[];
};

export type DispatchMonitoring = {
  bookings: { status: string; _count: { _all: number } }[];
  assignments: { status: string; _count: { _all: number } }[];
  recentAttempts: { id: string; bookingId: string; sequence: number; outcome: string; reason: string | null; createdAt: string }[];
};

export type AdminUserSummary = { id: string; name: string | null; phone: string; status: string };
export type RoleGrant = { id: string; role: string; companyId: string | null; teamId: string | null };
export type AdminCustomerSummary = { id: string; userId: string; name: string | null; phone: string; locale: string; status: string; createdAt: string; bookingCount: number; lastBookingAt: string | null };
export type AdminCustomerDetail = AdminCustomerSummary & {
  counts: { addresses: number; properties: number; bookings: number };
  recentBookings: { id: string; bookingNumber: string; status: string; paymentMethod: string | null; price: string; currency: string; scheduledAt: string; estimatedEndAt: string; createdAt: string }[];
};
export type AuditSummary = { id: string; actor: { id: string; name: string | null; phone: string; status: string } | null; action: string; resourceType: string; resourceId: string; reason: string | null; requestId: string | null; createdAt: string };
export type AuditDetail = AuditSummary & { before: unknown; after: unknown };

export type AdminCompany = { id: string; internalCode: string; name: string; status: string; commissionRate: string };
export type AdminCompanyDetail = AdminCompany & { createdAt: string; updatedAt: string; counts: { teams: number; activeTeams: number; activeManagers: number; openAssignments: number; unsettledPayables: number }; serviceAreas: { id: string; name: string; latitude: string; longitude: string; radiusKm: string; active: boolean }[] };
export type AdminTeam = { id: string; companyId: string; internalCode: string; name: string; status: string; capacity: number; active: boolean };
export type AdminTeamDetail = AdminTeam & { latitude: string | null; longitude: string | null; locationAt: string | null; updatedAt: string; company: { id: string; name: string; status: string } };
export type TeamMember = { id: string; name: string; role: string };
export type TeamAvailability = { id: string; startsAt: string; endsAt: string; available: boolean };
export type AdminService = { id: string; code: string; name: string; nameAr: string; description: string | null; active: boolean; basePrice: string; durationMinutes: number };
export type AdminExtra = { id: string; code: string; name: string; nameAr: string; price: string; active: boolean };
export type PricingRule = { id: string; name: string; version: number; definition: Record<string, unknown>; active: boolean; startsAt: string; endsAt: string | null; createdAt: string };
export type Promotion = { id: string; code: string; discount: string; minTotal: string; maxUses: number | null; uses: number; active: boolean; startsAt: string; endsAt: string; };

export type AdminPaymentSummary = {
  id: string; booking: { id: string; bookingNumber: string; status: string; scheduledAt: string }; customer: { id: string; name: string | null; phone: string };
  method: string; status: string; amount: string; currency: string; provider: string | null; transactionReference: string | null; refundTotal: string; cashCollection: { id: string; amount: string; collectedAt: string; reconciledAt: string | null; collectorCompanyId: string | null; collectorTeamId: string | null } | null; createdAt: string; updatedAt: string;
};
export type AdminPaymentDetail = AdminPaymentSummary & {
  booking: AdminPaymentSummary['booking'] & { estimatedEndAt: string; customer: AdminPaymentSummary['customer']; service: { name: string | null; nameAr: string | null } | null; history: { id: string; previousStatus: string | null; newStatus: string; reason: string | null; createdAt: string }[]; assignments: { id: string; status: string; assignedAt: string; acceptedAt: string | null; company: { id: string; name: string }; team: { id: string; name: string } }[] };
  attempts: { id: string; provider: string; attemptNumber: number; status: string; providerReference: string | null; amount: string; currency: string; failureCode: string | null; failureMessage: string | null; createdAt: string; updatedAt: string }[];
  statusHistory: { id: string; previousStatus: string | null; newStatus: string; reason: string | null; provider: string | null; eventId: string | null; changedByUserId: string | null; createdAt: string }[];
  transactions: { id: string; type: string; amount: string; reference: string; createdAt: string }[];
  events: { id: string; provider: string; eventId: string; type: string; signatureVerified: boolean; verifiedAt: string | null; createdAt: string }[];
  refunds: { id: string; amount: string; status: string; provider: string | null; reference: string | null; reason: string; failureCode: string | null; createdAt: string; updatedAt: string; history: { id: string; previousStatus: string | null; newStatus: string; provider: string | null; reference: string | null; reason: string | null; createdAt: string }[] }[];
  cashCollection: { id: string; amount: string; collectedByUserId: string; collectorCompanyId: string | null; collectorTeamId: string | null; collectedAt: string; reconciledAt: string | null; collectedBy: { id: string; name: string | null }; collectorCompany: { id: string; name: string } | null; collectorTeam: { id: string; name: string } | null } | null;
  cashState: string | null; settlementAllocations: { id: string; amount: string; refundedAmount: string; allocatedAt: string; settlement: { id: string; reference: string; status: string; companyId: string } }[];
};
export type AdminRefund = { id: string; paymentId: string; amount: string; status: string; provider: string | null; reference: string | null; reason: string; failureCode: string | null; createdAt: string; updatedAt: string; booking: { id: string; bookingNumber: string; status: string; scheduledAt: string }; customer: { id: string; name: string | null; phone: string } };
export type AdminCashItem = { paymentId: string; booking: { id: string; bookingNumber: string; status: string; scheduledAt: string; customer: { id: string; name: string | null; phone: string } }; expectedAmount: string; currency: string; state: string; assignment: { id: string; status: string; company: { id: string; name: string }; team: { id: string; name: string } } | null; collection: { id: string; amount: string; collectedByUserId: string; collectedAt: string; reconciledAt: string | null } | null; exceptionCodes: string[] };
export type AdminSettlement = { id: string; companyId: string; reference: string; status: string; periodStart: string; periodEnd: string; total: string; currency: string; version: number; createdAt: string; updatedAt: string; company: { id: string; name: string; status: string }; paidAmount: string; payoutDirection: string; latestReconciliation: { status: string; difference: string; createdAt: string } | null; itemCount: number; allocationCount: number };
export type AdminSettlementDetail = AdminSettlement & { items: { id: string; amount: string; payable: { id: string; customerAmount: string; commissionRate: string; platformCommission: string; providerAmount: string; cashCollected: string; netPayable: string; grossAmount: string | null; refundedAmount: string | null; netCustomerAmount: string | null; onlineCollected: string | null; calculatedAt: string | null; booking: { id: string; bookingNumber: string; status: string; scheduledAt: string; customer: { id: string; name: string | null; phone: string }; service: { name: string | null; nameAr: string | null } | null; assignments: { id: string; status: string; company: { id: string; name: string }; team: { id: string; name: string } }[] } }; allocations: { id: string; paymentId: string; amount: string; refundedAmount: string; allocatedAt: string }[] }[]; payments: { id: string; amount: string; direction: string; reference: string; paidAt: string; createdAt: string }[]; allocations: { id: string; settlementItemId: string; paymentId: string; amount: string; refundedAmount: string; allocatedAt: string }[]; reconciliations: { id: string; runNumber: number; status: string; expectedCustomerTotal: string; allocatedPaymentTotal: string; refundTotal: string; payoutTotal: string; difference: string; details: unknown; reconciledByUserId: string | null; createdAt: string }[]; history: { id: string; previousStatus: string | null; newStatus: string; reason: string | null; changedByUserId: string | null; createdAt: string }[] };

export type AdminNotificationDelivery = {
  id: string; notificationId: string; status: string; channel: string; attempts: number; lastError: string | null;
  nextAttemptAt: string | null; sentAt: string | null; createdAt: string;
  notification: { type: string; category: string; referenceType: string | null; referenceId: string | null; eventKey: string | null; userId: string; readAt: string | null; deliveredAt: string | null; createdAt: string; booking: { id: string; bookingNumber: string } | null };
};
export type AdminNotificationDeliveryDetail = AdminNotificationDelivery & {
  providerReference: string | null;
  attemptsHistory: { id: string; attemptNumber: number; status: string; providerReference: string | null; error: string | null; createdAt: string }[];
  safePayload: { title?: string; body?: string; data?: { type?: string; eventId?: string; aggregateId?: string } };
};
export type AdminTeamLocation = { id: string; name: string; internalCode: string; status: string; active: boolean; latitude: string | null; longitude: string | null; locationAt: string | null; freshness: 'FRESH' | 'STALE' | 'NEVER_REPORTED'; company: { id: string; name: string; status: string } };
export type AdminServiceArea = { id: string; name: string; latitude: string; longitude: string; radiusKm: string; active: boolean; company: { id: string; name: string; status: string } };
export type AdminLocations = { generatedAt: string; locationMaxAgeMinutes: number; teams: AdminTeamLocation[]; serviceAreas: AdminServiceArea[] };

export function adminGet<T>(path: `/${string}`) { return backendForAdmin<T>(path); }
