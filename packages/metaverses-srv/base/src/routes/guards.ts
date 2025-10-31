import { DataSource } from 'typeorm'
import { MetaverseRole } from '@universo/types'
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
        const err: any = new Error('Forbidden for this role')
        err.status = 403
        throw err
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
        const err: any = new Error('Access denied to this metaverse')
        err.status = 403
        throw err
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
        const err: any = new Error('Section not found')
        err.status = 404
        throw err
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
            const err: any = new Error('Entity not found')
            err.status = 404
            throw err
        }
        metaverseIds = explicitLinks.map((link) => link.metaverse.id)
    }

    const uniqueMetaverseIds = Array.from(new Set(metaverseIds))
    if (uniqueMetaverseIds.length === 0) {
        const err: any = new Error('Access denied to this entity')
        err.status = 403
        throw err
    }

    const membershipRepo = ds.getRepository(MetaverseUser)
    const memberships = await membershipRepo.find({
        // TypeORM does not yet expose precise typings for an array of OR conditions.
        // The `as any` cast avoids false positives until the upstream types are improved.
        where: uniqueMetaverseIds.map((id) => ({ metaverse_id: id, user_id: userId })) as any
    })

    if (memberships.length === 0) {
        const err: any = new Error('Access denied to this entity')
        err.status = 403
        throw err
    }

    if (!permission) {
        return { membership: memberships[0], metaverseId: memberships[0].metaverse_id, viaMetaverseIds: uniqueMetaverseIds }
    }

    const allowedMembership = memberships.find(
        (membership) => ROLE_PERMISSIONS[(membership.role || 'member') as MetaverseRole]?.[permission]
    )
    if (!allowedMembership) {
        const err: any = new Error('Forbidden for this role')
        err.status = 403
        throw err
    }

    return { membership: allowedMembership, metaverseId: allowedMembership.metaverse_id, viaMetaverseIds: uniqueMetaverseIds }
}
