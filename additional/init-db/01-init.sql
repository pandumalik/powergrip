-- =============================================================================
-- V-CAMS (Vendor-Client Asset Management System)
-- PostgreSQL 17 Database Initialization Script
-- =============================================================================

-- 1. Create Keycloak Dedicated Schema (for co-located Keycloak instance)
CREATE SCHEMA IF NOT EXISTS keycloak;

-- 2. Enable Required PostgreSQL 17 Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =============================================================================
-- 3. Enumerated Types (ENUMs)
-- =============================================================================
DO $$ BEGIN CREATE TYPE client_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT', 'SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE contract_type_enum AS ENUM ('MANAGED_SERVICE', 'FIXED_PROJECT', 'TIME_AND_MATERIALS', 'CONSULTING', 'SLA_SUPPORT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE contract_status_enum AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWAL_PENDING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE project_type_enum AS ENUM ('INFRA_MIGRATION', 'MANAGED_DEVOPS', 'CLOUD_ARCHITECTURE', 'SECURITY_AUDIT', 'INTERNAL_TOOLING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE project_status_enum AS ENUM ('INITIATION', 'PLANNING', 'IN_PROGRESS', 'MAINTENANCE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE project_role_enum AS ENUM ('PROJECT_MANAGER', 'LEAD_ARCHITECT', 'SENIOR_SRE', 'DEVOPS_ENGINEER', 'SECURITY_ANALYST', 'QA_ENGINEER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE employment_status_enum AS ENUM ('ACTIVE', 'PROBATION', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unified Inventory ENUMs
DO $$ BEGIN CREATE TYPE asset_scope_enum AS ENUM ('INTERNAL', 'CLIENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_type_enum AS ENUM (
    'VIRTUAL_MACHINE', 
    'CLOUD_ACCOUNT', 
    'VPN_GATEWAY', 
    'DATABASE', 
    'KUBERNETES', 
    'STORAGE_BUCKET', 
    'NETWORK_VPC', 
    'OTHER'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE environment_enum AS ENUM ('PROD', 'STAGING', 'DEV', 'QA', 'DR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_status_enum AS ENUM ('ACTIVE', 'MAINTENANCE', 'PROVISIONING', 'DECOMMISSIONED', 'ISOLATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cloud_provider_enum AS ENUM ('AWS', 'GCP', 'ALI_CLOUD', 'DIGITAL_OCEAN', 'AZURE', 'ON_PREMISE', 'HYBRID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unified Access Management ENUMs
DO $$ BEGIN CREATE TYPE access_level_enum AS ENUM ('READ_ONLY', 'OPERATOR', 'READ_WRITE', 'ADMIN', 'ROOT_SUPERADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE access_grant_type_enum AS ENUM ('PERMANENT', 'TEMPORARY_TIMED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE access_status_enum AS ENUM ('PENDING', 'ENDORSED', 'ACTIVE', 'REJECTED', 'EXPIRED', 'REVOKED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. Utility Trigger Function for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. Clients Table (Unified with Address, Country & Timezone)
-- =============================================================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status client_status_enum NOT NULL DEFAULT 'ACTIVE',
    industry VARCHAR(100),
    billing_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    country VARCHAR(100) NOT NULL DEFAULT 'Indonesia',
    city VARCHAR(100),
    address TEXT,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 6. Contracts Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    contract_type contract_type_enum NOT NULL DEFAULT 'MANAGED_SERVICE',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    sla_level VARCHAR(100) NOT NULL DEFAULT '99.9% High Availability',
    status contract_status_enum NOT NULL DEFAULT 'ACTIVE',
    value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    document_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_contract_dates CHECK (end_date >= start_date)
);

-- =============================================================================
-- 7. Departments & Hierarchical Employee Schema (ltree + Keycloak User Mapping)
-- =============================================================================
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, -- Mapped directly to Keycloak User ID (sub claim)
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    employee_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    job_title VARCHAR(150) NOT NULL,
    hierarchy_path LTREE, -- e.g. root.director_id.manager_id.emp_id
    employment_status employment_status_enum NOT NULL DEFAULT 'ACTIVE',
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    exit_date DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_employment_dates CHECK (exit_date IS NULL OR exit_date >= join_date)
);

-- Circular reference foreign key for department head
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS head_of_department_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- =============================================================================
-- 8. Projects Table (with Embedded assigned_members JSONB)
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    project_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    project_type project_type_enum NOT NULL DEFAULT 'MANAGED_DEVOPS',
    status project_status_enum NOT NULL DEFAULT 'IN_PROGRESS',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    description TEXT,
    assigned_members JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. [{"employee_id": "...", "role": "LEAD_ARCHITECT", "assigned_at": "2026-03-01"}]
    tags JSONB DEFAULT '[]'::jsonb,
    version INT NOT NULL DEFAULT 1, -- Optimistic concurrency control
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 9. Unified Inventories Table (Single CMDB Table for All Assets)
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL, -- NULL = Internal Company Asset
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    asset_tag VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    asset_scope asset_scope_enum NOT NULL DEFAULT 'CLIENT',
    asset_type asset_type_enum NOT NULL DEFAULT 'VIRTUAL_MACHINE',
    environment environment_enum NOT NULL DEFAULT 'PROD',
    status asset_status_enum NOT NULL DEFAULT 'ACTIVE',
    provider cloud_provider_enum NOT NULL DEFAULT 'AWS',
    region VARCHAR(100) NOT NULL,
    primary_ip INET,
    specs JSONB NOT NULL DEFAULT '{}'::jsonb,
    connection_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 10. Unified Access Grants Table (Lifecycle: Request -> Active -> Revoked)
-- =============================================================================
CREATE TABLE IF NOT EXISTS access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    access_level access_level_enum NOT NULL DEFAULT 'READ_WRITE',
    grant_type access_grant_type_enum NOT NULL DEFAULT 'TEMPORARY_TIMED',
    status access_status_enum NOT NULL DEFAULT 'PENDING',
    justification TEXT NOT NULL,
    requested_start_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    requested_end_time TIMESTAMPTZ,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    revoked_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id UUID REFERENCES access_grants(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE RESTRICT,
    action VARCHAR(100) NOT NULL,
    ip_address INET,
    session_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 10.1 MISC Store Table (Dynamic taxonomy, key-value pairs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS misc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(128) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 10.2 Cloud Credentials & Service Account Key Blob Store
-- =============================================================================
CREATE TABLE IF NOT EXISTS cloud_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider cloud_provider_enum NOT NULL DEFAULT 'GCP',
    key_blob JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    auto_scan_interval VARCHAR(50) NOT NULL DEFAULT '1h',
    is_active INT NOT NULL DEFAULT 1,
    last_scanned_at TIMESTAMPTZ,
    scan_status VARCHAR(50) NOT NULL DEFAULT 'IDLE',
    last_scan_error TEXT,
    last_scan_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 10.3 Inventory Historical Change Audit Logs / Drift Tracker
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    service_account_id UUID REFERENCES cloud_credentials(id) ON DELETE SET NULL,
    change_type VARCHAR(50) NOT NULL,
    change_summary TEXT NOT NULL,
    previous_state JSONB DEFAULT '{}'::jsonb,
    new_state JSONB DEFAULT '{}'::jsonb,
    source VARCHAR(50) NOT NULL DEFAULT 'AUTOMATED_SCAN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 11. Performance Indexes (B-Tree, GIN, GiST)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_cloud_credentials_provider_active ON cloud_credentials(provider, is_active);
CREATE INDEX IF NOT EXISTS idx_cloud_credentials_client ON cloud_credentials(client_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_inventory ON inventory_history(inventory_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_history_sa ON inventory_history(service_account_id);

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_contracts_client_status ON contracts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_client_status ON projects(client_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_members_gin ON projects USING GIN (assigned_members);
CREATE INDEX IF NOT EXISTS idx_projects_tags_gin ON projects USING GIN (tags);

-- Hierarchical Tree GIST Index & Keycloak User Index
CREATE INDEX IF NOT EXISTS idx_employees_hierarchy_gist ON employees USING GIST (hierarchy_path);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);

-- Unified Inventories Indexes
CREATE INDEX IF NOT EXISTS idx_inventories_scope_type ON inventories(asset_scope, asset_type, status);
CREATE INDEX IF NOT EXISTS idx_inventories_client_project ON inventories(client_id, project_id);
CREATE INDEX IF NOT EXISTS idx_inventories_provider ON inventories(provider);
CREATE INDEX IF NOT EXISTS idx_inventories_ip ON inventories(primary_ip);
CREATE INDEX IF NOT EXISTS idx_inventories_specs_gin ON inventories USING GIN (specs);
CREATE INDEX IF NOT EXISTS idx_inventories_conn_gin ON inventories USING GIN (connection_info);
CREATE INDEX IF NOT EXISTS idx_inventories_tags_gin ON inventories USING GIN (tags);

-- Unified Access Management Indexes
CREATE INDEX IF NOT EXISTS idx_access_grants_status_emp ON access_grants(status, employee_id);
CREATE INDEX IF NOT EXISTS idx_access_grants_active ON access_grants(employee_id, inventory_id, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_access_grants_pending ON access_grants(status, requested_start_time) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_access_grants_expiry ON access_grants(valid_until) WHERE status = 'ACTIVE' AND valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_audit_emp_inv ON access_audit_logs(employee_id, inventory_id, created_at DESC);

-- =============================================================================
-- 12. Apply Trigger Functions
-- =============================================================================
DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_contracts_updated ON contracts;
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_departments_updated ON departments;
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_employees_updated ON employees;
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_inventories_updated ON inventories;
CREATE TRIGGER trg_inventories_updated BEFORE UPDATE ON inventories FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_access_grants_updated ON access_grants;
CREATE TRIGGER trg_access_grants_updated BEFORE UPDATE ON access_grants FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- =============================================================================
-- 13. Analytical Views
-- =============================================================================
CREATE OR REPLACE VIEW v_active_access_matrix AS
SELECT 
    ag.id AS grant_id,
    e.id AS employee_id,
    e.user_id AS keycloak_user_id,
    e.employee_number,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    e.email AS employee_email,
    e.job_title,
    i.id AS inventory_id,
    i.asset_tag,
    i.name AS asset_name,
    i.asset_scope,
    i.asset_type,
    i.provider,
    i.environment,
    i.primary_ip,
    c.name AS client_name,
    p.name AS project_name,
    ag.access_level,
    ag.grant_type,
    ag.valid_from,
    ag.valid_until,
    CASE 
        WHEN ag.valid_until IS NULL THEN 'INDEFINITE'
        ELSE CONCAT(ROUND(EXTRACT(EPOCH FROM (ag.valid_until - CURRENT_TIMESTAMP))/3600, 1), ' hours remaining')
    END AS validity_duration
FROM access_grants ag
JOIN employees e ON ag.employee_id = e.id
JOIN inventories i ON ag.inventory_id = i.id
LEFT JOIN clients c ON i.client_id = c.id
LEFT JOIN projects p ON i.project_id = p.id
WHERE ag.status = 'ACTIVE'
  AND (ag.valid_until IS NULL OR ag.valid_until > CURRENT_TIMESTAMP);

CREATE OR REPLACE VIEW v_employee_hierarchy_tree AS
WITH RECURSIVE org_tree AS (
    SELECT 
        e.id,
        e.user_id,
        e.employee_number,
        CONCAT(e.first_name, ' ', e.last_name) AS full_name,
        e.email,
        e.job_title,
        e.manager_id,
        d.name AS department_name,
        1 AS level,
        CAST(CONCAT(e.first_name, ' ', e.last_name) AS TEXT) AS reporting_chain
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE e.manager_id IS NULL AND e.employment_status = 'ACTIVE'
    
    UNION ALL
    
    SELECT 
        sub.id,
        sub.user_id,
        sub.employee_number,
        CONCAT(sub.first_name, ' ', sub.last_name) AS full_name,
        sub.email,
        sub.job_title,
        sub.manager_id,
        d.name AS department_name,
        ot.level + 1 AS level,
        CONCAT(ot.reporting_chain, ' -> ', sub.first_name, ' ', sub.last_name) AS reporting_chain
    FROM employees sub
    JOIN org_tree ot ON sub.manager_id = ot.id
    LEFT JOIN departments d ON sub.department_id = d.id
    WHERE sub.employment_status = 'ACTIVE'
)
SELECT * FROM org_tree ORDER BY level, reporting_chain;

-- =============================================================================
-- 14. Seed Initial Demonstration Data
-- =============================================================================
INSERT INTO departments (id, code, name) VALUES 
('d1111111-1111-1111-1111-111111111111', 'EXEC', 'Executive Management'),
('d2222222-2222-2222-2222-222222222222', 'CLOUD_OPS', 'Cloud Infrastructure & SRE'),
('d3333333-3333-3333-3333-333333333333', 'SEC_ENG', 'Security Engineering & Compliance')
ON CONFLICT (id) DO NOTHING;

INSERT INTO clients (id, code, name, industry, billing_email, country, city, address, timezone) VALUES 
('a9876543-b123-4567-8901-cdef01234567', 'CLI-FINTECH-ID', 'PT Nusantara Fintech Mandiri', 'Financial Services', 'finance@nusantarafintech.id', 'Indonesia', 'Jakarta Selatan', 'Pacific Century Place Level 21, SCBD', 'Asia/Jakarta'),
('b9876543-b123-4567-8901-cdef01234568', 'CLI-LOGISTICS-SG', 'Asean Express Logistics Pte Ltd', 'Supply Chain', 'billing@aseanexpress.com', 'Singapore', 'Singapore', '71 Robinson Road #14-01', 'Asia/Singapore')
ON CONFLICT (id) DO NOTHING;

INSERT INTO contracts (id, client_id, contract_number, title, contract_type, start_date, end_date, sla_level, status, value, currency) VALUES
('c1234567-8901-2345-6789-012345678901', 'a9876543-b123-4567-8901-cdef01234567', 'CTR-2026-GCP-009', 'Managed Cloud Infrastructure & 24/7 SRE', 'MANAGED_SERVICE', '2026-01-01', '2026-12-31', '99.99% Critical SLA', 'ACTIVE', 180000.00, 'USD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, department_id, employee_number, first_name, last_name, email, job_title, employment_status, join_date, metadata) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd1111111-1111-1111-1111-111111111111', 'EMP-ADM-001', 'Muhammad', 'Galang', 'muhammad.galang@ist.id', 'Principal Cloud Architect & PowerGrip Superadmin', 'ACTIVE', '2024-01-01', '{"role": "ADMIN", "is_superadmin": true, "gcp_iam_connected": true, "gcp_email": "muhammad.galang@ist.id"}'::jsonb)
ON CONFLICT (email) DO NOTHING;

