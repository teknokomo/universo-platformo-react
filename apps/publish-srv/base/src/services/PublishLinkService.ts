import { DataSource, EntityManager, Repository } from 'typeorm'
import { randomBytes } from 'crypto'
import bs58 from 'bs58'
import { PublishCanvas } from '../database/entities'
import { CreatePublishLinkDto, PublishLinkQuery, PublishLinkResponse, UpdatePublishLinkDto } from '../types/publishLink.types'
import { CanvasMinimal } from '../types/publication.types'

type PublishLinkRepository = Repository<PublishCanvas>

const BASE_SLUG_LENGTH = 12
const MAX_SLUG_GENERATION_ATTEMPTS = 10

function sanitizeCustomSlug(slug: string | null | undefined): string | null {
    if (!slug) {
        return null
    }

    const normalized = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
    const collapsed = normalized.replace(/-+/g, '-').replace(/^-|-$/g, '')
    return collapsed.length ? collapsed : null
}

export class PublishLinkService {
    constructor(private readonly dataSource: DataSource) {}

    private getRepository(manager?: EntityManager): PublishLinkRepository {
        if (manager) {
            return manager.getRepository(PublishCanvas)
        }
        return this.dataSource.getRepository(PublishCanvas)
    }

    private getCanvasRepository(manager: EntityManager) {
        const canvasMetadata = this.dataSource.getMetadata('Canvas')
        return manager.getRepository(canvasMetadata.target)
    }

    private async resolveSpaceContext(
        canvasId: string,
        versionGroupId: string,
        manager: EntityManager
    ): Promise<{ unikId: string; spaceId: string | null }> {
        const result = await manager
            .createQueryBuilder()
            .select('space.unik_id', 'unikId')
            .addSelect('space.id', 'spaceId')
            .from('spaces_canvases', 'sc')
            .innerJoin('spaces', 'space', 'space.id = sc.space_id')
            .where('sc.version_group_id = :versionGroupId', { versionGroupId })
            .limit(1)
            .getRawOne()

        if (result?.unikId) {
            return { unikId: result.unikId, spaceId: result.spaceId || null }
        }

        // Fallback: try to locate by explicit canvas mapping
        const fallback = await manager
            .createQueryBuilder()
            .select('space.unik_id', 'unikId')
            .addSelect('space.id', 'spaceId')
            .from('spaces_canvases', 'sc')
            .innerJoin('spaces', 'space', 'space.id = sc.space_id')
            .where('sc.canvas_id = :canvasId', { canvasId })
            .limit(1)
            .getRawOne()

        if (!fallback?.unikId) {
            throw new Error('Unable to resolve unik/space context for publication link')
        }

        return { unikId: fallback.unikId, spaceId: fallback.spaceId || null }
    }

    private async generateUniqueBaseSlug(manager: EntityManager): Promise<string> {
        const repo = this.getRepository(manager)
        for (let attempt = 0; attempt < MAX_SLUG_GENERATION_ATTEMPTS; attempt += 1) {
            const candidate = this.generateBaseSlug()
            const existing = await repo.count({ where: [{ baseSlug: candidate }, { customSlug: candidate }] })
            if (existing === 0) {
                return candidate
            }
        }
        throw new Error('Failed to generate unique slug after multiple attempts')
    }

    private generateBaseSlug(): string {
        const bytes = randomBytes(Math.ceil(BASE_SLUG_LENGTH * 0.8))
        const encoded = bs58.encode(new Uint8Array(bytes))
        return encoded.slice(0, BASE_SLUG_LENGTH)
    }

    private async ensureCustomSlugAvailable(slug: string, manager: EntityManager, excludeId?: string): Promise<void> {
        const repo = this.getRepository(manager)
        const existing = await repo.findOne({
            where: [{ baseSlug: slug }, { customSlug: slug }]
        })

        if (existing && existing.id !== excludeId) {
            throw new Error('Slug is already in use')
        }
    }

    async createLink(payload: CreatePublishLinkDto): Promise<PublishLinkResponse> {
        return this.dataSource.transaction(async (manager) => {
            const repo = this.getRepository(manager)
            const baseSlug = await this.generateUniqueBaseSlug(manager)
            const customSlug = sanitizeCustomSlug(payload.customSlug)

            if (customSlug) {
                await this.ensureCustomSlugAvailable(customSlug, manager)
            }

            // Server-side fallback: if creating a group link and versionGroupId is missing,
            // but targetCanvasId is provided, resolve versionGroupId from the canvas record.
            let resolvedVersionGroupId = payload.versionGroupId ?? null
            if (!payload.targetVersionUuid && !resolvedVersionGroupId && payload.targetCanvasId) {
                const canvasRepo = this.getCanvasRepository(manager)
                const canvas = (await canvasRepo.findOne({ where: { id: payload.targetCanvasId } })) as CanvasMinimal | null
                if (canvas) {
                    const vg = (canvas as any).versionGroupId as string | undefined
                    if (vg) {
                        resolvedVersionGroupId = vg
                    }
                }
            }

            const link = repo.create({
                unikId: payload.unikId,
                spaceId: payload.spaceId ?? null,
                technology: payload.technology,
                versionGroupId: resolvedVersionGroupId,
                targetCanvasId: payload.targetCanvasId ?? null,
                targetVersionUuid: payload.targetVersionUuid ?? null,
                targetType: payload.targetVersionUuid ? 'version' : 'group',
                baseSlug,
                customSlug,
                isPublic: payload.isPublic ?? true
            })

            return repo.save(link)
        })
    }

    async updateLink(id: string, payload: UpdatePublishLinkDto): Promise<PublishLinkResponse | null> {
        return this.dataSource.transaction(async (manager) => {
            const repo = this.getRepository(manager)
            const existing = await repo.findOne({ where: { id } })
            if (!existing) {
                return null
            }

            if (payload.customSlug !== undefined) {
                const customSlug = sanitizeCustomSlug(payload.customSlug)
                if (customSlug) {
                    await this.ensureCustomSlugAvailable(customSlug, manager, existing.id)
                }
                existing.customSlug = customSlug
            }

            if (typeof payload.isPublic === 'boolean') {
                existing.isPublic = payload.isPublic
            }

            if (payload.targetCanvasId !== undefined) {
                existing.targetCanvasId = payload.targetCanvasId ?? null
            }

            if (payload.targetVersionUuid !== undefined) {
                existing.targetVersionUuid = payload.targetVersionUuid ?? null
                // Update targetType based on presence of targetVersionUuid
                existing.targetType = existing.targetVersionUuid ? 'version' : 'group'
            }

            return repo.save(existing)
        })
    }

    async deleteLink(id: string): Promise<boolean> {
        const repo = this.getRepository()
        const result = await repo.delete({ id })
        return Boolean(result.affected && result.affected > 0)
    }

    async findBySlug(slug: string): Promise<PublishLinkResponse | null> {
        const repo = this.getRepository()
        return repo.createQueryBuilder('link').where('link.baseSlug = :slug OR link.customSlug = :slug', { slug }).getOne()
    }

    async listLinks(query: PublishLinkQuery): Promise<PublishLinkResponse[]> {
        const repo = this.getRepository()
        const qb = repo.createQueryBuilder('link').where('link.unikId = :unikId', { unikId: query.unikId })

        if (query.spaceId) {
            qb.andWhere('link.spaceId = :spaceId', { spaceId: query.spaceId })
        }
        if (query.technology) {
            qb.andWhere('link.technology = :technology', { technology: query.technology })
        }
        if (query.versionGroupId) {
            qb.andWhere('link.versionGroupId = :versionGroupId', { versionGroupId: query.versionGroupId })
        }
        if (query.targetVersionUuid) {
            qb.andWhere('link.targetVersionUuid = :targetVersionUuid', {
                targetVersionUuid: query.targetVersionUuid
            })
        }

        return qb.orderBy('link.createdAt', 'ASC').getMany()
    }

    async updateGroupTarget(versionGroupId: string, targetCanvasId: string, manager?: EntityManager): Promise<void> {
        const repo = this.getRepository(manager)
        await repo
            .createQueryBuilder()
            .update(PublishCanvas)
            .set({ targetCanvasId })
            .where('versionGroupId = :versionGroupId', { versionGroupId })
            .andWhere('targetType = :targetType', { targetType: 'group' })
            .execute()
    }

    async ensureGroupLinkForCanvas(canvasId: string, technology: PublishCanvas['technology']): Promise<PublishLinkResponse> {
        return this.dataSource.transaction(async (manager) => {
            const canvasRepo = this.getCanvasRepository(manager)
            const canvas = (await canvasRepo.findOne({ where: { id: canvasId } })) as CanvasMinimal | null
            if (!canvas) {
                throw new Error('Canvas not found for publication link')
            }

            const versionGroupId = (canvas as any).versionGroupId as string | undefined
            if (!versionGroupId) {
                throw new Error('Canvas is missing version group information')
            }
            const context = await this.resolveSpaceContext(canvasId, versionGroupId, manager)

            const repo = this.getRepository(manager)
            let link = await repo.findOne({
                where: {
                    technology,
                    versionGroupId,
                    targetType: 'group',
                    unikId: context.unikId
                }
            })

            if (link) {
                link.spaceId = context.spaceId
                link.targetCanvasId = canvasId
                link.isPublic = true
                return repo.save(link)
            }

            const baseSlug = await this.generateUniqueBaseSlug(manager)
            link = repo.create({
                unikId: context.unikId,
                spaceId: context.spaceId,
                technology,
                versionGroupId,
                targetCanvasId: canvasId,
                targetVersionUuid: null,
                targetType: 'group',
                baseSlug,
                customSlug: null,
                isPublic: true
            })

            return repo.save(link)
        })
    }

    /**
     * Create a version-specific publication link
     * @param versionGroupId Version group ID
     * @param versionUuid Specific version UUID to publish
     * @param technology Publication technology
     * @returns Created publication link
     */
    async createVersionLink(
        versionGroupId: string,
        versionUuid: string,
        technology: PublishCanvas['technology']
    ): Promise<PublishLinkResponse> {
        return this.dataSource.transaction(async (manager) => {
            const canvasRepo = this.getCanvasRepository(manager)

            // Find canvas by versionUuid
            const canvas = (await canvasRepo.findOne({
                where: { versionUuid }
            })) as CanvasMinimal | null

            if (!canvas) {
                throw new Error('Version not found')
            }

            // Verify version belongs to the group
            const canvasVersionGroupId = (canvas as any).versionGroupId as string | undefined
            if (canvasVersionGroupId !== versionGroupId) {
                throw new Error('Version does not belong to the specified group')
            }

            const context = await this.resolveSpaceContext(canvas.id, versionGroupId, manager)
            const baseSlug = await this.generateUniqueBaseSlug(manager)

            const repo = this.getRepository(manager)
            const link = repo.create({
                unikId: context.unikId,
                spaceId: context.spaceId,
                technology,
                versionGroupId,
                targetCanvasId: canvas.id,
                targetVersionUuid: versionUuid,
                targetType: 'version',
                baseSlug,
                customSlug: null,
                isPublic: true
            })

            return repo.save(link)
        })
    }
}

export { sanitizeCustomSlug }
