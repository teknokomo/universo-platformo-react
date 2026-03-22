import {
    createLocalizedContent,
    isLocalizedContent,
    normalizeLocale,
    resolveLocalizedContent,
    updateLocalizedContentLocale
} from '@universo/utils'
import type { VersionedLocalizedContent } from '@universo/types'
import type { FieldConfig } from '../components/dialogs/FormDialog'

type TabularFieldLike = Pick<FieldConfig, 'id' | 'type' | 'localized' | 'validationRules'>

export const isLocalizedStringField = (field: TabularFieldLike): boolean =>
    field.type === 'STRING' && Boolean(field.validationRules?.localized ?? field.validationRules?.versioned ?? field.localized)

export const getTabularStringDisplayValue = (value: unknown, locale: string): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value

    if (isLocalizedContent(value)) {
        const localizedValue = resolveLocalizedContent(value as VersionedLocalizedContent<string>, normalizeLocale(locale), '')
        return typeof localizedValue === 'string' ? localizedValue : ''
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value)
    }

    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch {
            return String(value)
        }
    }

    return String(value)
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

    return createLocalizedContent(normalizeLocale(locale), String(value))
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
