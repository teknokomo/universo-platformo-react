/**
 * Admin and Global Role types for platform-wide access control
 *
 * This module provides types for the dynamic role-based access control (RBAC) system.
 * Global roles are stored in the database with metadata (display_name, color, has_global_access).
 *
 * @packageDocumentation
 */

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
}

/**
 * CASL-compatible permission rule
 */
export interface PermissionRule {
    /** Role that grants this permission */
    roleName: string
    /** Module/subject (e.g., 'metaverses', '*') */
    module: string
    /** Action (e.g., 'read', 'create', '*') */
    action: string
    /** ABAC conditions (optional) */
    conditions?: Record<string, unknown>
    /** Allowed fields (optional) */
    fields?: string[]
}

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
