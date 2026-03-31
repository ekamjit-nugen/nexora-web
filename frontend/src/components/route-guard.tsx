'use client';

/**
 * Wave 1.2 — Frontend RBAC Route Guard & Permission Utilities
 *
 * Provides:
 *  - PERMISSIONS map: role → allowed permission strings
 *  - can(user, permission, resource?) — fine-grained check
 *  - RouteGuard — page-level auth + role guard
 *  - RequirePermission — inline permission wrapper (hides children if denied)
 *  - usePermissions() — hook for component-level checks
 */

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Permission Registry
// ---------------------------------------------------------------------------

export const PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  manager: [
    'project:create', 'project:edit', 'project:delete', 'project:view',
    'sprint:create', 'sprint:edit', 'sprint:delete', 'sprint:complete', 'sprint:view',
    'task:create', 'task:edit', 'task:delete', 'task:edit_own', 'task:comment', 'task:view',
    'task:bulk_update', 'task:log_time',
    'board:view', 'board:configure',
    'member:view', 'member:invite',
    'report:view',
  ],
  member: [
    'project:view',
    'sprint:view',
    'task:create', 'task:edit_own', 'task:comment', 'task:view', 'task:log_time',
    'board:view',
    'member:view',
    'report:view',
  ],
  viewer: [
    'project:view',
    'sprint:view',
    'task:view',
    'board:view',
    'member:view',
  ],
};

// ---------------------------------------------------------------------------
// Permission Check Helper
// ---------------------------------------------------------------------------

export interface PermissionResource {
  createdBy?: string;
  assigneeId?: string;
  reporterId?: string;
}

/**
 * Check whether a user has a given permission, optionally scoped to a resource.
 * For `_own` permissions, also validates that the user owns the resource.
 */
export function can(
  user: { _id?: string; id?: string; orgRole?: string } | null,
  permission: string,
  resource?: PermissionResource,
): boolean {
  if (!user) return false;

  const role = user.orgRole || 'viewer';
  const perms = PERMISSIONS[role] || [];

  if (perms.includes('*')) return true;
  if (!perms.includes(permission)) return false;

  // For "edit_own" variants, verify resource ownership
  if (permission.endsWith('_own') && resource) {
    const userId = user._id || user.id || '';
    return (
      resource.createdBy === userId ||
      resource.assigneeId === userId ||
      resource.reporterId === userId
    );
  }

  return true;
}

// ---------------------------------------------------------------------------
// RouteGuard — page-level protection
// ---------------------------------------------------------------------------

interface RouteGuardProps {
  minOrgRole?: string;
  permission?: string;
  requirePlatformAdmin?: boolean;
  children: ReactNode;
  fallbackRoute?: string;
}

export function RouteGuard({
  minOrgRole,
  permission,
  requirePlatformAdmin,
  children,
  fallbackRoute = '/dashboard',
}: RouteGuardProps) {
  const { user, loading, hasOrgRole, isPlatformAdmin, orgRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (requirePlatformAdmin && !isPlatformAdmin) {
      router.push(fallbackRoute);
      return;
    }

    if (minOrgRole && !hasOrgRole(minOrgRole)) {
      router.push(fallbackRoute);
      return;
    }

    if (permission) {
      const userWithRole = { ...user, orgRole };
      if (!can(userWithRole, permission)) {
        router.push(fallbackRoute);
      }
    }
  }, [user, loading, minOrgRole, permission, requirePlatformAdmin, isPlatformAdmin, hasOrgRole, orgRole, router, fallbackRoute]);

  if (loading) return null;
  if (!user) return null;
  if (requirePlatformAdmin && !isPlatformAdmin) return null;
  if (minOrgRole && !hasOrgRole(minOrgRole)) return null;
  if (permission && !can({ ...user, orgRole }, permission)) return null;

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// RequirePermission — inline component-level guard
// ---------------------------------------------------------------------------

interface RequirePermissionProps {
  permission: string;
  resource?: PermissionResource;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only when the current user has the required permission.
 * Optionally renders `fallback` when denied (default: nothing).
 *
 * @example
 * <RequirePermission permission="task:delete" resource={task}>
 *   <DeleteButton />
 * </RequirePermission>
 */
export function RequirePermission({
  permission,
  resource,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { user, orgRole } = useAuth();
  const userWithRole = user ? { ...user, orgRole } : null;

  if (!can(userWithRole, permission, resource)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// usePermissions — hook for programmatic checks
// ---------------------------------------------------------------------------

/**
 * Returns a `can(permission, resource?)` function bound to the current user.
 *
 * @example
 * const { can } = usePermissions();
 * if (can('sprint:complete')) { ... }
 */
export function usePermissions() {
  const { user, orgRole } = useAuth();
  const userWithRole = user ? { ...user, orgRole } : null;

  return {
    can: (permission: string, resource?: PermissionResource) =>
      can(userWithRole, permission, resource),
    role: orgRole,
  };
}
