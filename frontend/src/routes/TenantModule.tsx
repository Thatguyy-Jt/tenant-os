import { Navigate, Route, Routes } from "react-router-dom";

import { TenantLayout } from "@/layouts/TenantLayout";
import { TenantDocumentsPage } from "@/pages/tenant/TenantDocumentsPage";
import { TenantHomePage } from "@/pages/tenant/TenantHomePage";
import { TenantMaintenancePage } from "@/pages/tenant/TenantMaintenancePage";
import { TenantPaymentsPage } from "@/pages/tenant/TenantPaymentsPage";
import { RequireTenant } from "@/routes/ProtectedRoutes";

/**
 * Tenant portal routes (lazy-loaded chunk).
 */
export default function TenantModule() {
  return (
    <Routes>
      <Route element={<RequireTenant />}>
        <Route element={<TenantLayout />}>
          <Route index element={<TenantHomePage />} />
          <Route path="payments" element={<TenantPaymentsPage />} />
          <Route path="maintenance" element={<TenantMaintenancePage />} />
          <Route path="documents" element={<TenantDocumentsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/tenant" replace />} />
    </Routes>
  );
}
