import { z } from 'zod'
import type { Request, Response } from 'express'
import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { localizedContent, validation, database } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeCatalogCopyOptions, normalizeCodenameForStyle, isValidCodenameForStyle } = validation
import { type CatalogCopyOptions, MetaEntityKind } from '@universo/types'
import { findMetahubById } from '../../../persistence'
import { getRequestDbExecutor } from '../../../utils'
import { getRequestDbSession } from '@universo/utils/database'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { MetahubElementsService } from '../../metahubs/services/MetahubElementsService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import { EntityTypeService } from '../../entities/services/EntityTypeService'
import { validateListQuery } from '../../shared/queryParams'
import { toTimestamp } from '../../shared/timestamps'
import { MetahubValidationError } from '../../shared/domainErrors'
import { ensureMetahubAccess } from '../../shared/guards'
import { resolveUserId } from '../../shared/routeAuth'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import {
    getCodenameSettings,
    codenameErrorMessage,
    buildCodenameAttempt,
    CODENAME_RETRY_MAX_ATTEMPTS
} from '../../shared/codenameStyleHelper'
import {
    requiredCodenamePayloadSchema,
    optionalCodenamePayloadSchema,
    getCodenamePayloadText,
    syncCodenamePayloadText,
    syncOptionalCodenamePayloadText
} from '../../shared/codenamePayload'
import { getCodenameText } from '../../shared/codename'
import { readPlatformSystemAttributesPolicy } from '../../shared'
import { copyDesignTimeObjectChildren } from '../../entities/services/designTimeObjectChildrenCopy'
import { executeBlockedDelete, executeHubScopedDelete } from '../../entities/services/legacyBuiltinObjectCompatibility'
import {
    createCatalogCompatibleKindSet,
    findBlockingCatalogReferences,
    resolveCatalogCompatibleKinds
} from '../services/catalogCompatibility'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HubSummaryRow = {
    id: string
    name: unknown
    codename: string
}

type CatalogObjectRow = {
    id: string
    kind?: string
    codename: unknown
    name?: unknown
    description?: unknown
    presentation?: {
        name?: unknown
        description?: unknown
    }
    config?: {
        hubs?: unknown
        isSingleHub?: boolean
        isRequiredHub?: boolean
        sortOrder?: number
        runtimeConfig?: unknown
    }
    _upl_version?: number
    created_at?: unknown
    updated_at?: unknown
    deleted_at?: unknown
    deleted_by?: unknown
}

type CatalogListItemRow = {
    id: string
    metahubId: string
    codename: unknown
    name: unknown
    description: unknown
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    version: number
    createdAt: unknown
    updatedAt: unknown
    attributesCount: number
    elementsCount: number
    hubs: HubSummaryRow[]
}

type CopiedCatalogRow = {
    id: string
    codename: unknown
    presentation?: {
        name?: unknown
        description?: unknown
    }
    config?: {
        hubs?: unknown
        isSingleHub?: boolean
        isRequiredHub?: boolean
        sortOrder?: number
        runtimeConfig?: unknown
    }
    _upl_version?: number
    _upl_created_at?: unknown
    _upl_updated_at?: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mapHubSummary = (hub: Record<string, unknown>): HubSummaryRow => ({
    id: String(hub.id),
    name: hub.name,
    codename: getCodenameText(hub.codename)
})

const mapHubSummaries = (hubs: Record<string, unknown>[]): HubSummaryRow[] => hubs.map(mapHubSummary)

const isCatalogObject = (row: CatalogObjectRow | null | undefined, compatibleKinds?: Set<string>): row is CatalogObjectRow => {
    if (!row) return false
    const kind = typeof row.kind === 'string' && row.kind.length > 0 ? row.kind : MetaEntityKind.CATALOG
    return compatibleKinds ? compatibleKinds.has(kind) : kind === MetaEntityKind.CATALOG
}

const getCatalogHubIds = (row: CatalogObjectRow): string[] => {
    const rawHubs = row.config?.hubs
    if (!Array.isArray(rawHubs)) return []
    return rawHubs.filter((hubId): hubId is string => typeof hubId === 'string')
}

const getLocalizedPrimaryLocale = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') return undefined
    const primaryLocale = (value as Record<string, unknown>)._primary
    return typeof primaryLocale === 'string' && primaryLocale.length > 0 ? primaryLocale : undefined
}

const getCatalogPresentation = (row: Pick<CatalogObjectRow, 'presentation'>): Record<string, unknown> =>
    row.presentation && typeof row.presentation === 'object' ? (row.presentation as Record<string, unknown>) : {}

const getCatalogNameField = (row: CatalogObjectRow): unknown => row.name ?? getCatalogPresentation(row).name

const getCatalogDescriptionField = (row: CatalogObjectRow): unknown => row.description ?? getCatalogPresentation(row).description

const mapCatalogListItem = (
    row: CatalogObjectRow,
    metahubId: string,
    attributesCount: number,
    elementsCount: number
): CatalogListItemRow => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    name: getCatalogNameField(row) || {},
    description: getCatalogDescriptionField(row) || {},
    isSingleHub: row.config?.isSingleHub || false,
    isRequiredHub: row.config?.isRequiredHub || false,
    sortOrder: row.config?.sortOrder || 0,
    version: row._upl_version || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attributesCount,
    elementsCount,
    hubs: []
})

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocaleCode(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
        .filter(([, content]) => content.length > 0)

    if (entries.length === 0) {
        return {
            en: 'Copy (copy)'
        }
    }

    const result: Record<string, string> = {}
    for (const [locale, content] of entries) {
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = `${content}${suffix}`
    }
    return result
}

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

const matchesCatalogSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

const getCatalogCodenameText = (codename: unknown): string =>
    getCodenamePayloadText(codename as Parameters<typeof getCodenamePayloadText>[0])

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createCatalogSchema = z
    .object({
        codename: requiredCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        sortOrder: z.number().int().optional(),
        isSingleHub: z.boolean().optional(),
        isRequiredHub: z.boolean().optional(),
        hubIds: z.array(z.string().uuid()).optional()
    })
    .strict()

const updateCatalogSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
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
    .strict()

const copyCatalogSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        copyAttributes: z.boolean().optional(),
        copyElements: z.boolean().optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        if (value.copyAttributes === false && value.copyElements === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['copyElements'],
                message: 'copyElements requires copyAttributes=true'
            })
        }
    })

const reorderCatalogsSchema = z
    .object({
        catalogId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

const compareCatalogTieBreak = (a: CatalogListItemRow, b: CatalogListItemRow): number => {
    const bySortOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySortOrder !== 0) return bySortOrder

    const byCodename = getCatalogCodenameText(a.codename).localeCompare(getCatalogCodenameText(b.codename))
    if (byCodename !== 0) return byCodename

    return a.id.localeCompare(b.id)
}

const compareCatalogItems = (a: CatalogListItemRow, b: CatalogListItemRow, sortBy: string, sortOrder: 'asc' | 'desc'): number => {
    let valA: string | number
    let valB: string | number
    if (sortBy === 'name') {
        valA = getLocalizedSortValue(a.name, getCatalogCodenameText(a.codename))
        valB = getLocalizedSortValue(b.name, getCatalogCodenameText(b.codename))
    } else if (sortBy === 'codename') {
        valA = getCatalogCodenameText(a.codename)
        valB = getCatalogCodenameText(b.codename)
    } else if (sortBy === 'sortOrder') {
        valA = a.sortOrder ?? 0
        valB = b.sortOrder ?? 0
    } else if (sortBy === 'updated') {
        valA = toTimestamp(a.updatedAt)
        valB = toTimestamp(b.updatedAt)
    } else {
        valA = toTimestamp(a.createdAt)
        valB = toTimestamp(b.createdAt)
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1
    return compareCatalogTieBreak(a, b)
}

// ---------------------------------------------------------------------------
// Domain services factory
// ---------------------------------------------------------------------------

const createDomainServices = (exec: DbExecutor, schemaService: MetahubSchemaService) => {
    const objectsService = new MetahubObjectsService(exec, schemaService)
    const hubsService = new MetahubHubsService(exec, schemaService)
    const attributesService = new MetahubAttributesService(exec, schemaService)
    const elementsService = new MetahubElementsService(exec, schemaService, objectsService, attributesService)
    const settingsService = new MetahubSettingsService(exec, schemaService)
    const entityTypeService = new EntityTypeService(exec, schemaService)
    return { objectsService, hubsService, attributesService, elementsService, settingsService, entityTypeService }
}

const resolveCatalogObjectKind = (catalog: Pick<CatalogObjectRow, 'kind'>): string =>
    typeof catalog.kind === 'string' && catalog.kind.length > 0 ? catalog.kind : MetaEntityKind.CATALOG

const createCatalogLikeObject = (
    objectsService: MetahubObjectsService,
    metahubId: string,
    kind: string,
    input: {
        codename: unknown
        name: unknown
        description?: unknown
        config?: unknown
        createdBy?: string | null
    },
    userId?: string,
    db?: SqlQueryable
) =>
    kind === MetaEntityKind.CATALOG
        ? objectsService.createCatalog(metahubId, input, userId, db)
        : objectsService.createObject(metahubId, kind, input, userId, db)

const updateCatalogLikeObject = (
    objectsService: MetahubObjectsService,
    metahubId: string,
    catalogId: string,
    kind: string,
    input: {
        codename?: unknown
        name?: unknown
        description?: unknown
        config?: unknown
        updatedBy?: string | null
        expectedVersion?: number
    },
    userId?: string,
    db?: SqlQueryable
) =>
    kind === MetaEntityKind.CATALOG
        ? objectsService.updateCatalog(metahubId, catalogId, input, userId)
        : objectsService.updateObject(metahubId, catalogId, kind, input, userId, db)

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createCatalogsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>, getDbExecutor: () => DbExecutor) {
    // -----------------------------------------------------------------------
    // GET /metahub/:metahubId/catalogs
    // -----------------------------------------------------------------------
    const list = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, hubsService, attributesService, elementsService, entityTypeService } = createDomainServices(
            exec,
            schemaService
        )

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

        const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
        const rawCatalogs = (await objectsService.findAllByKinds(metahubId, catalogCompatibleKinds, userId)) as CatalogObjectRow[]
        const catalogIds = rawCatalogs.map((row) => row.id)

        const [attributesCounts, elementsCounts] = await Promise.all([
            attributesService.countByObjectIds(metahubId, catalogIds, userId),
            elementsService.countByObjectIds(metahubId, catalogIds, userId)
        ])

        let items = rawCatalogs.map((row) =>
            mapCatalogListItem(row, metahubId, attributesCounts.get(row.id) || 0, elementsCounts.get(row.id) || 0)
        )

        if (search) {
            const searchLower = search.toLowerCase()
            items = items.filter((item) => matchesCatalogSearch(getCatalogCodenameText(item.codename), item.name, searchLower))
        }

        items.sort((a, b) => compareCatalogItems(a, b, sortBy, sortOrder))

        const total = items.length
        const paginatedItems = items.slice(offset, offset + limit)

        const allHubIds = new Set<string>()
        const hubIdsByCatalog = new Map<string, string[]>()

        rawCatalogs.forEach((row) => {
            const ids = getCatalogHubIds(row)
            if (ids.length > 0) {
                ids.forEach((id) => allHubIds.add(id))
                hubIdsByCatalog.set(row.id, ids)
            }
        })

        const hubMap = new Map<string, HubSummaryRow>()
        if (allHubIds.size > 0) {
            const hubs = await hubsService.findByIds(metahubId, Array.from(allHubIds), userId)
            hubs.forEach((hub) => {
                const summary = mapHubSummary(hub)
                hubMap.set(summary.id, summary)
            })
        }

        const resultItems = paginatedItems.map((item) => {
            const ids = hubIdsByCatalog.get(item.id) || []
            const matchedHubs = ids.map((id) => hubMap.get(id)).filter((hub): hub is HubSummaryRow => Boolean(hub))
            return { ...item, hubs: matchedHubs }
        })

        res.json({ items: resultItems, pagination: { total, limit, offset } })
    })

    // -----------------------------------------------------------------------
    // POST /metahub/:metahubId/catalogs
    // -----------------------------------------------------------------------
    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, hubsService, attributesService, settingsService, entityTypeService } = createDomainServices(
                exec,
                schemaService
            )
            const platformSystemAttributesPolicy = await readPlatformSystemAttributesPolicy(exec)
            const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)

            const parsed = createCatalogSchema.safeParse(req.body)
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

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
            if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                })
            }

            const existing = await objectsService.findByCodenameInKinds(metahubId, normalizedCodename, catalogCompatibleKinds, userId)
            if (existing) {
                return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
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

            const codenamePayload = syncCodenamePayloadText(
                codename,
                namePrimaryLocale ?? 'en',
                normalizedCodename,
                codenameStyle,
                codenameAlphabet
            )
            if (!codenamePayload) {
                return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
            }

            const effectiveIsRequired = isRequiredHub ?? false
            const targetHubIds: string[] = hubIds ?? []

            if ((isSingleHub ?? false) && targetHubIds.length > 1) {
                return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
            }

            if (effectiveIsRequired && targetHubIds.length === 0) {
                return res.status(400).json({ error: 'Catalog with required hub flag must have at least one hub association' })
            }

            if (targetHubIds.length > 0) {
                const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
                if (validHubs.length !== targetHubIds.length) {
                    return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                }
            }

            let created
            try {
                created = await exec.transaction(async (trx: SqlQueryable) => {
                    const nextCatalog = await objectsService.createCatalog(
                        metahubId,
                        {
                            codename: codenamePayload,
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
                        userId,
                        trx
                    )
                    await attributesService.ensureCatalogSystemAttributes(metahubId, nextCatalog.id, userId, trx, {
                        policy: platformSystemAttributesPolicy
                    })
                    return nextCatalog
                })
            } catch (error) {
                if (database.isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
                }
                throw error
            }

            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            res.status(201).json({
                id: created.id,
                metahubId,
                codename: created.codename,
                name: getCatalogNameField(created as CatalogObjectRow) ?? {},
                description: getCatalogDescriptionField(created as CatalogObjectRow) ?? null,
                isSingleHub: created.config.isSingleHub,
                isRequiredHub: created.config.isRequiredHub,
                sortOrder: created.config.sortOrder,
                version: created._upl_version || 1,
                createdAt: created.created_at,
                updatedAt: created.updated_at,
                hubs: mapHubSummaries(hubs)
            })
        },
        { permission: 'editContent' }
    )

    // -----------------------------------------------------------------------
    // PATCH /metahub/:metahubId/catalog/:catalogId
    // -----------------------------------------------------------------------
    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId } = req.params
            const { objectsService, hubsService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)
            const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
            const catalogCompatibleKindSet = createCatalogCompatibleKindSet(catalogCompatibleKinds)

            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            if (!isCatalogObject(catalog, catalogCompatibleKindSet)) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const parsed = updateCatalogSchema.safeParse(req.body)
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

            const currentName = getCatalogNameField(catalog)
            const currentDescription = getCatalogDescriptionField(catalog)
            const currentConfig = catalog.config || {}

            let finalName = currentName
            let finalDescription = currentDescription
            let finalCodename: unknown = catalog.codename
            let finalCodenameText = getCatalogCodenameText(catalog.codename)

            let currentHubIds: string[] = getCatalogHubIds(catalog)
            let targetHubIds = currentHubIds

            if (hubIds !== undefined) {
                if ((isSingleHub ?? currentConfig.isSingleHub) && hubIds.length > 1) {
                    return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
                }

                const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
                if (effectiveIsRequiredHub && hubIds.length === 0) {
                    return res.status(400).json({ error: 'This catalog requires at least one hub association' })
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
                const {
                    style: codenameStyle,
                    alphabet: codenameAlphabet,
                    allowMixed
                } = await getCodenameSettings(settingsService, metahubId, userId)
                const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
                if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                    })
                }
                if (normalizedCodename !== getCatalogCodenameText(catalog.codename)) {
                    const existing = await objectsService.findByCodenameInKinds(
                        metahubId,
                        normalizedCodename,
                        catalogCompatibleKinds,
                        userId
                    )
                    if (existing && existing.id !== catalogId) {
                        return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
                    }
                }
                const nextCodename = syncCodenamePayloadText(
                    codename,
                    getLocalizedPrimaryLocale(catalog.codename) ?? namePrimaryLocale ?? 'en',
                    normalizedCodename,
                    codenameStyle,
                    codenameAlphabet
                )
                if (!nextCodename) {
                    return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
                }
                finalCodename = nextCodename
                finalCodenameText = normalizedCodename
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? getLocalizedPrimaryLocale(currentName) ?? 'en'
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
                        getLocalizedPrimaryLocale(currentDescription) ??
                        getLocalizedPrimaryLocale(currentName) ??
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

            if (isSingleHub !== undefined) {
                if (isSingleHub) {
                    if (targetHubIds.length > 1) {
                        return res.status(400).json({ error: 'Cannot set single hub mode when catalog is associated with multiple hubs' })
                    }
                }
            }

            if (isRequiredHub !== undefined) {
                if (isRequiredHub) {
                    if (targetHubIds.length === 0) {
                        return res.status(400).json({ error: 'Cannot require hub association when catalog has no hubs' })
                    }
                }
            }

            const updated = (await updateCatalogLikeObject(
                objectsService,
                metahubId,
                catalogId,
                resolveCatalogObjectKind(catalog),
                {
                    codename: finalCodenameText !== getCatalogCodenameText(catalog.codename) ? finalCodename : undefined,
                    name: finalName,
                    description: finalDescription,
                    config: {
                        hubs: targetHubIds,
                        isSingleHub: isSingleHub ?? currentConfig.isSingleHub,
                        isRequiredHub: isRequiredHub ?? currentConfig.isRequiredHub,
                        sortOrder: sortOrder ?? currentConfig.sortOrder,
                        runtimeConfig: undefined
                    },
                    updatedBy: userId,
                    expectedVersion
                },
                userId
            )) as CatalogObjectRow

            const persistedUpdated = (await objectsService.findById(metahubId, updated.id, userId)) as CatalogObjectRow | null
            const responseCatalog = persistedUpdated ?? updated

            const hubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            res.json({
                id: responseCatalog.id,
                metahubId,
                codename: responseCatalog.codename,
                name: getCatalogNameField(responseCatalog) ?? {},
                description: getCatalogDescriptionField(responseCatalog) ?? null,
                isSingleHub: responseCatalog.config?.isSingleHub ?? false,
                isRequiredHub: responseCatalog.config?.isRequiredHub ?? false,
                sortOrder: responseCatalog.config?.sortOrder ?? 0,
                version: responseCatalog._upl_version || 1,
                createdAt: responseCatalog.created_at,
                updatedAt: responseCatalog.updated_at,
                hubs: mapHubSummaries(hubs)
            })
        },
        { permission: 'editContent' }
    )

    // -----------------------------------------------------------------------
    // GET /metahub/:metahubId/hub/:hubId/catalogs
    // -----------------------------------------------------------------------
    const listByHub = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { hubId } = req.params
        const { objectsService, hubsService, attributesService, elementsService, entityTypeService } = createDomainServices(
            exec,
            schemaService
        )

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

        const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
        const allCatalogs = (await objectsService.findAllByKinds(metahubId, catalogCompatibleKinds, userId)) as CatalogObjectRow[]

        const hubCatalogs = allCatalogs.filter((cat) => getCatalogHubIds(cat).includes(hubId))

        const catalogIds = hubCatalogs.map((row) => row.id)
        const [attributesCounts, elementsCounts] = await Promise.all([
            attributesService.countByObjectIds(metahubId, catalogIds, userId),
            elementsService.countByObjectIds(metahubId, catalogIds, userId)
        ])

        let items = hubCatalogs.map((row) =>
            mapCatalogListItem(row, metahubId, attributesCounts.get(row.id) || 0, elementsCounts.get(row.id) || 0)
        )

        if (search) {
            const searchLower = search.toLowerCase()
            items = items.filter((item) => matchesCatalogSearch(getCatalogCodenameText(item.codename), item.name, searchLower))
        }

        items.sort((a, b) => compareCatalogItems(a, b, sortBy, sortOrder))

        const total = items.length
        const paginatedItems = items.slice(offset, offset + limit)

        const allHubIds = new Set<string>()
        const hubIdsByCatalog = new Map<string, string[]>()

        hubCatalogs.forEach((row) => {
            const ids = getCatalogHubIds(row)
            if (ids.length > 0) {
                ids.forEach((id) => allHubIds.add(id))
                hubIdsByCatalog.set(row.id, ids)
            }
        })

        const hubMap = new Map<string, HubSummaryRow>()
        if (allHubIds.size > 0) {
            const hubs = await hubsService.findByIds(metahubId, Array.from(allHubIds), userId)
            hubs.forEach((hub) => {
                const summary = mapHubSummary(hub)
                hubMap.set(summary.id, summary)
            })
        }

        const resultItems = paginatedItems.map((item) => {
            const ids = hubIdsByCatalog.get(item.id) || []
            const matchedHubs = ids.map((id) => hubMap.get(id)).filter((hub): hub is HubSummaryRow => Boolean(hub))
            return { ...item, hubs: matchedHubs }
        })

        res.json({ items: resultItems, pagination: { total, limit, offset } })
    })

    // -----------------------------------------------------------------------
    // PATCH reorder (dual path: global + hub-scoped)
    // -----------------------------------------------------------------------
    const reorder = async (req: Request, res: Response) => {
        const { metahubId } = req.params
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const dbSession = getRequestDbSession(req)
        const schemaService = new MetahubSchemaService(exec)
        const { objectsService, entityTypeService } = createDomainServices(exec, schemaService)

        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })
        await ensureMetahubAccess(exec, userId, metahubId, 'editContent', dbSession)

        const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
        const catalogCompatibleKindSet = createCatalogCompatibleKindSet(catalogCompatibleKinds)

        const parsed = reorderCatalogsSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
        }

        const catalog = await objectsService.findById(metahubId, parsed.data.catalogId, userId)
        if (!isCatalogObject(catalog, catalogCompatibleKindSet)) {
            return res.status(404).json({ error: 'Catalog not found' })
        }

        const updated = await objectsService.reorderByKind(
            metahubId,
            catalog.kind ?? MetaEntityKind.CATALOG,
            parsed.data.catalogId,
            parsed.data.newSortOrder,
            userId
        )
        return res.json({
            id: updated.id,
            sortOrder: updated.config?.sortOrder ?? 0
        })
    }

    // -----------------------------------------------------------------------
    // GET /metahub/:metahubId/hub/:hubId/catalog/:catalogId
    // -----------------------------------------------------------------------
    const getByHub = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { hubId, catalogId } = req.params
        const { objectsService, hubsService, attributesService, elementsService, entityTypeService } = createDomainServices(
            exec,
            schemaService
        )
        const catalogCompatibleKindSet = createCatalogCompatibleKindSet(
            await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
        )

        const catalog = await objectsService.findById(metahubId, catalogId, userId)
        if (!isCatalogObject(catalog, catalogCompatibleKindSet)) {
            return res.status(404).json({ error: 'Catalog not found' })
        }

        const currentConfig = catalog.config || {}
        const currentHubs = getCatalogHubIds(catalog)

        if (!currentHubs.includes(hubId)) {
            return res.status(404).json({ error: 'Catalog not found in this hub' })
        }

        const hubs = currentHubs.length > 0 ? await hubsService.findByIds(metahubId, currentHubs, userId) : []

        const [attributesCounts, elementsCounts] = await Promise.all([
            attributesService.countByObjectIds(metahubId, [catalog.id], userId),
            elementsService.countByObjectIds(metahubId, [catalog.id], userId)
        ])

        const attributesCount = attributesCounts.get(catalog.id) ?? 0
        const elementsCount = elementsCounts.get(catalog.id) ?? 0

        res.json({
            id: catalog.id,
            metahubId,
            codename: catalog.codename,
            name: getCatalogNameField(catalog) ?? {},
            description: getCatalogDescriptionField(catalog) ?? null,
            isSingleHub: currentConfig.isSingleHub,
            isRequiredHub: currentConfig.isRequiredHub,
            sortOrder: currentConfig.sortOrder,
            version: catalog._upl_version || 1,
            createdAt: catalog.created_at,
            updatedAt: catalog.updated_at,
            hubs: mapHubSummaries(hubs),
            attributesCount,
            elementsCount
        })
    })

    // -----------------------------------------------------------------------
    // GET /metahub/:metahubId/catalog/:catalogId
    // -----------------------------------------------------------------------
    const getById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { catalogId } = req.params
        const { objectsService, hubsService, attributesService, elementsService, entityTypeService } = createDomainServices(
            exec,
            schemaService
        )
        const catalogCompatibleKindSet = createCatalogCompatibleKindSet(
            await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
        )

        const catalog = await objectsService.findById(metahubId, catalogId, userId)
        if (!isCatalogObject(catalog, catalogCompatibleKindSet)) {
            return res.status(404).json({ error: 'Catalog not found' })
        }

        const currentConfig = catalog.config || {}
        const hubIds = getCatalogHubIds(catalog)
        const hubs = hubIds.length > 0 ? await hubsService.findByIds(metahubId, hubIds, userId) : []

        const [attributesCounts, elementsCounts] = await Promise.all([
            attributesService.countByObjectIds(metahubId, [catalog.id], userId),
            elementsService.countByObjectIds(metahubId, [catalog.id], userId)
        ])

        const attributesCount = attributesCounts.get(catalog.id) ?? 0
        const elementsCount = elementsCounts.get(catalog.id) ?? 0

        res.json({
            id: catalog.id,
            metahubId,
            codename: catalog.codename,
            name: getCatalogNameField(catalog) ?? {},
            description: getCatalogDescriptionField(catalog) ?? null,
            isSingleHub: currentConfig.isSingleHub,
            isRequiredHub: currentConfig.isRequiredHub,
            sortOrder: currentConfig.sortOrder,
            version: catalog._upl_version || 1,
            createdAt: catalog.created_at,
            updatedAt: catalog.updated_at,
            hubs: mapHubSummaries(hubs),
            attributesCount,
            elementsCount
        })
    })

    // -----------------------------------------------------------------------
    // POST /metahub/:metahubId/catalog/:catalogId/copy — raw handler (metahub check before access)
    // -----------------------------------------------------------------------
    const copy = async (req: Request, res: Response) => {
        const { metahubId, catalogId } = req.params
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const dbSession = getRequestDbSession(req)

        const userId = resolveUserId(req)
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }
        const metahub = await findMetahubById(exec, metahubId)
        if (!metahub) {
            return res.status(404).json({ error: 'Metahub not found' })
        }
        await ensureMetahubAccess(exec, userId, metahubId, 'editContent', dbSession)

        const schemaService = new MetahubSchemaService(exec)
        const { objectsService, hubsService, attributesService, settingsService, entityTypeService } = createDomainServices(
            exec,
            schemaService
        )
        const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
        const catalogCompatibleKindSet = createCatalogCompatibleKindSet(catalogCompatibleKinds)

        const sourceCatalog = await objectsService.findById(metahubId, catalogId, userId)
        if (!isCatalogObject(sourceCatalog, catalogCompatibleKindSet)) {
            return res.status(404).json({ error: 'Catalog not found' })
        }

        const allowCopyRow = await settingsService.findByKey(metahubId, 'catalogs.allowCopy', userId)
        if (allowCopyRow && allowCopyRow.value?._value === false) {
            return res.status(403).json({ error: 'Copying catalogs is disabled in metahub settings' })
        }

        const platformSystemAttributesPolicy = await readPlatformSystemAttributesPolicy(exec)

        const parsed = copyCatalogSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
        }

        const sourceName = getCatalogNameField(sourceCatalog)
        const sourceDescription = getCatalogDescriptionField(sourceCatalog)
        const sourceConfig = sourceCatalog.config ?? {}

        const requestedName = parsed.data.name ? sanitizeLocalizedInput(parsed.data.name) : buildDefaultCopyNameInput(sourceName)
        if (Object.keys(requestedName).length === 0) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }

        const sourceNamePrimary = getLocalizedPrimaryLocale(sourceName) ?? 'en'
        const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceNamePrimary)
        if (!nameVlc) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }

        let descriptionVlc: unknown = sourceDescription ?? null
        if (parsed.data.description !== undefined) {
            const sanitizedDescription = sanitizeLocalizedInput(parsed.data.description)
            if (Object.keys(sanitizedDescription).length > 0) {
                descriptionVlc = buildLocalizedContent(
                    sanitizedDescription,
                    parsed.data.descriptionPrimaryLocale,
                    parsed.data.namePrimaryLocale ?? sourceNamePrimary
                )
            } else {
                descriptionVlc = null
            }
        }

        const codenameFallbackPrimaryLocale = normalizeLocaleCode(parsed.data.namePrimaryLocale ?? sourceNamePrimary)

        const {
            style: codenameStyle,
            alphabet: codenameAlphabet,
            allowMixed
        } = await getCodenameSettings(settingsService, metahubId, userId)
        const copySuffix = codenameStyle === 'pascal-case' ? 'Copy' : '-copy'
        const normalizedBaseCodename = normalizeCodenameForStyle(
            parsed.data.codename
                ? getCodenamePayloadText(parsed.data.codename)
                : `${getCatalogCodenameText(sourceCatalog.codename)}${copySuffix}`,
            codenameStyle,
            codenameAlphabet
        )
        if (!normalizedBaseCodename || !isValidCodenameForStyle(normalizedBaseCodename, codenameStyle, codenameAlphabet, allowMixed)) {
            return res.status(400).json({
                error: 'Validation failed',
                details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
            })
        }

        const copyOptions: CatalogCopyOptions = normalizeCatalogCopyOptions({
            copyAttributes: parsed.data.copyAttributes,
            copyElements: parsed.data.copyElements
        })

        const schemaName = await schemaService.ensureSchema(metahubId, userId)

        const createCatalogCopy = async (codename: string) => {
            return exec.transaction(async (trx: SqlQueryable) => {
                const codenamePayloadForCopy = syncCodenamePayloadText(
                    parsed.data.codename ?? sourceCatalog.codename,
                    codenameFallbackPrimaryLocale,
                    codename,
                    codenameStyle,
                    codenameAlphabet
                )
                if (!codenamePayloadForCopy) {
                    throw new MetahubValidationError('Failed to resolve copied catalog codename')
                }
                const sourceHubIds = Array.isArray(sourceConfig.hubs)
                    ? sourceConfig.hubs.filter((value: unknown): value is string => typeof value === 'string')
                    : []

                const updatedCatalog = (await createCatalogLikeObject(
                    objectsService,
                    metahubId,
                    resolveCatalogObjectKind(sourceCatalog),
                    {
                        codename: codenamePayloadForCopy,
                        name: nameVlc,
                        description: descriptionVlc ?? null,
                        config: {
                            ...sourceConfig,
                            hubs: sourceHubIds,
                            runtimeConfig: undefined
                        },
                        createdBy: userId
                    },
                    userId,
                    trx
                )) as CopiedCatalogRow

                const copyResult = await copyDesignTimeObjectChildren({
                    metahubId,
                    sourceObjectId: catalogId,
                    targetObjectId: updatedCatalog.id,
                    tx: trx,
                    userId,
                    schemaName,
                    copyAttributes: copyOptions.copyAttributes,
                    copyElements: copyOptions.copyElements,
                    ensureObjectSystemAttributes: attributesService.ensureObjectSystemAttributes.bind(attributesService),
                    platformSystemAttributesPolicy,
                    attributeCopyFailureMessage: 'Failed to copy catalog attributes hierarchy'
                })

                return {
                    catalog: updatedCatalog,
                    copiedAttributesCount: copyResult.attributesCopied,
                    copiedElementsCount: copyResult.elementsCopied
                }
            })
        }

        let copiedResult: { catalog: CopiedCatalogRow; copiedAttributesCount: number; copiedElementsCount: number } | null = null

        for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS; attempt += 1) {
            const codenameCandidate = buildCodenameAttempt(normalizedBaseCodename, attempt, codenameStyle)
            const existing = await objectsService.findByCodenameInKinds(metahubId, codenameCandidate, catalogCompatibleKinds, userId)
            if (existing) {
                continue
            }
            try {
                copiedResult = await createCatalogCopy(codenameCandidate)
                break
            } catch (error) {
                if (database.isUniqueViolation(error)) {
                    const constraint = database.getDbErrorConstraint(error) ?? ''
                    if (constraint === 'idx_mhb_objects_kind_codename_active') {
                        continue
                    }
                }
                throw error
            }
        }

        if (!copiedResult) {
            return res.status(409).json({ error: 'Unable to generate unique codename for catalog copy' })
        }

        const copiedCatalog = copiedResult.catalog
        const copiedConfig = copiedCatalog.config ?? {}
        const copiedHubIds = Array.isArray(copiedConfig.hubs)
            ? copiedConfig.hubs.filter((value: unknown): value is string => typeof value === 'string')
            : []
        const hubs = copiedHubIds.length > 0 ? await hubsService.findByIds(metahubId, copiedHubIds, userId) : []

        return res.status(201).json({
            id: copiedCatalog.id,
            metahubId,
            codename: copiedCatalog.codename,
            name: getCatalogNameField(copiedCatalog) ?? {},
            description: getCatalogDescriptionField(copiedCatalog) ?? null,
            isSingleHub: copiedConfig.isSingleHub ?? false,
            isRequiredHub: copiedConfig.isRequiredHub ?? false,
            sortOrder: copiedConfig.sortOrder ?? 0,
            version: copiedCatalog._upl_version || 1,
            createdAt: copiedCatalog._upl_created_at,
            updatedAt: copiedCatalog._upl_updated_at,
            attributesCount: copiedResult.copiedAttributesCount,
            elementsCount: copiedResult.copiedElementsCount,
            hubs: mapHubSummaries(hubs as Record<string, unknown>[])
        })
    }

    // -----------------------------------------------------------------------
    // POST /metahub/:metahubId/hub/:hubId/catalogs — hub-scoped create
    // -----------------------------------------------------------------------
    const createByHub = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { hubId } = req.params
            const { objectsService, hubsService, attributesService, settingsService, entityTypeService } = createDomainServices(
                exec,
                schemaService
            )
            const platformSystemAttributesPolicy = await readPlatformSystemAttributesPolicy(exec)
            const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)

            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) {
                return res.status(404).json({ error: 'Hub not found' })
            }

            const parsed = createCatalogSchema.safeParse(req.body)
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

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
            if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                })
            }

            const existing = await objectsService.findByCodenameInKinds(metahubId, normalizedCodename, catalogCompatibleKinds, userId)
            if (existing) {
                return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
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

            const codenamePayload = syncCodenamePayloadText(
                codename,
                namePrimaryLocale ?? 'en',
                normalizedCodename,
                codenameStyle,
                codenameAlphabet
            )
            if (!codenamePayload) {
                return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
            }

            const effectiveIsRequired = isRequiredHub ?? false
            const targetHubIds = hubIds && Array.isArray(hubIds) ? hubIds : [hubId]

            if ((isSingleHub ?? false) && targetHubIds.length > 1) {
                return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
            }

            const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
            if (validHubs.length !== targetHubIds.length) {
                return res.status(400).json({ error: 'One or more hub IDs are invalid' })
            }

            let catalog
            try {
                catalog = await exec.transaction(async (trx: SqlQueryable) => {
                    const nextCatalog = await objectsService.createCatalog(
                        metahubId,
                        {
                            codename: codenamePayload,
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
                        userId,
                        trx
                    )
                    await attributesService.ensureCatalogSystemAttributes(metahubId, nextCatalog.id, userId, trx, {
                        policy: platformSystemAttributesPolicy
                    })
                    return nextCatalog
                })
            } catch (error) {
                if (database.isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
                }
                throw error
            }

            const hubs = await hubsService.findByIds(metahubId, targetHubIds, userId)

            res.status(201).json({
                id: catalog.id,
                metahubId,
                codename: catalog.codename,
                name: getCatalogNameField(catalog as CatalogObjectRow) ?? {},
                description: getCatalogDescriptionField(catalog as CatalogObjectRow) ?? null,
                isSingleHub: catalog.config.isSingleHub,
                isRequiredHub: catalog.config.isRequiredHub,
                sortOrder: catalog.config.sortOrder,
                version: catalog._upl_version || 1,
                createdAt: catalog.created_at,
                updatedAt: catalog.updated_at,
                hubs: mapHubSummaries(hubs)
            })
        },
        { permission: 'editContent' }
    )

    // -----------------------------------------------------------------------
    // PATCH /metahub/:metahubId/hub/:hubId/catalog/:catalogId — hub-scoped update
    // -----------------------------------------------------------------------
    const updateByHub = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { hubId, catalogId } = req.params
            const { objectsService, hubsService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)
            const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
            const catalogCompatibleKindSet = createCatalogCompatibleKindSet(catalogCompatibleKinds)

            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            if (!isCatalogObject(catalog, catalogCompatibleKindSet)) {
                return res.status(404).json({ error: 'Catalog not found' })
            }

            const currentHubs = getCatalogHubIds(catalog)
            if (!currentHubs.includes(hubId)) {
                return res.status(404).json({ error: 'Catalog not found in this hub' })
            }

            const parsed = updateCatalogSchema.safeParse(req.body)
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

            const currentName = getCatalogNameField(catalog)
            const currentDescription = getCatalogDescriptionField(catalog)
            const currentConfig = catalog.config || {}

            let finalName = currentName
            let finalDescription = currentDescription
            let finalCodename: unknown = catalog.codename
            let finalCodenameText = getCatalogCodenameText(catalog.codename)
            let targetHubIds = getCatalogHubIds(catalog)

            if (hubIds !== undefined) {
                targetHubIds = hubIds

                if ((isSingleHub ?? currentConfig.isSingleHub) && targetHubIds.length > 1) {
                    return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
                }
                const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
                if (effectiveIsRequiredHub && targetHubIds.length === 0) {
                    return res.status(400).json({ error: 'This catalog requires at least one hub association' })
                }

                if (targetHubIds.length > 0) {
                    const validHubs = await hubsService.findByIds(metahubId, targetHubIds, userId)
                    if (validHubs.length !== targetHubIds.length) {
                        return res.status(400).json({ error: 'One or more hub IDs are invalid' })
                    }
                }
            }

            if (codename !== undefined) {
                const {
                    style: codenameStyle,
                    alphabet: codenameAlphabet,
                    allowMixed
                } = await getCodenameSettings(settingsService, metahubId, userId)
                const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
                if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                    })
                }
                if (normalizedCodename !== getCatalogCodenameText(catalog.codename)) {
                    const existing = await objectsService.findByCodenameInKinds(
                        metahubId,
                        normalizedCodename,
                        catalogCompatibleKinds,
                        userId
                    )
                    if (existing && existing.id !== catalogId) {
                        return res.status(409).json({ error: 'Catalog with this codename already exists' })
                    }
                }
                const nextCodename = syncOptionalCodenamePayloadText(
                    codename,
                    getLocalizedPrimaryLocale(catalog.codename) ?? namePrimaryLocale ?? 'en',
                    normalizedCodename
                )
                if (!nextCodename) {
                    return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
                }
                finalCodename = nextCodename
                finalCodenameText = normalizedCodename
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? getLocalizedPrimaryLocale(currentName) ?? 'en'
                finalName = buildLocalizedContent(sanitizedName, primary, primary)
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                finalDescription =
                    Object.keys(sanitizedDescription).length > 0
                        ? buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale || 'en', 'en')
                        : undefined
            }

            const updated = (await updateCatalogLikeObject(
                objectsService,
                metahubId,
                catalogId,
                resolveCatalogObjectKind(catalog),
                {
                    codename: finalCodenameText !== getCatalogCodenameText(catalog.codename) ? finalCodename : undefined,
                    name: finalName,
                    description: finalDescription,
                    config: {
                        hubs: targetHubIds,
                        isSingleHub: isSingleHub ?? currentConfig.isSingleHub,
                        isRequiredHub: isRequiredHub ?? currentConfig.isRequiredHub,
                        sortOrder: sortOrder ?? currentConfig.sortOrder,
                        runtimeConfig: undefined
                    },
                    updatedBy: userId,
                    expectedVersion
                },
                userId
            )) as CatalogObjectRow

            const persistedUpdated = (await objectsService.findById(metahubId, updated.id, userId)) as CatalogObjectRow | null
            const responseCatalog = persistedUpdated ?? updated

            const outputHubs = targetHubIds.length > 0 ? await hubsService.findByIds(metahubId, targetHubIds, userId) : []

            res.json({
                id: responseCatalog.id,
                metahubId,
                codename: responseCatalog.codename,
                name: getCatalogNameField(responseCatalog) ?? {},
                description: getCatalogDescriptionField(responseCatalog) ?? null,
                isSingleHub: responseCatalog.config?.isSingleHub ?? false,
                isRequiredHub: responseCatalog.config?.isRequiredHub ?? false,
                sortOrder: responseCatalog.config?.sortOrder ?? 0,
                version: responseCatalog._upl_version || 1,
                createdAt: responseCatalog.created_at,
                updatedAt: responseCatalog.updated_at,
                hubs: mapHubSummaries(outputHubs)
            })
        },
        { permission: 'editContent' }
    )

    // -----------------------------------------------------------------------
    // GET blocking-references (dual path)
    // -----------------------------------------------------------------------
    const getBlockingReferences = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { catalogId } = req.params
        const { objectsService, attributesService, entityTypeService } = createDomainServices(exec, schemaService)
        const catalogCompatibleKindSet = createCatalogCompatibleKindSet(
            await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
        )

        const catalog = await objectsService.findById(metahubId, catalogId, userId)
        if (!isCatalogObject(catalog, catalogCompatibleKindSet)) {
            return res.json({
                catalogId,
                blockingReferences: [],
                canDelete: true
            })
        }

        const blockingReferences = await findBlockingCatalogReferences(metahubId, catalogId, attributesService, userId)
        return res.json({
            catalogId,
            blockingReferences,
            canDelete: blockingReferences.length === 0
        })
    })

    // -----------------------------------------------------------------------
    // DELETE /metahub/:metahubId/hub/:hubId/catalog/:catalogId
    // -----------------------------------------------------------------------
    const deleteByHub = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { hubId, catalogId } = req.params
            const { objectsService, attributesService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)
            const catalogCompatibleKindSet = createCatalogCompatibleKindSet(
                await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
            )

            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            const entity = isCatalogObject(catalog, catalogCompatibleKindSet) ? catalog : null
            const result = await executeHubScopedDelete({
                entity,
                entityLabel: 'Catalog',
                notFoundMessage: 'Catalog not found',
                notFoundInHubMessage: 'Catalog not found in this hub',
                hubId,
                forceDelete: req.query.force === 'true',
                getHubIds: getCatalogHubIds,
                isRequiredHub: (currentCatalog) => Boolean(currentCatalog.config?.isRequiredHub),
                lastHubConflictMessage:
                    'Cannot remove catalog from its last hub because it requires at least one hub association. Use force=true to delete the catalog entirely.',
                beforeDelete: async () => {
                    const allowDeleteRow = await settingsService.findByKey(metahubId, 'catalogs.allowDelete', userId)
                    if (allowDeleteRow && allowDeleteRow.value?._value === false) {
                        return {
                            status: 403,
                            body: { error: 'Deleting catalogs is disabled in metahub settings' }
                        }
                    }

                    const blockingReferences = await findBlockingCatalogReferences(metahubId, catalogId, attributesService, userId)
                    if (blockingReferences.length > 0) {
                        return {
                            status: 409,
                            body: {
                                error: 'Cannot delete catalog: it is referenced by attributes in other catalogs',
                                blockingReferences
                            }
                        }
                    }

                    return null
                },
                detachFromHub: async (nextHubIds) => {
                    await updateCatalogLikeObject(
                        objectsService,
                        metahubId,
                        catalogId,
                        resolveCatalogObjectKind(entity ?? { kind: MetaEntityKind.CATALOG }),
                        {
                            config: { ...(entity?.config ?? {}), hubs: nextHubIds },
                            updatedBy: userId,
                            expectedVersion: entity?._upl_version
                        },
                        userId
                    )
                },
                detachedMessage: 'Catalog removed from hub',
                deleteEntity: () => objectsService.delete(metahubId, catalogId, userId)
            })

            if (result.status === 204) {
                return res.status(204).send()
            }

            return res.status(result.status).json(result.body)
        },
        { permission: 'deleteContent' }
    )

    // -----------------------------------------------------------------------
    // DELETE /metahub/:metahubId/catalog/:catalogId — soft delete
    // -----------------------------------------------------------------------
    const deleteCatalog = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId } = req.params
            const { objectsService, attributesService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)
            const catalogCompatibleKindSet = createCatalogCompatibleKindSet(
                await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
            )
            const catalog = await objectsService.findById(metahubId, catalogId, userId)
            const result = await executeBlockedDelete({
                entity: isCatalogObject(catalog, catalogCompatibleKindSet) ? catalog : null,
                entityLabel: 'Catalog',
                notFoundMessage: 'Catalog not found',
                beforeDelete: async () => {
                    const allowDeleteRow = await settingsService.findByKey(metahubId, 'catalogs.allowDelete', userId)
                    if (allowDeleteRow && allowDeleteRow.value?._value === false) {
                        return {
                            status: 403,
                            body: { error: 'Deleting catalogs is disabled in metahub settings' }
                        }
                    }

                    const blockingReferences = await findBlockingCatalogReferences(metahubId, catalogId, attributesService, userId)
                    if (blockingReferences.length > 0) {
                        return {
                            status: 409,
                            body: {
                                error: 'Cannot delete catalog: it is referenced by attributes in other catalogs',
                                blockingReferences
                            }
                        }
                    }

                    return null
                },
                deleteEntity: () => objectsService.delete(metahubId, catalogId, userId)
            })

            if (result.status === 204) {
                return res.status(204).send()
            }

            return res.status(result.status).json(result.body)
        },
        { permission: 'deleteContent' }
    )

    // -----------------------------------------------------------------------
    // GET /metahub/:metahubId/catalogs/trash
    // -----------------------------------------------------------------------
    const listTrash = createHandler(async ({ res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, entityTypeService } = createDomainServices(exec, schemaService)
        const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)

        const deletedCatalogs = await objectsService.findDeletedByKinds(metahubId, catalogCompatibleKinds, userId)

        const items = (deletedCatalogs as CatalogObjectRow[]).map((row) => ({
            id: row.id,
            metahubId,
            codename: row.codename,
            name: getCatalogNameField(row) || {},
            description: getCatalogDescriptionField(row) || {},
            deletedAt: row.deleted_at,
            deletedBy: row.deleted_by
        }))

        res.json({ items, total: items.length })
    })

    // -----------------------------------------------------------------------
    // POST /metahub/:metahubId/catalog/:catalogId/restore
    // -----------------------------------------------------------------------
    const restore = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId } = req.params
            const { objectsService, entityTypeService } = createDomainServices(exec, schemaService)
            const catalogCompatibleKinds = await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
            const catalogCompatibleKindSet = createCatalogCompatibleKindSet(catalogCompatibleKinds)

            const catalog = await objectsService.findById(metahubId, catalogId, userId, { onlyDeleted: true })
            if (!isCatalogObject(catalog, catalogCompatibleKindSet)) {
                return res.status(404).json({ error: 'Catalog not found in trash' })
            }

            const existing = await objectsService.findByCodenameInKinds(
                metahubId,
                getCatalogCodenameText(catalog.codename),
                catalogCompatibleKinds,
                userId
            )
            if (existing && existing.id !== catalogId) {
                return res.status(409).json({
                    error: 'Cannot restore catalog: codename already exists in this metahub'
                })
            }

            try {
                await objectsService.restore(metahubId, catalogId, userId)
            } catch (error) {
                if (database.isUniqueViolation(error)) {
                    return res.status(409).json({
                        error: 'Cannot restore catalog: codename already exists in this metahub'
                    })
                }
                throw error
            }

            res.json({ message: 'Catalog restored successfully', id: catalogId })
        },
        { permission: 'editContent' }
    )

    // -----------------------------------------------------------------------
    // DELETE /metahub/:metahubId/catalog/:catalogId/permanent
    // -----------------------------------------------------------------------
    const permanentDelete = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { catalogId } = req.params
            const { objectsService, attributesService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)
            const catalogCompatibleKindSet = createCatalogCompatibleKindSet(
                await resolveCatalogCompatibleKinds(entityTypeService, metahubId, userId)
            )
            const catalog = await objectsService.findById(metahubId, catalogId, userId, { includeDeleted: true })
            const result = await executeBlockedDelete({
                entity: isCatalogObject(catalog, catalogCompatibleKindSet) ? catalog : null,
                entityLabel: 'Catalog',
                notFoundMessage: 'Catalog not found',
                beforeDelete: async () => {
                    const allowDeleteRow = await settingsService.findByKey(metahubId, 'catalogs.allowDelete', userId)
                    if (allowDeleteRow && allowDeleteRow.value?._value === false) {
                        return {
                            status: 403,
                            body: { error: 'Deleting catalogs is disabled in metahub settings' }
                        }
                    }

                    const blockingReferences = await findBlockingCatalogReferences(metahubId, catalogId, attributesService, userId)
                    if (blockingReferences.length > 0) {
                        return {
                            status: 409,
                            body: {
                                error: 'Cannot delete catalog: it is referenced by attributes in other catalogs',
                                blockingReferences
                            }
                        }
                    }

                    return null
                },
                deleteEntity: () => objectsService.permanentDelete(metahubId, catalogId, userId)
            })

            if (result.status === 204) {
                return res.status(204).send()
            }

            return res.status(result.status).json(result.body)
        },
        { permission: 'deleteContent' }
    )

    return {
        list,
        create,
        update,
        listByHub,
        reorder,
        getByHub,
        getById,
        copy,
        createByHub,
        updateByHub,
        getBlockingReferences,
        deleteByHub,
        delete: deleteCatalog,
        listTrash,
        restore,
        permanentDelete
    }
}
