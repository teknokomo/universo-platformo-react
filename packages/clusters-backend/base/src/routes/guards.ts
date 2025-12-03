import { DataSource } from 'typeorm'
import * as httpErrors from 'http-errors'
import { ClusterRole } from '@universo/types'
import { createAccessGuards } from '@universo/auth-backend'
import { ClusterUser } from '../database/entities/ClusterUser'
import { DomainCluster } from '../database/entities/DomainCluster'
import { ResourceDomain } from '../database/entities/ResourceDomain'
import { ResourceCluster } from '../database/entities/ResourceCluster'

// Handle both ESM and CJS imports
const createError = (httpErrors as any).default || httpErrors

// Re-export ClusterRole for convenience
export type { ClusterRole }

// Comments in English only

export const ROLE_PERMISSIONS = {
    owner: {
        manageMembers: true,
        manageCluster: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageCluster: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageCluster: false,
        createContent: false,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageCluster: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
} as const satisfies Record<ClusterRole, Record<string, boolean>>

export type RolePermission = keyof (typeof ROLE_PERMISSIONS)['owner']

export interface ClusterMembershipContext {
    membership: ClusterUser
    clusterId: string
}

// Create base guards using generic factory from auth-backend
const baseGuards = createAccessGuards<ClusterRole, ClusterUser>({
    entityName: 'cluster',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (ds: DataSource, userId: string, clusterId: string) => {
        const repo = ds.getRepository(ClusterUser)
        return repo.findOne({ where: { cluster_id: clusterId, user_id: userId } })
    },
    extractRole: (m) => (m.role || 'member') as ClusterRole,
    extractUserId: (m) => m.user_id,
    extractEntityId: (m) => m.cluster_id
})

// Re-export base guards (assertPermission, hasPermission are re-exported directly)
// Note: assertNotOwner is customized below for cluster-specific behavior
const { getMembershipSafe, assertPermission, hasPermission, ensureAccess } = baseGuards
export { assertPermission, hasPermission }

// Helpers for external use
export async function getClusterMembership(ds: DataSource, userId: string, clusterId: string): Promise<ClusterUser | null> {
    return getMembershipSafe(ds, userId, clusterId)
}

export async function ensureClusterAccess(
    ds: DataSource,
    userId: string,
    clusterId: string,
    permission?: RolePermission
): Promise<ClusterMembershipContext> {
    const baseContext = await ensureAccess(ds, userId, clusterId, permission)
    return { ...baseContext, clusterId: baseContext.entityId }
}

export interface DomainAccessContext extends ClusterMembershipContext {
    domainLink: DomainCluster
}

export async function ensureDomainAccess(
    ds: DataSource,
    userId: string,
    domainId: string,
    permission?: RolePermission
): Promise<DomainAccessContext> {
    const domainClusterRepo = ds.getRepository(DomainCluster)
    // Find ALL cluster links for this domain (M2M relationship)
    const domainClusters = await domainClusterRepo.find({ where: { domain: { id: domainId } }, relations: ['cluster'] })

    if (domainClusters.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            domainId,
            action: permission || 'access',
            reason: 'domain_not_found'
        })
        throw createError(404, 'Domain not found')
    }

    // Try to find at least ONE cluster where user has membership
    let lastError: any = null
    for (const domainCluster of domainClusters) {
        try {
            const context = await ensureClusterAccess(ds, userId, domainCluster.cluster.id, permission)
            // Success! User has access via this cluster
            return { ...context, domainLink: domainCluster }
        } catch (err) {
            // Remember error but continue checking other clusters
            lastError = err
        }
    }

    // If no cluster grants access, throw the last error
    throw lastError || createError(403, 'Access denied to domain')
}

export interface ResourceAccessContext extends ClusterMembershipContext {
    viaClusterIds: string[]
}

export async function ensureResourceAccess(
    ds: DataSource,
    userId: string,
    resourceId: string,
    permission?: RolePermission
): Promise<ResourceAccessContext> {
    const domainLinkRepo = ds.getRepository(ResourceDomain)
    const clusterLinkRepo = ds.getRepository(ResourceCluster)

    const domainLinks = await domainLinkRepo.find({ where: { resource: { id: resourceId } }, relations: ['domain'] })
    const domainIds = domainLinks.map((link) => link.domain.id)

    let clusterIds: string[] = []
    if (domainIds.length > 0) {
        const domainClusterRepo = ds.getRepository(DomainCluster)
        const domainClusterLinks = await domainClusterRepo.find({
            where: domainIds.map((id) => ({ domain: { id } })),
            relations: ['cluster']
        })
        clusterIds = domainClusterLinks.map((link) => link.cluster.id)
    }

    if (clusterIds.length === 0) {
        const explicitLinks = await clusterLinkRepo.find({ where: { resource: { id: resourceId } }, relations: ['cluster'] })
        if (explicitLinks.length === 0) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId,
                resourceId,
                action: permission || 'access',
                reason: 'resource_not_found'
            })
            throw createError(404, 'Resource not found')
        }
        clusterIds = explicitLinks.map((link) => link.cluster.id)
    }

    const uniqueClusterIds = Array.from(new Set(clusterIds))
    if (uniqueClusterIds.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            resourceId,
            action: permission || 'access',
            reason: 'no_cluster_links'
        })
        throw createError(403, 'Access denied to this resource')
    }

    const membershipRepo = ds.getRepository(ClusterUser)
    const memberships = await membershipRepo.find({
        // TypeORM does not yet expose precise typings for an array of OR conditions.
        // The `as any` cast avoids false positives until the upstream types are improved.
        where: uniqueClusterIds.map((id) => ({ cluster_id: id, user_id: userId })) as any
    })

    if (memberships.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            resourceId,
            clusterIds: uniqueClusterIds,
            action: permission || 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this resource')
    }

    if (!permission) {
        return { membership: memberships[0], clusterId: memberships[0].cluster_id, viaClusterIds: uniqueClusterIds }
    }

    const allowedMembership = memberships.find((membership) => ROLE_PERMISSIONS[(membership.role || 'member') as ClusterRole]?.[permission])
    if (!allowedMembership) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            resourceId,
            clusterIds: uniqueClusterIds,
            action: permission,
            userRoles: memberships.map((m) => m.role || 'member'),
            reason: 'insufficient_permissions'
        })
        throw createError(403, 'Forbidden for this role')
    }

    return { membership: allowedMembership, clusterId: allowedMembership.cluster_id, viaClusterIds: uniqueClusterIds }
}

/**
 * Throws an error if the user is the cluster owner.
 * Owners cannot be modified or removed to preserve access control integrity.
 *
 * @param membership - The ClusterUser membership to check
 * @param operation - The operation type: 'modify' (default) or 'remove'
 * @throws HTTP 400 error if the user is an owner
 */
export function assertNotOwner(membership: ClusterUser, operation: 'modify' | 'remove' = 'modify'): void {
    const role = (membership.role || 'member') as ClusterRole
    if (role === 'owner') {
        const message = operation === 'remove' ? 'Owner cannot be removed from cluster' : 'Owner role cannot be modified'
        throw createError(400, message)
    }
}
