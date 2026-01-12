import { DataSource, QueryRunner } from 'typeorm'
import * as httpErrors from 'http-errors'
import { StorageRole } from '@universo/types'
import { createAccessGuards } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource } from '@universo/admin-backend'
import { StorageUser } from '../database/entities/StorageUser'
import { ContainerStorage } from '../database/entities/ContainerStorage'
import { SlotContainer } from '../database/entities/SlotContainer'
import { SlotStorage } from '../database/entities/SlotStorage'

// Handle both ESM and CJS imports
const createError = (httpErrors as any).default || httpErrors

// Re-export StorageRole for convenience
export type { StorageRole }

// Comments in English only

// Helper to get manager from DataSource or QueryRunner
const getManager = (ds: DataSource, queryRunner?: QueryRunner) => {
    if (queryRunner && !queryRunner.isReleased) {
        return queryRunner.manager
    }
    return ds.manager
}

export const ROLE_PERMISSIONS = {
    owner: {
        manageMembers: true,
        manageStorage: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageStorage: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageStorage: false,
        createContent: false,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageStorage: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
} as const satisfies Record<StorageRole, Record<string, boolean>>

export type RolePermission = keyof (typeof ROLE_PERMISSIONS)['owner']

export interface StorageMembershipContext {
    membership: StorageUser
    storageId: string
}

// Create base guards using generic factory from auth-backend
// Includes global admin bypass for superadmin/supermoderator
const baseGuards = createAccessGuards<StorageRole, StorageUser>({
    entityName: 'storage',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (ds: DataSource, userId: string, storageId: string, queryRunner?: QueryRunner) => {
        const repo = getManager(ds, queryRunner).getRepository(StorageUser)
        return repo.findOne({ where: { storage_id: storageId, user_id: userId } })
    },
    extractRole: (m) => (m.role || 'member') as StorageRole,
    extractUserId: (m) => m.user_id,
    extractEntityId: (m) => m.storage_id,
    // Global admin bypass - users with global access get owner-level access
    isSuperuser: isSuperuserByDataSource,
    getGlobalRoleName: getGlobalRoleCodenameByDataSource,
    createGlobalAdminMembership: (userId, entityId, _globalRole) =>
        ({
            user_id: userId,
            storage_id: entityId,
            role: 'owner', // Global admins get owner-level access
            created_at: new Date()
        }) as StorageUser
})

// Re-export base guards (assertPermission, hasPermission are re-exported directly)
// Note: assertNotOwner is customized below for storage-specific behavior
const { getMembershipSafe, assertPermission, hasPermission, ensureAccess } = baseGuards
export { assertPermission, hasPermission }

// Helpers for external use
export async function getStorageMembership(ds: DataSource, userId: string, storageId: string): Promise<StorageUser | null> {
    return getMembershipSafe(ds, userId, storageId)
}

export async function ensureStorageAccess(
    ds: DataSource,
    userId: string,
    storageId: string,
    permission?: RolePermission
): Promise<StorageMembershipContext> {
    const baseContext = await ensureAccess(ds, userId, storageId, permission)
    return { ...baseContext, storageId: baseContext.entityId }
}

// Container-specific guards
export interface ContainerAccessContext extends StorageMembershipContext {
    containerLink: ContainerStorage
}

export async function ensureContainerAccess(
    ds: DataSource,
    userId: string,
    containerId: string,
    permission?: RolePermission
): Promise<ContainerAccessContext> {
    const containerStorageRepo = ds.getRepository(ContainerStorage)
    const containerStorage = await containerStorageRepo.findOne({ where: { container: { id: containerId } }, relations: ['storage'] })
    if (!containerStorage) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            containerId,
            action: permission || 'access',
            reason: 'container_not_found'
        })
        throw createError(404, 'Container not found')
    }

    const context = await ensureStorageAccess(ds, userId, containerStorage.storage.id, permission)
    return { ...context, containerLink: containerStorage }
}

// Slot-specific guards
export interface SlotAccessContext extends StorageMembershipContext {
    viaStorageIds: string[]
}

export async function ensureSlotAccess(
    ds: DataSource,
    userId: string,
    slotId: string,
    permission?: RolePermission
): Promise<SlotAccessContext> {
    const containerLinkRepo = ds.getRepository(SlotContainer)
    const storageLinkRepo = ds.getRepository(SlotStorage)

    const containerLinks = await containerLinkRepo.find({ where: { slot: { id: slotId } }, relations: ['container'] })
    const containerIds = containerLinks.map((link) => link.container.id)

    let storageIds: string[] = []
    if (containerIds.length > 0) {
        const containerStorageRepo = ds.getRepository(ContainerStorage)
        const containerStorageLinks = await containerStorageRepo.find({
            where: containerIds.map((id) => ({ container: { id } })),
            relations: ['storage']
        })
        storageIds = containerStorageLinks.map((link) => link.storage.id)
    }

    if (storageIds.length === 0) {
        const explicitLinks = await storageLinkRepo.find({ where: { slot: { id: slotId } }, relations: ['storage'] })
        if (explicitLinks.length === 0) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId,
                slotId,
                action: permission || 'access',
                reason: 'slot_not_found'
            })
            throw createError(404, 'Slot not found')
        }
        storageIds = explicitLinks.map((link) => link.storage.id)
    }

    const uniqueStorageIds = Array.from(new Set(storageIds))
    if (uniqueStorageIds.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            slotId,
            action: permission || 'access',
            reason: 'no_storage_links'
        })
        throw createError(403, 'Access denied to this slot')
    }

    const membershipRepo = ds.getRepository(StorageUser)
    const memberships = await membershipRepo.find({
        // TypeORM does not yet expose precise typings for an array of OR conditions.
        // The `as any` cast avoids false positives until the upstream types are improved.
        where: uniqueStorageIds.map((id) => ({ storage_id: id, user_id: userId })) as any
    })

    if (memberships.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            slotId,
            storageIds: uniqueStorageIds,
            action: permission || 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this slot')
    }

    if (!permission) {
        return { membership: memberships[0], storageId: memberships[0].storage_id, viaStorageIds: uniqueStorageIds }
    }

    const allowedMembership = memberships.find((membership) => ROLE_PERMISSIONS[(membership.role || 'member') as StorageRole]?.[permission])
    if (!allowedMembership) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            slotId,
            storageIds: uniqueStorageIds,
            action: permission,
            userRoles: memberships.map((m) => m.role || 'member'),
            reason: 'insufficient_permissions'
        })
        throw createError(403, 'Forbidden for this role')
    }

    return { membership: allowedMembership, storageId: allowedMembership.storage_id, viaStorageIds: uniqueStorageIds }
}

/**
 * Throws an error if the user is the storage owner.
 * Owners cannot be modified or removed to preserve access control integrity.
 *
 * @param membership - The StorageUser membership to check
 * @param operation - The operation type: 'modify' (default) or 'remove'
 * @throws HTTP 400 error if the user is an owner
 */
export function assertNotOwner(membership: StorageUser, operation: 'modify' | 'remove' = 'modify'): void {
    const role = (membership.role || 'member') as StorageRole
    if (role === 'owner') {
        const message = operation === 'remove' ? 'Owner cannot be removed from storage' : 'Owner role cannot be modified'
        throw createError(400, message)
    }
}
