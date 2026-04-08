import { useMemo } from "react";
import { Project } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Project role hierarchy (matches backend PROJECT_ROLE_PERMISSIONS).
 * Higher index = more permissions.
 */
const PROJECT_ROLE_HIERARCHY = ["viewer", "developer", "lead", "admin"] as const;
type ProjectRole = (typeof PROJECT_ROLE_HIERARCHY)[number];

/**
 * Backend-aligned permission matrix per project role.
 * Source: services/project-service/src/project/utils/permissions.ts
 */
const PROJECT_ROLE_PERMISSIONS: Record<
  ProjectRole,
  {
    canViewProject: boolean;
    canEditProject: boolean;
    canDeleteProject: boolean;
    canManageTeam: boolean;
    canCreateTasks: boolean;
    canEditTasks: boolean;
    canDeleteTasks: boolean;
    canAssignTasks: boolean;
    canViewAnalytics: boolean;
    canManageSprints: boolean;
    canManageReleases: boolean;
    canManageBudget: boolean;
    canApproveTimesheets: boolean;
  }
> = {
  admin: {
    canViewProject: true,
    canEditProject: true,
    canDeleteProject: true,
    canManageTeam: true,
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
    canAssignTasks: true,
    canViewAnalytics: true,
    canManageSprints: true,
    canManageReleases: true,
    canManageBudget: true,
    canApproveTimesheets: true,
  },
  lead: {
    canViewProject: true,
    canEditProject: false,
    canDeleteProject: false,
    canManageTeam: false,
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: false,
    canAssignTasks: true,
    canViewAnalytics: true,
    canManageSprints: true,
    canManageReleases: false,
    canManageBudget: false,
    canApproveTimesheets: false,
  },
  developer: {
    canViewProject: true,
    canEditProject: false,
    canDeleteProject: false,
    canManageTeam: false,
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: false,
    canAssignTasks: false,
    canViewAnalytics: false,
    canManageSprints: false,
    canManageReleases: false,
    canManageBudget: false,
    canApproveTimesheets: false,
  },
  viewer: {
    canViewProject: true,
    canEditProject: false,
    canDeleteProject: false,
    canManageTeam: false,
    canCreateTasks: false,
    canEditTasks: false,
    canDeleteTasks: false,
    canAssignTasks: false,
    canViewAnalytics: false,
    canManageSprints: false,
    canManageReleases: false,
    canManageBudget: false,
    canApproveTimesheets: false,
  },
};

export interface ProjectPermissions {
  canViewProject: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
  canManageTeam: boolean;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canAssignTasks: boolean;
  canViewAnalytics: boolean;
  canManageSprints: boolean;
  canManageReleases: boolean;
  canManageBudget: boolean;
  canApproveTimesheets: boolean;
  projectRole: string | null;
}

/**
 * Computes effective permissions for the current user on a project.
 *
 * Logic:
 *  - Platform admins get full access.
 *  - Org-level manager/admin/owner get full access (preserves existing behaviour).
 *  - Otherwise, look up the user's project-level role from `project.team`
 *    and apply the backend permission matrix.
 *  - The MORE permissive of org role vs project role wins.
 */
export function useProjectPermissions(
  project: Project | null,
  userId: string | undefined,
): ProjectPermissions {
  const { hasOrgRole, isPlatformAdmin } = useAuth();

  return useMemo(() => {
    // Default: no permissions
    const perms: ProjectPermissions = {
      canViewProject: false,
      canEditProject: false,
      canDeleteProject: false,
      canManageTeam: false,
      canCreateTasks: false,
      canEditTasks: false,
      canDeleteTasks: false,
      canAssignTasks: false,
      canViewAnalytics: false,
      canManageSprints: false,
      canManageReleases: false,
      canManageBudget: false,
      canApproveTimesheets: false,
      projectRole: null,
    };

    if (!project || !userId) return perms;

    // ── 1. Platform admin → full access ──
    if (isPlatformAdmin) {
      return allPermissions(null);
    }

    // ── 2. Org-level elevated roles → full access ──
    if (hasOrgRole("manager")) {
      // manager, hr, admin, owner all satisfy hasOrgRole('manager')
      return allPermissions(null);
    }

    // ── 3. Resolve project-level role from team array ──
    const teamMember = project.team?.find(
      (m) => m.userId === userId,
    );
    const projectRole = teamMember?.role as ProjectRole | undefined;
    perms.projectRole = projectRole || null;

    if (!projectRole || !PROJECT_ROLE_PERMISSIONS[projectRole]) {
      // User is not on the team and not an org manager → minimal perms
      return perms;
    }

    const rolePerms = PROJECT_ROLE_PERMISSIONS[projectRole];
    return { ...rolePerms, projectRole };
  }, [project, userId, isPlatformAdmin, hasOrgRole]);
}

/** Helper: returns a permissions object with everything enabled. */
function allPermissions(projectRole: string | null): ProjectPermissions {
  return {
    canViewProject: true,
    canEditProject: true,
    canDeleteProject: true,
    canManageTeam: true,
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
    canAssignTasks: true,
    canViewAnalytics: true,
    canManageSprints: true,
    canManageReleases: true,
    canManageBudget: true,
    canApproveTimesheets: true,
    projectRole,
  };
}
