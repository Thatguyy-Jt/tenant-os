/** Shapes aligned with backend serializers (Mongo fields as ISO date strings in JSON). */

export type DashboardSummary = {
  occupancy: {
    totalUnits: number;
    occupiedUnits: number;
    occupancyRatePercent: number;
  };
  revenue: {
    total: number;
    from: string;
    to: string;
  };
  overdue: {
    activeLeaseCount: number;
    leasesWithBalanceDue: number;
    totalOutstanding: number;
  };
};

export type PropertyPhotoDto = {
  url: string;
  publicId: string;
};

export type PropertyDto = {
  id: string;
  organizationId: string;
  name: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  country: string;
  postalCode: string | null;
  /** Marketing photos (Cloudinary); max 20 per property. */
  photos: PropertyPhotoDto[];
  createdAt: string;
  updatedAt: string;
};

export type UnitDto = {
  id: string;
  organizationId: string;
  propertyId: string;
  label: string;
  rentAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type LeaseDto = {
  id: string;
  organizationId: string;
  unitId: string;
  tenantUserId: string;
  invitationId: string | null;
  startDate: string;
  endDate: string | null;
  rentAmount: number;
  currency: string;
  billingFrequency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tenantEmail?: string | null;
  unitLabel?: string | null;
};

export type RentPaymentDto = {
  id: string;
  organizationId: string;
  leaseId: string;
  amount: number;
  currency: string;
  paidAt: string;
  method: string;
  recordedBy: string | null;
  notes: string;
  paystackReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaseBalanceDto = {
  leaseId: string;
  asOf: string;
  currency: string;
  expectedTotal: number;
  totalPaid: number;
  balance: number;
  billingFrequency: string;
};

export type InvitationDto = {
  id: string;
  organizationId: string;
  unitId: string;
  email: string;
  expiresAt: string;
  consumedAt: string | null;
  startDate: string;
  endDate: string | null;
  rentAmount: number;
  currency: string;
  billingFrequency: string;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceRequestDto = {
  id: string;
  organizationId: string;
  unitId: string;
  leaseId: string;
  tenantUserId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  photoUrls: string[];
  assignedToUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationDto = {
  id: string;
  organizationId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationDto = {
  id: string;
  name: string;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
};
