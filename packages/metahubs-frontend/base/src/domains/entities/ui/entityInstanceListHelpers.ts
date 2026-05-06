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
export const DEFAULT_PAGE_BLOCK_CONTENT = { format: 'editorjs', blocks: [] } as const

export type EntityInstanceDialogMode = 'create' | 'edit' | 'copy' | 'delete' | 'deletePermanent'

const BUILTIN_ENTITY_TYPE_NAME_KEYS: Record<BuiltinEntityKind, { key: string; fallback: string }> = {
    hub: { key: 'metahubs:hubs.title', fallback: 'Hubs' },
    catalog: { key: 'metahubs:catalogs.title', fallback: 'Catalogs' },
    set: { key: 'metahubs:sets.title', fallback: 'Sets' },
    enumeration: { key: 'metahubs:enumerations.title', fallback: 'Enumerations' },
    page: { key: 'metahubs:pages.title', fallback: 'Pages' }
}

const BUILTIN_ENTITY_DIALOG_TITLE_KEYS: Record<
    BuiltinEntityKind,
    Partial<Record<EntityInstanceDialogMode, { key: string; fallback: string }>>
> = {
    hub: {
        create: { key: 'metahubs:hubs.createDialog.title', fallback: 'Create Hub' },
        edit: { key: 'metahubs:hubs.editDialog.title', fallback: 'Edit Hub' },
        copy: { key: 'metahubs:hubs.copyTitle', fallback: 'Copy Hub' },
        delete: { key: 'metahubs:hubs.deleteDialog.title', fallback: 'Delete Hub' }
    },
    catalog: {
        create: { key: 'metahubs:catalogs.createDialog.title', fallback: 'Create Catalog' },
        edit: { key: 'metahubs:catalogs.editDialog.title', fallback: 'Edit Catalog' },
        copy: { key: 'metahubs:catalogs.copyTitle', fallback: 'Copy Catalog' },
        delete: { key: 'metahubs:catalogs.deleteDialog.title', fallback: 'Delete Catalog' }
    },
    set: {
        create: { key: 'metahubs:sets.createDialog.title', fallback: 'Create Set' },
        edit: { key: 'metahubs:sets.editDialog.title', fallback: 'Edit Set' },
        copy: { key: 'metahubs:sets.copyTitle', fallback: 'Copy Set' },
        delete: { key: 'metahubs:sets.deleteDialog.title', fallback: 'Delete Set' }
    },
    enumeration: {
        create: { key: 'metahubs:enumerations.createDialog.title', fallback: 'Create Enumeration' },
        edit: { key: 'metahubs:enumerations.editDialog.title', fallback: 'Edit Enumeration' },
        copy: { key: 'metahubs:enumerations.copyTitle', fallback: 'Copy Enumeration' },
        delete: { key: 'metahubs:enumerations.deleteDialog.title', fallback: 'Delete Enumeration' }
    },
    page: {
        create: { key: 'metahubs:pages.createDialog.title', fallback: 'Create Page' },
        edit: { key: 'metahubs:pages.editDialog.title', fallback: 'Edit Page' },
        copy: { key: 'metahubs:pages.copyTitle', fallback: 'Copy Page' },
        delete: { key: 'metahubs:pages.deleteDialog.title', fallback: 'Delete Page' }
    }
}

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

const STANDARD_ENTITY_METADATA_KIND_SET = new Set<string>(['hub', 'catalog', 'set', 'enumeration', 'page'])

export const isStandardEntityMetadataKind = (kind: string): kind is BuiltinEntityKind => STANDARD_ENTITY_METADATA_KIND_SET.has(kind)

export const buildEntityInstanceLayoutBasePath = (metahubId: string, kindKey: string, entityId: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(kindKey)}/instance/${entityId}/layout`

export const resolveEntityMetadataKind = (entityType: MetahubEntityType | null, kindKey: string): BuiltinEntityKind | null => {
    const resolvedKindKey = entityType?.kindKey ?? kindKey
    return isStandardEntityMetadataKind(resolvedKindKey) ? resolvedKindKey : null
}

export const shouldTranslateEntityTypeUiText = (kindKey: string) => isBuiltinEntityKind(kindKey)

export const resolveBuiltinEntityTypeName = (kindKey: string, t: UiTranslate): string | null => {
    if (!isBuiltinEntityKind(kindKey)) {
        return null
    }

    const spec = BUILTIN_ENTITY_TYPE_NAME_KEYS[kindKey]
    return t(spec.key, { defaultValue: spec.fallback }) || spec.fallback
}

const resolvePresentationDialogTitle = (
    entityType: MetahubEntityType | null,
    mode: EntityInstanceDialogMode,
    uiLocale: string
): string | null => {
    const presentation = entityType?.presentation
    if (!isRecord(presentation)) {
        return null
    }

    const dialogTitles = presentation.dialogTitles
    if (!isRecord(dialogTitles)) {
        return null
    }

    const value = dialogTitles[mode]
    if (typeof value === 'string') {
        const normalized = value.trim()
        return normalized.length > 0 ? normalized : null
    }

    return getLocalizedContentText(value as VersionedLocalizedContent<string> | null | undefined, uiLocale, '') || null
}

export const resolveEntityInstanceDialogTitle = (
    entityType: MetahubEntityType | null,
    mode: EntityInstanceDialogMode,
    uiLocale: string,
    t: UiTranslate,
    fallbackKindKey: string
): string => {
    const presentationTitle = resolvePresentationDialogTitle(entityType, mode, uiLocale)
    if (presentationTitle) {
        return presentationTitle
    }

    const builtinKind = entityType?.kindKey ?? fallbackKindKey
    if (isBuiltinEntityKind(builtinKind)) {
        const spec = BUILTIN_ENTITY_DIALOG_TITLE_KEYS[builtinKind]?.[mode]
        if (spec) {
            return t(spec.key, { defaultValue: spec.fallback }) || spec.fallback
        }
    }

    const entityTypeName = resolveEntityTypeName(entityType, uiLocale, t, fallbackKindKey)
    const fallbackByMode: Record<EntityInstanceDialogMode, string> = {
        create: `Create ${entityTypeName}`,
        edit: `Edit ${entityTypeName}`,
        copy: `Copy ${entityTypeName}`,
        delete: `Delete ${entityTypeName}`,
        deletePermanent: `Delete ${entityTypeName} Permanently`
    }

    return t(`entities.instances.dialogTitles.${mode}`, {
        name: entityTypeName,
        defaultValue: fallbackByMode[mode]
    })
}

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
        return resolveBuiltinEntityTypeName(fallbackKindKey, t) ?? fallbackKindKey
    }

    const codename = getLocalizedContentText(entityType.codename, uiLocale, entityType.kindKey)
    if (shouldTranslateEntityTypeUiText(entityType.kindKey)) {
        const builtinFallback = resolveBuiltinEntityTypeName(entityType.kindKey, t)
        return t(entityType.ui.nameKey, { defaultValue: builtinFallback ?? entityType.ui.nameKey }) || codename || entityType.kindKey
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
    Array.isArray(config.hubs) ? config.hubs.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : []

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
