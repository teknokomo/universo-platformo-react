import { DataSource } from 'typeorm'
import * as httpErrors from 'http-errors'
import { MetaverseRole } from '@universo/types'

// Handle both ESM and CJS imports
const createError = (httpErrors as any).default || httpErrors
import { MetaverseUser } from '../database/entities/MetaverseUser'
import { SectionMetaverse } from '../database/entities/SectionMetaverse'
import { EntitySection } from '../database/entities/EntitySection'
import { EntityMetaverse } from '../database/entities/EntityMetaverse'

// Re-export MetaverseRole for convenience
export type { MetaverseRole }

// Comments in English only

export const ROLE_PERMISSIONS = {
    owner: {
        manageMembers: true,
        manageMetaverse: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageMetaverse: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageMetaverse: false,
        createContent: false,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageMetaverse: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
} as const satisfies Record<MetaverseRole, Record<string, boolean>>

export type RolePermission = keyof (typeof ROLE_PERMISSIONS)['owner']

export interface MetaverseMembershipContext {
    membership: MetaverseUser
    metaverseId: string
}

export async function getMetaverseMembership(ds: DataSource, userId: string, metaverseId: string): Promise<MetaverseUser | null> {
    const repo = ds.getRepository(MetaverseUser)
    return repo.findOne({ where: { metaverse_id: metaverseId, user_id: userId } })
}

export function assertPermission(membership: MetaverseUser, permission: RolePermission): void {
    const role = (membership.role || 'member') as MetaverseRole
    const allowed = ROLE_PERMISSIONS[role]?.[permission]
    if (!allowed) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId: membership.user_id,
            metaverseId: membership.metaverse_id,
            action: permission,
            userRole: role,
            reason: 'insufficient_permissions'
        })
        throw createError(403, 'Forbidden for this role')
    }
}

export async function ensureMetaverseAccess(
    ds: DataSource,
    userId: string,
    metaverseId: string,
    permission?: RolePermission
): Promise<MetaverseMembershipContext> {
    const membership = await getMetaverseMembership(ds, userId, metaverseId)
    if (!membership) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            metaverseId,
            action: permission || 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this metaverse')
    }
    if (permission) {
        assertPermission(membership, permission)
    }
    return { membership, metaverseId }
}

export interface SectionAccessContext extends MetaverseMembershipContext {
    sectionLink: SectionMetaverse
}

export async function ensureSectionAccess(
    ds: DataSource,
    userId: string,
    sectionId: string,
    permission?: RolePermission
): Promise<SectionAccessContext> {
    const sectionMetaverseRepo = ds.getRepository(SectionMetaverse)
    const sectionMetaverse = await sectionMetaverseRepo.findOne({ where: { section: { id: sectionId } }, relations: ['metaverse'] })
    if (!sectionMetaverse) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            sectionId,
            action: permission || 'access',
            reason: 'section_not_found'
        })
        throw createError(404, 'Section not found')
    }

    const context = await ensureMetaverseAccess(ds, userId, sectionMetaverse.metaverse.id, permission)
    return { ...context, sectionLink: sectionMetaverse }
}

export interface EntityAccessContext extends MetaverseMembershipContext {
    viaMetaverseIds: string[]
}

export async function ensureEntityAccess(
    ds: DataSource,
    userId: string,
    entityId: string,
    permission?: RolePermission
): Promise<EntityAccessContext> {
    const sectionLinkRepo = ds.getRepository(EntitySection)
    const metaverseLinkRepo = ds.getRepository(EntityMetaverse)

    const sectionLinks = await sectionLinkRepo.find({ where: { entity: { id: entityId } }, relations: ['section'] })
    const sectionIds = sectionLinks.map((link) => link.section.id)

    let metaverseIds: string[] = []
    if (sectionIds.length > 0) {
        const sectionMetaverseRepo = ds.getRepository(SectionMetaverse)
        const sectionMetaverseLinks = await sectionMetaverseRepo.find({
            where: sectionIds.map((id) => ({ section: { id } })),
            relations: ['metaverse']
        })
        metaverseIds = sectionMetaverseLinks.map((link) => link.metaverse.id)
    }

    if (metaverseIds.length === 0) {
        const explicitLinks = await metaverseLinkRepo.find({ where: { entity: { id: entityId } }, relations: ['metaverse'] })
        if (explicitLinks.length === 0) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId,
                entityId,
                action: permission || 'access',
                reason: 'entity_not_found'
            })
            throw createError(404, 'Entity not found')
        }
        metaverseIds = explicitLinks.map((link) => link.metaverse.id)
    }

    const uniqueMetaverseIds = Array.from(new Set(metaverseIds))
    if (uniqueMetaverseIds.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            entityId,
            action: permission || 'access',
            reason: 'no_metaverse_links'
        })
        throw createError(403, 'Access denied to this entity')
    }

    const membershipRepo = ds.getRepository(MetaverseUser)
    const memberships = await membershipRepo.find({
        // TypeORM does not yet expose precise typings for an array of OR conditions.
        // The `as any` cast avoids false positives until the upstream types are improved.
        where: uniqueMetaverseIds.map((id) => ({ metaverse_id: id, user_id: userId })) as any
    })

    if (memberships.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            entityId,
            metaverseIds: uniqueMetaverseIds,
            action: permission || 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this entity')
    }

    if (!permission) {
        return { membership: memberships[0], metaverseId: memberships[0].metaverse_id, viaMetaverseIds: uniqueMetaverseIds }
    }

    const allowedMembership = memberships.find(
        (membership) => ROLE_PERMISSIONS[(membership.role || 'member') as MetaverseRole]?.[permission]
    )
    if (!allowedMembership) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            entityId,
            metaverseIds: uniqueMetaverseIds,
            action: permission,
            userRoles: memberships.map((m) => m.role || 'member'),
            reason: 'insufficient_permissions'
        })
        throw createError(403, 'Forbidden for this role')
    }

    return { membership: allowedMembership, metaverseId: allowedMembership.metaverse_id, viaMetaverseIds: uniqueMetaverseIds }
}

/**
 * Throws an error if the user is the metaverse owner.
 * Owners cannot be modified or removed to preserve access control integrity.
 *
 * @param membership - The MetaverseUser membership to check
 * @param operation - The operation type: 'modify' (default) or 'remove'
 * @throws HTTP 400 error if the user is an owner
 */
export function assertNotOwner(membership: MetaverseUser, operation: 'modify' | 'remove' = 'modify'): void {
    const role = (membership.role || 'member') as MetaverseRole
    if (role === 'owner') {
        const message = operation === 'remove' ? 'Owner cannot be removed from metaverse' : 'Owner role cannot be modified'
        throw createError(400, message)
    }
}
