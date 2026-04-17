import type { Response } from 'express'
import { z } from 'zod'
import { MetaEntityKind, SHARED_OBJECT_KINDS } from '@universo/types'
import { localizedContent } from '@universo/utils'
import { getCodenamePayloadText, optionalCodenamePayloadSchema, requiredCodenamePayloadSchema } from '../../shared/codenamePayload'
import { getCodenameText } from '../../shared/codename'
import { toTimestamp } from '../../shared/timestamps'
import { MetahubFieldDefinitionsService } from '../../metahubs/services/MetahubFieldDefinitionsService'
import { MetahubTreeEntitiesService } from '../../metahubs/services/MetahubTreeEntitiesService'
import { EntityTypeService } from '../services/EntityTypeService'
import { createEntityMetadataKindSet, resolveEntityMetadataKinds } from '../../shared/entityMetadataKinds'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent

type ContainerSummaryRow = {
    id: string
    name: unknown
    codename: string
}

type OptionListObjectRow = {
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
    created_at?: unknown
    updated_at?: unknown
}

type OptionListListItemRow = {
    id: string
    metahubId: string
    codename: unknown
    name: unknown
    description: unknown
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    optionValuesCount: number
    version: number
    createdAt: unknown
    updatedAt: unknown
    hubs: ContainerSummaryRow[]
}

type UniqueViolationErrorLike = {
    code?: string
    constraint?: string
    driverError?: UniqueViolationErrorLike
    cause?: unknown
}

const localizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((value) => (typeof value === 'string' ? { en: value } : value))
const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((value) => (typeof value === 'string' ? { en: value } : value))

const booleanishSchema = z.preprocess((value) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
}, z.boolean())

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

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

const compareOptionListTieBreak = (a: OptionListListItemRow, b: OptionListListItemRow): number => {
    const bySortOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySortOrder !== 0) return bySortOrder

    const byCodename = getOptionListCodenameText(a.codename).localeCompare(getOptionListCodenameText(b.codename))
    if (byCodename !== 0) return byCodename

    return a.id.localeCompare(b.id)
}

export const isOptionListContextKind = (kind: unknown, allowedKinds?: Set<string>): boolean => {
    if (typeof kind !== 'string') {
        return false
    }

    if (allowedKinds) {
        return allowedKinds.has(kind) || kind === SHARED_OBJECT_KINDS.SHARED_ENUM_POOL
    }

    return kind === MetaEntityKind.ENUMERATION || kind === SHARED_OBJECT_KINDS.SHARED_ENUM_POOL
}

export const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocaleCode(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
        .filter(([, content]) => content.length > 0)

    if (entries.length === 0) {
        return { en: 'Copy (copy)' }
    }

    const result: Record<string, string> = {}
    for (const [locale, content] of entries) {
        result[locale] = `${content}${locale === 'ru' ? ' (копия)' : ' (copy)'}`
    }
    return result
}

export const extractUniqueViolationError = (error: unknown): UniqueViolationErrorLike | null => {
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

export const respondUniqueViolation = (res: Response, error: unknown, fallbackMessage: string): boolean => {
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

export const findBlockingOptionListReferences = async (
    metahubId: string,
    optionListId: string,
    compatibleOptionListKinds: readonly string[],
    fieldDefinitionsService: MetahubFieldDefinitionsService,
    userId?: string
) => fieldDefinitionsService.findReferenceBlockersByTarget(metahubId, optionListId, compatibleOptionListKinds, userId)

export const findBlockingDefaultValueReferences = async (
    metahubId: string,
    valueId: string,
    compatibleOptionListKinds: readonly string[],
    fieldDefinitionsService: MetahubFieldDefinitionsService,
    userId?: string
) => fieldDefinitionsService.findDefaultEnumValueBlockers(metahubId, valueId, userId, compatibleOptionListKinds)

export const findBlockingRecordValueReferences = async (
    metahubId: string,
    optionListId: string,
    valueId: string,
    compatibleOptionListKinds: readonly string[],
    fieldDefinitionsService: MetahubFieldDefinitionsService,
    userId?: string
) => fieldDefinitionsService.findElementEnumValueBlockers(metahubId, optionListId, valueId, userId, compatibleOptionListKinds)

export const loadCompatibleOptionListKinds = async (
    entityTypeService: EntityTypeService,
    metahubId: string,
    userId?: string
): Promise<string[]> => resolveEntityMetadataKinds(entityTypeService, metahubId, 'enumeration', userId)

export const loadCompatibleOptionListKindSet = async (
    entityTypeService: EntityTypeService,
    metahubId: string,
    userId?: string
): Promise<Set<string>> => createEntityMetadataKindSet(await loadCompatibleOptionListKinds(entityTypeService, metahubId, userId))

export const mapContainerSummary = (container: Record<string, unknown>): ContainerSummaryRow => ({
    id: String(container.id),
    name: container.name,
    codename: getCodenameText(container.codename)
})

export const getOptionListCodenameText = (codename: unknown): string =>
    getCodenamePayloadText(codename as Parameters<typeof getCodenamePayloadText>[0])

export const getOptionListContainerIds = (row: OptionListObjectRow): string[] => {
    const rawHubs = row.config?.hubs
    if (!Array.isArray(rawHubs)) return []
    return rawHubs.filter((treeEntityId): treeEntityId is string => typeof treeEntityId === 'string')
}

export const resolveCreatedAt = (row: OptionListObjectRow): unknown => row._upl_created_at ?? row.created_at ?? null
export const resolveUpdatedAt = (row: OptionListObjectRow): unknown => row._upl_updated_at ?? row.updated_at ?? null

export const resolvePrimaryLocale = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') return undefined
    const primary = (value as Record<string, unknown>)._primary
    return typeof primary === 'string' && primary.length > 0 ? primary : undefined
}

export const mapOptionListSummary = (row: OptionListObjectRow, metahubId: string, optionValuesCount: number): OptionListListItemRow => ({
    id: row.id,
    metahubId,
    codename: row.codename,
    name: row.presentation?.name ?? {},
    description: row.presentation?.description ?? {},
    isSingleHub: row.config?.isSingleHub ?? false,
    isRequiredHub: row.config?.isRequiredHub ?? false,
    sortOrder: row.config?.sortOrder ?? 0,
    optionValuesCount,
    version: row._upl_version || 1,
    createdAt: resolveCreatedAt(row),
    updatedAt: resolveUpdatedAt(row),
    hubs: []
})

export const matchesOptionListSearch = (codename: string, name: unknown, searchLower: string): boolean =>
    codename.toLowerCase().includes(searchLower) ||
    getLocalizedCandidates(name).some((candidate) => candidate.toLowerCase().includes(searchLower))

export const compareOptionListItems = (
    a: OptionListListItemRow,
    b: OptionListListItemRow,
    sortBy: string,
    sortOrder: 'asc' | 'desc'
): number => {
    let valueA: string | number
    let valueB: string | number

    if (sortBy === 'name') {
        valueA = getLocalizedSortValue(a.name, getOptionListCodenameText(a.codename))
        valueB = getLocalizedSortValue(b.name, getOptionListCodenameText(b.codename))
    } else if (sortBy === 'codename') {
        valueA = getOptionListCodenameText(a.codename)
        valueB = getOptionListCodenameText(b.codename)
    } else if (sortBy === 'sortOrder') {
        valueA = a.sortOrder ?? 0
        valueB = b.sortOrder ?? 0
    } else if (sortBy === 'updatedAt') {
        valueA = toTimestamp(a.updatedAt)
        valueB = toTimestamp(b.updatedAt)
    } else {
        valueA = toTimestamp(a.createdAt)
        valueB = toTimestamp(b.createdAt)
    }

    if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1
    if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1
    return compareOptionListTieBreak(a, b)
}

export const enrichWithContainers = async (
    paginatedItems: OptionListListItemRow[],
    sourceRows: OptionListObjectRow[],
    treeEntitiesService: MetahubTreeEntitiesService,
    metahubId: string,
    userId?: string
): Promise<OptionListListItemRow[]> => {
    if (paginatedItems.length === 0) return []

    const containerIdsByOptionList = new Map<string, string[]>()
    const allContainerIds = new Set<string>()

    for (const row of sourceRows) {
        const containerIds = getOptionListContainerIds(row)
        containerIdsByOptionList.set(row.id, containerIds)
        for (const containerId of containerIds) {
            allContainerIds.add(containerId)
        }
    }

    const containers = allContainerIds.size > 0 ? await treeEntitiesService.findByIds(metahubId, Array.from(allContainerIds), userId) : []
    const containerMap = new Map<string, ContainerSummaryRow>()
    ;(containers as Record<string, unknown>[]).forEach((c) => {
        const summary = mapContainerSummary(c)
        containerMap.set(summary.id, summary)
    })

    return paginatedItems.map((item) => {
        const ids = containerIdsByOptionList.get(item.id) || []
        const matchedContainers = ids.map((id) => containerMap.get(id)).filter((c): c is ContainerSummaryRow => Boolean(c))
        return { ...item, hubs: matchedContainers }
    })
}

export const createOptionListSchema = z
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
        kindKey: z.string().optional()
    })
    .strict()

export const updateOptionListSchema = z
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
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export const reorderOptionListsSchema = z
    .object({
        optionListId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

export const createOptionValueSchema = z
    .object({
        codename: requiredCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        presentation: z.record(z.unknown()).optional(),
        sortOrder: z.number().int().optional(),
        isDefault: z.boolean().optional()
    })
    .strict()

export const updateOptionValueSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        presentation: z.record(z.unknown()).optional(),
        sortOrder: z.number().int().optional(),
        isDefault: z.boolean().optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export const moveOptionValueSchema = z
    .object({
        direction: z.enum(['up', 'down'])
    })
    .strict()

export const reorderValueSchema = z.union([
    z
        .object({
            valueId: z.string().uuid(),
            newSortOrder: z.number().int().min(1),
            mergedOrderIds: z.undefined().optional()
        })
        .strict(),
    z
        .object({
            valueId: z.string().uuid(),
            newSortOrder: z.undefined().optional(),
            mergedOrderIds: z.array(z.string().uuid())
        })
        .strict()
])

export const copyOptionValueSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        presentation: z.record(z.unknown()).optional(),
        isDefault: z.boolean().optional()
    })
    .strict()

export const listValuesQuerySchema = z
    .object({
        includeShared: booleanishSchema.optional().default(false)
    })
    .strip()

export { buildLocalizedContent, sanitizeLocalizedInput }
