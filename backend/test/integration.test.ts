import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import { createServer } from "http";
import type { AddressInfo } from "net";
import mongoose from "mongoose";
import crypto from "crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app";
import { resetEnvCache } from "../src/config/env";
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { Invitation } from "../src/models/Invitation";
import { hashInviteToken, generateInviteToken } from "../src/utils/inviteToken";

describe("TenantOS API integration", () => {
  let app: ReturnType<typeof createApp>;
  let replSet: MongoMemoryReplSet;

  beforeAll(async () => {
    // Replica set required for multi-document transactions (invitation accept).
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
    });
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = replSet.getUri();
    process.env.JWT_SECRET = "test-jwt-secret-min-16-chars!!";
    process.env.JWT_EXPIRES_IN = "7d";
    process.env.APP_PUBLIC_URL = "http://localhost:5173";
    process.env.INVITE_EXPIRES_DAYS = "7";
    process.env.PAYSTACK_SECRET_KEY = "sk_test_integration_secret_key_32chars!!";
    delete process.env.SMTP_HOST;
    resetEnvCache();
    await connectDatabase(process.env.MONGODB_URI!, "test");
    app = createApp();
  });

  afterEach(async () => {
    if (!mongoose.connection.db) return;
    const cols = await mongoose.connection.db.collections();
    for (const c of cols) {
      await c.deleteMany({});
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
    if (replSet) await replSet.stop();
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ ok: true, service: "tenantos-api" });
  });

  it("auth: register, login, me; duplicate email 409", async () => {
    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "owner@test.com",
        password: "password123",
        organizationName: "Test Org",
      })
      .expect(201);
    expect(reg.body.token).toBeTruthy();
    expect(reg.body.user.role).toBe("landlord");
    expect(reg.body.organization.name).toBe("Test Org");

    await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "owner@test.com",
        password: "otherpass12",
        organizationName: "Other",
      })
      .expect(409);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "owner@test.com", password: "password123" })
      .expect(200);
    expect(login.body.token).toBeTruthy();

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "owner@test.com", password: "wrongpass" })
      .expect(401);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);
    expect(me.body.user.email).toBe("owner@test.com");

    await request(app).get("/api/v1/auth/me").expect(401);
  });

  async function landlordSetup() {
    const reg = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: `landlord-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        password: "password123",
        organizationName: "Acme Rentals",
      })
      .expect(201);
    const token = reg.body.token as string;
    const orgId = reg.body.organization.id as string;
    const userId = reg.body.user.id as string;
    return { token, orgId, userId };
  }

  it("properties & units CRUD with org isolation; tenant forbidden", async () => {
    const { token, orgId, userId } = await landlordSetup();

    const prop = await request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Plaza",
        addressLine1: "1 Main St",
        city: "Lagos",
        country: "NG",
      })
      .expect(201);
    const propertyId = prop.body.property.id as string;

    const list = await request(app)
      .get("/api/v1/properties")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body.properties).toHaveLength(1);

    const unitRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/units`)
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "A1", rentAmount: 50000, currency: "ngn", status: "vacant" })
      .expect(201);
    const unitId = unitRes.body.unit.id as string;
    expect(unitRes.body.unit.currency).toBe("NGN");

    const uget = await request(app)
      .get(`/api/v1/units/${unitId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(uget.body.unit.label).toBe("A1");

    await request(app)
      .patch(`/api/v1/units/${unitId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ rentAmount: 55000 })
      .expect(200);

    const plainToken = generateInviteToken();
    await Invitation.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      unitId: new mongoose.Types.ObjectId(unitId),
      email: "tenantblock@test.com",
      tokenDigest: hashInviteToken(plainToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdBy: new mongoose.Types.ObjectId(userId),
      startDate: new Date("2026-01-01"),
      endDate: null,
      rentAmount: 55000,
      currency: "NGN",
      billingFrequency: "monthly",
    });

    const accepted = await request(app)
      .post("/api/v1/invitations/accept")
      .send({ token: plainToken, password: "tenantpass12" })
      .expect(201);
    const tenantToken = accepted.body.token as string;

    await request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        addressLine1: "x",
        city: "y",
        country: "z",
      })
      .expect(403);
  });

  it("invitation accept creates tenant, lease, occupied unit; tenant /lease and landlord /leases", async () => {
    const { token, orgId, userId } = await landlordSetup();

    const prop = await request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        addressLine1: "2 Oak Ave",
        city: "Abuja",
        country: "NG",
      })
      .expect(201);
    const propertyId = prop.body.property.id as string;

    const unitRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/units`)
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "B2", rentAmount: 120000, currency: "NGN", status: "vacant" })
      .expect(201);
    const unitId = unitRes.body.unit.id as string;

    const plainToken = generateInviteToken();
    await Invitation.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      unitId: new mongoose.Types.ObjectId(unitId),
      email: "renter@test.com",
      tokenDigest: hashInviteToken(plainToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdBy: new mongoose.Types.ObjectId(userId),
      startDate: new Date("2026-01-01"),
      endDate: null,
      rentAmount: 120000,
      currency: "NGN",
      billingFrequency: "monthly",
    });

    const accept = await request(app)
      .post("/api/v1/invitations/accept")
      .send({ token: plainToken, password: "tenantpass12" })
      .expect(201);
    expect(accept.body.user.role).toBe("tenant");
    expect(accept.body.lease.status).toBe("active");
    const tenantToken = accept.body.token as string;

    const tlease = await request(app)
      .get("/api/v1/tenant/lease")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);
    expect(tlease.body.lease.rentAmount).toBe(120000);
    expect(tlease.body.unit.label).toBe("B2");
    expect(tlease.body.property.addressLine1).toBe("2 Oak Ave");

    const leases = await request(app)
      .get("/api/v1/leases")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(leases.body.leases).toHaveLength(1);
    expect(leases.body.leases[0].tenantEmail).toBe("renter@test.com");
  });

  it("POST /invitations sends (or logs) invite and lists pending", async () => {
    const { token, orgId } = await landlordSetup();

    const prop = await request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        addressLine1: "3 Pine Rd",
        city: "Ibadan",
        country: "NG",
      })
      .expect(201);
    const propertyId = prop.body.property.id as string;

    const unitRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/units`)
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "C3", rentAmount: 80000, currency: "NGN" })
      .expect(201);
    const unitId = unitRes.body.unit.id as string;

    const inv = await request(app)
      .post("/api/v1/invitations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "invitee@test.com",
        unitId,
        startDate: "2026-02-01",
        billingFrequency: "monthly",
      })
      .expect(201);
    expect(inv.body.invitation.email).toBe("invitee@test.com");
    expect(orgId).toBeTruthy();

    const pending = await request(app)
      .get("/api/v1/invitations")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(pending.body.invitations).toHaveLength(1);
  });

  it("rent payments, balance, tenant mirror, dashboard summary", async () => {
    const { token, orgId, userId } = await landlordSetup();

    const prop = await request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({ addressLine1: "9 Rent Rd", city: "Lagos", country: "NG" })
      .expect(201);
    const propertyId = prop.body.property.id as string;

    const unitRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/units`)
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "R1", rentAmount: 100000, currency: "NGN" })
      .expect(201);
    const unitId = unitRes.body.unit.id as string;

    const plainToken = generateInviteToken();
    await Invitation.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      unitId: new mongoose.Types.ObjectId(unitId),
      email: "payer@test.com",
      tokenDigest: hashInviteToken(plainToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdBy: new mongoose.Types.ObjectId(userId),
      startDate: new Date("2020-01-01"),
      endDate: null,
      rentAmount: 100000,
      currency: "NGN",
      billingFrequency: "monthly",
    });

    const accept = await request(app)
      .post("/api/v1/invitations/accept")
      .send({ token: plainToken, password: "tenantpass12" })
      .expect(201);
    const leaseId = accept.body.lease.id as string;
    const tenantToken = accept.body.token as string;

    await request(app)
      .post(`/api/v1/leases/${leaseId}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 50000 })
      .expect(201);

    const bal = await request(app)
      .get(`/api/v1/leases/${leaseId}/balance`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(bal.body.totalPaid).toBe(50000);
    expect(bal.body.currency).toBe("NGN");
    expect(bal.body.balance).toBe(bal.body.expectedTotal - 50000);

    const tbal = await request(app)
      .get("/api/v1/tenant/balance")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);
    expect(tbal.body.totalPaid).toBe(50000);

    const tpays = await request(app)
      .get("/api/v1/tenant/payments")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);
    expect(tpays.body.payments).toHaveLength(1);

    const dash = await request(app)
      .get("/api/v1/dashboard/summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(dash.body.occupancy.totalUnits).toBe(1);
    expect(dash.body.occupancy.occupiedUnits).toBe(1);
    expect(dash.body.revenue.total).toBe(50000);
    expect(dash.body.overdue.leasesWithBalanceDue).toBeGreaterThanOrEqual(1);
  });

  it("maintenance: tenant creates request, staff lists and updates status", async () => {
    const { token, orgId, userId } = await landlordSetup();

    const prop = await request(app)
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({ addressLine1: "1 Fix St", city: "Lagos", country: "NG" })
      .expect(201);
    const propertyId = prop.body.property.id as string;

    const unitRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/units`)
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "M1", rentAmount: 90000, currency: "NGN" })
      .expect(201);
    const unitId = unitRes.body.unit.id as string;

    const plainToken = generateInviteToken();
    await Invitation.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      unitId: new mongoose.Types.ObjectId(unitId),
      email: "fixer@test.com",
      tokenDigest: hashInviteToken(plainToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdBy: new mongoose.Types.ObjectId(userId),
      startDate: new Date("2026-01-01"),
      endDate: null,
      rentAmount: 90000,
      currency: "NGN",
      billingFrequency: "monthly",
    });

    const accept = await request(app)
      .post("/api/v1/invitations/accept")
      .send({ token: plainToken, password: "tenantpass12" })
      .expect(201);
    const tenantToken = accept.body.token as string;

    const created = await request(app)
      .post("/api/v1/tenant/maintenance-requests")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        title: "Leaky tap",
        description: "Kitchen sink drips constantly.",
        priority: "high",
      })
      .expect(201);
    expect(created.body.request.status).toBe("open");
    const reqId = created.body.request.id as string;

    const tenantList = await request(app)
      .get("/api/v1/tenant/maintenance-requests")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);
    expect(tenantList.body.requests).toHaveLength(1);

    const staffList = await request(app)
      .get("/api/v1/maintenance-requests")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(staffList.body.requests).toHaveLength(1);

    const patched = await request(app)
      .patch(`/api/v1/maintenance-requests/${reqId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "in_progress" })
      .expect(200);
    expect(patched.body.request.status).toBe("in_progress");

    const one = await request(app)
      .get(`/api/v1/maintenance-requests/${reqId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(one.body.request.title).toBe("Leaky tap");

    const tenantNotifs = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${tenantToken}`)
      .expect(200);
    expect(tenantNotifs.body.unreadCount).toBeGreaterThanOrEqual(1);
    expect(
      tenantNotifs.body.notifications.some(
        (x: { type: string }) => x.type === "maintenance_updated"
      )
    ).toBe(true);
  });

  it("phase 3: organization settings, notifications list, payments CSV export", async () => {
    const { token } = await landlordSetup();

    const empty = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(empty.body.notifications).toEqual([]);
    expect(empty.body.unreadCount).toBe(0);

    const org = await request(app)
      .get("/api/v1/organization")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(org.body.organization.defaultCurrency).toBe("NGN");

    await request(app)
      .patch("/api/v1/organization")
      .set("Authorization", `Bearer ${token}`)
      .send({ defaultCurrency: "usd" })
      .expect(200);

    const org2 = await request(app)
      .get("/api/v1/organization")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(org2.body.organization.defaultCurrency).toBe("USD");

    const csv = await request(app)
      .get("/api/v1/reports/payments.csv")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(csv.headers["content-type"]).toMatch(/csv/);
    expect(csv.text).toContain("paidAt,amount,currency");
  });

  describe("Full API coverage — remaining endpoints", () => {
    it("auth: refresh rotates session; logout invalidates refresh", async () => {
      const reg = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: `refresh-${Date.now()}@test.com`,
          password: "password123",
          organizationName: "Refresh Org",
        })
        .expect(201);
      const refreshToken = reg.body.refreshToken as string;
      expect(refreshToken).toBeTruthy();

      const refreshed = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken })
        .expect(200);
      expect(refreshed.body.accessToken).toBeTruthy();
      const newRefresh = refreshed.body.refreshToken as string;
      expect(newRefresh).toBeTruthy();

      await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken })
        .expect(401);

      await request(app)
        .post("/api/v1/auth/logout")
        .send({ refreshToken: newRefresh })
        .expect(204);
      await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: newRefresh })
        .expect(401);
    });

    it("auth: landlord creates agent with assignedPropertyIds", async () => {
      const { token, orgId } = await landlordSetup();
      const prop = await request(app)
        .post("/api/v1/properties")
        .set("Authorization", `Bearer ${token}`)
        .send({ addressLine1: "Agent St", city: "Lagos", country: "NG" })
        .expect(201);
      const propertyId = prop.body.property.id as string;

      const createAgent = await request(app)
        .post("/api/v1/auth/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: `agent-${Date.now()}@test.com`,
          password: "password123",
          role: "agent",
          assignedPropertyIds: [propertyId],
        })
        .expect(201);
      expect(createAgent.body.user.role).toBe("agent");
      expect(createAgent.body.user.assignedPropertyIds).toContain(propertyId);

      const loginAgent = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: createAgent.body.user.email,
          password: "password123",
        })
        .expect(200);
      const agentToken = loginAgent.body.token as string;

      const props = await request(app)
        .get("/api/v1/properties")
        .set("Authorization", `Bearer ${agentToken}`)
        .expect(200);
      expect(props.body.properties).toHaveLength(1);
      expect(props.body.properties[0].id).toBe(propertyId);
    });

    it("properties: GET by id, PATCH, nested units GET; unit DELETE; property DELETE", async () => {
      const { token } = await landlordSetup();
      const prop = await request(app)
        .post("/api/v1/properties")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Block A", addressLine1: "10 Rd", city: "Lagos", country: "NG" })
        .expect(201);
      const propertyId = prop.body.property.id as string;

      const byId = await request(app)
        .get(`/api/v1/properties/${propertyId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(byId.body.property.name).toBe("Block A");
      expect(byId.body.property.photos).toEqual([]);

      await request(app)
        .patch(`/api/v1/properties/${propertyId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Block A Updated" })
        .expect(200);

      const unitRes = await request(app)
        .post(`/api/v1/properties/${propertyId}/units`)
        .set("Authorization", `Bearer ${token}`)
        .send({ label: "U1", rentAmount: 40000, currency: "NGN" })
        .expect(201);
      const unitId = unitRes.body.unit.id as string;

      const nested = await request(app)
        .get(`/api/v1/properties/${propertyId}/units`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(nested.body.units).toHaveLength(1);

      await request(app)
        .delete(`/api/v1/units/${unitId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      await request(app)
        .delete(`/api/v1/properties/${propertyId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      await request(app)
        .get(`/api/v1/properties/${propertyId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("property photos: POST returns 503 when Cloudinary is not configured", async () => {
      const { token } = await landlordSetup();
      const prop = await request(app)
        .post("/api/v1/properties")
        .set("Authorization", `Bearer ${token}`)
        .send({ addressLine1: "Photo Rd", city: "Lagos", country: "NG" })
        .expect(201);
      const propertyId = prop.body.property.id as string;
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );
      await request(app)
        .post(`/api/v1/properties/${propertyId}/photos`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", png, "tiny.png")
        .expect(503);
    });

    it("leases: GET lease by id, payments list, documents, balance; rent PDF receipt", async () => {
      const { token, orgId, userId } = await landlordSetup();
      const prop = await request(app)
        .post("/api/v1/properties")
        .set("Authorization", `Bearer ${token}`)
        .send({ addressLine1: "Lease Rd", city: "Lagos", country: "NG" })
        .expect(201);
      const propertyId = prop.body.property.id as string;
      const unitRes = await request(app)
        .post(`/api/v1/properties/${propertyId}/units`)
        .set("Authorization", `Bearer ${token}`)
        .send({ label: "L1", rentAmount: 80000, currency: "NGN" })
        .expect(201);
      const unitId = unitRes.body.unit.id as string;

      const plainToken = generateInviteToken();
      await Invitation.create({
        organizationId: new mongoose.Types.ObjectId(orgId),
        unitId: new mongoose.Types.ObjectId(unitId),
        email: "lease-api@test.com",
        tokenDigest: hashInviteToken(plainToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdBy: new mongoose.Types.ObjectId(userId),
        startDate: new Date("2020-01-01"),
        endDate: null,
        rentAmount: 80000,
        currency: "NGN",
        billingFrequency: "monthly",
      });

      const accept = await request(app)
        .post("/api/v1/invitations/accept")
        .send({ token: plainToken, password: "tenantpass12" })
        .expect(201);
      const leaseId = accept.body.lease.id as string;
      const tenantToken = accept.body.token as string;

      const oneLease = await request(app)
        .get(`/api/v1/leases/${leaseId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(oneLease.body.lease.id).toBe(leaseId);

      const paysBefore = await request(app)
        .get(`/api/v1/leases/${leaseId}/payments`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(paysBefore.body.payments).toHaveLength(0);

      const docs = await request(app)
        .get(`/api/v1/leases/${leaseId}/documents`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(docs.body.documents).toEqual([]);

      const payRes = await request(app)
        .post(`/api/v1/leases/${leaseId}/payments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 25000, notes: "Partial" })
        .expect(201);
      const paymentId = payRes.body.payment.id as string;

      const tdocs = await request(app)
        .get("/api/v1/tenant/documents")
        .set("Authorization", `Bearer ${tenantToken}`)
        .expect(200);
      expect(tdocs.body.documents).toEqual([]);

      const receipt = await request(app)
        .get(`/api/v1/rent-payments/${paymentId}/receipt`)
        .set("Authorization", `Bearer ${tenantToken}`)
        .expect(200);
      expect(receipt.headers["content-type"]).toMatch(/pdf/);

      const bal = await request(app)
        .get(`/api/v1/leases/${leaseId}/balance`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(bal.body.totalPaid).toBe(25000);
    });

    it("notifications: mark one read and read all", async () => {
      const { token, orgId, userId } = await landlordSetup();
      const prop = await request(app)
        .post("/api/v1/properties")
        .set("Authorization", `Bearer ${token}`)
        .send({ addressLine1: "N Rd", city: "Lagos", country: "NG" })
        .expect(201);
      const propertyId = prop.body.property.id as string;
      const unitRes = await request(app)
        .post(`/api/v1/properties/${propertyId}/units`)
        .set("Authorization", `Bearer ${token}`)
        .send({ label: "N1", rentAmount: 50000, currency: "NGN" })
        .expect(201);
      const unitId = unitRes.body.unit.id as string;

      const plainToken = generateInviteToken();
      await Invitation.create({
        organizationId: new mongoose.Types.ObjectId(orgId),
        unitId: new mongoose.Types.ObjectId(unitId),
        email: "notif-read@test.com",
        tokenDigest: hashInviteToken(plainToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdBy: new mongoose.Types.ObjectId(userId),
        startDate: new Date("2020-01-01"),
        endDate: null,
        rentAmount: 50000,
        currency: "NGN",
        billingFrequency: "monthly",
      });

      const accept = await request(app)
        .post("/api/v1/invitations/accept")
        .send({ token: plainToken, password: "tenantpass12" })
        .expect(201);
      const leaseId = accept.body.lease.id as string;
      const tenantToken = accept.body.token as string;

      await request(app)
        .post(`/api/v1/leases/${leaseId}/payments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 10000 })
        .expect(201);

      const n1 = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${tenantToken}`)
        .expect(200);
      expect(n1.body.unreadCount).toBeGreaterThanOrEqual(1);
      const nid = n1.body.notifications[0].id as string;

      await request(app)
        .patch(`/api/v1/notifications/${nid}/read`)
        .set("Authorization", `Bearer ${tenantToken}`)
        .expect(200);

      const n2 = await request(app)
        .get("/api/v1/notifications?unreadOnly=true")
        .set("Authorization", `Bearer ${tenantToken}`)
        .expect(200);
      expect(n2.body.notifications).toHaveLength(0);

      await request(app)
        .post("/api/v1/notifications/read-all")
        .set("Authorization", `Bearer ${tenantToken}`)
        .expect(200);
      const n3 = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${tenantToken}`)
        .expect(200);
      expect(n3.body.unreadCount).toBe(0);
    });

    it("maintenance: list with status filter", async () => {
      const { token, orgId, userId } = await landlordSetup();
      const prop = await request(app)
        .post("/api/v1/properties")
        .set("Authorization", `Bearer ${token}`)
        .send({ addressLine1: "MF Rd", city: "Lagos", country: "NG" })
        .expect(201);
      const propertyId = prop.body.property.id as string;
      const unitRes = await request(app)
        .post(`/api/v1/properties/${propertyId}/units`)
        .set("Authorization", `Bearer ${token}`)
        .send({ label: "MF1", rentAmount: 40000, currency: "NGN" })
        .expect(201);
      const unitId = unitRes.body.unit.id as string;

      const plainToken = generateInviteToken();
      await Invitation.create({
        organizationId: new mongoose.Types.ObjectId(orgId),
        unitId: new mongoose.Types.ObjectId(unitId),
        email: "mf@test.com",
        tokenDigest: hashInviteToken(plainToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdBy: new mongoose.Types.ObjectId(userId),
        startDate: new Date("2026-01-01"),
        endDate: null,
        rentAmount: 40000,
        currency: "NGN",
        billingFrequency: "monthly",
      });

      const accept = await request(app)
        .post("/api/v1/invitations/accept")
        .send({ token: plainToken, password: "tenantpass12" })
        .expect(201);
      const tenantToken = accept.body.token as string;

      await request(app)
        .post("/api/v1/tenant/maintenance-requests")
        .set("Authorization", `Bearer ${tenantToken}`)
        .send({ title: "Test", description: "Desc" })
        .expect(201);

      const openOnly = await request(app)
        .get("/api/v1/maintenance-requests?status=open")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(openOnly.body.requests.length).toBe(1);

      const resolved = await request(app)
        .get("/api/v1/maintenance-requests?status=resolved")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(resolved.body.requests).toHaveLength(0);
    });

    it("paystack webhook: charge.success creates payment", async () => {
      const { token, orgId, userId } = await landlordSetup();
      const prop = await request(app)
        .post("/api/v1/properties")
        .set("Authorization", `Bearer ${token}`)
        .send({ addressLine1: "WH Rd", city: "Lagos", country: "NG" })
        .expect(201);
      const propertyId = prop.body.property.id as string;
      const unitRes = await request(app)
        .post(`/api/v1/properties/${propertyId}/units`)
        .set("Authorization", `Bearer ${token}`)
        .send({ label: "W1", rentAmount: 100000, currency: "NGN" })
        .expect(201);
      const unitId = unitRes.body.unit.id as string;

      const plainToken = generateInviteToken();
      await Invitation.create({
        organizationId: new mongoose.Types.ObjectId(orgId),
        unitId: new mongoose.Types.ObjectId(unitId),
        email: "webhook@test.com",
        tokenDigest: hashInviteToken(plainToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdBy: new mongoose.Types.ObjectId(userId),
        startDate: new Date("2020-01-01"),
        endDate: null,
        rentAmount: 100000,
        currency: "NGN",
        billingFrequency: "monthly",
      });

      const accept = await request(app)
        .post("/api/v1/invitations/accept")
        .send({ token: plainToken, password: "tenantpass12" })
        .expect(201);
      const leaseId = accept.body.lease.id as string;

      const reference = `int-test-${Date.now()}`;
      const amountKobo = 50_000 * 100;
      const payload = {
        event: "charge.success",
        data: {
          reference,
          amount: amountKobo,
          currency: "NGN",
          metadata: {
            lease_id: leaseId,
            organization_id: orgId,
          },
          paid_at: new Date().toISOString(),
        },
      };
      const jsonStr = JSON.stringify(payload);
      const raw = Buffer.from(jsonStr, "utf8");
      const sig = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
        .update(raw)
        .digest("hex");

      const server = createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as AddressInfo;
      try {
        const whRes = await fetch(`http://127.0.0.1:${port}/api/v1/webhooks/paystack`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-paystack-signature": sig,
          },
          body: raw,
        });
        expect(whRes.status).toBe(200);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }

      const pays = await request(app)
        .get(`/api/v1/leases/${leaseId}/payments`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      const match = pays.body.payments.find(
        (p: { paystackReference?: string }) => p.paystackReference === reference
      );
      expect(match).toBeTruthy();
      expect(match.amount).toBe(50000);
    });

    it("tenant paystack initialize returns 503 when Paystack is disabled", async () => {
      const prev = process.env.PAYSTACK_SECRET_KEY;
      delete process.env.PAYSTACK_SECRET_KEY;
      resetEnvCache();

      const { token, orgId, userId } = await landlordSetup();
      const prop = await request(app)
        .post("/api/v1/properties")
        .set("Authorization", `Bearer ${token}`)
        .send({ addressLine1: "PS Rd", city: "Lagos", country: "NG" })
        .expect(201);
      const propertyId = prop.body.property.id as string;
      const unitRes = await request(app)
        .post(`/api/v1/properties/${propertyId}/units`)
        .set("Authorization", `Bearer ${token}`)
        .send({ label: "PS1", rentAmount: 50000, currency: "NGN" })
        .expect(201);
      const unitId = unitRes.body.unit.id as string;

      const plainToken = generateInviteToken();
      await Invitation.create({
        organizationId: new mongoose.Types.ObjectId(orgId),
        unitId: new mongoose.Types.ObjectId(unitId),
        email: "ps503@test.com",
        tokenDigest: hashInviteToken(plainToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdBy: new mongoose.Types.ObjectId(userId),
        startDate: new Date("2020-01-01"),
        endDate: null,
        rentAmount: 50000,
        currency: "NGN",
        billingFrequency: "monthly",
      });

      const accept = await request(app)
        .post("/api/v1/invitations/accept")
        .send({ token: plainToken, password: "tenantpass12" })
        .expect(201);
      const tenantToken = accept.body.token as string;

      await request(app)
        .post("/api/v1/tenant/paystack/initialize")
        .set("Authorization", `Bearer ${tenantToken}`)
        .send({ amountNgn: 5000 })
        .expect(503);

      process.env.PAYSTACK_SECRET_KEY = prev;
      resetEnvCache();
    });
  });
});
