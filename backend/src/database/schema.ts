import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  date,
  jsonb,
  integer,
  pgEnum,
  inet,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom ltree column type for PostgreSQL 17
export const ltree = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'ltree';
  },
  toDriver(value: string) {
    return value;
  },
  fromDriver(value: string) {
    return value;
  },
});

// =============================================================================
// PostgreSQL Enums (with as const for full TypeScript type safety)
// =============================================================================
export const clientStatusEnum = pgEnum('client_status_enum', ['ACTIVE', 'INACTIVE', 'PROSPECT', 'SUSPENDED'] as const);
export const contractTypeEnum = pgEnum('contract_type_enum', ['MANAGED_SERVICE', 'FIXED_PROJECT', 'TIME_AND_MATERIALS', 'CONSULTING', 'SLA_SUPPORT'] as const);
export const contractStatusEnum = pgEnum('contract_status_enum', ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWAL_PENDING'] as const);
export const projectTypeEnum = pgEnum('project_type_enum', ['INFRA_MIGRATION', 'MANAGED_DEVOPS', 'CLOUD_ARCHITECTURE', 'SECURITY_AUDIT', 'INTERNAL_TOOLING'] as const);
export const projectStatusEnum = pgEnum('project_status_enum', ['INITIATION', 'PLANNING', 'IN_PROGRESS', 'MAINTENANCE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] as const);
export const projectRoleEnum = pgEnum('project_role_enum', ['PROJECT_MANAGER', 'LEAD_ARCHITECT', 'SENIOR_SRE', 'DEVOPS_ENGINEER', 'SECURITY_ANALYST', 'QA_ENGINEER'] as const);
export const employmentStatusEnum = pgEnum('employment_status_enum', ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'] as const);

export const assetScopeEnum = pgEnum('asset_scope_enum', ['INTERNAL', 'CLIENT'] as const);
export const assetTypeEnum = pgEnum('asset_type_enum', [
  'VIRTUAL_MACHINE',
  'CLOUD_ACCOUNT',
  'VPN_GATEWAY',
  'DATABASE',
  'KUBERNETES',
  'STORAGE_BUCKET',
  'NETWORK_VPC',
  'OTHER',
] as const);
export const environmentEnum = pgEnum('environment_enum', ['PROD', 'STAGING', 'DEV', 'QA', 'DR'] as const);
export const assetStatusEnum = pgEnum('asset_status_enum', ['ACTIVE', 'MAINTENANCE', 'PROVISIONING', 'DECOMMISSIONED', 'ISOLATED'] as const);
export const cloudProviderEnum = pgEnum('cloud_provider_enum', ['AWS', 'GCP', 'ALI_CLOUD', 'DIGITAL_OCEAN', 'AZURE', 'ON_PREMISE', 'HYBRID'] as const);

export const accessLevelEnum = pgEnum('access_level_enum', ['READ_ONLY', 'OPERATOR', 'READ_WRITE', 'ADMIN', 'ROOT_SUPERADMIN'] as const);
export const accessGrantTypeEnum = pgEnum('access_grant_type_enum', ['PERMANENT', 'TEMPORARY_TIMED'] as const);
export const accessStatusEnum = pgEnum('access_status_enum', ['PENDING', 'ENDORSED', 'ACTIVE', 'REJECTED', 'EXPIRED', 'REVOKED', 'CANCELLED'] as const);

// =============================================================================
// Tables Definition
// =============================================================================

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  status: clientStatusEnum('status').default('ACTIVE').notNull(),
  industry: varchar('industry', { length: 100 }),
  billingEmail: varchar('billing_email', { length: 255 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 50 }),
  country: varchar('country', { length: 100 }).default('Indonesia').notNull(),
  city: varchar('city', { length: 100 }),
  address: text('address'),
  timezone: varchar('timezone', { length: 50 }).default('Asia/Jakarta').notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  contractNumber: varchar('contract_number', { length: 100 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  contractType: contractTypeEnum('contract_type').default('MANAGED_SERVICE').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  slaLevel: varchar('sla_level', { length: 100 }).default('99.9% High Availability').notNull(),
  status: contractStatusEnum('status').default('ACTIVE').notNull(),
  value: numeric('value', { precision: 15, scale: 2 }).default('0.00').notNull(),
  currency: varchar('currency', { length: 10 }).default('USD').notNull(),
  documentUrl: text('document_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id'),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  headOfDepartmentId: uuid('head_of_department_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').unique(), // Keycloak User ID (sub)
  departmentId: uuid('department_id').references(() => departments.id),
  managerId: uuid('manager_id'),
  employeeNumber: varchar('employee_number', { length: 50 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  jobTitle: varchar('job_title', { length: 150 }).notNull(),
  hierarchyPath: ltree('hierarchy_path'),
  employmentStatus: employmentStatusEnum('employment_status').default('ACTIVE').notNull(),
  joinDate: date('join_date').defaultNow().notNull(),
  exitDate: date('exit_date'),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  contractId: uuid('contract_id').references(() => contracts.id),
  projectManagerId: uuid('project_manager_id').references(() => employees.id),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  projectType: projectTypeEnum('project_type').default('MANAGED_DEVOPS').notNull(),
  status: projectStatusEnum('status').default('IN_PROGRESS').notNull(),
  startDate: date('start_date').defaultNow().notNull(),
  endDate: date('end_date'),
  description: text('description'),
  assignedMembers: jsonb('assigned_members').$type<any[]>().default([]).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const inventories = pgTable('inventories', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id),
  projectId: uuid('project_id').references(() => projects.id),
  assetTag: varchar('asset_tag', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  assetScope: assetScopeEnum('asset_scope').default('CLIENT').notNull(),
  assetType: assetTypeEnum('asset_type').default('VIRTUAL_MACHINE').notNull(),
  environment: environmentEnum('environment').default('PROD').notNull(),
  status: assetStatusEnum('status').default('ACTIVE').notNull(),
  provider: cloudProviderEnum('provider').default('AWS').notNull(),
  region: varchar('region', { length: 100 }).notNull(),
  primaryIp: inet('primary_ip'),
  specs: jsonb('specs').$type<Record<string, any>>().default({}).notNull(),
  connectionInfo: jsonb('connection_info').$type<Record<string, any>>().default({}).notNull(),
  tags: jsonb('tags').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accessGrants = pgTable('access_grants', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  inventoryId: uuid('inventory_id').references(() => inventories.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  accessLevel: accessLevelEnum('access_level').default('READ_WRITE').notNull(),
  grantType: accessGrantTypeEnum('grant_type').default('TEMPORARY_TIMED').notNull(),
  status: accessStatusEnum('status').default('PENDING').notNull(),
  justification: text('justification').notNull(),
  requestedStartTime: timestamp('requested_start_time', { withTimezone: true }).defaultNow().notNull(),
  requestedEndTime: timestamp('requested_end_time', { withTimezone: true }),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => employees.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  revokedBy: uuid('revoked_by').references(() => employees.id),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revocationReason: text('revocation_reason'),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accessAuditLogs = pgTable('access_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  grantId: uuid('grant_id').references(() => accessGrants.id),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  inventoryId: uuid('inventory_id').references(() => inventories.id).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  ipAddress: inet('ip_address'),
  sessionId: varchar('session_id', { length: 100 }),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// Cloud Credentials & Service Account Key Blob Store
// =============================================================================
export const cloudCredentials = pgTable('cloud_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  provider: cloudProviderEnum('provider').default('GCP').notNull(),
  keyBlob: jsonb('key_blob').$type<Record<string, any>>().notNull().default({}),
  clientId: uuid('client_id').references(() => clients.id),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  autoScanInterval: varchar('auto_scan_interval', { length: 50 }).default('1h').notNull(),
  isActive: integer('is_active').default(1).notNull(), // 1 = active, 0 = inactive
  lastScannedAt: timestamp('last_scanned_at', { withTimezone: true }),
  scanStatus: varchar('scan_status', { length: 50 }).default('IDLE').notNull(),
  lastScanError: text('last_scan_error'),
  lastScanSummary: jsonb('last_scan_summary').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// Inventory Historical Change Audit Logs / Drift Tracker
// =============================================================================
export const inventoryHistory = pgTable('inventory_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  inventoryId: uuid('inventory_id').references(() => inventories.id, { onDelete: 'cascade' }).notNull(),
  serviceAccountId: uuid('service_account_id').references(() => cloudCredentials.id, { onDelete: 'set null' }),
  changeType: varchar('change_type', { length: 50 }).notNull(),
  changeSummary: text('change_summary').notNull(),
  previousState: jsonb('previous_state').$type<Record<string, any>>().default({}),
  newState: jsonb('new_state').$type<Record<string, any>>().default({}),
  source: varchar('source', { length: 50 }).default('AUTOMATED_SCAN').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// Relations Definitions
// =============================================================================
export const clientsRelations = relations(clients, ({ many }) => ({
  contracts: many(contracts),
  projects: many(projects),
  inventories: many(inventories),
  cloudCredentials: many(cloudCredentials),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  client: one(clients, {
    fields: [contracts.clientId],
    references: [clients.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  contract: one(contracts, {
    fields: [projects.contractId],
    references: [contracts.id],
  }),
  projectManager: one(employees, {
    fields: [projects.projectManagerId],
    references: [employees.id],
  }),
  inventories: many(inventories),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  manager: one(employees, {
    fields: [employees.managerId],
    references: [employees.id],
  }),
  accessGrants: many(accessGrants),
}));

export const inventoriesRelations = relations(inventories, ({ one, many }) => ({
  client: one(clients, {
    fields: [inventories.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [inventories.projectId],
    references: [projects.id],
  }),
  accessGrants: many(accessGrants),
  history: many(inventoryHistory),
}));

export const cloudCredentialsRelations = relations(cloudCredentials, ({ one, many }) => ({
  client: one(clients, {
    fields: [cloudCredentials.clientId],
    references: [clients.id],
  }),
  historyLogs: many(inventoryHistory),
}));

export const inventoryHistoryRelations = relations(inventoryHistory, ({ one }) => ({
  inventory: one(inventories, {
    fields: [inventoryHistory.inventoryId],
    references: [inventories.id],
  }),
  serviceAccount: one(cloudCredentials, {
    fields: [inventoryHistory.serviceAccountId],
    references: [cloudCredentials.id],
  }),
}));

export const accessGrantsRelations = relations(accessGrants, ({ one }) => ({
  employee: one(employees, {
    fields: [accessGrants.employeeId],
    references: [employees.id],
  }),
  inventory: one(inventories, {
    fields: [accessGrants.inventoryId],
    references: [inventories.id],
  }),
  project: one(projects, {
    fields: [accessGrants.projectId],
    references: [projects.id],
  }),
}));

// =============================================================================
// MISC Key-Value / List Store Table
// Accommodates dynamic catalogs such as Industries, Categories, Config Lists
// =============================================================================
export const misc = pgTable('misc', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 128 }).notNull().unique(),
  value: jsonb('value').$type<any>().notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

