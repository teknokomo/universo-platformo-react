import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'

/**
 * Service to manage Metahub Attributes stored in isolated schemas (_mhb_attributes).
 * Replaces the old TypeORM Attribute entity logic.
 */
export class MetahubAttributesService {
    constructor(private schemaService: MetahubSchemaService) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Count attributes for a specific object (catalog).
     */
    async countByObjectId(metahubId: string, objectId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
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
    async countByObjectIds(metahubId: string, objectIds: string[], userId?: string): Promise<Map<string, number>> {
        if (objectIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
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

    async findAll(metahubId: string, objectId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId })
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

        return rows.map(this.mapRowToAttribute)
    }

    async getAllAttributes(metahubId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

        return rows.map(this.mapRowToAttribute)
    }

    async findById(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex.withSchema(schemaName).from('_mhb_attributes').where({ id }).first()

        return row ? this.mapRowToAttribute(row) : null
    }

    async findByCodename(metahubId: string, objectId: string, codename: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex.withSchema(schemaName).from('_mhb_attributes').where({ object_id: objectId, codename }).first()

        return row ? this.mapRowToAttribute(row) : null
    }

    /**
     * Find REF attributes in other catalogs that reference the target catalog.
     * Used to block catalog deletion when cross-catalog dependencies exist.
     */
    async findCatalogReferenceBlockers(metahubId: string, targetCatalogId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes as attr')
            .leftJoin('_mhb_objects as obj', 'obj.id', 'attr.object_id')
            .where('attr.data_type', 'REF')
            .andWhere('attr.target_object_id', targetCatalogId)
            .andWhereNot('attr.object_id', targetCatalogId)
            .andWhere((qb) => qb.where('attr.target_object_kind', 'catalog').orWhereNull('attr.target_object_kind'))
            .andWhere('attr._upl_deleted', false)
            .andWhere('attr._mhb_deleted', false)
            .andWhere('obj._upl_deleted', false)
            .andWhere('obj._mhb_deleted', false)
            .select(
                'attr.id as attribute_id',
                'attr.codename as attribute_codename',
                'attr.presentation as attribute_presentation',
                'attr.object_id as source_catalog_id',
                'obj.codename as source_catalog_codename',
                'obj.presentation as source_catalog_presentation'
            )
            .orderBy('obj.codename', 'asc')
            .orderBy('attr.sort_order', 'asc')

        return rows.map((row: any) => ({
            attributeId: row.attribute_id,
            attributeCodename: row.attribute_codename,
            attributeName: row.attribute_presentation?.name ?? null,
            sourceCatalogId: row.source_catalog_id,
            sourceCatalogCodename: row.source_catalog_codename,
            sourceCatalogName: row.source_catalog_presentation?.name ?? null
        }))
    }

    async create(metahubId: string, data: any, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const sortOrder = data.sortOrder ?? (await this.getNextSortOrder(schemaName, data.catalogId))
        const dbData = {
            object_id: data.catalogId, // Map catalogId to object_id
            codename: data.codename,
            data_type: data.dataType,
            is_required: data.isRequired ?? false,
            is_display_attribute: data.isDisplayAttribute ?? false,
            target_object_id: data.targetEntityId ?? data.targetCatalogId ?? null,
            target_object_kind: data.targetEntityKind ?? null,
            sort_order: sortOrder,
            presentation: {
                name: data.name
            },
            validation_rules: data.validationRules || {},
            ui_config: data.uiConfig || {},
            _upl_created_at: new Date(),
            _upl_created_by: data.createdBy ?? null,
            _upl_updated_at: new Date(),
            _upl_updated_by: data.createdBy ?? null
        }

        const [created] = await this.knex.withSchema(schemaName).into('_mhb_attributes').insert(dbData).returning('*')

        return this.mapRowToAttribute(created)
    }

    async update(metahubId: string, id: string, data: any, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: data.updatedBy ?? null
        }

        if (data.codename !== undefined) updateData.codename = data.codename
        if (data.dataType !== undefined) updateData.data_type = data.dataType
        if (data.isRequired !== undefined) updateData.is_required = data.isRequired
        if (data.isDisplayAttribute !== undefined) updateData.is_display_attribute = data.isDisplayAttribute
        // Support both new targetEntityId/Kind and legacy targetCatalogId
        if (data.targetEntityId !== undefined) updateData.target_object_id = data.targetEntityId
        else if (data.targetCatalogId !== undefined) updateData.target_object_id = data.targetCatalogId
        if (data.targetEntityKind !== undefined) updateData.target_object_kind = data.targetEntityKind
        if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

        if (data.name !== undefined) {
            updateData.presentation = { name: data.name }
        }

        if (data.validationRules !== undefined) updateData.validation_rules = data.validationRules
        if (data.uiConfig !== undefined) updateData.ui_config = data.uiConfig

        // If expectedVersion is provided, use version-checked update
        if (data.expectedVersion !== undefined) {
            const updated = await updateWithVersionCheck({
                knex: this.knex,
                schemaName,
                tableName: '_mhb_attributes',
                entityId: id,
                entityType: 'attribute',
                expectedVersion: data.expectedVersion,
                updateData
            })
            return this.mapRowToAttribute(updated)
        }

        // Fallback: increment version without check (backwards compatibility)
        const updated = await incrementVersion(this.knex, schemaName, '_mhb_attributes', id, updateData)
        return updated ? this.mapRowToAttribute(updated) : null
    }

    async delete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex.withSchema(schemaName).from('_mhb_attributes').where({ id }).delete()
    }

    async moveAttribute(metahubId: string, objectId: string, attributeId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            // Ensure sequential order first
            await this._ensureSequentialSortOrder(metahubId, objectId, trx, userId)

            const current = await trx.withSchema(schemaName).from('_mhb_attributes').where({ id: attributeId }).first()

            if (!current) throw new Error('Attribute not found')

            const currentOrder = current.sort_order

            // Find neighbor
            let neighborQuery = trx.withSchema(schemaName).from('_mhb_attributes').where({ object_id: objectId })

            if (direction === 'up') {
                neighborQuery = neighborQuery.where('sort_order', '<', currentOrder).orderBy('sort_order', 'desc')
            } else {
                neighborQuery = neighborQuery.where('sort_order', '>', currentOrder).orderBy('sort_order', 'asc')
            }

            const neighbor = await neighborQuery.first()

            if (neighbor) {
                // Swap
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_attributes')
                    .where({ id: attributeId })
                    .update({ sort_order: neighbor.sort_order })
                await trx.withSchema(schemaName).from('_mhb_attributes').where({ id: neighbor.id }).update({ sort_order: currentOrder })
            }

            // Fetch updated
            const [updated] = await trx.withSchema(schemaName).from('_mhb_attributes').where({ id: attributeId }).returning('*')
            return this.mapRowToAttribute(updated)
        })
    }

    // Internal method passing transaction
    private async _ensureSequentialSortOrder(metahubId: string, objectId: string, trx: any, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const attributes = await trx
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId })
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

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
    async ensureSequentialSortOrder(metahubId: string, objectId: string, userId?: string) {
        return this.knex.transaction((trx) => this._ensureSequentialSortOrder(metahubId, objectId, trx, userId))
    }

    /**
     * Set an attribute as the display attribute for its catalog.
     * Only one attribute per catalog can be the display attribute.
     * This method atomically clears the flag from all other attributes in the catalog
     * and sets it on the specified attribute.
     */
    async setDisplayAttribute(metahubId: string, catalogId: string, attributeId: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        await this.knex.transaction(async (trx) => {
            // Reset all attributes in this catalog
            await trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ object_id: catalogId })
                .update({
                    is_display_attribute: false,
                    _upl_updated_at: new Date(),
                    _upl_updated_by: userId ?? null
                })

            // Set the specified attribute as display attribute
            await trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: attributeId })
                .update({
                    is_display_attribute: true,
                    _upl_updated_at: new Date(),
                    _upl_updated_by: userId ?? null
                })
        })
    }

    /**
     * Clear display attribute flag from an attribute.
     */
    async clearDisplayAttribute(metahubId: string, attributeId: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ id: attributeId })
            .update({
                is_display_attribute: false,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null
            })
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
            isDisplayAttribute: row.is_display_attribute ?? false,
            // Polymorphic reference fields
            targetEntityId: row.target_object_id,
            targetEntityKind: row.target_object_kind,
            // Legacy alias for backward compatibility
            targetCatalogId: row.target_object_id,
            sortOrder: row.sort_order,
            name: row.presentation?.name,
            description: row.presentation?.description,
            validationRules: row.validation_rules,
            uiConfig: row.ui_config,
            version: row._upl_version || 1,
            createdAt: row._upl_created_at,
            updatedAt: row._upl_updated_at
        }
    }
}
