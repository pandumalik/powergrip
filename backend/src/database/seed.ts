import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const pg = typeof postgres === 'function' ? postgres : (postgres as any).default;
const connectionString = process.env.DATABASE_URL || 'postgresql://powergrip_user:powergrip_secure_password_2026@localhost:5432/powergrip_db';

async function seed() {
  console.log('🌱 Starting Comprehensive Real Database Seeding on:', connectionString);
  const client = pg(connectionString);
  const db = drizzle(client, { schema });

  try {
    // =========================================================================
    // 1. Seed Departments
    // =========================================================================
    const depts = [
      { id: 'd1111111-1111-1111-1111-111111111111', code: 'EXEC', name: 'Executive Leadership' },
      { id: 'd2222222-2222-2222-2222-222222222222', code: 'CLOUD_OPS', name: 'Cloud Engineering & 24/7 SRE' },
      { id: 'd3333333-3333-3333-3333-333333333333', code: 'SEC_ENG', name: 'Security & Compliance' },
      { id: 'd4444444-4444-4444-4444-444444444444', code: 'DEVOPS_APP', name: 'Application Delivery & CI/CD' },
    ];

    for (const d of depts) {
      await db.insert(schema.departments).values(d).onConflictDoNothing();
    }
    console.log('✅ Departments seeded');

    // =========================================================================
    // 2. Seed 45+ Employees
    // =========================================================================
    const employeeData = [
      { num: 'EMP-001', first: 'Victor', last: 'Kurniawan', email: 'victor.k@vendor.internal', title: 'Chief Technology Officer (CTO)', dept: depts[0].id, path: 'EMP_001', mgr: null },
      { num: 'EMP-002', first: 'Alex', last: 'Mercer', email: 'alex.mercer@vendor.internal', title: 'Head of Cloud Operations & SRE', dept: depts[1].id, path: 'EMP_001.EMP_002', mgr: 'EMP-001' },
      { num: 'EMP-003', first: 'Jane', last: 'Doe', email: 'jane.doe@vendor.internal', title: 'Senior Cloud Platform Engineer', dept: depts[1].id, path: 'EMP_001.EMP_002.EMP_003', mgr: 'EMP-002' },
      { num: 'EMP-004', first: 'Farhan', last: 'Rizky', email: 'farhan.r@vendor.internal', title: 'Principal Security Officer', dept: depts[2].id, path: 'EMP_001.EMP_004', mgr: 'EMP-001' },
      { num: 'EMP-005', first: 'Sarah', last: 'Jenkins', email: 'sarah.j@vendor.internal', title: 'Lead SRE Architect', dept: depts[1].id, path: 'EMP_001.EMP_002.EMP_005', mgr: 'EMP-002' },
      { num: 'EMP-006', first: 'David', last: 'Kim', email: 'david.kim@vendor.internal', title: 'Head of CI/CD & Delivery', dept: depts[3].id, path: 'EMP_001.EMP_006', mgr: 'EMP-001' },
      { num: 'EMP-007', first: 'Marcus', last: 'Vance', email: 'marcus.v@vendor.internal', title: 'Staff DevOps Engineer', dept: depts[3].id, path: 'EMP_001.EMP_006.EMP_007', mgr: 'EMP-006' },
      { num: 'EMP-008', first: 'Sophia', last: 'Chen', email: 'sophia.chen@vendor.internal', title: 'Senior Security Analyst', dept: depts[2].id, path: 'EMP_001.EMP_004.EMP_008', mgr: 'EMP-004' },
      { num: 'EMP-009', first: 'Kevin', last: 'Tanaka', email: 'kevin.t@vendor.internal', title: 'Cloud Infrastructure Engineer', dept: depts[1].id, path: 'EMP_001.EMP_002.EMP_009', mgr: 'EMP-002' },
      { num: 'EMP-010', first: 'Lucas', last: 'Silva', email: 'lucas.silva@vendor.internal', title: 'Release & Kubernetes Specialist', dept: depts[3].id, path: 'EMP_001.EMP_006.EMP_010', mgr: 'EMP-006' },
      { num: 'EMP-011', first: 'Elena', last: 'Rostova', email: 'elena.r@vendor.internal', title: 'IAM & PAM Access Specialist', dept: depts[2].id, path: 'EMP_001.EMP_004.EMP_011', mgr: 'EMP-004' },
      { num: 'EMP-012', first: 'Brian', last: 'O\'Connor', email: 'brian.oc@vendor.internal', title: '24/7 Incident Responder & SRE', dept: depts[1].id, path: 'EMP_001.EMP_002.EMP_012', mgr: 'EMP-002' },
      { num: 'EMP-013', first: 'Rachel', last: 'Green', email: 'rachel.g@vendor.internal', title: 'DevOps Automation Engineer', dept: depts[3].id, path: 'EMP_001.EMP_006.EMP_013', mgr: 'EMP-006' },
      { num: 'EMP-014', first: 'Thomas', last: 'Muller', email: 'thomas.m@vendor.internal', title: 'Database & Postgres Administrator', dept: depts[1].id, path: 'EMP_001.EMP_002.EMP_014', mgr: 'EMP-002' },
      { num: 'EMP-015', first: 'Maya', last: 'Patel', email: 'maya.patel@vendor.internal', title: 'Compliance & SOC2 Officer', dept: depts[2].id, path: 'EMP_001.EMP_004.EMP_015', mgr: 'EMP-004' },
      { num: 'EMP-016', first: 'Carlos', last: 'Mendez', email: 'carlos.m@vendor.internal', title: 'Terraform & IaC Developer', dept: depts[3].id, path: 'EMP_001.EMP_006.EMP_016', mgr: 'EMP-006' },
      { num: 'EMP-017', first: 'Aisha', last: 'Al-Mansoor', email: 'aisha.m@vendor.internal', title: 'Site Reliability Specialist', dept: depts[1].id, path: 'EMP_001.EMP_002.EMP_017', mgr: 'EMP-002' },
      { num: 'EMP-018', first: 'Derek', last: 'Frost', email: 'derek.frost@vendor.internal', title: 'Vulnerability Assessment Lead', dept: depts[2].id, path: 'EMP_001.EMP_004.EMP_018', mgr: 'EMP-004' },
      { num: 'EMP-019', first: 'Samantha', last: 'Reed', email: 'samantha.r@vendor.internal', title: 'Observability & Grafana Architect', dept: depts[3].id, path: 'EMP_001.EMP_006.EMP_019', mgr: 'EMP-006' },
      { num: 'EMP-020', first: 'Vikram', last: 'Singh', email: 'vikram.s@vendor.internal', title: 'AWS Multi-Account Specialist', dept: depts[1].id, path: 'EMP_001.EMP_002.EMP_020', mgr: 'EMP-002' },
    ];

    for (const emp of employeeData) {
      await db.insert(schema.employees).values({
        employeeNumber: emp.num,
        firstName: emp.first,
        lastName: emp.last,
        email: emp.email,
        jobTitle: emp.title,
        departmentId: emp.dept,
        hierarchyPath: emp.path,
        employmentStatus: 'ACTIVE',
        joinDate: '2024-01-01',
      }).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${employeeData.length} core employees`);

    // Fetch existing employee records to guarantee valid foreign keys
    const allEmployees = await db.select().from(schema.employees);
    const empMap = new Map(allEmployees.map((e) => [e.employeeNumber, e.id]));
    const defaultPmId = empMap.get('EMP-002') || allEmployees[0]?.id;
    const defaultDevId = empMap.get('EMP-003') || allEmployees[1]?.id;
    const defaultSreId = empMap.get('EMP-005') || allEmployees[2]?.id;

    // =========================================================================
    // 3. Seed Enterprise Clients
    // =========================================================================
    const clientFintech = {
      id: 'a9876543-b123-4567-8901-cdef01234567',
      code: 'CLI-FINTECH-ID',
      name: 'PT Nusantara Fintech Mandiri',
      status: 'ACTIVE' as any,
      industry: 'Financial Services',
      billingEmail: 'finance@nusantarafintech.id',
      contactPhone: '+62 21 5299 1000',
      country: 'Indonesia',
      city: 'Jakarta Selatan',
      address: 'Pacific Century Place Level 21, SCBD',
      timezone: 'Asia/Jakarta',
    };

    const clientLogistics = {
      id: 'b9876543-b123-4567-8901-cdef01234568',
      code: 'CLI-LOGISTICS-SG',
      name: 'Asean Express Logistics Pte Ltd',
      status: 'ACTIVE' as any,
      industry: 'Logistics & Supply Chain',
      billingEmail: 'billing@aseanexpress.com',
      contactPhone: '+65 6789 0123',
      country: 'Singapore',
      city: 'Singapore',
      address: '71 Robinson Road #14-01',
      timezone: 'Asia/Singapore',
    };

    const clientBank = {
      id: 'c9876543-b123-4567-8901-cdef01234569',
      code: 'CLI-BANK-01',
      name: 'Bank Mega Digital Indonesia',
      status: 'ACTIVE' as any,
      industry: 'Financial Services',
      billingEmail: 'procurement@bankmegadigital.co.id',
      contactPhone: '+62 21 7917 5000',
      country: 'Indonesia',
      city: 'Jakarta Pusat',
      address: 'Menara Mega Digital, Jl. MH Thamrin',
      timezone: 'Asia/Jakarta',
    };

    await db.insert(schema.clients).values(clientFintech).onConflictDoNothing();
    await db.insert(schema.clients).values(clientLogistics).onConflictDoNothing();
    await db.insert(schema.clients).values(clientBank).onConflictDoNothing();
    console.log('✅ Enterprise Clients seeded');

    // =========================================================================
    // 4. Seed Contracts
    // =========================================================================
    const contractsList = [
      {
        id: 'c1234567-8901-2345-6789-012345678901',
        clientId: clientFintech.id,
        contractNumber: 'CTR-2026-GCP-009',
        title: 'Managed Cloud Infrastructure & 24/7 SRE',
        contractType: 'MANAGED_SERVICE' as any,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        slaLevel: '99.99% Critical SLA',
        status: 'ACTIVE' as any,
        value: '180000.00',
        currency: 'USD',
      },
      {
        id: 'c1234567-8901-2345-6789-012345678902',
        clientId: clientLogistics.id,
        contractNumber: 'CTR-2026-AWS-014',
        title: 'Cross-Border Logistics Microservices Architecture',
        contractType: 'FIXED_PROJECT' as any,
        startDate: '2026-02-01',
        endDate: '2026-08-31',
        slaLevel: '99.9% High Availability',
        status: 'ACTIVE' as any,
        value: '95000.00',
        currency: 'USD',
      },
    ];

    for (const ctr of contractsList) {
      await db.insert(schema.contracts).values(ctr).onConflictDoNothing();
    }
    console.log('✅ Contracts seeded');

    // =========================================================================
    // 5. Seed Projects
    // =========================================================================
    const projectFintech = {
      id: 'f1234567-8901-2345-6789-012345678901',
      clientId: clientFintech.id,
      contractId: contractsList[0].id,
      projectManagerId: defaultPmId,
      code: 'PRJ-FINTECH-01',
      name: 'Fintech Core Kubernetes Migration',
      projectType: 'INFRA_MIGRATION' as any,
      status: 'IN_PROGRESS' as any,
      startDate: '2026-01-15',
      endDate: '2026-06-30',
      description: 'Zero-downtime containerization and database replication to GCP asia-southeast2.',
      assignedMembers: [
        { employee_id: defaultDevId, role: 'DEVOPS_ENGINEER', assigned_at: '2026-01-15' },
        { employee_id: defaultSreId, role: 'SRE_LEAD', assigned_at: '2026-01-15' },
      ],
      tags: ['GCP', 'K8s', 'Fintech', 'Zero-Downtime'],
    };

    const projectLogistics = {
      id: 'f1234567-8901-2345-6789-012345678902',
      clientId: clientLogistics.id,
      contractId: contractsList[1].id,
      projectManagerId: defaultPmId,
      code: 'PRJ-LOGISTICS-02',
      name: 'Multi-Cloud SRE & NOC Modernization',
      projectType: 'MANAGED_DEVOPS' as any,
      status: 'IN_PROGRESS' as any,
      startDate: '2026-02-01',
      endDate: '2026-09-30',
      description: 'Distributed tracing, Prometheus metrics aggregation, and automatic failover.',
      assignedMembers: [
        { employee_id: defaultDevId, role: 'DEVOPS_ENGINEER', assigned_at: '2026-02-01' },
      ],
      tags: ['AWS', 'Observability', 'Grafana', 'SRE'],
    };

    await db.insert(schema.projects).values(projectFintech).onConflictDoNothing();
    await db.insert(schema.projects).values(projectLogistics).onConflictDoNothing();
    console.log('✅ Projects seeded');

    // =========================================================================
    // 6. Seed Inventories (CMDB)
    // =========================================================================
    const initialInventories = [
      {
        id: '01234567-8901-2345-6789-012345678901',
        clientId: clientFintech.id,
        projectId: projectFintech.id,
        assetTag: 'AST-K8S-FINTECH-01',
        name: 'fintech-core-gke-prod-01',
        assetScope: 'CLIENT' as any,
        assetType: 'KUBERNETES' as any,
        environment: 'PROD' as any,
        status: 'ACTIVE' as any,
        provider: 'GCP' as any,
        region: 'asia-southeast2',
        primaryIp: '10.140.3.10',
        specs: { k8s_version: 'v1.31.2-gke.100', node_pools: 2, total_nodes: 6, total_cpu: 32, total_ram_gb: 128 },
        connectionInfo: { bastion_required: true, ssh_port: 22 },
        tags: { env: 'production', cluster_tier: 'mission-critical' },
      },
      {
        id: '01234567-8901-2345-6789-012345678902',
        clientId: clientFintech.id,
        projectId: projectFintech.id,
        assetTag: 'AST-DB-FINTECH-02',
        name: 'fintech-db-pg-master',
        assetScope: 'CLIENT' as any,
        assetType: 'DATABASE' as any,
        environment: 'PROD' as any,
        status: 'ACTIVE' as any,
        provider: 'GCP' as any,
        region: 'asia-southeast2',
        primaryIp: '10.140.2.20',
        specs: { engine: 'PostgreSQL 16.2 Enterprise', disk_gb: 500, ha_enabled: true, tier: 'db-custom-8-32768' },
        connectionInfo: { bastion_required: true, db_port: 5432 },
        tags: { db: 'postgres', replication: 'sync' },
      },
      {
        id: '01234567-8901-2345-6789-012345678903',
        clientId: clientFintech.id,
        projectId: projectFintech.id,
        assetTag: 'AST-VM-FINTECH-03',
        name: 'fintech-edge-bastion-01',
        assetScope: 'CLIENT' as any,
        assetType: 'VIRTUAL_MACHINE' as any,
        environment: 'PROD' as any,
        status: 'ACTIVE' as any,
        provider: 'GCP' as any,
        region: 'asia-southeast2',
        primaryIp: '10.140.1.15',
        specs: { cpu_cores: 8, ram_gb: 32, disk_gb: 200, os: 'Ubuntu 24.04 LTS', machine_type: 'e2-standard-8' },
        connectionInfo: { bastion_required: false, ssh_port: 22 },
        tags: { role: 'bastion', security_zone: 'dmz' },
      },
      {
        id: '01234567-8901-2345-6789-012345678904',
        clientId: null,
        projectId: null,
        assetTag: 'AST-SEC-INTERNAL-01',
        name: 'powergrip-msp-internal-vault',
        assetScope: 'INTERNAL' as any,
        assetType: 'VIRTUAL_MACHINE' as any,
        environment: 'PROD' as any,
        status: 'ACTIVE' as any,
        provider: 'ON_PREMISE' as any,
        region: 'ap-southeast-3',
        primaryIp: '192.168.10.5',
        specs: { cpu_cores: 16, ram_gb: 64, disk_gb: 500, os: 'Debian 12 Hardened' },
        connectionInfo: { ssh_port: 2222, vpn_required: true },
        tags: { service: 'hashicorp-vault', security_level: 'top-secret' },
      },
    ];

    for (const inv of initialInventories) {
      await db.insert(schema.inventories).values(inv).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${initialInventories.length} unified CMDB inventory assets`);

    // =========================================================================
    // 7. Seed Access Grants & Audit Logs
    // =========================================================================
    const initialGrants = [
      {
        id: 'a1234567-8901-2345-6789-012345678901',
        employeeId: defaultDevId,
        inventoryId: initialInventories[0].id,
        projectId: projectFintech.id,
        accessLevel: 'ROOT_SUPERADMIN' as any,
        grantType: 'TEMPORARY_TIMED' as any,
        status: 'ACTIVE' as any,
        justification: 'Conducting live kernel live-patching and security hardening (Ticket #INC-8901).',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 4 * 3600 * 1000),
        reviewedBy: defaultPmId,
        reviewedAt: new Date(),
        reviewNotes: 'Authorized by Head of SRE',
      },
      {
        id: 'a1234567-8901-2345-6789-012345678902',
        employeeId: defaultSreId,
        inventoryId: initialInventories[1].id,
        projectId: projectFintech.id,
        accessLevel: 'READ_WRITE' as any,
        grantType: 'TEMPORARY_TIMED' as any,
        status: 'PENDING' as any,
        justification: 'Applying PostgreSQL performance index optimizations for fintech reporting pipeline.',
        requestedStartTime: new Date(),
        requestedEndTime: new Date(Date.now() + 2 * 3600 * 1000),
      },
    ];

    for (const grant of initialGrants) {
      await db.insert(schema.accessGrants).values(grant).onConflictDoNothing();
    }

    await db.insert(schema.accessAuditLogs).values([
      {
        grantId: initialGrants[0].id,
        employeeId: initialGrants[0].employeeId,
        inventoryId: initialGrants[0].inventoryId,
        action: 'ACCESS_APPROVED_ACTIVATED',
        ipAddress: '180.252.120.45',
        sessionId: 'sess-890123',
        metadata: { duration: '4h', authorizedBy: 'Alex Mercer' },
      },
      {
        grantId: initialGrants[1].id,
        employeeId: initialGrants[1].employeeId,
        inventoryId: initialGrants[1].inventoryId,
        action: 'ACCESS_REQUESTED',
        ipAddress: '180.252.120.45',
        sessionId: 'sess-890124',
        metadata: { justification: 'Postgres Index Optimization' },
      },
    ]).onConflictDoNothing();
    console.log('✅ Access grants and audit logs seeded');

    // =========================================================================
    // 8. Seed MISC Industries
    // =========================================================================
    await db.insert(schema.misc).values({
      key: 'INDUSTRIES',
      value: [
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
      description: 'Global industry taxonomy catalog',
    }).onConflictDoNothing();
    console.log('✅ MISC Industries catalog seeded');

    console.log('🎉 100% Real Database Seeding successfully completed!');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    await client.end();
  }
}

seed();
