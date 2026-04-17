import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import { MetahubSchemaService } from './MetahubSchemaService'
import { escapeLikeWildcards } from '../../../utils'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { codenamePrimaryTextSql, ensureCodenameValue } from '../../shared/codename'
import { MetahubNotFoundError } from '../../shared/domainErrors'

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
const DEFAULT_HUB_KIND = 'hub'

const normalizeKinds = (kinds?: readonly string[] | null): string[] => {
    if (!Array.isArray(kinds) || kinds.length === 0) {
        return [DEFAULT_HUB_KIND]
    }

    const normalizedKinds = kinds.map((kind) => String(kind).trim()).filter((kind) => kind.length > 0)
    return normalizedKinds.length > 0 ? [...new Set(normalizedKinds)] : [DEFAULT_HUB_KIND]
}

/**
 * MetahubTreeEntitiesService - CRUD operations for Hubs stored in isolated schemas.
 *
 * Hubs are stored in the unified `_mhb_objects` table with `kind: 'hub'`.
 * This follows the same pattern as other metahub entity-owned object kinds.
 *
 * Each Metahub has its own schema (mhb_<uuid>) with the _mhb_objects table.
 */
export class MetahubTreeEntitiesService {
    constructor(private exec: DbExecutor, private schemaService: MetahubSchemaService) {}

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

    /**
     * Maps a raw _mhb_objects row to Hub response format.
     */
    private mapHubFromObject(row: Record<string, unknown>): Record<string, unknown> {
        const config = (row.config as Record<string, unknown>) ?? {}
        return {
            id: row.id,
            kind: row.kind,
            codename: ensureCodenameValue(row.codename),
            name: (row.presentation as Record<string, unknown>)?.name ?? {},
            description: (row.presentation as Record<string, unknown>)?.description ?? null,
            sort_order: config.sortOrder ?? 0,
            parent_hub_id: typeof config.parentTreeEntityId === 'string' ? config.parentTreeEntityId : null,
            _upl_version: row._upl_version,
            created_at: row._upl_created_at,
            updated_at: row._upl_updated_at
        }
    }

    /**
     * Find all hubs for a metahub.
     */
    async findAll(
        metahubId: string,
        options: {
            limit?: number
            offset?: number
            sortBy?: string
            sortOrder?: 'asc' | 'desc'
            search?: string
            kinds?: readonly string[]
        } = {},
        userId?: string
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const normalizedKinds = normalizeKinds(options.kinds)

        const conditions: string[] = [normalizedKinds.length === 1 ? `kind = $1` : `kind = ANY($1::text[])`, ACTIVE]
        const params: unknown[] = [normalizedKinds.length === 1 ? normalizedKinds[0] : normalizedKinds]
        let paramIdx = 2

        if (options.search) {
            const escapedSearch = `%${escapeLikeWildcards(options.search)}%`
            conditions.push(
                `(presentation->>'name' ILIKE $${paramIdx} OR presentation->>'description' ILIKE $${paramIdx} OR ${codenamePrimaryTextSql(
                    'codename'
                )} ILIKE $${paramIdx})`
            )
            params.push(escapedSearch)
            paramIdx++
        }

        const whereClause = conditions.join(' AND ')

        // Sorting — direction is validated to prevent SQL injection
        const dir = options.sortOrder === 'desc' ? 'DESC' : 'ASC'
        let orderBy: string
        switch (options.sortBy) {
            case 'name':
                orderBy = `presentation->'name'->>'en' ${dir}`
                break
            case 'codename':
                orderBy = `${codenamePrimaryTextSql('codename')} ${dir}`
                break
            case 'sortOrder':
                orderBy = `COALESCE((config->>'sortOrder')::int, 0) ${dir}`
                break
            case 'created':
                orderBy = `_upl_created_at ${dir}`
                break
            case 'updated':
                orderBy = `_upl_updated_at ${dir}`
                break
            default:
                orderBy = `_upl_created_at ${dir}`
                break
        }

        let paginationClause = ''
        const queryParams = [...params]
        if (options.limit) {
            paginationClause += ` LIMIT $${paramIdx}`
            queryParams.push(options.limit)
            paramIdx++
        }
        if (options.offset) {
            paginationClause += ` OFFSET $${paramIdx}`
            queryParams.push(options.offset)
            paramIdx++
        }

        const countParams = [...params]

        const [rows, countResult] = await Promise.all([
            queryMany<Record<string, unknown>>(
                this.exec,
                `SELECT * FROM ${qt} WHERE ${whereClause} ORDER BY ${orderBy}${paginationClause}`,
                queryParams
            ),
            queryOne<{ total: string }>(this.exec, `SELECT COUNT(*) AS total FROM ${qt} WHERE ${whereClause}`, countParams)
        ])

        const total = countResult ? parseInt(countResult.total, 10) : 0
        const items = rows.map((row) => this.mapHubFromObject(row))

        return { items, total }
    }

    /**
     * Find a hub by ID.
     */
    async findById(metahubId: string, treeEntityId: string, userId?: string) {
        return this.findByIdWithKinds(metahubId, treeEntityId, userId)
    }

    async findByIdWithKinds(metahubId: string, treeEntityId: string, userId?: string, kinds?: readonly string[]) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const normalizedKinds = normalizeKinds(kinds)

        const row = await queryOne<Record<string, unknown>>(
            this.exec,
            normalizedKinds.length === 1
                ? `SELECT * FROM ${qt} WHERE id = $1 AND kind = $2 AND ${ACTIVE} LIMIT 1`
                : `SELECT * FROM ${qt} WHERE id = $1 AND kind = ANY($2::text[]) AND ${ACTIVE} LIMIT 1`,
            [treeEntityId, normalizedKinds.length === 1 ? normalizedKinds[0] : normalizedKinds]
        )

        return row ? this.mapHubFromObject(row) : null
    }

    /**
     * Find a hub by codename.
     */
    async findByCodename(metahubId: string, codename: string, userId?: string) {
        return this.findByCodenameWithKinds(metahubId, codename, userId)
    }

    async findByCodenameWithKinds(metahubId: string, codename: string, userId?: string, kinds?: readonly string[]) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const normalizedKinds = normalizeKinds(kinds)

        const row = await queryOne<Record<string, unknown>>(
            this.exec,
            normalizedKinds.length === 1
                ? `SELECT * FROM ${qt} WHERE ${codenamePrimaryTextSql('codename')} = $1 AND kind = $2 AND ${ACTIVE} LIMIT 1`
                : `SELECT * FROM ${qt} WHERE ${codenamePrimaryTextSql('codename')} = $1 AND kind = ANY($2::text[]) AND ${ACTIVE} LIMIT 1`,
            [codename, normalizedKinds.length === 1 ? normalizedKinds[0] : normalizedKinds]
        )

        return row ? this.mapHubFromObject(row) : null
    }

    /**
     * Find multiple hubs by IDs.
     */
    async findByIds(metahubId: string, treeEntityIds: string[], userId?: string): Promise<Record<string, unknown>[]> {
        return this.findByIdsWithKinds(metahubId, treeEntityIds, userId)
    }

    async findByIdsWithKinds(
        metahubId: string,
        treeEntityIds: string[],
        userId?: string,
        kinds?: readonly string[]
    ): Promise<Record<string, unknown>[]> {
        if (treeEntityIds.length === 0) return []

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const normalizedKinds = normalizeKinds(kinds)

        const rows = await queryMany<Record<string, unknown>>(
            this.exec,
            normalizedKinds.length === 1
                ? `SELECT * FROM ${qt} WHERE kind = $1 AND ${ACTIVE} AND id = ANY($2::uuid[])`
                : `SELECT * FROM ${qt} WHERE kind = ANY($1::text[]) AND ${ACTIVE} AND id = ANY($2::uuid[])`,
            [normalizedKinds.length === 1 ? normalizedKinds[0] : normalizedKinds, treeEntityIds]
        )

        return rows.map((row) => this.mapHubFromObject(row))
    }

    /**
     * Create a new hub.
     */
    async create(
        metahubId: string,
        input: {
            codename: unknown
            name: Record<string, unknown>
            description?: Record<string, unknown>
            sortOrder?: number
            parentTreeEntityId?: string | null
            createdBy?: string | null
            kind?: string
        },
        userId?: string,
        db?: SqlQueryable
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const kind = typeof input.kind === 'string' && input.kind.trim().length > 0 ? input.kind.trim() : DEFAULT_HUB_KIND

        const createWithRunner = async (tx: SqlQueryable) => {
            const sortOrder =
                typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
                    ? input.sortOrder
                    : await this.getNextSortOrder(schemaName, kind, tx)

            const now = new Date()
            const codename = ensureCodenameValue(input.codename)
            const presentation = JSON.stringify({
                name: input.name,
                description: input.description ?? null
            })
            const config = JSON.stringify({
                sortOrder,
                parentTreeEntityId: input.parentTreeEntityId ?? null
            })

            const created = await queryOneOrThrow<Record<string, unknown>>(
                tx,
                `INSERT INTO ${qt}
                    (kind, codename, table_name, presentation, config,
                     _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                 VALUES ($1, $2::jsonb, NULL, $3::jsonb, $4::jsonb, $5, $6, $5, $6)
                 RETURNING *`,
                [kind, JSON.stringify(codename), presentation, config, now, input.createdBy ?? null]
            )
            return this.mapHubFromObject(created)
        }

        if (db) return createWithRunner(db)
        return this.exec.transaction(async (tx: SqlQueryable) => createWithRunner(tx))
    }

    /**
     * Update an existing hub.
     */
    async update(
        metahubId: string,
        treeEntityId: string,
        input: {
            codename?: unknown
            name?: Record<string, unknown>
            description?: Record<string, unknown>
            sortOrder?: number
            parentTreeEntityId?: string | null
            updatedBy?: string | null
            expectedVersion?: number
            kind?: string
        },
        userId?: string,
        db?: SqlQueryable
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const runner = db ?? this.exec
        const kind = typeof input.kind === 'string' && input.kind.trim().length > 0 ? input.kind.trim() : DEFAULT_HUB_KIND

        const existing = await queryOne<Record<string, unknown>>(
            runner,
            `SELECT * FROM ${qt} WHERE id = $1 AND kind = $2 AND ${ACTIVE} LIMIT 1`,
            [treeEntityId, kind]
        )

        if (!existing) throw new MetahubNotFoundError('Hub', treeEntityId)

        const currentPresentation = (existing.presentation as Record<string, unknown>) ?? {}
        const currentConfig = (existing.config as Record<string, unknown>) ?? {}

        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: input.updatedBy ?? null
        }

        if (input.codename !== undefined) {
            updateData.codename = ensureCodenameValue(input.codename)
        }

        // Update presentation (merge with existing)
        if (input.name !== undefined || input.description !== undefined) {
            updateData.presentation = {
                ...currentPresentation,
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {})
            }
        }

        // Update config (merge with existing)
        if (input.sortOrder !== undefined || input.parentTreeEntityId !== undefined) {
            updateData.config = {
                ...currentConfig,
                ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
                ...(input.parentTreeEntityId !== undefined ? { parentTreeEntityId: input.parentTreeEntityId } : {})
            }
        }

        // If expectedVersion is provided, use version-checked update
        if (input.expectedVersion !== undefined) {
            const updated = await updateWithVersionCheck({
                executor: runner as DbExecutor,
                schemaName,
                tableName: '_mhb_objects',
                entityId: treeEntityId,
                entityType: DEFAULT_HUB_KIND,
                expectedVersion: input.expectedVersion,
                updateData,
                wrapInTransaction: db === undefined
            })
            return this.mapHubFromObject(updated)
        }

        // Fallback: increment version without check (backwards compatibility)
        const updated = await incrementVersion(runner, schemaName, '_mhb_objects', treeEntityId, updateData)
        return this.mapHubFromObject(updated)
    }

    /**
     * Delete a hub.
     */
    async delete(metahubId: string, treeEntityId: string, userId?: string, kind?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const normalizedKind = typeof kind === 'string' && kind.trim().length > 0 ? kind.trim() : DEFAULT_HUB_KIND

        await this.exec.query(
            `UPDATE ${qt}
             SET _mhb_deleted = true,
                 _mhb_deleted_at = $1,
                 _mhb_deleted_by = $2,
                 _upl_updated_at = $1,
                 _upl_updated_by = $2
             WHERE id = $3 AND kind = $4 AND ${ACTIVE}
             RETURNING id`,
            [new Date(), userId ?? null, treeEntityId, normalizedKind]
        )
    }

    /**
     * Count hubs in a metahub.
     */
    async count(metahubId: string, userId?: string, kinds?: readonly string[]): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const normalizedKinds = normalizeKinds(kinds)

        const result = await queryOne<{ total: string }>(
            this.exec,
            normalizedKinds.length === 1
                ? `SELECT COUNT(*) AS total FROM ${qt} WHERE kind = $1 AND ${ACTIVE}`
                : `SELECT COUNT(*) AS total FROM ${qt} WHERE kind = ANY($1::text[]) AND ${ACTIVE}`,
            [normalizedKinds.length === 1 ? normalizedKinds[0] : normalizedKinds]
        )

        return result ? parseInt(result.total, 10) : 0
    }
}
