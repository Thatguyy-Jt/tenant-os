import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { LandingPage } from "@/components/landing/LandingPage";
import { PageLoader } from "@/components/PageLoader";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";

const StaffModule = lazy(() => import("@/routes/StaffModule"));
const TenantModule = lazy(() => import("@/routes/TenantModule"));

function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/tenant/accept" element={<AcceptInvitationPage />} />

        <Route
          path="/staff/*"
          element={
            <Suspense fallback={<PageLoader />}>
              <StaffModule />
            </Suspense>
          }
        />

        <Route
          path="/tenant/*"
          element={
            <Suspense fallback={<PageLoader />}>
              <TenantModule />
            </Suspense>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
