export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'SUSPENDED';
export type ContractType = 'MANAGED_SERVICE' | 'FIXED_PROJECT' | 'TIME_AND_MATERIALS' | 'CONSULTING' | 'SLA_SUPPORT';
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'RENEWAL_PENDING';
export type ProjectType = 'INFRA_MIGRATION' | 'MANAGED_DEVOPS' | 'CLOUD_ARCHITECTURE' | 'SECURITY_AUDIT' | 'INTERNAL_TOOLING';
export type ProjectStatus = 'INITIATION' | 'PLANNING' | 'IN_PROGRESS' | 'MAINTENANCE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
export type ProjectRole = 'PROJECT_MANAGER' | 'LEAD_ARCHITECT' | 'SENIOR_SRE' | 'DEVOPS_ENGINEER' | 'SECURITY_ANALYST' | 'QA_ENGINEER';
export type EmploymentStatus = 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED';

export type AssetScope = 'INTERNAL' | 'CLIENT';
export type AssetType =
  | 'VIRTUAL_MACHINE'
  | 'CLOUD_ACCOUNT'
  | 'VPN_GATEWAY'
  | 'DATABASE'
  | 'KUBERNETES'
  | 'STORAGE_BUCKET'
  | 'NETWORK_VPC'
  | 'OTHER';
export type Environment = 'PROD' | 'STAGING' | 'DEV' | 'QA' | 'DR';
export type AssetStatus = 'ACTIVE' | 'MAINTENANCE' | 'PROVISIONING' | 'DECOMMISSIONED' | 'ISOLATED';
export type CloudProvider = 'AWS' | 'GCP' | 'ALI_CLOUD' | 'DIGITAL_OCEAN' | 'AZURE' | 'ON_PREMISE' | 'HYBRID';

export type AccessLevel = 'READ_ONLY' | 'OPERATOR' | 'READ_WRITE' | 'ADMIN' | 'ROOT_SUPERADMIN';
export type AccessGrantType = 'PERMANENT' | 'TEMPORARY_TIMED';
export type AccessStatus = 'PENDING' | 'ENDORSED' | 'ACTIVE' | 'REJECTED' | 'EXPIRED' | 'REVOKED' | 'CANCELLED';

export interface Client {
  id: string;
  code: string;
  name: string;
  status: ClientStatus;
  industry?: string;
  billingEmail: string;
  contactPhone?: string;
  country: string;
  city?: string;
  address?: string;
  timezone: string;
  metadata?: Record<string, any>;
  contracts?: Contract[];
  projects?: Project[];
  inventories?: InventoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  clientId: string;
  contractNumber: string;
  title: string;
  contractType: ContractType;
  startDate: string;
  endDate: string;
  slaLevel: string;
  status: ContractStatus;
  value: string | number;
  currency: string;
  documentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignedMember {
  employee_id: string;
  employeeId?: string;
  role: ProjectRole;
  assigned_at?: string;
  is_active?: boolean;
}

export interface Project {
  id: string;
  clientId: string;
  contractId?: string;
  projectManagerId?: string;
  code: string;
  name: string;
  projectType: ProjectType;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  description?: string;
  assignedMembers: AssignedMember[];
  tags?: string[];
  client?: Client;
  contract?: Contract;
  projectManager?: Employee;
  inventories?: InventoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  parentId?: string;
  code: string;
  name: string;
  headOfDepartmentId?: string;
}

export interface Employee {
  id: string;
  userId?: string;
  departmentId?: string;
  managerId?: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  hierarchyPath?: string;
  employmentStatus: EmploymentStatus;
  joinDate: string;
  exitDate?: string;
  department?: Department;
  manager?: Employee;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  clientId?: string;
  projectId?: string;
  assetTag: string;
  name: string;
  assetScope: AssetScope;
  assetType: AssetType;
  environment: Environment;
  status: AssetStatus;
  provider: CloudProvider;
  region: string;
  primaryIp?: string;
  specs: Record<string, any>;
  connectionInfo: Record<string, any>;
  tags?: Record<string, any>;
  client?: Client;
  project?: Project;
  createdAt: string;
  updatedAt: string;
}

export interface AccessGrant {
  id: string;
  employeeId: string;
  inventoryId: string;
  projectId?: string;
  accessLevel: AccessLevel;
  grantType: AccessGrantType;
  status: AccessStatus;
  justification: string;
  requestedStartTime: string;
  requestedEndTime?: string;
  validFrom?: string;
  validUntil?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  revokedBy?: string;
  revokedAt?: string;
  revocationReason?: string;
  metadata?: Record<string, any>;
  employee?: Employee;
  inventory?: InventoryItem;
  project?: Project;
  createdAt: string;
  updatedAt: string;
}

export interface AccessAuditLog {
  id: string;
  grantId?: string;
  employeeId: string;
  inventoryId: string;
  action: string;
  ipAddress?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}
