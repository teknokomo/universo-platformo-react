import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import { getRequestManager } from '../../../utils'
import { localizedContent, validation } from '@universo/utils'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubEnumerationValuesService } from '../../metahubs/services/MetahubEnumerationValuesService'
import { MetaEntityKind } from '@universo/types'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeCodename, isValidCodename } = validation

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

interface UniqueViolationErrorLike {
    code?: string
    constraint?: string
    driverError?: UniqueViolationErrorLike
    cause?: unknown
}

const extractUniqueViolationError = (error: unknown): UniqueViolationErrorLike | null => {
    if (!error || typeof error !== 'object') return null

    const root = error as UniqueViolationErrorLike
    const nestedDriver = root.driverError
    const nestedCause = root.cause && typeof root.cause === 'object' ? (root.cause as UniqueViolationErrorLike) : null
    const nestedCauseDriver = nestedCause?.driverError

    const candidates: Array<UniqueViolationErrorLike | null | undefined> = [root, nestedDriver, nestedCause, nestedCauseDriver]
    for (const candidate of candidates) {
        if (candidate?.code === '23505') return candidate
    }
    return null
}

const respondUniqueViolation = (res: Response, error: unknown, fallbackMessage: string): boolean => {
    const unique = extractUniqueViolationError(error)
    if (!unique) return false

    res.status(409).json({
        error: fallbackMessage,
        code: 'UNIQUE_VIOLATION',
        postgresCode: '23505',
        constraint: unique.constraint ?? null
    })
    return true
}

const findBlockingEnumerationReferences = async (
    metahubId: string,
    enumerationId: string,
    attributesService: MetahubAttributesService,
    userId?: string
) => attributesService.findReferenceBlockersByTarget(metahubId, enumerationId, MetaEntityKind.ENUMERATION, userId)

const findBlockingDefaultValueReferences = async (
    metahubId: string,
    valueId: string,
    attributesService: MetahubAttributesService,
    userId?: string
) => attributesService.findDefaultEnumValueBlockers(metahubId, valueId, userId)

const findBlockingElementValueReferences = async (
    metahubId: string,
    enumerationId: string,
    valueId: string,
    attributesService: MetahubAttributesService,
    userId?: string
) => attributesService.findElementEnumValueBlockers(metahubId, enumerationId, valueId, userId)

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createEnumerationSchema = z.object({
    codename: z.string().min(1).max(100),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isSingleHub: z.boolean().optional(),
    isRequiredHub: z.boolean().optional(),
    hubIds: z.array(z.string().uuid()).optional()
})

const updateEnumerationSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isSingleHub: z.boolean().optional(),
    isRequiredHub: z.boolean().optional(),
    hubIds: z.array(z.string().uuid()).optional(),
    expectedVersion: z.number().int().positive().optional()
})

const createEnumerationValueSchema = z.object({
    codename: z.string().min(1).max(100),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isDefault: z.boolean().optional()
})

const updateEnumerationValueSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    name: localizedInputSchema.optional(),
    description: optionalLocalizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    descriptionPrimaryLocale: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isDefault: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const moveEnumerationValueSchema = z.object({
    direction: z.enum(['up', 'down'])
})

const mapHubSummary = (hub: any) => ({ id: hub.id, name: hub.name, codename: hub.codename })
const resolveCreatedAt = (row: any) => row._upl_created_at ?? row.created_at ?? null
const resolveUpdatedAt = (row: any) => row._upl_updated_at ?? row.updated_at ?? null

const getLocalizedCandidates = (value: unknown): string[] => {
    if (!value || typeof value !== 'object') return []
    const raw = value as Record<string, unknown>

    const locales = raw.locales
    if (locales && typeof locales === 'object') {
        return Object.values(locales as Record<string, unknown>)
            .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).content : null))
            .filter((content): content is string => typeof content === 'string' && content.trim().length > 0)
    }

    return Object.values(raw).filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

const getLocalizedSortValue = (value: unknown, fallback: string): string => {
    if (!value || typeof value !== 'object') return fallback
    const raw = value as Record<string, unknown>

    const locales = raw.locales
    if (locales && typeof locales === 'object') {
        const localesRecord = locales as Record<string, unknown>
        const primary = typeof raw._primary === 'string' ? raw._primary : null
        const enContent =
            localesRecord.en && typeof localesRecord.en === 'object' ? (localesRecord.en as Record<string, unknown>).content : null
        if (typeof enContent === 'string' && enContent.trim().length > 0) return enContent

        if (primary) {
            const primaryContent =
                localesRecord[primary] && typeof localesRecord[primary] === 'object'
                    ? (localesRecord[primary] as Record<string, unknown>).content
                    : null
            if (typeof primaryContent === 'string' && primaryContent.trim().length > 0) return primaryContent
        }

        const firstContent = Object.values(localesRecord)
            .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).content : null))
            .find((content): content is string => typeof content === 'string' && content.trim().length > 0)
        return firstContent ?? fallback
    }

    if (typeof raw.en === 'string' && raw.en.trim().length > 0) return raw.en

    const firstSimple = Object.values(raw).find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    return firstSimple ?? fallback
}

const matchesEnumerationSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

const mapEnumerationSummary = (row: any, metahubId: string, valuesCount: number) => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    name: row.presentation?.name || {},
    description: row.presentation?.description || {},
    isSingleHub: row.config?.isSingleHub || false,
    isRequiredHub: row.config?.isRequiredHub || false,
    sortOrder: row.config?.sortOrder || 0,
    valuesCount,
    version: row._upl_version || 1,
    createdAt: resolveCreatedAt(row),
    updatedAt: resolveUpdatedAt(row),
    hubs: [] as any[]
})

export function createEnumerationsRoutes(
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

    const services = (req: Request) => {
        const ds = getDataSource()
        const manager = getRequestManager(req, ds)
        const schemaService = new MetahubSchemaService(ds, undefined, manager)
        const objectsService = new MetahubObjectsService(schemaService)
        return {
            ds,
            manager,
            objectsService,
            hubsService: new MetahubHubsService(schemaService),
            attributesService: new MetahubAttributesService(schemaService),
            valuesService: new MetahubEnumerationValuesService(schemaService)
        }
    }

    router.get(
        '/metahub/:metahubId/enumerations',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId } = req.params
            const { objectsService, hubsService, valuesService } = services(req)
            const userId = resolveUserId(req)

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
            const rawEnumerations = await objectsService.findAllByKind(metahubId, MetaEntityKind.ENUMERATION, userId)
            const enumerationIds = rawEnumerations.map((row: any) => row.id)
            const valuesCounts = await valuesService.countByObjectIds(metahubId, enumerationIds, userId)

            let items = rawEnumerations.map((row: any) => mapEnumerationSummary(row, metahubId, valuesCounts.get(row.id) || 0))

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item: any) => matchesEnumerationSearch(item.codename, item.name, searchLower))
            }

            items.sort((a: any, b: any) => {
                const sortField = sortBy as string
                let valA
                let valB
                if (sortField === 'name') {
                    valA = getLocalizedSortValue(a.name, a.codename)
                    valB = getLocalizedSortValue(b.name, b.codename)
                } else if (sortField === 'codename') {
                    valA = a.codename
                    valB = b.codename
                } else if (sortField === 'sortOrder') {
                    valA = a.sortOrder ?? 0
                    valB = b.sortOrder ?? 0
                } else if (sortField === 'updated') {
                    valA = new Date(a.updatedAt).getTime()
                    valB = new Date(b.updatedAt).getTime()
                } else {
                    valA = new Date(a.createdAt).getTime()
                    valB = new Date(b.createdAt).getTime()
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1
                return 0
            })

            const total = items.length
            const paginatedItems = items.slice(offset, offset + limit)

            const allHubIds = new Set<string>()
            const hubIdsByEnumeration = new Map<string, string[]>()

            rawEnumerations.forEach((row: any) => {
                const ids = row.config?.hubs || []
                if (Array.isArray(ids)) {
                    ids.forEach((id: string) => allHubIds.add(id))
                    hubIdsByEnumeration.set(row.id, ids)
                }
            })

            const hubMap = new Map<string, any>()
            if (allHubIds.size > 0) {
                const hubs = await hubsService.findByIds(metahubId, Array.from(allHubIds), userId)
                hubs.forEach((h: any) => hubMap.set(h.id, h))
            }

            const resultItems = paginatedItems.map((item: any) => {
                const ids = hubIdsByEnumeration.get(item.id) || []
                const matchedHubs = ids
                    .map((id) => hubMap.get(id))
                    .filter(Boolean)
                    .map(mapHubSummary)
                return { ...item, hubs: matchedHubs }
            })

            return res.json({ items: resultItems, pagination: { total, limit, offset } })
        })
    )

    router.post(
        '/metahub/:metahubId/enumerations',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const parsed = createEnumerationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                name,
                description,
                sortOrder,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                isSingleHub,
                isRequiredHub,
                hubIds
            } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const existing = await objectsService.findByCodenameAndKind(metahubId, normalizedCodename, MetaEntityKind.ENUMERATION, userId)
            if (existing) {
                return res.status(409).json({ error: 'Enumeration with this codename already exists in this metahub' })
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = undefined
            if (description) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                }
            }

            const effectiveIsRequired = isRequiredHub ?? false
            const targetHubIds: string[] = hubIds ?? []

            if (effectiveIsRequired && targetHubIds.length === 0) {
                return res.status(400).json({ error: 'Enumeration with required hub flag must have at least one hub association' })
            }
            if ((isSingleHub ?? false) && targetHubIds.length > 1) {
                return res.status(400).json({ error: 'This enumeration is restricted to a single hub' })
            }

            if (targetHubIds.length > 0) {
                const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
                if (validHubs.length !== targetHubIds.length) {
                    return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                }
            }

            let created
            try {
                created = await objectsService.createEnumeration(
                    metahubId,
                    {
                        codename: normalizedCodename,
                        name: nameVlc,
                        description: descriptionVlc,
                        config: {
                            isSingleHub: isSingleHub ?? false,
                            isRequiredHub: effectiveIsRequired,
                            sortOrder,
                            hubs: targetHubIds
                        },
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration with this codename already exists in this metahub')) {
                    return
                }
                throw error
            }

            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            return res.status(201).json({
                id: created.id,
                metahubId,
                codename: created.codename,
                name: created.presentation.name,
                description: created.presentation.description,
                isSingleHub: created.config.isSingleHub,
                isRequiredHub: created.config.isRequiredHub,
                sortOrder: created.config.sortOrder,
                version: created._upl_version || 1,
                createdAt: resolveCreatedAt(created),
                updatedAt: resolveUpdatedAt(created),
                hubs: hubs.map(mapHubSummary),
                valuesCount: 0
            })
        })
    )

    router.patch(
        '/metahub/:metahubId/enumeration/:enumerationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = updateEnumerationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                name,
                description,
                sortOrder,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                isSingleHub,
                isRequiredHub,
                hubIds,
                expectedVersion
            } = parsed.data

            const currentPresentation = enumeration.presentation || {}
            const currentConfig = enumeration.config || {}

            let finalName = currentPresentation.name
            let finalDescription = currentPresentation.description
            let finalCodename = enumeration.codename

            let targetHubIds: string[] = currentConfig.hubs || []
            if (hubIds !== undefined) {
                if ((isSingleHub ?? currentConfig.isSingleHub) && hubIds.length > 1) {
                    return res.status(400).json({ error: 'This enumeration is restricted to a single hub' })
                }
                const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
                if (effectiveIsRequiredHub && hubIds.length === 0) {
                    return res.status(400).json({ error: 'This enumeration requires at least one hub association' })
                }
                targetHubIds = hubIds
                if (targetHubIds.length > 0) {
                    const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
                    if (validHubs.length !== targetHubIds.length) {
                        return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                    }
                }
            }

            if (codename !== undefined) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                    })
                }
                if (normalizedCodename !== enumeration.codename) {
                    const existing = await objectsService.findByCodenameAndKind(
                        metahubId,
                        normalizedCodename,
                        MetaEntityKind.ENUMERATION,
                        userId
                    )
                    if (existing && existing.id !== enumerationId) {
                        return res.status(409).json({ error: 'Enumeration with this codename already exists in this metahub' })
                    }
                    finalCodename = normalizedCodename
                }
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? currentPresentation.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    finalName = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ??
                        currentPresentation.description?._primary ??
                        currentPresentation.name?._primary ??
                        namePrimaryLocale ??
                        'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) {
                        finalDescription = descriptionVlc
                    }
                } else {
                    finalDescription = undefined
                }
            }

            if (isSingleHub !== undefined && isSingleHub && targetHubIds.length > 1) {
                return res.status(400).json({ error: 'Cannot set single hub mode when enumeration is associated with multiple hubs' })
            }

            if (isRequiredHub !== undefined && isRequiredHub && targetHubIds.length === 0) {
                return res.status(400).json({ error: 'Cannot require hub association when enumeration has no hubs' })
            }

            let updated
            try {
                updated = (await objectsService.updateEnumeration(
                    metahubId,
                    enumerationId,
                    {
                        codename: finalCodename !== enumeration.codename ? finalCodename : undefined,
                        name: finalName,
                        description: finalDescription,
                        config: {
                            hubs: targetHubIds,
                            isSingleHub: isSingleHub ?? currentConfig.isSingleHub,
                            isRequiredHub: isRequiredHub ?? currentConfig.isRequiredHub,
                            sortOrder: sortOrder ?? currentConfig.sortOrder
                        },
                        updatedBy: userId,
                        expectedVersion
                    },
                    userId
                )) as any
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration with this codename already exists in this metahub')) {
                    return
                }
                throw error
            }

            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            return res.json({
                id: updated.id,
                metahubId,
                codename: updated.codename,
                name: updated.presentation.name,
                description: updated.presentation.description,
                isSingleHub: updated.config.isSingleHub,
                isRequiredHub: updated.config.isRequiredHub,
                sortOrder: updated.config.sortOrder,
                version: updated._upl_version || 1,
                createdAt: resolveCreatedAt(updated),
                updatedAt: resolveUpdatedAt(updated),
                hubs: hubs.map(mapHubSummary)
            })
        })
    )

    router.get(
        '/metahub/:metahubId/hub/:hubId/enumerations',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId } = req.params
            const { objectsService, hubsService, valuesService } = services(req)
            const userId = resolveUserId(req)

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
            const allEnumerations = await objectsService.findAllByKind(metahubId, MetaEntityKind.ENUMERATION, userId)
            let hubEnumerations = allEnumerations.filter((enumeration: any) => {
                const hubs = enumeration.config?.hubs || []
                return Array.isArray(hubs) && hubs.includes(hubId)
            })

            if (hubEnumerations.length === 0) {
                return res.json({ items: [], pagination: { total: 0, limit, offset } })
            }

            const enumerationIds = hubEnumerations.map((row: any) => row.id)
            const valuesCounts = await valuesService.countByObjectIds(metahubId, enumerationIds, userId)

            let items = hubEnumerations.map((row: any) => mapEnumerationSummary(row, metahubId, valuesCounts.get(row.id) || 0))

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter((item: any) => matchesEnumerationSearch(item.codename, item.name, searchLower))
            }

            items.sort((a: any, b: any) => {
                const sortField = sortBy as string
                let valA
                let valB
                if (sortField === 'name') {
                    valA = getLocalizedSortValue(a.name, a.codename)
                    valB = getLocalizedSortValue(b.name, b.codename)
                } else if (sortField === 'codename') {
                    valA = a.codename
                    valB = b.codename
                } else if (sortField === 'sortOrder') {
                    valA = a.sortOrder ?? 0
                    valB = b.sortOrder ?? 0
                } else if (sortField === 'updated') {
                    valA = new Date(a.updatedAt).getTime()
                    valB = new Date(b.updatedAt).getTime()
                } else {
                    valA = new Date(a.createdAt).getTime()
                    valB = new Date(b.createdAt).getTime()
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1
                return 0
            })

            const total = items.length
            const paginatedItems = items.slice(offset, offset + limit)

            const allHubIds = new Set<string>()
            const hubIdsByEnumeration = new Map<string, string[]>()
            hubEnumerations.forEach((row: any) => {
                if (paginatedItems.find((item: any) => item.id === row.id)) {
                    const ids = row.config?.hubs || []
                    if (Array.isArray(ids)) {
                        ids.forEach((id: string) => allHubIds.add(id))
                        hubIdsByEnumeration.set(row.id, ids)
                    }
                }
            })

            const hubMap = new Map<string, any>()
            if (allHubIds.size > 0) {
                const hubs = await hubsService.findByIds(metahubId, Array.from(allHubIds), userId)
                hubs.forEach((h: any) => hubMap.set(h.id, h))
            }

            const resultItems = paginatedItems.map((item: any) => {
                const ids = hubIdsByEnumeration.get(item.id) || []
                const matchedHubs = ids
                    .map((id) => hubMap.get(id))
                    .filter(Boolean)
                    .map(mapHubSummary)
                return { ...item, hubs: matchedHubs }
            })

            return res.json({ items: resultItems, pagination: { total, limit, offset } })
        })
    )

    router.get(
        ['/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId', '/metahub/:metahubId/enumeration/:enumerationId'],
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId, enumerationId } = req.params
            const { objectsService, hubsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentConfig = enumeration.config || {}
            const currentHubs = currentConfig.hubs || []

            if (hubId && !currentHubs.includes(hubId)) {
                return res.status(404).json({ error: 'Enumeration not found in this hub' })
            }

            const hubs = currentHubs.length > 0 ? await hubsService.findByIds(metahubId, currentHubs, userId) : []
            const valuesCount = await valuesService.countByObjectId(metahubId, enumeration.id, userId)

            return res.json({
                id: enumeration.id,
                metahubId,
                codename: enumeration.codename,
                name: enumeration.presentation.name,
                description: enumeration.presentation.description,
                isSingleHub: currentConfig.isSingleHub,
                isRequiredHub: currentConfig.isRequiredHub,
                sortOrder: currentConfig.sortOrder,
                version: enumeration._upl_version || 1,
                createdAt: resolveCreatedAt(enumeration),
                updatedAt: resolveUpdatedAt(enumeration),
                valuesCount,
                hubs: hubs.map(mapHubSummary)
            })
        })
    )

    router.post(
        '/metahub/:metahubId/hub/:hubId/enumerations',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = createEnumerationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                name,
                description,
                sortOrder,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                isSingleHub,
                isRequiredHub,
                hubIds
            } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const existing = await objectsService.findByCodenameAndKind(metahubId, normalizedCodename, MetaEntityKind.ENUMERATION, userId)
            if (existing) {
                return res.status(409).json({ error: 'Enumeration with this codename already exists in this metahub' })
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = undefined
            if (description) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                }
            }

            const effectiveIsRequired = isRequiredHub ?? false
            let targetHubIds = [hubId]
            if (hubIds && Array.isArray(hubIds)) {
                targetHubIds = Array.from(new Set([...hubIds, hubId]))
            }
            if ((isSingleHub ?? false) && targetHubIds.length > 1) {
                return res.status(400).json({ error: 'This enumeration is restricted to a single hub' })
            }

            const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
            if (validHubs.length !== targetHubIds.length) {
                return res.status(400).json({ error: 'One or more hub IDs are invalid' })
            }

            let created
            try {
                created = await objectsService.createEnumeration(
                    metahubId,
                    {
                        codename: normalizedCodename,
                        name: nameVlc,
                        description: descriptionVlc,
                        config: {
                            hubs: targetHubIds,
                            isSingleHub: isSingleHub ?? false,
                            isRequiredHub: effectiveIsRequired,
                            sortOrder
                        },
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration with this codename already exists in this metahub')) {
                    return
                }
                throw error
            }

            const hubs = await hubsService.findByIds(metahubId, targetHubIds, userId)

            return res.status(201).json({
                id: created.id,
                metahubId,
                codename: created.codename,
                name: created.presentation.name,
                description: created.presentation.description,
                isSingleHub: created.config.isSingleHub,
                isRequiredHub: created.config.isRequiredHub,
                sortOrder: created.config.sortOrder,
                version: created._upl_version || 1,
                createdAt: resolveCreatedAt(created),
                updatedAt: resolveUpdatedAt(created),
                hubs: hubs.map(mapHubSummary),
                valuesCount: 0
            })
        })
    )

    router.patch(
        '/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId, enumerationId } = req.params
            const { objectsService, hubsService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentHubs = enumeration.config?.hubs || []
            if (!currentHubs.includes(hubId)) {
                return res.status(404).json({ error: 'Enumeration not found in this hub' })
            }

            const parsed = updateEnumerationSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                name,
                description,
                sortOrder,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                isSingleHub,
                isRequiredHub,
                hubIds,
                expectedVersion
            } = parsed.data

            const currentPresentation = enumeration.presentation || {}
            const currentConfig = enumeration.config || {}

            let finalName = currentPresentation.name
            let finalDescription = currentPresentation.description
            let finalCodename = enumeration.codename
            let targetHubIds = currentConfig.hubs || []

            if (hubIds !== undefined) {
                targetHubIds = hubIds

                if ((isSingleHub ?? currentConfig.isSingleHub) && targetHubIds.length > 1) {
                    return res.status(400).json({ error: 'This enumeration is restricted to a single hub' })
                }
                const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
                if (effectiveIsRequiredHub && targetHubIds.length === 0) {
                    return res.status(400).json({ error: 'This enumeration requires at least one hub association' })
                }

                if (targetHubIds.length > 0) {
                    const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
                    if (validHubs.length !== targetHubIds.length) {
                        return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                    }
                }
            }

            if (codename !== undefined) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({ error: 'Validation failed', details: { codename: ['Invalid format'] } })
                }
                if (normalizedCodename !== enumeration.codename) {
                    const existing = await objectsService.findByCodenameAndKind(
                        metahubId,
                        normalizedCodename,
                        MetaEntityKind.ENUMERATION,
                        userId
                    )
                    if (existing && existing.id !== enumerationId) {
                        return res.status(409).json({ error: 'Enumeration with this codename already exists' })
                    }
                    finalCodename = normalizedCodename
                }
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? currentPresentation.name?.['_primary'] ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) {
                    finalName = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ??
                        currentPresentation.description?._primary ??
                        currentPresentation.name?._primary ??
                        namePrimaryLocale ??
                        'en'
                    finalDescription = buildLocalizedContent(sanitizedDescription, primary, primary)
                } else {
                    finalDescription = undefined
                }
            }

            let updated
            try {
                updated = (await objectsService.updateEnumeration(
                    metahubId,
                    enumerationId,
                    {
                        codename: finalCodename !== enumeration.codename ? finalCodename : undefined,
                        name: finalName,
                        description: finalDescription,
                        config: {
                            hubs: targetHubIds,
                            isSingleHub: isSingleHub ?? currentConfig.isSingleHub,
                            isRequiredHub: isRequiredHub ?? currentConfig.isRequiredHub,
                            sortOrder: sortOrder ?? currentConfig.sortOrder
                        },
                        updatedBy: userId,
                        expectedVersion
                    },
                    userId
                )) as any
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration with this codename already exists in this metahub')) {
                    return
                }
                throw error
            }

            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            return res.json({
                id: updated.id,
                metahubId,
                codename: updated.codename,
                name: updated.presentation.name,
                description: updated.presentation.description,
                isSingleHub: updated.config.isSingleHub,
                isRequiredHub: updated.config.isRequiredHub,
                sortOrder: updated.config.sortOrder,
                version: updated._upl_version || 1,
                createdAt: resolveCreatedAt(updated),
                updatedAt: resolveUpdatedAt(updated),
                hubs: hubs.map(mapHubSummary)
            })
        })
    )

    router.get(
        [
            '/metahub/:metahubId/enumeration/:enumerationId/blocking-references',
            '/metahub/:metahubId/enumerations/:enumerationId/blocking-references'
        ],
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const blockingReferences = await findBlockingEnumerationReferences(metahubId, enumerationId, attributesService, userId)
            return res.json({
                enumerationId,
                blockingReferences,
                canDelete: blockingReferences.length === 0
            })
        })
    )

    router.delete(
        '/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, hubId, enumerationId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentConfig = enumeration.config || {}
            const currentHubIds: string[] = currentConfig.hubs || []

            if (!currentHubIds.includes(hubId)) {
                return res.status(404).json({ error: 'Enumeration not found in this hub' })
            }

            const forceDelete = req.query.force === 'true'

            if (currentConfig.isRequiredHub && currentHubIds.length === 1 && !forceDelete) {
                return res.status(409).json({
                    error: 'Cannot remove enumeration from its last hub because it requires at least one hub association. Use force=true to delete the enumeration entirely.'
                })
            }

            if (currentHubIds.length > 1 && !forceDelete) {
                const newHubIds = currentHubIds.filter((id) => id !== hubId)
                await objectsService.updateEnumeration(
                    metahubId,
                    enumerationId,
                    {
                        config: { ...currentConfig, hubs: newHubIds },
                        updatedBy: userId
                    },
                    userId
                )
                return res.status(200).json({ message: 'Enumeration removed from hub', remainingHubs: newHubIds.length })
            }

            const blockingReferences = await findBlockingEnumerationReferences(metahubId, enumerationId, attributesService, userId)
            if (blockingReferences.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration: it is referenced by attributes',
                    blockingReferences
                })
            }

            await objectsService.delete(metahubId, enumerationId, userId)
            return res.status(204).send()
        })
    )

    router.delete(
        '/metahub/:metahubId/enumeration/:enumerationId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const blockingReferences = await findBlockingEnumerationReferences(metahubId, enumerationId, attributesService, userId)
            if (blockingReferences.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration: it is referenced by attributes',
                    blockingReferences
                })
            }

            await objectsService.delete(metahubId, enumerationId, userId)
            return res.status(204).send()
        })
    )

    router.get(
        '/metahub/:metahubId/enumerations/trash',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId } = req.params
            const { objectsService } = services(req)
            const userId = resolveUserId(req)

            const deletedEnumerations = await objectsService.findDeletedByKind(metahubId, MetaEntityKind.ENUMERATION, userId)
            const items = deletedEnumerations.map((row: any) => ({
                id: row.id,
                metahubId,
                codename: row.codename,
                name: row.presentation?.name || {},
                description: row.presentation?.description || {},
                deletedAt: row._mhb_deleted_at,
                deletedBy: row._mhb_deleted_by
            }))

            return res.json({ items, total: items.length })
        })
    )

    router.post(
        '/metahub/:metahubId/enumeration/:enumerationId/restore',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId, { onlyDeleted: true })
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found in trash' })
            }

            try {
                await objectsService.restore(metahubId, enumerationId, userId)
            } catch (error) {
                if (extractUniqueViolationError(error)) {
                    return res.status(409).json({
                        error: 'Cannot restore enumeration: codename already exists in this metahub'
                    })
                }
                throw error
            }
            return res.json({ message: 'Enumeration restored successfully', id: enumerationId })
        })
    )

    router.delete(
        '/metahub/:metahubId/enumeration/:enumerationId/permanent',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId, { includeDeleted: true })
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const blockingReferences = await findBlockingEnumerationReferences(metahubId, enumerationId, attributesService, userId)
            if (blockingReferences.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration: it is referenced by attributes',
                    blockingReferences
                })
            }

            await objectsService.permanentDelete(metahubId, enumerationId, userId)
            return res.status(204).send()
        })
    )

    // Values CRUD

    router.get(
        '/metahub/:metahubId/enumeration/:enumerationId/values',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const items = await valuesService.findAll(metahubId, enumerationId, userId)
            return res.json({ items, total: items.length })
        })
    )

    router.get(
        '/metahub/:metahubId/enumeration/:enumerationId/value/:valueId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId, valueId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const value = await valuesService.findById(metahubId, valueId, userId)
            if (!value || value.objectId !== enumerationId) {
                return res.status(404).json({ error: 'Enumeration value not found' })
            }

            return res.json(value)
        })
    )

    router.post(
        '/metahub/:metahubId/enumeration/:enumerationId/values',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = createEnumerationValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, isDefault } = parsed.data

            const normalizedCodename = normalizeCodename(codename)
            if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                })
            }

            const existing = await valuesService.findByCodename(metahubId, enumerationId, normalizedCodename, userId)
            if (existing) {
                return res.status(409).json({ error: 'Enumeration value with this codename already exists' })
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = undefined
            if (description) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                }
            }

            let created
            try {
                created = await valuesService.create(
                    metahubId,
                    {
                        enumerationId,
                        codename: normalizedCodename,
                        name: nameVlc,
                        description: descriptionVlc,
                        sortOrder,
                        isDefault,
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration value with this codename already exists')) {
                    return
                }
                throw error
            }

            return res.status(201).json(created)
        })
    )

    router.patch(
        '/metahub/:metahubId/enumeration/:enumerationId/value/:valueId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId, valueId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentValue = await valuesService.findById(metahubId, valueId, userId)
            if (!currentValue || currentValue.objectId !== enumerationId) {
                return res.status(404).json({ error: 'Enumeration value not found' })
            }

            const parsed = updateEnumerationValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, isDefault, expectedVersion } =
                parsed.data

            const patch: Record<string, unknown> = {
                updatedBy: userId,
                expectedVersion
            }

            if (codename !== undefined) {
                const normalizedCodename = normalizeCodename(codename)
                if (!normalizedCodename || !isValidCodename(normalizedCodename)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: ['Codename must contain only lowercase letters, numbers, and hyphens'] }
                    })
                }
                if (normalizedCodename !== currentValue.codename) {
                    const existing = await valuesService.findByCodename(metahubId, enumerationId, normalizedCodename, userId)
                    if (existing && existing.id !== valueId) {
                        return res.status(409).json({ error: 'Enumeration value with this codename already exists' })
                    }
                    patch.codename = normalizedCodename
                }
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? (currentValue.name as any)?._primary ?? 'en'
                patch.name = buildLocalizedContent(sanitizedName, primary, primary)
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary = descriptionPrimaryLocale ?? (currentValue.description as any)?._primary ?? 'en'
                    patch.description = buildLocalizedContent(sanitizedDescription, primary, primary)
                } else {
                    patch.description = null
                }
            }

            if (sortOrder !== undefined) patch.sortOrder = sortOrder
            if (isDefault !== undefined) patch.isDefault = isDefault

            let updated
            try {
                updated = await valuesService.update(metahubId, valueId, patch, userId)
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Enumeration value with this codename already exists')) {
                    return
                }
                throw error
            }
            return res.json(updated)
        })
    )

    router.patch(
        '/metahub/:metahubId/enumeration/:enumerationId/value/:valueId/move',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId, valueId } = req.params
            const { objectsService, valuesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = moveEnumerationValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            try {
                const updated = await valuesService.moveValue(metahubId, enumerationId, valueId, parsed.data.direction, userId)
                return res.json(updated)
            } catch (error) {
                if (error instanceof Error && error.message === 'Enumeration value not found') {
                    return res.status(404).json({ error: 'Enumeration value not found' })
                }
                throw error
            }
        })
    )

    router.delete(
        '/metahub/:metahubId/enumeration/:enumerationId/value/:valueId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const { metahubId, enumerationId, valueId } = req.params
            const { objectsService, valuesService, attributesService } = services(req)
            const userId = resolveUserId(req)

            const enumeration = await objectsService.findById(metahubId, enumerationId, userId)
            if (!enumeration || enumeration.kind !== MetaEntityKind.ENUMERATION) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const value = await valuesService.findById(metahubId, valueId, userId)
            if (!value || value.objectId !== enumerationId) {
                return res.status(404).json({ error: 'Enumeration value not found' })
            }

            const blockingDefaults = await findBlockingDefaultValueReferences(metahubId, valueId, attributesService, userId)
            if (blockingDefaults.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration value: it is configured as default in attributes',
                    blockingDefaults
                })
            }

            const blockingElements = await findBlockingElementValueReferences(metahubId, enumerationId, valueId, attributesService, userId)
            if (blockingElements.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete enumeration value: it is used in predefined elements',
                    blockingElements
                })
            }

            await valuesService.delete(metahubId, valueId, userId)
            return res.status(204).send()
        })
    )

    return router
}
