# V-CAMS: Multi-Tenant Vendor & Client Asset Management System

An enterprise-grade **Managed Service Provider (MSP) & Privileged Access Management (PAM)** platform for managing client and internal infrastructure (VMs, Cloud Accounts, VPNs, Kubernetes, Databases), signed contracts, engineering squads, and zero-trust time-bounded access grants.

---

## 📁 Repository Structure

```text
├── additional/           # Supporting infrastructure & Docker configurations
│   ├── docker-compose.yml# PostgreSQL 17, Keycloak 26, Vault, Redis, MinIO, NATS
│   ├── init-db/          # PostgreSQL 17 DDL initialization script
│   ├── keycloak/         # Preconfigured realm export with demo users & roles
│   ├── vault/            # HashiCorp Vault SSH CA configuration script
│   └── .env.example      # Environment variables template
│
├── backend/              # NestJS (TypeScript) Fastify modular domain microservices
│   ├── src/
│   │   ├── config/       # Keycloak, Database, Redis, Vault configuration
│   │   ├── database/     # Drizzle ORM schema for PostgreSQL 17 (ltree, JSONB)
│   │   ├── common/       # Auth guards, role decorators, Fastify security
│   │   └── services/     # Domain services (Clients, Projects, Employees, Inventories, Access)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/             # React 19 (TypeScript) + Vite + Tailwind CSS Dashboard
│   ├── src/
│   │   ├── components/   # Sidebar, Navbar, MetricCards, JsonViewer modals
│   │   ├── pages/        # Dashboard, Clients, Projects, CMDB, PAM Access, Org Tree
│   │   ├── services/     # API client with seamless mock/live backend toggle
│   │   └── types/        # Domain TypeScript models
│   ├── package.json
│   └── vite.config.ts
│
└── prompt/
    └── instruction.md    # Master architecture & technical specification document
```

---

## 🚀 Quick Start Guide

### 1. (Optional) Start Supporting Infrastructure
To launch PostgreSQL 17, Keycloak 26, HashiCorp Vault, Redis, and MinIO:
```bash
cd additional
docker compose up -d
```

### 2. Run Backend Application
```bash
cd backend
npm install
npm run dev
# API Gateway runs on http://localhost:4000/api/v1
```

### 3. Run Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
# React Web Portal runs on http://localhost:5173
```

---

## 🛡️ Core Capabilities

* **Unified Single-Table CMDB**: Unified PostgreSQL 17 table managing multi-cloud resources (`GCP`, `AWS`, `ALI_CLOUD`, `DIGITAL_OCEAN`, `ON_PREMISE`) with indexable JSONB specs.
* **Embedded Project Staffing**: Squad members tracked directly in project records with zero join performance overhead.
* **Privileged Access Management (PAM)**: Temporary, time-bounded access requests with multi-level approval workflows and HashiCorp Vault ephemeral SSH certificate integration.
* **Hierarchical Org Tree**: Subtree employee queries powered by PostgreSQL 17 `ltree`.
* **Keycloak IAM Integration**: OpenID Connect, OAuth2, and multi-role personas (`ADMIN`, `SRE_LEAD`, `DEVOPS_ENGINEER`, `SECURITY_OFFICER`).
