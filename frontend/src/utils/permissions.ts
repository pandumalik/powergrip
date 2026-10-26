export type UserRole = 'Admin' | 'Manager' | 'Employee' | string;

export interface RolePermissions {
  role: 'Admin' | 'Manager' | 'Employee';
  roleDisplayName: string;
  roleBadgeClass: string;
  hierarchyLevel: number; // 1 = Admin, 2 = Manager, 3 = Employee

  // Navigation
  canAccessClients: boolean;
  canAccessProjects: boolean;
  canAccessInventory: boolean;
  canAccessAccessPAM: boolean;
  canAccessOrgHierarchy: boolean;
  canAccessSettings: boolean;

  // Client Management
  canCreateClient: boolean;
  canEditClient: boolean;
  canDeleteClient: boolean;

  // Project Management
  canCreateProject: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
  canAssignSquadMembers: boolean;

  // Inventory Management
  canCreateInventory: boolean;
  canEditInventory: boolean;
  canDeleteInventory: boolean;
  canSyncCloudCredentials: boolean;

  // Privileged Access Management (PAM)
  canRequestAccess: boolean;
  canViewAllAccessRequests: boolean; // Admin & Manager see all, Employee only sees their own
  canApproveStandardGrant: boolean; // OPERATOR, READ_WRITE
  canApproveElevatedGrant: boolean; // ADMIN, ROOT_SUPERADMIN
  canRevokeAnyGrant: boolean;
  canRevokeOwnGrant: boolean;
  canDeleteGrant: boolean; // Admin: true, others: false
  canCancelOwnRequest: boolean; // Can withdraw pending access request
  canBulkManageGrants: boolean;

  // Employee Directory & Hierarchy
  canCreateEmployee: boolean;
  canEditEmployee: boolean;
  canOffboardEmployee: boolean;
}

export function normalizeRole(role?: string): 'Admin' | 'Manager' | 'Employee' {
  const r = (role || '').trim().toLowerCase();
  if (r === 'admin' || r.includes('admin') || r.includes('superadmin') || r === 'principal') {
    return 'Admin';
  }
  if (r === 'manager' || r.includes('manager') || r.includes('lead') || r.includes('head')) {
    return 'Manager';
  }
  return 'Employee';
}

export function getRolePermissions(role?: string): RolePermissions {
  const norm = normalizeRole(role);

  switch (norm) {
    case 'Admin':
      return {
        role: 'Admin',
        roleDisplayName: 'System Administrator (Level 1)',
        roleBadgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
        hierarchyLevel: 1,

        canAccessClients: true,
        canAccessProjects: true,
        canAccessInventory: true,
        canAccessAccessPAM: true,
        canAccessOrgHierarchy: true,
        canAccessSettings: true,

        canCreateClient: true,
        canEditClient: true,
        canDeleteClient: true,

        canCreateProject: true,
        canEditProject: true,
        canDeleteProject: true,
        canAssignSquadMembers: true,

        canCreateInventory: true,
        canEditInventory: true,
        canDeleteInventory: true,
        canSyncCloudCredentials: true,

        canRequestAccess: true,
        canViewAllAccessRequests: true,
        canApproveStandardGrant: true,
        canApproveElevatedGrant: true,
        canRevokeAnyGrant: true,
        canRevokeOwnGrant: true,
        canDeleteGrant: true,
        canCancelOwnRequest: true,
        canBulkManageGrants: true,

        canCreateEmployee: true,
        canEditEmployee: true,
        canOffboardEmployee: true,
      };

    case 'Manager':
      return {
        role: 'Manager',
        roleDisplayName: 'Squad & Ops Manager (Level 2)',
        roleBadgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
        hierarchyLevel: 2,

        canAccessClients: true,
        canAccessProjects: true,
        canAccessInventory: true,
        canAccessAccessPAM: true,
        canAccessOrgHierarchy: true,
        canAccessSettings: false,

        canCreateClient: false, // Managers view accounts & SLAs, cannot delete or register legal entities
        canEditClient: true,
        canDeleteClient: false,

        canCreateProject: true,
        canEditProject: true,
        canDeleteProject: false, // Cannot permanently delete company project history
        canAssignSquadMembers: true,

        canCreateInventory: true,
        canEditInventory: true,
        canDeleteInventory: false,
        canSyncCloudCredentials: true,

        canRequestAccess: true,
        canViewAllAccessRequests: true, // Managers see all requests to oversee squad approvals
        canApproveStandardGrant: true, // Can approve OPERATOR & READ_WRITE for squads
        canApproveElevatedGrant: false, // Cannot approve ROOT or ADMIN (escalates to Admin)
        canRevokeAnyGrant: true,
        canRevokeOwnGrant: true,
        canDeleteGrant: false, // Cannot delete grant records
        canCancelOwnRequest: true,
        canBulkManageGrants: false,

        canCreateEmployee: false,
        canEditEmployee: false,
        canOffboardEmployee: false, // Only Admin can execute offboarding & key revoking
      };

    case 'Employee':
    default:
      return {
        role: 'Employee',
        roleDisplayName: 'Standard Engineer (Level 3)',
        roleBadgeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
        hierarchyLevel: 3,

        canAccessClients: true, // View-only client project references
        canAccessProjects: true,
        canAccessInventory: true,
        canAccessAccessPAM: true,
        canAccessOrgHierarchy: true,
        canAccessSettings: false,

        canCreateClient: false,
        canEditClient: false,
        canDeleteClient: false,

        canCreateProject: false,
        canEditProject: false,
        canDeleteProject: false,
        canAssignSquadMembers: false,

        canCreateInventory: false,
        canEditInventory: false,
        canDeleteInventory: false,
        canSyncCloudCredentials: false,

        canRequestAccess: true, // Can submit Just-In-Time (JIT) access requests
        canViewAllAccessRequests: false, // Employee ONLY sees their own requests
        canApproveStandardGrant: false, // Cannot approve others
        canApproveElevatedGrant: false,
        canRevokeAnyGrant: false,
        canRevokeOwnGrant: true, // Can terminate their own active sessions
        canDeleteGrant: false, // CANNOT delete grant records
        canCancelOwnRequest: true, // Can cancel/withdraw their own pending request
        canBulkManageGrants: false,

        canCreateEmployee: false,
        canEditEmployee: false,
        canOffboardEmployee: false,
      };
  }
}
