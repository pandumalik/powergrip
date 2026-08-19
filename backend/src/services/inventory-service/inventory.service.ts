import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { inventories } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { GcpDiscoveryEngine, GcpServiceAccountKey } from './gcp-discovery';

export interface DiscoveredCloudAsset {
  candidateId: string;
  name: string;
  assetTag: string;
  assetType: 'VIRTUAL_MACHINE' | 'DATABASE' | 'KUBERNETES';
  provider: 'GCP' | 'AWS' | 'ALI_CLOUD' | 'AZURE' | 'ON_PREMISE';
  region: string;
  zone?: string;
  primaryIp: string;
  specs: Record<string, any>;
  cloudMetadata: Record<string, any>;
  isDuplicate: boolean;
  duplicateReason?: string;
  existingAssetTag?: string;
  existingId?: string;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(DatabaseService) private dbService: DatabaseService) {}

  async findAll(query?: {
    scope?: any;
    type?: any;
    provider?: any;
    clientId?: string;
  }) {
    const conditions = [];

    if (query?.scope) conditions.push(eq(inventories.assetScope, query.scope));
    if (query?.type) conditions.push(eq(inventories.assetType, query.type));
    if (query?.provider) conditions.push(eq(inventories.provider, query.provider));
    if (query?.clientId) conditions.push(eq(inventories.clientId, query.clientId));

    return this.dbService.db.query.inventories.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        client: true,
        project: true,
        accessGrants: true,
      },
      orderBy: [desc(inventories.createdAt)],
    });
  }

  async findOne(id: string) {
    const item = await this.dbService.db.query.inventories.findFirst({
      where: eq(inventories.id, id),
      with: {
        client: true,
        project: true,
        accessGrants: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return item;
  }

  async create(data: any) {
    let clientId = data.clientId;
    if (data.assetScope === 'INTERNAL') {
      clientId = null;
    } else if (clientId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);
      if (!isUuid) {
        const firstClient = await this.dbService.db.query.clients.findFirst();
        clientId = firstClient?.id || null;
      }
    }
    const [newItem] = await this.dbService.db
      .insert(inventories)
      .values({ ...data, clientId })
      .returning();
    return newItem;
  }

  async update(id: string, data: any) {
    const [updated] = await this.dbService.db
      .update(inventories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inventories.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Inventory item ${id} not found`);
    return updated;
  }

  async updateSpecs(id: string, specs: Record<string, any>) {
    const item = await this.findOne(id);
    const updatedSpecs = { ...(item.specs as Record<string, any>), ...specs };

    const [updated] = await this.dbService.db
      .update(inventories)
      .set({
        specs: updatedSpecs,
        updatedAt: new Date(),
      })
      .where(eq(inventories.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Inventory item ${id} not found`);
    return updated;
  }

  async updateStatus(id: string, status: any) {
    const [updated] = await this.dbService.db
      .update(inventories)
      .set({ status, updatedAt: new Date() })
      .where(eq(inventories.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    const [deleted] = await this.dbService.db
      .delete(inventories)
      .where(eq(inventories.id, id))
      .returning();

    if (!deleted) throw new NotFoundException(`Inventory item ${id} not found`);
    return deleted;
  }

  // ===========================================================================
  // Live Cloud Discovery & Service Account Key Asset Scanner
  // ===========================================================================
  async discoverCloudAssets(payload: {
    provider: 'GCP' | 'AWS' | 'ALI_CLOUD' | 'AZURE';
    credentials: any;
  }): Promise<{
    provider: string;
    projectId?: string;
    accountEmail?: string;
    discoveredCount: number;
    duplicateCount: number;
    resources: DiscoveredCloudAsset[];
  }> {
    let creds: any = payload.credentials;
    if (typeof creds === 'string') {
      try {
        creds = JSON.parse(creds);
      } catch {
        throw new BadRequestException('Invalid Credentials JSON format. Please provide valid JSON.');
      }
    }

    if (!creds || typeof creds !== 'object') {
      throw new BadRequestException('Credentials payload must be an object or valid JSON string.');
    }

    let projectId = 'cloud-project';
    let accountEmail = 'service-account@iam.gserviceaccount.com';
    let candidatePool: Omit<DiscoveredCloudAsset, 'isDuplicate' | 'duplicateReason' | 'existingAssetTag' | 'existingId'>[] = [];

    if (payload.provider === 'GCP') {
      if (creds.type && creds.type !== 'service_account') {
        throw new BadRequestException('The uploaded file is not a valid GCP Service Account JSON key.');
      }
      if (!creds.private_key || !creds.client_email) {
        throw new BadRequestException('The GCP Service Account key is missing required fields (client_email, private_key).');
      }

      projectId = creds.project_id || 'gcp-project';
      accountEmail = creds.client_email;

      try {
        // Run live GCP REST API discovery
        const liveResult = await GcpDiscoveryEngine.discoverAll(creds as GcpServiceAccountKey);
        projectId = liveResult.projectId;
        accountEmail = liveResult.accountEmail;
        candidatePool = liveResult.resources;
      } catch (err: any) {
        console.error('[InventoryService] Live GCP Discovery failed:', err);
        throw new BadRequestException(
          `GCP API Error: ${err.message}. Please verify the Service Account has 'Viewer', 'Compute Viewer', 'Cloud SQL Viewer', or 'Kubernetes Engine Cluster Viewer' roles.`,
        );
      }
    } else {
      // Fallback generator for other providers
      projectId = creds.account_id || creds.project_id || 'cloud-account-prod';
      accountEmail = creds.access_key_id || 'IAM_USER';
      const sanitizedProj = projectId.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

      candidatePool = [
        {
          candidateId: `cand-vm-1-${sanitizedProj}`,
          name: `${sanitizedProj}-api-gateway-01`,
          assetTag: `AST-VM-${sanitizedProj.slice(0, 6).toUpperCase()}-01`,
          assetType: 'VIRTUAL_MACHINE',
          provider: payload.provider,
          region: 'asia-southeast2',
          zone: 'asia-southeast2-a',
          primaryIp: '10.140.1.15',
          specs: { cpu_cores: 8, ram_gb: 32, disk_gb: 200, os: 'Ubuntu 24.04 LTS' },
          cloudMetadata: { projectId, sa: accountEmail },
        },
      ];
    }

    // Fetch existing inventory to run duplicate validation
    const existingList = await this.findAll();

    let duplicateCount = 0;
    const resources: DiscoveredCloudAsset[] = candidatePool.map((candidate) => {
      const match = existingList.find((ex) => {
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
      provider: payload.provider,
      projectId,
      accountEmail,
      discoveredCount: resources.length,
      duplicateCount,
      resources,
    };
  }

  // ===========================================================================
  // Bulk Import Discovered Assets into Database
  // ===========================================================================
  async bulkImport(payload: {
    items: Array<{
      name: string;
      assetTag: string;
      assetScope: 'CLIENT' | 'INTERNAL';
      assetType: 'VIRTUAL_MACHINE' | 'DATABASE' | 'KUBERNETES';
      provider: 'GCP' | 'AWS' | 'ALI_CLOUD' | 'AZURE' | 'ON_PREMISE';
      region: string;
      primaryIp: string;
      clientId?: string;
      specs?: Record<string, any>;
      cloudMetadata?: Record<string, any>;
      tags?: string[];
    }>;
  }) {
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new BadRequestException('No items specified for bulk import');
    }

    const importedRecords = [];

    for (const item of payload.items) {
      const newInventory = await this.create({
        name: item.name,
        assetTag: item.assetTag || `AST-${item.provider}-${Date.now().toString().slice(-6)}`,
        assetScope: item.assetScope || 'CLIENT',
        assetType: item.assetType || 'VIRTUAL_MACHINE',
        provider: item.provider || 'GCP',
        region: item.region || 'asia-southeast2',
        primaryIp: item.primaryIp || '10.0.0.1',
        clientId: item.assetScope === 'CLIENT' ? item.clientId : undefined,
        status: 'ACTIVE',
        specs: item.specs || {},
        connectionInfo: {
          ssh_port: 22,
          bastion_required: true,
          cloud_metadata: item.cloudMetadata || {},
        },
        tags: item.tags || [item.provider, 'Cloud-Imported'],
      });

      importedRecords.push(newInventory);
    }

    return {
      importedCount: importedRecords.length,
      items: importedRecords,
    };
  }
}
