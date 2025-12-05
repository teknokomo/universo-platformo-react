import { CreateAdminRBAC1733400000000 } from './1733400000000-CreateAdminRBAC'

/**
 * Admin migrations for RBAC system
 *
 * Single consolidated migration that creates:
 * - admin.roles: System and custom roles with metadata
 * - admin.role_permissions: Permission assignments with wildcard support
 * - admin.user_roles: User-to-role assignments
 * - PostgreSQL functions for permission checking (CASL integration)
 * - RLS policies for security
 */
export const adminMigrations = [CreateAdminRBAC1733400000000]
