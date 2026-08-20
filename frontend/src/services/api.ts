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
  CloudProvider,
} from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export interface DeleteResult {
  success: boolean;
  error?: string;
}

class ApiClient {
  private useMock = false;
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
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/clients`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            this.clients = data;
            return data;
          }
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to fetch clients from backend, using cache', err);
      }
    }
    return this.clients;
  }

  async createClient(data: Partial<Client>): Promise<Client> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/clients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const created = await res.json();
          this.clients.unshift(created);
          return created;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to create client on backend', err);
      }
    }

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

  async updateClient(id: string, data: Partial<Client>): Promise<Client> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/clients/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = this.clients.findIndex((c) => c.id === id);
          if (idx !== -1) this.clients[idx] = updated;
          return updated;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to update client on backend', err);
      }
    }

    const index = this.clients.findIndex((c) => c.id === id);
    if (index !== -1) {
      this.clients[index] = {
        ...this.clients[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return this.clients[index];
    }
    throw new Error('Client not found');
  }

  async deleteClient(id: string): Promise<DeleteResult> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/clients/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          this.clients = this.clients.filter((c) => c.id !== id);
          return { success: true };
        }
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.message || `Failed to delete client (Status ${res.status})`,
        };
      } catch (err: any) {
        return { success: false, error: err.message || 'Network request failed' };
      }
    }
    this.clients = this.clients.filter((c) => c.id !== id);
    return { success: true };
  }

  // ===========================================================================
  // Projects
  // ===========================================================================
  async getProjects(): Promise<Project[]> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/projects`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            this.projects = data;
            return data;
          }
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to fetch projects from backend, using cache', err);
      }
    }
    return this.projects;
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const created = await res.json();
          this.projects.unshift(created);
          return created;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to create project on backend', err);
      }
    }

    const client = this.clients.find((c) => c.id === data.clientId) || this.clients[0];
    const newProj: Project = {
      id: `prj_${Date.now()}`,
      clientId: client?.id || 'cli_1',
      code: data.code || `PRJ-${Date.now().toString().slice(-4)}`,
      name: data.name || 'New Infrastructure Project',
      projectType: data.projectType || 'INFRA_MIGRATION',
      status: data.status || 'IN_PROGRESS',
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      endDate: data.endDate,
      description: data.description,
      assignedMembers: data.assignedMembers || [],
      tags: data.tags || [],
      client,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.projects.unshift(newProj);
    return newProj;
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = this.projects.findIndex((p) => p.id === id);
          if (idx !== -1) this.projects[idx] = updated;
          return updated;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to update project on backend', err);
      }
    }

    const index = this.projects.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.projects[index] = {
        ...this.projects[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return this.projects[index];
    }
    throw new Error('Project not found');
  }

  async deleteProject(id: string): Promise<DeleteResult> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/projects/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          this.projects = this.projects.filter((p) => p.id !== id);
          return { success: true };
        }
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.message || `Failed to delete project (Status ${res.status})`,
        };
      } catch (err: any) {
        return { success: false, error: err.message || 'Network request failed' };
      }
    }
    this.projects = this.projects.filter((p) => p.id !== id);
    return { success: true };
  }

  // ===========================================================================
  // Inventories (CMDB)
  // ===========================================================================
  async getInventories(): Promise<InventoryItem[]> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/inventories`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            this.inventories = data;
            return data;
          }
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to fetch inventories from backend, using cache', err);
      }
    }
    return this.inventories;
  }

  async createInventory(data: Partial<InventoryItem>): Promise<InventoryItem> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/inventories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const created = await res.json();
          this.inventories.unshift(created);
          return created;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to create inventory on backend', err);
      }
    }

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

  async updateInventory(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/inventories/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = this.inventories.findIndex((i) => i.id === id);
          if (idx !== -1) this.inventories[idx] = updated;
          return updated;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to update inventory on backend', err);
      }
    }

    const index = this.inventories.findIndex((i) => i.id === id);
    if (index !== -1) {
      this.inventories[index] = {
        ...this.inventories[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return this.inventories[index];
    }
    throw new Error('Inventory not found');
  }

  async deleteInventory(id: string): Promise<DeleteResult> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/inventories/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          this.inventories = this.inventories.filter((i) => i.id !== id);
          return { success: true };
        }
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.message || `Failed to delete resource (${res.statusText || res.status})`,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Network connection failed',
        };
      }
    }
    this.inventories = this.inventories.filter((i) => i.id !== id);
    return { success: true };
  }

  // ===========================================================================
  // Cloud Provider SA.Key Discovery & Bulk Import
  // ===========================================================================
  async discoverCloudAssets(provider: CloudProvider, credentials: any): Promise<{
    provider: string;
    projectId?: string;
    accountEmail?: string;
    discoveredCount: number;
    duplicateCount: number;
    resources: any[];
  }> {
    try {
      const res = await fetch(`${API_BASE}/inventories/discover-cloud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, credentials }),
      });
      if (res.ok) {
        return await res.json();
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Cloud Discovery failed with status ${res.status}`);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
        throw err;
      }
    }

    // Local Cloud Discovery Engine (Offline Fallback)
    let creds: any = credentials;
    if (typeof creds === 'string') {
      try {
        creds = JSON.parse(creds);
      } catch {
        throw new Error('Invalid Credentials JSON format. Please provide valid JSON.');
      }
    }

    let projectId = 'gcp-production-project';
    let accountEmail = 'service-account@iam.gserviceaccount.com';

    if (provider === 'GCP') {
      if (creds?.type && creds.type !== 'service_account') {
        throw new Error('The uploaded file is not a valid GCP Service Account JSON key.');
      }
      projectId = creds?.project_id || creds?.projectId || 'gcp-cloud-prod';
      accountEmail = creds?.client_email || creds?.clientEmail || `sa-${projectId}@iam.gserviceaccount.com`;
    } else if (provider === 'AWS') {
      projectId = creds?.account_id || creds?.role_arn?.split(':')[4] || 'aws-account-prod';
      accountEmail = creds?.access_key_id || 'AWS_IAM_USER';
    } else {
      projectId = creds?.project_id || 'alicloud-res-group';
      accountEmail = creds?.access_key_id || 'ALIBABA_RAM_USER';
    }

    const sanitizedProj = projectId.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

    const candidatePool = [
      {
        candidateId: `cand-vm-1-${sanitizedProj}`,
        name: `${sanitizedProj}-api-gateway-01`,
        assetTag: `AST-VM-${sanitizedProj.slice(0, 6).toUpperCase()}-01`,
        assetType: 'VIRTUAL_MACHINE',
        provider,
        region: 'asia-southeast2',
        zone: 'asia-southeast2-a',
        primaryIp: '10.140.1.15',
        specs: { cpu_cores: 8, ram_gb: 32, disk_gb: 200, os: 'Ubuntu 24.04 LTS', machine_type: 'e2-standard-8' },
        cloudMetadata: { projectId, sa: accountEmail },
      },
      {
        candidateId: `cand-db-1-${sanitizedProj}`,
        name: `${sanitizedProj}-postgresql-master`,
        assetTag: `AST-DB-${sanitizedProj.slice(0, 6).toUpperCase()}-01`,
        assetType: 'DATABASE',
        provider,
        region: 'asia-southeast2',
        zone: 'asia-southeast2-b',
        primaryIp: '10.140.2.20',
        specs: { engine: 'PostgreSQL 16.2 Enterprise', disk_gb: 500, ha_enabled: true, tier: 'db-custom-8-32768' },
        cloudMetadata: { projectId, edition: 'Enterprise Plus' },
      },
      {
        candidateId: `cand-k8s-1-${sanitizedProj}`,
        name: `${sanitizedProj}-gke-production-cluster`,
        assetTag: `AST-K8S-${sanitizedProj.slice(0, 6).toUpperCase()}-01`,
        assetType: 'KUBERNETES',
        provider,
        region: 'asia-southeast2',
        zone: 'asia-southeast2 (Regional)',
        primaryIp: '10.140.3.10',
        specs: { k8s_version: 'v1.31.2-gke.100', node_pools: 2, total_nodes: 6, total_cpu: 32, total_ram_gb: 128 },
        cloudMetadata: { projectId, clusterType: 'Autopilot Regional' },
      },
    ];

    let duplicateCount = 0;
    const resources = candidatePool.map((candidate) => {
      const match = this.inventories.find((ex) => {
        const candidateName = (candidate.name || '').trim().toLowerCase();
        const exName = (ex.name || '').trim().toLowerCase();
        const nameMatch = candidateName !== '' && candidateName === exName;

        const candidateIp = (candidate.primaryIp || '').trim();
        const exIp = (ex.primaryIp || '').trim();
        const ipMatch = candidateIp !== '' && candidateIp !== '10.0.0.1' && candidateIp === exIp;

        const candidateTag = (candidate.assetTag || '').trim().toLowerCase();
        const exTag = (ex.assetTag || '').trim().toLowerCase();
        const tagMatch = candidateTag !== '' && candidateTag === exTag;

        return nameMatch || ipMatch || tagMatch;
      });

      if (match) {
        duplicateCount++;
        let reason = `Matches existing asset "${match.name}"`;
        if (candidate.primaryIp && match.primaryIp && candidate.primaryIp === match.primaryIp) {
          reason = `Matches IP ${match.primaryIp} ("${match.name}")`;
        }

        return {
          ...candidate,
          isDuplicate: true,
          duplicateReason: reason,
          existingAssetTag: match.assetTag,
          existingId: match.id,
        };
      }

      return {
        ...candidate,
        isDuplicate: false,
      };
    });

    return {
      provider,
      projectId,
      accountEmail,
      discoveredCount: resources.length,
      duplicateCount,
      resources,
    };
  }

  async bulkImportInventories(payload: {
    items: Array<{
      name: string;
      assetTag: string;
      assetScope: 'CLIENT' | 'INTERNAL';
      assetType: 'VIRTUAL_MACHINE' | 'DATABASE' | 'KUBERNETES';
      provider: CloudProvider;
      region: string;
      primaryIp: string;
      clientId?: string;
      specs?: Record<string, any>;
      cloudMetadata?: Record<string, any>;
      tags?: string[];
    }>;
  }): Promise<{ importedCount: number; items: InventoryItem[] }> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/inventories/bulk-import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const result = await res.json();
          if (result?.items && Array.isArray(result.items)) {
            this.inventories.unshift(...result.items);
          }
          return result;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Bulk import failed with status ${res.status}`);
        }
      } catch (err: any) {
        console.error('[ApiClient] Bulk import error:', err);
        throw err;
      }
    }

    const imported: InventoryItem[] = [];
    for (const item of payload.items) {
      const newInv: InventoryItem = {
        id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clientId: item.assetScope === 'CLIENT' ? item.clientId : undefined,
        assetTag: item.assetTag,
        name: item.name,
        assetScope: item.assetScope,
        assetType: item.assetType as any,
        environment: 'PROD',
        status: 'ACTIVE',
        provider: item.provider as any,
        region: item.region,
        primaryIp: item.primaryIp,
        specs: item.specs || { cpu_cores: 4, ram_gb: 16, disk_gb: 100 },
        connectionInfo: { ssh_port: 22, bastion_required: true, cloud_metadata: item.cloudMetadata || {} },
        tags: item.tags || [item.provider, 'Cloud-Imported'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.inventories.unshift(newInv);
      imported.push(newInv);
    }

    return {
      importedCount: imported.length,
      items: imported,
    };
  }

  // ===========================================================================
  // Access Grants & PAM
  // ===========================================================================
  async getAccessGrants(): Promise<AccessGrant[]> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/accesses`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            this.accessGrants = data;
            return data;
          }
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to fetch access grants from backend', err);
      }
    }
    return this.accessGrants;
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
    const emp = this.employees[2];

    const now = new Date();
    const newGrant: AccessGrant = {
      id: `ag_${Date.now()}`,
      employeeId: emp?.id || 'emp_1',
      inventoryId: inv?.id || 'inv_1',
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
      employeeId: emp?.id || 'emp_1',
      inventoryId: inv?.id || 'inv_1',
      action: 'ACCESS_REQUESTED',
      metadata: { accessLevel: data.accessLevel, durationHours: data.durationHours },
      createdAt: now.toISOString(),
    });

    return newGrant;
  }

  async updateAccessGrant(id: string, data: Partial<AccessGrant>): Promise<AccessGrant> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/accesses/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = this.accessGrants.findIndex((g) => g.id === id);
          if (idx !== -1) this.accessGrants[idx] = updated;
          return updated;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to update access grant on backend', err);
      }
    }

    const index = this.accessGrants.findIndex((g) => g.id === id);
    if (index !== -1) {
      this.accessGrants[index] = {
        ...this.accessGrants[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return this.accessGrants[index];
    }
    throw new Error('Access grant not found');
  }

  async deleteAccessGrant(id: string): Promise<DeleteResult> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/accesses/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          this.accessGrants = this.accessGrants.filter((g) => g.id !== id);
          return { success: true };
        }
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.message || `Failed to delete access grant (Status ${res.status})`,
        };
      } catch (err: any) {
        return { success: false, error: err.message || 'Network request failed' };
      }
    }
    this.accessGrants = this.accessGrants.filter((g) => g.id !== id);
    return { success: true };
  }

  async approveAccess(grantId: string, notes?: string): Promise<AccessGrant> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/accesses/${grantId}/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = this.accessGrants.findIndex((g) => g.id === grantId);
          if (idx !== -1) this.accessGrants[idx] = updated;
          return updated;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to approve access on backend', err);
      }
    }

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
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/accesses/${grantId}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: notes }),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = this.accessGrants.findIndex((g) => g.id === grantId);
          if (idx !== -1) this.accessGrants[idx] = updated;
          return updated;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to reject access on backend', err);
      }
    }

    const grant = this.accessGrants.find((g) => g.id === grantId);
    if (!grant) throw new Error('Grant not found');

    grant.status = 'REJECTED';
    grant.reviewedBy = 'e222';
    grant.reviewedAt = new Date().toISOString();
    grant.reviewNotes = notes || 'Access request declined';
    return grant;
  }

  async revokeAccess(grantId: string, reason?: string): Promise<AccessGrant> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/accesses/${grantId}/revoke`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = this.accessGrants.findIndex((g) => g.id === grantId);
          if (idx !== -1) this.accessGrants[idx] = updated;
          return updated;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to revoke access on backend', err);
      }
    }

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
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/employees`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            this.employees = data;
            return data;
          }
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to fetch employees from backend', err);
      }
    }
    return this.employees;
  }

  async updateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/employees/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = this.employees.findIndex((e) => e.id === id);
          if (idx !== -1) this.employees[idx] = updated;
          return updated;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to update employee on backend', err);
      }
    }

    const index = this.employees.findIndex((e) => e.id === id);
    if (index !== -1) {
      this.employees[index] = {
        ...this.employees[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return this.employees[index];
    }
    throw new Error('Employee not found');
  }

  async offboardEmployee(id: string, exitDate?: string): Promise<Employee> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/employees/${id}/offboard`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exitDate }),
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = this.employees.findIndex((e) => e.id === id);
          if (idx !== -1) this.employees[idx] = updated;
          return updated;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to offboard employee on backend', err);
      }
    }

    const index = this.employees.findIndex((e) => e.id === id);
    if (index !== -1) {
      this.employees[index] = {
        ...this.employees[index],
        employmentStatus: 'TERMINATED',
        exitDate: exitDate || new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
      };
      return this.employees[index];
    }
    throw new Error('Employee not found');
  }

  async deleteEmployee(id: string): Promise<DeleteResult> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/employees/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          this.employees = this.employees.filter((e) => e.id !== id);
          return { success: true };
        }
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.message || `Failed to delete employee (Status ${res.status})`,
        };
      } catch (err: any) {
        return { success: false, error: err.message || 'Network request failed' };
      }
    }
    this.employees = this.employees.filter((e) => e.id !== id);
    return { success: true };
  }

  async getDepartments(): Promise<Department[]> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/employees/departments`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            this.departments = data;
            return data;
          }
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to fetch departments from backend', err);
      }
    }
    return this.departments;
  }

  async getAuditLogs(): Promise<AccessAuditLog[]> {
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/accesses/audit-logs`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            this.auditLogs = data;
            return data;
          }
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to fetch audit logs from backend', err);
      }
    }
    return this.auditLogs;
  }

  // ===========================================================================
  // MISC Key-Value / Dynamic List Store (Industries, Taxonomies, Configs)
  // ===========================================================================
  private miscData: Record<string, any> = {
    INDUSTRIES: [
      'Financial Services',
      'E-Commerce & Retail',
      'Healthcare & Pharma',
      'Telecommunications',
      'Logistics & Supply Chain',
      'Government & Public Sector',
      'Energy & Mining',
      'Media & Entertainment',
      'Software & SaaS',
    ],
  };

  async getMisc(key: string): Promise<any> {
    const upperKey = key.toUpperCase();
    if (!this.useMock) {
      try {
        const res = await fetch(`${API_BASE}/misc/${upperKey}`);
        if (res.ok) {
          const data = await res.json();
          return data.value;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to fetch misc from backend', err);
      }
    }
    return this.miscData[upperKey] || null;
  }

  async updateMisc(key: string, value: any): Promise<any> {
    const upperKey = key.toUpperCase();
    this.miscData[upperKey] = value;
    if (!this.useMock) {
      try {
        await fetch(`${API_BASE}/misc/${upperKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        });
      } catch (err) {
        console.error('Failed to sync misc to backend', err);
      }
    }
    return value;
  }

  async getIndustries(): Promise<string[]> {
    const res = await this.getMisc('INDUSTRIES');
    return Array.isArray(res) ? res : this.miscData.INDUSTRIES;
  }

  async addIndustry(industryName: string): Promise<string[]> {
    const trimmed = industryName.trim();
    if (!trimmed) return this.getIndustries();
    const current = await this.getIndustries();
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed];
      await this.updateMisc('INDUSTRIES', updated);
      return updated;
    }
    return current;
  }

  async deleteIndustry(industryName: string): Promise<string[]> {
    const current = await this.getIndustries();
    const updated = current.filter((i) => i !== industryName);
    await this.updateMisc('INDUSTRIES', updated);
    return updated;
  }
}

export const api = new ApiClient();
