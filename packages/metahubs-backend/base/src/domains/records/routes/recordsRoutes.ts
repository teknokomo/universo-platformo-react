import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { HubRecord } from '../../../database/entities/Record'
import { Catalog } from '../../../database/entities/Catalog'
import { Attribute, AttributeValidation } from '../../../database/entities/Attribute'
import { AttributeDataType } from '@universo/types'
import { z } from 'zod'
import type { VersionedLocalizedContent } from '@universo/types'
import { filterLocalizedContent, isLocalizedContent } from '@universo/utils'
import { validateListQuery } from '../../shared/queryParams'
import { escapeLikeWildcards, getRequestManager } from '../../../utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveUserId = (req: Request): string | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

/**
 * Validate record data against hub attributes schema
 */
const extractLocalizedString = (value: unknown): string | null => {
    if (typeof value === 'string') return value
    if (!isLocalizedContent(value)) return null
    const filtered = filterLocalizedContent(value as VersionedLocalizedContent<string>)
    if (!filtered) return null
    const primary = filtered._primary
    const entry = filtered.locales[primary]
    return typeof entry?.content === 'string' ? entry.content : null
}

const hasAnyLocalizedContent = (value: unknown): boolean => {
    if (!isLocalizedContent(value)) return false
    const filtered = filterLocalizedContent(value as VersionedLocalizedContent<string>)
    if (!filtered) return false
    return Object.values(filtered.locales).some((entry) => typeof entry?.content === 'string' && entry.content.trim() !== '')
}

const hasRequiredValue = (attr: Attribute, value: unknown): boolean => {
    if (value === undefined || value === null) return false
    if (attr.dataType === AttributeDataType.STRING) {
        if (hasAnyLocalizedContent(value)) return true
        const text = extractLocalizedString(value)
        if (typeof text === 'string') return text.trim() !== ''
        if (typeof value === 'string') return value.trim() !== ''
        return false
    }
    if (attr.dataType === AttributeDataType.NUMBER) {
        return typeof value === 'number' && !isNaN(value)
    }
    return value !== ''
}

function validateRecordData(data: Record<string, unknown>, attributes: Attribute[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const attributeMap = new Map(attributes.map((a) => [a.codename, a]))

    // Check required fields
    for (const attr of attributes) {
        if (attr.isRequired && !hasRequiredValue(attr, data[attr.codename])) {
            errors.push(`Field "${attr.codename}" is required`)
        }
    }

    // Validate each field
    for (const [key, value] of Object.entries(data)) {
        const attr = attributeMap.get(key)
        if (!attr) {
            // Unknown field - allow it (flexible schema)
            continue
        }

        if (value === null || value === undefined) {
            continue // Skip null/undefined values
        }

        // Type validation
        const typeError = validateType(value, attr.dataType)
        if (typeError) {
            errors.push(`Field "${key}": ${typeError}`)
            continue
        }

        // Validation rules
        const ruleErrors = validateRules(value, attr.validationRules, key)
        errors.push(...ruleErrors)
    }

    return { valid: errors.length === 0, errors }
}

function validateType(value: unknown, dataType: AttributeDataType): string | null {
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
        case AttributeDataType.JSON:
            // Any value is valid for JSON type
            break
    }
    return null
}

function validateRules(value: unknown, rules: AttributeValidation, fieldName: string): string[] {
    const errors: string[] = []

    const stringValue = typeof value === 'string' ? value : extractLocalizedString(value)

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
            } catch {
                // Invalid pattern, skip validation
            }
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

// Request body schemas
const createRecordSchema = z.object({
    data: z.record(z.unknown()),
    sortOrder: z.number().int().optional()
})

const updateRecordSchema = z.object({
    data: z.record(z.unknown()).optional(),
    sortOrder: z.number().int().optional()
})

export function createRecordsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const repos = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        return {
            recordRepo: manager.getRepository(HubRecord),
            catalogRepo: manager.getRepository(Catalog),
            attributeRepo: manager.getRepository(Attribute)
        }
    }

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/records
     * GET /metahub/:metahubId/catalog/:catalogId/records (direct, without hub)
     * List all records in a catalog with optional filtering
     */
    router.get(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/records', '/metahub/:metahubId/catalog/:catalogId/records'],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId } = req.params
            const { recordRepo, catalogRepo } = repos(req)

            // Verify catalog exists
            const catalog = await catalogRepo.findOne({ where: { id: catalogId } })
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            const { limit, offset, sortBy, sortOrder, search } = validatedQuery

            let qb = recordRepo.createQueryBuilder('r').where('r.catalogId = :catalogId', { catalogId })

            if (search) {
                const escapedSearch = escapeLikeWildcards(search)
                qb = qb.andWhere('r.data::text ILIKE :search', { search: `%${escapedSearch}%` })
            }

            const orderColumn = sortBy === 'created' ? 'r.created_at' : 'r.updated_at'
            qb = qb
                .orderBy(orderColumn, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
                .skip(offset)
                .take(limit)

            const [records, total] = await qb.getManyAndCount()

            res.json({
                items: records,
                pagination: {
                    total,
                    limit,
                    offset
                }
            })
        })
    )

    /**
     * GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId
     * GET /metahub/:metahubId/catalog/:catalogId/record/:recordId (direct, without hub)
     * Get a single record
     */
    router.get(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId',
            '/metahub/:metahubId/catalog/:catalogId/record/:recordId'
        ],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId, recordId } = req.params
            const { recordRepo } = repos(req)

            const record = await recordRepo.findOne({
                where: { id: recordId, catalogId }
            })

            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            res.json(record)
        })
    )

    /**
     * POST /metahub/:metahubId/hub/:hubId/catalog/:catalogId/records
     * POST /metahub/:metahubId/catalog/:catalogId/records (direct, without hub)
     * Create a new record with JSONB data validation
     */
    router.post(
        ['/metahub/:metahubId/hub/:hubId/catalog/:catalogId/records', '/metahub/:metahubId/catalog/:catalogId/records'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId } = req.params
            const { recordRepo, catalogRepo, attributeRepo } = repos(req)

            // Verify catalog exists
            const catalog = await catalogRepo.findOne({ where: { id: catalogId } })
            if (!catalog) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const parsed = createRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder } = parsed.data

            // Get catalog attributes for validation
            const attributes = await attributeRepo.find({ where: { catalogId } })

            // Validate data against schema
            const validation = validateRecordData(data, attributes)
            if (!validation.valid) {
                return res.status(400).json({ error: 'Data validation failed', details: validation.errors })
            }

            const userId = resolveUserId(req)

            const record = recordRepo.create({
                catalogId,
                data,
                ownerId: userId,
                sortOrder: sortOrder ?? 0
            })

            const saved = await recordRepo.save(record)
            res.status(201).json(saved)
        })
    )

    /**
     * PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId
     * PATCH /metahub/:metahubId/catalog/:catalogId/record/:recordId (direct, without hub)
     * Update a record
     */
    router.patch(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId',
            '/metahub/:metahubId/catalog/:catalogId/record/:recordId'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId, recordId } = req.params
            const { recordRepo, attributeRepo } = repos(req)

            const record = await recordRepo.findOne({ where: { id: recordId, catalogId } })
            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            const parsed = updateRecordSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { data, sortOrder } = parsed.data

            if (data) {
                // Merge new data with existing
                const mergedData = { ...record.data, ...data }

                // Get catalog attributes for validation
                const attributes = await attributeRepo.find({ where: { catalogId } })

                // Validate merged data
                const validation = validateRecordData(mergedData, attributes)
                if (!validation.valid) {
                    return res.status(400).json({ error: 'Data validation failed', details: validation.errors })
                }

                record.data = mergedData
            }

            if (sortOrder !== undefined) {
                record.sortOrder = sortOrder
            }

            const saved = await recordRepo.save(record)
            res.json(saved)
        })
    )

    /**
     * DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId
     * DELETE /metahub/:metahubId/catalog/:catalogId/record/:recordId (direct, without hub)
     * Delete a record
     */
    router.delete(
        [
            '/metahub/:metahubId/hub/:hubId/catalog/:catalogId/record/:recordId',
            '/metahub/:metahubId/catalog/:catalogId/record/:recordId'
        ],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { catalogId, recordId } = req.params
            const { recordRepo } = repos(req)

            const record = await recordRepo.findOne({ where: { id: recordId, catalogId } })
            if (!record) {
                return res.status(404).json({ error: 'Record not found' })
            }

            await recordRepo.remove(record)
            res.status(204).send()
        })
    )

    return router
}
