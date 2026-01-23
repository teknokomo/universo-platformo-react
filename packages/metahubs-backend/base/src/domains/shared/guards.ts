import type { DataSource, QueryRunner } from 'typeorm'
import * as httpErrors from 'http-errors'
import { MetahubRole } from '@universo/types'
import { createAccessGuards } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource, hasSubjectPermissionByDataSource } from '@universo/admin-backend'
import { MetahubUser } from '../../database/entities/MetahubUser'
// Hub entity removed - hubs are now in isolated schemas (_mhb_hubs)

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

// ============ HUB ACCESS GUARDS ============

/**
 * Hub data shape returned from _mhb_objects table with kind='HUB'
 */
export interface HubData {
    id: string
    codename: string
    name: Record<string, unknown>
    description: Record<string, unknown> | null
    sort_order: number
    created_at: Date
    updated_at: Date
}

export interface HubAccessContext extends MetahubMembershipContext {
    hub: HubData
}

/**
 * Ensure user has access to a Hub through its parent Metahub.
 *
 * NOTE: This function requires knowning the metahubId in advance.
 * For routes that receive hubId without metahubId, the route handler
 * should use MetahubHubsService directly after ensureMetahubAccess.
 */
export async function ensureHubAccess(
    ds: DataSource,
    userId: string,
    metahubId: string,
    hubId: string,
    permission?: RolePermission,
    queryRunner?: QueryRunner
): Promise<HubAccessContext> {
    // First check metahub access
    const context = await ensureMetahubAccess(ds, userId, metahubId, permission, queryRunner)

    // Import dynamically to avoid circular dependencies
    const { MetahubSchemaService } = await import('../metahubs/services/MetahubSchemaService.js')
    const { MetahubHubsService } = await import('../metahubs/services/MetahubHubsService.js')

    const schemaService = new MetahubSchemaService(ds)
    const hubsService = new MetahubHubsService(schemaService)

    const hubData = await hubsService.findById(metahubId, hubId)

    if (!hubData) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            hubId,
            action: permission || 'access',
            reason: 'hub_not_found'
        })
        throw createError(404, 'Hub not found')
    }

    // Map service response to HubData interface
    const hub: HubData = {
        id: hubData.id as string,
        codename: hubData.codename as string,
        name: hubData.name as Record<string, unknown>,
        description: hubData.description as Record<string, unknown> | null,
        sort_order: hubData.sort_order as number,
        created_at: hubData.created_at as Date,
        updated_at: hubData.updated_at as Date
    }

    return { ...context, hub }
}

// REMOVED Catalog / Attribute guards as they depended on removed entities.
// Access control for dynamic schema objects is handled by MetahubObjectsService logic (using ensureMetahubAccess + manual checks if needed)
// Or by route handlers using ensureMetahubAccess and then checking association.

// Suppress unused variable warning for createError (used in assertNotOwner)
void createError

