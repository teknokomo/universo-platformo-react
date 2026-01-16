import type { DataSource, QueryRunner } from 'typeorm'
import * as httpErrors from 'http-errors'
import { MetahubRole } from '@universo/types'
import { createAccessGuards } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { MetahubUser } from '../../database/entities/MetahubUser'
import { Hub } from '../../database/entities/Hub'
import { Catalog } from '../../database/entities/Catalog'
import { CatalogHub } from '../../database/entities/CatalogHub'
import { Attribute } from '../../database/entities/Attribute'

// Handle both ESM and CJS imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createError = (httpErrors as any).default || httpErrors

// Re-export MetahubRole for convenience
export type { MetahubRole }

export const ROLE_PERMISSIONS: Record<MetahubRole, Record<string, boolean>> = {
    owner: {
        manageMembers: true,
        manageMetahub: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageMetahub: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageMetahub: false,
        createContent: true,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageMetahub: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
}

export type RolePermission = 'manageMembers' | 'manageMetahub' | 'createContent' | 'editContent' | 'deleteContent'

export interface MetahubMembershipContext {
    membership: MetahubUser
    metahubId: string
    entityId?: string
    isSynthetic?: boolean
    globalRole?: string | null
}

const getManager = (ds: DataSource, queryRunner?: QueryRunner) => {
    if (queryRunner && !queryRunner.isReleased) {
        return queryRunner.manager
    }
    return ds.manager
}

// Create base guards using generic factory from auth-backend
// Includes global admin bypass for superadmin/supermoderator
const baseGuards = createAccessGuards<MetahubRole, MetahubUser>({
    entityName: 'metahub',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (ds: DataSource, userId: string, metahubId: string, queryRunner?: QueryRunner) => {
        const repo = getManager(ds, queryRunner).getRepository(MetahubUser)
        return repo.findOne({ where: { metahub_id: metahubId, user_id: userId } })
    },
    extractRole: (m) => (m.role || 'member') as MetahubRole,
    extractUserId: (m) => m.user_id,
    extractEntityId: (m) => m.metahub_id,
    // Global admin bypass - users with global access get owner-level access
    isSuperuser: isSuperuserByDataSource,
    getGlobalRoleName: getGlobalRoleCodenameByDataSource,
    createGlobalAdminMembership: (userId, entityId, _globalRole) =>
        ({
            user_id: userId,
            metahub_id: entityId,
            role: 'owner', // Global admins get owner-level access
            created_at: new Date()
        } as MetahubUser)
})

// Re-export base guards
const { getMembershipSafe, assertPermission, hasPermission, ensureAccess } = baseGuards
export { assertPermission, hasPermission }

// Helpers for external use
export async function getMetahubMembership(ds: DataSource, userId: string, metahubId: string): Promise<MetahubUser | null> {
    return getMembershipSafe(ds, userId, metahubId)
}

export async function ensureMetahubAccess(
    ds: DataSource,
    userId: string,
    metahubId: string,
    permission?: RolePermission,
    queryRunner?: QueryRunner
): Promise<MetahubMembershipContext> {
    // First check if user has global metahubs permission / superuser bypass
    const isSuper = await isSuperuserByDataSource(ds, userId, queryRunner)
    const hasGlobalMetahubsAccess = await hasSubjectPermissionByDataSource(ds, userId, 'metahubs', 'read', queryRunner)

    if (isSuper || hasGlobalMetahubsAccess) {
        // User has global access - create synthetic membership with owner role
        const globalRoleName = await getGlobalRoleCodenameByDataSource(ds, userId, queryRunner)
        const syntheticMembership: MetahubUser = {
            user_id: userId,
            metahub_id: metahubId,
            role: 'owner', // Global role users get owner-level access
            created_at: new Date()
        } as MetahubUser

        return {
            membership: syntheticMembership,
            entityId: metahubId,
            metahubId,
            isSynthetic: true,
            globalRole: globalRoleName
        }
    }

    // Otherwise do membership check using request manager (RLS-enabled if available)
    const manager = getManager(ds, queryRunner)
    const membership = await manager.getRepository(MetahubUser).findOne({ where: { metahub_id: metahubId, user_id: userId } })
    if (!membership) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            metahubId,
            action: permission || 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this metahub')
    }

    if (permission) {
        assertPermission(membership, permission)
    }

    return { membership, entityId: metahubId, metahubId }
}

/**
 * Assert that the target user is not the owner of the metahub
 * Used to prevent owner from being demoted or removed
 */
export function assertNotOwner(membership: MetahubUser, operation: 'modify' | 'remove' = 'modify'): void {
    if (membership.role === 'owner') {
        const action = operation === 'modify' ? 'update role of' : 'remove'
        throw createError(403, `Cannot ${action} the owner of this metahub`)
    }
}

// ============ HUB & ATTRIBUTE ACCESS GUARDS ============

export interface HubAccessContext extends MetahubMembershipContext {
    hub: Hub
}

/**
 * Ensure user has access to a Hub through its parent Metahub
 * In the new model, Hub directly belongs to one Metahub via FK
 */
export async function ensureHubAccess(
    ds: DataSource,
    userId: string,
    hubId: string,
    permission?: RolePermission,
    queryRunner?: QueryRunner
): Promise<HubAccessContext> {
    const hubRepo = getManager(ds, queryRunner).getRepository(Hub)
    const hub = await hubRepo.findOne({ where: { id: hubId } })

    if (!hub) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            hubId,
            action: permission || 'access',
            reason: 'hub_not_found'
        })
        throw createError(404, 'Hub not found')
    }

    // Check access to the parent metahub
    const context = await ensureMetahubAccess(ds, userId, hub.metahubId, permission, queryRunner)

    return { ...context, hub }
}

export interface CatalogAccessContext extends MetahubMembershipContext {
    catalog: Catalog
    hub?: Hub
}

/**
 * Ensure user has access to a Catalog through its parent Metahub
 * In the new model, Catalog → Metahub (with optional Hub association)
 */
export async function ensureCatalogAccess(
    ds: DataSource,
    userId: string,
    catalogId: string,
    permission?: RolePermission,
    hubId?: string,
    queryRunner?: QueryRunner
): Promise<CatalogAccessContext> {
    const manager = getManager(ds, queryRunner)
    const catalogRepo = manager.getRepository(Catalog)
    const catalog = await catalogRepo.findOne({ where: { id: catalogId } })

    if (!catalog) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            catalogId,
            action: permission || 'access',
            reason: 'catalog_not_found'
        })
        throw createError(404, 'Catalog not found')
    }

    // If hubId is provided, verify the catalog is associated with that hub
    if (hubId) {
        const catalogHubRepo = manager.getRepository(CatalogHub)
        const catalogHub = await catalogHubRepo.findOne({ where: { catalogId, hubId } })
        if (!catalogHub) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId,
                catalogId,
                hubId,
                action: permission || 'access',
                reason: 'catalog_not_in_hub'
            })
            throw createError(404, 'Catalog not found in this hub')
        }
    }

    // Check access through metahub
    const metahubContext = await ensureMetahubAccess(ds, userId, catalog.metahubId, permission, queryRunner)

    // Optionally load hub if provided
    let hub: Hub | undefined
    if (hubId) {
        const hubRepo = manager.getRepository(Hub)
        const foundHub = await hubRepo.findOne({ where: { id: hubId } })
        if (foundHub) {
            hub = foundHub
        }
    }

    return { ...metahubContext, catalog, hub }
}

export interface AttributeAccessContext extends MetahubMembershipContext {
    attribute: Attribute
    catalog: Catalog
    hub?: Hub
}

/**
 * Ensure user has access to an Attribute through its parent Catalog → Metahub chain
 * In the new model, Attribute → Catalog → Metahub
 */
export async function ensureAttributeAccess(
    ds: DataSource,
    userId: string,
    attributeId: string,
    permission?: RolePermission,
    hubId?: string,
    queryRunner?: QueryRunner
): Promise<AttributeAccessContext> {
    const attributeRepo = getManager(ds, queryRunner).getRepository(Attribute)
    const attribute = await attributeRepo.findOne({ where: { id: attributeId } })

    if (!attribute) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            attributeId,
            action: permission || 'access',
            reason: 'attribute_not_found'
        })
        throw createError(404, 'Attribute not found')
    }

    // Check access through catalog
    const catalogContext = await ensureCatalogAccess(ds, userId, attribute.catalogId, permission, hubId, queryRunner)

    return { ...catalogContext, attribute, catalog: catalogContext.catalog, hub: catalogContext.hub }
}

// Suppress unused variable warning for createError (used in assertNotOwner)
void createError
