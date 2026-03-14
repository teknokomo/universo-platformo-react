import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import { MetahubSchemaService } from './MetahubSchemaService'
import { MetahubObjectsService } from './MetahubObjectsService'
import { MetahubAttributesService } from './MetahubAttributesService'
import { isLocalizedContent, filterLocalizedContent, validateNumber } from '@universo/utils'
import { AttributeDataType, VersionedLocalizedContent } from '@universo/types'
import { escapeLikeWildcards } from '../../../utils'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

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
        private exec: DbExecutor,
        private schemaService: MetahubSchemaService,
        private objectsService: MetahubObjectsService,
        private attributesService: MetahubAttributesService
    ) {}

    private createServiceError(code: 'CATALOG_NOT_FOUND' | 'ELEMENT_NOT_FOUND' | 'ELEMENT_VALIDATION_FAILED', message: string): Error {
        const error: Error & { code?: string } = new Error(message)
        error.code = code
        return error
    }

    private buildSortOrderLockKey(schemaName: string, catalogId: string): string {
        return `mhb-elements-sort:${schemaName}:${catalogId}`
    }

    /**
     * Serialize sort-order mutations per catalog.
     * Uses transaction-scoped advisory lock, auto-released on commit/rollback.
     */
    private async acquireSortOrderLockInTransaction(db: SqlQueryable, schemaName: string, catalogId: string): Promise<void> {
        const lockKey = this.buildSortOrderLockKey(schemaName, catalogId)
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey])
    }

    private async getNextSortOrder(schemaName: string, catalogId: string, db: SqlQueryable): Promise<number> {
        const qt = qSchemaTable(schemaName, '_mhb_elements')
        const result = await queryOne<{ max: number | string | null }>(
            db,
            `SELECT MAX(sort_order) AS max FROM ${qt} WHERE object_id = $1 AND ${ACTIVE}`,
            [catalogId]
        )

        const max = result?.max
        if (typeof max === 'number') return max + 1
        const parsed = max !== undefined && max !== null ? Number(max) : 0
        return Number.isFinite(parsed) ? parsed + 1 : 1
    }

    private async ensureSequentialSortOrderInTransaction(schemaName: string, catalogId: string, db: SqlQueryable): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const rows = await queryMany<{ id: string; sort_order: number | null }>(
            db,
            `SELECT id, sort_order FROM ${qt}
             WHERE object_id = $1 AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC, id ASC`,
            [catalogId]
        )

        let hasGaps = false
        for (let index = 0; index < rows.length; index += 1) {
            if ((rows[index].sort_order ?? 0) !== index + 1) {
                hasGaps = true
                break
            }
        }
        if (!hasGaps) return

        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index]
            const nextSortOrder = index + 1
            if ((row.sort_order ?? 0) !== nextSortOrder) {
                await db.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [nextSortOrder, row.id])
            }
        }
    }

    /**
     * Count elements for a specific catalog.
     */
    async countByObjectId(metahubId: string, objectId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const result = await queryOne<{ count: number | string }>(
            this.exec,
            `SELECT COUNT(*)::int AS count FROM ${qt} WHERE object_id = $1 AND ${ACTIVE}`,
            [objectId]
        )
        return result ? parseInt(String(result.count), 10) : 0
    }

    /**
     * Count elements for multiple catalogs (batch operation).
     */
    async countByObjectIds(metahubId: string, objectIds: string[], userId?: string): Promise<Map<string, number>> {
        if (objectIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const results = await queryMany<{ object_id: string; count: number | string }>(
            this.exec,
            `SELECT object_id, COUNT(*)::int AS count
             FROM ${qt}
             WHERE object_id = ANY($1::uuid[]) AND ${ACTIVE}
             GROUP BY object_id`,
            [objectIds]
        )

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
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const elements = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = ANY($1::uuid[]) AND ${ACTIVE}
             ORDER BY object_id ASC, sort_order ASC, _upl_created_at ASC`,
            [objectIds]
        )

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
    async findAll(
        metahubId: string,
        catalogId: string,
        options: {
            limit?: number
            offset?: number
            sortBy?: string
            sortOrder?: 'asc' | 'desc'
            search?: string
        } = {},
        userId?: string
    ) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw this.createServiceError('CATALOG_NOT_FOUND', 'Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const conditions: string[] = ['object_id = $1', ACTIVE]
        const params: unknown[] = [catalogId]
        let paramIdx = 2

        if (options.search) {
            const escapedSearch = `%${escapeLikeWildcards(options.search)}%`
            conditions.push(`data::text ILIKE $${paramIdx}`)
            params.push(escapedSearch)
            paramIdx++
        }

        const whereClause = conditions.join(' AND ')

        const sortColumn =
            options.sortBy === 'created' ? '_upl_created_at' : options.sortBy === 'updated' ? '_upl_updated_at' : 'sort_order'
        const dir = options.sortOrder === 'desc' ? 'DESC' : 'ASC'
        let orderBy = `${sortColumn} ${dir}`
        if (sortColumn === 'sort_order') {
            orderBy += `, _upl_created_at ${dir}, id ${dir}`
        } else {
            orderBy += `, id ${dir}`
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

        const items = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt} WHERE ${whereClause} ORDER BY ${orderBy}${paginationClause}`,
            queryParams
        )
        return items.map((element: any) => this.mapRowToElement(element))
    }

    /**
     * Find all elements for a catalog with count (for pagination).
     */
    async findAllAndCount(
        metahubId: string,
        catalogId: string,
        options: {
            limit?: number
            offset?: number
            sortBy?: string
            sortOrder?: 'asc' | 'desc'
            search?: string
        } = {},
        userId?: string
    ) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw this.createServiceError('CATALOG_NOT_FOUND', 'Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const conditions: string[] = ['object_id = $1', ACTIVE]
        const baseParams: unknown[] = [catalogId]
        let paramIdx = 2

        if (options.search) {
            const escapedSearch = `%${escapeLikeWildcards(options.search)}%`
            conditions.push(`data::text ILIKE $${paramIdx}`)
            baseParams.push(escapedSearch)
            paramIdx++
        }

        const whereClause = conditions.join(' AND ')
        const countParams = [...baseParams]

        const sortColumn =
            options.sortBy === 'created' ? '_upl_created_at' : options.sortBy === 'updated' ? '_upl_updated_at' : 'sort_order'
        const dir = options.sortOrder === 'desc' ? 'DESC' : 'ASC'
        let orderBy = `${sortColumn} ${dir}`
        if (sortColumn === 'sort_order') {
            orderBy += `, _upl_created_at ${dir}, id ${dir}`
        } else {
            orderBy += `, id ${dir}`
        }

        let paginationClause = ''
        const queryParams = [...baseParams]
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

        const [items, countResult] = await Promise.all([
            queryMany<Record<string, unknown>>(
                this.exec,
                `SELECT * FROM ${qt} WHERE ${whereClause} ORDER BY ${orderBy}${paginationClause}`,
                queryParams
            ),
            queryOne<{ total: string }>(this.exec, `SELECT COUNT(*) AS total FROM ${qt} WHERE ${whereClause}`, countParams)
        ])

        const total = countResult ? parseInt(countResult.total, 10) : 0
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
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const row = await queryOne<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
            [id, catalogId]
        )

        return row ? this.mapRowToElement(row) : null
    }

    /**
     * Create a new element in a catalog.
     */
    async create(
        metahubId: string,
        catalogId: string,
        input: {
            data: Record<string, unknown>
            sortOrder?: number
            createdBy?: string | null
        },
        userId?: string
    ) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw this.createServiceError('CATALOG_NOT_FOUND', 'Catalog not found')

        // Validate element data against catalog attributes (use findAllFlat to include child attrs for TABLE validation)
        const attributes = await this.attributesService.findAllFlat(metahubId, catalogId, userId)
        const validation = this.validateElementData(input.data, attributes)
        if (!validation.valid) {
            throw this.createServiceError('ELEMENT_VALIDATION_FAILED', `Validation failed: ${validation.errors.join(', ')}`)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireSortOrderLockInTransaction(tx, schemaName, catalogId)

            const sortOrder =
                typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
                    ? input.sortOrder
                    : await this.getNextSortOrder(schemaName, catalogId, tx)

            const now = new Date()

            const created = await queryOneOrThrow<Record<string, unknown>>(
                tx,
                `INSERT INTO ${qt}
                    (object_id, data, sort_order, owner_id,
                     _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                 VALUES ($1, $2::jsonb, $3, NULL, $4, $5, $4, $5)
                 RETURNING *`,
                [catalogId, JSON.stringify(input.data), sortOrder, now, input.createdBy ?? null]
            )

            await this.ensureSequentialSortOrderInTransaction(schemaName, catalogId, tx)

            const normalized = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1 LIMIT 1`, [created.id])
            return this.mapRowToElement(normalized ?? created)
        })
    }

    /**
     * Update an existing element.
     */
    async update(
        metahubId: string,
        catalogId: string,
        id: string,
        input: {
            data?: Record<string, unknown>
            sortOrder?: number
            updatedBy?: string | null
            expectedVersion?: number
        },
        userId?: string
    ) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw this.createServiceError('CATALOG_NOT_FOUND', 'Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        // Find existing element
        const existing = await queryOne<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
            [id, catalogId]
        )

        if (!existing) throw this.createServiceError('ELEMENT_NOT_FOUND', 'Element not found')

        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: input.updatedBy ?? null
        }

        if (input.data) {
            const mergedData = { ...(existing.data as Record<string, unknown>), ...input.data }
            // Use findAllFlat to include child attrs for TABLE validation
            const attributes = await this.attributesService.findAllFlat(metahubId, catalogId, userId)
            const validation = this.validateElementData(mergedData, attributes)
            if (!validation.valid) {
                throw this.createServiceError('ELEMENT_VALIDATION_FAILED', `Validation failed: ${validation.errors.join(', ')}`)
            }
            updateData.data = mergedData
        }

        if (input.sortOrder !== undefined) {
            updateData.sort_order = input.sortOrder
        }

        // If expectedVersion is provided, use version-checked update
        if (input.expectedVersion !== undefined) {
            const updated = await updateWithVersionCheck({
                executor: this.exec,
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
        const updated = await incrementVersion(this.exec, schemaName, '_mhb_elements', id, updateData)
        return updated ? this.mapRowToElement(updated) : null
    }

    /**
     * Delete an element.
     */
    async delete(metahubId: string, catalogId: string, id: string, userId?: string) {
        // Verify catalog exists
        const catalog = await this.objectsService.findById(metahubId, catalogId, userId)
        if (!catalog) throw this.createServiceError('CATALOG_NOT_FOUND', 'Catalog not found')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        await this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireSortOrderLockInTransaction(tx, schemaName, catalogId)

            const deleted = await tx.query<{ id: string }>(
                `DELETE FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} RETURNING id`,
                [id, catalogId]
            )

            if (deleted.length === 0) {
                throw this.createServiceError('ELEMENT_NOT_FOUND', 'Element not found')
            }

            await this.ensureSequentialSortOrderInTransaction(schemaName, catalogId, tx)
        })
    }

    async moveElement(metahubId: string, catalogId: string, elementId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireSortOrderLockInTransaction(tx, schemaName, catalogId)
            await this.ensureSequentialSortOrderInTransaction(schemaName, catalogId, tx)

            const current = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [elementId, catalogId]
            )
            if (!current) throw this.createServiceError('ELEMENT_NOT_FOUND', 'Element not found')

            const currentOrder = (current.sort_order as number) ?? 0
            const neighbor =
                direction === 'up'
                    ? await queryOne<Record<string, unknown>>(
                          tx,
                          `SELECT * FROM ${qt}
                           WHERE object_id = $1 AND ${ACTIVE} AND sort_order < $2
                           ORDER BY sort_order DESC LIMIT 1`,
                          [catalogId, currentOrder]
                      )
                    : await queryOne<Record<string, unknown>>(
                          tx,
                          `SELECT * FROM ${qt}
                           WHERE object_id = $1 AND ${ACTIVE} AND sort_order > $2
                           ORDER BY sort_order ASC LIMIT 1`,
                          [catalogId, currentOrder]
                      )

            if (neighbor) {
                const now = new Date()
                const temporarySortOrder = 0

                // Move current row outside active range first to avoid unique index conflicts
                await tx.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4 AND object_id = $5`,
                    [temporarySortOrder, now, userId ?? null, elementId, catalogId]
                )
                await tx.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4 AND object_id = $5`,
                    [currentOrder, now, userId ?? null, neighbor.id, catalogId]
                )
                await tx.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4 AND object_id = $5`,
                    [neighbor.sort_order, now, userId ?? null, elementId, catalogId]
                )
            }

            await this.ensureSequentialSortOrderInTransaction(schemaName, catalogId, tx)

            const updated = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [elementId, catalogId]
            )
            if (!updated) throw this.createServiceError('ELEMENT_NOT_FOUND', 'Element not found')
            return this.mapRowToElement(updated)
        })
    }

    async reorderElement(metahubId: string, catalogId: string, elementId: string, newSortOrder: number, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireSortOrderLockInTransaction(tx, schemaName, catalogId)
            await this.ensureSequentialSortOrderInTransaction(schemaName, catalogId, tx)

            const current = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [elementId, catalogId]
            )
            if (!current) throw this.createServiceError('ELEMENT_NOT_FOUND', 'Element not found')

            const oldOrder = current.sort_order as number
            const totalResult = await queryOne<{ count: number | string }>(
                tx,
                `SELECT COUNT(id) AS count FROM ${qt} WHERE object_id = $1 AND ${ACTIVE}`,
                [catalogId]
            )
            const totalRaw = totalResult?.count
            const totalCount = typeof totalRaw === 'number' ? totalRaw : totalRaw ? Number.parseInt(String(totalRaw), 10) : 0
            const maxSortOrder = Math.max(1, totalCount)
            const clampedNew = Math.min(Math.max(1, newSortOrder), maxSortOrder)
            const now = new Date()

            if (oldOrder !== clampedNew) {
                const temporarySortOrder = 0

                // Move current row outside active range first to avoid unique index conflicts
                await tx.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4 AND object_id = $5`,
                    [temporarySortOrder, now, userId ?? null, elementId, catalogId]
                )

                if (clampedNew < oldOrder) {
                    await tx.query(
                        `UPDATE ${qt}
                         SET sort_order = sort_order + 1, _upl_updated_at = $1, _upl_updated_by = $2
                         WHERE object_id = $3 AND ${ACTIVE}
                           AND sort_order >= $4 AND sort_order < $5
                           AND id != $6`,
                        [now, userId ?? null, catalogId, clampedNew, oldOrder, elementId]
                    )
                } else {
                    await tx.query(
                        `UPDATE ${qt}
                         SET sort_order = sort_order - 1, _upl_updated_at = $1, _upl_updated_by = $2
                         WHERE object_id = $3 AND ${ACTIVE}
                           AND sort_order > $4 AND sort_order <= $5
                           AND id != $6`,
                        [now, userId ?? null, catalogId, oldOrder, clampedNew, elementId]
                    )
                }

                await tx.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4 AND object_id = $5`,
                    [clampedNew, now, userId ?? null, elementId, catalogId]
                )
            }

            await this.ensureSequentialSortOrderInTransaction(schemaName, catalogId, tx)

            const updated = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [elementId, catalogId]
            )
            if (!updated) throw this.createServiceError('ELEMENT_NOT_FOUND', 'Element not found')
            return this.mapRowToElement(updated)
        })
    }

    // Validation helpers
    private validateElementData(data: Record<string, unknown>, attributes: any[]): { valid: boolean; errors: string[] } {
        const errors: string[] = []
        const rootAttributes = attributes.filter((a) => !a.parentAttributeId)
        const attributeMap = new Map(rootAttributes.map((a) => [a.codename, a]))

        // Check required fields (root-level only)
        for (const attr of rootAttributes) {
            if (attr.isRequired && !this.hasRequiredValue(attr, data[attr.codename])) {
                errors.push(`Field "${attr.codename}" is required`)
            }
        }

        // Validate each field
        for (const [key, value] of Object.entries(data)) {
            const attr = attributeMap.get(key)
            if (!attr) continue // Unknown field allowed

            if (value === null || value === undefined) continue

            // TABLE type: validate as array of child objects
            if (attr.dataType === AttributeDataType.TABLE) {
                if (!Array.isArray(value)) {
                    errors.push(`Field "${key}" (TABLE): expected array`)
                    continue
                }
                const childAttrs = attributes.filter((a) => a.parentAttributeId === attr.id)
                for (let i = 0; i < value.length; i++) {
                    const row = value[i]
                    if (typeof row !== 'object' || row === null) {
                        errors.push(`Field "${key}" row ${i}: expected object`)
                        continue
                    }
                    for (const child of childAttrs) {
                        const childValue = (row as Record<string, unknown>)[child.codename]
                        if (child.isRequired && (childValue === null || childValue === undefined)) {
                            errors.push(`Field "${key}" row ${i}: child "${child.codename}" is required`)
                        }
                        if (childValue !== null && childValue !== undefined) {
                            const typeError = this.validateType(childValue, child)
                            if (typeError) {
                                errors.push(`Field "${key}" row ${i}, child "${child.codename}": ${typeError}`)
                            }
                            // Validate child field rules (nonNegative, min, max, precision, scale, minLength, maxLength, pattern)
                            const ruleErrors = this.validateRules(childValue, child.validationRules || {}, `${key}[${i}].${child.codename}`)
                            errors.push(...ruleErrors)
                        }
                    }
                }
                // Validate minRows / maxRows constraints
                const tableRules = attr.validationRules || {}
                if (typeof tableRules.minRows === 'number' && value.length < tableRules.minRows) {
                    errors.push(`Field "${key}": minimum ${tableRules.minRows} row(s) required, got ${value.length}`)
                }
                if (typeof tableRules.maxRows === 'number' && value.length > tableRules.maxRows) {
                    errors.push(`Field "${key}": maximum ${tableRules.maxRows} row(s) allowed, got ${value.length}`)
                }
                continue
            }

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
        if (attr.dataType === AttributeDataType.TABLE) {
            if (!Array.isArray(value)) return false
            const minRows = typeof attr.validationRules?.minRows === 'number' ? attr.validationRules.minRows : 1
            return value.length >= Math.max(1, minRows)
        }
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
                } catch {
                    /* ignore invalid regex */
                }
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
