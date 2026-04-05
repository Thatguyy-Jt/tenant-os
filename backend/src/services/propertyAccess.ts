import mongoose from "mongoose";
import { User, type UserRole } from "../models/User";
import { Unit } from "../models/Unit";
import { httpError } from "../middleware/errorHandler";

export type StaffPropertyScope =
  | { mode: "all" }
  | { mode: "assigned"; propertyIds: mongoose.Types.ObjectId[] };

export async function getStaffPropertyScope(
  userId: string,
  role: UserRole
): Promise<StaffPropertyScope> {
  if (role === "landlord") {
    return { mode: "all" };
  }
  if (role !== "agent") {
    return { mode: "all" };
  }
  const u = await User.findById(userId).select("assignedPropertyIds").lean();
  const ids =
    (u as { assignedPropertyIds?: mongoose.Types.ObjectId[] } | null)?.assignedPropertyIds ?? [];
  return { mode: "assigned", propertyIds: ids };
}

export async function assertPropertyInStaffScope(
  orgId: mongoose.Types.ObjectId,
  propertyId: mongoose.Types.ObjectId,
  scope: StaffPropertyScope
): Promise<void> {
  if (scope.mode === "all") return;
  if (!scope.propertyIds.some((id) => id.equals(propertyId))) {
    throw httpError(403, "Not assigned to this property", "PROPERTY_FORBIDDEN");
  }
}

export async function assertUnitInStaffScope(
  orgId: mongoose.Types.ObjectId,
  unitId: mongoose.Types.ObjectId,
  auth: { userId: string; role: UserRole }
): Promise<void> {
  const unit = await Unit.findOne({ _id: unitId, organizationId: orgId }).lean();
  if (!unit || Array.isArray(unit)) {
    throw httpError(404, "Unit not found", "NOT_FOUND");
  }
  const u = unit as unknown as { propertyId: mongoose.Types.ObjectId };
  const scope = await getStaffPropertyScope(auth.userId, auth.role);
  await assertPropertyInStaffScope(orgId, u.propertyId, scope);
}

function leaseUnitId(lease: { unitId: unknown }): mongoose.Types.ObjectId {
  const u = lease.unitId;
  if (u != null && typeof u === "object" && "_id" in (u as object)) {
    return (u as { _id: mongoose.Types.ObjectId })._id;
  }
  return u as mongoose.Types.ObjectId;
}

export async function assertLeaseInStaffScope(
  orgId: mongoose.Types.ObjectId,
  lease: { unitId: unknown },
  auth: { userId: string; role: UserRole }
): Promise<void> {
  const unit = await Unit.findOne({ _id: leaseUnitId(lease), organizationId: orgId })
    .select("propertyId")
    .lean();
  if (!unit) {
    throw httpError(404, "Unit not found", "NOT_FOUND");
  }
  const scope = await getStaffPropertyScope(auth.userId, auth.role);
  await assertPropertyInStaffScope(
    orgId,
    (unit as unknown as { propertyId: mongoose.Types.ObjectId }).propertyId,
    scope
  );
}


export async function unitIdsInStaffScope(
  orgId: mongoose.Types.ObjectId,
  scope: StaffPropertyScope
): Promise<mongoose.Types.ObjectId[] | null> {
  if (scope.mode === "all") return null;
  if (scope.propertyIds.length === 0) return [];
  const rows = await Unit.find({
    organizationId: orgId,
    propertyId: { $in: scope.propertyIds },
  })
    .select("_id")
    .lean();
  return rows.map((r) => r._id as mongoose.Types.ObjectId);
}

/** Mongo filter for `Property` documents visible to landlord vs agent. */
export function propertyQueryForStaff(
  orgId: mongoose.Types.ObjectId,
  scope: StaffPropertyScope
): Record<string, unknown> {
  const base: Record<string, unknown> = { organizationId: orgId };
  if (scope.mode === "assigned") {
    base._id = { $in: scope.propertyIds };
  }
  return base;
}
