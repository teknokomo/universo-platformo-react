import { CreateAdminSchema1733400000000 } from './1733400000000-CreateAdminSchema'
import { CreateLocalesTable1734100000000 } from './1734100000000-CreateLocalesTable'

/**
 * Admin schema migrations
 *
 * Migrations that create:
 * - admin.instances: Platform instances (Local, remote future)
 * - admin.roles: System and custom roles with metadata
 * - admin.role_permissions: Permission assignments with wildcard support
 * - admin.user_roles: User-to-role assignments
 * - admin.locales: Dynamic locale management for VLC and UI
 * - PostgreSQL functions for permission checking (CASL integration)
 * - RLS policies for security
 */
export const adminMigrations = [CreateAdminSchema1733400000000, CreateLocalesTable1734100000000]
