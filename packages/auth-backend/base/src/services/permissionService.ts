/**
 * Permission Service - CASL ability builder from database permissions
 *
 * Loads user permissions from admin.get_user_permissions() and builds CASL ability.
 * Also provides global role information with metadata for frontend display.
 */
import type { DataSource, QueryRunner } from 'typeorm'
import type { AppAbility, DbPermission, RoleMetadata, GlobalRoleInfo, PermissionRule, LocalizedString, AdminConfig } from '@universo/types'
import { defineAbilitiesFor } from '@universo/types'
import { getAdminConfig, isAdminPanelEnabled, isGlobalRolesEnabled, isSuperuserEnabled } from '@universo/utils'

/**
 * Raw permission row from database (with metadata)
 */
interface RawPermissionWithMetadata {
    role_name: string
    display_name: Record<string, string> | null
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
    /** Role metadata map for UI display (keyed by role name) */
    rolesMetadata: Record<string, RoleMetadata>
    /** Admin feature flags configuration */
    config: AdminConfig
}

/**
 * Configuration for permission service
 */
export interface PermissionServiceOptions {
    /** Function to get DataSource */
    getDataSource: () => DataSource
}

/**
 * Permission service instance
 */
export interface IPermissionService {
    /** Get permissions for user and build CASL ability */
    getAbilityForUser(userId: string, queryRunner?: QueryRunner): Promise<AppAbility>
    /** Get raw permissions from database (legacy format) */
    getUserPermissions(userId: string, queryRunner?: QueryRunner): Promise<DbPermission[]>
    /** Get full permissions response with metadata */
    getFullPermissions(userId: string, queryRunner?: QueryRunner): Promise<FullPermissionsResponse>
    /** Check if user has specific permission */
    hasPermission(
        userId: string,
        subject: string,
        action: string,
        context?: Record<string, unknown>,
        queryRunner?: QueryRunner
    ): Promise<boolean>
    /** Check if user can access admin panel (deprecated, use getFullPermissions) */
    hasGlobalAccess(userId: string, queryRunner?: QueryRunner): Promise<boolean>
}

/**
 * Creates permission service
 */
export function createPermissionService(options: PermissionServiceOptions): IPermissionService {
    const { getDataSource } = options

    /**
     * Get user permissions from database with full metadata
     */
    async function getPermissionsWithMetadata(
        userId: string,
        queryRunner?: QueryRunner
    ): Promise<RawPermissionWithMetadata[]> {
        const runner = queryRunner ?? getDataSource().createQueryRunner()
        const shouldRelease = !queryRunner

        try {
            // Call updated PostgreSQL function that returns permissions with role metadata
            const result: RawPermissionWithMetadata[] = await runner.query(
                `SELECT role_name, display_name, color, is_superuser, subject, action, conditions, fields 
                 FROM admin.get_user_permissions($1)`,
                [userId]
            )
            return result
        } finally {
            if (shouldRelease && !runner.isReleased) {
                await runner.release()
            }
        }
    }

    /**
     * Get user permissions from database (legacy format for CASL)
     */
    async function getUserPermissions(userId: string, queryRunner?: QueryRunner): Promise<DbPermission[]> {
        const rawPerms = await getPermissionsWithMetadata(userId, queryRunner)

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
    async function getFullPermissions(userId: string, queryRunner?: QueryRunner): Promise<FullPermissionsResponse> {
        const rawPerms = await getPermissionsWithMetadata(userId, queryRunner)

        // Build permissions list
        const permissions: PermissionRule[] = rawPerms.map((row) => ({
            roleName: row.role_name,
            subject: row.subject,
            action: row.action,
            conditions: row.conditions ?? undefined,
            fields: row.fields ?? undefined
        }))

        // Collect unique roles with metadata
        const rolesMetadata: Record<string, RoleMetadata> = {}
        const globalRolesSet = new Set<string>()

        for (const row of rawPerms) {
            if (!rolesMetadata[row.role_name]) {
                rolesMetadata[row.role_name] = {
                    name: row.role_name,
                    displayName: (row.display_name || {}) as LocalizedString,
                    color: row.color || '#9e9e9e',
                    isSuperuser: row.is_superuser
                }
            }
        }

        // Compute admin access from permissions (roles:read, instances:read, users:read, or wildcard)
        const ADMIN_PERMISSION_SUBJECTS = ['roles', 'instances', 'users']
        const hasAdminAccess = permissions.some(
            (p) =>
                (ADMIN_PERMISSION_SUBJECTS.includes(p.subject) || p.subject === '*') &&
                (p.action === 'read' || p.action === '*')
        )

        // Build global roles list (all roles assigned to the user)
        // This represents all roles that grant any permissions, not just admin access
        for (const role of Object.values(rolesMetadata)) {
            globalRolesSet.add(role.name)
        }

        const globalRoles: GlobalRoleInfo[] = Array.from(globalRolesSet).map((name) => ({
            name,
            metadata: rolesMetadata[name]
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
    async function getAbilityForUser(userId: string, queryRunner?: QueryRunner): Promise<AppAbility> {
        const permissions = await getUserPermissions(userId, queryRunner)
        return defineAbilitiesFor(userId, permissions)
    }

    /**
     * Check if user can access admin panel (has admin-related permissions)
     * Returns false if ADMIN_PANEL_ENABLED=false or GLOBAL_ROLES_ENABLED=false
     */
    async function hasGlobalAccess(userId: string, queryRunner?: QueryRunner): Promise<boolean> {
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
            const runner = queryRunner ?? getDataSource().createQueryRunner()
            const shouldRelease = !queryRunner
            try {
                const result: Array<{ is_super: boolean }> = await runner.query(
                    'SELECT admin.is_superuser($1) as is_super',
                    [userId]
                )
                return result[0]?.is_super ?? false
            } finally {
                if (shouldRelease && !runner.isReleased) {
                    await runner.release()
                }
            }
        }

        const runner = queryRunner ?? getDataSource().createQueryRunner()
        const shouldRelease = !queryRunner

        try {
            const result: Array<{ can_access: boolean }> = await runner.query(
                'SELECT admin.has_admin_permission($1) as can_access',
                [userId]
            )
            return result[0]?.can_access ?? false
        } finally {
            if (shouldRelease && !runner.isReleased) {
                await runner.release()
            }
        }
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
        queryRunner?: QueryRunner
    ): Promise<boolean> {
        const runner = queryRunner ?? getDataSource().createQueryRunner()
        const shouldRelease = !queryRunner


        try {
            // Call PostgreSQL function with explicit userId
            // The function uses COALESCE(p_user_id, auth.uid()) for fallback
            const result: Array<{ has_permission: boolean }> = await runner.query(
                'SELECT admin.has_permission($1::uuid, $2, $3, $4) as has_permission',
                [userId, subject, action, context ? JSON.stringify(context) : '{}']
            )

            return result[0]?.has_permission ?? false
        } finally {
            if (shouldRelease && !runner.isReleased) {
                await runner.release()
            }
        }
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
 * Initialize permission service with DataSource
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
