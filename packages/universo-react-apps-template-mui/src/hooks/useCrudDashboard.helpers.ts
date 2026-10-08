import { isUuidV7 } from '@universo-react/utils'
import type { CreateTargetDefault, ResourceType } from '@universo-react/types'
import type { AppDataResponse } from '../api/api'
import type { FieldConfig } from '../components/dialogs/FormDialog'
import { buildDefaultResourceSourceForType } from '../utils/resourceSourceDefaults'

// ---------------------------------------------------------------------------
//  Stable empty key prefix (avoids new [] allocation on each render)
// ---------------------------------------------------------------------------

export const EMPTY_KEY_PREFIX: readonly unknown[] = []

export const readInitialObjectCollectionId = (): string | undefined => {
    if (typeof window === 'undefined') return undefined
    try {
        return new URLSearchParams(window.location.search).get('objectCollectionId') ?? undefined
    } catch {
        return undefined
    }
}

const normalizeLocale = (locale: string) => locale.split(/[-_]/)[0]?.toLowerCase() || 'en'

const getCopySuffix = (locale: string) => (normalizeLocale(locale) === 'ru' ? ' (копия)' : ' (copy)')
const getCopyLabel = (locale: string) => (normalizeLocale(locale) === 'ru' ? 'Копия' : 'Copy')

const isLocalizedContent = (value: unknown): value is { _primary?: string; locales?: Record<string, { content?: string }> } =>
    Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

export const appendCopySuffixToFirstStringField = (params: {
    sourceData: Record<string, unknown>
    fieldConfigs: FieldConfig[]
    locale: string
}): Record<string, unknown> => {
    const { sourceData, fieldConfigs, locale } = params
    const firstStringField = fieldConfigs.find((field) => field.type === 'STRING')
    if (!firstStringField) return sourceData

    const fieldId = firstStringField.id
    const rawValue = sourceData[fieldId]
    const fallbackSuffix = getCopySuffix(locale)

    if (typeof rawValue === 'string') {
        const content = rawValue.trim()
        return {
            ...sourceData,
            [fieldId]: content.length > 0 ? `${content}${fallbackSuffix}` : fallbackSuffix.trim()
        }
    }

    if (isLocalizedContent(rawValue)) {
        const nextLocales = { ...(rawValue.locales ?? {}) }
        let hasAnyContent = false
        for (const [localeKey, localeValue] of Object.entries(nextLocales)) {
            const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
            if (!content) continue
            hasAnyContent = true
            nextLocales[localeKey] = {
                ...(localeValue ?? {}),
                content: `${content}${getCopySuffix(localeKey)}`
            }
        }
        if (!hasAnyContent) {
            const primaryLocale = normalizeLocale(rawValue._primary || locale)
            nextLocales[primaryLocale] = {
                content: `${getCopyLabel(primaryLocale)}${getCopySuffix(primaryLocale)}`
            }
        }

        return {
            ...sourceData,
            [fieldId]: {
                ...rawValue,
                locales: nextLocales
            }
        }
    }

    return {
        ...sourceData,
        [fieldId]: `${getCopyLabel(locale)}${fallbackSuffix}`
    }
}

const normalizeCreateDefaultFieldKey = (value: unknown): string =>
    (typeof value === 'string' ? value : '')
        .trim()
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()

const blockedCreateDefaultFieldKeys = new Set([
    'id',
    'workspace',
    'workspaceid',
    'owner',
    'ownerid',
    'owneruserid',
    'user',
    'userid',
    'assigneduserid',
    'createdby',
    'updatedby',
    'deletedby',
    'targetrecordid',
    'targetobjectid',
    'targetobjectcodename',
    'sourceobjectcodename',
    'sourcerowid',
    'sourcelineid',
    'principalid',
    'apprecordstate',
    'appdeleted'
])

const isUnsafeCreateDefaultField = (fieldCodename: string): boolean => {
    const normalized = normalizeCreateDefaultFieldKey(fieldCodename)
    return (
        normalized.startsWith('upl') ||
        normalized.startsWith('progress') ||
        normalized.startsWith('lifecycle') ||
        normalized.includes('workspaceid') ||
        normalized.includes('ownerid') ||
        normalized.includes('userid') ||
        blockedCreateDefaultFieldKeys.has(normalized)
    )
}

const isWritableCreateDefaultField = (field: FieldConfig): boolean => {
    const uiConfig = field.uiConfig ?? {}
    return (
        field.type !== 'TABLE' &&
        uiConfig.hidden !== true &&
        uiConfig.formHidden !== true &&
        uiConfig.readOnly !== true &&
        uiConfig.readonly !== true &&
        uiConfig.disabled !== true &&
        uiConfig.serverOwned !== true
    )
}

const isResourceSourceCreateDefaultField = (field: FieldConfig): boolean => {
    const uiConfig = field.uiConfig ?? {}
    return field.type === 'JSON' && (uiConfig.widget === 'resourceSource' || uiConfig.resourceSource === true || uiConfig.resource === true)
}

const resolveEnumDefaultValue = (field: FieldConfig, enumCodename: string): string | null => {
    if (field.type !== 'REF' || field.refTargetEntityKind !== 'enumeration') return null

    const targetCodename = normalizeCreateDefaultFieldKey(enumCodename)
    const options = [...(field.enumOptions ?? []), ...(field.refOptions ?? [])]
    return options.find((option) => normalizeCreateDefaultFieldKey(option.codename) === targetCodename)?.id ?? null
}

const coerceScalarCreateDefaultValue = (field: FieldConfig, value: string | number | boolean | null): unknown => {
    if (value === null) return null
    if (field.type === 'STRING' && typeof value === 'string') return value
    if (field.type === 'NUMBER' && typeof value === 'number' && Number.isFinite(value)) return value
    if (field.type === 'BOOLEAN' && typeof value === 'boolean') return value
    if (field.type === 'DATE' && typeof value === 'string') return value
    return undefined
}

const coerceContextCreateDefaultValue = (field: FieldConfig, value: string | number | boolean | null): unknown => {
    if (field.type === 'REF' && typeof value === 'string' && isUuidV7(value)) return value
    return coerceScalarCreateDefaultValue(field, value)
}

const readCreateDefaultContextPath = (context: Record<string, unknown> | undefined, path: string): unknown => {
    if (!context) return undefined

    let current: unknown = context
    for (const segment of path.split('.')) {
        if (!current || typeof current !== 'object') return undefined
        if (segment === '__proto__' || segment === 'prototype' || segment === 'constructor') return undefined

        const record = current as Record<string, unknown>
        if (!Object.prototype.hasOwnProperty.call(record, segment)) return undefined
        current = record[segment]
    }

    return current
}

export const buildSafeCreateInitialData = (
    createDefaults: readonly CreateTargetDefault[] | undefined,
    fieldConfigs: readonly FieldConfig[],
    createDefaultContext?: Record<string, unknown>
): Record<string, unknown> | undefined => {
    if (!createDefaults?.length || fieldConfigs.length === 0) return undefined

    const fieldsByCodename = new Map<string, FieldConfig>()
    for (const field of fieldConfigs) {
        fieldsByCodename.set(normalizeCreateDefaultFieldKey(field.id), field)
        if (field.codename) {
            fieldsByCodename.set(normalizeCreateDefaultFieldKey(field.codename), field)
        }
    }
    const initialData: Record<string, unknown> = {}

    for (const item of createDefaults) {
        if (isUnsafeCreateDefaultField(item.fieldCodename)) continue

        const field = fieldsByCodename.get(normalizeCreateDefaultFieldKey(item.fieldCodename))
        if (!field || !isWritableCreateDefaultField(field)) continue

        if (typeof item.enumCodename === 'string') {
            const enumValueId = resolveEnumDefaultValue(field, item.enumCodename)
            if (enumValueId) {
                initialData[field.id] = enumValueId
            }
            continue
        }

        if (typeof item.resourceSourceType === 'string') {
            if (isResourceSourceCreateDefaultField(field)) {
                initialData[field.id] = buildDefaultResourceSourceForType(item.resourceSourceType as ResourceType)
            }
            continue
        }

        if (typeof item.contextPath === 'string') {
            const rawValue = readCreateDefaultContextPath(createDefaultContext, item.contextPath)
            if (rawValue === null || typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
                const nextValue = coerceContextCreateDefaultValue(field, rawValue)
                if (typeof nextValue !== 'undefined') {
                    initialData[field.id] = nextValue
                }
            }
            continue
        }

        if (Object.prototype.hasOwnProperty.call(item, 'value')) {
            const nextValue = coerceScalarCreateDefaultValue(field, item.value as string | number | boolean | null)
            if (typeof nextValue !== 'undefined') {
                initialData[field.id] = nextValue
            }
        }
    }

    return Object.keys(initialData).length > 0 ? initialData : undefined
}

export const stripReadOnlyEnumerationLabelFields = (params: {
    payload: Record<string, unknown>
    fieldConfigs: FieldConfig[]
}): Record<string, unknown> => {
    const { payload, fieldConfigs } = params
    const result: Record<string, unknown> = {}

    for (const field of fieldConfigs) {
        if (!Object.prototype.hasOwnProperty.call(payload, field.id)) continue

        if (field.type === 'REF' && field.refTargetEntityKind === 'enumeration' && field.enumPresentationMode === 'label') {
            continue
        }

        if (field.type === 'TABLE') {
            const rawRows = payload[field.id]
            if (!Array.isArray(rawRows)) {
                result[field.id] = rawRows
                continue
            }

            const childFields = field.childFields ?? []
            const sanitizedRows = rawRows.map((row) => {
                if (!row || typeof row !== 'object') return row
                const rowRecord = row as Record<string, unknown>
                const sanitizedRow: Record<string, unknown> = {}

                for (const childField of childFields) {
                    if (!Object.prototype.hasOwnProperty.call(rowRecord, childField.id)) continue
                    if (
                        childField.type === 'REF' &&
                        childField.refTargetEntityKind === 'enumeration' &&
                        childField.enumPresentationMode === 'label'
                    ) {
                        continue
                    }
                    sanitizedRow[childField.id] = rowRecord[childField.id]
                }

                return sanitizedRow
            })

            result[field.id] = sanitizedRows
            continue
        }

        result[field.id] = payload[field.id]
    }

    return result
}

export const readRuntimeRowVersion = (row: Record<string, unknown> | null | undefined): number | null => {
    const rawValue = row?._upl_version
    const value =
        typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' && rawValue.trim().length > 0 ? Number(rawValue) : Number.NaN
    return Number.isInteger(value) && value > 0 ? value : null
}

export const resolveRuntimeObjectCollectionForSection = (
    appData: AppDataResponse | undefined,
    sectionId: string | undefined
): string | undefined => {
    if (!appData || !sectionId) return undefined
    const normalizedSectionId = sectionId.trim().toLowerCase()
    const objectCollection = (appData.objectCollections ?? []).find((item) => {
        const codename = typeof item.codename === 'string' ? item.codename.trim().toLowerCase() : ''
        return item.id === sectionId || codename === normalizedSectionId
    })
    if (objectCollection?.tableName) return objectCollection.id

    const section = (appData.sections ?? []).find((item) => {
        const codename = typeof item.codename === 'string' ? item.codename.trim().toLowerCase() : ''
        return item.id === sectionId || codename === normalizedSectionId
    })
    return section?.tableName ? section.id : undefined
}
