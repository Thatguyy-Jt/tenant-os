# TenantOS

> The all-in-one operating system for landlords, property managers, and tenants.

TenantOS is a full-stack property management platform that lets landlords track rent, manage tenants, handle maintenance requests, and analyse portfolio performance — all from a single dashboard. Tenants get their own portal to view their lease, pay rent online, submit maintenance tickets, and manage documents.

**Live demo:** [tenantos.vercel.app](https://tenantos.vercel.app)  
**API:** Deployed on [Render](https://render.com) · **Frontend:** Deployed on [Vercel](https://vercel.com)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
  - [Backend](#backend-env)
  - [Frontend](#frontend-env)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Database Models](#database-models)
- [Payments (Paystack)](#payments-paystack)
- [Email & Notifications](#email--notifications)
- [Background Jobs (Bull / Redis)](#background-jobs-bull--redis)
- [UI Themes](#ui-themes)
- [Deployment](#deployment)
- [Testing](#testing)
- [Contributing](#contributing)

---

## Features

### Landlord / Agent Portal (`/staff`)

| Feature | Details |
|---------|---------|
| **Analytics Dashboard** | Occupancy rate, 30-day revenue, active leases, outstanding rent total with Recharts-powered charts: 6-month revenue area chart, occupancy donut, lease health bar chart, rent collection summary |
| **Property Management** | Create / edit / delete properties with address details; upload up to 20 Cloudinary-hosted marketing photos per property |
| **Unit Management** | Add units to properties with rent amount, currency, and vacancy status |
| **Lease Management** | View all leases with balance calculations; record manual rent payments; download payment history as CSV |
| **Tenant Invitations** | Email-based invite flow — set rent, start/end date, billing frequency; tenant clicks link to register and the lease is created automatically |
| **Maintenance Queue** | View, filter by status, and update all maintenance requests across the portfolio; in-app notifications sent to tenant on status changes |
| **Notifications** | Real-time in-app notification feed with unread badge; mark individual or all as read |
| **Organisation Settings** | Update organisation name and default currency |
| **Agent Roles** | Landlords can create agent accounts scoped to specific properties |

### Tenant Portal (`/tenant`)

| Feature | Details |
|---------|---------|
| **Home Dashboard** | Property hero card, lease progress bar, 4 KPI cards (balance due, monthly rent, next due date countdown, total paid), payment timeline chart showing last 6 billing periods + 3 upcoming |
| **Online Rent Payment** | Paystack checkout (NGN); tenant returns to portal after payment; fallback verify endpoint for local dev without webhooks |
| **Payment History** | Monthly bar chart, full sortable transaction table with method badges and one-click PDF receipt download |
| **Maintenance Requests** | Submit requests with title, description, and priority (Low / Normal / High); track live status (Open → In Progress → Resolved) |
| **Documents** | Drag-and-drop upload to Cloudinary; card grid view with file type icons; direct open links |

### General

- **5 UI themes** selectable from the landing page navbar (persisted in `localStorage`)
- Refresh-token rotation with single-use opaque tokens
- Email verification flow (opt-in via env flag)
- Password reset with full refresh-token revocation
- Daily rent reminder emails (Bull + Redis cron at 09:00)
- Lease-expiry in-app notifications (30-day window, 7-day cooldown)
- Role-based access control (`landlord`, `agent`, `tenant`)
- Rate-limited registration

---

## Tech Stack

### Backend

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 20 |
| Framework | Express 5 |
| Database | MongoDB via Mongoose |
| Auth | JWT (access) + opaque refresh tokens (hashed in DB) |
| Payments | Paystack REST API + webhook |
| Email | Resend (primary) or SMTP via Nodemailer |
| File uploads | Cloudinary via Multer |
| PDF receipts | PDFKit |
| Background jobs | Bull + Redis (ioredis) |
| Validation | Zod |
| Security | Helmet, express-rate-limit, HMAC webhook verification, bcryptjs |
| Language | TypeScript |

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 6 |
| Routing | React Router v7 |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| Styling | Tailwind CSS v4 + CSS variables theme system |
| Animations | Framer Motion |
| Icons | Lucide React |
| UI primitives | Radix UI (Dialog, Slot) |
| Language | TypeScript |

---

## Project Structure

```
TenantOs/
├── backend/                    # Express API
│   ├── src/
│   │   ├── app.ts              # Express app setup, middleware, route mounting
│   │   ├── server.ts           # HTTP server, DB connect, Bull worker lifecycle
│   │   ├── config/
│   │   │   ├── database.ts     # Mongoose connect
│   │   │   └── env.ts          # Zod-validated environment schema
│   │   ├── models/             # Mongoose schemas
│   │   │   ├── User.ts
│   │   │   ├── Organization.ts
│   │   │   ├── Property.ts
│   │   │   ├── Unit.ts
│   │   │   ├── Lease.ts
│   │   │   ├── Invitation.ts
│   │   │   ├── RentPayment.ts
│   │   │   ├── LeaseDocument.ts
│   │   │   ├── MaintenanceRequest.ts
│   │   │   ├── Notification.ts
│   │   │   └── RefreshToken.ts
│   │   ├── routes/             # Express routers
│   │   │   ├── auth.routes.ts
│   │   │   ├── properties.routes.ts
│   │   │   ├── units.routes.ts
│   │   │   ├── invitations.routes.ts
│   │   │   ├── leases.routes.ts
│   │   │   ├── tenant.routes.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── maintenanceRequests.routes.ts
│   │   │   ├── rentPayments.routes.ts
│   │   │   ├── notifications.routes.ts
│   │   │   ├── organization.routes.ts
│   │   │   ├── reports.routes.ts
│   │   │   └── paystackWebhook.routes.ts
│   │   ├── middleware/
│   │   │   ├── authenticate.ts  # JWT Bearer verification
│   │   │   ├── requireRole.ts
│   │   │   └── errorHandler.ts
│   │   ├── services/
│   │   │   ├── authSession.ts   # JWT + refresh token issuance
│   │   │   ├── rent.ts          # computeExpectedRentThrough, computeBalance
│   │   │   ├── email.ts         # Resend / SMTP transactional email
│   │   │   ├── paystackApi.ts   # Paystack REST calls
│   │   │   ├── paystackRentPayment.ts
│   │   │   ├── inAppNotifications.ts
│   │   │   ├── propertyAccess.ts
│   │   │   └── cloudinaryUpload.ts
│   │   ├── queues/
│   │   │   └── reminders.ts     # Bull cron: rent reminders + lease expiry
│   │   └── utils/
│   │       ├── jwt.ts
│   │       ├── secureToken.ts
│   │       ├── inviteToken.ts
│   │       ├── serializers.ts
│   │       └── asyncHandler.ts
│   ├── test/
│   │   └── integration.test.ts
│   ├── scripts/start.cjs
│   ├── .env.example
│   └── package.json
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── main.tsx            # App root, providers
│   │   ├── App.tsx             # Route definitions
│   │   ├── index.css           # Tailwind + 5 CSS variable themes
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── layouts/
│   │   │   ├── StaffLayout.tsx  # Staff sidebar/topbar
│   │   │   └── TenantLayout.tsx # Tenant sidebar + mobile drawer
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── ForgotPasswordPage.tsx
│   │   │   ├── ResetPasswordPage.tsx
│   │   │   ├── VerifyEmailPage.tsx
│   │   │   ├── AcceptInvitationPage.tsx
│   │   │   ├── staff/
│   │   │   │   ├── StaffDashboardPage.tsx
│   │   │   │   ├── PropertiesListPage.tsx
│   │   │   │   ├── PropertyDetailPage.tsx
│   │   │   │   ├── LeasesListPage.tsx
│   │   │   │   ├── LeaseDetailPage.tsx
│   │   │   │   ├── InvitationsPage.tsx
│   │   │   │   ├── MaintenanceListPage.tsx
│   │   │   │   ├── NotificationsPage.tsx
│   │   │   │   └── OrganizationSettingsPage.tsx
│   │   │   └── tenant/
│   │   │       ├── TenantHomePage.tsx
│   │   │       ├── TenantPaymentsPage.tsx
│   │   │       ├── TenantMaintenancePage.tsx
│   │   │       └── TenantDocumentsPage.tsx
│   │   ├── components/
│   │   │   ├── landing/         # Hero, Features, Navbar, Footer, etc.
│   │   │   ├── ui/              # Button, Card, Dialog (shadcn-style)
│   │   │   ├── ThemePicker.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── PageLoader.tsx
│   │   ├── api/
│   │   │   ├── client.ts        # apiFetch with 401 retry + token refresh
│   │   │   ├── authApi.ts
│   │   │   ├── staffApi.ts
│   │   │   ├── tenantApi.ts
│   │   │   ├── tokens.ts
│   │   │   ├── staffTypes.ts
│   │   │   └── tenantTypes.ts
│   │   └── lib/
│   │       ├── format.ts        # formatMoney, formatDate, formatDateTime
│   │       ├── env.ts
│   │       └── utils.ts
│   ├── vercel.json
│   ├── .env.example
│   └── package.json
│
├── render.yaml                 # Render Blueprint for the API
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **MongoDB** (local install or [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)
- **Redis** *(optional — required only for rent reminder cron jobs)*
- A **Paystack** account for online payment processing *(optional for local dev)*
- A **Cloudinary** account for photo/document uploads *(optional for local dev)*
- A **Resend** API key or SMTP credentials for transactional email *(optional — links are logged to console if not set)*

### Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Copy the example env file and fill in your values
cp .env.example .env

# 4. Start the development server (hot-reload via ts-node-dev)
npm run dev
```

The API will be available at **`http://localhost:4000`**.  
Health check: `GET http://localhost:4000/api/v1/health`

### Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Copy the example env file
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:4000/api/v1

# 4. Start the dev server
npm run dev
```

The frontend will be available at **`http://localhost:5173`**.

---

## Environment Variables

### Backend (`backend/.env`) <a name="backend-env"></a>

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `PORT` | No | `4000` | HTTP server port |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | ≥ 16 character secret for signing JWTs |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token lifetime (e.g. `15m`, `1h`) |
| `JWT_REFRESH_EXPIRES_DAYS` | No | `7` | Refresh token lifetime in days |
| `JWT_EXPIRES_IN` | No | — | *(Deprecated)* Falls back to access token TTL if `JWT_ACCESS_EXPIRES_IN` is unset |
| `REQUIRE_EMAIL_VERIFICATION` | No | `false` | Set `true` in production to block login until email is verified |
| `APP_PUBLIC_URL` | No | Auto-detected | Base URL for Paystack callback and invite links |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173` | CORS allowed origin |
| `INVITE_EXPIRES_DAYS` | No | `7` | Days before an invitation link expires |
| `EMAIL_VERIFICATION_EXPIRES_HOURS` | No | `24` | Email verification token lifetime |
| `PASSWORD_RESET_EXPIRES_MINUTES` | No | `60` | Password reset token lifetime |
| `RESEND_API_KEY` | No | — | [Resend](https://resend.com) API key (preferred email provider) |
| `EMAIL_FROM` | No | — | From address for transactional emails (e.g. `noreply@yourdomain.com`) |
| `SMTP_HOST` | No | — | SMTP hostname (fallback if Resend is not set) |
| `SMTP_PORT` | No | — | SMTP port |
| `SMTP_SECURE` | No | — | `true` for TLS |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `PAYSTACK_SECRET_KEY` | No | — | Paystack secret key (starts with `sk_live_` or `sk_test_`) |
| `REDIS_URL` | No | — | Redis connection URL (enables Bull cron jobs) |
| `CLOUDINARY_CLOUD_NAME` | No | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | No | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | — | Cloudinary API secret |

> **Tip:** If email variables are not set, invite links, password reset links, and verification links are printed to the server console so you can still test locally.

### Frontend (`frontend/.env`) <a name="frontend-env"></a>

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | `http://localhost:4000/api/v1` (dev) / `https://tenant-os.onrender.com/api/v1` (prod) | Full base URL of the backend API including `/api/v1` |

---

## API Reference

All endpoints are prefixed with `/api/v1`. Authenticated routes require `Authorization: Bearer <accessToken>`.

### Authentication — `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | Public | Create landlord account + organisation |
| `POST` | `/auth/login` | Public | Returns `accessToken`, `refreshToken`, user info |
| `POST` | `/auth/refresh` | Public | Rotates refresh token, returns new pair |
| `POST` | `/auth/logout` | Public | Revokes refresh token |
| `GET` | `/auth/me` | Bearer | Returns authenticated user + org |
| `POST` | `/auth/verify-email` | Public | Verifies email token from link |
| `POST` | `/auth/forgot-password` | Public | Sends password reset email |
| `POST` | `/auth/reset-password` | Public | Resets password, revokes all refresh tokens |
| `POST` | `/auth/users` | Bearer (landlord) | Create agent/staff user accounts |

### Properties — `/properties`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/properties` | Staff | List all properties (agent-scoped) |
| `POST` | `/properties` | Landlord | Create a property |
| `GET` | `/properties/:id` | Staff | Get property details |
| `PATCH` | `/properties/:id` | Landlord | Update property |
| `DELETE` | `/properties/:id` | Landlord | Delete property + cascade units |
| `POST` | `/properties/:id/photos` | Landlord | Upload photo (multipart) |
| `DELETE` | `/properties/:id/photos` | Landlord | Remove photo by `publicId` |

### Units — `/properties/:id/units` and `/units`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/properties/:id/units` | Staff | List units for a property |
| `POST` | `/properties/:id/units` | Landlord | Create unit |
| `GET` | `/units/:unitId` | Staff | Get unit |
| `PATCH` | `/units/:unitId` | Staff | Update unit |
| `DELETE` | `/units/:unitId` | Landlord | Delete unit |

### Invitations — `/invitations`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/invitations` | Staff | List pending invitations |
| `POST` | `/invitations` | Staff | Create + email invitation link |
| `DELETE` | `/invitations/:id` | Staff | Revoke pending invitation |
| `POST` | `/invitations/accept` | Public | Accept invite, set password, create tenant + lease |

### Leases — `/leases`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/leases` | Staff | List all leases |
| `GET` | `/leases/:id` | Staff | Lease detail |
| `GET` | `/leases/:id/payments` | Staff | Payment history for a lease |
| `POST` | `/leases/:id/payments` | Staff | Record manual payment |
| `GET` | `/leases/:id/balance` | Staff | Accrued vs paid balance (`?asOf=<ISO date>`) |
| `GET` | `/leases/:id/documents` | Staff | Lease documents |

### Tenant Portal — `/tenant`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/tenant/lease` | Tenant | Active lease, unit, property |
| `GET` | `/tenant/payments` | Tenant | Payment history |
| `GET` | `/tenant/balance` | Tenant | Current balance |
| `GET` | `/tenant/maintenance-requests` | Tenant | List maintenance requests |
| `POST` | `/tenant/maintenance-requests` | Tenant | Submit new request |
| `POST` | `/tenant/paystack/initialize` | Tenant | Start Paystack checkout (NGN) |
| `POST` | `/tenant/paystack/verify` | Tenant | Verify + record payment by reference |
| `GET` | `/tenant/documents` | Tenant | Lease documents |
| `POST` | `/tenant/documents` | Tenant | Upload document (multipart) |

### Dashboard — `/dashboard`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/dashboard/summary` | Staff | Occupancy, revenue (30 days), outstanding rent |
| `GET` | `/dashboard/charts` | Staff | 6-month revenue series, occupancy breakdown, lease health, rent collection |

### Other

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/maintenance-requests` | Staff | All maintenance requests (`?status=`) |
| `PATCH` | `/maintenance-requests/:id` | Staff | Update status / assign |
| `GET` | `/rent-payments/:id/receipt` | Bearer | Download PDF receipt |
| `GET` | `/notifications` | Bearer | List notifications (`?limit=&unreadOnly=`) |
| `PATCH` | `/notifications/:id/read` | Bearer | Mark as read |
| `POST` | `/notifications/read-all` | Bearer | Mark all as read |
| `GET` | `/organization` | Landlord | Organisation details |
| `PATCH` | `/organization` | Landlord | Update name / currency |
| `GET` | `/reports/payments.csv` | Staff | Download payments CSV (`?from=&to=`) |
| `POST` | `/webhooks/paystack` | Public (HMAC) | Paystack `charge.success` webhook |
| `GET` | `/health` | Public | `{ ok: true }` |

---

## Authentication

TenantOS uses a **dual-token** auth system:

```
POST /auth/login
  → accessToken  (JWT, 15 min default, signed with JWT_SECRET)
  → refreshToken (opaque 48-byte random token, stored hashed in DB)

POST /auth/refresh
  → one-time token rotation (old refresh token is deleted on use)
  → new accessToken + refreshToken pair
```

**Access token payload:**

```json
{
  "sub": "<userId>",
  "organizationId": "<orgId>",
  "role": "landlord | agent | tenant"
}
```

**Frontend behaviour:**
- Tokens are stored in `localStorage`.
- Every authenticated `fetch` call attaches `Authorization: Bearer <accessToken>`.
- On a **401** response, the client automatically calls `/auth/refresh`, updates the stored tokens, and retries the original request once.
- Listening to `storage` events lets the auth state stay in sync across browser tabs.

---

## Database Models

| Model | Key Fields |
|-------|-----------|
| **User** | `email`, `passwordHash`, `role`, `organizationId`, `assignedPropertyIds`, `emailVerified` |
| **Organization** | `name`, `defaultCurrency` |
| **Property** | `organizationId`, `name`, `address fields`, `propertyPhotos[]` (url + cloudinaryPublicId) |
| **Unit** | `organizationId`, `propertyId`, `label`, `rentAmount`, `currency`, `status` (vacant/occupied) |
| **Lease** | `organizationId`, `unitId`, `tenantUserId`, `startDate`, `endDate`, `rentAmount`, `currency`, `billingFrequency`, `status` |
| **Invitation** | `organizationId`, `unitId`, `email`, `tokenDigest`, `expiresAt`, `startDate`, `rentAmount`, `billingFrequency` |
| **RentPayment** | `organizationId`, `leaseId`, `amount`, `currency`, `paidAt`, `method`, `paystackReference` (sparse unique) |
| **LeaseDocument** | `leaseId`, `uploadedBy`, `label`, `cloudinaryUrl`, `originalFileName` |
| **MaintenanceRequest** | `unitId`, `leaseId`, `tenantUserId`, `title`, `description`, `priority`, `status`, `assignedToUserId` |
| **Notification** | `userId`, `type` (payment_received / maintenance_updated / lease_expiring), `title`, `body`, `readAt` |
| **RefreshToken** | `userId`, `tokenHash` (unique), `expiresAt`, `revokedAt` |

---

## Payments (Paystack)

TenantOS integrates [Paystack](https://paystack.com) for online rent collection (currently NGN only).

### Flow

```
Tenant clicks "Pay"
  → POST /tenant/paystack/initialize { amountNgn }
  → API creates Paystack transaction with lease metadata
  → Frontend redirects to Paystack checkout URL
  → Tenant completes payment on Paystack
  → Paystack sends webhook → POST /webhooks/paystack
     OR Tenant returns to portal → POST /tenant/paystack/verify { reference }
  → Payment recorded in RentPayment, tenant notified
```

### Idempotency

The `paystackReference` field on `RentPayment` has a **sparse unique index**, so duplicate webhook deliveries or double-verify calls never create duplicate payments.

### Webhook Security

Paystack signs webhook payloads with HMAC-SHA512 using your `PAYSTACK_SECRET_KEY`. The endpoint reads the **raw request body** (before JSON parsing) and compares it against the `x-paystack-signature` header — requests with invalid signatures are rejected with `401`.

---

## Email & Notifications

### Transactional Email

Configure **one** of the following in your backend `.env`:

- **Resend** (recommended): set `RESEND_API_KEY` and `EMAIL_FROM`
- **SMTP**: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`

If neither is configured, invite links and password reset links are **printed to the server console** — useful for local development.

Email templates are sent for:

| Trigger | Recipient |
|---------|-----------|
| Tenant invitation | Invited email address |
| Email address verification | Registering user |
| Password reset | User who requested reset |
| Overdue rent reminder (daily cron) | Tenants with outstanding balance |

### In-App Notifications

Stored in the `Notification` collection and surfaced in the staff and tenant portals:

| Type | Trigger | Recipients |
|------|---------|-----------|
| `payment_received` | Rent payment recorded | Tenant |
| `maintenance_updated` | Staff changes request status | Tenant |
| `lease_expiring` | Lease ends within 30 days (daily cron) | Tenant + landlords + assigned agents; 7-day cooldown per lease |

---

## Background Jobs (Bull / Redis)

When `REDIS_URL` is set, TenantOS starts a **Bull** queue called `rent-reminders` with a daily repeatable job at **09:00 UTC**.

```
Daily job:
  1. Find all active leases
  2. Compute outstanding balance for each (accrued rent - recorded payments)
  3. Email tenants with an outstanding balance (if email configured)
  4. Check leases ending within 30 days → create lease_expiring notifications
     (7-day cooldown per lease to avoid spam)
```

If `REDIS_URL` is **not** set, the queue worker logs a warning and the cron does not run. All other functionality works normally.

---

## UI Themes

TenantOS ships **5 built-in colour themes** selectable from the landing page navbar. The chosen theme is saved to `localStorage` and applied globally via a `data-theme` attribute on `<html>`.

| Theme | Style | Primary colour |
|-------|-------|---------------|
| **Midnight Teal** *(default)* | Dark shell + teal accents | `hsl(174 72% 46%)` |
| **Ocean Blue** | Deep dark + electric blue | `hsl(217 91% 60%)` |
| **Royal Purple** | Dark shell + violet | `hsl(270 75% 65%)` |
| **Ember** | Dark shell + amber/orange | `hsl(25 90% 58%)` |
| **Arctic Light** | Clean light + indigo | `hsl(221 83% 53%)` |

Each theme defines a complete set of CSS custom properties (`--background`, `--primary`, `--card`, `--chart-1` through `--chart-5`, etc.) in `frontend/src/index.css`. Chart colours automatically update with the active theme.

---

## Deployment

### Backend — Render

The repository includes a `render.yaml` [Blueprint](https://render.com/docs/blueprint-spec) that provisions the API as a **web service**.

```yaml
# render.yaml (summary)
services:
  - type: web
    name: tenantos-api
    runtime: node
    rootDir: src/backend
    buildCommand: npm install && npm run build
    startCommand: npm start
```

Add the following [environment variables](https://render.com/docs/environment-variables) in your Render dashboard:

- `MONGODB_URI`
- `JWT_SECRET`
- `PAYSTACK_SECRET_KEY`
- `RESEND_API_KEY` + `EMAIL_FROM`
- `REDIS_URL` *(if using Render Redis add-on)*
- `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`
- `FRONTEND_ORIGIN` (your Vercel deployment URL)
- `APP_PUBLIC_URL` (your Render service URL)
- `REQUIRE_EMAIL_VERIFICATION=true`

### Frontend — Vercel

Deploy the `frontend/` directory to Vercel. The included `vercel.json` rewrites all routes to `index.html` for SPA navigation.

```json
// frontend/vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Set the environment variable `VITE_API_BASE_URL` to your Render API URL:

```
VITE_API_BASE_URL=https://your-api.onrender.com/api/v1
```

---

## Testing

### Backend — Integration tests (Vitest + MongoDB Memory Server)

```bash
cd backend
npm test
```

The test suite uses `mongodb-memory-server` and `supertest` — no external database or Redis required. Tests cover auth flows, lease creation, payment recording, and balance calculations.

### Frontend — End-to-end tests (Playwright)

```bash
cd frontend
npm run test:e2e          # headless
npm run test:e2e:ui       # Playwright UI mode
```

Ensure both the backend and frontend dev servers are running before executing e2e tests.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and ensure TypeScript compiles: `npx tsc --noEmit` in both `backend/` and `frontend/`
4. Commit following the project's conventional commit style: `feat:`, `fix:`, `ui:`, `docs:`, etc.
5. Open a pull request

---

## Licence

MIT — see [LICENSE](LICENSE) for details.
