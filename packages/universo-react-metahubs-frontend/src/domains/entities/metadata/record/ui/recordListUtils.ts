import type { ActionContext } from '@universo-react/template-mui'
import type { EntityKind } from '@universo-react/types'
import type { RecordItemDisplay, VersionedLocalizedContent } from '../../../../../types'
import { getVLCString } from '../../../../../types'
import { generateUuidV7, hasAxiosResponse, isUuidV7 } from '@universo-react/utils'

// ────────────────────────── Types ──────────────────────────

export type ElementOption = {
    id: string
    name: string
}

export type RefTargetDescriptor = {
    kind: EntityKind
    targetId: string
    targetConstantId?: string | null
    setConstantLabel?: string | null
}

export type ElementUpdatePatch = Record<string, unknown>

export type ElementMenuContext = ActionContext<RecordItemDisplay, { data: ElementUpdatePatch }>

export type ElementConfirmSpec = {
    title?: string
    titleKey?: string
    description?: string
    descriptionKey?: string
    confirmButtonName?: string
    confirmKey?: string
    cancelButtonName?: string
    cancelKey?: string
    interpolate?: Record<string, unknown>
}

export type EnumerationValueOption = {
    id: string
    label: string
    isDefault: boolean
}

// ────────────────────────── Utility Functions ──────────────────────────

export const isVersionedLocalizedContent = (value: unknown): value is VersionedLocalizedContent<string> =>
    value !== null && typeof value === 'object' && 'locales' in value

export const extractResponseMessage = (error: unknown): string | undefined => {
    if (!hasAxiosResponse(error)) return undefined
    const responseData = error.response.data
    if (!responseData || typeof responseData !== 'object') return undefined
    const message = (responseData as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
}

export const resolveSetConstantLabel = (constant: { value: unknown; dataType?: string }, locale: string): string => {
    const rawValue = constant.value
    if (rawValue === null || rawValue === undefined) return '—'

    if (typeof rawValue === 'object') {
        const localized = getVLCString(rawValue as Record<string, unknown>, locale)
        if (localized && localized.trim().length > 0) return localized
    }

    if (constant.dataType === 'DATE' && typeof rawValue === 'string') {
        const parsed = new Date(rawValue)
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleString(locale)
        }
    }

    return String(rawValue)
}

export const resolveRefId = (value: unknown): string | null => {
    if (typeof value === 'string' && value.length > 0) return value
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>
        if (typeof obj.id === 'string' && obj.id.length > 0) return obj.id
        if (typeof obj.value === 'string' && obj.value.length > 0) return obj.value
    }
    return null
}

export const normalizeUiLocale = (locale: string) => locale.split(/[-_]/)[0]?.toLowerCase() || 'en'

export const getCopySuffixByLocale = (locale: string) => (normalizeUiLocale(locale) === 'ru' ? ' (копия)' : ' (copy)')
export const getCopyLabelByLocale = (locale: string) => (normalizeUiLocale(locale) === 'ru' ? 'Копия' : 'Copy')

type RecordCopyComponent = {
    dataType: string
    codename: string
    uiConfig?: Record<string, unknown>
    childComponents?: RecordCopyComponent[]
}

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)

const readConfigString = (value: unknown, key: string): string | null => {
    if (!isRecordValue(value)) return null
    const candidate = value[key]
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null
}

const cloneTableRowsForCopy = (
    component: RecordCopyComponent,
    sourceRows: unknown,
    generatedValues: Map<string, Map<string, string>>
): Record<string, unknown>[] | null => {
    if (!Array.isArray(sourceRows)) return null

    const childComponents = component.childComponents ?? []
    const rows = sourceRows.map((sourceRow) => {
        const row = isRecordValue(sourceRow) ? { ...sourceRow } : {}
        for (const child of childComponents) {
            const fieldKey = child.codename
            const uiConfig = child.uiConfig ?? {}
            if (child.dataType === 'STRING' && uiConfig.generateUuidV7 === true) {
                const previousValue = row[fieldKey]
                const nextValue = generateUuidV7()
                row[fieldKey] = nextValue
                if (typeof previousValue === 'string' && isUuidV7(previousValue)) {
                    const tableValues = generatedValues.get(component.codename) ?? new Map<string, string>()
                    tableValues.set(`${child.codename}\u0000${previousValue.toLowerCase()}`, nextValue)
                    generatedValues.set(component.codename, tableValues)
                }
            } else if (uiConfig.resetOnCopy === true) {
                row[fieldKey] = uiConfig.defaultValue === undefined ? null : uiConfig.defaultValue
            }
        }
        return row
    })

    const orderFieldCodename = readConfigString(component.uiConfig?.rowOrdering, 'orderFieldCodename')
    if (orderFieldCodename) {
        const orderField = childComponents.find((child) => child.codename === orderFieldCodename)
        if (orderField) {
            rows.forEach((row, index) => {
                row[orderField.codename] = index + 1
            })
        }
    }

    return rows
}

const remapCopiedSiblingReferences = (
    components: RecordCopyComponent[],
    copiedData: Record<string, unknown>,
    generatedValues: Map<string, Map<string, string>>
): void => {
    for (const component of components) {
        if (component.dataType !== 'TABLE') continue
        const rows = copiedData[component.codename]
        if (!Array.isArray(rows)) continue

        for (const child of component.childComponents ?? []) {
            const siblingSelect = child.uiConfig?.siblingRowSelect
            const tableCodename = readConfigString(siblingSelect, 'tableCodename')
            const valueFieldCodename = readConfigString(siblingSelect, 'valueFieldCodename')
            const valueMap = tableCodename ? generatedValues.get(tableCodename) : undefined
            if (!valueFieldCodename || !valueMap) continue

            for (const rowValue of rows) {
                if (!isRecordValue(rowValue)) continue
                const previousValue = rowValue[child.codename]
                if (typeof previousValue === 'string') {
                    rowValue[child.codename] = isUuidV7(previousValue)
                        ? valueMap.get(`${valueFieldCodename}\u0000${previousValue.toLowerCase()}`) ?? null
                        : null
                }
            }
        }
    }
}

export const isLocalizedContentValue = (value: unknown): value is { _primary?: string; locales?: Record<string, { content?: string }> } =>
    Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

export const applyCopySuffixToFirstStringComponent = (params: {
    sourceData: Record<string, unknown>
    components: Array<{ dataType: string; codename: string }>
    locale: string
}): Record<string, unknown> => {
    const { sourceData, components, locale } = params
    const firstStringComponent = components.find((component) => component.dataType === 'STRING')
    if (!firstStringComponent) return { ...sourceData }

    const fieldKey = firstStringComponent.codename
    const rawValue = sourceData[fieldKey]
    const defaultSuffix = getCopySuffixByLocale(locale)

    if (typeof rawValue === 'string') {
        const content = rawValue.trim()
        return {
            ...sourceData,
            [fieldKey]: content.length > 0 ? `${content}${defaultSuffix}` : `${getCopyLabelByLocale(locale)}${defaultSuffix}`
        }
    }

    if (isLocalizedContentValue(rawValue)) {
        const nextLocales = { ...(rawValue.locales ?? {}) }
        let hasAnyContent = false
        for (const [localeKey, localeValue] of Object.entries(nextLocales)) {
            const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
            if (!content) continue
            hasAnyContent = true
            nextLocales[localeKey] = {
                ...(localeValue ?? {}),
                content: `${content}${getCopySuffixByLocale(localeKey)}`
            }
        }

        if (!hasAnyContent) {
            const primaryLocale = normalizeUiLocale(rawValue._primary || locale)
            nextLocales[primaryLocale] = {
                content: `${getCopyLabelByLocale(primaryLocale)}${getCopySuffixByLocale(primaryLocale)}`
            }
        }

        return {
            ...sourceData,
            [fieldKey]: {
                ...rawValue,
                locales: nextLocales
            }
        }
    }

    return {
        ...sourceData,
        [fieldKey]: `${getCopyLabelByLocale(locale)}${defaultSuffix}`
    }
}

export const prepareRecordCopyInitialData = (params: {
    sourceData: Record<string, unknown>
    components: RecordCopyComponent[]
    locale: string
}): Record<string, unknown> => {
    const copiedData = applyCopySuffixToFirstStringComponent({
        ...params,
        components: params.components
            .filter((component) => component.uiConfig?.hidden !== true)
            .map(({ dataType, codename }) => ({ dataType, codename }))
    })
    for (const component of params.components) {
        const uiConfig = component.uiConfig ?? {}
        if (component.dataType !== 'TABLE') {
            if (component.dataType === 'STRING' && uiConfig.generateUuidV7 === true) {
                copiedData[component.codename] = generateUuidV7()
            } else if (uiConfig.resetOnCopy === true) {
                copiedData[component.codename] = uiConfig.defaultValue === undefined ? null : uiConfig.defaultValue
            }
        }
    }

    const generatedValues = new Map<string, Map<string, string>>()
    for (const component of params.components) {
        if (component.dataType === 'TABLE') {
            const copiedRows = cloneTableRowsForCopy(component, params.sourceData[component.codename], generatedValues)
            if (copiedRows) copiedData[component.codename] = copiedRows
        }
        if (component.uiConfig?.autoGenerateSemanticKey === true) delete copiedData[component.codename]
    }
    remapCopiedSiblingReferences(params.components, copiedData, generatedValues)
    return copiedData
}
