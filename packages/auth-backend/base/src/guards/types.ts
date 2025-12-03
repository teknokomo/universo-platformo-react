import { DataSource } from 'typeorm'

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
