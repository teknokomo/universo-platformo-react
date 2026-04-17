import { isBuiltinEntityKind, type BuiltinEntityKind, type VersionedLocalizedContent } from '@universo/types'
import { normalizeLinkedCollectionCopyOptions } from '@universo/utils'
import { type LinkedCollectionEntity, type TreeEntity } from '../../../types'
import { ensureLocalizedContent, getLocalizedContentText } from '../../../utils/localizedInput'
import type { MetahubEntityInstance, MetahubEntityType } from '../api'

export type EntityInstancesViewMode = 'card' | 'list'
export type EntityInstanceFormValues = Record<string, unknown>
export type UiTranslate = (key: string, options?: Record<string, unknown> | string) => string

export type EntityInstanceDisplayRow = {
    id: string
    name: string
    description: string
    codename: string
    treeEntityIds: string[]
    sortOrder: number | null
    updatedAt?: string
    isDeleted: boolean
    raw: MetahubEntityInstance
}

export const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const decodeKindKey = (value?: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return ''
    }

    try {
        return decodeURIComponent(value).trim()
    } catch {
        return value.trim()
    }
}

export const buildEntityInstanceLayoutBasePath = (metahubId: string, kindKey: string, entityId: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(kindKey)}/instance/${entityId}/layout`

export const resolveEntityMetadataKind = (entityType: MetahubEntityType | null, kindKey: string): BuiltinEntityKind | null => {
    const resolvedKindKey = entityType?.kindKey ?? kindKey
    return isBuiltinEntityKind(resolvedKindKey) ? resolvedKindKey : null
}

export const shouldTranslateEntityTypeUiText = (kindKey: string) => isBuiltinEntityKind(kindKey)

export const appendLocalizedCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback?: string
): VersionedLocalizedContent<string> => {
    const locale = uiLocale === 'ru' ? 'ru' : 'en'
    const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
    const fallbackText = (fallback || '').trim()
    const defaultText = fallbackText ? `${fallbackText}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
    const localizedValues: Record<string, string> = {}

    if (value?.locales) {
        for (const [entryLocale, entryValue] of Object.entries(value.locales)) {
            const content = typeof entryValue?.content === 'string' ? entryValue.content.trim() : ''
            if (content.length > 0) {
                const entrySuffix = entryLocale === 'ru' ? ' (копия)' : ' (copy)'
                localizedValues[entryLocale] = `${content}${entrySuffix}`
            }
        }
    }

    if (Object.keys(localizedValues).length === 0) {
        localizedValues[locale] = defaultText
    }

    return ensureLocalizedContent(localizedValues, locale, defaultText)
}

export const resolveEntityTypeName = (entityType: MetahubEntityType | null, uiLocale: string, t: UiTranslate, fallbackKindKey: string) => {
    if (!entityType) {
        return fallbackKindKey
    }

    const codename = getLocalizedContentText(entityType.codename, uiLocale, entityType.kindKey)
    if (shouldTranslateEntityTypeUiText(entityType.kindKey)) {
        return t(entityType.ui.nameKey, { defaultValue: entityType.ui.nameKey }) || codename || entityType.kindKey
    }

    return entityType.ui.nameKey || codename || entityType.kindKey
}

export const getEntityConfig = (entity?: MetahubEntityInstance | null): Record<string, unknown> => {
    if (!isRecord(entity?.config)) {
        return {}
    }
    return entity.config
}

export const getConfigTreeEntityIds = (config: Record<string, unknown>): string[] =>
    Array.isArray(config.treeEntities)
        ? config.treeEntities.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : []

export const getConfigBoolean = (config: Record<string, unknown>, key: 'isSingleHub' | 'isRequiredHub') => config[key] === true

export const toStrictLocalizedRecord = (value?: Record<string, unknown>): Record<string, string> | undefined => {
    if (!value) {
        return undefined
    }

    const nextValue: Record<string, string> = {}
    for (const [locale, content] of Object.entries(value)) {
        if (typeof content === 'string' && content.trim().length > 0) {
            nextValue[locale] = content.trim()
        }
    }

    return Object.keys(nextValue).length > 0 ? nextValue : undefined
}

export const buildInitialFormValues = (uiLocale: string, entity?: MetahubEntityInstance | null): EntityInstanceFormValues => {
    const nameFallback = entity
        ? getLocalizedContentText(entity.name, uiLocale, getLocalizedContentText(entity.codename, uiLocale, entity.id))
        : ''
    const descriptionFallback = entity ? getLocalizedContentText(entity.description, uiLocale, '') : ''
    const config = getEntityConfig(entity)

    return {
        nameVlc: entity ? ensureLocalizedContent(entity.name ?? null, uiLocale, nameFallback || entity.id) : null,
        descriptionVlc: entity?.description ? ensureLocalizedContent(entity.description, uiLocale, descriptionFallback) : null,
        codename: entity ? ensureLocalizedContent(entity.codename ?? null, uiLocale, nameFallback || entity.id) : null,
        codenameTouched: Boolean(entity),
        treeEntityIds: getConfigTreeEntityIds(config),
        isSingleHub: getConfigBoolean(config, 'isSingleHub'),
        isRequiredHub: getConfigBoolean(config, 'isRequiredHub')
    }
}

export const getLinkedCollectionCopyOptions = (values: EntityInstanceFormValues) =>
    normalizeLinkedCollectionCopyOptions({
        copyFieldDefinitions: values.copyFieldDefinitions as boolean | undefined,
        copyRecords: values.copyRecords as boolean | undefined
    })

export const buildCopyInitialValues = (
    uiLocale: string,
    entity?: MetahubEntityInstance | null,
    applyLinkedCollectionDefaults = false
): EntityInstanceFormValues => {
    const initial = buildInitialFormValues(uiLocale, entity)
    const nameFallback = entity
        ? getLocalizedContentText(entity.name, uiLocale, getLocalizedContentText(entity.codename, uiLocale, entity.id))
        : ''

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(initial.nameVlc as VersionedLocalizedContent<string> | null | undefined, uiLocale, nameFallback),
        codename: null,
        codenameTouched: false,
        ...(applyLinkedCollectionDefaults ? normalizeLinkedCollectionCopyOptions() : {})
    }
}

export const buildInstanceDisplayRow = (entity: MetahubEntityInstance, uiLocale: string, t: UiTranslate): EntityInstanceDisplayRow => {
    const config = getEntityConfig(entity)
    const codename = getLocalizedContentText(entity.codename, uiLocale, '')
    const name = getLocalizedContentText(entity.name, uiLocale, codename || entity.id) || codename || entity.id
    const description = getLocalizedContentText(entity.description, uiLocale, '') || t('entities.noDescription', 'No description')
    const updatedAt =
        typeof entity.updatedAt === 'string' ? entity.updatedAt : typeof entity.createdAt === 'string' ? entity.createdAt : undefined
    const sortOrder =
        typeof entity.sortOrder === 'number' ? entity.sortOrder : typeof config.sortOrder === 'number' ? config.sortOrder : null

    return {
        id: entity.id,
        name,
        description,
        codename,
        treeEntityIds: getConfigTreeEntityIds(config),
        sortOrder,
        updatedAt,
        isDeleted: entity._mhb_deleted === true,
        raw: entity
    }
}

export const buildLinkedCollectionDeleteDialogEntity = ({
    entity,
    metahubId,
    uiLocale,
    treeEntities
}: {
    entity: MetahubEntityInstance
    metahubId: string
    uiLocale: string
    treeEntities: TreeEntity[]
}): LinkedCollectionEntity => {
    const config = getEntityConfig(entity)
    const codenameFallback = getLocalizedContentText(entity.codename, uiLocale, entity.id) || entity.id
    const nameFallback = getLocalizedContentText(entity.name, uiLocale, codenameFallback) || codenameFallback
    const sortOrder = typeof entity.sortOrder === 'number' ? entity.sortOrder : typeof config.sortOrder === 'number' ? config.sortOrder : 0
    const treeEntityIds = getConfigTreeEntityIds(config)

    return {
        id: entity.id,
        metahubId,
        codename: ensureLocalizedContent(entity.codename ?? null, uiLocale, codenameFallback) as LinkedCollectionEntity['codename'],
        name: ensureLocalizedContent(entity.name ?? null, uiLocale, nameFallback) as LinkedCollectionEntity['name'],
        description: entity.description
            ? (ensureLocalizedContent(
                  entity.description ?? null,
                  uiLocale,
                  getLocalizedContentText(entity.description, uiLocale, '')
              ) as LinkedCollectionEntity['description'])
            : undefined,
        isSingleHub: getConfigBoolean(config, 'isSingleHub'),
        isRequiredHub: getConfigBoolean(config, 'isRequiredHub'),
        sortOrder,
        createdAt: typeof entity.createdAt === 'string' ? entity.createdAt : '',
        updatedAt: typeof entity.updatedAt === 'string' ? entity.updatedAt : typeof entity.createdAt === 'string' ? entity.createdAt : '',
        version: typeof entity.version === 'number' ? entity.version : undefined,
        treeEntities: treeEntities
            .filter((hub) => treeEntityIds.includes(hub.id))
            .map((hub) => ({
                id: hub.id,
                codename: getLocalizedContentText(hub.codename, uiLocale, hub.id),
                name: hub.name
            }))
    }
}
