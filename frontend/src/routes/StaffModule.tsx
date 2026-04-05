import { Navigate, Route, Routes } from "react-router-dom";

import { StaffLayout } from "@/layouts/StaffLayout";
import { InvitationsPage } from "@/pages/staff/InvitationsPage";
import { LeaseDetailPage } from "@/pages/staff/LeaseDetailPage";
import { LeasesListPage } from "@/pages/staff/LeasesListPage";
import { MaintenanceListPage } from "@/pages/staff/MaintenanceListPage";
import { NotificationsPage } from "@/pages/staff/NotificationsPage";
import { OrganizationSettingsPage } from "@/pages/staff/OrganizationSettingsPage";
import { PropertiesListPage } from "@/pages/staff/PropertiesListPage";
import { PropertyDetailPage } from "@/pages/staff/PropertyDetailPage";
import { StaffDashboardPage } from "@/pages/staff/StaffDashboardPage";
import { RequireLandlord, RequireStaff } from "@/routes/ProtectedRoutes";

/**
 * Staff app routes (lazy-loaded chunk).
 */
export default function StaffModule() {
  return (
    <Routes>
      <Route element={<RequireStaff />}>
        <Route element={<StaffLayout />}>
          <Route index element={<StaffDashboardPage />} />
          <Route path="properties" element={<PropertiesListPage />} />
          <Route path="properties/:propertyId" element={<PropertyDetailPage />} />
          <Route path="leases" element={<LeasesListPage />} />
          <Route path="leases/:leaseId" element={<LeaseDetailPage />} />
          <Route path="invitations" element={<InvitationsPage />} />
          <Route path="maintenance" element={<MaintenanceListPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route element={<RequireLandlord />}>
            <Route path="settings" element={<OrganizationSettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/staff" replace />} />
    </Routes>
  );
}
