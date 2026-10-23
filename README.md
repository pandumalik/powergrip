# PowerGrip: Managed Service Provider & Privileged Access Governance Platform

**PowerGrip** is an enterprise-grade **Managed Service Provider (MSP) and Privileged Access Management (PAM)** platform. It unites dynamic multi-cloud asset discovery (CMDB), multi-tenant client lifecycle and SLA governance, embedded project squad rosters, zero-trust time-bounded privilege escalation, and organizational hierarchy tracking into a single glassmorphic command center.

The backend is built in pure **Rust (Axum + Tokio + SQLx)** for ultra-high throughput, low memory footprint, and native containerization, paired with a modern **React 19 + Vite + Tailwind CSS** frontend.

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
                               │       PowerGrip Pure Rust Backend      │
                               │        Axum 0.7 • SQLx 0.8 • Tokio     │
                               └───┬──────────────┬─────────────────┬───┘
                                   │              │                 │
            ┌──────────────────────┴───┐    ┌─────┴──────────┐   ┌──┴───────────────────┐
            │  PostgreSQL 17 Database  │    │  Keycloak 26   │   │ HashiCorp Vault / SSH│
            │  11 Tables • JSONB • ltree │    │  OIDC & RBAC   │   │  CA & Ephemeral Certs│
            └──────────────────────────┘    └────────────────┘   └──────────────────────┘
```

---

## 🚀 Key Modules & Capabilities

### 1. ⚡ High-Performance Pure Rust Microservice
- **Zero-Overhead Web Service**: Built with **Axum 0.7**, **Tokio** multi-threaded async runtime, and **SQLx 0.8** connection pool.
- **Microsecond Latency**: Direct PostgreSQL connection pooling with prepared statements and JSON aggregation (`json_build_object`, `COALESCE`).
- **Multi-Stage Containerization**: Minimalist production Docker container built on Debian Slim runtime (`~80MB` image vs `1GB+` Node images).

### 2. 🗄️ Single-Table CMDB & GCP Continuous Discovery
- **Multi-Cloud Inventory Management**: Unified PostgreSQL catalog tracking Virtual Machines, Cloud Projects, Kubernetes clusters, VPCs, Object Storage buckets, and Databases across `GCP`, `AWS`, `AZURE`, `ALI_CLOUD`, `DIGITAL_OCEAN`, and `ON_PREMISE`.
- **Live Google Cloud Discovery**: Dynamic scanner querying GCP Resource Manager and Compute APIs via service account credentials with selective multi-project import.
- **Continuous Drift Engine**: Automatically detects config drift (e.g. machine type shifts, external IP alterations, status changes) and logs audit events to `inventory_history`.
- **Bulk Lifecycle Operations**: Select all / batch deletion with cascade protection.

### 3. 🏢 Multi-Tenant Client & Contract Lifecycle
- **Enterprise Client Accounts**: Global multi-currency customer records with contact and billing metadata.
- **Signed SLAs & Service Contracts**: Embedded contract tracking (`MANAGED_SERVICE`, `FIXED_PROJECT`, `SLA_SUPPORT`, etc.) with SLA levels and validity timeframes.
- **Dynamic Industry Taxonomy**: Searchable and creatable industry classification stored in the database `MISC` catalog.
- **Bulk Client Actions**: Batch selection and deletion with full relation integrity checks.

### 4. 📁 Projects & Embedded Squad Rosters
- **Zero-Join JSONB Roster**: Project staffing embedded directly inside project records for ultra-fast queries without heavy table joins.
- **Project Role Specializations**: Lead Architect, Senior SRE, DevOps Engineer, Security Officer, QA Engineer.
- **Client Association**: Direct linking between client accounts, contracts, and engineering projects.
- **Bulk Project Actions**: Checkbox selection and multi-project deletion.

### 5. 🔐 Zero-Trust Privileged Access Management (PAM)
- **Time-Bounded Access Escalation**: Just-In-Time (JIT) access requests with configurable TTL duration (1h, 2h, 4h, 8h, 24h).
- **Multi-Tier Privilege Levels**: `READ_ONLY`, `OPERATOR`, `READ_WRITE`, `ADMIN`, `ROOT_SUPERADMIN`.
- **Approval Workflow Queue**: Dedicated pending approval queue with interactive approve, decline, and emergency revocation controls.
- **Staff Requester Selector**: Issue access grants on behalf of any organization staff member with validation.
- **Live Audit Trail**: Comprehensive session logging capturing timestamps, actions, IP addresses, and session IDs.
- **Bulk Grant Actions**: Multi-select deletion and mass revocation.

### 6. 👥 Organization Hierarchy & Employee Directory
- **`ltree`-Powered Org Tree**: Subtree employee queries and corporate reporting lines.
- **Staff Profile & Assigned Resources Modal**: Inspect any staff member's full profile, active client project assignments, and accessible infrastructure/PAM grants in real-time.
- **One-Click Offboarding**: Instantly offboard staff and terminate all active privileged sessions and SSH keys.
- **Bulk Staff Actions**: Batch selection and directory deletion.

### 7. 🔑 Zero-Key GCP IAM Local Sync & Authentication
- **Dedicated Glassmorphic Login Gateway**: Unauthenticated visitors are routed to a secure login page supporting 1-click Google Cloud IAM sign-in, standard credentials, and quick sandbox role testing.
- **Direct Local GCP CLI Credential Sharing**: Uses existing local active `gcloud` identity (`Viewer` / admin role) to discover projects and cloud assets (VMs, Buckets, GKE, Cloud SQL) across all accessible GCP subscriptions without needing exported Service Account JSON private keys.
- **Admin Auto-Escalation**: Configured Superadmin identity (`muhammad.galang@ist.id`) is automatically recognized with full administrative and MSP oversight privileges.

---

## 📁 Repository Structure

```text
├── additional/
│   ├── docker-compose.yml       # PostgreSQL 17, Backend Service, Keycloak 26, Vault, Redis, MinIO
│   ├── init-db/
│   │   └── 01-init.sql          # PostgreSQL DDL schema with idempotent types & ltree
│   ├── keycloak/                # Pre-configured realm export with demo roles
│   └── vault/                   # HashiCorp Vault SSH CA configuration script
│
├── backend/                     # High-performance Rust backend service
│   ├── Cargo.toml               # Axum, Tokio, SQLx, Serde, Tower dependencies
│   ├── Cargo.lock
│   ├── Dockerfile               # Multi-stage builder & slim runtime
│   ├── .dockerignore
│   └── src/
│       ├── main.rs              # Application entrypoint & Axum router
│       ├── config.rs            # AppConfig environment loader
│       ├── db.rs                # SQLx PostgreSQL pool connection
│       ├── error.rs             # Unified AppError & JSON response mapper
│       ├── models/              # Strongly-typed models (Client, Project, Access, Employee, Inventory)
│       ├── routes/              # REST controllers for /api/v1/*
│       └── services/            # GCP discovery engine & background workers
│
├── frontend/                    # Modern React 19 single-page application
│   ├── src/
│   │   ├── components/          # BulkActionToolbar, ConfirmationModal, StatusBadge, etc.
│   │   ├── pages/               # Dashboard, Clients, Projects, Inventories, Access, Org Tree
│   │   ├── services/            # API client with synchronous caching & fallback mocks
│   │   └── types/               # TypeScript domain models
│   ├── package.json
│   └── vite.config.ts
│
└── .gitignore                   # Ignores Rust target/, binaries, node_modules, logs, secrets
```

---

## ⚡ Quick Start & Development Setup

### 1. Start Infrastructure Services
Launch PostgreSQL 17 and dependent support containers:
```bash
docker compose -f additional/docker-compose.yml up -d powergrip-postgres
```
*(The schema in `additional/init-db/01-init.sql` runs automatically on first boot).*

### 2. Configure Environment Variables
Create or verify `.env` in `backend/`:
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
RUST_LOG=info
```

### 3. Run Backend (Rust)

**Native Development:**
```bash
cd backend
cargo run
# Backend listening on http://0.0.0.0:4000
# Health check: http://localhost:4000/api/v1/health
```

**Or Run via Docker:**
```bash
docker compose -f additional/docker-compose.yml up -d --build backend
```

### 4. Start Frontend Portal
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
| **Backend REST API** | `http://localhost:4000/api/v1` | Pure Rust Axum 0.7 Microservice |
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
