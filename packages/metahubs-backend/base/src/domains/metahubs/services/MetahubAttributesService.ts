import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'

/**
 * Service to manage Metahub Attributes stored in isolated schemas (_mhb_attributes).
 * Replaces the old TypeORM Attribute entity logic.
 */
export class MetahubAttributesService {
    constructor(private schemaService: MetahubSchemaService) { }

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Count attributes for a specific object (catalog).
     */
    async countByObjectId(metahubId: string, objectId: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId)
        const result = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId })
            .count('* as count')
            .first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    /**
     * Count attributes for multiple objects (batch operation).
     */
    async countByObjectIds(metahubId: string, objectIds: string[]): Promise<Map<string, number>> {
        if (objectIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId)
        const results = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .whereIn('object_id', objectIds)
            .select('object_id')
            .count('* as count')
            .groupBy('object_id')

        const counts = new Map<string, number>()
        results.forEach((row: any) => {
            counts.set(row.object_id, parseInt(row.count as string, 10))
        })
        return counts
    }

    async findAll(metahubId: string, objectId: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId })
            .orderBy('sort_order', 'asc')
            .orderBy('created_at', 'desc')

        return rows.map(this.mapRowToAttribute)
    }

    async getAllAttributes(metahubId: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .orderBy('sort_order', 'asc')
            .orderBy('created_at', 'desc')

        return rows.map(this.mapRowToAttribute)
    }

    async findById(metahubId: string, id: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId)
        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ id })
            .first()

        return row ? this.mapRowToAttribute(row) : null
    }

    async findByCodename(metahubId: string, objectId: string, codename: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId)
        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId, codename })
            .first()

        return row ? this.mapRowToAttribute(row) : null
    }

    async create(metahubId: string, data: any) {
        const schemaName = await this.schemaService.ensureSchema(metahubId)

        const sortOrder = data.sortOrder ?? await this.getNextSortOrder(schemaName, data.catalogId)
        const dbData = {
            object_id: data.catalogId, // Map catalogId to object_id
            codename: data.codename,
            data_type: data.dataType,
            is_required: data.isRequired ?? false,
            target_object_id: data.targetCatalogId,
            sort_order: sortOrder,
            presentation: {
                name: data.name
            },
            validation_rules: data.validationRules || {},
            ui_config: data.uiConfig || {},
            created_at: new Date(),
            updated_at: new Date()
        }

        const [created] = await this.knex
            .withSchema(schemaName)
            .into('_mhb_attributes')
            .insert(dbData)
            .returning('*')

        return this.mapRowToAttribute(created)
    }

    async update(metahubId: string, id: string, data: any) {
        const schemaName = await this.schemaService.ensureSchema(metahubId)

        const updateData: any = { updated_at: new Date() }

        if (data.codename !== undefined) updateData.codename = data.codename
        if (data.dataType !== undefined) updateData.data_type = data.dataType
        if (data.isRequired !== undefined) updateData.is_required = data.isRequired
        if (data.targetCatalogId !== undefined) updateData.target_object_id = data.targetCatalogId
        if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

        // Merge complex JSON fields if not provided
        // But for update, we might want to merge `presentation.name` if only name provided?
        // Let's assume input `name` replaces `presentation.name`.
        if (data.name !== undefined) {
            // We need to fetch existing if we want to preserve description (if any exists in presentation)
            // But for now, assume name is main thing.
            // Or better, fetch existing outside and pass full object, or use jsonb_set logic.
            // Let's rely on simple update for name.
            // If we really need deep merge, we should do it in service logic before calling update or here.
            // Let's assume the passed data is the desired state for these fields.
            updateData.presentation = { name: data.name }
        }

        if (data.validationRules !== undefined) updateData.validation_rules = data.validationRules
        if (data.uiConfig !== undefined) updateData.ui_config = data.uiConfig

        const [updated] = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ id })
            .update(updateData)
            .returning('*')

        return updated ? this.mapRowToAttribute(updated) : null
    }

    async delete(metahubId: string, id: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId)
        await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ id })
            .delete()
    }

    async moveAttribute(metahubId: string, objectId: string, attributeId: string, direction: 'up' | 'down') {
        const schemaName = await this.schemaService.ensureSchema(metahubId)

        return this.knex.transaction(async (trx) => {
            // Ensure sequential order first
            await this._ensureSequentialSortOrder(metahubId, objectId, trx)

            const current = await trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: attributeId })
                .first()

            if (!current) throw new Error('Attribute not found')

            const currentOrder = current.sort_order

            // Find neighbor
            let neighborQuery = trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ object_id: objectId })

            if (direction === 'up') {
                neighborQuery = neighborQuery
                    .where('sort_order', '<', currentOrder)
                    .orderBy('sort_order', 'desc')
            } else {
                neighborQuery = neighborQuery
                    .where('sort_order', '>', currentOrder)
                    .orderBy('sort_order', 'asc')
            }

            const neighbor = await neighborQuery.first()

            if (neighbor) {
                // Swap
                await trx.withSchema(schemaName).from('_mhb_attributes').where({ id: attributeId }).update({ sort_order: neighbor.sort_order })
                await trx.withSchema(schemaName).from('_mhb_attributes').where({ id: neighbor.id }).update({ sort_order: currentOrder })
            }

            // Fetch updated
            const [updated] = await trx.withSchema(schemaName).from('_mhb_attributes').where({ id: attributeId }).returning('*')
            return this.mapRowToAttribute(updated)
        })
    }

    // Internal method passing transaction
    private async _ensureSequentialSortOrder(metahubId: string, objectId: string, trx: any) {
        const schemaName = await this.schemaService.ensureSchema(metahubId)

        const attributes = await trx
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId })
            .orderBy('sort_order', 'asc')
            .orderBy('created_at', 'asc')

        // Check consistency
        let consistent = true
        for (let i = 0; i < attributes.length; i++) {
            if (attributes[i].sort_order !== i + 1) {
                consistent = false
                break
            }
        }

        if (!consistent) {
            for (let i = 0; i < attributes.length; i++) {
                const attr = attributes[i]
                if (attr.sort_order !== i + 1) {
                    await trx
                        .withSchema(schemaName)
                        .from('_mhb_attributes')
                        .where({ id: attr.id })
                        .update({ sort_order: i + 1 })
                }
            }
        }
    }

    // Public wrapper if needed independently
    async ensureSequentialSortOrder(metahubId: string, objectId: string) {
        return this.knex.transaction(trx => this._ensureSequentialSortOrder(metahubId, objectId, trx))
    }

    private async getNextSortOrder(schemaName: string, objectId: string): Promise<number> {
        const result = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId })
            .max('sort_order as max')
            .first()

        const max = result?.max
        if (typeof max === 'number') return max + 1
        const parsed = max !== undefined && max !== null ? Number(max) : 0
        return Number.isFinite(parsed) ? parsed + 1 : 1
    }

    private mapRowToAttribute(row: any) {
        return {
            id: row.id,
            catalogId: row.object_id,
            codename: row.codename,
            dataType: row.data_type,
            isRequired: row.is_required,
            targetCatalogId: row.target_object_id,
            sortOrder: row.sort_order,
            name: row.presentation?.name,
            description: row.presentation?.description,
            validationRules: row.validation_rules,
            uiConfig: row.ui_config,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }
    }
}
