/**
 * Permission Service - CASL ability builder from database permissions
 *
 * Loads user permissions from admin.get_user_permissions() and builds CASL ability.
 * Also provides global role information with metadata for frontend display.
 */
import type {
    AppAbility,
    DbPermission,
    RoleMetadata,
    GlobalRoleInfo,
    PermissionRule,
    VersionedLocalizedContent,
    AdminConfig
} from '@universo/types'
import { defineAbilitiesFor, ADMIN_PERMISSION_SUBJECTS } from '@universo/types'
import { getAdminConfig, isAdminPanelEnabled, isGlobalRolesEnabled, isSuperuserEnabled, type DbSession } from '@universo/utils'
import type { DbExecutor } from '@universo/utils/database'

/**
 * Raw permission row from database (with metadata)
 */
interface RawPermissionWithMetadata {
    role_codename: string
    name: VersionedLocalizedContent<string> | null
    color: string | null
    is_superuser: boolean
    subject: string
    action: string
    conditions: Record<string, unknown> | null
    fields: string[] | null
}

/**
 * Full permissions response for frontend
 */
export interface FullPermissionsResponse {
    /** CASL-compatible permission rules */
    permissions: PermissionRule[]
    /** User's admin access roles with metadata */
    globalRoles: GlobalRoleInfo[]
    /** Does user have is_superuser=true role? */
    isSuperuser: boolean
    /** Can user access admin panel? (computed from permissions) */
    hasAdminAccess: boolean
    /** Does user have any global role? (for settings visibility) */
    hasAnyGlobalRole: boolean
    /** Role metadata map for UI display (keyed by role codename) */
    rolesMetadata: Record<string, RoleMetadata>
    /** Admin feature flags configuration */
    config: AdminConfig
}

/**
 * Configuration for permission service
 */
export interface PermissionServiceOptions {
    /** Function to get DbExecutor instance */
    getDbExecutor: () => DbExecutor
}

/**
 * Permission service instance
 */
export interface IPermissionService {
    /** Get permissions for user and build CASL ability */
    getAbilityForUser(userId: string, dbSession?: DbSession): Promise<AppAbility>
    /** Get raw permissions from database (legacy format) */
    getUserPermissions(userId: string, dbSession?: DbSession): Promise<DbPermission[]>
    /** Get full permissions response with metadata */
    getFullPermissions(userId: string, dbSession?: DbSession): Promise<FullPermissionsResponse>
    /** Check if user has specific permission */
    hasPermission(
        userId: string,
        subject: string,
        action: string,
        context?: Record<string, unknown>,
        dbSession?: DbSession
    ): Promise<boolean>
    /** Check if user can access admin panel (deprecated, use getFullPermissions) */
    hasGlobalAccess(userId: string, dbSession?: DbSession): Promise<boolean>
}

/**
 * Creates permission service
 */
export function createPermissionService(options: PermissionServiceOptions): IPermissionService {
    const { getDbExecutor } = options

    const runQuery = async <T = unknown>(sql: string, params: unknown[], dbSession?: DbSession): Promise<T[]> => {
        if (dbSession && !dbSession.isReleased()) {
            return dbSession.query<T>(sql, params)
        }

        const exec = getDbExecutor()
        return exec.query<T>(sql, params)
    }

    /**
     * Get user permissions from database with full metadata
     */
    async function getPermissionsWithMetadata(userId: string, dbSession?: DbSession): Promise<RawPermissionWithMetadata[]> {
        return runQuery<RawPermissionWithMetadata>(
            `SELECT role_codename, name, color, is_superuser, subject, action, conditions, fields 
             FROM admin.get_user_permissions($1)`,
            [userId],
            dbSession
        )
    }

    /**
     * Get user permissions from database (legacy format for CASL)
     */
    async function getUserPermissions(userId: string, dbSession?: DbSession): Promise<DbPermission[]> {
        const rawPerms = await getPermissionsWithMetadata(userId, dbSession)

        return rawPerms.map((row) => ({
            subject: row.subject,
            action: row.action,
            conditions: row.conditions ?? {},
            fields: row.fields ?? undefined
        }))
    }

    /**
     * Get full permissions response with metadata for frontend
     */
    async function getFullPermissions(userId: string, dbSession?: DbSession): Promise<FullPermissionsResponse> {
        const rawPerms = await getPermissionsWithMetadata(userId, dbSession)

        // Build permissions list
        const permissions: PermissionRule[] = rawPerms.map((row) => ({
            roleCodename: row.role_codename,
            subject: row.subject,
            action: row.action,
            conditions: row.conditions ?? undefined,
            fields: row.fields ?? undefined
        }))

        // Collect unique roles with metadata
        const rolesMetadata: Record<string, RoleMetadata> = {}
        const globalRolesSet = new Set<string>()

        for (const row of rawPerms) {
            if (!rolesMetadata[row.role_codename]) {
                // Ensure valid VLC structure
                const name: VersionedLocalizedContent<string> =
                    row.name && typeof row.name === 'object' && '_schema' in row.name
                        ? row.name
                        : {
                              _schema: '1',
                              _primary: 'en',
                              locales: {
                                  en: {
                                      content: row.role_codename,
                                      version: 1,
                                      isActive: true,
                                      createdAt: new Date().toISOString(),
                                      updatedAt: new Date().toISOString()
                                  }
                              }
                          }

                rolesMetadata[row.role_codename] = {
                    codename: row.role_codename,
                    name,
                    color: row.color || '#9e9e9e',
                    isSuperuser: row.is_superuser
                }
            }
        }

        // Compute admin access from permissions (roles:read, instances:read, users:read, or wildcard)
        const hasAdminAccess = permissions.some(
            (p) =>
                (ADMIN_PERMISSION_SUBJECTS.includes(p.subject as (typeof ADMIN_PERMISSION_SUBJECTS)[number]) || p.subject === '*') &&
                (p.action === 'read' || p.action === '*')
        )

        // Build global roles list (all roles assigned to the user)
        // This represents all roles that grant any permissions, not just admin access
        for (const role of Object.values(rolesMetadata)) {
            globalRolesSet.add(role.codename)
        }

        const globalRoles: GlobalRoleInfo[] = Array.from(globalRolesSet).map((codename) => ({
            codename,
            metadata: rolesMetadata[codename]
        }))

        // Check if user is superuser
        const isSuperuser = rawPerms.some((row) => row.is_superuser)

        // Check if user has any global role (for settings visibility)
        const hasAnyGlobalRole = globalRoles.length > 0

        return {
            permissions,
            globalRoles,
            isSuperuser,
            hasAdminAccess,
            hasAnyGlobalRole,
            rolesMetadata,
            config: getAdminConfig()
        }
    }

    /**
     * Build CASL ability for user
     */
    async function getAbilityForUser(userId: string, dbSession?: DbSession): Promise<AppAbility> {
        const permissions = await getUserPermissions(userId, dbSession)
        return defineAbilitiesFor(userId, permissions)
    }

    /**
     * Check if user can access admin panel (has admin-related permissions)
     * Returns false if ADMIN_PANEL_ENABLED=false or GLOBAL_ROLES_ENABLED=false
     */
    async function hasGlobalAccess(userId: string, dbSession?: DbSession): Promise<boolean> {
        // If admin panel is disabled, no one can access it
        if (!isAdminPanelEnabled()) {
            return false
        }

        // If global roles are disabled, only superuser can access (if SUPERUSER_ENABLED=true)
        if (!isGlobalRolesEnabled()) {
            // Check if user is superuser AND superuser privileges are enabled
            if (!isSuperuserEnabled()) {
                return false
            }
            // User must be superuser to access admin when global roles are disabled
            const result = await runQuery<{ is_super: boolean }>('SELECT admin.is_superuser($1) as is_super', [userId], dbSession)
            return result[0]?.is_super ?? false
        }

        const result = await runQuery<{ can_access: boolean }>('SELECT admin.has_admin_permission($1) as can_access', [userId], dbSession)
        return result[0]?.can_access ?? false
    }

    /**
     * Check if user has specific permission using database function
     * This is more efficient for single permission checks
     */
    async function hasPermission(
        userId: string,
        subject: string,
        action: string,
        context?: Record<string, unknown>,
        dbSession?: DbSession
    ): Promise<boolean> {
        const result = await runQuery<{ has_permission: boolean }>(
            'SELECT admin.has_permission($1::uuid, $2, $3, $4) as has_permission',
            [userId, subject, action, context ? JSON.stringify(context) : '{}'],
            dbSession
        )

        return result[0]?.has_permission ?? false
    }

    return {
        getAbilityForUser,
        getUserPermissions,
        getFullPermissions,
        hasPermission,
        hasGlobalAccess
    }
}

// Singleton instance (will be initialized by core)
let permissionService: IPermissionService | null = null

/**
 * Initialize permission service with Knex
 */
export function initPermissionService(options: PermissionServiceOptions): IPermissionService {
    permissionService = createPermissionService(options)
    return permissionService
}

/**
 * Get permission service instance
 * @throws Error if not initialized
 */
export function getPermissionService(): IPermissionService {
    if (!permissionService) {
        throw new Error('Permission service not initialized. Call initPermissionService() first.')
    }
    return permissionService
}
