import { KnexClient, generateTableName } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { escapeLikeWildcards } from '../../../utils'

/**
 * MetahubHubsService - CRUD operations for Hubs stored in isolated schemas.
 *
 * Hubs are stored in the unified `_mhb_objects` table with `kind: 'HUB'`.
 * This follows the same pattern as Catalogs (kind: 'CATALOG') and future
 * object types (Documents, Reports, etc.).
 *
 * Each Metahub has its own schema (mhb_<uuid>) with the _mhb_objects table.
 */
export class MetahubHubsService {
    constructor(private schemaService: MetahubSchemaService) { }

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Maps a raw _mhb_objects row to Hub response format.
     */
    private mapHubFromObject(row: Record<string, unknown>): Record<string, unknown> {
        return {
            id: row.id,
            codename: row.codename,
            name: (row.presentation as Record<string, unknown>)?.name ?? {},
            description: (row.presentation as Record<string, unknown>)?.description ?? null,
            sort_order: (row.config as Record<string, unknown>)?.sortOrder ?? 0,
            created_at: row.created_at,
            updated_at: row.updated_at
        }
    }

    /**
     * Find all hubs for a metahub.
     */
    async findAll(metahubId: string, options: {
        limit?: number
        offset?: number
        sortBy?: string
        sortOrder?: 'asc' | 'desc'
        search?: string
    } = {}, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        let query = this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: 'HUB' })

        // Search in presentation JSONB (name/description)
        if (options.search) {
            const escapedSearch = escapeLikeWildcards(options.search)
            query = query.where((qb) => {
                qb.whereRaw("presentation->>'name' ILIKE ?", [`%${escapedSearch}%`])
                    .orWhereRaw("presentation->>'description' ILIKE ?", [`%${escapedSearch}%`])
                    .orWhere('codename', 'ilike', `%${escapedSearch}%`)
            })
        }

        // Clone for count before limit/offset
        const countQuery = query.clone()

        // Sorting - use orderByRaw for JSONB expressions
        const sortOrder = options.sortOrder || 'asc'
        if (options.sortBy === 'name') {
            query = query.orderByRaw(`presentation->'name'->>'en' ${sortOrder}`)
        } else if (options.sortBy === 'codename') {
            query = query.orderBy('codename', sortOrder)
        } else if (options.sortBy === 'created') {
            query = query.orderBy('created_at', sortOrder)
        } else if (options.sortBy === 'updated') {
            query = query.orderBy('updated_at', sortOrder)
        } else {
            query = query.orderBy('created_at', sortOrder)
        }

        // Pagination
        if (options.limit) query = query.limit(options.limit)
        if (options.offset) query = query.offset(options.offset)

        const [rows, countResult] = await Promise.all([
            query,
            countQuery.count('* as total').first()
        ])

        const total = countResult ? parseInt(countResult.total as string, 10) : 0
        const items = rows.map((row: Record<string, unknown>) => this.mapHubFromObject(row))

        return { items, total }
    }

    /**
     * Find a hub by ID.
     */
    async findById(metahubId: string, hubId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id: hubId, kind: 'HUB' })
            .first()

        return row ? this.mapHubFromObject(row) : null
    }

    /**
     * Find a hub by codename.
     */
    async findByCodename(metahubId: string, codename: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ codename, kind: 'HUB' })
            .first()

        return row ? this.mapHubFromObject(row) : null
    }

    /**
     * Find multiple hubs by IDs.
     */
    async findByIds(metahubId: string, hubIds: string[], userId?: string): Promise<Record<string, unknown>[]> {
        if (hubIds.length === 0) return []

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: 'HUB' })
            .whereIn('id', hubIds)

        return rows.map((row: Record<string, unknown>) => this.mapHubFromObject(row))
    }

    /**
     * Create a new hub.
     */
    async create(metahubId: string, input: {
        codename: string
        name: Record<string, unknown>
        description?: Record<string, unknown>
        sortOrder?: number
    }, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const [created] = await this.knex
            .withSchema(schemaName)
            .into('_mhb_objects')
            .insert({
                kind: 'HUB',
                codename: input.codename,
                table_name: null,
                presentation: {
                    name: input.name,
                    description: input.description ?? null
                },
                config: {
                    sortOrder: input.sortOrder ?? 0
                },
                created_at: new Date(),
                updated_at: new Date()
            })
            .returning('*')

        const tableName = generateTableName(created.id, 'hub')
        const [updated] = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id: created.id })
            .update({ table_name: tableName })
            .returning('*')

        return this.mapHubFromObject(updated)
    }

    /**
     * Update an existing hub.
     */
    async update(metahubId: string, hubId: string, input: {
        codename?: string
        name?: Record<string, unknown>
        description?: Record<string, unknown>
        sortOrder?: number
    }, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const existing = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id: hubId, kind: 'HUB' })
            .first()

        if (!existing) throw new Error('Hub not found')

        const currentPresentation = existing.presentation ?? {}
        const currentConfig = existing.config ?? {}

        const updateData: Record<string, unknown> = { updated_at: new Date() }

        if (input.codename !== undefined) {
            updateData.codename = input.codename
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
        if (input.sortOrder !== undefined) {
            updateData.config = {
                ...currentConfig,
                sortOrder: input.sortOrder
            }
        }

        const [updated] = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id: hubId, kind: 'HUB' })
            .update(updateData)
            .returning('*')

        return this.mapHubFromObject(updated)
    }

    /**
     * Delete a hub.
     */
    async delete(metahubId: string, hubId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id: hubId, kind: 'HUB' })
            .delete()
    }

    /**
     * Count hubs in a metahub.
     */
    async count(metahubId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const result = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: 'HUB' })
            .count('* as total')
            .first()

        return result ? parseInt(result.total as string, 10) : 0
    }
}
