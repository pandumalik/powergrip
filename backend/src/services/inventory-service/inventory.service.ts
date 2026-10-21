import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { inventories, inventoryHistory, cloudCredentials } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { GcpDiscoveryEngine, GcpServiceAccountKey } from './gcp-discovery';
import { CloudCredentialService } from './cloud-credential.service';

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

export interface ReScanResult {
  credentialId: string;
  credentialName: string;
  provider: string;
  projectId?: string;
  scannedAt: string;
  totalDiscovered: number;
  newAssetsCount: number;
  updatedAssetsCount: number;
  unchangedAssetsCount: number;
  decommissionedAssetsCount: number;
  driftEvents: Array<{
    inventoryId: string;
    assetTag: string;
    assetName: string;
    changeType: string;
    changeSummary: string;
  }>;
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DatabaseService) private dbService: DatabaseService,
    @Inject(CloudCredentialService) private credService: CloudCredentialService,
  ) {}

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
        history: {
          orderBy: [desc(inventoryHistory.createdAt)],
          limit: 10,
        },
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
        history: {
          orderBy: [desc(inventoryHistory.createdAt)],
          limit: 25,
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return item;
  }

  async create(data: any, source = 'MANUAL') {
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

    // Log creation in history
    try {
      await this.dbService.db.insert(inventoryHistory).values({
        inventoryId: newItem.id,
        changeType: 'CREATED',
        changeSummary: `Asset registered: ${newItem.name} (${newItem.assetTag}) [${newItem.provider} ${newItem.assetType}]`,
        newState: {
          name: newItem.name,
          assetTag: newItem.assetTag,
          assetType: newItem.assetType,
          provider: newItem.provider,
          region: newItem.region,
          primaryIp: newItem.primaryIp,
          specs: newItem.specs,
          status: newItem.status,
        },
        source,
      });
    } catch (err) {
      console.warn('[InventoryService] Failed to record creation history:', err);
    }

    return newItem;
  }

  async update(id: string, data: any, source = 'MANUAL_EDIT') {
    const previous = await this.findOne(id);

    const [updated] = await this.dbService.db
      .update(inventories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inventories.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Inventory item ${id} not found`);

    // Detect changed attributes
    const changes: string[] = [];
    const prevSnapshot: Record<string, any> = {};
    const newSnapshot: Record<string, any> = {};

    if (data.name && data.name !== previous.name) {
      changes.push(`Name changed from "${previous.name}" to "${data.name}"`);
      prevSnapshot.name = previous.name;
      newSnapshot.name = data.name;
    }
    if (data.status && data.status !== previous.status) {
      changes.push(`Status changed from ${previous.status} to ${data.status}`);
      prevSnapshot.status = previous.status;
      newSnapshot.status = data.status;
    }
    if (data.primaryIp && data.primaryIp !== previous.primaryIp) {
      changes.push(`Primary IP changed from ${previous.primaryIp || 'N/A'} to ${data.primaryIp}`);
      prevSnapshot.primaryIp = previous.primaryIp;
      newSnapshot.primaryIp = data.primaryIp;
    }
    if (data.region && data.region !== previous.region) {
      changes.push(`Region changed from ${previous.region} to ${data.region}`);
      prevSnapshot.region = previous.region;
      newSnapshot.region = data.region;
    }
    if (data.specs && JSON.stringify(data.specs) !== JSON.stringify(previous.specs)) {
      changes.push('Resource specifications updated');
      prevSnapshot.specs = previous.specs;
      newSnapshot.specs = data.specs;
    }

    if (changes.length > 0) {
      try {
        await this.dbService.db.insert(inventoryHistory).values({
          inventoryId: id,
          changeType: data.status && data.status !== previous.status ? 'STATUS_CHANGED' : 'UPDATED',
          changeSummary: changes.join('; '),
          previousState: prevSnapshot,
          newState: newSnapshot,
          source,
        });
      } catch (err) {
        console.warn('[InventoryService] Failed to record update history:', err);
      }
    }

    return updated;
  }

  async updateSpecs(id: string, specs: Record<string, any>, source = 'MANUAL_EDIT') {
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

    try {
      await this.dbService.db.insert(inventoryHistory).values({
        inventoryId: id,
        changeType: 'SPECS_CHANGED',
        changeSummary: `Specs updated: ${Object.keys(specs).join(', ')} modified`,
        previousState: item.specs as Record<string, any>,
        newState: updatedSpecs,
        source,
      });
    } catch (err) {
      console.warn('[InventoryService] Failed to record specs history:', err);
    }

    return updated;
  }

  async updateStatus(id: string, status: any, source = 'MANUAL_EDIT') {
    const item = await this.findOne(id);

    const [updated] = await this.dbService.db
      .update(inventories)
      .set({ status, updatedAt: new Date() })
      .where(eq(inventories.id, id))
      .returning();

    if (item.status !== status) {
      try {
        await this.dbService.db.insert(inventoryHistory).values({
          inventoryId: id,
          changeType: 'STATUS_CHANGED',
          changeSummary: `Asset status changed from ${item.status} to ${status}`,
          previousState: { status: item.status },
          newState: { status },
          source,
        });
      } catch (err) {
        console.warn('[InventoryService] Failed to record status history:', err);
      }
    }

    return updated;
  }

  async delete(id: string) {
    try {
      const [deleted] = await this.dbService.db
        .delete(inventories)
        .where(eq(inventories.id, id))
        .returning();

      if (!deleted) throw new NotFoundException(`Inventory item ${id} not found`);
      return deleted;
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      if (err.code === '23503' || (err.message && err.message.includes('violates foreign key constraint'))) {
        throw new ConflictException(
          'Cannot delete this inventory resource because it is actively referenced by privileged access grants or immutable compliance audit logs. Revoke active access grants or decommission the asset instead.',
        );
      }
      throw err;
    }
  }

  // ===========================================================================
  // Live Cloud Discovery & Service Account Key Asset Scanner
  // ===========================================================================
  async discoverCloudAssets(payload: {
    provider?: 'GCP' | 'AWS' | 'ALI_CLOUD' | 'AZURE';
    credentials?: any;
    credentialId?: string;
  }): Promise<{
    provider: string;
    projectId?: string;
    accountEmail?: string;
    discoveredCount: number;
    duplicateCount: number;
    resources: DiscoveredCloudAsset[];
  }> {
    let creds: any = payload.credentials;
    let provider: 'GCP' | 'AWS' | 'ALI_CLOUD' | 'AZURE' = payload.provider || 'GCP';

    if (payload.credentialId) {
      const savedCred = await this.credService.findOne(payload.credentialId, true);
      provider = savedCred.provider as any;
      creds = savedCred.keyBlob;
    }

    if (typeof creds === 'string') {
      try {
        creds = JSON.parse(creds);
      } catch {
        throw new BadRequestException('Invalid Credentials JSON format. Please provide valid JSON.');
      }
    }

    // Auto-detect masked key blobs and resolve to actual saved credentials
    if (
      creds &&
      typeof creds === 'object' &&
      creds.private_key &&
      typeof creds.private_key === 'string' &&
      creds.private_key.includes('[SECURE_CREDENTIAL_BLOB_STORED_IN_VAULT]')
    ) {
      const allSaved = await this.dbService.db.query.cloudCredentials.findMany();
      const match = allSaved.find((c: any) => {
        const raw = c.keyBlob;
        return (
          raw?.client_email === creds.client_email ||
          raw?.private_key_id === creds.private_key_id ||
          raw?.project_id === creds.project_id
        );
      });
      if (match) {
        const savedFull = await this.credService.findOne(match.id, true);
        provider = savedFull.provider as any;
        creds = savedFull.keyBlob;
      } else {
        throw new BadRequestException(
          'The provided credential has masked private keys. Please provide a valid credential ID or unmasked Service Account key JSON.',
        );
      }
    }

    if (!creds || typeof creds !== 'object') {
      throw new BadRequestException('Credentials payload must be an object, valid JSON string, or valid credentialId.');
    }

    let projectId = 'cloud-project';
    let accountEmail = 'service-account@iam.gserviceaccount.com';
    let candidatePool: Omit<DiscoveredCloudAsset, 'isDuplicate' | 'duplicateReason' | 'existingAssetTag' | 'existingId'>[] = [];

    if (provider === 'GCP') {
      if (creds.type && creds.type !== 'service_account') {
        throw new BadRequestException('The uploaded file is not a valid GCP Service Account JSON key.');
      }
      if (!creds.private_key || !creds.client_email) {
        throw new BadRequestException('The GCP Service Account key is missing required fields (client_email, private_key).');
      }

      projectId = creds.project_id || 'gcp-project';
      accountEmail = creds.client_email;

      try {
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
      projectId = creds.account_id || creds.project_id || 'cloud-account-prod';
      accountEmail = creds.access_key_id || 'IAM_USER';
      const sanitizedProj = projectId.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

      candidatePool = [
        {
          candidateId: `cand-vm-1-${sanitizedProj}`,
          name: `${sanitizedProj}-api-gateway-01`,
          assetTag: `AST-VM-${sanitizedProj.slice(0, 6).toUpperCase()}-01`,
          assetType: 'VIRTUAL_MACHINE',
          provider: provider,
          region: 'asia-southeast2',
          zone: 'asia-southeast2-a',
          primaryIp: '10.140.1.15',
          specs: { cpu_cores: 8, ram_gb: 32, disk_gb: 200, os: 'Ubuntu 24.04 LTS' },
          cloudMetadata: { projectId, sa: accountEmail },
        },
      ];
    }

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
      provider,
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
      const newInventory = await this.create(
        {
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
        },
        'CLOUD_IMPORT',
      );

      importedRecords.push(newInventory);
    }

    return {
      importedCount: importedRecords.length,
      items: importedRecords,
    };
  }

  // ===========================================================================
  // Periodic & On-Demand Re-Scan with Automated Change/Drift Detection
  // ===========================================================================
  async reScanServiceAccount(credentialId: string): Promise<ReScanResult> {
    const cred = await this.credService.findOne(credentialId, true);
    await this.credService.updateScanStatus(credentialId, 'SCANNING');

    try {
      const liveDiscovery = await this.discoverCloudAssets({
        provider: cred.provider as any,
        credentials: cred.keyBlob,
      });

      const existingList = await this.findAll();
      const driftEvents: ReScanResult['driftEvents'] = [];

      let newAssetsCount = 0;
      let updatedAssetsCount = 0;
      let unchangedAssetsCount = 0;
      let decommissionedAssetsCount = 0;

      // Process each discovered asset
      for (const discovered of liveDiscovery.resources) {
        // Find existing match by assetTag or primaryIp or name
        const match = existingList.find((ex) => {
          const matchTag = ex.assetTag && ex.assetTag.toLowerCase() === discovered.assetTag.toLowerCase();
          const matchName = ex.name && ex.name.toLowerCase() === discovered.name.toLowerCase();
          const matchIp = ex.primaryIp && discovered.primaryIp && ex.primaryIp === discovered.primaryIp && ex.primaryIp !== '10.0.0.1';
          return matchTag || matchName || matchIp;
        });

        if (match) {
          // Compare specs, status, and IP to detect drift
          const prevSpecs = (match.specs as Record<string, any>) || {};
          const newSpecs = discovered.specs || {};

          const statusChanged = discovered.cloudMetadata?.status && discovered.cloudMetadata.status !== prevSpecs.status;
          const ipChanged = discovered.primaryIp && discovered.primaryIp !== match.primaryIp && discovered.primaryIp !== '10.0.0.1';
          const machineTypeChanged = newSpecs.machine_type && prevSpecs.machine_type && newSpecs.machine_type !== prevSpecs.machine_type;
          const diskChanged = newSpecs.disk_gb && prevSpecs.disk_gb && newSpecs.disk_gb !== prevSpecs.disk_gb;

          const hasDrift = statusChanged || ipChanged || machineTypeChanged || diskChanged;

          if (hasDrift) {
            const diffSummaryParts: string[] = [];
            const prevDiff: Record<string, any> = {};
            const newDiff: Record<string, any> = {};

            if (statusChanged) {
              diffSummaryParts.push(`Instance status changed: ${prevSpecs.status || match.status} -> ${discovered.cloudMetadata.status}`);
              prevDiff.status = prevSpecs.status || match.status;
              newDiff.status = discovered.cloudMetadata.status;
            }
            if (ipChanged) {
              diffSummaryParts.push(`Primary IP changed: ${match.primaryIp || 'None'} -> ${discovered.primaryIp}`);
              prevDiff.primaryIp = match.primaryIp;
              newDiff.primaryIp = discovered.primaryIp;
            }
            if (machineTypeChanged) {
              diffSummaryParts.push(`Machine type resized: ${prevSpecs.machine_type} -> ${newSpecs.machine_type}`);
              prevDiff.machine_type = prevSpecs.machine_type;
              newDiff.machine_type = newSpecs.machine_type;
            }
            if (diskChanged) {
              diffSummaryParts.push(`Disk capacity modified: ${prevSpecs.disk_gb}GB -> ${newSpecs.disk_gb}GB`);
              prevDiff.disk_gb = prevSpecs.disk_gb;
              newDiff.disk_gb = newSpecs.disk_gb;
            }

            const changeSummary = `[Auto Re-Scan] ${diffSummaryParts.join('; ')}`;

            // Update inventory record with latest specs and IP
            const updatedSpecs = { ...prevSpecs, ...newSpecs };
            await this.dbService.db
              .update(inventories)
              .set({
                specs: updatedSpecs,
                primaryIp: (discovered.primaryIp || match.primaryIp) as any,
                updatedAt: new Date(),
              })
              .where(eq(inventories.id, match.id));

            // Record historical log
            await this.dbService.db.insert(inventoryHistory).values({
              inventoryId: match.id,
              serviceAccountId: cred.id,
              changeType: statusChanged ? 'STATUS_CHANGED' : 'SPECS_CHANGED',
              changeSummary,
              previousState: prevDiff,
              newState: newDiff,
              source: 'AUTOMATED_SCAN',
            });

            updatedAssetsCount++;
            driftEvents.push({
              inventoryId: match.id,
              assetTag: match.assetTag,
              assetName: match.name,
              changeType: 'SPECS_CHANGED',
              changeSummary,
            });
          } else {
            unchangedAssetsCount++;
          }
        } else {
          // Newly discovered cloud asset that doesn't exist yet in inventory
          newAssetsCount++;
          driftEvents.push({
            inventoryId: 'unregistered',
            assetTag: discovered.assetTag,
            assetName: discovered.name,
            changeType: 'DISCOVERED_NEW',
            changeSummary: `New cloud instance "${discovered.name}" (${discovered.assetType}) detected in project "${liveDiscovery.projectId}"`,
          });
        }
      }

      const scanSummary = {
        totalDiscovered: liveDiscovery.discoveredCount,
        newAssetsCount,
        updatedAssetsCount,
        unchangedAssetsCount,
        decommissionedAssetsCount,
        lastScannedAt: new Date().toISOString(),
      };

      await this.credService.updateScanStatus(credentialId, 'SUCCESS', scanSummary);

      return {
        credentialId: cred.id,
        credentialName: cred.name,
        provider: cred.provider,
        projectId: liveDiscovery.projectId,
        scannedAt: new Date().toISOString(),
        totalDiscovered: liveDiscovery.discoveredCount,
        newAssetsCount,
        updatedAssetsCount,
        unchangedAssetsCount,
        decommissionedAssetsCount,
        driftEvents,
      };
    } catch (err: any) {
      await this.credService.updateScanStatus(credentialId, 'FAILED', {}, err.message);
      throw err;
    }
  }

  async reScanAllActiveCredentials(): Promise<ReScanResult[]> {
    const allCreds = await this.credService.findAll();
    const activeCreds = allCreds.filter((c) => c.isActive);

    const results: ReScanResult[] = [];
    for (const cred of activeCreds) {
      try {
        const res = await this.reScanServiceAccount(cred.id);
        results.push(res);
      } catch (err: any) {
        console.error(`[InventoryService] Error re-scanning cred ${cred.name}:`, err.message);
      }
    }

    return results;
  }

  // ===========================================================================
  // Historical Inventory Changelogs & Audit Logs
  // ===========================================================================
  async getInventoryHistory(inventoryId: string) {
    return this.dbService.db.query.inventoryHistory.findMany({
      where: eq(inventoryHistory.inventoryId, inventoryId),
      with: {
        serviceAccount: true,
      },
      orderBy: [desc(inventoryHistory.createdAt)],
    });
  }

  async getAllRecentHistory(limit = 50) {
    return this.dbService.db.query.inventoryHistory.findMany({
      with: {
        inventory: true,
        serviceAccount: true,
      },
      orderBy: [desc(inventoryHistory.createdAt)],
      limit,
    });
  }
}
