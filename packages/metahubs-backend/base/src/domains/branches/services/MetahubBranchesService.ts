import type { DataSource, EntityManager } from 'typeorm'
import type { VersionedLocalizedContent, MetahubTemplateManifest } from '@universo/types'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubBranch } from '../../../database/entities/MetahubBranch'
import { MetahubUser } from '../../../database/entities/MetahubUser'
import { TemplateVersion } from '../../../database/entities/TemplateVersion'
import { validateTemplateManifest } from '../../templates/services/TemplateManifestValidator'
import { AuthUser } from '@universo/auth-backend'
import { Profile } from '@universo/profile-backend'
import { KnexClient, getDDLServices, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { CURRENT_STRUCTURE_VERSION } from '../../metahubs/services/structureVersions'
import { escapeLikeWildcards } from '../../../utils'
import { OptimisticLockError } from '@universo/utils'

export interface BranchListOptions {
    limit?: number
    offset?: number
    sortBy?: 'name' | 'codename' | 'created' | 'updated'
    sortOrder?: 'asc' | 'desc'
    search?: string
}

export interface BranchListAllOptions {
    sortBy?: 'name' | 'codename' | 'created' | 'updated'
    sortOrder?: 'asc' | 'desc'
    search?: string
}

export interface BlockingBranchUser {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: string
}

export class MetahubBranchesService {
    constructor(private dataSource: DataSource, private manager?: EntityManager) {}

    private get repoManager(): EntityManager {
        return this.manager ?? this.dataSource.manager
    }

    private get knex() {
        return KnexClient.getInstance()
    }

    private buildSchemaName(metahubId: string, branchNumber: number): string {
        const cleanId = metahubId.replace(/-/g, '')
        return `mhb_${cleanId}_b${branchNumber}`
    }

    private quoteIdent(identifier: string): string {
        return `"${identifier.replace(/"/g, '""')}"`
    }

    private assertSafeSchemaName(schemaName: string): void {
        if (!/^[a-z_][a-z0-9_]*$/.test(schemaName)) {
            throw new Error(`Unsafe schema name: ${schemaName}`)
        }
    }

    /**
     * Loads the template manifest for a metahub entity with runtime validation.
     * Returns undefined if no template is assigned (initializeSchema will use default).
     */
    private async loadManifestForMetahub(metahub: Metahub): Promise<MetahubTemplateManifest | undefined> {
        if (!metahub.templateVersionId) {
            return undefined
        }
        const versionRepo = this.repoManager.getRepository(TemplateVersion)
        const version = await versionRepo.findOneBy({ id: metahub.templateVersionId })
        if (version?.manifestJson) {
            try {
                return validateTemplateManifest(version.manifestJson)
            } catch (error) {
                console.warn(`[MetahubBranchesService] Invalid manifest in template version ${version.id}, falling back to default:`, error)
                return undefined
            }
        }
        return undefined
    }

    private async resolveTemplateVersionInfo(
        templateVersionId: string | null | undefined,
        manager: EntityManager = this.repoManager
    ): Promise<{ templateVersionId: string | null; templateVersionLabel: string | null }> {
        if (!templateVersionId) {
            return { templateVersionId: null, templateVersionLabel: null }
        }

        const versionRepo = manager.getRepository(TemplateVersion)
        const version = await versionRepo.findOneBy({ id: templateVersionId })
        return {
            templateVersionId,
            templateVersionLabel: version?.versionLabel ?? null
        }
    }

    async listBranches(metahubId: string, options: BranchListOptions = {}) {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = options

        const qb = branchRepo.createQueryBuilder('b').where('b.metahub_id = :metahubId', { metahubId })

        if (search) {
            const escapedSearch = escapeLikeWildcards(search.toLowerCase())
            qb.andWhere(
                `(
                    COALESCE(b.name::text, '') ILIKE :search
                    OR COALESCE(b.description::text, '') ILIKE :search
                    OR COALESCE(b.codename, '') ILIKE :search
                )`,
                { search: `%${escapedSearch}%` }
            )
        }

        const orderColumn =
            sortBy === 'name'
                ? "COALESCE(b.name->'locales'->>(b.name->>'_primary'), b.name->'locales'->>'en', '')"
                : sortBy === 'codename'
                ? 'b.codename'
                : sortBy === 'created'
                ? 'b._upl_created_at'
                : 'b._upl_updated_at'

        qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
        qb.skip(offset).take(limit)

        const [branches, total] = await qb.getManyAndCount()
        return { branches, total }
    }

    async listAllBranches(metahubId: string, options: BranchListAllOptions = {}) {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const { sortBy = 'updated', sortOrder = 'desc', search } = options

        const qb = branchRepo.createQueryBuilder('b').where('b.metahub_id = :metahubId', { metahubId })

        if (search) {
            const escapedSearch = escapeLikeWildcards(search.toLowerCase())
            qb.andWhere(
                `(
                    COALESCE(b.name::text, '') ILIKE :search
                    OR COALESCE(b.description::text, '') ILIKE :search
                    OR COALESCE(b.codename, '') ILIKE :search
                )`,
                { search: `%${escapedSearch}%` }
            )
        }

        const orderColumn =
            sortBy === 'name'
                ? "COALESCE(b.name->'locales'->>(b.name->>'_primary'), b.name->'locales'->>'en', '')"
                : sortBy === 'codename'
                ? 'b.codename'
                : sortBy === 'created'
                ? 'b._upl_created_at'
                : 'b._upl_updated_at'

        qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')

        const branches = await qb.getMany()
        return { branches, total: branches.length }
    }

    async getBranchById(metahubId: string, branchId: string): Promise<MetahubBranch | null> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        return branchRepo.findOne({ where: { id: branchId, metahubId } })
    }

    async findByCodename(metahubId: string, codename: string): Promise<MetahubBranch | null> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        return branchRepo
            .createQueryBuilder('b')
            .where('b.metahub_id = :metahubId', { metahubId })
            .andWhere('b.codename = :codename', { codename })
            .andWhere('b._upl_deleted = false')
            .andWhere('b._mhb_deleted = false')
            .getOne()
    }

    async getDefaultBranchId(metahubId: string): Promise<string | null> {
        const metahubRepo = this.repoManager.getRepository(Metahub)
        const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
        return metahub?.defaultBranchId ?? null
    }

    async getUserActiveBranchId(metahubId: string, userId: string): Promise<string | null> {
        const memberRepo = this.repoManager.getRepository(MetahubUser)
        const member = await memberRepo.findOne({ where: { metahubId, userId } })
        return member?.activeBranchId ?? null
    }

    async createInitialBranch(params: {
        metahubId: string
        name: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        codename?: string
        createdBy?: string | null
    }): Promise<MetahubBranch> {
        const { metahubId, name, description, codename = 'main', createdBy } = params
        const metahubRepo = this.repoManager.getRepository(Metahub)
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const schemaService = new MetahubSchemaService(this.dataSource, undefined, this.repoManager)
        const lockKey = uuidToLockKey(`${metahubId}:initial-branch`)
        const acquired = await acquireAdvisoryLock(this.knex, lockKey)
        if (!acquired) {
            throw new Error('Initial branch creation in progress')
        }

        const branchNumber = 1
        const schemaName = this.buildSchemaName(metahubId, branchNumber)
        try {
            const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
            if (!metahub) {
                throw new Error('Metahub not found')
            }
            if (metahub.defaultBranchId) {
                throw new Error('Default branch is already configured')
            }

            // Load template manifest from the metahub's assigned template (if any)
            const manifest = await this.loadManifestForMetahub(metahub)
            const templateVersionInfo = await this.resolveTemplateVersionInfo(metahub.templateVersionId ?? null)
            await schemaService.initializeSchema(schemaName, manifest)

            const structureVersion = manifest?.minStructureVersion ?? CURRENT_STRUCTURE_VERSION

            const savedBranch = await this.repoManager.transaction(async (manager) => {
                const txMetahubRepo = manager.getRepository(Metahub)
                const txBranchRepo = manager.getRepository(MetahubBranch)

                const lockedMetahub = await txMetahubRepo
                    .createQueryBuilder('m')
                    .setLock('pessimistic_write')
                    .where('m.id = :metahubId', { metahubId })
                    .getOne()

                if (!lockedMetahub) {
                    throw new Error('Metahub not found')
                }
                if (lockedMetahub.defaultBranchId) {
                    throw new Error('Default branch is already configured')
                }

                const branch = txBranchRepo.create({
                    metahubId,
                    name,
                    description: description ?? null,
                    codename,
                    branchNumber,
                    schemaName,
                    structureVersion,
                    lastTemplateVersionId: templateVersionInfo.templateVersionId,
                    lastTemplateVersionLabel: templateVersionInfo.templateVersionLabel,
                    lastTemplateSyncedAt: templateVersionInfo.templateVersionId ? new Date() : null,
                    _uplCreatedBy: createdBy ?? null,
                    _uplUpdatedBy: createdBy ?? null
                })

                const saved = await txBranchRepo.save(branch)
                // Use raw update to avoid incrementing _upl_version
                await txMetahubRepo
                    .createQueryBuilder()
                    .update(Metahub)
                    .set({ defaultBranchId: saved.id, lastBranchNumber: branchNumber })
                    .where('id = :id', { id: metahubId })
                    .execute()

                return saved
            })

            return savedBranch
        } catch (error) {
            const existingBranch = await branchRepo.findOne({
                where: { metahubId, schemaName }
            })
            if (!existingBranch) {
                const { generator } = getDDLServices()
                await generator.dropSchema(schemaName).catch(() => undefined)
            }
            throw error
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }
    }

    async createBranch(params: {
        metahubId: string
        sourceBranchId?: string | null
        codename: string
        name: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        createdBy?: string | null
    }): Promise<MetahubBranch> {
        const { metahubId, sourceBranchId, codename, name, description, createdBy } = params
        const schemaService = new MetahubSchemaService(this.dataSource, undefined, this.repoManager)

        // Use a dedicated lock namespace for branch creation.
        // This avoids contention with ensureSchema() read paths that use metahub-wide lock keys.
        const lockKey = uuidToLockKey(`${metahubId}:branch-create`)
        const acquired = await acquireAdvisoryLock(this.knex, lockKey)
        if (!acquired) {
            throw new Error('Branch creation in progress')
        }

        let schemaName: string | null = null
        let savedBranch: MetahubBranch | null = null
        try {
            await this.repoManager.transaction(async (manager) => {
                const branchRepo = manager.getRepository(MetahubBranch)
                const metahubRepo = manager.getRepository(Metahub)

                const metahub = await metahubRepo
                    .createQueryBuilder('m')
                    .setLock('pessimistic_write')
                    .where('m.id = :metahubId', { metahubId })
                    .getOne()

                if (!metahub) {
                    throw new Error('Metahub not found')
                }

                const sourceBranch = sourceBranchId ? await branchRepo.findOne({ where: { id: sourceBranchId, metahubId } }) : null
                if (sourceBranchId && !sourceBranch) {
                    throw new Error('Source branch not found')
                }

                const maxBranchNumberRow = await branchRepo
                    .createQueryBuilder('b')
                    .select('COALESCE(MAX(b.branch_number), 0)', 'maxBranchNumber')
                    .where('b.metahub_id = :metahubId', { metahubId })
                    .getRawOne<{ maxBranchNumber: string | number }>()

                const maxBranchNumber = Number(maxBranchNumberRow?.maxBranchNumber ?? 0)
                const baseBranchNumber = Math.max(metahub.lastBranchNumber ?? 0, Number.isFinite(maxBranchNumber) ? maxBranchNumber : 0)
                const nextNumber = baseBranchNumber + 1
                schemaName = this.buildSchemaName(metahubId, nextNumber)

                let branchStructureVersion: number
                let templateVersionSyncId: string | null = null
                let templateVersionSyncLabel: string | null = null
                let templateSyncedAt: Date | null = null

                if (sourceBranch) {
                    const { cloner } = getDDLServices()
                    await cloner.clone({
                        sourceSchema: sourceBranch.schemaName,
                        targetSchema: schemaName,
                        dropTargetSchemaIfExists: true,
                        createTargetSchema: true,
                        copyData: true
                    })
                    branchStructureVersion = sourceBranch.structureVersion ?? CURRENT_STRUCTURE_VERSION
                    templateVersionSyncId = sourceBranch.lastTemplateVersionId ?? null
                    templateVersionSyncLabel = sourceBranch.lastTemplateVersionLabel ?? null
                    templateSyncedAt = sourceBranch.lastTemplateSyncedAt ?? null
                } else {
                    // Load template manifest for new branch from scratch
                    const manifest = await this.loadManifestForMetahub(metahub)
                    await schemaService.initializeSchema(schemaName, manifest)
                    branchStructureVersion = manifest?.minStructureVersion ?? CURRENT_STRUCTURE_VERSION
                    const templateVersionInfo = await this.resolveTemplateVersionInfo(metahub.templateVersionId ?? null, manager)
                    templateVersionSyncId = templateVersionInfo.templateVersionId
                    templateVersionSyncLabel = templateVersionInfo.templateVersionLabel
                    templateSyncedAt = templateVersionInfo.templateVersionId ? new Date() : null
                }

                const branch = branchRepo.create({
                    metahubId,
                    sourceBranchId: sourceBranch?.id ?? null,
                    name,
                    description: description ?? null,
                    codename,
                    branchNumber: nextNumber,
                    schemaName,
                    structureVersion: branchStructureVersion,
                    lastTemplateVersionId: templateVersionSyncId,
                    lastTemplateVersionLabel: templateVersionSyncLabel,
                    lastTemplateSyncedAt: templateSyncedAt,
                    _uplCreatedBy: createdBy ?? null,
                    _uplUpdatedBy: createdBy ?? null
                })

                savedBranch = await branchRepo.save(branch)
                // Use raw update to avoid incrementing _upl_version on metahub
                await metahubRepo
                    .createQueryBuilder()
                    .update(Metahub)
                    .set({ lastBranchNumber: nextNumber })
                    .where('id = :id', { id: metahubId })
                    .execute()
            })

            if (!savedBranch) {
                throw new Error('Branch creation failed')
            }
            return savedBranch
        } catch (error) {
            if (schemaName) {
                const { generator } = getDDLServices()
                await generator.dropSchema(schemaName).catch(() => undefined)
            }
            throw error
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }
    }

    async updateBranch(
        metahubId: string,
        branchId: string,
        data: {
            codename?: string
            name?: VersionedLocalizedContent<string>
            description?: VersionedLocalizedContent<string> | null
            expectedVersion?: number
            updatedBy?: string | null
        }
    ) {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const branch = await branchRepo.findOne({ where: { id: branchId, metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }

        // Optimistic locking check
        if (data.expectedVersion !== undefined) {
            const currentVersion = branch._uplVersion || 1
            if (currentVersion !== data.expectedVersion) {
                throw new OptimisticLockError({
                    entityId: branchId,
                    entityType: 'branch',
                    expectedVersion: data.expectedVersion,
                    actualVersion: currentVersion,
                    updatedAt: branch._uplUpdatedAt,
                    updatedBy: branch._uplUpdatedBy ?? null
                })
            }
        }

        if (data.codename !== undefined) {
            branch.codename = data.codename
        }
        if (data.name !== undefined) {
            branch.name = data.name
        }
        if (data.description !== undefined) {
            branch.description = data.description
        }
        if (data.updatedBy !== undefined) {
            branch._uplUpdatedBy = data.updatedBy ?? null
        }

        return branchRepo.save(branch)
    }

    async activateBranch(metahubId: string, branchId: string, userId: string) {
        const memberRepo = this.repoManager.getRepository(MetahubUser)
        const branchRepo = this.repoManager.getRepository(MetahubBranch)

        const branch = await branchRepo.findOne({ where: { id: branchId, metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }

        const membership = await memberRepo.findOne({ where: { metahubId, userId } })
        if (!membership) {
            throw new Error('Membership not found')
        }

        membership.activeBranchId = branch.id
        await memberRepo.save(membership)
        MetahubSchemaService.setUserBranchCache(metahubId, userId, branch.id)

        return branch
    }

    async setDefaultBranch(metahubId: string, branchId: string): Promise<MetahubBranch> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const metahubRepo = this.repoManager.getRepository(Metahub)

        const branch = await branchRepo.findOne({ where: { id: branchId, metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }

        await metahubRepo.update(metahubId, { defaultBranchId: branchId })
        MetahubSchemaService.clearUserBranchCache(metahubId)
        return branch
    }

    async getBranchLineage(
        metahubId: string,
        branchId: string
    ): Promise<{
        sourceBranchId: string | null
        sourceChain: Array<{
            id: string
            codename?: string | null
            name?: VersionedLocalizedContent<string> | null
            isMissing?: boolean
        }>
    }> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const branch = await branchRepo.findOne({ where: { id: branchId, metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }

        const chain: Array<{
            id: string
            codename?: string | null
            name?: VersionedLocalizedContent<string> | null
            isMissing?: boolean
        }> = []

        let currentId = branch.sourceBranchId ?? null
        const visited = new Set<string>()

        while (currentId) {
            if (visited.has(currentId)) break
            visited.add(currentId)

            const source = await branchRepo.findOne({ where: { id: currentId, metahubId } })
            if (!source) {
                chain.push({ id: currentId, isMissing: true })
                break
            }

            chain.push({
                id: source.id,
                codename: source.codename,
                name: source.name
            })

            currentId = source.sourceBranchId ?? null
        }

        return {
            sourceBranchId: branch.sourceBranchId ?? null,
            sourceChain: chain
        }
    }

    async getBlockingUsers(metahubId: string, branchId: string, excludeUserId?: string): Promise<BlockingBranchUser[]> {
        const memberRepo = this.repoManager.getRepository(MetahubUser)
        const authUserRepo = this.repoManager.getRepository(AuthUser)
        const profileRepo = this.repoManager.getRepository(Profile)

        const members = await memberRepo.find({ where: { metahubId, activeBranchId: branchId } })
        const filtered = excludeUserId ? members.filter((m) => m.userId !== excludeUserId) : members

        if (filtered.length === 0) return []

        const userIds = filtered.map((m) => m.userId)
        const [users, profiles] = await Promise.all([
            authUserRepo.find({ where: userIds.map((id) => ({ id })) }),
            profileRepo.find({ where: userIds.map((id) => ({ user_id: id })) })
        ])

        const emailMap = new Map(users.map((u) => [u.id, u.email ?? null]))
        const nicknameMap = new Map(profiles.map((p) => [p.user_id, p.nickname]))

        return filtered.map((m) => ({
            id: m.id,
            userId: m.userId,
            email: emailMap.get(m.userId) ?? null,
            nickname: nicknameMap.get(m.userId) ?? null,
            role: m.role
        }))
    }

    async deleteBranch(params: { metahubId: string; branchId: string; requesterId: string }): Promise<void> {
        const { metahubId, branchId, requesterId } = params
        const lockKey = uuidToLockKey(`${metahubId}:${branchId}:branch-delete`)
        const acquired = await acquireAdvisoryLock(this.knex, lockKey)
        if (!acquired) {
            throw new Error('Branch deletion in progress')
        }

        try {
            await this.repoManager.transaction(async (manager) => {
                const branchRepo = manager.getRepository(MetahubBranch)
                const metahubRepo = manager.getRepository(Metahub)
                const memberRepo = manager.getRepository(MetahubUser)

                const metahub = await metahubRepo
                    .createQueryBuilder('m')
                    .setLock('pessimistic_write')
                    .where('m.id = :metahubId', { metahubId })
                    .getOne()
                if (!metahub) {
                    throw new Error('Metahub not found')
                }
                if (metahub.defaultBranchId === branchId) {
                    throw new Error('Default branch cannot be deleted')
                }

                const branch = await branchRepo
                    .createQueryBuilder('b')
                    .setLock('pessimistic_write')
                    .where('b.id = :branchId AND b.metahub_id = :metahubId', { branchId, metahubId })
                    .getOne()
                if (!branch) {
                    throw new Error('Branch not found')
                }

                const blockingUsersCount = await memberRepo
                    .createQueryBuilder('mu')
                    .where('mu.metahub_id = :metahubId', { metahubId })
                    .andWhere('mu.active_branch_id = :branchId', { branchId })
                    .andWhere('mu.user_id <> :requesterId', { requesterId })
                    .getCount()
                if (blockingUsersCount > 0) {
                    throw new Error('Branch is active for other users')
                }

                // Clear active branch for requester if it matches this branch.
                await memberRepo.update({ metahubId, userId: requesterId, activeBranchId: branchId }, { activeBranchId: null })

                // Drop schema and delete branch row in the same DB transaction to avoid divergent states.
                this.assertSafeSchemaName(branch.schemaName)
                await manager.query(`DROP SCHEMA IF EXISTS ${this.quoteIdent(branch.schemaName)} CASCADE`)
                await branchRepo.delete({ id: branchId, metahubId })
            })

            MetahubSchemaService.clearCache(metahubId)
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }
    }
}
