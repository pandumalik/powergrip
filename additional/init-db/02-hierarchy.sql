-- =============================================================================
-- Hierarchy Seed: Admin -> Manager -> Employee
-- =============================================================================

INSERT INTO departments (id, code, name)
VALUES ('d1111111-1111-1111-1111-111111111111', 'CLOUD_OPS', 'Cloud Platform & Infrastructure Engineering')
ON CONFLICT (code) DO NOTHING;

INSERT INTO employees (id, user_id, department_id, manager_id, employee_number, first_name, last_name, email, job_title, hierarchy_path, employment_status, metadata)
VALUES 
(
  'a1111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  'd1111111-1111-1111-1111-111111111111',
  NULL,
  'EMP-ADM-101',
  'Sarah',
  'Jenkins',
  'admin@powergrip.internal',
  'Principal Systems Director & Superadmin',
  'ROOT.ADMIN',
  'ACTIVE',
  '{"role": "Admin", "tier": "L1_EXECUTIVE", "permissions": ["*"]}'::jsonb
),
(
  'b2222222-2222-2222-2222-222222222222',
  'b2222222-2222-2222-2222-222222222222',
  'd1111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  'EMP-MGR-201',
  'Marcus',
  'Vance',
  'manager@powergrip.internal',
  'Head of Cloud Operations & Squad Lead',
  'ROOT.ADMIN.MGR',
  'ACTIVE',
  '{"role": "Manager", "tier": "L2_MANAGEMENT", "permissions": ["clients:read", "projects:*", "inventories:read", "inventories:write", "access:endorse", "access:approve", "employees:read"]}'::jsonb
),
(
  'c3333333-3333-3333-3333-333333333333',
  'c3333333-3333-3333-3333-333333333333',
  'd1111111-1111-1111-1111-111111111111',
  'b2222222-2222-2222-2222-222222222222',
  'EMP-EMP-301',
  'Elena',
  'Rostova',
  'employee@powergrip.internal',
  'Cloud Platform & SRE Engineer',
  'ROOT.ADMIN.MGR.EMP',
  'ACTIVE',
  '{"role": "Employee", "tier": "L3_ENGINEERING", "permissions": ["projects:read", "inventories:read", "access:request", "employees:read"]}'::jsonb
)
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  job_title = EXCLUDED.job_title,
  hierarchy_path = EXCLUDED.hierarchy_path,
  manager_id = EXCLUDED.manager_id,
  metadata = EXCLUDED.metadata;
