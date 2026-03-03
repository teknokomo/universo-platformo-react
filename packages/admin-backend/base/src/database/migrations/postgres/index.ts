import { CreateAdminSchema1733400000000 } from './1733400000000-CreateAdminSchema'
import { AddCodenameAutoConvertMixedSetting1733500000000 } from './1733500000000-AddCodenameAutoConvertMixedSetting'

/**
 * Admin schema migrations
 *
 * Consolidated migration that creates:
 * - admin.instances: Platform instances (Local, remote future)
 * - admin.roles: System and custom roles with metadata
 * - admin.role_permissions: Permission assignments with wildcard support
 * - admin.user_roles: User-to-role assignments
 * - admin.locales: Dynamic locale management for VLC and UI
 * - admin.settings: Platform-wide configuration (codename defaults, etc.)
 * - PostgreSQL functions for permission checking (CASL integration)
 * - RLS policies for security
 */
export const adminMigrations = [CreateAdminSchema1733400000000, AddCodenameAutoConvertMixedSetting1733500000000]
