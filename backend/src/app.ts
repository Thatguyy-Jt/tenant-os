import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { loadEnv } from "./config/env";
import { paystackWebhookRouter } from "./routes/webhooks.paystack.routes";
import { authRouter } from "./routes/auth.routes";
import { propertiesRouter } from "./routes/properties.routes";
import { unitsRouter } from "./routes/units.routes";
import { invitationsRouter } from "./routes/invitations.routes";
import { leasesRouter } from "./routes/leases.routes";
import { tenantRouter } from "./routes/tenant.routes";
import { dashboardRouter } from "./routes/dashboard.routes";
import { maintenanceRouter } from "./routes/maintenance.routes";
import { rentPaymentReceiptRouter } from "./routes/rentPaymentReceipt.routes";
import { notificationsRouter } from "./routes/notifications.routes";
import { organizationRouter } from "./routes/organization.routes";
import { reportsRouter } from "./routes/reports.routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  const env = loadEnv();
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN ?? true,
    })
  );
  app.use(
    "/api/v1/webhooks/paystack",
    express.raw({ type: "application/json" }),
    paystackWebhookRouter
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "tenantos-api" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/properties", propertiesRouter);
  app.use("/api/v1/units", unitsRouter);
  app.use("/api/v1/invitations", invitationsRouter);
  app.use("/api/v1/leases", leasesRouter);
  app.use("/api/v1/tenant", tenantRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/maintenance-requests", maintenanceRouter);
  app.use("/api/v1/rent-payments", rentPaymentReceiptRouter);
  app.use("/api/v1/notifications", notificationsRouter);
  app.use("/api/v1/organization", organizationRouter);
  app.use("/api/v1/reports", reportsRouter);

  app.use(errorHandler);
  return app;
}
