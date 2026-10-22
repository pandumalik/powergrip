import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { cloudCredentials } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

export interface CloudCredentialDto {
  name?: string;
  provider?: 'GCP' | 'AWS' | 'ALI_CLOUD' | 'AZURE' | 'ON_PREMISE';
  keyBlob: any;
  clientId?: string;
  autoScanInterval?: string;
  isActive?: boolean;
}

@Injectable()
export class CloudCredentialService {
  constructor(@Inject(DatabaseService) private dbService: DatabaseService) {}

  /**
   * Helper to parse and extract metadata from arbitrary cloud key blobs
   */
  static extractMetadata(keyBlob: any, explicitProvider?: string) {
    let parsedBlob: any = keyBlob;
    if (typeof keyBlob === 'string') {
      try {
        parsedBlob = JSON.parse(keyBlob);
      } catch {
        throw new BadRequestException('Invalid JSON format for Service Account Key Blob.');
      }
    }

    if (!parsedBlob || typeof parsedBlob !== 'object') {
      throw new BadRequestException('Key Blob must be a valid JSON object.');
    }

    let detectedProvider = explicitProvider || 'GCP';
    let projectId = 'cloud-project';
    let accountEmail = 'service-account';
    let keyType = 'service_account';

    if (parsedBlob.private_key && typeof parsedBlob.private_key === 'string') {
      parsedBlob.private_key = parsedBlob.private_key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
    }

    if (parsedBlob.type === 'service_account' || parsedBlob.private_key_id) {
      detectedProvider = 'GCP';
      projectId = parsedBlob.project_id || 'gcp-project';
      accountEmail = parsedBlob.client_email || 'sa@iam.gserviceaccount.com';
      keyType = 'gcp_service_account';
    } else if (parsedBlob.aws_access_key_id || parsedBlob.access_key_id || parsedBlob.RoleArn) {
      detectedProvider = 'AWS';
      projectId = parsedBlob.account_id || (parsedBlob.RoleArn ? parsedBlob.RoleArn.split(':')[4] : 'aws-account');
      accountEmail = parsedBlob.access_key_id || parsedBlob.aws_access_key_id || 'AWS_IAM_CREDENTIAL';
      keyType = 'aws_iam_key';
    } else if (parsedBlob.tenant_id || parsedBlob.client_id || parsedBlob.subscription_id) {
      detectedProvider = 'AZURE';
      projectId = parsedBlob.subscription_id || parsedBlob.tenant_id || 'azure-subscription';
      accountEmail = parsedBlob.client_id || 'azure-service-principal';
      keyType = 'azure_sp_json';
    } else if (parsedBlob.access_key_secret || parsedBlob.ali_uid) {
      detectedProvider = 'ALI_CLOUD';
      projectId = parsedBlob.ali_uid || 'alicloud-account';
      accountEmail = parsedBlob.access_key_id || 'ali_ram_user';
      keyType = 'alicloud_ram';
    }

    return {
      parsedBlob,
      provider: detectedProvider as any,
      metadata: {
        projectId,
        accountEmail,
        keyType,
        privateKeyId: parsedBlob.private_key_id ? String(parsedBlob.private_key_id).slice(0, 8) + '...' : undefined,
        importedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Helper to mask sensitive fields in the blob before returning to client/API
   */
  static maskKeyBlob(blob: any) {
    if (!blob || typeof blob !== 'object') return {};
    const masked = { ...blob };
    if (masked.private_key) {
      masked.private_key = '-----BEGIN PRIVATE KEY-----\n[SECURE_CREDENTIAL_BLOB_STORED_IN_VAULT]\n-----END PRIVATE KEY-----';
    }
    if (masked.secret_access_key) {
      masked.secret_access_key = '********************************';
    }
    if (masked.client_secret) {
      masked.client_secret = '********************************';
    }
    return masked;
  }

  async findAll() {
    const list = await this.dbService.db.query.cloudCredentials.findMany({
      with: {
        client: true,
      },
      orderBy: [desc(cloudCredentials.createdAt)],
    });

    return list.map((item) => ({
      ...item,
      isActive: Boolean(item.isActive),
      keyBlob: CloudCredentialService.maskKeyBlob(item.keyBlob),
    }));
  }

  async findOne(id: string, includeFullBlob = false) {
    const cred = await this.dbService.db.query.cloudCredentials.findFirst({
      where: eq(cloudCredentials.id, id),
      with: {
        client: true,
      },
    });

    if (!cred) {
      throw new NotFoundException(`Cloud Credential ${id} not found`);
    }

    let keyBlob = cred.keyBlob;
    if (includeFullBlob && keyBlob && typeof keyBlob === 'object' && keyBlob.private_key) {
      keyBlob = {
        ...keyBlob,
        private_key: typeof keyBlob.private_key === 'string'
          ? keyBlob.private_key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim()
          : keyBlob.private_key,
      };
    }

    return {
      ...cred,
      isActive: Boolean(cred.isActive),
      keyBlob: includeFullBlob ? keyBlob : CloudCredentialService.maskKeyBlob(cred.keyBlob),
    };
  }

  async create(dto: CloudCredentialDto) {
    const { parsedBlob, provider, metadata } = CloudCredentialService.extractMetadata(dto.keyBlob, dto.provider);
    const friendlyName =
      dto.name && dto.name.trim() !== ''
        ? dto.name.trim()
        : `${metadata.projectId || 'cloud'}-${(metadata.accountEmail || 'sa').split('@')[0] || 'key'}.json`;

    let clientId: string | undefined = dto.clientId;
    if (clientId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);
      if (!isUuid) {
        const firstClient = await this.dbService.db.query.clients.findFirst();
        clientId = firstClient?.id || undefined;
      }
    }

    const [created] = await this.dbService.db
      .insert(cloudCredentials)
      .values({
        name: friendlyName,
        provider: (dto.provider || provider) as any,
        keyBlob: parsedBlob,
        clientId: clientId || undefined,
        metadata: {
          ...metadata,
          originalFileName: dto.name || undefined,
        },
        autoScanInterval: dto.autoScanInterval || '1h',
        isActive: dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : 1,
        scanStatus: 'IDLE',
        lastScanSummary: {},
      })
      .returning();

    return {
      ...created,
      isActive: Boolean(created.isActive),
      keyBlob: CloudCredentialService.maskKeyBlob(created.keyBlob),
    };
  }

  async batchCreate(items: CloudCredentialDto[]) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('No credentials provided for batch import');
    }

    const results = [];
    for (const item of items) {
      try {
        const created = await this.create(item);
        results.push(created);
      } catch (err: any) {
        console.warn('[CloudCredentialService] Batch item error:', err.message);
      }
    }

    return {
      importedCount: results.length,
      credentials: results,
    };
  }

  async update(id: string, data: Partial<CloudCredentialDto & { scanStatus: string; lastScanError: string; lastScanSummary: any }>) {
    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.provider !== undefined) updatePayload.provider = data.provider;
    if (data.autoScanInterval !== undefined) updatePayload.autoScanInterval = data.autoScanInterval;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive ? 1 : 0;
    if (data.clientId !== undefined) updatePayload.clientId = data.clientId || null;
    if (data.scanStatus !== undefined) updatePayload.scanStatus = data.scanStatus;
    if (data.lastScanError !== undefined) updatePayload.lastScanError = data.lastScanError;
    if (data.lastScanSummary !== undefined) updatePayload.lastScanSummary = data.lastScanSummary;

    if (data.keyBlob !== undefined) {
      const { parsedBlob, provider, metadata } = CloudCredentialService.extractMetadata(data.keyBlob, data.provider);
      updatePayload.keyBlob = parsedBlob;
      if (!data.provider) updatePayload.provider = provider;
      updatePayload.metadata = metadata;
    }

    const [updated] = await this.dbService.db
      .update(cloudCredentials)
      .set(updatePayload)
      .where(eq(cloudCredentials.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Cloud Credential ${id} not found`);
    }

    return {
      ...updated,
      isActive: Boolean(updated.isActive),
      keyBlob: CloudCredentialService.maskKeyBlob(updated.keyBlob),
    };
  }

  async updateScanStatus(id: string, status: string, summary?: any, error?: string) {
    const [updated] = await this.dbService.db
      .update(cloudCredentials)
      .set({
        scanStatus: status,
        lastScannedAt: new Date(),
        lastScanSummary: summary || {},
        lastScanError: error || null,
        updatedAt: new Date(),
      })
      .where(eq(cloudCredentials.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    const [deleted] = await this.dbService.db
      .delete(cloudCredentials)
      .where(eq(cloudCredentials.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundException(`Cloud Credential ${id} not found`);
    }

    return { success: true, id };
  }
}
