# PowerGrip: Managed Service Provider & Privileged Access Governance Platform

**PowerGrip** is an enterprise-grade **Managed Service Provider (MSP) and Privileged Access Management (PAM)** platform. It unites dynamic multi-cloud asset discovery (CMDB), multi-tenant client lifecycle and SLA governance, embedded project squad rosters, zero-trust time-bounded privilege escalation, and organizational hierarchy tracking into a single glassmorphic command center.

---

## 🏗️ System Architecture

```text
                               ┌────────────────────────────────────────┐
                               │           PowerGrip Web Portal         │
                               │        React 19 + Vite + Tailwind      │
                               └──────────────────┬─────────────────────┘
                                                  │ (REST / JSON)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │     PowerGrip NestJS API Gateway       │
                               │   Fastify • Swagger • Drizzle ORM      │
                               └───┬──────────────┬─────────────────┬───┘
                                   │              │                 │
            ┌──────────────────────┴───┐    ┌─────┴──────────┐   ┌──┴───────────────────┐
            │  PostgreSQL 17 Database  │    │  Keycloak 26   │   │ HashiCorp Vault / SSH│
            │  11 Tables • JSONB • ltree │    │  OIDC & RBAC   │   │  CA & Ephemeral Certs│
            └──────────────────────────┘    └────────────────┘   └──────────────────────┘
```

---

## 🚀 Key Modules & Capabilities

### 1. 🗄️ Single-Table CMDB & GCP Continuous Discovery
- **Multi-Cloud Inventory Management**: Unified PostgreSQL catalog tracking Virtual Machines, Cloud Projects, Kubernetes clusters, VPCs, Object Storage buckets, and Databases across `GCP`, `AWS`, `AZURE`, `ALI_CLOUD`, `DIGITAL_OCEAN`, and `ON_PREMISE`.
- **Live Google Cloud Discovery**: Dynamic scanner querying GCP Resource Manager and Compute APIs via service account credentials with selective multi-project import.
- **Continuous Drift Engine**: Automatically detects config drift (e.g. machine type shifts, external IP alterations, status changes) and logs audit events to `inventory_history`.
- **Bulk Lifecycle Operations**: Select all / batch deletion with cascade protection.

### 2. 🏢 Multi-Tenant Client & Contract Lifecycle
- **Enterprise Client Accounts**: Global multi-currency customer records with contact and billing metadata.
- **Signed SLAs & Service Contracts**: Embedded contract tracking (`MANAGED_SERVICE`, `FIXED_PROJECT`, `SLA_SUPPORT`, etc.) with SLA levels and validity timeframes.
- **Dynamic Industry Taxonomy**: Searchable and creatable industry classification stored in the database `MISC` catalog.
- **Bulk Client Actions**: Batch selection and deletion with full relation integrity checks.

### 3. 📁 Projects & Embedded Squad Rosters
- **Zero-Join JSONB Roster**: Project staffing embedded directly inside project records for ultra-fast queries without heavy table joins.
- **Project Role Specializations**: Lead Architect, Senior SRE, DevOps Engineer, Security Officer, QA Engineer.
- **Client Association**: Direct linking between client accounts, contracts, and engineering projects.
- **Bulk Project Actions**: Checkbox selection and multi-project deletion.

### 4. 🔐 Zero-Trust Privileged Access Management (PAM)
- **Time-Bounded Access Escalation**: Just-In-Time (JIT) access requests with configurable TTL duration (1h, 2h, 4h, 8h, 24h).
- **Multi-Tier Privilege Levels**: `READ_ONLY`, `OPERATOR`, `READ_WRITE`, `ADMIN`, `ROOT_SUPERADMIN`.
- **Approval Workflow Queue**: Dedicated pending approval queue with interactive approve, decline, and emergency revocation controls.
- **Staff Requester Selector**: Issue access grants on behalf of any organization staff member with validation.
- **Live Audit Trail**: Comprehensive session logging capturing timestamps, actions, IP addresses, and session IDs.
- **Bulk Grant Actions**: Multi-select deletion and mass revocation.

### 5. 👥 Organization Hierarchy & Employee Directory
- **`ltree`-Powered Org Tree**: Subtree employee queries and corporate reporting lines.
- **Staff Profile & Assigned Resources Modal**: Inspect any staff member's full profile, active client project assignments, and accessible infrastructure/PAM grants in real-time.
- **One-Click Offboarding**: Instantly offboard staff and terminate all active privileged sessions and SSH keys.
- **Bulk Staff Actions**: Batch selection and directory deletion.

---

## 📁 Repository Structure

```text
├── additional/
│   ├── docker-compose.yml       # PostgreSQL 17, Keycloak 26, Vault, Redis, MinIO
│   ├── init-db/
│   │   └── 01-init.sql          # PostgreSQL DDL schema with idempotent types & ltree
│   ├── keycloak/                # Pre-configured realm export with demo roles
│   └── vault/                   # HashiCorp Vault SSH CA configuration script
│
├── backend/
│   ├── src/
│   │   ├── config/              # Environment, DB, Redis, Keycloak, Vault configs
│   │   ├── database/            # Drizzle ORM schema, migrations, and seed scripts
│   │   ├── common/              # Fastify guards, auth decorators, exceptions
│   │   └── services/            # Microservice domains:
│   │       ├── access-service/  # PAM requests, approvals, TTL expiry, audit logs
│   │       ├── client-service/  # Enterprise clients, contracts, MISC industries
│   │       ├── employee-service/# Org hierarchy, employees, departments
│   │       ├── inventory-service# CMDB, GCP discovery scanner, drift engine
│   │       └── project-service/ # Projects and embedded JSONB squad rosters
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/          # BulkActionToolbar, ConfirmationModal, StatusBadge, etc.
│   │   ├── pages/               # Dashboard, Clients, Projects, Inventories, Access, Org Tree
│   │   ├── services/            # API client with error handling and fallback mocks
│   │   └── types/               # TypeScript domain models
│   ├── package.json
│   └── vite.config.ts
│
└── prompt/
    └── fix.txt                  # User requirements & change logs
```

---

## ⚡ Quick Start & Development Setup

### 1. Start Infrastructure Services
Launch PostgreSQL 17, Keycloak, HashiCorp Vault, Redis, and MinIO:
```bash
docker compose -f additional/docker-compose.yml up -d
```

### 2. Configure Environment Variables
Ensure `.env` exists in `backend/`:
```env
PORT=4000
DATABASE_URL=postgresql://powergrip_user:powergrip_secret_2026@localhost:5432/powergrip
REDIS_HOST=localhost
REDIS_PORT=6379
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=powergrip-realm
KEYCLOAK_CLIENT_ID=powergrip-backend
KEYCLOAK_CLIENT_SECRET=powergrip-secret-key-2026
VAULT_URL=http://localhost:8200
VAULT_TOKEN=powergrip-vault-root-token
NODE_ENV=development
```

### 3. Initialize Database & Clean Slate Seed
Run migrations and the clean-slate seed (provisions foundational departments, 20 employee directory records, and the industry catalog while keeping resource tables ready for manual data entry):
```bash
cd backend
npm install
npm run migrate
npm run seed
```

### 4. Start Backend Server
```bash
cd backend
npm run dev
# API Gateway listening on http://localhost:4000/api/v1
# Swagger Documentation: http://localhost:4000/api/docs
```

### 5. Start Frontend Portal
```bash
cd frontend
npm install
npm run dev
# React Web Portal listening on http://localhost:5173
```

---

## 🌐 Default Ports & Access Points

| Service | URL / Port | Credentials / Purpose |
| :--- | :--- | :--- |
| **PowerGrip Frontend** | `http://localhost:5173` | React 19 Glassmorphic Dashboard |
| **Backend REST API** | `http://localhost:4000/api/v1` | Fastify Microservice API Gateway |
| **PostgreSQL 17** | `localhost:5432` | `powergrip_user` / `powergrip_secret_2026` |
| **Keycloak IAM** | `http://localhost:8080` | `admin` / `admin_powergrip_2026` |
| **HashiCorp Vault** | `http://localhost:8200` | Token: `powergrip-vault-root-token` |
| **MinIO Console** | `http://localhost:9001` | `powergrip_minio` / `minio_secret_2026` |
| **Redis Cache** | `localhost:6379` | Ephemeral caching & pub/sub |

---

## 🔒 Privileged Access Lifecycle

1. **Request Access**: A requester chooses a target inventory asset, requested privilege level (`OPERATOR`, `READ_WRITE`, `ADMIN`, `ROOT_SUPERADMIN`), TTL hours, and provides a business justification.
2. **Review & Approval**: Administrators review justifications in the Pending Queue, endorse/approve, or decline requests.
3. **Active Matrix**: Approved grants become active with real-time countdown timers.
4. **Instant Revocation**: Any grant or offboarded employee can be immediately revoked, logging audit records in the security registry.

---

## 📄 License
Internal Proprietary — PowerGrip Managed Services & PAM.
