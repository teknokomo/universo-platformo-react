import {
    createLocalizedContent,
    isLocalizedContent,
    normalizeLocale,
    resolveLocalizedContent,
    generateUuidV7,
    updateLocalizedContentLocale,
    buildTabularSiblingRowOptions as buildSharedTabularSiblingRowOptions,
    normalizeTabularSiblingRowOrder,
    readTabularRowOrderingConfig as readSharedTabularRowOrderingConfig,
    readTabularSiblingSelectConfig,
    resolveTabularSiblingFieldValue,
    sortTabularSiblingRows,
    type TabularRowOrderingConfig as SharedTabularRowOrderingConfig,
    type TabularSiblingSelectConfig
} from '@universo-react/utils'
import type { VersionedLocalizedContent } from '@universo-react/types'
import type { FieldConfig } from '../components/dialogs/fieldConfig'
import { formatRuntimeSafeValue } from './displayValue'

type TabularFieldLike = Pick<FieldConfig, 'id' | 'codename' | 'type' | 'localized' | 'validationRules' | 'uiConfig'>

export type TabularSiblingTableSource = {
    rows: Record<string, unknown>[]
    childFields: Array<Pick<FieldConfig, 'id' | 'codename'>>
    rowOrdering?: unknown
}

export type TabularSiblingTableValues = Record<string, TabularSiblingTableSource>

export type TabularSiblingRowSelectConfig = TabularSiblingSelectConfig

export type TabularRowOrderingConfig = SharedTabularRowOrderingConfig

export type TabularRowSelectOption = { id: string; label: string }

export const isLocalizedStringField = (field: TabularFieldLike): boolean =>
    field.type === 'STRING' &&
    (field.validationRules?.localized === true || field.validationRules?.versioned === true || field.localized === true)

export const getTabularStringDisplayValue = (value: unknown, locale: string): string => {
    if (value === null || value === undefined) return ''

    if (isLocalizedContent(value)) {
        const localizedValue = resolveLocalizedContent(value as VersionedLocalizedContent<string>, normalizeLocale(locale), '')
        return typeof localizedValue === 'string' ? localizedValue : ''
    }

    return formatRuntimeSafeValue(value, locale)
}

export const updateLocalizedTabularStringValue = (
    currentValue: unknown,
    nextText: string,
    locale: string
): VersionedLocalizedContent<string> => {
    const normalizedLocale = normalizeLocale(locale)

    if (isLocalizedContent(currentValue)) {
        return updateLocalizedContentLocale(currentValue as VersionedLocalizedContent<string>, normalizedLocale, nextText)
    }

    return createLocalizedContent(normalizedLocale, nextText)
}

export const normalizeTabularCellValue = (field: TabularFieldLike, value: unknown, locale: string): unknown => {
    if (!isLocalizedStringField(field)) {
        return value
    }

    if (value === null || value === undefined) {
        return null
    }

    if (isLocalizedContent(value)) {
        return value
    }

    if (typeof value === 'string') {
        return createLocalizedContent(normalizeLocale(locale), value)
    }

    return createLocalizedContent(normalizeLocale(locale), getTabularStringDisplayValue(value, locale))
}

export const normalizeTabularRowValues = (
    row: Record<string, unknown>,
    childFields: TabularFieldLike[],
    locale: string
): Record<string, unknown> => {
    const normalizedRow = { ...row }

    for (const field of childFields) {
        normalizedRow[field.id] = normalizeTabularCellValue(field, row[field.id], locale)
    }

    return normalizedRow
}

export const readTabularSiblingRowSelectConfig = (field: TabularFieldLike): TabularSiblingRowSelectConfig | null => {
    return readTabularSiblingSelectConfig(field) as TabularSiblingRowSelectConfig | null
}

export const readTabularRowOrderingConfig = (value: unknown): TabularRowOrderingConfig | null => readSharedTabularRowOrderingConfig(value)

export const resolveTabularRowFieldValue = (
    row: Record<string, unknown>,
    childFields: Array<Pick<FieldConfig, 'id' | 'codename'>>,
    codename: string
): unknown => {
    return resolveTabularSiblingFieldValue(row, childFields, codename)
}

export const buildTabularSiblingRowOptions = (
    field: TabularFieldLike,
    siblingTables: TabularSiblingTableValues | undefined,
    locale: string
): TabularRowSelectOption[] => {
    return buildSharedTabularSiblingRowOptions({
        field,
        siblingTables,
        formatLabel: (value) => getTabularStringDisplayValue(value, locale)
    })
}

export const sortTabularRowsByOrder = <TRow extends Record<string, unknown>>(
    rows: TRow[],
    rawConfig: unknown,
    childFields: Array<Pick<FieldConfig, 'id' | 'codename'>>
): TRow[] => {
    return sortTabularSiblingRows(rows, rawConfig, childFields)
}

export const normalizeTabularRowOrdering = <TRow extends Record<string, unknown>>(
    rows: TRow[],
    rawConfig: unknown,
    childFields: Array<Pick<FieldConfig, 'id' | 'codename'>>
): TRow[] => {
    return normalizeTabularSiblingRowOrder(rows, rawConfig, childFields)
}

export const getTabularRowOrderingLabel = (
    row: Record<string, unknown>,
    rawConfig: unknown,
    childFields: Array<Pick<FieldConfig, 'id' | 'codename'>>,
    locale: string
): string => {
    const config = readTabularRowOrderingConfig(rawConfig)
    return config
        ? getTabularStringDisplayValue(resolveTabularSiblingFieldValue(row, childFields, config.labelFieldCodename), locale).trim()
        : ''
}

const shouldGenerateStableTabularCellId = (field: TabularFieldLike): boolean =>
    field.type === 'STRING' && field.uiConfig?.generateUuidV7 === true

export const buildInitialTabularRowValues = (childFields: TabularFieldLike[]): Record<string, unknown> => {
    const row: Record<string, unknown> = {}

    for (const field of childFields) {
        row[field.id] = shouldGenerateStableTabularCellId(field) ? generateUuidV7() : field.type === 'BOOLEAN' ? false : null
    }

    return row
}
