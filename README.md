# Veritlog 🛡️

> **The Intelligent Autonomous Compliance Ledger for Indian Chartered Accountants.**

Veritlog is a full-stack, AI-powered SaaS platform that automates the ingestion, classification, and risk-triage of GST, Income Tax, and regulatory notices for CA firms. It eliminates manual document handling, connects directly to email inboxes, and uses a dual-LLM AI engine to extract critical legal data instantly.

---

## Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Running the Application](#-running-the-application)
- [Scripts](#-scripts)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Security](#-security)

---

## ✨ Features

| Feature | Description |
|---|---|
| **Autonomous Email Ingestion** | Polls a firm's IMAP mailbox every 15 minutes, auto-extracts PDF attachments, and stores them in Amazon S3. |
| **Dual-Core AI Extraction** | Runs Amazon Nova Pro (AWS Bedrock) and Google Gemini 2.0 Flash **in parallel** to extract PAN, GSTIN, demand amount, deadline, and legal section from any Indian tax notice. |
| **Cognitive Risk Triage** | Automatically classifies each notice as `High`, `Medium`, or `Low` risk based on deadline proximity and demand amount. |
| **Instant WhatsApp Alerts** | High-risk notices trigger immediate WhatsApp alerts to the end-client via Twilio. New ingestion alerts also go to the CA. |
| **Client Magic Link Portals** | Generates time-limited, cryptographically signed URLs. Clients can view notices and upload defense documents without an account. |
| **Immutable Audit Ledger** | Every action (ingestion, AI extraction, status change, verification) is permanently logged to Amazon RDS. |
| **Multi-Tenant Security** | Complete row-level data isolation between CA firms powered by Clerk authentication. |
| **Kanban Dashboard** | Drag-and-drop Kanban board for managing the notice lifecycle from `Review Needed` → `In Progress` → `Closed`. |

---

## 🛠 Tech Stack

### Frontend
- **Next.js 15** (App Router + Turbopack)
- **React 19**
- **Tailwind CSS v4**
- **Shadcn/UI** + **Radix UI**
- **TanStack React Query** — data fetching & caching
- **dnd-kit** — drag-and-drop Kanban

### Backend
- **tRPC v11** — end-to-end typesafe API
- **Drizzle ORM** — schema-first PostgreSQL ORM
- **Node.js** Serverless (Vercel)

### AI & Cognitive Engine
- **Amazon Bedrock (Nova Pro)** — primary extraction LLM
- **Google Gemini 2.0 Flash** — secondary extraction LLM
- Parallel execution with confidence-score winner selection

### Infrastructure
- **Amazon S3** — immutable PDF/document vault
- **Amazon RDS (PostgreSQL)** — production relational database
- **Clerk** — authentication & multi-tenant identity
- **Twilio** — WhatsApp API for real-time alerts
- **Vercel** — deployment + cron scheduler

---

## 🏗 Architecture

```
┌───────────────────────────────────────────────────────┐
│                   CLIENT INBOUND                      │
│   Govt Portals / Client Emails → IMAP Poller          │
└─────────────────────────┬─────────────────────────────┘
                          │  1. Intercept Raw Emails
                          ▼
               ┌─────────────────────┐
               │   Veritlog Engine   │
               └──┬──────────────┬───┘
                  │              │
           2. PDFs           3. Metadata
                  │              │
                  ▼              ▼
          ┌──────────┐    ┌───────────────┐
          │ Amazon S3│    │  Amazon RDS   │
          │  Vault   │    │  PostgreSQL   │
          └────┬─────┘    └───────────────┘
               │  4. Stream Document Text
               ▼
      ┌─────────────────────┐
      │   Dual-Engine AI    │
      ├─────────────────────┤
      │  AWS Nova Pro       │──┐
      │  Google Gemini 2.0  │  ├─ Confidence Match → DB Update
      └─────────────────────┘──┘
               │
               ▼  If HIGH RISK
      ┌──────────────────┐
      │   Twilio API     │ ──→  WhatsApp Alert to Client/CA
      └──────────────────┘
```

---

## 📋 Prerequisites

- **Node.js** v20+
- **npm** v10+
- **PostgreSQL** (local or Amazon RDS)
- **AWS Account** with Bedrock (`us-east-1`) & S3 (`ap-south-1`) permissions
- **Clerk** account — [clerk.com](https://clerk.com)
- **Twilio** account with WhatsApp Sandbox enabled — [twilio.com](https://twilio.com)
- **Google AI API Key** — [ai.google.dev](https://ai.google.dev)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-org/veritlog.git
cd veritlog
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)
```

### 4. Push the database schema

```bash
npm run db:push
```

### 5. Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
# ─── Clerk Authentication ─────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# ─── Database (Amazon RDS / PostgreSQL) ───────────────────
DATABASE_URL=postgresql://user:password@host:5432/veritlog

# ─── Amazon AWS ───────────────────────────────────────────
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=veritlog-documents

# ─── AI Models ────────────────────────────────────────────
GEMINI_API_KEY=AIza...
# AWS Bedrock uses the AWS credentials above

# ─── Twilio WhatsApp ──────────────────────────────────────
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155238886
WHATSAPP_CA_PHONE=+91XXXXXXXXXX

# ─── IMAP Email Polling ───────────────────────────────────
EMAIL_IMAP_HOST=imap.titan.email
EMAIL_IMAP_PORT=993
EMAIL_IMAP_USER=notices@yourfirm.com
EMAIL_IMAP_PASS=your-secure-password
# Your Clerk User ID — sets which CA firm receives emailed notices
EMAIL_TENANT_ID=user_clerk_id_here

# ─── App & Security ───────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=your-random-cron-secret
SHARE_TOKEN_SECRET=your-random-share-secret
```

---

## 🗄 Database Setup

Veritlog uses **Drizzle ORM** with PostgreSQL.

```bash
# Push schema changes to the database (development)
npm run db:push

# Generate migration SQL files
npm run db:generate

# Apply generated migrations
npm run db:migrate
```

The schema (`src/server/db/schema.ts`) includes:

| Table | Description |
|---|---|
| `tenants` | CA Firms |
| `clients` | Business entities managed by each CA |
| `notices` | Core compliance notice entity |
| `audit_logs` | Immutable action log with timestamps |
| `attachments` | Client-uploaded defense documents |
| `share_tokens` | Time-limited Magic Links |

---

## ▶️ Running the Application

| Command | Description |
|---|---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate Drizzle migration files |
| `npm run db:migrate` | Apply pending migrations |

---

## 📜 Scripts

### Seed IMAP Inbox (Development / Demo)

Injects 10 diverse mock tax notices directly into the configured IMAP inbox to populate the Kanban dashboard:

```bash
npx tsx scripts/seed-imap.ts
```

Injected test cases include:

| # | Subject | Risk | Entity |
|---|---|---|---|
| 1 | DRC-01 Show Cause Notice | 🟡 Medium | Acme Corp India |
| 2 | GST Intimation (body-only) | 🟢 Low | MarLabs |
| 3 | Phishing/Scam Email | ⬜ Skipped | — |
| 4 | EPFO Non-payment Notice | 🟡 Medium | Acme Corp |
| 5 | Income Tax 143(2) Notice | 🔴 High | Alterann Ind |
| 6 | MCA Director KYC Mismatch | 🟡 Medium | Acme / Alterann |
| 7 | DGGI ₹5 Crore Demand | 🚨 Critical | MarLabs |
| 8 | Bank Account Attachment Order | 🚨 Critical | Alterann Ind |
| 9 | Routine HSN Clarification Request | 🟢 Low | Acme Corp |
| 10 | GST Refund Rejection | 🟢 Low | MarLabs |

---

## 🌐 API Reference

### Cron Endpoints (Internal / Vercel)

All require `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`.

| Endpoint | Schedule | Description |
|---|---|---|
| `GET /api/cron/poll-email` | Every 15 min | Poll IMAP inbox for new notices |
| `GET /api/cron/deadline-reminders` | Daily | Send deadline reminder alerts |
| `GET /api/cron/purge-expired` | Daily | Purge expired share tokens |
| `GET /api/cron/watchdog` | Every 5 min | Health check |

**Manual Trigger:**
```bash
curl "http://localhost:3000/api/cron/poll-email?secret=your-cron-secret"
```

### Public Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/notice/share/[token]` | Client public portal for a shared notice |
| `GET /api/files/[...fileKey]` | Serve files via presigned S3 URLs |
| `POST /api/upload` | Client defense document upload |

---

## 📁 Project Structure

```
veritlog/
├── scripts/
│   └── seed-imap.ts              # Dev data seeder for IMAP inbox
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cron/             # Vercel cron job endpoints
│   │   │   ├── notice/           # Notice API routes (share, audit)
│   │   │   └── upload/           # File upload handler
│   │   ├── dashboard/
│   │   │   ├── kanban/           # Kanban board UI
│   │   │   ├── verify/[id]/      # Notice detail & verification
│   │   │   ├── upload/           # Manual PDF upload
│   │   │   └── clients/          # Client management UI
│   │   ├── portal/               # Client self-service portal
│   │   └── sign-in/ sign-up/     # Auth pages
│   ├── server/
│   │   ├── api/
│   │   │   └── routers/
│   │   │       ├── notice.ts     # Core notice logic (AI, CRUD, risk)
│   │   │       ├── client.ts     # Client management
│   │   │       ├── audit.ts      # Audit log queries
│   │   │       └── stats.ts      # Dashboard statistics
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle DB schema
│   │   │   └── index.ts          # DB connection
│   │   └── services/
│   │       ├── imap.ts           # Email polling engine + CA WhatsApp alert
│   │       ├── extraction.ts     # Dual-AI extraction (Bedrock + Gemini)
│   │       ├── storage.ts        # S3 upload / presigned URL helpers
│   │       ├── twilio.ts         # WhatsApp alert functions
│   │       └── shareToken.ts     # Magic link token generation
│   └── tests/
│       └── security/             # Tenant isolation security tests
├── .env                          # Environment variables (gitignored!)
├── vercel.json                   # Vercel deployment & cron configuration
└── package.json
```

---

## 🔒 Security

- **Multi-Tenancy**: Every DB query is filtered by `tenantId`. Row-level isolation is enforced at the ORM level — Firm A cannot access Firm B's data.
- **S3 Access**: Public bucket access is disabled. All document URLs are time-limited AWS presigned URLs.
- **Magic Links**: Share tokens are HMAC-signed with `SHARE_TOKEN_SECRET` and have configurable TTLs.
- **AI Data Privacy**: AWS Bedrock legally guarantees that customer data is **never** used for model training.
- **Clerk Auth**: SSO-ready, supports MFA, and provides cryptographic session tokens.

---

## 📄 License

© 2026 Veritlog. All rights reserved. Proprietary software.
