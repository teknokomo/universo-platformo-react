import { DataSource } from 'typeorm'

/**
 * Global roles that grant cross-entity access
 * @deprecated Use hasGlobalAccess boolean check instead
 */
export type GlobalRole = 'superadmin' | 'supermoderator' | null

/**
 * Configuration for creating access guards
 */
export interface AccessGuardsConfig<TRole extends string, TMembership> {
    /** Entity name (e.g., 'metaverse', 'cluster', 'unik') */
    entityName: string
    /** List of valid roles */
    roles: readonly TRole[]
    /** Permission matrix for each role */
    permissions: Record<TRole, Record<string, boolean>>
    /** Function to fetch membership from database */
    getMembership: (ds: DataSource, userId: string, entityId: string) => Promise<TMembership | null>
    /** Extract role from membership */
    extractRole: (membership: TMembership) => TRole
    /** Extract user ID from membership */
    extractUserId: (membership: TMembership) => string
    /** Extract entity ID from membership */
    extractEntityId: (membership: TMembership) => string
    /**
     * Optional function to check if user has global access
     * If true, user gets access without membership check
     */
    hasGlobalAccess?: (ds: DataSource, userId: string) => Promise<boolean>
    /**
     * Optional function to get global role name (for logging/display)
     * Only called if hasGlobalAccess returns true
     */
    getGlobalRoleName?: (ds: DataSource, userId: string) => Promise<string | null>
    /**
     * @deprecated Use hasGlobalAccess instead
     * Optional function to check global role (superadmin/supermoderator)
     * If user has a global role, they get access without membership check
     */
    getGlobalRole?: (ds: DataSource, userId: string) => Promise<GlobalRole>
    /**
     * Factory to create synthetic membership for global admins
     * Required if hasGlobalAccess or getGlobalRole is provided
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
