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

type MetahubObjectKind = 'catalog' | 'enumeration' | 'hub' | 'document'

/**
 * Service to manage Metahub Objects (Catalogs) stored in isolated schemas (_mhb_objects).
 * Replaces the old TypeORM Catalog entity logic.
 */
export class MetahubObjectsService {
    constructor(private schemaService: MetahubSchemaService) {}

    private get knex() {
        return KnexClient.getInstance()
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
        const query = this.knex.withSchema(schemaName).from('_mhb_objects').where({ kind }).select('*').orderBy('_upl_created_at', 'desc')
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
            name: any // VLC
            description?: any // VLC
            config?: any
            createdBy?: string | null
        },
        userId?: string
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            const config =
                input.config && typeof input.config === 'object'
                    ? { ...(input.config as Record<string, unknown>) }
                    : ({} as Record<string, unknown>)

            const hasExplicitSortOrder = typeof config.sortOrder === 'number' && Number.isFinite(config.sortOrder)
            if (!hasExplicitSortOrder) {
                config.sortOrder = await this.getNextSortOrder(schemaName, kind, trx)
            }

            const [created] = await trx
                .withSchema(schemaName)
                .into('_mhb_objects')
                .insert({
                    kind,
                    codename: input.codename,
                    table_name: null,
                    presentation: {
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

            // Only catalogs/documents/hubs may need physical runtime tables.
            if (kind !== 'enumeration') {
                const tableName = generateTableName(created.id, kind)
                const [updated] = await trx
                    .withSchema(schemaName)
                    .from('_mhb_objects')
                    .where({ id: created.id })
                    .update({ table_name: tableName })
                    .returning('*')
                return updated
            }

            return created
        })
    }

    /**
     * Creates a new Catalog object.
     * Maps inputs to _mhb_objects structure and generates table_name from entity UUID.
     */
    async createCatalog(
        metahubId: string,
        input: {
            codename: string
            name: any // VLC
            description?: any // VLC
            config?: any
            createdBy?: string | null
        },
        userId?: string
    ) {
        return this.createObject(metahubId, 'catalog', input, userId)
    }

    async createEnumeration(
        metahubId: string,
        input: {
            codename: string
            name: any // VLC
            description?: any // VLC
            config?: any
            createdBy?: string | null
        },
        userId?: string
    ) {
        return this.createObject(metahubId, 'enumeration', input, userId)
    }

    async updateObject(
        metahubId: string,
        id: string,
        kind: MetahubObjectKind,
        input: {
            codename?: string
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
        if (input.name !== undefined || input.description !== undefined) {
            updateData.presentation = {
                ...existing.presentation,
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
}
