import type { DbSession } from '@universo/utils'

/**
 * Global roles that grant cross-entity access
 * @deprecated Use hasGlobalAccess boolean check instead
 */
export type GlobalRole = 'superadmin' | 'supermoderator' | null

/**
 * Configuration for creating access guards.
 *
 * @template TRole - String union of valid role names
 * @template TMembership - Type of the membership entity
 * @template TConn - Connection/queryable type passed to guard functions.
 *   Defaults to `unknown`. Callers should specify `DbExecutor`, `Knex`, etc.
 */
export interface AccessGuardsConfig<TRole extends string, TMembership, TConn = unknown> {
    /** Entity name (e.g., 'metaverse', 'cluster', 'unik') */
    entityName: string
    /** List of valid roles */
    roles: readonly TRole[]
    /** Permission matrix for each role */
    permissions: Record<TRole, Record<string, boolean>>
    /** Function to fetch membership from database (supports optional request-scoped DB session) */
    getMembership: (conn: TConn, userId: string, entityId: string, dbSession?: DbSession) => Promise<TMembership | null>
    /** Extract role from membership */
    extractRole: (membership: TMembership) => TRole
    /** Extract user ID from membership */
    extractUserId: (membership: TMembership) => string
    /** Extract entity ID from membership */
    extractEntityId: (membership: TMembership) => string
    /**
     * Optional function to check if user is superuser (bypasses all permissions)
     * If true, user gets access without membership check and full permissions
     * Supports optional request-scoped DB session
     */
    isSuperuser?: (conn: TConn, userId: string, dbSession?: DbSession) => Promise<boolean>
    /**
     * Optional function to get global role name (for logging/display)
     * Only called if isSuperuser returns true
     * Supports optional request-scoped DB session
     */
    getGlobalRoleName?: (conn: TConn, userId: string, dbSession?: DbSession) => Promise<string | null>
    /**
     * @deprecated Use isSuperuser instead
     * Optional function to check global role (superadmin/supermoderator)
     * If user has a global role, they get access without membership check
     * Supports optional request-scoped DB session
     */
    getGlobalRole?: (conn: TConn, userId: string, dbSession?: DbSession) => Promise<GlobalRole>
    /**
     * Factory to create synthetic membership for superusers
     * Required if isSuperuser or getGlobalRole is provided
     */
    createGlobalAdminMembership?: (userId: string, entityId: string, globalRole: GlobalRole | string) => TMembership
}

/**
 * Context returned by ensureAccess guards
 */
export interface MembershipContext<TMembership> {
    membership: TMembership
    entityId: string
}

/**
 * Type for permission keys
 */
export type RolePermission = string
