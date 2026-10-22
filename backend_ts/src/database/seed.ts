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

    // =========================================================================
    // 3. Clean up any pre-existing dummy resource entities
    // (Allowing user to input all clients, projects, inventories, and grants manually)
    // =========================================================================
    await db.delete(schema.inventoryHistory);
    await db.delete(schema.accessAuditLogs);
    await db.delete(schema.accessGrants);
    await db.delete(schema.inventories);
    await db.delete(schema.cloudCredentials);
    await db.delete(schema.projects);
    await db.delete(schema.contracts);
    await db.delete(schema.clients);
    console.log('🧹 Cleaned resource tables (Clients, Projects, Inventories, Grants) for clean slate manual input');

    // =========================================================================
    // 4. Seed MISC Industries Catalog
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

    console.log('🎉 Clean Base Database Seeding successfully completed! Ready for manual resource input.');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    await client.end();
  }
}

seed();
