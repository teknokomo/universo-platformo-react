import { z } from 'zod'
import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { localizedContent, validation, database } from '@universo/utils'
const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeCodenameForStyle, isValidCodenameForStyle } = validation
import { MetaEntityKind, normalizeObjectRecordBehavior, normalizeLedgerConfig, validateLedgerConfigReferences } from '@universo/types'
import type { LedgerConfig } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubTreeEntitiesService } from '../../metahubs/services/MetahubTreeEntitiesService'
import { MetahubComponentsService } from '../../metahubs/services/MetahubComponentsService'
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
import { readPlatformSystemComponentsPolicy } from '../../shared'
import { executeHubScopedDelete } from '../services/entityDeletePatterns'
import { resolveRequestedEntityMetadataKind } from '../../shared/entityMetadataKinds'
import {
    createObjectCollectionCompatibleKindSet,
    findBlockingObjectCollectionReferences,
    resolveObjectCollectionCompatibleKinds
} from './objectCollectionContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContainerSummaryRow = {
    id: string
    name: unknown
    codename: string
}

type ObjectCollectionObjectRow = {
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

type ObjectCollectionListItemRow = {
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
    componentsCount: number
    recordsCount: number
    hubs: ContainerSummaryRow[]
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

const isObjectCollectionObject = (
    row: ObjectCollectionObjectRow | null | undefined,
    compatibleKinds?: Set<string>
): row is ObjectCollectionObjectRow => {
    if (!row) return false
    const kind = typeof row.kind === 'string' && row.kind.length > 0 ? row.kind : MetaEntityKind.OBJECT
    return compatibleKinds ? compatibleKinds.has(kind) : kind === MetaEntityKind.OBJECT
}

const getObjectCollectionContainerIds = (row: ObjectCollectionObjectRow): string[] => {
    const rawHubs = row.config?.hubs
    if (!Array.isArray(rawHubs)) return []
    return rawHubs.filter((treeEntityId): treeEntityId is string => typeof treeEntityId === 'string')
}

const getLocalizedPrimaryLocale = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') return undefined
    const primaryLocale = (value as Record<string, unknown>)._primary
    return typeof primaryLocale === 'string' && primaryLocale.length > 0 ? primaryLocale : undefined
}

const getObjectCollectionPresentation = (row: Pick<ObjectCollectionObjectRow, 'presentation'>): Record<string, unknown> =>
    row.presentation && typeof row.presentation === 'object' ? (row.presentation as Record<string, unknown>) : {}

const getObjectCollectionNameField = (row: ObjectCollectionObjectRow): unknown => row.name ?? getObjectCollectionPresentation(row).name

const getObjectCollectionDescriptionField = (row: ObjectCollectionObjectRow): unknown =>
    row.description ?? getObjectCollectionPresentation(row).description

const mapObjectCollectionListItem = (
    row: ObjectCollectionObjectRow,
    metahubId: string,
    componentsCount: number,
    recordsCount: number
): ObjectCollectionListItemRow => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    name: getObjectCollectionNameField(row) || {},
    description: getObjectCollectionDescriptionField(row) || {},
    isSingleHub: row.config?.isSingleHub || false,
    isRequiredHub: row.config?.isRequiredHub || false,
    sortOrder: row.config?.sortOrder || 0,
    config: row.config ?? {},
    version: row._upl_version || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    componentsCount,
    recordsCount,
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

const matchesObjectCollectionSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

const getObjectCollectionCodenameText = (codename: unknown): string =>
    getCodenamePayloadText(codename as Parameters<typeof getCodenamePayloadText>[0])

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const createObjectCollectionSchema = z
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

const updateObjectCollectionSchema = z
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

const validateObjectCollectionLedgerConfig = async ({
    componentsService,
    metahubId,
    objectId,
    userId,
    ledgerConfig
}: {
    componentsService: MetahubComponentsService
    metahubId: string
    objectId: string | null
    userId?: string
    ledgerConfig: LedgerConfig | null | undefined
}): Promise<string | null> => {
    if (!ledgerConfig) return null

    const fields = objectId ? await componentsService.findAllFlat(metahubId, objectId, userId, 'all') : []
    const referenceErrors = validateLedgerConfigReferences({
        config: ledgerConfig,
        fields: fields.map((field) => ({
            codename: field.codename,
            dataType: field.dataType
        }))
    })

    return referenceErrors.length > 0 ? 'Ledger schema references unknown or incompatible components' : null
}

const reorderObjectCollectionsSchema = z
    .object({
        objectCollectionId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

const compareObjectCollectionTieBreak = (a: ObjectCollectionListItemRow, b: ObjectCollectionListItemRow): number => {
    const bySortOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySortOrder !== 0) return bySortOrder

    const byCodename = getObjectCollectionCodenameText(a.codename).localeCompare(getObjectCollectionCodenameText(b.codename))
    if (byCodename !== 0) return byCodename

    return a.id.localeCompare(b.id)
}

const compareObjectCollectionItems = (
    a: ObjectCollectionListItemRow,
    b: ObjectCollectionListItemRow,
    sortBy: string,
    sortOrder: 'asc' | 'desc'
): number => {
    let valA: string | number
    let valB: string | number
    if (sortBy === 'name') {
        valA = getLocalizedSortValue(a.name, getObjectCollectionCodenameText(a.codename))
        valB = getLocalizedSortValue(b.name, getObjectCollectionCodenameText(b.codename))
    } else if (sortBy === 'codename') {
        valA = getObjectCollectionCodenameText(a.codename)
        valB = getObjectCollectionCodenameText(b.codename)
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
    return compareObjectCollectionTieBreak(a, b)
}

// ---------------------------------------------------------------------------
// Domain services factory
// ---------------------------------------------------------------------------

const createDomainServices = (exec: DbExecutor, schemaService: MetahubSchemaService) => {
    const objectsService = new MetahubObjectsService(exec, schemaService)
    const treeEntitiesService = new MetahubTreeEntitiesService(exec, schemaService)
    const componentsService = new MetahubComponentsService(exec, schemaService)
    const recordsService = new MetahubRecordsService(exec, schemaService, objectsService, componentsService)
    const settingsService = new MetahubSettingsService(exec, schemaService)
    const entityTypeService = new EntityTypeService(exec, schemaService)
    return { objectsService, treeEntitiesService, componentsService, recordsService, settingsService, entityTypeService }
}

const resolveObjectCollectionObjectKind = (object: Pick<ObjectCollectionObjectRow, 'kind'>): string =>
    typeof object.kind === 'string' && object.kind.length > 0 ? object.kind : MetaEntityKind.OBJECT

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export const listObjectCollectionsByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId } = req.params
    const { objectsService, treeEntitiesService, componentsService, recordsService, entityTypeService } = createDomainServices(
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

    const objectCompatibleKinds = await resolveObjectCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    const allCollections = (await objectsService.findAllByKinds(metahubId, objectCompatibleKinds, userId)) as ObjectCollectionObjectRow[]

    const containerCollections = allCollections.filter((cat) => getObjectCollectionContainerIds(cat).includes(treeEntityId))

    const collectionIds = containerCollections.map((row) => row.id)
    const [componentsCounts, recordsCounts] = await Promise.all([
        componentsService.countByObjectIds(metahubId, collectionIds, userId),
        recordsService.countByObjectIds(metahubId, collectionIds, userId)
    ])

    let items = containerCollections.map((row) =>
        mapObjectCollectionListItem(row, metahubId, componentsCounts.get(row.id) || 0, recordsCounts.get(row.id) || 0)
    )

    if (search) {
        const searchLower = search.toLowerCase()
        items = items.filter((item) =>
            matchesObjectCollectionSearch(getObjectCollectionCodenameText(item.codename), item.name, searchLower)
        )
    }

    items.sort((a, b) => compareObjectCollectionItems(a, b, sortBy, sortOrder))

    const total = items.length
    const paginatedItems = items.slice(offset, offset + limit)

    const allContainerIds = new Set<string>()
    const containerIdsByCollection = new Map<string, string[]>()

    containerCollections.forEach((row) => {
        const ids = getObjectCollectionContainerIds(row)
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

export const reorderObjectCollections = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { objectsService, entityTypeService } = createDomainServices(exec, schemaService)
    const objectCompatibleKinds = await resolveObjectCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    const objectCompatibleKindSet = createObjectCollectionCompatibleKindSet(objectCompatibleKinds)

    const parsed = reorderObjectCollectionsSchema.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
    }

    const object = await objectsService.findById(metahubId, parsed.data.objectCollectionId, userId)
    if (!isObjectCollectionObject(object, objectCompatibleKindSet)) {
        return res.status(404).json({ error: 'Object not found' })
    }

    const updated = await objectsService.reorderByKind(
        metahubId,
        object.kind ?? MetaEntityKind.OBJECT,
        parsed.data.objectCollectionId,
        parsed.data.newSortOrder,
        userId
    )

    return res.json({
        id: updated.id,
        sortOrder: updated.config?.sortOrder ?? 0
    })
}

export const getObjectCollectionByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId, objectCollectionId } = req.params
    const { objectsService, treeEntitiesService, componentsService, recordsService, entityTypeService } = createDomainServices(
        exec,
        schemaService
    )
    const objectCompatibleKindSet = createObjectCollectionCompatibleKindSet(
        await resolveObjectCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    )

    const object = await objectsService.findById(metahubId, objectCollectionId, userId)
    if (!isObjectCollectionObject(object, objectCompatibleKindSet)) {
        return res.status(404).json({ error: 'Object not found' })
    }

    const currentConfig = object.config || {}
    const currentHubs = getObjectCollectionContainerIds(object)

    if (!currentHubs.includes(treeEntityId)) {
        return res.status(404).json({ error: 'Object not found in this hub' })
    }

    const hubs = currentHubs.length > 0 ? await treeEntitiesService.findByIds(metahubId, currentHubs, userId) : []

    const [componentsCounts, recordsCounts] = await Promise.all([
        componentsService.countByObjectIds(metahubId, [object.id], userId),
        recordsService.countByObjectIds(metahubId, [object.id], userId)
    ])

    const componentsCount = componentsCounts.get(object.id) ?? 0
    const recordsCount = recordsCounts.get(object.id) ?? 0

    return res.json({
        id: object.id,
        metahubId,
        codename: object.codename,
        name: getObjectCollectionNameField(object) ?? {},
        description: getObjectCollectionDescriptionField(object) ?? null,
        isSingleHub: currentConfig.isSingleHub,
        isRequiredHub: currentConfig.isRequiredHub,
        sortOrder: currentConfig.sortOrder,
        config: currentConfig,
        version: object._upl_version || 1,
        createdAt: object.created_at,
        updatedAt: object.updated_at,
        hubs: mapContainerSummaries(hubs),
        componentsCount,
        recordsCount
    })
}

export const createObjectCollectionByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId } = req.params
    const { objectsService, treeEntitiesService, componentsService, settingsService, entityTypeService } = createDomainServices(
        exec,
        schemaService
    )
    const platformSystemComponentsPolicy = await readPlatformSystemComponentsPolicy(exec)
    const objectCompatibleKinds = await resolveObjectCollectionCompatibleKinds(entityTypeService, metahubId, userId)

    const hub = await treeEntitiesService.findById(metahubId, treeEntityId, userId)
    if (!hub) {
        return res.status(404).json({ error: 'Hub not found' })
    }

    const parsed = createObjectCollectionSchema.safeParse(req.body)
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
    const ledgerValidationError = await validateObjectCollectionLedgerConfig({
        componentsService,
        metahubId,
        objectId: null,
        userId,
        ledgerConfig: normalizedLedgerConfig
    })
    if (ledgerValidationError) {
        return res.status(400).json({ error: ledgerValidationError })
    }

    const targetKind = await resolveRequestedEntityMetadataKind(entityTypeService, metahubId, 'object', kindKey, userId)

    const { style: codenameStyle, alphabet: codenameAlphabet, allowMixed } = await getCodenameSettings(settingsService, metahubId, userId)
    const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
    if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
        return res.status(400).json({
            error: 'Validation failed',
            details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
        })
    }

    const existing = await objectsService.findByCodenameInKinds(metahubId, normalizedCodename, objectCompatibleKinds, userId)
    if (existing) {
        return res.status(409).json({ error: 'Object with this codename already exists in this metahub' })
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
        return res.status(400).json({ error: 'This object is restricted to a single hub' })
    }

    const validHubs = await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId)
    if (validHubs.length !== targetTreeEntityIds.length) {
        return res.status(400).json({ error: 'One or more hub IDs are invalid' })
    }

    let object
    try {
        object = await exec.transaction(async (trx: SqlQueryable) => {
            const nextObject = await objectsService.createObject(
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
                        recordBehavior: normalizeObjectRecordBehavior(recordBehavior),
                        ...(normalizedLedgerConfig ? { ledger: normalizedLedgerConfig } : {})
                    },
                    createdBy: userId
                },
                userId,
                trx
            )
            await componentsService.ensureObjectSystemComponents(metahubId, nextObject.id, userId, trx, {
                policy: platformSystemComponentsPolicy
            })
            return nextObject
        })
    } catch (error) {
        if (database.isUniqueViolation(error)) {
            return res.status(409).json({ error: 'Object with this codename already exists in this metahub' })
        }
        throw error
    }

    const hubs = await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId)

    return res.status(201).json({
        id: object.id,
        metahubId,
        codename: object.codename,
        name: getObjectCollectionNameField(object as ObjectCollectionObjectRow) ?? {},
        description: getObjectCollectionDescriptionField(object as ObjectCollectionObjectRow) ?? null,
        isSingleHub: object.config.isSingleHub,
        isRequiredHub: object.config.isRequiredHub,
        sortOrder: object.config.sortOrder,
        config: object.config ?? {},
        version: object._upl_version || 1,
        createdAt: object.created_at,
        updatedAt: object.updated_at,
        hubs: mapContainerSummaries(hubs)
    })
}

export const updateObjectCollectionByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId, objectCollectionId } = req.params
    const { objectsService, treeEntitiesService, componentsService, settingsService, entityTypeService } = createDomainServices(
        exec,
        schemaService
    )
    const objectCompatibleKinds = await resolveObjectCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    const objectCompatibleKindSet = createObjectCollectionCompatibleKindSet(objectCompatibleKinds)

    const object = await objectsService.findById(metahubId, objectCollectionId, userId)
    if (!isObjectCollectionObject(object, objectCompatibleKindSet)) {
        return res.status(404).json({ error: 'Object not found' })
    }

    const currentHubs = getObjectCollectionContainerIds(object)
    if (!currentHubs.includes(treeEntityId)) {
        return res.status(404).json({ error: 'Object not found in this hub' })
    }

    const parsed = updateObjectCollectionSchema.safeParse(req.body)
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
    const ledgerValidationError = await validateObjectCollectionLedgerConfig({
        componentsService,
        metahubId,
        objectId: objectCollectionId,
        userId,
        ledgerConfig: normalizedLedgerConfig
    })
    if (ledgerValidationError) {
        return res.status(400).json({ error: ledgerValidationError })
    }

    const currentName = getObjectCollectionNameField(object)
    const currentDescription = getObjectCollectionDescriptionField(object)
    const currentConfig = object.config || {}

    let finalName = currentName
    let finalDescription = currentDescription
    let finalCodename: unknown = object.codename
    let finalCodenameText = getObjectCollectionCodenameText(object.codename)
    let targetTreeEntityIds = getObjectCollectionContainerIds(object)

    if (treeEntityIds !== undefined) {
        targetTreeEntityIds = treeEntityIds

        if ((isSingleHub ?? currentConfig.isSingleHub) && targetTreeEntityIds.length > 1) {
            return res.status(400).json({ error: 'This object is restricted to a single hub' })
        }
        const effectiveIsRequiredHub = isRequiredHub ?? currentConfig.isRequiredHub
        if (effectiveIsRequiredHub && targetTreeEntityIds.length === 0) {
            return res.status(400).json({ error: 'This object requires at least one hub association' })
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
        if (normalizedCodename !== getObjectCollectionCodenameText(object.codename)) {
            const existing = await objectsService.findByCodenameInKinds(metahubId, normalizedCodename, objectCompatibleKinds, userId)
            if (existing && existing.id !== objectCollectionId) {
                return res.status(409).json({ error: 'Object with this codename already exists' })
            }
        }
        const nextCodename = syncOptionalCodenamePayloadText(
            codename,
            getLocalizedPrimaryLocale(object.codename) ?? namePrimaryLocale ?? 'en',
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
            recordBehavior !== undefined
                ? normalizeObjectRecordBehavior(recordBehavior)
                : normalizeObjectRecordBehavior(currentConfig.recordBehavior),
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
        objectCollectionId,
        resolveObjectCollectionObjectKind(object),
        {
            codename: finalCodenameText !== getObjectCollectionCodenameText(object.codename) ? finalCodename : undefined,
            name: finalName,
            description: finalDescription,
            config: nextConfig,
            updatedBy: userId,
            expectedVersion
        },
        userId
    )) as ObjectCollectionObjectRow

    const persistedUpdated = (await objectsService.findById(metahubId, updated.id, userId)) as ObjectCollectionObjectRow | null
    const responseObject = persistedUpdated ?? updated

    const outputHubs = targetTreeEntityIds.length > 0 ? await treeEntitiesService.findByIds(metahubId, targetTreeEntityIds, userId) : []

    return res.json({
        id: responseObject.id,
        metahubId,
        codename: responseObject.codename,
        name: getObjectCollectionNameField(responseObject) ?? {},
        description: getObjectCollectionDescriptionField(responseObject) ?? null,
        isSingleHub: responseObject.config?.isSingleHub ?? false,
        isRequiredHub: responseObject.config?.isRequiredHub ?? false,
        sortOrder: responseObject.config?.sortOrder ?? 0,
        config: responseObject.config ?? {},
        version: responseObject._upl_version || 1,
        createdAt: responseObject.created_at,
        updatedAt: responseObject.updated_at,
        hubs: mapContainerSummaries(outputHubs)
    })
}

export const deleteObjectCollectionByHub = async ({ req, res, metahubId, userId, exec, schemaService }: MetahubHandlerContext) => {
    const { treeEntityId, objectCollectionId } = req.params
    const { objectsService, componentsService, settingsService, entityTypeService } = createDomainServices(exec, schemaService)
    const objectCompatibleKindSet = createObjectCollectionCompatibleKindSet(
        await resolveObjectCollectionCompatibleKinds(entityTypeService, metahubId, userId)
    )

    const object = await objectsService.findById(metahubId, objectCollectionId, userId)
    const entity = isObjectCollectionObject(object, objectCompatibleKindSet) ? object : null
    const result = await executeHubScopedDelete({
        entity,
        entityLabel: 'Object',
        notFoundMessage: 'Object not found',
        notFoundInHubMessage: 'Object not found in this hub',
        treeEntityId,
        forceDelete: req.query.force === 'true',
        getTreeEntityIds: getObjectCollectionContainerIds,
        isRequiredHub: (currentObject) => Boolean(currentObject.config?.isRequiredHub),
        lastHubConflictMessage:
            'Cannot remove object from its last hub because it requires at least one hub association. Use force=true to delete the object entirely.',
        beforeDelete: async () => {
            const allowDeleteRow = await settingsService.findByKey(metahubId, 'entity.object.allowDelete', userId)
            if (allowDeleteRow && allowDeleteRow.value?._value === false) {
                return {
                    status: 403,
                    body: { error: 'Deleting objects is disabled in metahub settings' }
                }
            }

            const blockingReferences = await findBlockingObjectCollectionReferences(
                metahubId,
                objectCollectionId,
                componentsService,
                userId
            )
            if (blockingReferences.length > 0) {
                return {
                    status: 409,
                    body: {
                        error: 'Cannot delete object: it is referenced by components in other objects',
                        blockingReferences
                    }
                }
            }

            return null
        },
        detachFromHub: async (nextTreeEntityIds) => {
            await objectsService.updateObject(
                metahubId,
                objectCollectionId,
                resolveObjectCollectionObjectKind(entity ?? { kind: MetaEntityKind.OBJECT }),
                {
                    config: { ...(entity?.config ?? {}), hubs: nextTreeEntityIds },
                    updatedBy: userId,
                    expectedVersion: entity?._upl_version
                },
                userId
            )
        },
        detachedMessage: 'Object removed from hub',
        deleteEntity: () => objectsService.delete(metahubId, objectCollectionId, userId)
    })

    if (result.status === 204) {
        return res.status(204).send()
    }

    return res.status(result.status).json(result.body)
}
