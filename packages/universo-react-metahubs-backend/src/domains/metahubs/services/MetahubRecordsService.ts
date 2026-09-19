import type { DbExecutor, SqlQueryable } from '@universo-react/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import { MetahubSchemaService } from './MetahubSchemaService'
import { MetahubObjectsService } from './MetahubObjectsService'
import { MetahubComponentsService } from './MetahubComponentsService'
import {
    filterLocalizedContent,
    isLocalizedContent,
    isUsableValidationPattern,
    isUsableValidationPatternValue,
    isValidUuid,
    validateNumber
} from '@universo-react/utils'
import { ComponentDefinitionDataType, normalizeInterpretationNetworkHexColor, VersionedLocalizedContent } from '@universo-react/types'
import { escapeLikeWildcards } from '../../../utils'
import { assertExpectedVersion, updateWithVersionCheck } from '../../../utils/optimisticLock'
import {
    MetahubNotFoundError,
    MetahubRecordKeyDuplicateError,
    MetahubRecordReferencedError,
    MetahubRecordReferenceMissingError,
    MetahubValidationError
} from '../../shared/domainErrors'

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

type RecordComponent = {
    id: string
    codename: string
    dataType: ComponentDefinitionDataType
    isRequired: boolean
    parentComponentId: string | null
    targetEntityId?: string | null
    validationRules?: Record<string, unknown>
}

/** A REF component of any object in the metahub that points at the deleted object. */
type ReferencingComponent = {
    component: RecordComponent
    /** Codename of the TABLE parent when the REF lives inside table rows. */
    parentCodename?: string
}

type MetahubRecordDto = {
    id: string
    objectCollectionId: string
    data: Record<string, unknown>
    ownerId: string | null
    sortOrder: number
    version: number
    createdAt: unknown
    updatedAt: unknown
}

const optionalNumberRule = (rules: Record<string, unknown>, key: string): number | undefined =>
    typeof rules[key] === 'number' ? (rules[key] as number) : undefined

const coerceRecordData = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const coerceNumber = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * MetahubRecordsService manages design-time records stored in `_mhb_elements`.
 *
 * The underlying persistence table still uses the historical elements naming,
 * but the active service contract treats those rows as entity records attached to an object.
 */
export class MetahubRecordsService {
    constructor(
        private exec: DbExecutor,
        private schemaService: MetahubSchemaService,
        private objectsService: MetahubObjectsService,
        private componentsService: MetahubComponentsService
    ) {}

    private buildSortOrderLockKey(schemaName: string, objectCollectionId: string): string {
        return `mhb-elements-sort:${schemaName}:${objectCollectionId}`
    }

    /**
     * Serialize sort-order mutations per object.
     * Uses transaction-scoped advisory lock, auto-released on commit/rollback.
     */
    private async acquireSortOrderLockInTransaction(db: SqlQueryable, schemaName: string, objectCollectionId: string): Promise<void> {
        const lockKey = this.buildSortOrderLockKey(schemaName, objectCollectionId)
        await acquireAdvisoryXactLock(db, lockKey)
    }

    /**
     * Mirror the persisted row order into the `SortOrder` component value.
     *
     * Runtime surfaces (published marketing pages, widget ordering) sort by the
     * component column, while drag/move only rewrites the internal sort_order.
     * Keeping both in step makes authoring reorder observable in the published
     * application. Objects without a `SortOrder` component are left untouched.
     */
    private async syncSortOrderComponentValues(
        db: SqlQueryable,
        schemaName: string,
        objectCollectionId: string,
        userId?: string
    ): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_elements')
        await db.query(
            `UPDATE ${qt}
             SET data = jsonb_set(data, ARRAY['SortOrder'], to_jsonb(sort_order), true),
                 _upl_updated_at = NOW(),
                 _upl_updated_by = $2
             WHERE object_id = $1
               AND ${ACTIVE}
               AND jsonb_exists(data, 'SortOrder')
               AND jsonb_typeof(data -> 'SortOrder') = 'number'
               AND (data ->> 'SortOrder')::numeric IS DISTINCT FROM sort_order::numeric`,
            [objectCollectionId, userId ?? null]
        )
    }

    private async getNextSortOrder(schemaName: string, objectCollectionId: string, db: SqlQueryable): Promise<number> {
        const qt = qSchemaTable(schemaName, '_mhb_elements')
        const result = await queryOne<{ max: number | string | null }>(
            db,
            `SELECT MAX(sort_order) AS max FROM ${qt} WHERE object_id = $1 AND ${ACTIVE}`,
            [objectCollectionId]
        )

        const max = result?.max
        if (typeof max === 'number') return max + 1
        const parsed = max !== undefined && max !== null ? Number(max) : 0
        return Number.isFinite(parsed) ? parsed + 1 : 1
    }

    private async ensureSequentialSortOrderInTransaction(schemaName: string, objectCollectionId: string, db: SqlQueryable): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const rows = await queryMany<{ id: string; sort_order: number | null }>(
            db,
            `SELECT id, sort_order FROM ${qt}
             WHERE object_id = $1 AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC, id ASC`,
            [objectCollectionId]
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
     * Count elements for a specific object.
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
     * Count elements for multiple objects (batch operation).
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
        results.forEach((row) => {
            counts.set(row.object_id, parseInt(row.count as string, 10))
        })
        return counts
    }

    /**
     * Find all elements for multiple objects.
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

        return elements.map((element) => ({
            id: String(element.id),
            objectId: String(element.object_id),
            data: coerceRecordData(element.data),
            sortOrder: coerceNumber(element.sort_order, 0)
        }))
    }

    /**
     * Find all elements for a object with pagination and search.
     */
    async findAll(
        metahubId: string,
        objectCollectionId: string,
        options: {
            limit?: number
            offset?: number
            sortBy?: string
            sortOrder?: 'asc' | 'desc'
            search?: string
        } = {},
        userId?: string
    ) {
        // Verify object exists
        const object = await this.objectsService.findById(metahubId, objectCollectionId, userId)
        if (!object) throw new MetahubNotFoundError('Object')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const conditions: string[] = ['object_id = $1', ACTIVE]
        const params: unknown[] = [objectCollectionId]
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
        return items.map((element) => this.mapRowToRecord(element))
    }

    /**
     * Find all elements for a object with count (for pagination).
     */
    async findAllAndCount(
        metahubId: string,
        objectCollectionId: string,
        options: {
            limit?: number
            offset?: number
            sortBy?: string
            sortOrder?: 'asc' | 'desc'
            search?: string
        } = {},
        userId?: string
    ) {
        // Verify object exists
        const object = await this.objectsService.findById(metahubId, objectCollectionId, userId)
        if (!object) throw new MetahubNotFoundError('Object')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const conditions: string[] = ['object_id = $1', ACTIVE]
        const baseParams: unknown[] = [objectCollectionId]
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
        return { items: items.map((element) => this.mapRowToRecord(element)), total }
    }

    /**
     * Find a single element by ID.
     */
    async findById(metahubId: string, objectCollectionId: string, id: string, userId?: string) {
        // Verify object exists
        const object = await this.objectsService.findById(metahubId, objectCollectionId, userId)
        if (!object) return null

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        const row = await queryOne<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
            [id, objectCollectionId]
        )

        return row ? this.mapRowToRecord(row) : null
    }

    /**
     * Create a new element in a object.
     */
    async create(
        metahubId: string,
        objectCollectionId: string,
        input: {
            data: Record<string, unknown>
            sortOrder?: number
            createdBy?: string | null
        },
        userId?: string
    ) {
        // Verify object exists
        const object = await this.objectsService.findById(metahubId, objectCollectionId, userId)
        if (!object) throw new MetahubNotFoundError('Object')

        // Validate element data against object components (use findAllFlat to include child attrs for TABLE validation)
        const components = await this.componentsService.findAllFlat(metahubId, objectCollectionId, userId)
        const validation = this.validateRecordData(input.data, components)
        if (!validation.valid) {
            throw new MetahubValidationError(`Validation failed: ${validation.errors.join(', ')}`)
        }
        const normalizedData = this.normalizeHexColorFields(input.data, components)

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireSortOrderLockInTransaction(tx, schemaName, objectCollectionId)

            await this.assertUniqueComponentValues(tx, schemaName, objectCollectionId, components, normalizedData)
            await this.assertRefTargetsExist(tx, schemaName, components, normalizedData)

            const sortOrder =
                typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
                    ? input.sortOrder
                    : await this.getNextSortOrder(schemaName, objectCollectionId, tx)

            const now = new Date()

            const created = await queryOneOrThrow<Record<string, unknown>>(
                tx,
                `INSERT INTO ${qt}
                    (object_id, data, sort_order, owner_id,
                     _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                 VALUES ($1, $2::jsonb, $3, NULL, $4, $5, $4, $5)
                 RETURNING *`,
                [objectCollectionId, JSON.stringify(normalizedData), sortOrder, now, input.createdBy ?? null]
            )

            await this.ensureSequentialSortOrderInTransaction(schemaName, objectCollectionId, tx)

            const normalized = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1 LIMIT 1`, [created.id])
            return this.mapRowToRecord(normalized ?? created)
        })
    }

    /**
     * Update an existing element.
     */
    async update(
        metahubId: string,
        objectCollectionId: string,
        id: string,
        input: {
            data?: Record<string, unknown>
            sortOrder?: number
            updatedBy?: string | null
            expectedVersion?: number
        },
        userId?: string
    ) {
        // Verify object exists
        const object = await this.objectsService.findById(metahubId, objectCollectionId, userId)
        if (!object) throw new MetahubNotFoundError('Object')

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        // Find existing element
        const existing = await queryOne<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
            [id, objectCollectionId]
        )

        if (!existing) throw new MetahubNotFoundError('Element')

        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: input.updatedBy ?? null
        }

        let ruleComponents: RecordComponent[] = []
        if (input.data) {
            const mergedData = { ...(existing.data as Record<string, unknown>), ...input.data }
            // Use findAllFlat to include child attrs for TABLE validation
            const components = await this.componentsService.findAllFlat(metahubId, objectCollectionId, userId)
            const validation = this.validateRecordData(mergedData, components)
            if (!validation.valid) {
                throw new MetahubValidationError(`Validation failed: ${validation.errors.join(', ')}`)
            }
            ruleComponents = components
            updateData.data = this.normalizeHexColorFields(mergedData, components)
        }

        if (input.sortOrder !== undefined) {
            updateData.sort_order = input.sortOrder
        }

        return this.exec.transaction(async (tx: SqlQueryable) => {
            // Serialize with create/delete so two concurrent updates cannot both
            // pass the uniqueness check and commit duplicated keys.
            await this.acquireSortOrderLockInTransaction(tx, schemaName, objectCollectionId)

            // Conflict detection runs first and wins over key/reference
            // validation, so a stale editor receives the conflict-resolution
            // flow instead of a misleading validation error. It only locks and
            // compares the version: no write happens before validation passes,
            // because request-scoped executors reuse the middleware transaction
            // and a late throw would not roll the update back.
            const effectiveExpectedVersion =
                input.expectedVersion !== undefined
                    ? input.expectedVersion
                    : typeof existing._upl_version === 'number'
                    ? existing._upl_version
                    : 1
            await assertExpectedVersion({
                executor: tx,
                schemaName,
                tableName: '_mhb_elements',
                entityId: id,
                entityType: 'element',
                expectedVersion: effectiveExpectedVersion
            })

            if (updateData.data) {
                await this.assertUniqueComponentValues(
                    tx,
                    schemaName,
                    objectCollectionId,
                    ruleComponents,
                    updateData.data as Record<string, unknown>,
                    id
                )
                await this.assertRefTargetsExist(tx, schemaName, ruleComponents, updateData.data as Record<string, unknown>, input.data)
            }

            const updated = await updateWithVersionCheck({
                executor: tx,
                schemaName,
                tableName: '_mhb_elements',
                entityId: id,
                entityType: 'element',
                expectedVersion: effectiveExpectedVersion,
                updateData,
                // The version was just asserted on this executor; never open a
                // nested savepoint inside the caller's transaction.
                wrapInTransaction: false
            })

            return updated ? this.mapRowToRecord(updated) : null
        })
    }

    /**
     * Collect every REF component in the metahub that targets the deleted
     * object. Root REF components and REF components nested in TABLE rows are
     * both covered, because both can detach content after a delete.
     */
    private async findReferencingComponents(metahubId: string, targetObjectId: string, userId?: string): Promise<ReferencingComponent[]> {
        const components = (await this.componentsService.getAllComponents(metahubId, userId)) as unknown as RecordComponent[]
        const byId = new Map(components.map((component) => [component.id, component]))
        const referencing: ReferencingComponent[] = []

        for (const component of components) {
            if (component.dataType !== ComponentDefinitionDataType.REF || component.targetEntityId !== targetObjectId) continue
            if (!component.parentComponentId) {
                referencing.push({ component })
                continue
            }
            const parent = byId.get(component.parentComponentId)
            if (parent) referencing.push({ component, parentCodename: parent.codename })
        }

        return referencing
    }

    /**
     * Fail closed when any active record still references the deleted element,
     * so a delete cannot silently detach benefits or break the next sync.
     */
    private async assertElementNotReferenced(
        db: SqlQueryable,
        schemaName: string,
        elementId: string,
        references: readonly ReferencingComponent[]
    ): Promise<void> {
        if (references.length === 0) return

        const qt = qSchemaTable(schemaName, '_mhb_elements')
        for (const { component, parentCodename } of references) {
            // `e.id <> $4` keeps self-referencing records deletable, and the
            // jsonb_typeof guard keeps null/object values from failing the query.
            const referencing = parentCodename
                ? await queryOne<{ id: string }>(
                      db,
                      `SELECT e.id FROM ${qt} e
                       CROSS JOIN LATERAL jsonb_array_elements(
                           CASE WHEN jsonb_typeof(e.data -> $1::text) = 'array' THEN e.data -> $1::text ELSE '[]'::jsonb END
                       ) AS item
                       WHERE ${ACTIVE} AND item ->> $2::text = $3 AND e.id <> $4
                       LIMIT 1`,
                      [parentCodename, component.codename, elementId, elementId]
                  )
                : await queryOne<{ id: string }>(
                      db,
                      `SELECT e.id FROM ${qt} e WHERE ${ACTIVE} AND e.data ->> $1::text = $2 AND e.id <> $3 LIMIT 1`,
                      [component.codename, elementId, elementId]
                  )

            if (referencing) {
                throw new MetahubRecordReferencedError('Record', { componentCodename: component.codename })
            }
        }
    }

    private uniqueRootComponents(components: readonly RecordComponent[]): RecordComponent[] {
        return components.filter((component) => !component.parentComponentId && component.validationRules?.unique === true)
    }

    /**
     * Fail closed when a unique component (semantic key) value already exists in
     * the same object; duplicated keys silently merge or drop public content.
     */
    private async assertUniqueComponentValues(
        db: SqlQueryable,
        schemaName: string,
        objectCollectionId: string,
        components: readonly RecordComponent[],
        data: Record<string, unknown>,
        excludeId?: string
    ): Promise<void> {
        const uniqueComponents = this.uniqueRootComponents(components)
        if (uniqueComponents.length === 0) return

        const qt = qSchemaTable(schemaName, '_mhb_elements')
        for (const component of uniqueComponents) {
            const value = data[component.codename]
            if (typeof value !== 'string' || value.trim().length === 0) continue

            const conflict = await queryOne<{ id: string }>(
                db,
                `SELECT e.id FROM ${qt} e
                 WHERE ${ACTIVE}
                   AND e.object_id = $1
                   AND e.data ->> $2::text = $3
                   AND ($4::uuid IS NULL OR e.id <> $4::uuid)
                 LIMIT 1`,
                [objectCollectionId, component.codename, value, excludeId ?? null]
            )
            if (conflict) {
                throw new MetahubRecordKeyDuplicateError('Record', component.codename, value)
            }
        }
    }

    /**
     * Fail closed when a REF component points at a record that does not exist
     * (or is soft-deleted) in its target object. Root REF components and REF
     * components nested in TABLE rows are both covered, because either can
     * persist a reference-to-nowhere that only breaks during publication sync.
     * Values are grouped per target object so each target costs one probe.
     */
    private async assertRefTargetsExist(
        db: SqlQueryable,
        schemaName: string,
        components: readonly RecordComponent[],
        data: Record<string, unknown>,
        patch?: Record<string, unknown>
    ): Promise<void> {
        const refComponents = components.filter(
            (component) =>
                component.dataType === ComponentDefinitionDataType.REF &&
                typeof component.targetEntityId === 'string' &&
                component.targetEntityId.length > 0
        )
        if (refComponents.length === 0) return

        const componentsById = new Map(components.map((component) => [component.id, component]))
        /** target entity id -> referenced value -> offending component codename */
        const targets = new Map<string, Map<string, string>>()
        const register = (targetEntityId: string, value: unknown, codename: string): void => {
            if (typeof value !== 'string' || value.trim().length === 0) return
            const byValue = targets.get(targetEntityId) ?? new Map<string, string>()
            if (!byValue.has(value)) byValue.set(value, codename)
            targets.set(targetEntityId, byValue)
        }
        const isPatched = (codename: string): boolean => !patch || Object.prototype.hasOwnProperty.call(patch, codename)

        for (const component of refComponents) {
            const targetEntityId = component.targetEntityId as string
            if (!component.parentComponentId) {
                if (!isPatched(component.codename)) continue
                register(targetEntityId, data[component.codename], component.codename)
                continue
            }
            const parent = componentsById.get(component.parentComponentId)
            if (!parent) continue
            // A table row only changes when the parent TABLE value is patched;
            // otherwise legacy rows stay untouched by unrelated edits.
            if (!isPatched(parent.codename)) continue
            const rows = data[parent.codename]
            if (!Array.isArray(rows)) continue
            for (const row of rows) {
                if (!row || typeof row !== 'object' || Array.isArray(row)) continue
                register(targetEntityId, (row as Record<string, unknown>)[component.codename], component.codename)
            }
        }

        if (targets.size === 0) return

        const qt = qSchemaTable(schemaName, '_mhb_elements')
        for (const [targetEntityId, byValue] of targets) {
            const existing = await queryMany<{ id: string }>(
                db,
                `SELECT id FROM ${qt}
                 WHERE object_id = $1
                   AND id = ANY($2::uuid[])
                   AND ${ACTIVE}`,
                [targetEntityId, [...byValue.keys()]]
            )
            const existingIds = new Set(existing.map((row) => row.id))
            for (const [value, codename] of byValue) {
                if (!existingIds.has(value)) {
                    throw new MetahubRecordReferenceMissingError(codename, value)
                }
            }
        }
    }

    /**
     * Suggest a free value for a unique component, used by record copy flows so
     * duplicated records keep working without manual key editing.
     */
    async suggestUniqueComponentValue(
        metahubId: string,
        objectCollectionId: string,
        componentCodename: string,
        baseValue: string,
        userId?: string,
        limits?: { maxLength?: number | null; pattern?: string | null; format?: string | null }
    ): Promise<string> {
        const maxLength = limits?.maxLength ?? null
        const pattern = limits?.pattern ?? null
        const format = limits?.format ?? null
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')
        const rows = await queryMany<{ value: string | null }>(
            this.exec,
            `SELECT data ->> $1::text AS value FROM ${qt} WHERE object_id = $2 AND ${ACTIVE}`,
            [componentCodename, objectCollectionId]
        )
        const used = new Set(rows.map((row) => row.value).filter((value): value is string => typeof value === 'string' && value.length > 0))

        if (!used.has(baseValue)) return baseValue

        const limit = typeof maxLength === 'number' && Number.isFinite(maxLength) && maxLength > 0 ? Math.floor(maxLength) : null
        // Keep the suffixed key inside the component maxLength so a copied
        // record still passes the same validation as a manually authored one.
        const fitSuffix = (suffix: string): string => {
            if (limit === null || baseValue.length + suffix.length <= limit) return `${baseValue}${suffix}`
            // Trim the base on a separator boundary so the truncated key still
            // matches the semantic-key pattern (no doubled or trailing separators).
            const head = suffix.length >= limit ? '' : baseValue.slice(0, limit - suffix.length).replace(/[._-]+$/, '')
            if (head.length === 0) return suffix.replace(/^[._-]+/, '').slice(0, limit)
            return `${head}${suffix}`
        }

        const matchesPattern = (candidate: string): boolean => {
            if (format === 'hexColor' || !pattern || !isUsableValidationPattern(pattern)) return true
            try {
                return new RegExp(pattern).test(candidate)
            } catch {
                return true
            }
        }

        for (let index = 1; index <= 999; index += 1) {
            const candidate = fitSuffix(index === 1 ? '-copy' : `-copy-${index}`)
            if (!used.has(candidate) && matchesPattern(candidate)) return candidate
        }
        throw new MetahubValidationError(`Unable to suggest a unique value for ${componentCodename}`)
    }

    /**
     * Delete an element.
     */
    async delete(metahubId: string, objectCollectionId: string, id: string, userId?: string) {
        // Verify object exists
        const object = await this.objectsService.findById(metahubId, objectCollectionId, userId)
        if (!object) throw new MetahubNotFoundError('Object')

        const referencingComponents = await this.findReferencingComponents(metahubId, objectCollectionId, userId)
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        await this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireSortOrderLockInTransaction(tx, schemaName, objectCollectionId)

            const qt = qSchemaTable(schemaName, '_mhb_elements')
            const existing = await queryOne<{ id: string }>(
                tx,
                `SELECT id FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [id, objectCollectionId]
            )
            if (!existing) {
                throw new MetahubNotFoundError('Element')
            }

            await this.assertElementNotReferenced(tx, schemaName, id, referencingComponents)

            const deleted = await tx.query<{ id: string }>(
                `UPDATE ${qt}
                 SET _upl_deleted = true,
                     _upl_deleted_at = NOW(),
                     _upl_deleted_by = $3,
                     _mhb_deleted = true,
                     _mhb_deleted_at = NOW(),
                     _mhb_deleted_by = $3,
                     _upl_updated_at = NOW(),
                     _upl_version = _upl_version + 1
                 WHERE id = $1
                   AND object_id = $2
                   AND ${ACTIVE}
                 RETURNING id`,
                [id, objectCollectionId, userId ?? null]
            )

            if (deleted.length === 0) {
                throw new MetahubNotFoundError('Element')
            }

            await this.ensureSequentialSortOrderInTransaction(schemaName, objectCollectionId, tx)
        })
    }

    async moveRecord(metahubId: string, objectCollectionId: string, recordId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireSortOrderLockInTransaction(tx, schemaName, objectCollectionId)
            await this.ensureSequentialSortOrderInTransaction(schemaName, objectCollectionId, tx)

            const current = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [recordId, objectCollectionId]
            )
            if (!current) throw new MetahubNotFoundError('Element')

            const currentOrder = (current.sort_order as number) ?? 0
            const neighbor =
                direction === 'up'
                    ? await queryOne<Record<string, unknown>>(
                          tx,
                          `SELECT * FROM ${qt}
                           WHERE object_id = $1 AND ${ACTIVE} AND sort_order < $2
                           ORDER BY sort_order DESC LIMIT 1`,
                          [objectCollectionId, currentOrder]
                      )
                    : await queryOne<Record<string, unknown>>(
                          tx,
                          `SELECT * FROM ${qt}
                           WHERE object_id = $1 AND ${ACTIVE} AND sort_order > $2
                           ORDER BY sort_order ASC LIMIT 1`,
                          [objectCollectionId, currentOrder]
                      )

            if (neighbor) {
                const now = new Date()
                const temporarySortOrder = 0

                // Move current row outside active range first to avoid unique index conflicts
                await tx.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4 AND object_id = $5`,
                    [temporarySortOrder, now, userId ?? null, recordId, objectCollectionId]
                )
                await tx.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4 AND object_id = $5`,
                    [currentOrder, now, userId ?? null, neighbor.id, objectCollectionId]
                )
                await tx.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4 AND object_id = $5`,
                    [neighbor.sort_order, now, userId ?? null, recordId, objectCollectionId]
                )
            }

            await this.ensureSequentialSortOrderInTransaction(schemaName, objectCollectionId, tx)
            await this.syncSortOrderComponentValues(tx, schemaName, objectCollectionId, userId)

            const updated = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [recordId, objectCollectionId]
            )
            if (!updated) throw new MetahubNotFoundError('Element')
            return this.mapRowToRecord(updated)
        })
    }

    async reorderRecord(metahubId: string, objectCollectionId: string, recordId: string, newSortOrder: number, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_elements')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireSortOrderLockInTransaction(tx, schemaName, objectCollectionId)
            await this.ensureSequentialSortOrderInTransaction(schemaName, objectCollectionId, tx)

            const current = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [recordId, objectCollectionId]
            )
            if (!current) throw new MetahubNotFoundError('Element')

            const oldOrder = current.sort_order as number
            const totalResult = await queryOne<{ count: number | string }>(
                tx,
                `SELECT COUNT(id) AS count FROM ${qt} WHERE object_id = $1 AND ${ACTIVE}`,
                [objectCollectionId]
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
                    [temporarySortOrder, now, userId ?? null, recordId, objectCollectionId]
                )

                if (clampedNew < oldOrder) {
                    await tx.query(
                        `UPDATE ${qt}
                         SET sort_order = sort_order + 1, _upl_updated_at = $1, _upl_updated_by = $2
                         WHERE object_id = $3 AND ${ACTIVE}
                           AND sort_order >= $4 AND sort_order < $5
                           AND id != $6`,
                        [now, userId ?? null, objectCollectionId, clampedNew, oldOrder, recordId]
                    )
                } else {
                    await tx.query(
                        `UPDATE ${qt}
                         SET sort_order = sort_order - 1, _upl_updated_at = $1, _upl_updated_by = $2
                         WHERE object_id = $3 AND ${ACTIVE}
                           AND sort_order > $4 AND sort_order <= $5
                           AND id != $6`,
                        [now, userId ?? null, objectCollectionId, oldOrder, clampedNew, recordId]
                    )
                }

                await tx.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4 AND object_id = $5`,
                    [clampedNew, now, userId ?? null, recordId, objectCollectionId]
                )
            }

            await this.ensureSequentialSortOrderInTransaction(schemaName, objectCollectionId, tx)
            await this.syncSortOrderComponentValues(tx, schemaName, objectCollectionId, userId)

            const updated = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [recordId, objectCollectionId]
            )
            if (!updated) throw new MetahubNotFoundError('Element')
            return this.mapRowToRecord(updated)
        })
    }

    // Validation helpers
    private validateRecordData(data: Record<string, unknown>, components: RecordComponent[]): { valid: boolean; errors: string[] } {
        const errors: string[] = []
        const rootComponents = components.filter((a) => !a.parentComponentId)
        const componentMap = new Map(rootComponents.map((a) => [a.codename, a]))

        // Check required fields (root-level only)
        for (const cmp of rootComponents) {
            if (cmp.isRequired && !this.hasRequiredValue(cmp, data[cmp.codename])) {
                errors.push(`Field "${cmp.codename}" is required`)
            }
        }

        // Validate each field
        for (const [key, value] of Object.entries(data)) {
            const cmp = componentMap.get(key)
            if (!cmp) continue // Unknown field allowed

            if (value === null || value === undefined) continue

            // TABLE type: validate as array of child objects
            if (cmp.dataType === ComponentDefinitionDataType.TABLE) {
                if (!Array.isArray(value)) {
                    errors.push(`Field "${key}" (TABLE): expected array`)
                    continue
                }
                const childAttrs = components.filter((a) => a.parentComponentId === cmp.id)
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
                const tableRules = cmp.validationRules || {}
                if (typeof tableRules.minRows === 'number' && value.length < tableRules.minRows) {
                    errors.push(`Field "${key}": minimum ${tableRules.minRows} row(s) required, got ${value.length}`)
                }
                if (typeof tableRules.maxRows === 'number' && value.length > tableRules.maxRows) {
                    errors.push(`Field "${key}": maximum ${tableRules.maxRows} row(s) allowed, got ${value.length}`)
                }
                continue
            }

            const typeError = this.validateType(value, cmp)
            if (typeError) {
                errors.push(`Field "${key}": ${typeError}`)
                continue
            }

            const ruleErrors = this.validateRules(value, cmp.validationRules || {}, key)
            errors.push(...ruleErrors)
        }

        return { valid: errors.length === 0, errors }
    }

    /** Normalizes the closed opaque-colour format immediately before persistence. */
    private normalizeHexColorFields(data: Record<string, unknown>, components: RecordComponent[]): Record<string, unknown> {
        const normalizedData = { ...data }
        const rootComponents = components.filter((component) => !component.parentComponentId)

        for (const component of rootComponents) {
            const value = normalizedData[component.codename]
            if (value === undefined) continue

            if (component.dataType === ComponentDefinitionDataType.STRING && component.validationRules?.format === 'hexColor') {
                normalizedData[component.codename] = normalizeInterpretationNetworkHexColor(value)
                continue
            }

            if (component.dataType !== ComponentDefinitionDataType.TABLE || !Array.isArray(value)) continue

            const childComponents = components.filter((child) => child.parentComponentId === component.id)
            normalizedData[component.codename] = value.map((row) => {
                if (!row || typeof row !== 'object' || Array.isArray(row)) return row

                const normalizedRow = { ...(row as Record<string, unknown>) }
                for (const child of childComponents) {
                    if (child.dataType !== ComponentDefinitionDataType.STRING || child.validationRules?.format !== 'hexColor') continue
                    if (normalizedRow[child.codename] !== undefined) {
                        normalizedRow[child.codename] = normalizeInterpretationNetworkHexColor(normalizedRow[child.codename])
                    }
                }
                return normalizedRow
            })
        }

        return normalizedData
    }

    private hasRequiredValue(cmp: RecordComponent, value: unknown): boolean {
        if (value === undefined || value === null) return false
        if (cmp.dataType === ComponentDefinitionDataType.TABLE) {
            if (!Array.isArray(value)) return false
            const minRows = typeof cmp.validationRules?.minRows === 'number' ? cmp.validationRules.minRows : 1
            return value.length >= Math.max(1, minRows)
        }
        if (cmp.dataType === ComponentDefinitionDataType.STRING) {
            if (this.hasAnyLocalizedContent(value)) return true
            const text = this.extractLocalizedString(value)
            if (typeof text === 'string') return text.trim() !== ''
            if (typeof value === 'string') return value.trim() !== ''
            return false
        }
        if (cmp.dataType === ComponentDefinitionDataType.NUMBER) {
            return typeof value === 'number' && !isNaN(value)
        }
        return value !== ''
    }

    private mapRowToRecord(row: Record<string, unknown>): MetahubRecordDto {
        return {
            id: String(row.id),
            objectCollectionId: String(row.object_id),
            data: coerceRecordData(row.data),
            ownerId: typeof row.owner_id === 'string' ? row.owner_id : null,
            sortOrder: coerceNumber(row.sort_order, 0),
            version: coerceNumber(row._upl_version, 1),
            createdAt: row._upl_created_at,
            updatedAt: row._upl_updated_at
        }
    }

    private validateType(value: unknown, cmp: RecordComponent): string | null {
        const dataType = cmp.dataType as ComponentDefinitionDataType
        const rules = cmp.validationRules ?? {}

        switch (dataType) {
            case ComponentDefinitionDataType.STRING:
                if (rules.format === 'hexColor' && typeof value !== 'string') return 'Expected opaque hexadecimal colour'
                if (typeof value === 'string' || isLocalizedContent(value)) break
                return 'Expected string'
            case ComponentDefinitionDataType.NUMBER:
                if (typeof value !== 'number' || isNaN(value)) return 'Expected number'
                break
            case ComponentDefinitionDataType.BOOLEAN:
                if (typeof value !== 'boolean') return 'Expected boolean'
                break
            case ComponentDefinitionDataType.DATE:
                return this.validateDateValue(value, rules)
            case ComponentDefinitionDataType.REF:
                if (typeof value !== 'string' || !isValidUuid(value)) return 'Expected UUID string'
                break
        }
        return null
    }

    private validateDateValue(value: unknown, rules: Record<string, unknown>): string | null {
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

    private validateRules(value: unknown, rules: Record<string, unknown>, fieldName: string): string[] {
        const errors: string[] = []
        const stringValue = typeof value === 'string' ? value : this.extractLocalizedString(value)

        if (typeof stringValue === 'string') {
            if (rules.format === 'hexColor') {
                try {
                    normalizeInterpretationNetworkHexColor(stringValue)
                } catch {
                    errors.push(`Field "${fieldName}": invalid format`)
                }
            }
            const minLength = optionalNumberRule(rules, 'minLength')
            const maxLength = optionalNumberRule(rules, 'maxLength')
            if (minLength !== undefined && stringValue.length < minLength) {
                errors.push(`Field "${fieldName}": minimum length is ${minLength}`)
            }
            if (maxLength !== undefined && stringValue.length > maxLength) {
                errors.push(`Field "${fieldName}": maximum length is ${maxLength}`)
            }
            if (rules.format !== 'hexColor' && isUsableValidationPattern(rules.pattern) && isUsableValidationPatternValue(stringValue)) {
                try {
                    const regex = new RegExp(rules.pattern)
                    if (!regex.test(stringValue)) {
                        errors.push(`Field "${fieldName}": does not match pattern`)
                    }
                } catch {
                    /* ignore invalid regex */
                }
            }
            const options = Array.isArray(rules.options)
                ? rules.options.filter((option): option is string => typeof option === 'string')
                : []
            if (options.length > 0 && !options.includes(stringValue)) {
                errors.push(`Field "${fieldName}": must be one of [${options.join(', ')}]`)
            }
        }
        if (typeof value === 'number') {
            // Use shared validator for comprehensive precision/scale checks
            const result = validateNumber(value, {
                precision: optionalNumberRule(rules, 'precision'),
                scale: optionalNumberRule(rules, 'scale'),
                min: optionalNumberRule(rules, 'min'),
                max: optionalNumberRule(rules, 'max'),
                nonNegative: rules.nonNegative === true
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
