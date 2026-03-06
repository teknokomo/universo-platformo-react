import type { Knex } from 'knex'
import { KnexClient, generateTableName } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'

/**
 * Options for querying objects
 */
interface QueryOptions {
    /** Include soft-deleted records */
    includeDeleted?: boolean
    /** Only return soft-deleted records (trash view) */
    onlyDeleted?: boolean
}

type MetahubObjectKind = 'catalog' | 'set' | 'enumeration' | 'hub' | 'document'

/**
 * Service to manage Metahub Objects (Catalogs) stored in isolated schemas (_mhb_objects).
 * Replaces the old TypeORM Catalog entity logic.
 */
export class MetahubObjectsService {
    constructor(private schemaService: MetahubSchemaService) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    private buildSortOrderLockKey(schemaName: string, kind: MetahubObjectKind): string {
        return `mhb-objects-sort:${schemaName}:${kind}`
    }

    /**
     * Serialize sort-order mutations per object kind.
     * Uses transaction-scoped advisory lock, auto-released on commit/rollback.
     */
    private async acquireSortOrderLock(trx: Knex.Transaction, schemaName: string, kind: MetahubObjectKind): Promise<void> {
        const lockKey = this.buildSortOrderLockKey(schemaName, kind)
        await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [lockKey])
    }

    private async getNextSortOrder(schemaName: string, kind: MetahubObjectKind, trx?: Knex.Transaction): Promise<number> {
        const runner = trx ?? this.knex
        const result = await runner
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .select(this.knex.raw("COALESCE(MAX((config->>'sortOrder')::int), 0) as max_sort_order"))
            .first<{ max_sort_order: number | string | null }>()

        const maxSortOrder = Number(result?.max_sort_order ?? 0)
        if (!Number.isFinite(maxSortOrder)) {
            return 1
        }

        return maxSortOrder + 1
    }

    /**
     * Applies soft delete filter to a query.
     * Checks both platform-level (_upl_deleted) and metahub-level (_mhb_deleted) soft delete.
     */
    private applySoftDeleteFilter(query: any, options: QueryOptions = {}) {
        const { includeDeleted = false, onlyDeleted = false } = options
        if (onlyDeleted) {
            // Show records deleted at metahub level (but not platform level)
            return query.where('_mhb_deleted', true).where('_upl_deleted', false)
        }
        if (!includeDeleted) {
            // Exclude records deleted at either level
            return query.where('_mhb_deleted', false).where('_upl_deleted', false)
        }
        return query
    }

    async findAll(metahubId: string, userId?: string, options: QueryOptions = {}): Promise<any[]> {
        return this.findAllByKind(metahubId, 'catalog', userId, options)
    }

    async findAllByKind(metahubId: string, kind: MetahubObjectKind, userId?: string, options: QueryOptions = {}): Promise<any[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const query = this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind })
            .select('*')
            .orderByRaw(`COALESCE((config->>'sortOrder')::int, 0) ASC`)
            .orderBy('_upl_created_at', 'asc')
            .orderBy('id', 'asc')
        return this.applySoftDeleteFilter(query, options)
    }

    async countByKind(metahubId: string, kind: MetahubObjectKind, userId?: string, options: QueryOptions = {}): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const query = this.knex.withSchema(schemaName).from('_mhb_objects').where({ kind })
        const filteredQuery = this.applySoftDeleteFilter(query, options)
        const result = await filteredQuery.count('* as count').first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    async findById(metahubId: string, id: string, userId?: string, options: QueryOptions = {}) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const query = this.knex.withSchema(schemaName).from('_mhb_objects').where({ id })
        return this.applySoftDeleteFilter(query, options).first()
    }

    async findByCodename(metahubId: string, codename: string, userId?: string, options: QueryOptions = {}) {
        return this.findByCodenameAndKind(metahubId, codename, 'catalog', userId, options)
    }

    async findByCodenameAndKind(metahubId: string, codename: string, kind: MetahubObjectKind, userId?: string, options: QueryOptions = {}) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const query = this.knex.withSchema(schemaName).from('_mhb_objects').where({ codename, kind })
        return this.applySoftDeleteFilter(query, options).first()
    }

    async createObject(
        metahubId: string,
        kind: MetahubObjectKind,
        input: {
            codename: string
            codenameLocalized?: any
            name: any // VLC
            description?: any // VLC
            config?: any
            createdBy?: string | null
        },
        userId?: string,
        trx?: Knex.Transaction
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const createWithRunner = async (runner: Knex.Transaction) => {
            await this.acquireSortOrderLock(runner, schemaName, kind)

            const config =
                input.config && typeof input.config === 'object'
                    ? { ...(input.config as Record<string, unknown>) }
                    : ({} as Record<string, unknown>)

            const hasExplicitSortOrder = typeof config.sortOrder === 'number' && Number.isFinite(config.sortOrder)
            if (!hasExplicitSortOrder) {
                config.sortOrder = await this.getNextSortOrder(schemaName, kind, runner)
            }

            const [created] = await runner
                .withSchema(schemaName)
                .into('_mhb_objects')
                .insert({
                    kind,
                    codename: input.codename,
                    table_name: null,
                    presentation: {
                        codename: input.codenameLocalized ?? null,
                        name: input.name,
                        description: input.description
                    },
                    config,
                    _upl_created_at: new Date(),
                    _upl_created_by: input.createdBy ?? null,
                    _upl_updated_at: new Date(),
                    _upl_updated_by: input.createdBy ?? null
                })
                .returning('*')

            const createdId = created.id as string

            // Physical runtime tables are only required for catalog/document kinds.
            if (kind === 'catalog' || kind === 'document') {
                const tableName = generateTableName(created.id, kind)
                await runner.withSchema(schemaName).from('_mhb_objects').where({ id: created.id }).update({ table_name: tableName })
            }

            await this.ensureSequentialSortOrderByKind(schemaName, kind, runner, input.createdBy ?? userId)

            const normalized = await runner.withSchema(schemaName).from('_mhb_objects').where({ id: createdId }).first()
            if (!normalized) {
                throw new Error(`${kind} not found`)
            }
            return normalized
        }

        if (trx) {
            return createWithRunner(trx)
        }

        return this.knex.transaction(async (innerTrx) => createWithRunner(innerTrx))
    }

    /**
     * Creates a new Catalog object.
     * Maps inputs to _mhb_objects structure and generates table_name from entity UUID.
     */
    async createCatalog(
        metahubId: string,
        input: {
            codename: string
            codenameLocalized?: any
            name: any // VLC
            description?: any // VLC
            config?: any
            createdBy?: string | null
        },
        userId?: string,
        trx?: Knex.Transaction
    ) {
        return this.createObject(metahubId, 'catalog', input, userId, trx)
    }

    async createEnumeration(
        metahubId: string,
        input: {
            codename: string
            codenameLocalized?: any
            name: any // VLC
            description?: any // VLC
            config?: any
            createdBy?: string | null
        },
        userId?: string,
        trx?: Knex.Transaction
    ) {
        return this.createObject(metahubId, 'enumeration', input, userId, trx)
    }

    async createSet(
        metahubId: string,
        input: {
            codename: string
            codenameLocalized?: any
            name: any
            description?: any
            config?: any
            createdBy?: string | null
        },
        userId?: string,
        trx?: Knex.Transaction
    ) {
        return this.createObject(metahubId, 'set', input, userId, trx)
    }

    async updateObject(
        metahubId: string,
        id: string,
        kind: MetahubObjectKind,
        input: {
            codename?: string
            codenameLocalized?: any
            name?: any
            description?: any
            config?: any
            updatedBy?: string | null
            expectedVersion?: number
        },
        userId?: string
    ) {
        const existing = await this.findById(metahubId, id, userId)
        if (!existing || existing.kind !== kind) {
            throw new Error(`${kind} not found`)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: input.updatedBy ?? null
        }

        if (input.codename !== undefined) updateData.codename = input.codename
        if (input.name !== undefined || input.description !== undefined || input.codenameLocalized !== undefined) {
            updateData.presentation = {
                ...existing.presentation,
                ...(input.codenameLocalized !== undefined ? { codename: input.codenameLocalized } : {}),
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {})
            }
        }
        if (input.config !== undefined) {
            updateData.config = {
                ...existing.config,
                ...input.config
            }
        }

        if (input.expectedVersion !== undefined) {
            return updateWithVersionCheck({
                knex: this.knex,
                schemaName,
                tableName: '_mhb_objects',
                entityId: id,
                entityType: kind,
                expectedVersion: input.expectedVersion,
                updateData
            })
        }

        return incrementVersion(this.knex, schemaName, '_mhb_objects', id, updateData)
    }

    async updateCatalog(
        metahubId: string,
        id: string,
        input: {
            codename?: string
            codenameLocalized?: any
            name?: any
            description?: any
            config?: any
            updatedBy?: string | null
            expectedVersion?: number
        },
        userId?: string
    ) {
        return this.updateObject(metahubId, id, 'catalog', input, userId)
    }

    async updateEnumeration(
        metahubId: string,
        id: string,
        input: {
            codename?: string
            codenameLocalized?: any
            name?: any
            description?: any
            config?: any
            updatedBy?: string | null
            expectedVersion?: number
        },
        userId?: string
    ) {
        return this.updateObject(metahubId, id, 'enumeration', input, userId)
    }

    async updateSet(
        metahubId: string,
        id: string,
        input: {
            codename?: string
            codenameLocalized?: any
            name?: any
            description?: any
            config?: any
            updatedBy?: string | null
            expectedVersion?: number
        },
        userId?: string
    ) {
        return this.updateObject(metahubId, id, 'set', input, userId)
    }

    /**
     * Soft deletes a catalog object at the metahub level.
     * Sets _mhb_deleted=true, _mhb_deleted_at=now(), _mhb_deleted_by=userId
     */
    async delete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id })
            .update({
                _mhb_deleted: true,
                _mhb_deleted_at: new Date(),
                _mhb_deleted_by: userId ?? null,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null
            })
    }

    /**
     * Restores a soft-deleted catalog object (metahub level).
     */
    async restore(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id })
            .update({
                _mhb_deleted: false,
                _mhb_deleted_at: null,
                _mhb_deleted_by: null,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null
            })
    }

    /**
     * Permanently deletes a catalog object (use with caution).
     */
    async permanentDelete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex.withSchema(schemaName).from('_mhb_objects').where({ id }).delete()
    }

    /**
     * Returns all soft-deleted objects (trash view).
     */
    async findDeleted(metahubId: string, userId?: string) {
        return this.findAll(metahubId, userId, { onlyDeleted: true })
    }

    async findDeletedByKind(metahubId: string, kind: MetahubObjectKind, userId?: string) {
        return this.findAllByKind(metahubId, kind, userId, { onlyDeleted: true })
    }

    private async ensureSequentialSortOrderByKind(
        schemaName: string,
        kind: MetahubObjectKind,
        trx: Knex.Transaction,
        updatedBy?: string
    ): Promise<void> {
        const rows = await trx
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .orderByRaw(`COALESCE((config->>'sortOrder')::int, 0) ASC`)
            .orderBy('_upl_created_at', 'asc')
            .orderBy('id', 'asc')
            .select('id', 'config')

        const now = new Date()
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index]
            const nextSortOrder = index + 1
            const currentSortOrder = Number((row.config as Record<string, unknown> | undefined)?.sortOrder ?? 0)
            if (currentSortOrder === nextSortOrder) {
                continue
            }

            const nextConfig = row.config && typeof row.config === 'object' ? { ...(row.config as Record<string, unknown>) } : {}
            nextConfig.sortOrder = nextSortOrder

            await trx
                .withSchema(schemaName)
                .from('_mhb_objects')
                .where({ id: row.id, kind })
                .update({
                    config: nextConfig,
                    _upl_updated_at: now,
                    _upl_updated_by: updatedBy ?? null,
                    _upl_version: this.knex.raw('_upl_version + 1')
                })
        }
    }

    async reorderByKind(metahubId: string, kind: MetahubObjectKind, objectId: string, newSortOrder: number, userId?: string): Promise<any> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            await this.acquireSortOrderLock(trx, schemaName, kind)
            await this.ensureSequentialSortOrderByKind(schemaName, kind, trx, userId)

            const rows = await trx
                .withSchema(schemaName)
                .from('_mhb_objects')
                .where({ kind })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .orderByRaw(`COALESCE((config->>'sortOrder')::int, 0) ASC`)
                .orderBy('_upl_created_at', 'asc')
                .orderBy('id', 'asc')
                .select('*')

            const currentIndex = rows.findIndex((row) => row.id === objectId)
            if (currentIndex === -1) {
                throw new Error(`${kind} not found`)
            }

            const targetIndex = Math.max(0, Math.min(rows.length - 1, newSortOrder - 1))
            const reordered = [...rows]
            const [moved] = reordered.splice(currentIndex, 1)
            reordered.splice(targetIndex, 0, moved)

            const now = new Date()
            for (let index = 0; index < reordered.length; index += 1) {
                const row = reordered[index]
                const nextSortOrder = index + 1
                const currentSortOrder = Number((row.config as Record<string, unknown> | undefined)?.sortOrder ?? 0)
                if (currentSortOrder === nextSortOrder) {
                    continue
                }

                const nextConfig = row.config && typeof row.config === 'object' ? { ...(row.config as Record<string, unknown>) } : {}
                nextConfig.sortOrder = nextSortOrder

                await trx
                    .withSchema(schemaName)
                    .from('_mhb_objects')
                    .where({ id: row.id, kind })
                    .update({
                        config: nextConfig,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: this.knex.raw('_upl_version + 1')
                    })
            }

            await this.ensureSequentialSortOrderByKind(schemaName, kind, trx, userId)

            const updated = await trx
                .withSchema(schemaName)
                .from('_mhb_objects')
                .where({ id: objectId, kind })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .first()

            if (!updated) {
                throw new Error(`${kind} not found`)
            }

            return updated
        })
    }
}
