import * as httpErrors from 'http-errors'
import type { AccessGuardsConfig, MembershipContext, RolePermission } from './types'
import type { DbSession } from '@universo/utils'

// Handle both ESM and CJS imports
const createError = (httpErrors as any).default || httpErrors

/**
 * Creates a set of access guard functions for entity-based access control.
 *
 * @template TRole - String union of valid role names
 * @template TMembership - Type of the membership entity
 * @template TConn - Connection/queryable type (defaults to unknown)
 * @param config - Configuration object
 * @returns Object with guard functions
 *
 * @example
 * ```typescript
 * // Usage with DbExecutor:
 * const guards = createAccessGuards<AppRole, AppMembership, DbExecutor>({ ... })
 * ```
 */
export function createAccessGuards<TRole extends string, TMembership, TConn = unknown>(
    config: AccessGuardsConfig<TRole, TMembership, TConn>
) {
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
     * @param conn - Connection/queryable instance (DataSource, DbExecutor, etc.)
     * @param dbSession - Optional request-scoped database session for RLS-aware database operations
     * @throws 403 if user is not a member or lacks permission
     * @throws 401 if userId is not provided
     */
    async function ensureAccess(
        conn: TConn,
        userId: string | undefined,
        entityId: string,
        permission?: RolePermission,
        dbSession?: DbSession
    ): Promise<MembershipContext<TMembership>> {
        if (!userId) {
            throw createError(401, 'Authentication required')
        }

        // Check superuser access (new API with isSuperuser function)
        if (isSuperuserFn && createGlobalAdminMembership) {
            const isSuper = await isSuperuserFn(conn, userId, dbSession)
            if (isSuper) {
                // Get role name for logging (optional)
                const roleName = getGlobalRoleName ? await getGlobalRoleName(conn, userId, dbSession) : 'superuser'
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
            const globalRole = await getGlobalRole(conn, userId, dbSession)
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

        const membership = await getMembership(conn, userId, entityId, dbSession)
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
     * @param dbSession - Optional request-scoped database session for RLS-aware database operations
     * @returns Membership if found, null otherwise
     */
    async function getMembershipSafe(conn: TConn, userId: string, entityId: string, dbSession?: DbSession): Promise<TMembership | null> {
        return getMembership(conn, userId, entityId, dbSession)
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
