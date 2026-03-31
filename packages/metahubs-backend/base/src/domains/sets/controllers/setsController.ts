import { z } from 'zod'
import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { localizedContent, database, OptimisticLockError, normalizeSetCopyOptions } from '@universo/utils'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '@universo/utils/validation/codename'
import type { SetCopyOptions, ConstantDataType } from '@universo/types'
import { MetaEntityKind } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubHubsService } from '../../metahubs/services/MetahubHubsService'
import { MetahubConstantsService } from '../../metahubs/services/MetahubConstantsService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import { ListQuerySchema } from '../../shared/queryParams'
import { MetahubNotFoundError, MetahubConflictError } from '../../shared/domainErrors'
import { isUniqueViolation } from '../../shared/errorGuards'
import type { createMetahubHandlerFactory, MetahubHandlerContext } from '../../shared/createMetahubHandler'
import { toTimestamp } from '../../shared/timestamps'
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

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HubSummaryRow = {
    id: string
    name: unknown
    codename: string
}

type SetObjectRow = {
    id: string
    kind?: string
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
    }
    _upl_version?: number
    _upl_created_at?: unknown
    _upl_updated_at?: unknown
}

type SetListItemRow = {
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
    constantsCount: number
    hubs: HubSummaryRow[]
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

const mapHubSummary = (hub: Record<string, unknown>): HubSummaryRow => ({
    id: String(hub.id),
    name: hub.name,
    codename: String(hub.codename)
})

const isSetObject = (row: SetObjectRow | null | undefined): row is SetObjectRow => {
    if (!row) return false
    return row.kind === MetaEntityKind.SET
}

const getSetHubIds = (row: SetObjectRow): string[] => {
    const rawHubs = row.config?.hubs
    if (!Array.isArray(rawHubs)) return []
    return rawHubs.filter((hubId): hubId is string => typeof hubId === 'string')
}

const mapSetListItem = (row: SetObjectRow, metahubId: string, constantsCount: number): SetListItemRow => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    name: row.presentation?.name || {},
    description: row.presentation?.description || {},
    isSingleHub: row.config?.isSingleHub || false,
    isRequiredHub: row.config?.isRequiredHub || false,
    sortOrder: row.config?.sortOrder || 0,
    version: row._upl_version || 1,
    createdAt: row._upl_created_at,
    updatedAt: row._upl_updated_at,
    constantsCount,
    hubs: []
})

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

const matchesSetSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

const getSetCodenameText = (codename: unknown): string =>
    getCodenamePayloadText(codename as Parameters<typeof getCodenamePayloadText>[0])

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(
            ([locale, value]) =>
                [normalizeLocaleCode(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const
        )
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

const DEFAULT_PRIMARY_LOCALE = 'en'

const validateHubConstraints = (hubIds: string[], isSingleHub: boolean, isRequiredHub: boolean): string | null => {
    if (isSingleHub && hubIds.length > 1) {
        return 'Set with isSingleHub=true cannot be linked to multiple hubs'
    }
    if (isRequiredHub && hubIds.length === 0) {
        return 'Set with isRequiredHub=true must be linked to at least one hub'
    }
    return null
}

const resolveUniqueSetCodename = async (params: {
    metahubId: string
    baseCodename: string
    codenameStyle: 'kebab-case' | 'pascal-case'
    objectsService: MetahubObjectsService
    userId: string
    excludeSetId?: string
}): Promise<string | null> => {
    const { metahubId, baseCodename, codenameStyle, objectsService, userId, excludeSetId } = params
    for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS; attempt += 1) {
        const candidate = buildCodenameAttempt(baseCodename, attempt, codenameStyle)
        const existing = await objectsService.findByCodenameAndKind(metahubId, candidate, 'set', userId)
        if (!existing || (excludeSetId && existing.id === excludeSetId)) {
            return candidate
        }
    }
    return null
}

const compareSetTieBreak = (a: SetListItemRow, b: SetListItemRow): number => {
    const bySortOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySortOrder !== 0) return bySortOrder

    const byCodename = getSetCodenameText(a.codename).localeCompare(getSetCodenameText(b.codename))
    if (byCodename !== 0) return byCodename

    return a.id.localeCompare(b.id)
}

const compareSetItems = (a: SetListItemRow, b: SetListItemRow, sortBy: string, sortOrder: 'asc' | 'desc'): number => {
    if (sortBy === 'name') {
        const valueA = getLocalizedSortValue(a.name, getSetCodenameText(a.codename)).toLowerCase()
        const valueB = getLocalizedSortValue(b.name, getSetCodenameText(b.codename)).toLowerCase()
        if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1
        if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1
        return compareSetTieBreak(a, b)
    }

    if (sortBy === 'created') {
        const createdDiff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt)
        if (createdDiff !== 0) return sortOrder === 'asc' ? createdDiff : -createdDiff
        return compareSetTieBreak(a, b)
    }

    if (sortBy === 'updated') {
        const updatedDiff = toTimestamp(a.updatedAt) - toTimestamp(b.updatedAt)
        if (updatedDiff !== 0) return sortOrder === 'asc' ? updatedDiff : -updatedDiff
        return compareSetTieBreak(a, b)
    }

    if (sortBy === 'codename') {
        const codenameDiff = getSetCodenameText(a.codename).localeCompare(getSetCodenameText(b.codename))
        if (codenameDiff !== 0) return sortOrder === 'asc' ? codenameDiff : -codenameDiff
        return compareSetTieBreak(a, b)
    }

    if (sortBy === 'sortOrder') {
        const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        if (orderDiff !== 0) return sortOrder === 'asc' ? orderDiff : -orderDiff
        return compareSetTieBreak(a, b)
    }

    return compareSetTieBreak(a, b)
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const SetsListQuerySchema = ListQuerySchema.extend({
    sortBy: z.enum(['name', 'codename', 'created', 'updated', 'sortOrder']).default('updated'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
})

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createSetSchema = z
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

const updateSetSchema = z
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

const copySetSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        copyConstants: z.boolean().optional()
    })
    .strict()

const reorderSetsSchema = z
    .object({
        setId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

// ---------------------------------------------------------------------------
// Domain services factory
// ---------------------------------------------------------------------------

function createDomainServices(exec: DbExecutor, schemaService: MetahubSchemaService) {
    return {
        objectsService: new MetahubObjectsService(exec, schemaService),
        hubsService: new MetahubHubsService(exec, schemaService),
        constantsService: new MetahubConstantsService(exec, schemaService),
        settingsService: new MetahubSettingsService(exec, schemaService)
    }
}

// ---------------------------------------------------------------------------
// Shared handler helpers
// ---------------------------------------------------------------------------

const enrichSetItemsWithHubs = async (
    metahubId: string,
    items: SetListItemRow[],
    hubsService: MetahubHubsService,
    userId?: string
): Promise<SetListItemRow[]> => {
    const uniqueHubIds = Array.from(new Set(items.flatMap((item) => item.hubs.map((hub) => hub.id))))
    if (uniqueHubIds.length === 0) return items

    const hubs = (await hubsService.findByIds(metahubId, uniqueHubIds, userId)) as Record<string, unknown>[]
    const hubById = new Map<string, HubSummaryRow>()
    for (const hub of hubs) {
        hubById.set(String(hub.id), mapHubSummary(hub))
    }

    return items.map((item) => {
        const hubIds = item.hubs.map((hub) => hub.id)
        return {
            ...item,
            hubs: hubIds.map((hubId) => hubById.get(hubId)).filter((hub): hub is HubSummaryRow => Boolean(hub))
        }
    })
}

const getSetById = async (
    metahubId: string,
    setId: string,
    options: {
        hubId?: string
        userId?: string
        objectsService: MetahubObjectsService
        hubsService: MetahubHubsService
        constantsService: MetahubConstantsService
    }
): Promise<SetListItemRow | null> => {
    const { hubId, userId, objectsService, hubsService, constantsService } = options
    const row = (await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null
    if (!isSetObject(row)) return null

    const hubIds = getSetHubIds(row)
    if (hubId && !hubIds.includes(hubId)) return null

    const constantsCount = await constantsService.countByObjectId(metahubId, setId, userId)
    const item = mapSetListItem(row, metahubId, constantsCount)
    item.hubs = hubIds.map((id) => ({ id, name: null, codename: id }))
    const [enriched] = await enrichSetItemsWithHubs(metahubId, [item], hubsService, userId)
    return enriched ?? null
}

const getBlockingReferences = async (
    metahubId: string,
    setId: string,
    constantsService: MetahubConstantsService,
    userId?: string
) => constantsService.findSetReferenceBlockers(metahubId, setId, userId)

const hardDeleteSet = async (
    metahubId: string,
    setId: string,
    userId: string,
    objectsService: MetahubObjectsService,
    constantsService: MetahubConstantsService
): Promise<{ status: number; payload?: Record<string, unknown> }> => {
    const blockers = await getBlockingReferences(metahubId, setId, constantsService, userId)
    if (blockers.length > 0) {
        return {
            status: 409,
            payload: {
                error: 'Cannot delete set because there are blocking references',
                code: 'SET_DELETE_BLOCKED_BY_REFERENCES',
                setId,
                blockingReferences: blockers
            }
        }
    }

    await objectsService.delete(metahubId, setId, userId)
    return { status: 204 }
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createSetsController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    // Shared upsert logic for create and update
    const upsertSet = async (ctx: MetahubHandlerContext, mode: 'create' | 'update') => {
        const { req, res, metahubId, userId, exec, schemaService } = ctx
        const { hubId, setId } = req.params
        const hubScoped = Boolean(hubId)
        const { objectsService, hubsService, settingsService, constantsService } = createDomainServices(exec, schemaService)

        if (hubScoped && hubId) {
            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) throw new MetahubNotFoundError('hub', hubId)
        }

        const parsed = (mode === 'create' ? createSetSchema : updateSetSchema).safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
        }

        const {
            style: codenameStyle,
            alphabet: codenameAlphabet,
            allowMixed
        } = await getCodenameSettings(settingsService, metahubId, userId)

        const currentSet =
            mode === 'update' && setId ? ((await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null) : null

        if (mode === 'update') {
            if (!currentSet || !isSetObject(currentSet)) {
                throw new MetahubNotFoundError('set', setId)
            }

            if (hubScoped && hubId && !getSetHubIds(currentSet).includes(hubId)) {
                return res.status(404).json({ error: 'Set not found in this hub' })
            }
        }

        const baseCodename =
            parsed.data.codename !== undefined ? getCodenamePayloadText(parsed.data.codename) : getSetCodenameText(currentSet?.codename)
        if (!baseCodename) {
            return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
        }

        const normalizedCodename = normalizeCodenameForStyle(baseCodename, codenameStyle, codenameAlphabet)
        if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
            return res.status(400).json({
                error: 'Validation failed',
                details: {
                    codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)]
                }
            })
        }

        let finalCodename = normalizedCodename
        if (mode === 'create' || finalCodename !== getSetCodenameText(currentSet?.codename)) {
            const resolvedCodename = await resolveUniqueSetCodename({
                metahubId,
                baseCodename: normalizedCodename,
                codenameStyle,
                objectsService,
                userId,
                excludeSetId: currentSet?.id
            })
            if (!resolvedCodename) {
                return res.status(409).json({ error: 'Unable to generate unique codename for set' })
            }
            finalCodename = resolvedCodename
        }

        const codenameFallbackPrimaryLocale =
            parsed.data.namePrimaryLocale ??
            (currentSet?.presentation?.name as { _primary?: string } | undefined)?._primary ??
            DEFAULT_PRIMARY_LOCALE
        const codenamePayload = syncOptionalCodenamePayloadText(parsed.data.codename, codenameFallbackPrimaryLocale, finalCodename)
        const sanitizedName =
            parsed.data.name !== undefined ? sanitizeLocalizedInput(parsed.data.name as Record<string, string | undefined>) : undefined
        const sanitizedDescription =
            parsed.data.description !== undefined
                ? sanitizeLocalizedInput(parsed.data.description as Record<string, string | undefined>)
                : undefined

        const resolvedName =
            sanitizedName !== undefined
                ? buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, DEFAULT_PRIMARY_LOCALE)
                : currentSet?.presentation?.name ||
                  buildLocalizedContent(
                      { [DEFAULT_PRIMARY_LOCALE]: finalCodename },
                      parsed.data.namePrimaryLocale,
                      DEFAULT_PRIMARY_LOCALE
                  )

        const resolvedDescription =
            sanitizedDescription !== undefined
                ? buildLocalizedContent(sanitizedDescription, parsed.data.descriptionPrimaryLocale, DEFAULT_PRIMARY_LOCALE)
                : currentSet?.presentation?.description

        const currentHubIds = currentSet ? getSetHubIds(currentSet) : []
        let nextHubIds = parsed.data.hubIds ?? currentHubIds
        if (mode === 'create' && hubScoped && hubId && parsed.data.hubIds === undefined) {
            nextHubIds = [hubId]
        }

        const isSingleHub = parsed.data.isSingleHub ?? currentSet?.config?.isSingleHub ?? false
        const isRequiredHub = parsed.data.isRequiredHub ?? currentSet?.config?.isRequiredHub ?? false
        const hubError = validateHubConstraints(nextHubIds, isSingleHub, isRequiredHub)
        if (hubError) {
            return res.status(400).json({ error: hubError })
        }

        if (mode === 'create') {
            let created: SetObjectRow
            try {
                created = (await objectsService.createSet(
                    metahubId,
                    {
                        codename: codenamePayload ?? finalCodename,
                        name: resolvedName,
                        description: resolvedDescription,
                        config: {
                            hubs: nextHubIds,
                            isSingleHub,
                            isRequiredHub,
                            ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {})
                        },
                        createdBy: userId
                    },
                    userId
                )) as SetObjectRow
            } catch (error) {
                if (isUniqueViolation(error)) {
                    throw new MetahubConflictError('Set with this codename already exists in this metahub')
                }
                throw error
            }

            const createdItem = await getSetById(metahubId, created.id, {
                userId,
                objectsService,
                hubsService,
                constantsService
            })
            return res.status(201).json(createdItem)
        }

        const expectedVersion = mode === 'update' ? (parsed.data as z.infer<typeof updateSetSchema>).expectedVersion : undefined

        let updated: SetObjectRow | null
        try {
            updated = (await objectsService.updateSet(
                metahubId,
                setId,
                {
                    codename: codenamePayload ?? finalCodename,
                    name: resolvedName,
                    description: resolvedDescription,
                    config: {
                        hubs: nextHubIds,
                        isSingleHub,
                        isRequiredHub,
                        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {})
                    },
                    expectedVersion,
                    updatedBy: userId
                },
                userId
            )) as SetObjectRow | null
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new MetahubConflictError('Set with this codename already exists in this metahub')
            }
            throw error
        }

        if (!updated) {
            throw new MetahubNotFoundError('set', setId)
        }

        const updatedItem = await getSetById(metahubId, updated.id, {
            userId,
            objectsService,
            hubsService,
            constantsService
        })

        res.json(updatedItem)
    }

    // -------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------

    const list = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const hubId = req.params.hubId
        const { objectsService, hubsService, constantsService } = createDomainServices(exec, schemaService)

        if (hubId) {
            const hub = await hubsService.findById(metahubId, hubId, userId)
            if (!hub) throw new MetahubNotFoundError('hub', hubId)
        }

        const parsed = SetsListQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
        }

        const { limit, offset, sortBy, sortOrder, search } = parsed.data

        const rawSets = (await objectsService.findAllByKind(metahubId, 'set', userId)) as SetObjectRow[]
        const setRows = hubId
            ? rawSets.filter((row) => isSetObject(row) && getSetHubIds(row).includes(hubId))
            : rawSets.filter(isSetObject)
        const setIds = setRows.map((row) => row.id)
        const constantsCounts = await constantsService.countByObjectIds(metahubId, setIds, userId)

        let items = setRows.map((row) => {
            const item = mapSetListItem(row, metahubId, constantsCounts.get(row.id) || 0)
            item.hubs = getSetHubIds(row).map((id) => ({ id, name: null, codename: id }))
            return item
        })

        if (search) {
            const searchLower = search.toLowerCase()
            items = items.filter((item) => matchesSetSearch(getSetCodenameText(item.codename), item.name, searchLower))
        }

        items.sort((a, b) => compareSetItems(a, b, sortBy, sortOrder))

        const total = items.length
        const paginatedItems = items.slice(offset, offset + limit)
        const enrichedItems = await enrichSetItemsWithHubs(metahubId, paginatedItems, hubsService, userId)

        res.json({
            items: enrichedItems,
            pagination: {
                total,
                limit,
                offset
            }
        })
    })

    const reorder = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService } = createDomainServices(exec, schemaService)

            const parsed = reorderSetsSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            try {
                const updated = await objectsService.reorderByKind(
                    metahubId,
                    MetaEntityKind.SET,
                    parsed.data.setId,
                    parsed.data.newSortOrder,
                    userId
                )
                return res.json({
                    id: updated.id,
                    sortOrder: updated.config?.sortOrder ?? 0
                })
            } catch (error: unknown) {
                if (error instanceof Error && error.message === 'set not found') {
                    throw new MetahubNotFoundError('set', parsed.data.setId)
                }
                throw error
            }
        },
        { permission: 'editContent' }
    )

    const getById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { setId, hubId } = req.params
        const { objectsService, hubsService, constantsService } = createDomainServices(exec, schemaService)

        const setItem = await getSetById(metahubId, setId, {
            hubId,
            userId,
            objectsService,
            hubsService,
            constantsService
        })

        if (!setItem) {
            throw new MetahubNotFoundError('set', setId)
        }

        res.json(setItem)
    })

    const create = createHandler(
        async (ctx) => {
            return upsertSet(ctx, 'create')
        },
        { permission: 'createContent' }
    )

    const update = createHandler(
        async (ctx) => {
            return upsertSet(ctx, 'update')
        },
        { permission: 'editContent' }
    )

    const copy = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { setId } = req.params
            const { objectsService, hubsService, constantsService, settingsService } = createDomainServices(exec, schemaService)

            const sourceSet = (await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null
            if (!isSetObject(sourceSet)) {
                throw new MetahubNotFoundError('set', setId)
            }

            const parsed = copySetSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)

            const copySuffix = codenameStyle === 'kebab-case' ? '-copy' : 'Copy'
            const normalizedBaseCodename = normalizeCodenameForStyle(
                parsed.data.codename
                    ? getCodenamePayloadText(parsed.data.codename)
                    : `${getSetCodenameText(sourceSet.codename)}${copySuffix}`,
                codenameStyle,
                codenameAlphabet
            )
            if (
                !normalizedBaseCodename ||
                !isValidCodenameForStyle(normalizedBaseCodename, codenameStyle, codenameAlphabet, allowMixed)
            ) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                })
            }

            const copyOptions: SetCopyOptions = normalizeSetCopyOptions({
                copyConstants: parsed.data.copyConstants
            })

            const codenameFallbackPrimaryLocale = normalizeLocaleCode(
                parsed.data.namePrimaryLocale ??
                    (sourceSet.presentation?.name as { _primary?: string } | undefined)?._primary ??
                    DEFAULT_PRIMARY_LOCALE
            )

            const nameInput = parsed.data.name ?? buildDefaultCopyNameInput(sourceSet.presentation?.name)
            const descriptionInput = parsed.data.description

            const sanitizedName = sanitizeLocalizedInput(nameInput as Record<string, string | undefined>)
            const nameVlc =
                Object.keys(sanitizedName).length > 0
                    ? buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, DEFAULT_PRIMARY_LOCALE)
                    : buildLocalizedContent(
                          { [DEFAULT_PRIMARY_LOCALE]: `${getSetCodenameText(sourceSet.codename)} (copy)` },
                          parsed.data.namePrimaryLocale,
                          DEFAULT_PRIMARY_LOCALE
                      )

            const sanitizedDescription = descriptionInput
                ? sanitizeLocalizedInput(descriptionInput as Record<string, string | undefined>)
                : null
            const descriptionVlc =
                sanitizedDescription && Object.keys(sanitizedDescription).length > 0
                    ? buildLocalizedContent(sanitizedDescription, parsed.data.descriptionPrimaryLocale, DEFAULT_PRIMARY_LOCALE)
                    : sourceSet.presentation?.description

            const sourceConfig = sourceSet.config ?? {}
            const sourceHubIds = Array.isArray(sourceConfig.hubs)
                ? sourceConfig.hubs.filter((value: unknown): value is string => typeof value === 'string')
                : []

            const sourceConstants = copyOptions.copyConstants ? await constantsService.findAll(metahubId, setId, userId) : []

            let copiedConstants = 0
            let createdSetId: string | null = null

            for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS; attempt += 1) {
                const codenameCandidate = buildCodenameAttempt(normalizedBaseCodename, attempt, codenameStyle)
                const codenamePayloadForSetCopy = syncCodenamePayloadText(
                    parsed.data.codename ?? sourceSet.codename,
                    codenameFallbackPrimaryLocale,
                    codenameCandidate,
                    codenameStyle,
                    codenameAlphabet
                )
                if (!codenamePayloadForSetCopy) {
                    return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
                }

                try {
                    copiedConstants = 0
                    await exec.transaction(async (trx: SqlQueryable) => {
                        const createdSet = (await objectsService.createSet(
                            metahubId,
                            {
                                codename: codenamePayloadForSetCopy,
                                name: nameVlc,
                                description: descriptionVlc,
                                config: {
                                    ...sourceConfig,
                                    sortOrder: undefined,
                                    hubs: sourceHubIds
                                },
                                createdBy: userId
                            },
                            userId,
                            trx
                        )) as SetObjectRow
                        createdSetId = createdSet.id

                        if (copyOptions.copyConstants) {
                            for (const sourceConstant of sourceConstants) {
                                const sourceConstantCodename = getCodenamePayloadText(
                                    sourceConstant.codename as Parameters<typeof getCodenamePayloadText>[0]
                                )
                                if (!sourceConstantCodename) {
                                    throw new Error('Source constant codename is missing')
                                }
                                const constantCodename = await constantsService.ensureUniqueCodenameWithRetries({
                                    metahubId,
                                    setId: createdSet.id,
                                    desiredCodename: sourceConstantCodename,
                                    codenameStyle,
                                    userId,
                                    db: trx
                                })
                                const constantCodenamePayload = syncCodenamePayloadText(
                                    sourceConstant.codename,
                                    DEFAULT_PRIMARY_LOCALE,
                                    constantCodename,
                                    codenameStyle,
                                    codenameAlphabet
                                )
                                await constantsService.create(
                                    metahubId,
                                    {
                                        setId: createdSet.id,
                                        codename: constantCodenamePayload ?? constantCodename,
                                        dataType: sourceConstant.dataType as ConstantDataType,
                                        name: sourceConstant.name,
                                        validationRules: sourceConstant.validationRules as Record<string, unknown> | undefined,
                                        uiConfig: sourceConstant.uiConfig as Record<string, unknown> | undefined,
                                        value: sourceConstant.value,
                                        sortOrder: sourceConstant.sortOrder as number | undefined,
                                        createdBy: userId
                                    },
                                    userId,
                                    trx
                                )
                                copiedConstants += 1
                            }
                        }
                    })
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

            if (!createdSetId) {
                return res.status(409).json({ error: 'Unable to generate unique codename for set copy' })
            }

            const copiedSet = await getSetById(metahubId, createdSetId, {
                userId,
                objectsService,
                hubsService,
                constantsService
            })
            if (!copiedSet) {
                throw new MetahubNotFoundError('set', createdSetId)
            }

            res.status(201).json({
                ...copiedSet,
                copy: {
                    constantsCopied: copiedConstants
                }
            })
        },
        { permission: 'createContent' }
    )

    const getBlockingReferencesHandler = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { setId } = req.params
        const { objectsService, constantsService } = createDomainServices(exec, schemaService)

        const existing = (await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null
        if (!isSetObject(existing)) {
            throw new MetahubNotFoundError('set', setId)
        }

        const blockers = await getBlockingReferences(metahubId, setId, constantsService, userId)
        res.json({
            setId,
            blockingReferences: blockers,
            canDelete: blockers.length === 0
        })
    })

    const deleteSet = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { setId, hubId } = req.params
            const { objectsService, constantsService } = createDomainServices(exec, schemaService)
            const forceDelete = req.query.force === 'true'

            const setRow = (await objectsService.findById(metahubId, setId, userId)) as SetObjectRow | null
            if (!isSetObject(setRow)) {
                throw new MetahubNotFoundError('set', setId)
            }

            const hubIds = getSetHubIds(setRow)
            if (hubId) {
                if (!hubIds.includes(hubId)) {
                    return res.status(404).json({ error: 'Set not found in this hub' })
                }

                if (!forceDelete && hubIds.length > 1) {
                    const nextHubIds = hubIds.filter((id) => id !== hubId)
                    const expectedVersion = typeof setRow._upl_version === 'number' ? setRow._upl_version : 1
                    try {
                        await objectsService.updateSet(
                            metahubId,
                            setId,
                            {
                                config: {
                                    ...(setRow.config ?? {}),
                                    hubs: nextHubIds
                                },
                                expectedVersion,
                                updatedBy: userId
                            },
                            userId
                        )
                    } catch (error) {
                        if (error instanceof OptimisticLockError) {
                            return res.status(409).json({
                                error: error.message,
                                code: error.code,
                                conflict: error.conflict
                            })
                        }
                        throw error
                    }

                    return res.status(200).json({
                        message: 'Set was removed from the selected hub but kept in other hubs',
                        remainingHubs: nextHubIds.length
                    })
                }
            }

            const result = await hardDeleteSet(metahubId, setId, userId, objectsService, constantsService)
            if (result.status === 204) {
                return res.status(204).send()
            }
            return res.status(result.status).json(result.payload)
        },
        { permission: 'deleteContent' }
    )

    return {
        list,
        reorder,
        getById,
        create,
        update,
        copy,
        getBlockingReferences: getBlockingReferencesHandler,
        delete: deleteSet
    }
}
