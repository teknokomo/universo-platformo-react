import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { MetahubObjectsService } from './MetahubObjectsService'
import { MetahubAttributesService } from './MetahubAttributesService'
import { isLocalizedContent, filterLocalizedContent } from '@universo/utils'
import { AttributeDataType, VersionedLocalizedContent } from '@universo/types'
import { escapeLikeWildcards } from '../../../utils'

/**
 * MetahubRecordsService - CRUD operations for predefined records in Design-Time.
 *
 * Records are stored in the `_mhb_records` system table within isolated schemas (mhb_<uuid>).
 * Each record references a catalog via `object_id` foreign key.
 *
 * Note: This is Design-Time data (predefined records for catalogs).
 * Run-Time data is stored in Application schemas (app_<uuid>) after publication.
 */
export class MetahubRecordsService {
    constructor(
        private schemaService: MetahubSchemaService,
        private objectsService: MetahubObjectsService,
        private attributesService: MetahubAttributesService
    ) { }

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Count records for a specific catalog.
     */
    async countByObjectId(metahubId: string, objectId: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId)
        const result = await this.knex
            .withSchema(schemaName)
            .from('_mhb_records')
            .where({ object_id: objectId })
            .count('* as count')
            .first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    /**
     * Count records for multiple catalogs (batch operation).
     */
    async countByObjectIds(metahubId: string, objectIds: string[]): Promise<Map<string, number>> {
        if (objectIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId)
        const results = await this.knex
            .withSchema(schemaName)
            .from('_mhb_records')
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
     * Find all records for multiple catalogs.
     * Records in Metahubs are treated as predefined (design-time data).
     */
    async findAllByObjectIds(metahubId: string, objectIds: string[]) {
        if (objectIds.length === 0) return []

        const schemaName = await this.schemaService.ensureSchema(metahubId)
        const records = await this.knex
            .withSchema(schemaName)
            .from('_mhb_records')
            .whereIn('object_id', objectIds)
            .orderBy('object_id', 'asc')
            .orderBy('sort_order', 'asc')
            .orderBy('created_at', 'asc')

        return records.map((record: any) => ({
            id: record.id,
            objectId: record.object_id,
            data: record.data ?? {},
            sortOrder: record.sort_order ?? 0
        }))
    }

    /**
     * Find all records for a catalog with pagination and search.
     */
    async findAll(metahubId: string, catalogId: string, options: {
        limit?: number
        offset?: number
        sortBy?: string
        sortOrder?: 'asc' | 'desc'
        search?: string
    } = {}) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId)
        if (!catalog) throw new Error('Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId)

        // Query _mhb_records table with object_id filter
        let query = this.knex
            .withSchema(schemaName)
            .from('_mhb_records')
            .where({ object_id: catalogId })

        if (options.search) {
            const escapedSearch = escapeLikeWildcards(options.search)
            query = query.whereRaw('data::text ILIKE ?', [`%${escapedSearch}%`])
        }

        const sortColumn = options.sortBy === 'created' ? 'created_at'
            : options.sortBy === 'updated' ? 'updated_at'
                : 'sort_order'
        query = query.orderBy(sortColumn, options.sortOrder || 'asc')

        if (options.limit) query = query.limit(options.limit)
        if (options.offset) query = query.offset(options.offset)

        const items = await query
        return items.map((record: any) => this.mapRowToRecord(record))
    }

    /**
     * Find all records for a catalog with count (for pagination).
     */
    async findAllAndCount(metahubId: string, catalogId: string, options: {
        limit?: number
        offset?: number
        sortBy?: string
        sortOrder?: 'asc' | 'desc'
        search?: string
    } = {}) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId)
        if (!catalog) throw new Error('Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId)

        // Base query with object_id filter
        let query = this.knex
            .withSchema(schemaName)
            .from('_mhb_records')
            .where({ object_id: catalogId })

        if (options.search) {
            const escapedSearch = escapeLikeWildcards(options.search)
            query = query.whereRaw('data::text ILIKE ?', [`%${escapedSearch}%`])
        }

        // Clone for count before applying pagination
        const countResult = await query.clone().count('* as total').first()
        const total = countResult ? parseInt(countResult.total as string, 10) : 0

        // Apply sorting
        const sortColumn = options.sortBy === 'created' ? 'created_at'
            : options.sortBy === 'updated' ? 'updated_at'
                : 'sort_order'
        query = query.orderBy(sortColumn, options.sortOrder || 'asc')

        // Apply pagination
        if (options.limit) query = query.limit(options.limit)
        if (options.offset) query = query.offset(options.offset)

        const items = await query
        return { items: items.map((record: any) => this.mapRowToRecord(record)), total }
    }

    /**
     * Find a single record by ID.
     */
    async findById(metahubId: string, catalogId: string, id: string) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId)
        if (!catalog) return null

        const schemaName = await this.schemaService.ensureSchema(metahubId)

        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_records')
            .where({ id, object_id: catalogId })
            .first()

        return row ? this.mapRowToRecord(row) : null
    }

    /**
     * Create a new record in a catalog.
     */
    async create(metahubId: string, catalogId: string, input: {
        data: Record<string, unknown>
        sortOrder?: number
    }) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId)
        if (!catalog) throw new Error('Catalog not found')

        // Validate record data against catalog attributes
        const attributes = await this.attributesService.findAll(metahubId, catalogId)
        const validation = this.validateRecordData(input.data, attributes)
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId)

        // Insert into _mhb_records table
        const [created] = await this.knex
            .withSchema(schemaName)
            .into('_mhb_records')
            .insert({
                object_id: catalogId,
                data: input.data,
                sort_order: input.sortOrder ?? 0,
                owner_id: null,
                created_at: new Date(),
                updated_at: new Date()
            })
            .returning('*')

        return this.mapRowToRecord(created)
    }

    /**
     * Update an existing record.
     */
    async update(metahubId: string, catalogId: string, id: string, input: {
        data?: Record<string, unknown>
        sortOrder?: number
    }) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId)
        if (!catalog) throw new Error('Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId)

        // Find existing record
        const existing = await this.knex
            .withSchema(schemaName)
            .from('_mhb_records')
            .where({ id, object_id: catalogId })
            .first()

        if (!existing) throw new Error('Record not found')

        const updateData: Record<string, unknown> = { updated_at: new Date() }

        if (input.data) {
            const mergedData = { ...existing.data, ...input.data }
            const attributes = await this.attributesService.findAll(metahubId, catalogId)
            const validation = this.validateRecordData(mergedData, attributes)
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
            }
            updateData.data = mergedData
        }

        if (input.sortOrder !== undefined) {
            updateData.sort_order = input.sortOrder
        }

        const [updated] = await this.knex
            .withSchema(schemaName)
            .from('_mhb_records')
            .where({ id, object_id: catalogId })
            .update(updateData)
            .returning('*')

        return updated ? this.mapRowToRecord(updated) : null
    }

    /**
     * Delete a record.
     */
    async delete(metahubId: string, catalogId: string, id: string) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId)
        if (!catalog) throw new Error('Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId)

        const deleted = await this.knex
            .withSchema(schemaName)
            .from('_mhb_records')
            .where({ id, object_id: catalogId })
            .delete()

        if (deleted === 0) {
            throw new Error('Record not found')
        }
    }

    // Validation helpers
    private validateRecordData(data: Record<string, unknown>, attributes: any[]): { valid: boolean; errors: string[] } {
        const errors: string[] = []
        const attributeMap = new Map(attributes.map((a) => [a.codename, a]))

        // Check required fields
        for (const attr of attributes) {
            if (attr.isRequired && !this.hasRequiredValue(attr, data[attr.codename])) {
                errors.push(`Field "${attr.codename}" is required`)
            }
        }

        // Validate each field
        for (const [key, value] of Object.entries(data)) {
            const attr = attributeMap.get(key)
            if (!attr) continue // Unknown field allowed

            if (value === null || value === undefined) continue

            const typeError = this.validateType(value, attr.dataType)
            if (typeError) {
                errors.push(`Field "${key}": ${typeError}`)
                continue
            }

            const ruleErrors = this.validateRules(value, attr.validationRules || {}, key)
            errors.push(...ruleErrors)
        }

        return { valid: errors.length === 0, errors }
    }

    private hasRequiredValue(attr: any, value: unknown): boolean {
        if (value === undefined || value === null) return false
        if (attr.dataType === AttributeDataType.STRING) {
            if (this.hasAnyLocalizedContent(value)) return true
            const text = this.extractLocalizedString(value)
            if (typeof text === 'string') return text.trim() !== ''
            if (typeof value === 'string') return value.trim() !== ''
            return false
        }
        if (attr.dataType === AttributeDataType.NUMBER) {
            return typeof value === 'number' && !isNaN(value)
        }
        return value !== ''
    }

    private mapRowToRecord(row: any) {
        return {
            id: row.id,
            catalogId: row.object_id,
            data: row.data ?? {},
            ownerId: row.owner_id ?? null,
            sortOrder: row.sort_order ?? 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }
    }

    private validateType(value: unknown, dataType: AttributeDataType): string | null {
        switch (dataType) {
            case AttributeDataType.STRING:
                if (typeof value === 'string' || isLocalizedContent(value)) break
                return 'Expected string'
            case AttributeDataType.NUMBER:
                if (typeof value !== 'number' || isNaN(value)) return 'Expected number'
                break
            case AttributeDataType.BOOLEAN:
                if (typeof value !== 'boolean') return 'Expected boolean'
                break
            case AttributeDataType.DATE:
            case AttributeDataType.DATETIME:
                if (typeof value !== 'string' || isNaN(Date.parse(value))) return 'Expected valid date string'
                break
            case AttributeDataType.REF:
                if (typeof value !== 'string') return 'Expected UUID string'
                break
        }
        return null
    }

    private validateRules(value: unknown, rules: any, fieldName: string): string[] {
        const errors: string[] = []
        const stringValue = typeof value === 'string' ? value : this.extractLocalizedString(value)

        if (typeof stringValue === 'string') {
            if (rules.minLength !== undefined && stringValue.length < rules.minLength) {
                errors.push(`Field "${fieldName}": minimum length is ${rules.minLength}`)
            }
            if (rules.maxLength !== undefined && stringValue.length > rules.maxLength) {
                errors.push(`Field "${fieldName}": maximum length is ${rules.maxLength}`)
            }
            if (rules.pattern) {
                try {
                    const regex = new RegExp(rules.pattern)
                    if (!regex.test(stringValue)) {
                        errors.push(`Field "${fieldName}": does not match pattern`)
                    }
                } catch { }
            }
            if (rules.options && !rules.options.includes(stringValue)) {
                errors.push(`Field "${fieldName}": must be one of [${rules.options.join(', ')}]`)
            }
        }
        if (typeof value === 'number') {
            if (rules.min !== undefined && value < rules.min) {
                errors.push(`Field "${fieldName}": minimum value is ${rules.min}`)
            }
            if (rules.max !== undefined && value > rules.max) {
                errors.push(`Field "${fieldName}": maximum value is ${rules.max}`)
            }
        }
        return errors
    }

    private extractLocalizedString(value: unknown): string | null {
        if (typeof value === 'string') return value
        if (!isLocalizedContent(value)) return null
        const filtered = filterLocalizedContent(value as VersionedLocalizedContent<string>)
        if (!filtered) return null
        const primary = filtered._primary
        const entry = filtered.locales[primary]
        return typeof entry?.content === 'string' ? entry.content : null
    }

    private hasAnyLocalizedContent(value: unknown): boolean {
        if (!isLocalizedContent(value)) return false
        const filtered = filterLocalizedContent(value as VersionedLocalizedContent<string>)
        if (!filtered) return false
        return Object.values(filtered.locales).some((entry) => typeof entry?.content === 'string' && entry.content.trim() !== '')
    }
}
