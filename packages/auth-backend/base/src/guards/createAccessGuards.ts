import { DataSource, QueryRunner } from 'typeorm'
import * as httpErrors from 'http-errors'
import type { AccessGuardsConfig, MembershipContext, RolePermission } from './types'

// Handle both ESM and CJS imports
const createError = (httpErrors as any).default || httpErrors

/**
 * Creates a set of access guard functions for entity-based access control
 *
 * @template TRole - String union of valid role names
 * @template TMembership - Type of the membership entity
 * @param config - Configuration object
 * @returns Object with guard functions
 *
 * @example
 * ```typescript
 * const guards = createAccessGuards<MetaverseRole, MetaverseUser>({
 *   entityName: 'metaverse',
 *   roles: ['owner', 'admin', 'editor', 'member'],
 *   permissions: ROLE_PERMISSIONS,
 *   getMembership: async (ds, userId, metaverseId) => {
 *     return ds.getRepository(MetaverseUser).findOne({
 *       where: { metaverse_id: metaverseId, user_id: userId }
 *     })
 *   },
 *   extractRole: (m) => m.role || 'member',
 *   extractUserId: (m) => m.user_id,
 *   extractEntityId: (m) => m.metaverse_id,
 *   // Enable superuser bypass (new API)
 *   isSuperuser: async (ds, userId) => isSuperuserByDataSource(ds, userId),
 *   getGlobalRoleName: async (ds, userId) => getGlobalRoleCodenameByDataSource(ds, userId),
 *   createGlobalAdminMembership: (userId, entityId, globalRole) => ({
 *     user_id: userId,
 *     metaverse_id: entityId,
 *     role: 'owner' // Superusers get owner-level access
 *   })
 * })
 * ```
 */
export function createAccessGuards<TRole extends string, TMembership>(config: AccessGuardsConfig<TRole, TMembership>) {
    const {
        entityName,
        permissions,
        getMembership,
        extractRole,
        extractUserId,
        extractEntityId,
        isSuperuser: isSuperuserFn,
        getGlobalRoleName,
        getGlobalRole, // deprecated, for backward compatibility
        createGlobalAdminMembership
    } = config

    /**
     * Assert that membership has required permission for an action
     * @throws 403 if permission is not granted
     */
    function assertPermission(membership: TMembership, permission: RolePermission): void {
        const role = extractRole(membership) as TRole
        const allowed = permissions[role]?.[permission]
        if (!allowed) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId: extractUserId(membership),
                entityId: extractEntityId(membership),
                entityName,
                action: permission,
                userRole: role,
                reason: 'insufficient_permissions'
            })
            throw createError(403, 'Forbidden for this role')
        }
    }

    /**
     * Ensure user has access to entity (optionally with specific permission)
     * Checks global access first (dynamic roles), then membership
     * @param queryRunner - Optional QueryRunner for RLS-aware database operations
     * @throws 403 if user is not a member or lacks permission
     * @throws 401 if userId is not provided
     */
    async function ensureAccess(
        ds: DataSource,
        userId: string | undefined,
        entityId: string,
        permission?: RolePermission,
        queryRunner?: QueryRunner
    ): Promise<MembershipContext<TMembership>> {
        if (!userId) {
            throw createError(401, 'Authentication required')
        }

        // Check superuser access (new API with isSuperuser function)
        if (isSuperuserFn && createGlobalAdminMembership) {
            const isSuper = await isSuperuserFn(ds, userId, queryRunner)
            if (isSuper) {
                // Get role name for logging (optional)
                const roleName = getGlobalRoleName ? await getGlobalRoleName(ds, userId, queryRunner) : 'superuser'
                console.info('[ACCESS] Superuser access granted - bypassing permissions', {
                    timestamp: new Date().toISOString(),
                    userId,
                    entityId,
                    entityName,
                    globalRole: roleName
                })
                // Create synthetic membership with full permissions
                const syntheticMembership = createGlobalAdminMembership(userId, entityId, roleName)
                return { membership: syntheticMembership, entityId }
            }
        }
        // Fallback to deprecated getGlobalRole API for backward compatibility
        else if (getGlobalRole && createGlobalAdminMembership) {
            const globalRole = await getGlobalRole(ds, userId, queryRunner)
            if (globalRole === 'superadmin' || globalRole === 'supermoderator') {
                console.info('[ACCESS] Global admin access granted (legacy)', {
                    timestamp: new Date().toISOString(),
                    userId,
                    entityId,
                    entityName,
                    globalRole
                })
                // Create synthetic membership with full permissions
                const syntheticMembership = createGlobalAdminMembership(userId, entityId, globalRole)
                return { membership: syntheticMembership, entityId }
            }
        }

        const membership = await getMembership(ds, userId, entityId, queryRunner)
        if (!membership) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId,
                entityId,
                entityName,
                action: permission || 'access',
                reason: 'not_member'
            })
            throw createError(403, `Access denied to this ${entityName}`)
        }

        if (permission) {
            assertPermission(membership, permission)
        }

        return { membership, entityId }
    }

    /**
     * Get membership without throwing errors
     * @param queryRunner - Optional QueryRunner for RLS-aware database operations
     * @returns Membership if found, null otherwise
     */
    async function getMembershipSafe(ds: DataSource, userId: string, entityId: string, queryRunner?: QueryRunner): Promise<TMembership | null> {
        return getMembership(ds, userId, entityId, queryRunner)
    }

    /**
     * Check if user has specific permission without throwing
     * @returns true if permission is granted, false otherwise
     */
    function hasPermission(membership: TMembership, permission: RolePermission): boolean {
        const role = extractRole(membership) as TRole
        return permissions[role]?.[permission] ?? false
    }

    /**
     * Assert that user is NOT an owner (for operations that should not affect owners)
     * @throws 400 if user is an owner
     */
    function assertNotOwner(membership: TMembership, operation: 'modify' | 'remove' = 'modify'): void {
        const role = extractRole(membership) as TRole
        if (role === 'owner') {
            const message = operation === 'remove' ? `Owner cannot be removed from ${entityName}` : 'Owner role cannot be modified'
            throw createError(400, message)
        }
    }

    return {
        assertPermission,
        ensureAccess,
        getMembershipSafe,
        hasPermission,
        assertNotOwner
    }
}
