import type { DataSource, EntityManager } from 'typeorm'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubBranch } from '../../../database/entities/MetahubBranch'
import { MetahubUser } from '../../../database/entities/MetahubUser'
import { AuthUser } from '@universo/auth-backend'
import { Profile } from '@universo/profile-backend'
import { KnexClient, getDDLServices, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { escapeLikeWildcards } from '../../../utils'
import type { VersionedLocalizedContent } from '@universo/types'

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
    constructor(private dataSource: DataSource, private manager?: EntityManager) { }

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

    async listBranches(metahubId: string, options: BranchListOptions = {}) {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const {
            limit = 100,
            offset = 0,
            sortBy = 'updated',
            sortOrder = 'desc',
            search
        } = options

        const qb = branchRepo
            .createQueryBuilder('b')
            .where('b.metahub_id = :metahubId', { metahubId })

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
                        ? 'b.created_at'
                        : 'b.updated_at'

        qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
        qb.skip(offset).take(limit)

        const [branches, total] = await qb.getManyAndCount()
        return { branches, total }
    }

    async listAllBranches(metahubId: string, options: BranchListAllOptions = {}) {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const { sortBy = 'updated', sortOrder = 'desc', search } = options

        const qb = branchRepo
            .createQueryBuilder('b')
            .where('b.metahub_id = :metahubId', { metahubId })

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
                        ? 'b.created_at'
                        : 'b.updated_at'

        qb.orderBy(orderColumn, sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')

        const branches = await qb.getMany()
        return { branches, total: branches.length }
    }

    async getBranchById(metahubId: string, branchId: string): Promise<MetahubBranch | null> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        return branchRepo.findOne({ where: { id: branchId, metahub_id: metahubId } })
    }

    async findByCodename(metahubId: string, codename: string): Promise<MetahubBranch | null> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        return branchRepo.findOne({ where: { metahub_id: metahubId, codename } })
    }

    async getDefaultBranchId(metahubId: string): Promise<string | null> {
        const metahubRepo = this.repoManager.getRepository(Metahub)
        const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
        return metahub?.defaultBranchId ?? null
    }

    async getUserActiveBranchId(metahubId: string, userId: string): Promise<string | null> {
        const memberRepo = this.repoManager.getRepository(MetahubUser)
        const member = await memberRepo.findOne({ where: { metahub_id: metahubId, user_id: userId } })
        return member?.active_branch_id ?? null
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
        const schemaService = new MetahubSchemaService(this.dataSource)

        const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
        if (!metahub) {
            throw new Error('Metahub not found')
        }
        if (metahub.defaultBranchId) {
            throw new Error('Default branch is already configured')
        }

        const branchNumber = 1
        const schemaName = this.buildSchemaName(metahubId, branchNumber)

        await schemaService.initializeSchema(schemaName)

        const branch = branchRepo.create({
            metahub_id: metahubId,
            name,
            description: description ?? null,
            codename,
            branch_number: branchNumber,
            schema_name: schemaName,
            created_by: createdBy ?? null
        })

        try {
            const saved = await branchRepo.save(branch)
            await metahubRepo.update(metahubId, { defaultBranchId: saved.id, lastBranchNumber: branchNumber })
            return saved
        } catch (error) {
            const { generator } = getDDLServices()
            await generator.dropSchema(schemaName).catch(() => undefined)
            throw error
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
        const schemaService = new MetahubSchemaService(this.dataSource)

        const lockKey = uuidToLockKey(metahubId)
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

                const sourceBranch = sourceBranchId
                    ? await branchRepo.findOne({ where: { id: sourceBranchId, metahub_id: metahubId } })
                    : null
                if (sourceBranchId && !sourceBranch) {
                    throw new Error('Source branch not found')
                }

                const nextNumber = (metahub.lastBranchNumber ?? 0) + 1
                schemaName = this.buildSchemaName(metahubId, nextNumber)

                await schemaService.initializeSchema(schemaName)
                if (sourceBranch) {
                    await this.cloneSchemaData(sourceBranch.schema_name, schemaName)
                }

                const branch = branchRepo.create({
                    metahub_id: metahubId,
                    source_branch_id: sourceBranch?.id ?? null,
                    name,
                    description: description ?? null,
                    codename,
                    branch_number: nextNumber,
                    schema_name: schemaName,
                    created_by: createdBy ?? null
                })

                savedBranch = await branchRepo.save(branch)
                metahub.lastBranchNumber = nextNumber
                await metahubRepo.save(metahub)
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
        }
    ) {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const branch = await branchRepo.findOne({ where: { id: branchId, metahub_id: metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }

        if (data.codename !== undefined) {
            branch.codename = data.codename
        }
        if (data.name !== undefined) {
            branch.name = data.name as any
        }
        if (data.description !== undefined) {
            branch.description = data.description as any
        }

        return branchRepo.save(branch)
    }

    async activateBranch(metahubId: string, branchId: string, userId: string) {
        const memberRepo = this.repoManager.getRepository(MetahubUser)
        const branchRepo = this.repoManager.getRepository(MetahubBranch)

        const branch = await branchRepo.findOne({ where: { id: branchId, metahub_id: metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }

        const membership = await memberRepo.findOne({ where: { metahub_id: metahubId, user_id: userId } })
        if (!membership) {
            throw new Error('Membership not found')
        }

        membership.active_branch_id = branch.id
        await memberRepo.save(membership)

        return branch
    }

    async setDefaultBranch(metahubId: string, branchId: string): Promise<MetahubBranch> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const metahubRepo = this.repoManager.getRepository(Metahub)

        const branch = await branchRepo.findOne({ where: { id: branchId, metahub_id: metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }

        await metahubRepo.update(metahubId, { defaultBranchId: branchId })
        return branch
    }

    async getBranchLineage(metahubId: string, branchId: string): Promise<{
        sourceBranchId: string | null
        sourceChain: Array<{
            id: string
            codename?: string | null
            name?: VersionedLocalizedContent<string> | null
            isMissing?: boolean
        }>
    }> {
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const branch = await branchRepo.findOne({ where: { id: branchId, metahub_id: metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }

        const chain: Array<{
            id: string
            codename?: string | null
            name?: VersionedLocalizedContent<string> | null
            isMissing?: boolean
        }> = []

        let currentId = branch.source_branch_id ?? null
        const visited = new Set<string>()

        while (currentId) {
            if (visited.has(currentId)) break
            visited.add(currentId)

            const source = await branchRepo.findOne({ where: { id: currentId, metahub_id: metahubId } })
            if (!source) {
                chain.push({ id: currentId, isMissing: true })
                break
            }

            chain.push({
                id: source.id,
                codename: source.codename,
                name: source.name
            })

            currentId = source.source_branch_id ?? null
        }

        return {
            sourceBranchId: branch.source_branch_id ?? null,
            sourceChain: chain
        }
    }

    async getBlockingUsers(metahubId: string, branchId: string, excludeUserId?: string): Promise<BlockingBranchUser[]> {
        const memberRepo = this.repoManager.getRepository(MetahubUser)
        const authUserRepo = this.repoManager.getRepository(AuthUser)
        const profileRepo = this.repoManager.getRepository(Profile)

        const members = await memberRepo.find({ where: { metahub_id: metahubId, active_branch_id: branchId } })
        const filtered = excludeUserId ? members.filter((m) => m.user_id !== excludeUserId) : members

        if (filtered.length === 0) return []

        const userIds = filtered.map((m) => m.user_id)
        const [users, profiles] = await Promise.all([
            authUserRepo.find({ where: userIds.map((id) => ({ id })) }),
            profileRepo.find({ where: userIds.map((id) => ({ user_id: id })) })
        ])

        const emailMap = new Map(users.map((u) => [u.id, u.email ?? null]))
        const nicknameMap = new Map(profiles.map((p) => [p.user_id, p.nickname]))

        return filtered.map((m) => ({
            id: m.id,
            userId: m.user_id,
            email: emailMap.get(m.user_id) ?? null,
            nickname: nicknameMap.get(m.user_id) ?? null,
            role: m.role
        }))
    }

    async deleteBranch(params: {
        metahubId: string
        branchId: string
        requesterId: string
    }): Promise<void> {
        const { metahubId, branchId, requesterId } = params
        const branchRepo = this.repoManager.getRepository(MetahubBranch)
        const metahubRepo = this.repoManager.getRepository(Metahub)
        const memberRepo = this.repoManager.getRepository(MetahubUser)

        const metahub = await metahubRepo.findOne({ where: { id: metahubId } })
        if (!metahub) {
            throw new Error('Metahub not found')
        }
        if (metahub.defaultBranchId === branchId) {
            throw new Error('Default branch cannot be deleted')
        }

        const branch = await branchRepo.findOne({ where: { id: branchId, metahub_id: metahubId } })
        if (!branch) {
            throw new Error('Branch not found')
        }

        const blockingUsers = await this.getBlockingUsers(metahubId, branchId, requesterId)
        if (blockingUsers.length > 0) {
            throw new Error('Branch is active for other users')
        }

        // Clear active branch for requester if it matches this branch
        await memberRepo.update(
            { metahub_id: metahubId, user_id: requesterId, active_branch_id: branchId },
            { active_branch_id: null }
        )

        const { generator } = getDDLServices()
        await generator.dropSchema(branch.schema_name)

        await branchRepo.delete({ id: branchId })
        MetahubSchemaService.clearCache(metahubId)
    }

    private async cloneSchemaData(sourceSchema: string, targetSchema: string): Promise<void> {
        await this.knex.transaction(async (trx) => {
            await trx.raw(`
                INSERT INTO "${targetSchema}"._mhb_objects
                    (id, kind, codename, table_name, presentation, config, created_at, updated_at)
                SELECT id, kind, codename, table_name, presentation, config, created_at, updated_at
                FROM "${sourceSchema}"._mhb_objects
            `)
            await trx.raw(`
                INSERT INTO "${targetSchema}"._mhb_attributes
                    (id, object_id, codename, data_type, presentation, validation_rules, ui_config, sort_order, is_required, target_object_id, created_at, updated_at)
                SELECT id, object_id, codename, data_type, presentation, validation_rules, ui_config, sort_order, is_required, target_object_id, created_at, updated_at
                FROM "${sourceSchema}"._mhb_attributes
            `)
            await trx.raw(`
                INSERT INTO "${targetSchema}"._mhb_elements
                    (id, object_id, data, sort_order, owner_id, created_at, updated_at)
                SELECT id, object_id, data, sort_order, owner_id, created_at, updated_at
                FROM "${sourceSchema}"._mhb_elements
            `)
        })
    }
}
