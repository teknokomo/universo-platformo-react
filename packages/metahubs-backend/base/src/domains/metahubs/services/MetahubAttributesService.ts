import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { AttributeDataType, TABLE_CHILD_DATA_TYPES } from '@universo/types'
import { generateUuidV7 } from '@universo/utils'
import { buildCodenameAttempt, CODENAME_RETRY_MAX_ATTEMPTS } from '../../shared/codenameStyleHelper'
import type { Knex } from 'knex'

/**
 * Service to manage Metahub Attributes stored in isolated schemas (_mhb_attributes).
 * Replaces the old TypeORM Attribute entity logic.
 */
export class MetahubAttributesService {
    constructor(private schemaService: MetahubSchemaService) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    private getRunner(trx?: Knex.Transaction) {
        return trx ?? this.knex
    }

    private getMaxChildAttributesLimit(validationRules: unknown): number | null {
        if (!validationRules || typeof validationRules !== 'object') {
            return null
        }
        const raw = (validationRules as Record<string, unknown>).maxChildAttributes
        if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
            return null
        }
        return raw
    }

    private createTableChildLimitError(maxChildAttributes: number): Error {
        const error: Error & { code?: string; maxChildAttributes?: number } = new Error(
            `TABLE_CHILD_LIMIT_REACHED: Maximum ${maxChildAttributes} child attributes per TABLE`
        )
        error.code = 'TABLE_CHILD_LIMIT_REACHED'
        error.maxChildAttributes = maxChildAttributes
        return error
    }

    private createTableAttributeLimitError(maxTableAttributes: number): Error {
        const error: Error & { code?: string; maxTableAttributes?: number } = new Error(
            `TABLE_ATTRIBUTE_LIMIT_REACHED: Maximum ${maxTableAttributes} TABLE attributes per catalog`
        )
        error.code = 'TABLE_ATTRIBUTE_LIMIT_REACHED'
        error.maxTableAttributes = maxTableAttributes
        return error
    }

    private createTableDisplayAttributeForbiddenError(): Error {
        const error: Error & { code?: string } = new Error(
            'TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN: TABLE attributes cannot be set as display attribute'
        )
        error.code = 'TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN'
        return error
    }

    private async generateUniqueTableAttributeId(schemaName: string, catalogId: string, trx?: Knex.Transaction): Promise<string> {
        const runner = this.getRunner(trx)
        const existingTableAttrs = (await runner
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .select('id')
            .where({ object_id: catalogId, data_type: AttributeDataType.TABLE })
            .whereNull('parent_attribute_id')) as Array<{ id: string }>

        const usedPrefixes = new Set(existingTableAttrs.map((row) => row.id.replace(/-/g, '').substring(0, 12)))

        for (let attempt = 0; attempt < 64; attempt++) {
            const candidate = generateUuidV7()
            const prefix = candidate.replace(/-/g, '').substring(0, 12)
            if (!usedPrefixes.has(prefix)) {
                return candidate
            }
        }

        throw new Error('Failed to generate a unique TABLE attribute ID')
    }

    /**
     * Count root-level attributes for a specific object (catalog).
     * Excludes child attributes of TABLE types.
     */
    async countByObjectId(metahubId: string, objectId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const result = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId })
            .whereNull('parent_attribute_id')
            .count('* as count')
            .first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    /**
     * Count TABLE-type attributes for a specific object.
     */
    async countTableAttributes(metahubId: string, objectId: string, userId?: string, trx?: Knex.Transaction): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = this.getRunner(trx)
        const result = await runner
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId, data_type: AttributeDataType.TABLE })
            .whereNull('parent_attribute_id')
            .count('* as count')
            .first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    /**
     * Count child attributes of a TABLE attribute.
     */
    async countChildAttributes(metahubId: string, parentAttributeId: string, userId?: string, trx?: Knex.Transaction): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = this.getRunner(trx)
        const result = await runner
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ parent_attribute_id: parentAttributeId })
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

    /**
     * Returns only root-level attributes (parent_attribute_id IS NULL).
     * Use findAllFlat() to get all attributes including children.
     */
    async findAll(metahubId: string, objectId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId })
            .whereNull('parent_attribute_id')
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

        return rows.map(this.mapRowToAttribute)
    }

    /**
     * Returns ALL attributes (root + child) for snapshot/sync purposes.
     */
    async findAllFlat(metahubId: string, objectId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId })
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

        return rows.map(this.mapRowToAttribute)
    }

    /**
     * Returns child attributes of a TABLE attribute.
     */
    async findChildAttributes(metahubId: string, parentAttributeId: string, userId?: string, trx?: Knex.Transaction) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = this.getRunner(trx)
        const rows = await runner
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ parent_attribute_id: parentAttributeId })
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

        return rows.map(this.mapRowToAttribute)
    }

    /**
     * Returns child attributes for multiple TABLE parents in a single query.
     * Grouped by parent attribute ID for efficient batch lookup.
     */
    async findChildAttributesByParentIds(metahubId: string, parentAttributeIds: string[], userId?: string) {
        const result = new Map<string, ReturnType<typeof this.mapRowToAttribute>[]>()
        for (const parentId of parentAttributeIds) {
            result.set(parentId, [])
        }
        if (parentAttributeIds.length === 0) return result

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .whereIn('parent_attribute_id', parentAttributeIds)
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

        for (const row of rows) {
            const attr = this.mapRowToAttribute(row)
            const parentId = attr.parentAttributeId
            if (parentId && result.has(parentId)) {
                result.get(parentId)!.push(attr)
            }
        }
        return result
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

    async findById(metahubId: string, id: string, userId?: string, trx?: Knex.Transaction) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = this.getRunner(trx)
        const row = await runner.withSchema(schemaName).from('_mhb_attributes').where({ id }).first()

        return row ? this.mapRowToAttribute(row) : null
    }

    async findByCodename(
        metahubId: string,
        objectId: string,
        codename: string,
        parentAttributeId?: string | null,
        userId?: string,
        trx?: Knex.Transaction,
        options?: { ignoreParentScope?: boolean }
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = this.getRunner(trx)
        let query = runner
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId, codename })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)

        if (!options?.ignoreParentScope) {
            if (parentAttributeId) {
                query = query.andWhere({ parent_attribute_id: parentAttributeId })
            } else {
                query = query.whereNull('parent_attribute_id')
            }
        }

        const row = await query.first()

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

    /**
     * Find REF attributes that reference a target object by kind and id.
     * Used to block deletion of referenced objects (e.g. enumerations).
     */
    async findReferenceBlockersByTarget(metahubId: string, targetObjectId: string, targetObjectKind: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes as attr')
            .leftJoin('_mhb_objects as obj', 'obj.id', 'attr.object_id')
            .where('attr.data_type', 'REF')
            .andWhere('attr.target_object_id', targetObjectId)
            .andWhere('attr.target_object_kind', targetObjectKind)
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

    /**
     * Find REF attributes that use a specific enumeration value as default in ui_config.
     * Used to block deletion of enumeration values that are still configured as defaults.
     */
    async findDefaultEnumValueBlockers(metahubId: string, enumValueId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes as attr')
            .leftJoin('_mhb_objects as obj', 'obj.id', 'attr.object_id')
            .where('attr.data_type', 'REF')
            .andWhere('attr.target_object_kind', 'enumeration')
            .andWhereRaw(`attr.ui_config ->> 'defaultEnumValueId' = ?`, [enumValueId])
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

    /**
     * Find predefined elements that reference a specific enumeration value.
     * Used to prevent deleting values that are still used in catalog predefined data.
     */
    async findElementEnumValueBlockers(metahubId: string, enumerationId: string, enumValueId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = (await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes as attr')
            .leftJoin('_mhb_objects as obj', 'obj.id', 'attr.object_id')
            .leftJoin('_mhb_elements as el', function () {
                this.on('el.object_id', '=', 'attr.object_id')
            })
            .where('attr.data_type', 'REF')
            .andWhere('attr.target_object_kind', 'enumeration')
            .andWhere('attr.target_object_id', enumerationId)
            .andWhereRaw(`el.data ->> attr.codename = ?`, [enumValueId])
            .andWhere('attr._upl_deleted', false)
            .andWhere('attr._mhb_deleted', false)
            .andWhere('obj._upl_deleted', false)
            .andWhere('obj._mhb_deleted', false)
            .andWhere('el._upl_deleted', false)
            .andWhere('el._mhb_deleted', false)
            .groupBy('attr.id', 'attr.codename', 'attr.presentation', 'attr.object_id', 'obj.codename', 'obj.presentation')
            .select(
                'attr.id as attribute_id',
                'attr.codename as attribute_codename',
                'attr.presentation as attribute_presentation',
                'attr.object_id as source_catalog_id',
                'obj.codename as source_catalog_codename',
                'obj.presentation as source_catalog_presentation'
            )
            .count('el.id as usage_count')
            .orderBy('obj.codename', 'asc')
            .orderBy('attr.sort_order', 'asc')) as Array<{
            attribute_id: string
            attribute_codename: string
            attribute_presentation?: { name?: unknown }
            source_catalog_id: string
            source_catalog_codename: string
            source_catalog_presentation?: { name?: unknown }
            usage_count: string
        }>

        return rows.map((row: any) => ({
            attributeId: row.attribute_id,
            attributeCodename: row.attribute_codename,
            attributeName: row.attribute_presentation?.name ?? null,
            sourceCatalogId: row.source_catalog_id,
            sourceCatalogCodename: row.source_catalog_codename,
            sourceCatalogName: row.source_catalog_presentation?.name ?? null,
            usageCount: parseInt(row.usage_count ?? '0', 10)
        }))
    }

    async create(metahubId: string, data: any, userId?: string, trx?: Knex.Transaction) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = this.getRunner(trx)
        let explicitAttributeId: string | undefined

        // TABLE attribute limits validation
        if (data.parentAttributeId) {
            const parent = await this.findById(metahubId, data.parentAttributeId, userId, trx)
            if (!parent) {
                throw new Error(`Parent attribute ${data.parentAttributeId} not found`)
            }
            if (parent.dataType !== AttributeDataType.TABLE) {
                throw new Error(`Parent attribute must be TABLE type, got ${parent.dataType}`)
            }
            if (data.dataType === AttributeDataType.TABLE) {
                throw new Error('Nested TABLE attributes are not allowed')
            }
            const maxChildAttributes = this.getMaxChildAttributesLimit(parent.validationRules)
            if (typeof maxChildAttributes === 'number') {
                const childCount = await this.countChildAttributes(metahubId, data.parentAttributeId, userId, trx)
                if (childCount >= maxChildAttributes) {
                    throw this.createTableChildLimitError(maxChildAttributes)
                }
            }
        }

        if (data.dataType === AttributeDataType.TABLE) {
            const tableCount = await this.countTableAttributes(metahubId, data.catalogId, userId, trx)
            if (tableCount >= 10) {
                throw this.createTableAttributeLimitError(10)
            }

            explicitAttributeId = await this.generateUniqueTableAttributeId(schemaName, data.catalogId, trx)
        }

        const sortOrder = data.sortOrder ?? (await this.getNextSortOrder(schemaName, data.catalogId, data.parentAttributeId, trx))
        const dbData: Record<string, unknown> = {
            ...(explicitAttributeId ? { id: explicitAttributeId } : {}),
            object_id: data.catalogId, // Map catalogId to object_id
            codename: data.codename,
            data_type: data.dataType,
            is_required: data.isDisplayAttribute ? true : data.isRequired ?? false,
            is_display_attribute: data.isDisplayAttribute ?? false,
            target_object_id: data.targetEntityId ?? null,
            target_object_kind: data.targetEntityKind ?? null,
            target_constant_id: data.targetConstantId ?? null,
            parent_attribute_id: data.parentAttributeId ?? null,
            sort_order: sortOrder,
            presentation: {
                codename: data.codenameLocalized,
                name: data.name
            },
            validation_rules: data.validationRules || {},
            ui_config: data.uiConfig || {},
            _upl_created_at: new Date(),
            _upl_created_by: data.createdBy ?? null,
            _upl_updated_at: new Date(),
            _upl_updated_by: data.createdBy ?? null
        }

        const [created] = await runner.withSchema(schemaName).into('_mhb_attributes').insert(dbData).returning('*')

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
        if (data.isDisplayAttribute === true) updateData.is_required = true
        if (data.targetEntityId !== undefined) updateData.target_object_id = data.targetEntityId
        if (data.targetEntityKind !== undefined) updateData.target_object_kind = data.targetEntityKind
        if (data.targetConstantId !== undefined) updateData.target_constant_id = data.targetConstantId
        if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

        if (data.name !== undefined || data.codenameLocalized !== undefined) {
            const current = await this.knex.withSchema(schemaName).from('_mhb_attributes').where({ id }).first()
            updateData.presentation = {
                ...(current?.presentation ?? {}),
                ...(data.codenameLocalized !== undefined ? { codename: data.codenameLocalized } : {}),
                ...(data.name !== undefined ? { name: data.name } : {})
            }
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

        await this.knex.transaction(async (trx) => {
            // If TABLE type, explicitly delete children before parent
            // (FK ON DELETE CASCADE would handle hard-delete, but explicit delete ensures consistency)
            const attribute = await trx.withSchema(schemaName).from('_mhb_attributes').where({ id }).first()
            if (attribute?.data_type === AttributeDataType.TABLE) {
                await trx.withSchema(schemaName).from('_mhb_attributes').where({ parent_attribute_id: id }).delete()
            }

            await trx.withSchema(schemaName).from('_mhb_attributes').where({ id }).delete()
        })
    }

    async moveAttribute(metahubId: string, objectId: string, attributeId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            // Fetch current attribute to know its parent scope
            const current = await trx.withSchema(schemaName).from('_mhb_attributes').where({ id: attributeId }).first()

            if (!current) throw new Error('Attribute not found')

            const parentAttributeId: string | null = current.parent_attribute_id ?? null

            // Ensure sequential order only among siblings (same parent)
            await this._ensureSequentialSortOrder(metahubId, objectId, trx, userId, parentAttributeId)

            // Re-fetch after reordering
            const refreshed = await trx.withSchema(schemaName).from('_mhb_attributes').where({ id: attributeId }).first()
            const currentOrder = refreshed.sort_order

            // Find neighbor among siblings only
            let neighborQuery = trx.withSchema(schemaName).from('_mhb_attributes').where({ object_id: objectId })

            if (parentAttributeId) {
                neighborQuery = neighborQuery.where({ parent_attribute_id: parentAttributeId })
            } else {
                neighborQuery = neighborQuery.whereNull('parent_attribute_id')
            }

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

    /**
     * Reorder an attribute to a new sort_order (and optionally transfer to a different parent list).
     * @param codenameScope - 'per-level' or 'global' codename uniqueness scope
     * @param codenameStyle - 'kebab-case' or 'pascal-case' for auto-rename suffix
     * @param autoRenameCodename - if true, auto-rename codename on conflict
     */
    async reorderAttribute(
        metahubId: string,
        objectId: string,
        attributeId: string,
        newSortOrder: number,
        newParentAttributeId: string | null | undefined,
        codenameScope: 'per-level' | 'global',
        codenameStyle: 'kebab-case' | 'pascal-case',
        allowCrossListRootChildren: boolean,
        allowCrossListBetweenChildren: boolean,
        autoRenameCodename?: boolean,
        userId?: string
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            // 1. Fetch current attribute
            const current = await trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: attributeId, object_id: objectId })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .first()
            if (!current) throw new Error('Attribute not found')

            const currentParent: string | null = current.parent_attribute_id ?? null
            const targetParent: string | null = newParentAttributeId !== undefined ? newParentAttributeId : currentParent
            const isCrossList = targetParent !== currentParent

            if (isCrossList) {
                // ── Cross-list transfer validation ──
                await this._validateCrossListTransfer(
                    trx,
                    schemaName,
                    objectId,
                    current,
                    currentParent,
                    targetParent,
                    allowCrossListRootChildren,
                    allowCrossListBetweenChildren,
                    codenameScope,
                    codenameStyle,
                    autoRenameCodename
                )

                // Move: update parent_attribute_id
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_attributes')
                    .where({ id: attributeId })
                    .update({ parent_attribute_id: targetParent })

                // Normalize source list (close gap left by the moved attribute)
                await this._ensureSequentialSortOrder(metahubId, objectId, trx, userId, currentParent)

                // Auto-set display attribute + required when attribute becomes the only child in target list
                if (targetParent !== null) {
                    const siblingCount = await trx
                        .withSchema(schemaName)
                        .from('_mhb_attributes')
                        .where({ object_id: objectId, parent_attribute_id: targetParent })
                        .andWhere('_upl_deleted', false)
                        .andWhere('_mhb_deleted', false)
                        .count('id as count')
                        .first()
                    if (siblingCount && Number(siblingCount.count) === 1) {
                        await trx
                            .withSchema(schemaName)
                            .from('_mhb_attributes')
                            .where({ id: attributeId })
                            .update({ is_display_attribute: true, is_required: true })
                    }
                }
            }

            // 2. Ensure sequential order in target list
            await this._ensureSequentialSortOrder(metahubId, objectId, trx, userId, targetParent)

            // 3. Re-fetch to get current sort_order after normalization
            const refreshed = await trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: attributeId, object_id: objectId })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .first()
            if (!refreshed) throw new Error('Attribute not found')
            const oldOrder = refreshed.sort_order
            const clampedNew = Math.max(1, newSortOrder)

            if (oldOrder !== clampedNew) {
                // Build parent scope condition
                const parentCondition = (q: Knex.QueryBuilder) => {
                    if (targetParent) {
                        q.where({ parent_attribute_id: targetParent })
                    } else {
                        q.whereNull('parent_attribute_id')
                    }
                }

                if (clampedNew < oldOrder) {
                    // Moving up: shift items [clampedNew, oldOrder) down by 1
                    await trx
                        .withSchema(schemaName)
                        .from('_mhb_attributes')
                        .where({ object_id: objectId })
                        .modify(parentCondition)
                        .where('sort_order', '>=', clampedNew)
                        .where('sort_order', '<', oldOrder)
                        .whereNot({ id: attributeId })
                        .increment('sort_order', 1)
                } else {
                    // Moving down: shift items (oldOrder, clampedNew] up by 1
                    await trx
                        .withSchema(schemaName)
                        .from('_mhb_attributes')
                        .where({ object_id: objectId })
                        .modify(parentCondition)
                        .where('sort_order', '>', oldOrder)
                        .where('sort_order', '<=', clampedNew)
                        .whereNot({ id: attributeId })
                        .decrement('sort_order', 1)
                }

                // Set the target sort_order
                await trx.withSchema(schemaName).from('_mhb_attributes').where({ id: attributeId }).update({ sort_order: clampedNew })
            }

            // 4. Final normalization pass
            await this._ensureSequentialSortOrder(metahubId, objectId, trx, userId, targetParent)

            // 5. Return updated attribute
            const updated = await trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: attributeId, object_id: objectId })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .first()
            if (!updated) throw new Error('Attribute not found')
            return this.mapRowToAttribute(updated)
        })
    }

    /**
     * Validate a cross-list attribute transfer (change of parent_attribute_id).
     * Throws typed errors that the route handler maps to HTTP status codes.
     */
    private async _validateCrossListTransfer(
        trx: Knex.Transaction,
        schemaName: string,
        objectId: string,
        attribute: any,
        currentParentId: string | null,
        targetParentId: string | null,
        allowCrossListRootChildren: boolean,
        allowCrossListBetweenChildren: boolean,
        codenameScope: 'per-level' | 'global',
        codenameStyle: 'kebab-case' | 'pascal-case',
        autoRenameCodename?: boolean
    ): Promise<void> {
        const sourceIsRoot = currentParentId === null
        const targetIsRoot = targetParentId === null

        if ((sourceIsRoot || targetIsRoot) && !allowCrossListRootChildren) {
            throw new Error('TRANSFER_NOT_ALLOWED: Moving attributes between root and child lists is disabled by settings')
        }

        if (!sourceIsRoot && !targetIsRoot && !allowCrossListBetweenChildren) {
            throw new Error('TRANSFER_NOT_ALLOWED: Moving attributes between child lists is disabled by settings')
        }

        // 1. Display attribute cannot be moved across lists
        if (attribute.is_display_attribute) {
            throw new Error(
                'DISPLAY_ATTRIBUTE_TRANSFER_BLOCKED: Display attribute cannot be moved. Assign another attribute as the display attribute first.'
            )
        }

        // 2. TABLE attributes can only exist at root level
        if (attribute.data_type === AttributeDataType.TABLE && targetParentId !== null) {
            throw new Error('TRANSFER_NOT_ALLOWED: TABLE attributes can only exist at the root level')
        }

        // 3. If target is a child list, verify parent is TABLE type and data type is allowed
        if (targetParentId !== null) {
            const parentAttr = await trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: targetParentId, object_id: objectId })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .first()
            if (!parentAttr || parentAttr.data_type !== AttributeDataType.TABLE) {
                throw new Error('TRANSFER_NOT_ALLOWED: Target parent is not a TABLE attribute')
            }
            if (!TABLE_CHILD_DATA_TYPES.includes(attribute.data_type)) {
                throw new Error(`TRANSFER_NOT_ALLOWED: ${attribute.data_type} attributes are not allowed in TABLE children`)
            }

            const maxChildAttributes = this.getMaxChildAttributesLimit(parentAttr.validation_rules)
            if (typeof maxChildAttributes === 'number') {
                const countResult = await trx
                    .withSchema(schemaName)
                    .from('_mhb_attributes')
                    .where({ object_id: objectId, parent_attribute_id: targetParentId })
                    .andWhere('_upl_deleted', false)
                    .andWhere('_mhb_deleted', false)
                    .count('id as count')
                    .first()
                const childCountRaw = countResult?.count
                const childCount =
                    typeof childCountRaw === 'number' ? childCountRaw : childCountRaw ? Number.parseInt(String(childCountRaw), 10) : 0
                if (childCount >= maxChildAttributes) {
                    throw this.createTableChildLimitError(maxChildAttributes)
                }
            }
        }

        // 4. Codename uniqueness check in target scope
        const hasConflict = async (codename: string): Promise<boolean> => {
            let query = trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ object_id: objectId, codename })
                .whereNot({ id: attribute.id })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)

            if (codenameScope !== 'global') {
                // Per-level: unique among siblings at target level
                if (targetParentId) {
                    query = query.where({ parent_attribute_id: targetParentId })
                } else {
                    query = query.whereNull('parent_attribute_id')
                }
            }
            return !!(await query.first())
        }

        if (await hasConflict(attribute.codename)) {
            if (!autoRenameCodename) {
                // No auto-rename — throw conflict so frontend can show dialog
                const error: any = new Error(`CODENAME_CONFLICT: Codename "${attribute.codename}" already exists in the target scope`)
                error.codename = attribute.codename
                throw error
            }

            // Auto-rename using buildCodenameAttempt() retry loop
            let renamed = false
            for (let attempt = 2; attempt <= CODENAME_RETRY_MAX_ATTEMPTS && !renamed; attempt++) {
                const candidate = buildCodenameAttempt(attribute.codename, attempt, codenameStyle)
                if (!(await hasConflict(candidate))) {
                    const nextPresentation =
                        attribute.presentation && typeof attribute.presentation === 'object'
                            ? { ...(attribute.presentation as Record<string, unknown>), codename: null }
                            : { codename: null }
                    await trx
                        .withSchema(schemaName)
                        .from('_mhb_attributes')
                        .where({ id: attribute.id })
                        .update({ codename: candidate, presentation: nextPresentation })
                    renamed = true
                }
            }
            if (!renamed) {
                throw new Error(`CODENAME_CONFLICT: Could not generate unique codename after ${CODENAME_RETRY_MAX_ATTEMPTS} attempts`)
            }
        }
    }

    /**
     * Ensure sequential sort order among sibling attributes.
     * Scoped by parentAttributeId: null = root attributes, string = children of that parent.
     */
    private async _ensureSequentialSortOrder(
        metahubId: string,
        objectId: string,
        trx: any,
        userId?: string,
        parentAttributeId?: string | null
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        let query = trx.withSchema(schemaName).from('_mhb_attributes').where({ object_id: objectId })

        if (parentAttributeId) {
            query = query.where({ parent_attribute_id: parentAttributeId })
        } else {
            query = query.whereNull('parent_attribute_id')
        }

        const attributes = await query.orderBy('sort_order', 'asc').orderBy('_upl_created_at', 'asc')

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
    async ensureSequentialSortOrder(metahubId: string, objectId: string, userId?: string, parentAttributeId?: string | null) {
        return this.knex.transaction((trx) => this._ensureSequentialSortOrder(metahubId, objectId, trx, userId, parentAttributeId))
    }

    /**
     * Set an attribute as the display attribute for its catalog.
     * Only one attribute per catalog can be the display attribute at each level:
     * - Root attributes: only one root attribute can be exhibit
     * - Child attributes: only one child per parent can be exhibit
     * TABLE type attributes cannot be display attributes.
     */
    async setDisplayAttribute(metahubId: string, catalogId: string, attributeId: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const attribute = await this.findById(metahubId, attributeId, userId)
        if (!attribute) {
            throw new Error('Attribute not found')
        }

        // TABLE type attributes cannot be display attributes
        if (attribute.dataType === AttributeDataType.TABLE) {
            throw this.createTableDisplayAttributeForbiddenError()
        }

        await this.knex.transaction(async (trx) => {
            if (attribute.parentAttributeId) {
                // Child attribute: reset only siblings (children of the same parent)
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_attributes')
                    .where({ parent_attribute_id: attribute.parentAttributeId })
                    .update({
                        is_display_attribute: false,
                        _upl_updated_at: new Date(),
                        _upl_updated_by: userId ?? null
                    })
            } else {
                // Root attribute: reset only root attributes in this catalog
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_attributes')
                    .where({ object_id: catalogId })
                    .whereNull('parent_attribute_id')
                    .update({
                        is_display_attribute: false,
                        _upl_updated_at: new Date(),
                        _upl_updated_by: userId ?? null
                    })
            }

            // Set the specified attribute as display attribute
            await trx
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: attributeId })
                .update({
                    is_display_attribute: true,
                    is_required: true,
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

        const attribute = await this.knex.withSchema(schemaName).from('_mhb_attributes').where({ id: attributeId }).first()
        if (!attribute) {
            throw new Error('Attribute not found')
        }

        if (attribute.is_display_attribute) {
            let siblingsQuery = this.knex.withSchema(schemaName).from('_mhb_attributes').where({ object_id: attribute.object_id })

            if (attribute.parent_attribute_id) {
                siblingsQuery = siblingsQuery.where({ parent_attribute_id: attribute.parent_attribute_id })
            } else {
                siblingsQuery = siblingsQuery.whereNull('parent_attribute_id')
            }

            const displayCountResult = await siblingsQuery
                .where({ is_display_attribute: true })
                .count<{ count?: string | number }>('id as count')
                .first()
            const displayCountRaw = displayCountResult?.count
            const displayCount =
                typeof displayCountRaw === 'number' ? displayCountRaw : displayCountRaw ? Number.parseInt(displayCountRaw, 10) : 0

            if (displayCount <= 1) {
                throw new Error('At least one display attribute is required in each scope')
            }
        }

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

    private async getNextSortOrder(
        schemaName: string,
        objectId: string,
        parentAttributeId?: string | null,
        trx?: Knex.Transaction
    ): Promise<number> {
        const runner = this.getRunner(trx)
        let query = runner.withSchema(schemaName).from('_mhb_attributes').where({ object_id: objectId })

        if (parentAttributeId) {
            query = query.where({ parent_attribute_id: parentAttributeId })
        } else {
            query = query.whereNull('parent_attribute_id')
        }

        const result = await query.max('sort_order as max').first()

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
            codenameLocalized: row.presentation?.codename ?? null,
            dataType: row.data_type,
            isRequired: row.is_required,
            isDisplayAttribute: row.is_display_attribute ?? false,
            // Polymorphic reference fields
            targetEntityId: row.target_object_id,
            targetEntityKind: row.target_object_kind,
            targetConstantId: row.target_constant_id ?? null,
            // TABLE parent reference
            parentAttributeId: row.parent_attribute_id ?? null,
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
