import * as crypto from 'crypto';

export interface GcpServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

export interface DiscoveredResource {
  candidateId: string;
  name: string;
  assetTag: string;
  assetType: 'VIRTUAL_MACHINE' | 'DATABASE' | 'KUBERNETES';
  provider: 'GCP';
  region: string;
  zone?: string;
  primaryIp: string;
  specs: Record<string, any>;
  cloudMetadata: Record<string, any>;
}

export class GcpDiscoveryEngine {
  /**
   * Generates a Google OAuth2 Access Token using JWT bearer grant for the Service Account.
   */
  static async getAccessToken(saKey: GcpServiceAccountKey): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: saKey.private_key_id,
    };

    const payload = {
      iss: saKey.client_email,
      sub: saKey.client_email,
      aud: saKey.token_uri || 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      iat: now,
      exp: now + 3600,
    };

    const base64Url = (obj: any) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');

    const unsignedToken = `${base64Url(header)}.${base64Url(payload)}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedToken);
    const signature = sign.sign(saKey.private_key, 'base64url');
    const assertion = `${unsignedToken}.${signature}`;

    const tokenEndpoint = saKey.token_uri || 'https://oauth2.googleapis.com/token';

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GCP OAuth2 Authentication Failed (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  /**
   * Discovers Compute Engine Instances (VMs) across all zones in the project.
   */
  static async discoverComputeInstances(
    projectId: string,
    accessToken: string,
  ): Promise<DiscoveredResource[]> {
    const url = `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregated/instances`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[GCP Discovery] Compute API returned ${res.status}: ${err}`);
      return [];
    }

    const data = (await res.json()) as { items?: Record<string, { instances?: any[] }> };
    const discovered: DiscoveredResource[] = [];

    if (data.items) {
      for (const [zoneKey, zoneData] of Object.entries(data.items)) {
        if (!zoneData.instances || zoneData.instances.length === 0) continue;

        const zoneName = zoneKey.replace('zones/', '');
        const regionName = zoneName.split('-').slice(0, 2).join('-');

        for (const inst of zoneData.instances) {
          const networkInterface = inst.networkInterfaces?.[0];
          const privateIp = networkInterface?.networkIP || '10.0.0.1';
          const publicIp = networkInterface?.accessConfigs?.[0]?.natIP;

          // Parse machine type basename (e.g. e2-standard-4)
          const machineType = inst.machineType?.split('/')?.pop() || 'custom';
          const diskSize = inst.disks?.[0]?.diskSizeGb ? parseInt(inst.disks[0].diskSizeGb, 10) : 50;

          discovered.push({
            candidateId: `gcp-vm-${inst.id || inst.name}`,
            name: inst.name,
            assetTag: `AST-GCP-VM-${(inst.id || inst.name).toString().slice(-6).toUpperCase()}`,
            assetType: 'VIRTUAL_MACHINE',
            provider: 'GCP',
            region: regionName,
            zone: zoneName,
            primaryIp: privateIp,
            specs: {
              machine_type: machineType,
              disk_gb: diskSize,
              status: inst.status,
              public_ip: publicIp,
              cpu_platform: inst.cpuPlatform,
            },
            cloudMetadata: {
              projectId,
              zone: zoneName,
              instanceId: inst.id,
              status: inst.status,
              creationTimestamp: inst.creationTimestamp,
              tags: inst.tags?.items || [],
            },
          });
        }
      }
    }

    return discovered;
  }

  /**
   * Discovers CloudSQL Databases in the project.
   */
  static async discoverCloudSqlInstances(
    projectId: string,
    accessToken: string,
  ): Promise<DiscoveredResource[]> {
    const url = `https://sqladmin.googleapis.com/sql/v1beta4/projects/${projectId}/instances`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[GCP Discovery] Cloud SQL API returned ${res.status}: ${err}`);
      return [];
    }

    const data = (await res.json()) as { items?: any[] };
    const discovered: DiscoveredResource[] = [];

    if (data.items && Array.isArray(data.items)) {
      for (const sql of data.items) {
        const ipInfo = sql.ipAddresses?.find((ip: any) => ip.type === 'PRIVATE') || sql.ipAddresses?.[0];
        const primaryIp = ipInfo?.ipAddress || '10.140.2.20';
        const tier = sql.settings?.tier || 'db-custom';
        const diskSize = sql.settings?.dataDiskSizeGb ? parseInt(sql.settings.dataDiskSizeGb, 10) : 100;
        const isHa = sql.settings?.availabilityType === 'REGIONAL';

        discovered.push({
          candidateId: `gcp-sql-${sql.name}`,
          name: sql.name,
          assetTag: `AST-GCP-DB-${sql.name.slice(0, 8).toUpperCase()}`,
          assetType: 'DATABASE',
          provider: 'GCP',
          region: sql.region || 'asia-southeast2',
          zone: sql.gceZone,
          primaryIp,
          specs: {
            engine: sql.databaseVersion || 'PostgreSQL / MySQL',
            tier,
            disk_gb: diskSize,
            ha_enabled: isHa,
            state: sql.state,
          },
          cloudMetadata: {
            projectId,
            instanceType: 'CloudSQL',
            version: sql.databaseVersion,
            state: sql.state,
            backendType: sql.backendType,
          },
        });
      }
    }

    return discovered;
  }

  /**
   * Discovers Google Kubernetes Engine (GKE) Clusters in the project.
   */
  static async discoverGkeClusters(
    projectId: string,
    accessToken: string,
  ): Promise<DiscoveredResource[]> {
    const url = `https://container.googleapis.com/v1/projects/${projectId}/locations/-/clusters`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[GCP Discovery] GKE API returned ${res.status}: ${err}`);
      return [];
    }

    const data = (await res.json()) as { clusters?: any[] };
    const discovered: DiscoveredResource[] = [];

    if (data.clusters && Array.isArray(data.clusters)) {
      for (const cluster of data.clusters) {
        const nodeCount = cluster.currentNodeCount || cluster.initialNodeCount || 3;
        const region = cluster.location?.includes('-') ? cluster.location.split('-').slice(0, 2).join('-') : cluster.location;

        discovered.push({
          candidateId: `gcp-gke-${cluster.name}`,
          name: cluster.name,
          assetTag: `AST-GCP-K8S-${cluster.name.slice(0, 8).toUpperCase()}`,
          assetType: 'KUBERNETES',
          provider: 'GCP',
          region: region || 'asia-southeast2',
          zone: cluster.location,
          primaryIp: cluster.endpoint || cluster.privateClusterConfig?.privateEndpoint || '10.140.3.10',
          specs: {
            k8s_version: cluster.currentMasterVersion || cluster.initialClusterVersion,
            total_nodes: nodeCount,
            node_pools: cluster.nodePools?.length || 1,
            status: cluster.status,
            autopilot: !!cluster.autopilot?.enabled,
          },
          cloudMetadata: {
            projectId,
            endpoint: cluster.endpoint,
            status: cluster.status,
            nodePools: cluster.nodePools?.map((np: any) => ({ name: np.name, machineType: np.config?.machineType, count: np.initialNodeCount })) || [],
          },
        });
      }
    }

    return discovered;
  }

  /**
   * Performs full discovery against live GCP APIs using the provided Service Account key.
   */
  static async discoverAll(saKey: GcpServiceAccountKey): Promise<{
    projectId: string;
    accountEmail: string;
    resources: DiscoveredResource[];
  }> {
    const accessToken = await this.getAccessToken(saKey);
    const projectId = saKey.project_id;

    console.log(`[GCP Live Discovery] Authenticated SA ${saKey.client_email} for Project ${projectId}`);

    // Run parallel discovery on Compute, Cloud SQL, and GKE
    const [vms, databases, kubernetes] = await Promise.allSettled([
      this.discoverComputeInstances(projectId, accessToken),
      this.discoverCloudSqlInstances(projectId, accessToken),
      this.discoverGkeClusters(projectId, accessToken),
    ]);

    const resources: DiscoveredResource[] = [];

    if (vms.status === 'fulfilled') resources.push(...vms.value);
    else console.error('[GCP Discovery] VM error:', vms.reason);

    if (databases.status === 'fulfilled') resources.push(...databases.value);
    else console.error('[GCP Discovery] DB error:', databases.reason);

    if (kubernetes.status === 'fulfilled') resources.push(...kubernetes.value);
    else console.error('[GCP Discovery] K8s error:', kubernetes.reason);

    console.log(`[GCP Live Discovery] Found ${resources.length} live resources in GCP Project ${projectId}`);

    return {
      projectId,
      accountEmail: saKey.client_email,
      resources,
    };
  }
}
