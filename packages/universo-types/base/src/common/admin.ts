/**
 * Admin and Global Role types for platform-wide access control
 *
 * This module provides types for the dynamic role-based access control (RBAC) system.
 * Global roles are stored in the database with metadata (display_name, color, has_global_access).
 *
 * @packageDocumentation
 */

/**
 * Admin panel and privilege configuration
 * Returned by /auth/permissions endpoint for frontend feature flags
 *
 * Three-tier privilege system:
 * 1. adminPanelEnabled - Controls UI/API access to /admin/*
 * 2. globalRolesEnabled - Controls global editor/moderator roles (platform-wide permissions)
 * 3. superuserEnabled - Controls superuser RLS bypass (see all data, root access)
 */
export interface AdminConfig {
    /** Whether admin panel UI and API endpoints are accessible */
    adminPanelEnabled: boolean
    /** Whether global roles (editors, moderators) are enabled for platform-wide access */
    globalRolesEnabled: boolean
    /** Whether superuser privileges (RLS bypass, see all data) are active */
    superuserEnabled: boolean
}

// ============================================================
// Versioned Localized Content (VLC) Types
// ============================================================

/**
 * VLC Schema version for forward compatibility
 */
export type VlcSchemaVersion = '1'

/**
 * Supported locale codes (BCP47-like, simplified to 2-letter for MVP)
 * Can be extended to full BCP47 (e.g., 'ru-RU') in future
 */
export type SupportedLocale = 'en' | 'ru'

/**
 * Array of supported locales for runtime validation
 */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'ru'] as const

/**
 * Type guard to check if a string is a valid SupportedLocale
 */
export function isSupportedLocale(lang: string): lang is SupportedLocale {
    return SUPPORTED_LOCALES.includes(lang as SupportedLocale)
}

/**
 * Metadata for a single locale entry
 */
export interface VlcLocaleEntry<T = string> {
    /** The actual content - string by default, but can be any JSON */
    content: T
    /** Version number for this locale (increments on each update) */
    version: number
    /** Whether this version is active/published */
    isActive: boolean
    /** ISO 8601 timestamp when this locale was first created */
    createdAt: string
    /** ISO 8601 timestamp when this locale was last updated */
    updatedAt: string
}

/**
 * Versioned Localized Content - structured i18n storage format
 *
 * @example
 * {
 *   "_schema": "vlc/1",
 *   "_primary": "en",
 *   "locales": {
 *     "en": { "content": "Admin", "version": 1, "isActive": true, "createdAt": "...", "updatedAt": "..." },
 *     "ru": { "content": "Админ", "version": 2, "isActive": true, "createdAt": "...", "updatedAt": "..." }
 *   }
 * }
 */
export interface VersionedLocalizedContent<T = string> {
    /** Schema version marker for forward compatibility */
    _schema: VlcSchemaVersion
    /** Primary/fallback locale code */
    _primary: SupportedLocale
    /** Map of locale codes to their entries */
    locales: Partial<Record<SupportedLocale, VlcLocaleEntry<T>>>
}

/**
 * @deprecated Use VersionedLocalizedContent instead
 * Kept for migration reference only
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
    /** Unique role identifier (e.g., 'superuser', 'metaeditor') */
    codename: string
    /** Localized name in VLC format */
    name: VersionedLocalizedContent<string>
    /** Hex color for UI display (e.g., '#d32f2f') */
    color: string
    /** Whether this role grants full permission bypass (only 'superuser' role) */
    isSuperuser: boolean
}

/**
 * Global role information for a user
 * Returned by /auth/permissions endpoint
 */
export interface GlobalRoleInfo {
    /** Role codename (e.g., 'superadmin') */
    codename: string
    /** Role metadata for display */
    metadata: RoleMetadata
}

/**
 * @deprecated Hardcoded roles removed. Use dynamic roles from database.
 * Global user roles for platform-wide access (hardcoded legacy type)
 */
export type GlobalRole = 'superuser' | 'superadmin' | 'supermoderator'

/**
 * Super users mode configuration
 * @deprecated Use GLOBAL_ADMIN_ENABLED env variable instead
 * - 'superuser': Only superuser has global access
 * - 'disabled': Super users functionality is disabled
 */
export type SuperUsersMode = 'superuser' | 'disabled'

/**
 * User permissions response from /auth/permissions endpoint
 */
export interface UserPermissionsResponse {
    /** CASL-compatible permission rules */
    permissions: PermissionRule[]
    /** User's global roles with metadata */
    globalRoles: GlobalRoleInfo[]
    /** Quick check: is user superuser? */
    isSuperuser: boolean
    /** Quick check: can user access admin panel? (computed from permissions) */
    hasAdminAccess: boolean
    /** Quick check: does user have any global role? (for settings visibility) */
    hasAnyGlobalRole: boolean
    /** Role metadata map for UI display (keyed by role codename) */
    rolesMetadata: Record<string, RoleMetadata>
    /** Admin feature flags configuration */
    config: AdminConfig
}

/**
 * Base permission structure (CASL-compatible core)
 * Used as foundation for both PermissionRule and PermissionInput
 */
export interface BasePermission {
    /** Subject (e.g., 'metaverses', '*') - CASL standard terminology */
    subject: string
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
    roleCodename: string
}

/**
 * Permission input for forms and API payloads (without role binding)
 * Use this type when creating/updating roles via UI or API
 */
export type PermissionInput = BasePermission

/**
 * User with global role assignment (for admin panel)
 * Extends DynamicMemberEntity pattern for dynamic roles loaded from database
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
    /** Role codename (dynamic, loaded from database) */
    roleCodename: string
    /** Role metadata with display info */
    roleMetadata: RoleMetadata
    /** Comment on assignment */
    comment: string | null
    /** Who granted this role */
    grantedBy: string | null
    /** When assigned (ISO string for JSON serialization) */
    createdAt: string
}

/**
 * Request to grant a global role to a user
 */
export interface GrantGlobalRoleRequest {
    /** Target user ID or email */
    userIdOrEmail: string
    /** Role codename to grant */
    roleCodename: string
    /** Optional comment */
    comment?: string
}

/**
 * Request to update a global role assignment
 */
export interface UpdateGlobalRoleRequest {
    /** New role codename */
    roleCodename?: string
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
 * Platform subjects that can have permissions assigned
 * '*' means all subjects (CASL 'all')
 */
export type PermissionSubject =
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
    | 'roles'
    | 'instances'
    | 'users'
    | '*'

/**
 * All available permission subjects (for UI iteration)
 */
export const PERMISSION_SUBJECTS: PermissionSubject[] = [
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
    'roles',
    'instances',
    'users'
]

/**
 * Admin-related permission subjects that grant access to admin panel
 * If user has any permission (read or wildcard) on these subjects, they can access admin panel
 */
export const ADMIN_PERMISSION_SUBJECTS: PermissionSubject[] = ['roles', 'instances', 'users']

/**
 * All available permission actions (for UI iteration)
 */
export const PERMISSION_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete']

/**
 * Check if user has any admin-related permissions
 * Admin access is granted when user has read (or wildcard) permission on roles, instances, or users
 */
export function hasAdminPermissions(permissions: PermissionInput[]): boolean {
    return permissions.some(
        (p) =>
            (ADMIN_PERMISSION_SUBJECTS.includes(p.subject as PermissionSubject) || p.subject === '*') &&
            (p.action === 'read' || p.action === '*')
    )
}

/**
 * Role with full permission details
 * Used in role management UI
 */
export interface RoleWithPermissions {
    id: string
    codename: string
    description?: VersionedLocalizedContent<string>
    name: VersionedLocalizedContent<string>
    color: string
    isSuperuser: boolean
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
    codename: string
    /** Optional description in VLC format for multi-language support */
    description?: VersionedLocalizedContent<string>
    /** Localized name in VLC format */
    name: VersionedLocalizedContent<string>
    /** Hex color for UI display */
    color: string
    /** Whether this role grants superuser access (full permission bypass - root user) */
    isSuperuser: boolean
    /** Permission rules for this role */
    permissions: PermissionInput[]
}

/**
 * Payload for updating an existing role
 */
export type UpdateRolePayload = Partial<CreateRolePayload>
