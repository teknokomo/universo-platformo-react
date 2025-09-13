import { DataSource } from 'typeorm'
import { MetaverseUser } from '../database/entities/MetaverseUser'
import { SectionMetaverse } from '../database/entities/SectionMetaverse'
import { EntitySection } from '../database/entities/EntitySection'
import { EntityMetaverse } from '../database/entities/EntityMetaverse'

// Comments in English only

/**
 * Ensures the user has membership to the given metaverse.
 * Throws 403 error when access is denied.
 */
export async function ensureMetaverseAccess(ds: DataSource, userId: string, metaverseId: string): Promise<void> {
    const metaverseUserRepo = ds.getRepository(MetaverseUser)
    const found = await metaverseUserRepo.findOne({ where: { metaverse_id: metaverseId, user_id: userId } })
    if (!found) {
        const err: any = new Error('Access denied to this metaverse')
        err.status = 403
        throw err
    }
}

/**
 * Ensures the user can access the given section through its metaverse membership.
 * Throws 404 when the section link is missing, or 403 when membership is absent.
 */
export async function ensureSectionAccess(ds: DataSource, userId: string, sectionId: string): Promise<void> {
    const sectionMetaverseRepo = ds.getRepository(SectionMetaverse)
    const sectionMetaverse = await sectionMetaverseRepo.findOne({ where: { section: { id: sectionId } }, relations: ['metaverse'] })
    if (!sectionMetaverse) {
        const err: any = new Error('Section not found')
        err.status = 404
        throw err
    }
    await ensureMetaverseAccess(ds, userId, sectionMetaverse.metaverse.id)
}

/**
 * Ensures the user can access the given entity through any of its sections or metaverses.
 * Throws 404 when no links are found, or 403 when membership is absent.
 */
export async function ensureEntityAccess(ds: DataSource, userId: string, entityId: string): Promise<void> {
    const rdRepo = ds.getRepository(EntitySection)
    const rcRepo = ds.getRepository(EntityMetaverse)

    // Try via section links first
    const sectionLinks = await rdRepo.find({ where: { entity: { id: entityId } }, relations: ['section'] })
    if (sectionLinks.length > 0) {
        const dcRepo = ds.getRepository(SectionMetaverse)
        const sectionIds = sectionLinks.map((l) => l.section.id)
        const sectionMetaverseLinks = await dcRepo.find({ where: sectionIds.map((id) => ({ section: { id } })), relations: ['metaverse'] })
        const metaverseIds = Array.from(new Set(sectionMetaverseLinks.map((l) => l.metaverse.id)))
        if (metaverseIds.length === 0) {
            const err: any = new Error('Access denied to this entity')
            err.status = 403
            throw err
        }
        const cuRepo = ds.getRepository(MetaverseUser)
        const membership = await cuRepo.findOne({ where: metaverseIds.map((cid) => ({ metaverse_id: cid, user_id: userId })) as any })
        if (!membership) {
            const err: any = new Error('Access denied to this entity')
            err.status = 403
            throw err
        }
        return
    }

    // Fallback: check explicit entity-metaverse links
    const rc = await rcRepo.find({ where: { entity: { id: entityId } }, relations: ['metaverse'] })
    if (rc.length === 0) {
        const err: any = new Error('Entity not found')
        err.status = 404
        throw err
    }
    const metaverseIds = rc.map((l) => l.metaverse.id)
    const cuRepo = ds.getRepository(MetaverseUser)
    const membership = await cuRepo.findOne({ where: metaverseIds.map((cid) => ({ metaverse_id: cid, user_id: userId })) as any })
    if (!membership) {
        const err: any = new Error('Access denied to this entity')
        err.status = 403
        throw err
    }
}
