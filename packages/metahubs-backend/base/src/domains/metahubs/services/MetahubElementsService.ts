import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { MetahubObjectsService } from './MetahubObjectsService'
import { MetahubAttributesService } from './MetahubAttributesService'
import { isLocalizedContent, filterLocalizedContent, validateNumber } from '@universo/utils'
import { AttributeDataType, VersionedLocalizedContent } from '@universo/types'
import { escapeLikeWildcards } from '../../../utils'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'

/**
 * MetahubElementsService - CRUD operations for predefined elements in Design-Time.
 *
 * Elements are stored in the `_mhb_elements` system table within isolated schemas (mhb_<uuid>).
 * Each element references a catalog via `object_id` foreign key.
 *
 * Note: This is Design-Time data (predefined elements for catalogs).
 * Run-Time data is stored in Application schemas (app_<uuid>) after publication.
 */
export class MetahubElementsService {
    constructor(
        private schemaService: MetahubSchemaService,
        private objectsService: MetahubObjectsService,
        private attributesService: MetahubAttributesService
    ) { }

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Count elements for a specific catalog.
     */
    async countByObjectId(metahubId: string, objectId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const result = await this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
            .where({ object_id: objectId })
            .count('* as count')
            .first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    /**
     * Count elements for multiple catalogs (batch operation).
     */
    async countByObjectIds(metahubId: string, objectIds: string[], userId?: string): Promise<Map<string, number>> {
        if (objectIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const results = await this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
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
     * Find all elements for multiple catalogs.
     * Elements in Metahubs are treated as predefined (design-time data).
     */
    async findAllByObjectIds(metahubId: string, objectIds: string[], userId?: string) {
        if (objectIds.length === 0) return []

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const elements = await this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
            .whereIn('object_id', objectIds)
            .orderBy('object_id', 'asc')
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

        return elements.map((element: any) => ({
            id: element.id,
            objectId: element.object_id,
            data: element.data ?? {},
            sortOrder: element.sort_order ?? 0
        }))
    }

    /**
     * Find all elements for a catalog with pagination and search.
     */
    async findAll(metahubId: string, catalogId: string, options: {
        limit?: number
        offset?: number
        sortBy?: string
        sortOrder?: 'asc' | 'desc'
        search?: string
    } = {}, userId?: string) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw new Error('Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        // Query _mhb_elements table with object_id filter
        let query = this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
            .where({ object_id: catalogId })

        if (options.search) {
            const escapedSearch = escapeLikeWildcards(options.search)
            query = query.whereRaw('data::text ILIKE ?', [`%${escapedSearch}%`])
        }

        const sortColumn = options.sortBy === 'created' ? '_upl_created_at'
            : options.sortBy === 'updated' ? '_upl_updated_at'
                : 'sort_order'
        query = query.orderBy(sortColumn, options.sortOrder || 'asc')

        if (options.limit) query = query.limit(options.limit)
        if (options.offset) query = query.offset(options.offset)

        const items = await query
        return items.map((element: any) => this.mapRowToElement(element))
    }

    /**
     * Find all elements for a catalog with count (for pagination).
     */
    async findAllAndCount(metahubId: string, catalogId: string, options: {
        limit?: number
        offset?: number
        sortBy?: string
        sortOrder?: 'asc' | 'desc'
        search?: string
    } = {}, userId?: string) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw new Error('Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        // Base query with object_id filter
        let query = this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
            .where({ object_id: catalogId })

        if (options.search) {
            const escapedSearch = escapeLikeWildcards(options.search)
            query = query.whereRaw('data::text ILIKE ?', [`%${escapedSearch}%`])
        }

        // Clone for count before applying pagination
        const countResult = await query.clone().count('* as total').first()
        const total = countResult ? parseInt(countResult.total as string, 10) : 0

        // Apply sorting
        const sortColumn = options.sortBy === 'created' ? '_upl_created_at'
            : options.sortBy === 'updated' ? '_upl_updated_at'
                : 'sort_order'
        query = query.orderBy(sortColumn, options.sortOrder || 'asc')

        // Apply pagination
        if (options.limit) query = query.limit(options.limit)
        if (options.offset) query = query.offset(options.offset)

        const items = await query
        return { items: items.map((element: any) => this.mapRowToElement(element)), total }
    }

    /**
     * Find a single element by ID.
     */
    async findById(metahubId: string, catalogId: string, id: string, userId?: string) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) return null

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
            .where({ id, object_id: catalogId })
            .first()

        return row ? this.mapRowToElement(row) : null
    }

    /**
     * Create a new element in a catalog.
     */
    async create(metahubId: string, catalogId: string, input: {
        data: Record<string, unknown>
        sortOrder?: number
        createdBy?: string | null
    }, userId?: string) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw new Error('Catalog not found')

        // Validate element data against catalog attributes
        const attributes = await this.attributesService.findAll(metahubId, catalogId, userId)
        const validation = this.validateElementData(input.data, attributes)
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        // Insert into _mhb_elements table
        const [created] = await this.knex
            .withSchema(schemaName)
            .into('_mhb_elements')
            .insert({
                object_id: catalogId,
                data: input.data,
                sort_order: input.sortOrder ?? 0,
                owner_id: null,
                _upl_created_at: new Date(),
                _upl_created_by: input.createdBy ?? null,
                _upl_updated_at: new Date(),
                _upl_updated_by: input.createdBy ?? null
            })
            .returning('*')

        return this.mapRowToElement(created)
    }

    /**
     * Update an existing element.
     */
    async update(metahubId: string, catalogId: string, id: string, input: {
        data?: Record<string, unknown>
        sortOrder?: number
        updatedBy?: string | null
        expectedVersion?: number
    }, userId?: string) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw new Error('Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        // Find existing element
        const existing = await this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
            .where({ id, object_id: catalogId })
            .first()

        if (!existing) throw new Error('Element not found')

        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: input.updatedBy ?? null
        }

        if (input.data) {
            const mergedData = { ...existing.data, ...input.data }
            const attributes = await this.attributesService.findAll(metahubId, catalogId, userId)
            const validation = this.validateElementData(mergedData, attributes)
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
            }
            updateData.data = mergedData
        }

        if (input.sortOrder !== undefined) {
            updateData.sort_order = input.sortOrder
        }

        // If expectedVersion is provided, use version-checked update
        if (input.expectedVersion !== undefined) {
            const updated = await updateWithVersionCheck({
                knex: this.knex,
                schemaName,
                tableName: '_mhb_elements',
                entityId: id,
                entityType: 'element',
                expectedVersion: input.expectedVersion,
                updateData
            })
            return this.mapRowToElement(updated)
        }

        // Fallback: increment version without check (backwards compatibility)
        const updated = await incrementVersion(this.knex, schemaName, '_mhb_elements', id, updateData)
        return updated ? this.mapRowToElement(updated) : null
    }

    /**
     * Delete an element.
     */
    async delete(metahubId: string, catalogId: string, id: string, userId?: string) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw new Error('Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const deleted = await this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
            .where({ id, object_id: catalogId })
            .delete()

        if (deleted === 0) {
            throw new Error('Element not found')
        }
    }

    // Validation helpers
    private validateElementData(data: Record<string, unknown>, attributes: any[]): { valid: boolean; errors: string[] } {
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

            const typeError = this.validateType(value, attr)
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

    private mapRowToElement(row: any) {
        return {
            id: row.id,
            catalogId: row.object_id,
            data: row.data ?? {},
            ownerId: row.owner_id ?? null,
            sortOrder: row.sort_order ?? 0,
            version: row._upl_version || 1,
            createdAt: row._upl_created_at,
            updatedAt: row._upl_updated_at
        }
    }

    private validateType(value: unknown, attr: any): string | null {
        const dataType = attr.dataType as AttributeDataType
        const rules = attr.validationRules ?? {}

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
                return this.validateDateValue(value, rules)
            case AttributeDataType.REF:
                if (typeof value !== 'string') return 'Expected UUID string'
                break
        }
        return null
    }

    private validateDateValue(value: unknown, rules: any): string | null {
        if (typeof value !== 'string') return 'Expected date/time string'

        const composition = rules?.dateComposition ?? 'datetime'
        if (composition === 'time') {
            return this.isValidTimeString(value) ? null : 'Expected time string'
        }
        if (composition === 'date') {
            return this.isValidDateString(value) ? null : 'Expected date string'
        }

        // Default: datetime
        if (isNaN(Date.parse(value))) return 'Expected valid date/time string'
        return null
    }

    private isValidTimeString(value: string): boolean {
        return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?$/.test(value)
    }

    private isValidDateString(value: string): boolean {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
        const date = new Date(`${value}T00:00:00`)
        return !isNaN(date.getTime())
    }

    private validateRules(value: unknown, rules: any, fieldName: string): string[] {
        const errors: string[] = []
        const stringValue = typeof value === 'string' ? value : this.extractLocalizedString(value)

        if (typeof stringValue === 'string') {
            if (rules.minLength !== undefined && stringValue.length < rules.minLength) {
                errors.push(`Field "${fieldName}": minimum length is ${rules.minLength}`)
            }
            if (rules.maxLength !== undefined && rules.maxLength !== null && stringValue.length > rules.maxLength) {
                errors.push(`Field "${fieldName}": maximum length is ${rules.maxLength}`)
            }
            if (rules.pattern) {
                try {
                    const regex = new RegExp(rules.pattern)
                    if (!regex.test(stringValue)) {
                        errors.push(`Field "${fieldName}": does not match pattern`)
                    }
                } catch { /* ignore invalid regex */ }
            }
            if (rules.options && !rules.options.includes(stringValue)) {
                errors.push(`Field "${fieldName}": must be one of [${rules.options.join(', ')}]`)
            }
        }
        if (typeof value === 'number') {
            // Use shared validator for comprehensive precision/scale checks
            const result = validateNumber(value, {
                precision: rules.precision,
                scale: rules.scale,
                min: rules.min ?? undefined,
                max: rules.max ?? undefined,
                nonNegative: rules.nonNegative
            })

            if (!result.valid && result.errorMessage) {
                errors.push(`Field "${fieldName}": ${result.errorMessage}`)
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
