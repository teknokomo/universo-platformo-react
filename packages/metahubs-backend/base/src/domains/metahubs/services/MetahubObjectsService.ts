import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import { SHARED_OBJECT_KINDS, isEnabledComponentConfig, type ComponentManifest } from '@universo/types'
import { generateTableName } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { codenamePrimaryTextSql, ensureCodenameValue } from '../../shared/codename'
import { MetahubNotFoundError } from '../../shared/domainErrors'
import { SharedEntityOverridesService } from '../../shared/services/SharedEntityOverridesService'

/**
 * Options for querying objects
 */
interface QueryOptions {
    /** Include soft-deleted records */
    includeDeleted?: boolean
    /** Only return soft-deleted records (trash view) */
    onlyDeleted?: boolean
    /** Include internal virtual shared containers. */
    includeVirtualContainers?: boolean
}

const BUILTIN_METAHUB_OBJECT_KINDS = ['catalog', 'set', 'enumeration', 'hub', 'document'] as const

type BuiltinMetahubObjectKind = (typeof BUILTIN_METAHUB_OBJECT_KINDS)[number]
export type MetahubObjectKind = BuiltinMetahubObjectKind | (string & {})

const isBuiltinMetahubObjectKind = (kind: string): kind is BuiltinMetahubObjectKind =>
    BUILTIN_METAHUB_OBJECT_KINDS.includes(kind as BuiltinMetahubObjectKind)

const stripUndefinedEntries = (value: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Record<string, unknown>

const normalizeKinds = (kinds: readonly string[]): string[] => [
    ...new Set(kinds.map((kind) => String(kind).trim()).filter((kind) => kind.length > 0))
]

export type MetahubObjectRow = {
    id: string
    kind: MetahubObjectKind | string
    codename: Record<string, unknown>
    table_name?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polymorphic JSONB: shape varies by object kind
    presentation?: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polymorphic JSONB: shape varies by object kind
    config?: any
    _upl_version?: number
    _upl_created_at?: unknown
    _upl_updated_at?: unknown
    _mhb_deleted_at?: unknown
    _mhb_deleted_by?: unknown
} & Record<string, unknown>

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

/**
 * Service to manage Metahub Objects (Catalogs) stored in isolated schemas (_mhb_objects).
 */
export class MetahubObjectsService {
    constructor(private exec: DbExecutor, private schemaService: MetahubSchemaService) {}

    private normalizeObjectRow(row: Record<string, unknown>): MetahubObjectRow {
        const presentation =
            row.presentation && typeof row.presentation === 'object' ? { ...(row.presentation as Record<string, unknown>) } : {}

        return {
            ...(row as MetahubObjectRow),
            codename: ensureCodenameValue(row.codename),
            table_name: typeof row.table_name === 'string' ? row.table_name : undefined,
            presentation
        }
    }

    private buildSoftDeleteSql(options: QueryOptions = {}, alias = ''): string {
        const prefix = alias ? `${alias}.` : ''
        const { includeDeleted = false, onlyDeleted = false } = options
        if (onlyDeleted) {
            return ` AND ${prefix}_mhb_deleted = TRUE AND ${prefix}_upl_deleted = FALSE`
        }
        if (!includeDeleted) {
            return ` AND ${prefix}_mhb_deleted = FALSE AND ${prefix}_upl_deleted = FALSE`
        }
        return ''
    }

    private buildVirtualContainerSql(options: QueryOptions = {}, alias = ''): string {
        if (options.includeVirtualContainers) {
            return ''
        }

        const prefix = alias ? `${alias}.` : ''
        return ` AND COALESCE((${prefix}config->>'isVirtualContainer')::boolean, false) = false`
    }

    private buildSortOrderLockKey(schemaName: string, kind: string): string {
        return `mhb-objects-sort:${schemaName}:${kind}`
    }

    /**
     * Serialize sort-order mutations per object kind.
     * Uses transaction-scoped advisory lock, auto-released on commit/rollback.
     */
    private async acquireSortOrderLock(db: SqlQueryable, schemaName: string, kind: string): Promise<void> {
        const lockKey = this.buildSortOrderLockKey(schemaName, kind)
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey])
    }

    private async getNextSortOrder(schemaName: string, kind: string, db?: SqlQueryable): Promise<number> {
        const runner = db ?? this.exec
        const qt = qSchemaTable(schemaName, '_mhb_objects')

        const result = await queryOne<{ max_sort_order: number | string | null }>(
            runner,
            `SELECT COALESCE(MAX((config->>'sortOrder')::int), 0) AS max_sort_order
             FROM ${qt}
             WHERE kind = $1 AND ${ACTIVE}`,
            [kind]
        )

        const maxSortOrder = Number(result?.max_sort_order ?? 0)
        if (!Number.isFinite(maxSortOrder)) {
            return 1
        }

        return maxSortOrder + 1
    }

    private async resolveGeneratedTableName(schemaName: string, kind: string, objectId: string, db: SqlQueryable): Promise<string | null> {
        if (kind === 'catalog' || kind === 'document') {
            return generateTableName(objectId, kind)
        }

        if (isBuiltinMetahubObjectKind(kind)) {
            return null
        }

        const qt = qSchemaTable(schemaName, '_mhb_entity_type_definitions')
        const row = await queryOne<{ components: unknown }>(
            db,
            `SELECT components FROM ${qt} WHERE kind_key = $1 AND _upl_deleted = false AND _mhb_deleted = false LIMIT 1`,
            [kind]
        )
        const components = row?.components as ComponentManifest | undefined
        if (!components || !isEnabledComponentConfig(components.physicalTable)) {
            return null
        }

        return generateTableName(objectId, kind, components.physicalTable.prefix)
    }

    async findAll(metahubId: string, userId?: string, options: QueryOptions = {}): Promise<MetahubObjectRow[]> {
        return this.findAllByKind(metahubId, 'catalog', userId, options)
    }

    async findAllByKinds(
        metahubId: string,
        kinds: readonly string[],
        userId?: string,
        options: QueryOptions = {}
    ): Promise<MetahubObjectRow[]> {
        const normalizedKinds = normalizeKinds(kinds)
        if (normalizedKinds.length === 0) {
            return []
        }

        if (normalizedKinds.length === 1) {
            return this.findAllByKind(metahubId, normalizedKinds[0], userId, options)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const softDelete = this.buildSoftDeleteSql(options)
        const virtualContainer = this.buildVirtualContainerSql(options)

        const rows = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt}
               WHERE kind = ANY($1::text[])${softDelete}${virtualContainer}
             ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC,
                      _upl_created_at ASC,
                      id ASC`,
            [normalizedKinds]
        )
        return rows.map((row) => this.normalizeObjectRow(row))
    }

    async findAllByKind(metahubId: string, kind: string, userId?: string, options: QueryOptions = {}): Promise<MetahubObjectRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const softDelete = this.buildSoftDeleteSql(options)
        const virtualContainer = this.buildVirtualContainerSql(options)

        const rows = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt}
               WHERE kind = $1${softDelete}${virtualContainer}
             ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC,
                      _upl_created_at ASC,
                      id ASC`,
            [kind]
        )
        return rows.map((row) => this.normalizeObjectRow(row))
    }

    async countByKind(metahubId: string, kind: string, userId?: string, options: QueryOptions = {}): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const softDelete = this.buildSoftDeleteSql(options)
        const virtualContainer = this.buildVirtualContainerSql(options)

        const result = await queryOne<{ count: string }>(
            this.exec,
            `SELECT COUNT(*) AS count FROM ${qt} WHERE kind = $1${softDelete}${virtualContainer}`,
            [kind]
        )
        return result ? parseInt(result.count, 10) : 0
    }

    async findById(
        metahubId: string,
        id: string,
        userId?: string,
        options: QueryOptions = {},
        db?: SqlQueryable
    ): Promise<MetahubObjectRow | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const softDelete = this.buildSoftDeleteSql(options)
        const runner = db ?? this.exec

        const row = await queryOne<Record<string, unknown>>(runner, `SELECT * FROM ${qt} WHERE id = $1${softDelete} LIMIT 1`, [id])
        return row ? this.normalizeObjectRow(row) : null
    }

    async findByCodename(
        metahubId: string,
        codename: string,
        userId?: string,
        options: QueryOptions = {}
    ): Promise<MetahubObjectRow | null> {
        return this.findByCodenameAndKind(metahubId, codename, 'catalog', userId, options)
    }

    async findByCodenameInKinds(
        metahubId: string,
        codename: string,
        kinds: readonly string[],
        userId?: string,
        options: QueryOptions = {},
        db?: SqlQueryable
    ): Promise<MetahubObjectRow | null> {
        const normalizedKinds = normalizeKinds(kinds)
        if (normalizedKinds.length === 0) {
            return null
        }

        if (normalizedKinds.length === 1) {
            return this.findByCodenameAndKind(metahubId, codename, normalizedKinds[0], userId, options, db)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const softDelete = this.buildSoftDeleteSql(options)
        const virtualContainer = this.buildVirtualContainerSql(options)
        const runner = db ?? this.exec

        const row = await queryOne<Record<string, unknown>>(
            runner,
            `SELECT * FROM ${qt}
             WHERE ${codenamePrimaryTextSql('codename')} = $1
               AND kind = ANY($2::text[])${softDelete}${virtualContainer}
             ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC,
                      _upl_created_at ASC,
                      id ASC
             LIMIT 1`,
            [codename, normalizedKinds]
        )
        return row ? this.normalizeObjectRow(row) : null
    }

    async findByCodenameAndKind(
        metahubId: string,
        codename: string,
        kind: string,
        userId?: string,
        options: QueryOptions = {},
        db?: SqlQueryable
    ): Promise<MetahubObjectRow | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const softDelete = this.buildSoftDeleteSql(options)
        const virtualContainer = this.buildVirtualContainerSql(options)
        const runner = db ?? this.exec

        const row = await queryOne<Record<string, unknown>>(
            runner,
            `SELECT * FROM ${qt} WHERE ${codenamePrimaryTextSql('codename')} = $1 AND kind = $2${softDelete}${virtualContainer} LIMIT 1`,
            [codename, kind]
        )
        return row ? this.normalizeObjectRow(row) : null
    }

    async createObject(
        metahubId: string,
        kind: string,
        input: {
            id?: string
            codename: unknown
            name: any // VLC
            description?: any // VLC
            config?: any
            createdBy?: string | null
        },
        userId?: string,
        db?: SqlQueryable
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')

        const createWithRunner = async (tx: SqlQueryable) => {
            await this.acquireSortOrderLock(tx, schemaName, kind)

            const config =
                input.config && typeof input.config === 'object'
                    ? { ...(input.config as Record<string, unknown>) }
                    : ({} as Record<string, unknown>)

            const hasExplicitSortOrder = typeof config.sortOrder === 'number' && Number.isFinite(config.sortOrder)
            if (!hasExplicitSortOrder) {
                config.sortOrder = await this.getNextSortOrder(schemaName, kind, tx)
            }

            const now = new Date()
            const codename = ensureCodenameValue(input.codename)
            const presentation = JSON.stringify({
                name: input.name,
                description: input.description
            })
            const configJson = JSON.stringify(config)
            const explicitId = typeof input.id === 'string' && input.id.trim().length > 0 ? input.id.trim() : null

            const created = await queryOneOrThrow<MetahubObjectRow>(
                tx,
                explicitId
                    ? `INSERT INTO ${qt}
                        (id, kind, codename, table_name, presentation, config,
                         _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                     VALUES ($1, $2, $3::jsonb, NULL, $4::jsonb, $5::jsonb, $6, $7, $6, $7)
                     RETURNING *`
                    : `INSERT INTO ${qt}
                        (kind, codename, table_name, presentation, config,
                         _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                     VALUES ($1, $2::jsonb, NULL, $3::jsonb, $4::jsonb, $5, $6, $5, $6)
                     RETURNING *`,
                explicitId
                    ? [explicitId, kind, JSON.stringify(codename), presentation, configJson, now, input.createdBy ?? null]
                    : [kind, JSON.stringify(codename), presentation, configJson, now, input.createdBy ?? null]
            )

            const createdId = created.id

            const tableName = await this.resolveGeneratedTableName(schemaName, kind, created.id, tx)
            if (tableName) {
                await tx.query(`UPDATE ${qt} SET table_name = $1 WHERE id = $2`, [tableName, created.id])
            }

            await this.ensureSequentialSortOrderByKind(schemaName, kind, tx, input.createdBy ?? userId)

            const normalized = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1 LIMIT 1`, [createdId])
            if (!normalized) {
                throw new MetahubNotFoundError(kind, createdId)
            }
            return this.normalizeObjectRow(normalized)
        }

        if (db) return createWithRunner(db)
        return this.exec.transaction(async (tx: SqlQueryable) => createWithRunner(tx))
    }

    /**
     * Creates a new Catalog object.
     * Maps inputs to _mhb_objects structure and generates table_name from entity UUID.
     */
    async createCatalog(
        metahubId: string,
        input: {
            codename: unknown
            name: any // VLC
            description?: any // VLC
            config?: any
            createdBy?: string | null
        },
        userId?: string,
        db?: SqlQueryable
    ) {
        return this.createObject(metahubId, 'catalog', input, userId, db)
    }

    async createEnumeration(
        metahubId: string,
        input: {
            codename: unknown
            name: any // VLC
            description?: any // VLC
            config?: any
            createdBy?: string | null
        },
        userId?: string,
        db?: SqlQueryable
    ) {
        return this.createObject(metahubId, 'enumeration', input, userId, db)
    }

    async createSet(
        metahubId: string,
        input: {
            codename: unknown
            name: any
            description?: any
            config?: any
            createdBy?: string | null
        },
        userId?: string,
        db?: SqlQueryable
    ) {
        return this.createObject(metahubId, 'set', input, userId, db)
    }

    async updateObject(
        metahubId: string,
        id: string,
        kind: string,
        input: {
            codename?: unknown
            name?: any
            description?: any
            config?: any
            updatedBy?: string | null
            expectedVersion?: number
        },
        userId?: string,
        db?: SqlQueryable
    ) {
        const runner = db ?? this.exec
        const existing = await this.findById(metahubId, id, userId, {}, runner)
        if (!existing || existing.kind !== kind) {
            throw new MetahubNotFoundError(kind, id)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: input.updatedBy ?? null
        }

        if (input.codename !== undefined) {
            updateData.codename = JSON.stringify(ensureCodenameValue(input.codename))
        }
        if (input.name !== undefined || input.description !== undefined) {
            updateData.presentation = JSON.stringify(
                stripUndefinedEntries({
                    ...(existing.presentation && typeof existing.presentation === 'object'
                        ? (existing.presentation as Record<string, unknown>)
                        : {}),
                    ...(input.name !== undefined ? { name: input.name } : {}),
                    ...(input.description !== undefined ? { description: input.description } : {})
                })
            )
        }
        if (input.config !== undefined) {
            updateData.config = JSON.stringify(
                stripUndefinedEntries({
                    ...(existing.config && typeof existing.config === 'object' ? (existing.config as Record<string, unknown>) : {}),
                    ...(input.config as Record<string, unknown>)
                })
            )
        }

        if (input.expectedVersion !== undefined) {
            return updateWithVersionCheck({
                executor: runner,
                schemaName,
                tableName: '_mhb_objects',
                entityId: id,
                entityType: isBuiltinMetahubObjectKind(kind) ? kind : 'entity',
                expectedVersion: input.expectedVersion,
                updateData
            })
        }

        return incrementVersion(runner, schemaName, '_mhb_objects', id, updateData)
    }

    async updateCatalog(
        metahubId: string,
        id: string,
        input: {
            codename?: unknown
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
            codename?: unknown
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
            codename?: unknown
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
    async delete(metahubId: string, id: string, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const now = new Date()
        const runner = db ?? this.exec

        const existing = await queryOne<{ id: string; kind: string }>(runner, `SELECT id, kind FROM ${qt} WHERE id = $1 LIMIT 1`, [id])

        const rows = await runner.query<{ id: string }>(
            `UPDATE ${qt}
             SET _mhb_deleted = TRUE,
                 _mhb_deleted_at = $1,
                 _mhb_deleted_by = $2,
                 _upl_updated_at = $1,
                 _upl_updated_by = $2
             WHERE id = $3 AND _upl_deleted = false AND _mhb_deleted = false
             RETURNING id`,
            [now, userId ?? null, id]
        )

        if (rows.length < 1) {
            throw new MetahubNotFoundError('Object', id)
        }

        if (
            existing?.kind === 'catalog' ||
            existing?.kind === 'set' ||
            existing?.kind === 'enumeration' ||
            existing?.kind === SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL ||
            existing?.kind === SHARED_OBJECT_KINDS.SHARED_SET_POOL ||
            existing?.kind === SHARED_OBJECT_KINDS.SHARED_ENUM_POOL
        ) {
            const sharedOverridesService = new SharedEntityOverridesService(this.exec, this.schemaService)
            await sharedOverridesService.cleanupForDeletedTargetObject(metahubId, id, userId, runner)
        }
    }

    /**
     * Restores a soft-deleted catalog object (metahub level).
     */
    async restore(metahubId: string, id: string, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const runner = db ?? this.exec

        const rows = await runner.query<{ id: string }>(
            `UPDATE ${qt}
             SET _mhb_deleted = FALSE,
                 _mhb_deleted_at = NULL,
                 _mhb_deleted_by = NULL,
                 _upl_updated_at = $1,
                 _upl_updated_by = $2
             WHERE id = $3 AND _upl_deleted = false AND _mhb_deleted = true
             RETURNING id`,
            [new Date(), userId ?? null, id]
        )

        if (rows.length < 1) {
            throw new MetahubNotFoundError('Object', id)
        }
    }

    /**
     * Permanently deletes a catalog object (use with caution).
     */
    async permanentDelete(metahubId: string, id: string, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const runner = db ?? this.exec

        const existing = await queryOne<{ id: string; kind: string }>(runner, `SELECT id, kind FROM ${qt} WHERE id = $1 LIMIT 1`, [id])

        const rows = await runner.query<{ id: string }>(
            `DELETE FROM ${qt}
             WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = true
             RETURNING id`,
            [id]
        )

        if (rows.length < 1) {
            throw new MetahubNotFoundError('Object', id)
        }

        if (
            existing?.kind === 'catalog' ||
            existing?.kind === 'set' ||
            existing?.kind === 'enumeration' ||
            existing?.kind === SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL ||
            existing?.kind === SHARED_OBJECT_KINDS.SHARED_SET_POOL ||
            existing?.kind === SHARED_OBJECT_KINDS.SHARED_ENUM_POOL
        ) {
            const sharedOverridesService = new SharedEntityOverridesService(this.exec, this.schemaService)
            await sharedOverridesService.purgeDeletedTargetOverrides(metahubId, id, userId, runner)
        }
    }

    /**
     * Returns all soft-deleted objects (trash view).
     */
    async findDeleted(metahubId: string, userId?: string) {
        return this.findAll(metahubId, userId, { onlyDeleted: true })
    }

    async findDeletedByKinds(metahubId: string, kinds: readonly string[], userId?: string) {
        return this.findAllByKinds(metahubId, kinds, userId, { onlyDeleted: true })
    }

    async findDeletedByKind(metahubId: string, kind: MetahubObjectKind, userId?: string) {
        return this.findAllByKind(metahubId, kind, userId, { onlyDeleted: true })
    }

    private async ensureSequentialSortOrderByKind(schemaName: string, kind: string, db: SqlQueryable, updatedBy?: string): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_objects')

        const rows = await queryMany<{ id: string; config: Record<string, unknown> | null }>(
            db,
            `SELECT id, config FROM ${qt}
             WHERE kind = $1 AND ${ACTIVE}
             ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC,
                      _upl_created_at ASC,
                      id ASC`,
            [kind]
        )

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

            await db.query(
                `UPDATE ${qt}
                 SET config = $1::jsonb,
                     _upl_updated_at = $2,
                     _upl_updated_by = $3,
                     _upl_version = _upl_version + 1
                 WHERE id = $4 AND kind = $5`,
                [JSON.stringify(nextConfig), now, updatedBy ?? null, row.id, kind]
            )
        }
    }

    async reorderByKind(metahubId: string, kind: string, objectId: string, newSortOrder: number, userId?: string): Promise<any> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireSortOrderLock(tx, schemaName, kind)
            await this.ensureSequentialSortOrderByKind(schemaName, kind, tx, userId)

            const rows = await queryMany<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt}
                 WHERE kind = $1 AND ${ACTIVE}
                 ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC,
                          _upl_created_at ASC,
                          id ASC`,
                [kind]
            )

            const currentIndex = rows.findIndex((row) => row.id === objectId)
            if (currentIndex === -1) {
                throw new MetahubNotFoundError(kind, objectId)
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

                await tx.query(
                    `UPDATE ${qt}
                     SET config = $1::jsonb,
                         _upl_updated_at = $2,
                         _upl_updated_by = $3,
                         _upl_version = _upl_version + 1
                     WHERE id = $4 AND kind = $5`,
                    [JSON.stringify(nextConfig), now, userId ?? null, row.id, kind]
                )
            }

            await this.ensureSequentialSortOrderByKind(schemaName, kind, tx, userId)

            const updated = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND kind = $2 AND ${ACTIVE} LIMIT 1`,
                [objectId, kind]
            )

            if (!updated) {
                throw new MetahubNotFoundError(kind, objectId)
            }

            return updated ? this.normalizeObjectRow(updated) : null
        })
    }
}
