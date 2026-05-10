import { z } from 'zod'
import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { localizedContent, validation, database } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeLinkedCollectionCopyOptions, normalizeCodenameForStyle, isValidCodenameForStyle } = validation
import { MetaEntityKind, normalizeCatalogRecordBehavior, normalizeLedgerConfig, validateLedgerConfigReferences } from '@universo/types'
import type { LedgerConfig } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubTreeEntitiesService } from '../../metahubs/services/MetahubTreeEntitiesService'
import { MetahubFieldDefinitionsService } from '../../metahubs/services/MetahubFieldDefinitionsService'
import { MetahubRecordsService } from '../../metahubs/services/MetahubRecordsService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import { EntityTypeService } from '../services/EntityTypeService'
import { validateListQuery } from '../../shared/queryParams'
import { toTimestamp } from '../../shared/timestamps'
import type { MetahubHandlerContext } from '../../shared/createMetahubHandler'
import { getCodenameSettings, codenameErrorMessage } from '../../shared/codenameStyleHelper'
import {
    requiredCodenamePayloadSchema,
    optionalCodenamePayloadSchema,
    getCodenamePayloadText,
    syncCodenamePayloadText,
    syncOptionalCodenamePayloadText
} from '../../shared/codenamePayload'
import { getCodenameText } from '../../shared/codename'
import { readPlatformSystemFieldDefinitionsPolicy } from '../../shared'
import { executeHubScopedDelete } from '../services/entityDeletePatterns'
import { resolveRequestedEntityMetadataKind } from '../../shared/entityMetadataKinds'
import {
    createLinkedCollectionCompatibleKindSet,
    findBlockingLinkedCollectionReferences,
    resolveLinkedCollectionCompatibleKinds
} from './linkedCollectionContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContainerSummaryRow = {
    id: string
    name: unknown
    codename: string
}

type LinkedCollectionObjectRow = {
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
        recordBehavior?: unknown
        ledger?: unknown
    }
    _upl_version?: number
    created_at?: unknown
    updated_at?: unknown
    deleted_at?: unknown
    deleted_by?: unknown
}

type LinkedCollectionListItemRow = {
    id: string
    metahubId: string
    codename: unknown
    name: unknown
    description: unknown
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    config: Record<string, unknown>
    version: number
    createdAt: unknown
    updatedAt: unknown
    fieldDefinitionsCount: number
    recordsCount: number
    hubs: ContainerSummaryRow[]
}

type CopiedLinkedCollectionRow = {
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

const mapContainerSummary = (hub: Record<string, unknown>): ContainerSummaryRow => ({
    id: String(hub.id),
    name: hub.name,
    codename: getCodenameText(hub.codename)
})

const mapContainerSummaries = (hubs: Record<string, unknown>[]): ContainerSummaryRow[] => hubs.map(mapContainerSummary)

const isLinkedCollectionObject = (
    row: LinkedCollectionObjectRow | null | undefined,
    compatibleKinds?: Set<string>
): row is LinkedCollectionObjectRow => {
    if (!row) return false
    const kind = typeof row.kind === 'string' && row.kind.length > 0 ? row.kind : MetaEntityKind.CATALOG
    return compatibleKinds ? compatibleKinds.has(kind) : kind === MetaEntityKind.CATALOG
}

const getLinkedCollectionContainerIds = (row: LinkedCollectionObjectRow): string[] => {
    const rawHubs = row.config?.hubs
    if (!Array.isArray(rawHubs)) return []
    return rawHubs.filter((treeEntityId): treeEntityId is string => typeof treeEntityId === 'string')
}

const getLocalizedPrimaryLocale = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') return undefined
    const primaryLocale = (value as Record<string, unknown>)._primary
    return typeof primaryLocale === 'string' && primaryLocale.length > 0 ? primaryLocale : undefined
}

const getLinkedCollectionPresentation = (row: Pick<LinkedCollectionObjectRow, 'presentation'>): Record<string, unknown> =>
    row.presentation && typeof row.presentation === 'object' ? (row.presentation as Record<string, unknown>) : {}

const getLinkedCollectionNameField = (row: LinkedCollectionObjectRow): unknown => row.name ?? getLinkedCollectionPresentation(row).name

const getLinkedCollectionDescriptionField = (row: LinkedCollectionObjectRow): unknown =>
    row.description ?? getLinkedCollectionPresentation(row).description

const mapLinkedCollectionListItem = (
    row: LinkedCollectionObjectRow,
    metahubId: string,
    fieldDefinitionsCount: number,
    recordsCount: number
): LinkedCollectionListItemRow => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    name: getLinkedCollectionNameField(row) || {},
    description: getLinkedCollectionDescriptionField(row) || {},
    isSingleHub: row.config?.isSingleHub || false,
    isRequiredHub: row.config?.isRequiredHub || false,
    sortOrder: row.config?.sortOrder || 0,
    config: row.config ?? {},
    version: row._upl_version || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fieldDefinitionsCount,
    recordsCount,
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

const matchesLinkedCollectionSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

const getLinkedCollectionCodenameText = (codename: unknown): string =>
    getCodenamePayloadText(codename as Parameters<typeof getCodenamePayloadText>[0])

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createLinkedCollectionSchema = z
    .object({
        codename: requiredCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        sortOrder: z.number().int().optional(),
        isSingleHub: z.boolean().optional(),
        isRequiredHub: z.boolean().optional(),
        treeEntityIds: z.array(z.string().uuid()).optional(),
        recordBehavior: z.record(z.unknown()).optional(),
        ledgerConfig: z.union([z.record(z.unknown()), z.null()]).optional(),
        kindKey: z.string().trim().min(1).max(128).optional()
    })
    .strict()

const updateLinkedCollectionSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        sortOrder: z.number().int().optional(),
        isSingleHub: z.boolean().optional(),
        isRequiredHub: z.boolean().optional(),
        treeEntityIds: z.array(z.string().uuid()).optional(),
        recordBehavior: z.record(z.unknown()).optional(),
        ledgerConfig: z.union([z.record(z.unknown()), z.null()]).optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

const normalizeOptionalLedgerConfig = (value: unknown): LedgerConfig | null | undefined => {
    if (value === undefined) return undefined
    if (value === null) return null
    return normalizeLedgerConfig(value)
}

const validateLinkedCollectionLedgerConfig = async ({
    fieldDefinitionsService,
    metahubId,
    objectId,
    userId,
    ledgerConfig
}: {
    fieldDefinitionsService: MetahubFieldDefinitionsService
    metahubId: string
    objectId: string | null
    userId?: string
    ledgerConfig: LedgerConfig | null | undefined
}): Promise<string | null> => {
    if (!ledgerConfig) return null

    const fields = objectId ? await fieldDefinitionsService.findAllFlat(metahubId, objectId, userId, 'all') : []
    const referenceErrors = validateLedgerConfigReferences({
        config: ledgerConfig,
        fields: fields.map((field) => ({
            codename: field.codename,
            dataType: field.dataType
        }))
    })

    return referenceErrors.length > 0 ? 'Ledger schema references unknown or incompatible field definitions' : null
}

const copyLinkedCollectionSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        copyFieldDefinitions: z.boolean().optional(),
        copyRecords: z.boolean().optional(),
        copyAttributes: z.boolean().optional(),
        copyElements: z.boolean().optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        const copyFieldDefinitions = value.copyFieldDefinitions ?? value.copyAttributes
        const copyRecords = value.copyRecords ?? value.copyElements
        if (copyFieldDefinitions === false && copyRecords === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['copyRecords'],
                message: 'copyRecords requires copyFieldDefinitions=true'
            })
        }
    })

const reorderLinkedCollectionsSchema = z
    .object({
        linkedCollectionId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

const compareLinkedCollectionTieBreak = (a: LinkedCollectionListItemRow, b: LinkedCollectionListItemRow): number => {
    const bySortOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySortOrder !== 0) return bySortOrder

    const byCodename = getLinkedCollectionCodenameText(a.codename).localeCompare(getLinkedCollectionCodenameText(b.codename))
    if (byCodename !== 0) return byCodename

    return a.id.localeCompare(b.id)
}

const compareLinkedCollectionItems = (
    a: LinkedCollectionListItemRow,
    b: LinkedCollectionListItemRow,
    sortBy: string,
    sortOrder: 'asc' | 'desc'
): number => {
    let valA: string | number
    let valB: string | number
    if (sortBy === 'name') {
        valA = getLocalizedSortValue(a.name, getLinkedCollectionCodenameText(a.codename))
        valB = getLocalizedSortValue(b.name, getLinkedCollectionCodenameText(b.codename))
    } else if (sortBy === 'codename') {
        valA = getLinkedCollectionCodenameText(a.codename)
        valB = getLinkedCollectionCodenameText(b.codename)
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
    return compareLinkedCollectionTieBreak(a, b)
}

// ---------------------------------------------------------------------------
// Domain services factory
// ---------------------------------------------------------------------------

const createDomainServices = (exec: DbExecutor, schemaService: MetahubSchemaService) => {
    const objectsService = new MetahubObjectsService(exec, schemaService)
    const treeEntitiesService = new MetahubTreeEntitiesService(exec, schemaService)
    const fieldDefinitionsService = new MetahubFieldDefinitionsService(exec, schemaService)
    const recordsService = new MetahubRecordsService(exec, schemaService, objectsService, fieldDefinitionsService)
    const settingsService = new MetahubSettingsService(exec, schemaService)
    const entityTypeService = new EntityTypeService(exec, schemaService)
    return { objectsService, treeEntitiesService, fieldDefinitionsService, recordsService, settingsService, entityTypeService }
}

const resolveLinkedCollectionObjectKind = (catalog: Pick<LinkedCollectionObjectRow, 'kind'>): string =>
    typeof catalog.kind === 'string' && catalog.kind.length > 0 ? catalog.kind : MetaEntityKind.CATALOG

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export const listLinkedCollectionsByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId } = req.params
    const { objectsService, treeEntitiesService, fieldDefinitionsService, recordsService, entityTypeService } = createDomainServices(
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

    const catalogCompatibleKinds = await resolveLinkedCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    const allCollections = (await objectsService.findAllByKinds(metahubId, catalogCompatibleKinds, userId)) as LinkedCollectionObjectRow[]

    const containerCollections = allCollections.filter((cat) => getLinkedCollectionContainerIds(cat).includes(treeEntityId))

    const collectionIds = containerCollections.map((row) => row.id)
    const [fieldDefinitionsCounts, recordsCounts] = await Promise.all([
        fieldDefinitionsService.countByObjectIds(metahubId, collectionIds, userId),
        recordsService.countByObjectIds(metahubId, collectionIds, userId)
    ])

    let items = containerCollections.map((row) =>
        mapLinkedCollectionListItem(row, metahubId, fieldDefinitionsCounts.get(row.id) || 0, recordsCounts.get(row.id) || 0)
    )

    if (search) {
        const searchLower = search.toLowerCase()
        items = items.filter((item) =>
            matchesLinkedCollectionSearch(getLinkedCollectionCodenameText(item.codename), item.name, searchLower)
        )
    }

    items.sort((a, b) => compareLinkedCollectionItems(a, b, sortBy, sortOrder))

    const total = items.length
    const paginatedItems = items.slice(offset, offset + limit)

    const allContainerIds = new Set<string>()
    const containerIdsByCollection = new Map<string, string[]>()

    containerCollections.forEach((row) => {
        const ids = getLinkedCollectionContainerIds(row)
        if (ids.length > 0) {
            ids.forEach((id) => allContainerIds.add(id))
            containerIdsByCollection.set(row.id, ids)
        }
    })

    const containerMap = new Map<string, ContainerSummaryRow>()
    if (allContainerIds.size > 0) {
        const hubs = await treeEntitiesService.findByIds(metahubId, Array.from(allContainerIds), userId)
        hubs.forEach((hub) => {
            const summary = mapContainerSummary(hub)
            containerMap.set(summary.id, summary)
        })
    }

    const resultItems = paginatedItems.map((item) => {
        const ids = containerIdsByCollection.get(item.id) || []
        const matchedHubs = ids.map((id) => containerMap.get(id)).filter((hub): hub is ContainerSummaryRow => Boolean(hub))
        return { ...item, hubs: matchedHubs }
    })

    return res.json({ items: resultItems, pagination: { total, limit, offset } })
}

export const reorderLinkedCollections = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { objectsService, entityTypeService } = createDomainServices(exec, schemaService)
    const catalogCompatibleKinds = await resolveLinkedCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    const catalogCompatibleKindSet = createLinkedCollectionCompatibleKindSet(catalogCompatibleKinds)

    const parsed = reorderLinkedCollectionsSchema.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
    }

    const catalog = await objectsService.findById(metahubId, parsed.data.linkedCollectionId, userId)
    if (!isLinkedCollectionObject(catalog, catalogCompatibleKindSet)) {
        return res.status(404).json({ error: 'Catalog not found' })
    }

    const updated = await objectsService.reorderByKind(
        metahubId,
        catalog.kind ?? MetaEntityKind.CATALOG,
        parsed.data.linkedCollectionId,
        parsed.data.newSortOrder,
        userId
    )

    return res.json({
        id: updated.id,
        sortOrder: updated.config?.sortOrder ?? 0
    })
}

export const getLinkedCollectionByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId, linkedCollectionId } = req.params
    const { objectsService, treeEntitiesService, fieldDefinitionsService, recordsService, entityTypeService } = createDomainServices(
        exec,
        schemaService
    )
    const catalogCompatibleKindSet = createLinkedCollectionCompatibleKindSet(
        await resolveLinkedCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    )

    const catalog = await objectsService.findById(metahubId, linkedCollectionId, userId)
    if (!isLinkedCollectionObject(catalog, catalogCompatibleKindSet)) {
        return res.status(404).json({ error: 'Catalog not found' })
    }

    const currentConfig = catalog.config || {}
    const currentHubs = getLinkedCollectionContainerIds(catalog)

    if (!currentHubs.includes(treeEntityId)) {
        return res.status(404).json({ error: 'Catalog not found in this hub' })
    }

    const hubs = currentHubs.length > 0 ? await treeEntitiesService.findByIds(metahubId, currentHubs, userId) : []

    const [fieldDefinitionsCounts, recordsCounts] = await Promise.all([
        fieldDefinitionsService.countByObjectIds(metahubId, [catalog.id], userId),
        recordsService.countByObjectIds(metahubId, [catalog.id], userId)
    ])

    const fieldDefinitionsCount = fieldDefinitionsCounts.get(catalog.id) ?? 0
    const recordsCount = recordsCounts.get(catalog.id) ?? 0

    return res.json({
        id: catalog.id,
        metahubId,
        codename: catalog.codename,
        name: getLinkedCollectionNameField(catalog) ?? {},
        description: getLinkedCollectionDescriptionField(catalog) ?? null,
        isSingleHub: currentConfig.isSingleHub,
        isRequiredHub: currentConfig.isRequiredHub,
        sortOrder: currentConfig.sortOrder,
        config: currentConfig,
        version: catalog._upl_version || 1,
        createdAt: catalog.created_at,
        updatedAt: catalog.updated_at,
        hubs: mapContainerSummaries(hubs),
        fieldDefinitionsCount,
        recordsCount
    })
}

export const createLinkedCollectionByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId } = req.params
    const { objectsService, treeEntitiesService, fieldDefinitionsService, settingsService, entityTypeService } = createDomainServices(
        exec,
        schemaService
    )
    const platformSystemFieldDefinitionsPolicy = await readPlatformSystemFieldDefinitionsPolicy(exec)
    const catalogCompatibleKinds = await resolveLinkedCollectionCompatibleKinds(entityTypeService, metahubId, userId)

    const hub = await treeEntitiesService.findById(metahubId, treeEntityId, userId)
    if (!hub) {
        return res.status(404).json({ error: 'Hub not found' })
    }

    const parsed = createLinkedCollectionSchema.safeParse(req.body)
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
        treeEntityIds,
        recordBehavior,
        ledgerConfig,
        kindKey
    } = parsed.data
    const normalizedLedgerConfig = normalizeOptionalLedgerConfig(ledgerConfig)
    const ledgerValidationError = await validateLinkedCollectionLedgerConfig({
        fieldDefinitionsService,
        metahubId,
        objectId: null,
        userId,
        ledgerConfig: normalizedLedgerConfig
    })
    if (ledgerValidationError) {
        return res.status(400).json({ error: ledgerValidationError })
    }

    const targetKind = await resolveRequestedEntityMetadataKind(entityTypeService, metahubId, 'catalog', kindKey, userId)

    const { style: codenameStyle, alphabet: codenameAlphabet, allowMixed } = await getCodenameSettings(settingsService, metahubId, userId)
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
    const targetTreeEntityIds = treeEntityIds && Array.isArray(treeEntityIds) ? treeEntityIds : [treeEntityId]

    if ((isSingleHub ?? false) && targetTreeEntityIds.length > 1) {
        return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
    }

    const validHubs = await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId)
    if (validHubs.length !== targetTreeEntityIds.length) {
        return res.status(400).json({ error: 'One or more hub IDs are invalid' })
    }

    let catalog
    try {
        catalog = await exec.transaction(async (trx: SqlQueryable) => {
            const nextCatalog = await objectsService.createObject(
                metahubId,
                targetKind,
                {
                    codename: codenamePayload,
                    name: nameVlc,
                    description: descriptionVlc,
                    config: {
                        hubs: targetTreeEntityIds,
                        isSingleHub: isSingleHub ?? false,
                        isRequiredHub: effectiveIsRequired,
                        sortOrder,
                        recordBehavior: normalizeCatalogRecordBehavior(recordBehavior),
                        ...(normalizedLedgerConfig ? { ledger: normalizedLedgerConfig } : {})
                    },
                    createdBy: userId
                },
                userId,
                trx
            )
            await fieldDefinitionsService.ensureCatalogSystemFieldDefinitions(metahubId, nextCatalog.id, userId, trx, {
                policy: platformSystemFieldDefinitionsPolicy
            })
            return nextCatalog
        })
    } catch (error) {
        if (database.isUniqueViolation(error)) {
            return res.status(409).json({ error: 'Catalog with this codename already exists in this metahub' })
        }
        throw error
    }

    const hubs = await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId)

    return res.status(201).json({
        id: catalog.id,
        metahubId,
        codename: catalog.codename,
        name: getLinkedCollectionNameField(catalog as LinkedCollectionObjectRow) ?? {},
        description: getLinkedCollectionDescriptionField(catalog as LinkedCollectionObjectRow) ?? null,
        isSingleHub: catalog.config.isSingleHub,
        isRequiredHub: catalog.config.isRequiredHub,
        sortOrder: catalog.config.sortOrder,
        config: catalog.config ?? {},
        version: catalog._upl_version || 1,
        createdAt: catalog.created_at,
        updatedAt: catalog.updated_at,
        hubs: mapContainerSummaries(hubs)
    })
}

export const updateLinkedCollectionByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId, linkedCollectionId } = req.params
    const { objectsService, treeEntitiesService, fieldDefinitionsService, settingsService, entityTypeService } = createDomainServices(
        exec,
        schemaService
    )
    const catalogCompatibleKinds = await resolveLinkedCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    const catalogCompatibleKindSet = createLinkedCollectionCompatibleKindSet(catalogCompatibleKinds)

    const catalog = await objectsService.findById(metahubId, linkedCollectionId, userId)
    if (!isLinkedCollectionObject(catalog, catalogCompatibleKindSet)) {
        return res.status(404).json({ error: 'Catalog not found' })
    }

    const currentHubs = getLinkedCollectionContainerIds(catalog)
    if (!currentHubs.includes(treeEntityId)) {
        return res.status(404).json({ error: 'Catalog not found in this hub' })
    }

    const parsed = updateLinkedCollectionSchema.safeParse(req.body)
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
        treeEntityIds,
        recordBehavior,
        ledgerConfig,
        expectedVersion
    } = parsed.data
    const normalizedLedgerConfig = normalizeOptionalLedgerConfig(ledgerConfig)
    const ledgerValidationError = await validateLinkedCollectionLedgerConfig({
        fieldDefinitionsService,
        metahubId,
        objectId: linkedCollectionId,
        userId,
        ledgerConfig: normalizedLedgerConfig
    })
    if (ledgerValidationError) {
        return res.status(400).json({ error: ledgerValidationError })
    }

    const currentName = getLinkedCollectionNameField(catalog)
    const currentDescription = getLinkedCollectionDescriptionField(catalog)
    const currentConfig = catalog.config || {}

    let finalName = currentName
    let finalDescription = currentDescription
    let finalCodename: unknown = catalog.codename
    let finalCodenameText = getLinkedCollectionCodenameText(catalog.codename)
    let targetTreeEntityIds = getLinkedCollectionContainerIds(catalog)

    if (treeEntityIds !== undefined) {
        targetTreeEntityIds = treeEntityIds

        if ((isSingleHub ?? currentConfig.isSingleHub) && targetTreeEntityIds.length > 1) {
            return res.status(400).json({ error: 'This catalog is restricted to a single hub' })
        }
        const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
        if (effectiveIsRequiredHub && targetTreeEntityIds.length === 0) {
            return res.status(400).json({ error: 'This catalog requires at least one hub association' })
        }

        if (targetTreeEntityIds.length > 0) {
            const validHubs = await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId)
            if (validHubs.length !== targetTreeEntityIds.length) {
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
        if (normalizedCodename !== getLinkedCollectionCodenameText(catalog.codename)) {
            const existing = await objectsService.findByCodenameInKinds(metahubId, normalizedCodename, catalogCompatibleKinds, userId)
            if (existing && existing.id !== linkedCollectionId) {
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

    const nextConfig = {
        ...currentConfig,
        hubs: targetTreeEntityIds,
        isSingleHub: isSingleHub ?? currentConfig.isSingleHub,
        isRequiredHub: isRequiredHub ?? currentConfig.isRequiredHub,
        sortOrder: sortOrder ?? currentConfig.sortOrder,
        recordBehavior:
            recordBehavior !== undefined ? normalizeCatalogRecordBehavior(recordBehavior) : normalizeCatalogRecordBehavior(currentConfig.recordBehavior),
        runtimeConfig: currentConfig.runtimeConfig
    }
    if (normalizedLedgerConfig !== undefined) {
        if (normalizedLedgerConfig === null) {
            delete nextConfig.ledger
        } else {
            nextConfig.ledger = normalizedLedgerConfig
        }
    }

    const updated = (await objectsService.updateObject(
        metahubId,
        linkedCollectionId,
        resolveLinkedCollectionObjectKind(catalog),
        {
            codename: finalCodenameText !== getLinkedCollectionCodenameText(catalog.codename) ? finalCodename : undefined,
            name: finalName,
            description: finalDescription,
            config: nextConfig,
            updatedBy: userId,
            expectedVersion
        },
        userId
    )) as LinkedCollectionObjectRow

    const persistedUpdated = (await objectsService.findById(metahubId, updated.id, userId)) as LinkedCollectionObjectRow | null
    const responseCatalog = persistedUpdated ?? updated

    const outputHubs = targetTreeEntityIds.length > 0 ? await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId) : []

    return res.json({
        id: responseCatalog.id,
        metahubId,
        codename: responseCatalog.codename,
        name: getLinkedCollectionNameField(responseCatalog) ?? {},
        description: getLinkedCollectionDescriptionField(responseCatalog) ?? null,
        isSingleHub: responseCatalog.config?.isSingleHub ?? false,
        isRequiredHub: responseCatalog.config?.isRequiredHub ?? false,
        sortOrder: responseCatalog.config?.sortOrder ?? 0,
        config: responseCatalog.config ?? {},
        version: responseCatalog._upl_version || 1,
        createdAt: responseCatalog.created_at,
        updatedAt: responseCatalog.updated_at,
        hubs: mapContainerSummaries(outputHubs)
    })
}

export const deleteLinkedCollectionByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId, linkedCollectionId } = req.params
    const { objectsService, fieldDefinitionsService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)
    const catalogCompatibleKindSet = createLinkedCollectionCompatibleKindSet(
        await resolveLinkedCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    )

    const catalog = await objectsService.findById(metahubId, linkedCollectionId, userId)
    const entity = isLinkedCollectionObject(catalog, catalogCompatibleKindSet) ? catalog : null
    const result = await executeHubScopedDelete({
        entity,
        entityLabel: 'Catalog',
        notFoundMessage: 'Catalog not found',
        notFoundInHubMessage: 'Catalog not found in this hub',
        treeEntityId,
        forceDelete: req.query.force === 'true',
        getTreeEntityIds: getLinkedCollectionContainerIds,
        isRequiredHub: (currentCatalog) => Boolean(currentCatalog.config?.isRequiredHub),
        lastHubConflictMessage:
            'Cannot remove catalog from its last hub because it requires at least one hub association. Use force=true to delete the catalog entirely.',
        beforeDelete: async () => {
            const allowDeleteRow = await settingsService.findByKey(metahubId, 'entity.catalog.allowDelete', userId)
            if (allowDeleteRow && allowDeleteRow.value?._value === false) {
                return {
                    status: 403,
                    body: { error: 'Deleting catalogs is disabled in metahub settings' }
                }
            }

            const blockingReferences = await findBlockingLinkedCollectionReferences(
                metahubId,
                linkedCollectionId,
                fieldDefinitionsService,
                userId
            )
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
        detachFromHub: async (nextTreeEntityIds) => {
            await objectsService.updateObject(
                metahubId,
                linkedCollectionId,
                resolveLinkedCollectionObjectKind(entity ?? { kind: MetaEntityKind.CATALOG }),
                {
                    config: { ...(entity?.config ?? {}), hubs: nextTreeEntityIds },
                    updatedBy: userId,
                    expectedVersion: entity?._upl_version
                },
                userId
            )
        },
        detachedMessage: 'Catalog removed from hub',
        deleteEntity: () => objectsService.delete(metahubId, linkedCollectionId, userId)
    })

    if (result.status === 204) {
        return res.status(204).send()
    }

    return res.status(result.status).json(result.body)
}
