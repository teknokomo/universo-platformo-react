/**
 * Permission Service - CASL ability builder from database permissions
 *
 * Loads user permissions from admin.get_user_permissions() and builds CASL ability.
 * Also provides global role information with metadata for frontend display.
 */
import type { DataSource, QueryRunner } from 'typeorm'
import type { AppAbility, DbPermission, RoleMetadata, GlobalRoleInfo, PermissionRule, LocalizedString, AdminConfig } from '@universo/types'
import { defineAbilitiesFor } from '@universo/types'
import { getAdminConfig, isGlobalAdminEnabled } from '@universo/utils'

/**
 * Raw permission row from database (with metadata)
 */
interface RawPermissionWithMetadata {
    role_name: string
    display_name: Record<string, string> | null
    color: string | null
    has_global_access: boolean
    module: string
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
        module: string,
        action: string,
        context?: Record<string, unknown>,
        queryRunner?: QueryRunner
    ): Promise<boolean>
    /** Check if user has global access */
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
                `SELECT role_name, display_name, color, has_global_access, module, action, conditions, fields 
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
            module: row.module,
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
            module: row.module,
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
                    hasGlobalAccess: row.has_global_access
                }
            }

            // Collect global roles based on DB role flag (not ENV)
            // hasGlobalAccess reflects the FACT that user has a global role in DB
            // GLOBAL_ADMIN_ENABLED only affects RLS bypass privileges, not role existence
            if (row.has_global_access) {
                globalRolesSet.add(row.role_name)
            }
        }

        // Build global roles list
        const globalRoles: GlobalRoleInfo[] = Array.from(globalRolesSet).map((name) => ({
            name,
            metadata: rolesMetadata[name]
        }))

        return {
            permissions,
            globalRoles,
            // hasGlobalAccess = user has a global role in DB (independent of ENV flags)
            // Frontend uses this + adminConfig to determine what user can access
            hasGlobalAccess: globalRoles.length > 0,
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
     * Check if user has global access (any role with has_global_access=true)
     * Returns false if GLOBAL_ADMIN_ENABLED=false
     */
    async function hasGlobalAccess(userId: string, queryRunner?: QueryRunner): Promise<boolean> {
        // If global admin is disabled, no one has global access
        if (!isGlobalAdminEnabled()) {
            return false
        }

        const runner = queryRunner ?? getDataSource().createQueryRunner()
        const shouldRelease = !queryRunner

        try {
            const result: Array<{ has_access: boolean }> = await runner.query(
                'SELECT admin.has_global_access($1) as has_access',
                [userId]
            )
            return result[0]?.has_access ?? false
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
        module: string,
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
                [userId, module, action, context ? JSON.stringify(context) : '{}']
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
