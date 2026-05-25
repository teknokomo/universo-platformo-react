import {
    createLocalizedContent,
    isLocalizedContent,
    normalizeLocale,
    resolveLocalizedContent,
    updateLocalizedContentLocale
} from '@universo-react/utils'
import type { VersionedLocalizedContent } from '@universo-react/types'
import type { FieldConfig } from '../components/dialogs/FormDialog'
import { formatRuntimeSafeValue } from './displayValue'

type TabularFieldLike = Pick<FieldConfig, 'id' | 'type' | 'localized' | 'validationRules'>

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
