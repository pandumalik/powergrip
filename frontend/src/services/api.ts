import {
  mockClients,
  mockProjects,
  mockInventories,
  mockAccessGrants,
  mockEmployees,
  mockDepartments,
  mockAuditLogs,
} from './mockData';
import {
  Client,
  Project,
  InventoryItem,
  AccessGrant,
  Employee,
  Department,
  AccessAuditLog,
} from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// Check if backend is available or use memory mock store
class ApiClient {
  private useMock = true; // Defaults to self-contained demo mode
  private clients: Client[] = [...mockClients];
  private projects: Project[] = [...mockProjects];
  private inventories: InventoryItem[] = [...mockInventories];
  private accessGrants: AccessGrant[] = [...mockAccessGrants];
  private employees: Employee[] = [...mockEmployees];
  private departments: Department[] = [...mockDepartments];
  private auditLogs: AccessAuditLog[] = [...mockAuditLogs];

  setMockMode(isMock: boolean) {
    this.useMock = isMock;
  }

  getIsMockMode() {
    return this.useMock;
  }

  // ===========================================================================
  // Clients
  // ===========================================================================
  async getClients(): Promise<Client[]> {
    if (this.useMock) return this.clients;
    try {
      const res = await fetch(`${API_BASE}/clients`);
      if (!res.ok) throw new Error('API offline');
      return res.json();
    } catch {
      return this.clients;
    }
  }

  async createClient(data: Partial<Client>): Promise<Client> {
    const newClient: Client = {
      id: `cli_${Date.now()}`,
      code: data.code || 'CLI-NEW',
      name: data.name || 'New Client Enterprise',
      status: data.status || 'ACTIVE',
      industry: data.industry || 'Technology',
      billingEmail: data.billingEmail || 'finance@client.com',
      contactPhone: data.contactPhone || '+62 21 0000 0000',
      country: data.country || 'Indonesia',
      city: data.city || 'Jakarta',
      address: data.address || '',
      timezone: data.timezone || 'Asia/Jakarta',
      contracts: [],
      projects: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.clients.unshift(newClient);
    return newClient;
  }

  // ===========================================================================
  // Projects
  // ===========================================================================
  async getProjects(): Promise<Project[]> {
    if (this.useMock) return this.projects;
    try {
      const res = await fetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error('API offline');
      return res.json();
    } catch {
      return this.projects;
    }
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    const client = this.clients.find((c) => c.id === data.clientId) || this.clients[0];
    const newProj: Project = {
      id: `prj_${Date.now()}`,
      clientId: client.id,
      code: data.code || `PRJ-${Date.now().toString().slice(-4)}`,
      name: data.name || 'New Infrastructure Project',
      projectType: data.projectType || 'INFRA_MIGRATION',
      status: data.status || 'IN_PROGRESS',
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      assignedMembers: data.assignedMembers || [],
      tags: data.tags || ['Cloud', 'Managed'],
      client,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.projects.unshift(newProj);
    return newProj;
  }

  // ===========================================================================
  // Inventories (CMDB)
  // ===========================================================================
  async getInventories(): Promise<InventoryItem[]> {
    if (this.useMock) return this.inventories;
    try {
      const res = await fetch(`${API_BASE}/inventories`);
      if (!res.ok) throw new Error('API offline');
      return res.json();
    } catch {
      return this.inventories;
    }
  }

  async createInventory(data: Partial<InventoryItem>): Promise<InventoryItem> {
    const newInv: InventoryItem = {
      id: `inv_${Date.now()}`,
      clientId: data.clientId,
      projectId: data.projectId,
      assetTag: data.assetTag || `INV-${Date.now().toString().slice(-4)}`,
      name: data.name || 'new-virtual-instance',
      assetScope: data.assetScope || 'CLIENT',
      assetType: data.assetType || 'VIRTUAL_MACHINE',
      environment: data.environment || 'PROD',
      status: data.status || 'ACTIVE',
      provider: data.provider || 'AWS',
      region: data.region || 'ap-southeast-1',
      primaryIp: data.primaryIp || '10.0.0.1',
      specs: data.specs || { cpu_cores: 4, ram_gb: 16, disk_gb: 100 },
      connectionInfo: data.connectionInfo || { ssh_port: 22 },
      tags: data.tags || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.inventories.unshift(newInv);
    return newInv;
  }

  // ===========================================================================
  // Access Grants & PAM
  // ===========================================================================
  async getAccessGrants(): Promise<AccessGrant[]> {
    if (this.useMock) return this.accessGrants;
    try {
      const res = await fetch(`${API_BASE}/accesses`);
      if (!res.ok) throw new Error('API offline');
      return res.json();
    } catch {
      return this.accessGrants;
    }
  }

  async requestAccess(data: {
    inventoryId: string;
    projectId?: string;
    accessLevel: any;
    grantType: any;
    durationHours: number;
    justification: string;
  }): Promise<AccessGrant> {
    const inv = this.inventories.find((i) => i.id === data.inventoryId) || this.inventories[0];
    const emp = this.employees[2]; // Default to Jane Doe (Dev)

    const now = new Date();
    const newGrant: AccessGrant = {
      id: `ag_${Date.now()}`,
      employeeId: emp.id,
      inventoryId: inv.id,
      projectId: data.projectId,
      accessLevel: data.accessLevel,
      grantType: data.grantType,
      status: 'PENDING',
      justification: data.justification,
      requestedStartTime: now.toISOString(),
      requestedEndTime: new Date(now.getTime() + data.durationHours * 3600 * 1000).toISOString(),
      metadata: { durationHours: data.durationHours },
      employee: emp,
      inventory: inv,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.accessGrants.unshift(newGrant);

    this.auditLogs.unshift({
      id: `log_${Date.now()}`,
      grantId: newGrant.id,
      employeeId: emp.id,
      inventoryId: inv.id,
      action: 'ACCESS_REQUESTED',
      metadata: { accessLevel: data.accessLevel, durationHours: data.durationHours },
      createdAt: now.toISOString(),
    });

    return newGrant;
  }

  async approveAccess(grantId: string, notes?: string): Promise<AccessGrant> {
    const grant = this.accessGrants.find((g) => g.id === grantId);
    if (!grant) throw new Error('Grant not found');

    const now = new Date();
    const durationHours = grant.metadata?.durationHours || 4;
    grant.status = 'ACTIVE';
    grant.validFrom = now.toISOString();
    grant.validUntil = new Date(now.getTime() + durationHours * 3600 * 1000).toISOString();
    grant.reviewedBy = 'e222';
    grant.reviewedAt = now.toISOString();
    grant.reviewNotes = notes || 'Access Approved via Dashboard';

    this.auditLogs.unshift({
      id: `log_${Date.now()}`,
      grantId: grant.id,
      employeeId: grant.employeeId,
      inventoryId: grant.inventoryId,
      action: 'ACCESS_APPROVED_ACTIVATED',
      metadata: { approvedBy: 'Alex Mercer', validUntil: grant.validUntil },
      createdAt: now.toISOString(),
    });

    return grant;
  }

  async rejectAccess(grantId: string, notes?: string): Promise<AccessGrant> {
    const grant = this.accessGrants.find((g) => g.id === grantId);
    if (!grant) throw new Error('Grant not found');

    grant.status = 'REJECTED';
    grant.reviewedBy = 'e222';
    grant.reviewedAt = new Date().toISOString();
    grant.reviewNotes = notes || 'Access request declined';
    return grant;
  }

  async revokeAccess(grantId: string, reason?: string): Promise<AccessGrant> {
    const grant = this.accessGrants.find((g) => g.id === grantId);
    if (!grant) throw new Error('Grant not found');

    grant.status = 'REVOKED';
    grant.revokedBy = 'e111';
    grant.revokedAt = new Date().toISOString();
    grant.revocationReason = reason || 'Manual administrative revocation';

    this.auditLogs.unshift({
      id: `log_${Date.now()}`,
      grantId: grant.id,
      employeeId: grant.employeeId,
      inventoryId: grant.inventoryId,
      action: 'ACCESS_REVOKED',
      metadata: { reason: grant.revocationReason },
      createdAt: new Date().toISOString(),
    });

    return grant;
  }

  // ===========================================================================
  // Employees & Org Chart
  // ===========================================================================
  async getEmployees(): Promise<Employee[]> {
    if (this.useMock) return this.employees;
    try {
      const res = await fetch(`${API_BASE}/employees`);
      if (!res.ok) throw new Error('API offline');
      return res.json();
    } catch {
      return this.employees;
    }
  }

  async getDepartments(): Promise<Department[]> {
    return this.departments;
  }

  async getAuditLogs(): Promise<AccessAuditLog[]> {
    return this.auditLogs;
  }
}

export const api = new ApiClient();
