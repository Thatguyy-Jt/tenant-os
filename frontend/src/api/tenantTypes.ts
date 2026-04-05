import type { LeaseDto, PropertyDto, UnitDto } from "@/api/staffTypes";

export type TenantLeaseResponse = {
  lease: LeaseDto;
  unit: UnitDto;
  property: PropertyDto;
};

export type LeaseDocumentDto = {
  id: string;
  organizationId: string;
  leaseId: string;
  uploadedBy: string;
  label: string;
  cloudinaryUrl: string;
  originalFileName: string;
  createdAt: string;
  updatedAt: string;
};

export type PaystackInitializeResponse = {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
};
