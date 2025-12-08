/**
 * Admin and Global Role types for platform-wide access control
 *
 * This module provides types for the dynamic role-based access control (RBAC) system.
 * Global roles are stored in the database with metadata (display_name, color, has_global_access).
 *
 * @packageDocumentation
 */

/**
 * Admin panel and super user configuration
 * Returned by /auth/permissions endpoint for frontend feature flags
 */
export interface AdminConfig {
    /** Whether admin panel UI and API endpoints are accessible */
    adminPanelEnabled: boolean
    /** Whether super user privileges (RLS bypass, see all data) are active */
    globalAdminEnabled: boolean
}

/**
 * Localized display name for a role
 * Keys are ISO 639-1 language codes (e.g., 'en', 'ru')
 */
export interface LocalizedString {
    [locale: string]: string
}

/**
 * Role metadata returned from database
 * Contains display information for UI rendering
 */
export interface RoleMetadata {
    /** Unique role identifier (e.g., 'superadmin', 'supermoderator') */
    name: string
    /** Localized display names */
    displayName: LocalizedString
    /** Hex color for UI display (e.g., '#ad1457') */
    color: string
    /** Whether this role grants platform-wide access */
    hasGlobalAccess: boolean
}

/**
 * Global role information for a user
 * Returned by /auth/permissions endpoint
 */
export interface GlobalRoleInfo {
    /** Role name (e.g., 'superadmin') */
    name: string
    /** Role metadata for display */
    metadata: RoleMetadata
}

/**
 * @deprecated Use GlobalRoleInfo instead. Kept for backward compatibility during migration.
 * Global user roles for platform-wide access (hardcoded legacy type)
 */
export type GlobalRole = 'superadmin' | 'supermoderator'

/**
 * Super users mode configuration
 * @deprecated Use GLOBAL_ADMIN_ENABLED env variable instead
 * - 'superadmin': Only superadmins have global access
 * - 'supermoderator': Both superadmins and supermoderators have global access
 * - 'disabled': Super users functionality is disabled
 */
export type SuperUsersMode = 'superadmin' | 'supermoderator' | 'disabled'

/**
 * User permissions response from /auth/permissions endpoint
 */
export interface UserPermissionsResponse {
    /** CASL-compatible permission rules */
    permissions: PermissionRule[]
    /** User's global roles with metadata */
    globalRoles: GlobalRoleInfo[]
    /** Quick check: does user have any global access role? */
    hasGlobalAccess: boolean
    /** Role metadata map for UI display (keyed by role name) */
    rolesMetadata: Record<string, RoleMetadata>
    /** Admin feature flags configuration */
    config: AdminConfig
}

/**
 * Base permission structure (CASL-compatible core)
 * Used as foundation for both PermissionRule and PermissionInput
 */
export interface BasePermission {
    /** Module/subject (e.g., 'metaverses', '*') */
    module: string
    /** Action (e.g., 'read', 'create', '*') */
    action: string
    /** ABAC conditions - MongoDB-style query for attribute-based access control */
    conditions?: Record<string, unknown>
    /** Field-level permissions - whitelist of allowed fields */
    fields?: string[]
}

/**
 * CASL-compatible permission rule with role binding
 * Used in runtime for tracing which role granted the permission
 */
export interface PermissionRule extends BasePermission {
    /** Role that grants this permission (for audit/debugging) */
    roleName: string
}

/**
 * Permission input for forms and API payloads (without role binding)
 * Use this type when creating/updating roles via UI or API
 */
export type PermissionInput = BasePermission

/**
 * User with global role assignment (for admin panel)
 */
export interface GlobalUserMember {
    /** Assignment ID (from user_roles table) */
    id: string
    /** User ID */
    userId: string
    /** User email (from auth.users) */
    email: string | null
    /** User nickname (from profiles) */
    nickname: string | null
    /** Role name */
    roleName: string
    /** Role metadata */
    roleMetadata: RoleMetadata
    /** Comment on assignment */
    comment: string | null
    /** Who granted this role */
    grantedBy: string | null
    /** When assigned */
    createdAt: Date
}

/**
 * Request to grant a global role to a user
 */
export interface GrantGlobalRoleRequest {
    /** Target user ID or email */
    userIdOrEmail: string
    /** Role name to grant */
    roleName: string
    /** Optional comment */
    comment?: string
}

/**
 * Request to update a global role assignment
 */
export interface UpdateGlobalRoleRequest {
    /** New role name */
    roleName?: string
    /** Updated comment */
    comment?: string
}

// ═══════════════════════════════════════════════════════════════
// RBAC ROLE MANAGEMENT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * CRUD permission actions
 * '*' means all actions (CASL 'manage')
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | '*'

/**
 * Platform modules that can have permissions assigned
 * '*' means all modules (CASL 'all')
 */
export type PermissionModule =
    | 'metaverses'
    | 'clusters'
    | 'projects'
    | 'spaces'
    | 'storages'
    | 'organizations'
    | 'campaigns'
    | 'uniks'
    | 'sections'
    | 'entities'
    | 'canvases'
    | 'publications'
    | 'admin'
    | '*'

/**
 * All available permission modules (for UI iteration)
 */
export const PERMISSION_MODULES: PermissionModule[] = [
    'metaverses',
    'clusters',
    'projects',
    'spaces',
    'storages',
    'organizations',
    'campaigns',
    'uniks',
    'sections',
    'entities',
    'canvases',
    'publications',
    'admin'
]

/**
 * All available permission actions (for UI iteration)
 */
export const PERMISSION_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete']

/**
 * Role with full permission details
 * Used in role management UI
 */
export interface RoleWithPermissions {
    id: string
    name: string
    description?: string
    displayName: LocalizedString
    color: string
    hasGlobalAccess: boolean
    isSystem: boolean
    permissions: PermissionInput[]
    createdAt: string
    updatedAt: string
}

/**
 * Payload for creating a new role
 */
export interface CreateRolePayload {
    /** Unique role identifier (lowercase, alphanumeric, underscores, dashes) */
    name: string
    /** Optional description */
    description?: string
    /** Localized display names */
    displayName: LocalizedString
    /** Hex color for UI display */
    color: string
    /** Whether this role grants platform-wide access */
    hasGlobalAccess: boolean
    /** Permission rules for this role */
    permissions: PermissionInput[]
}

/**
 * Payload for updating an existing role
 */
export type UpdateRolePayload = Partial<CreateRolePayload>
