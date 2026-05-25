import type { FixedValueDataType, VersionedLocalizedContent } from '@universo/types'
import { getVLCString } from '../../../../../types'
import { ensureEntityCodenameContent, normalizeLocale } from '../../../../../utils/localizedInput'
import type { FixedValue, FixedValueDisplay } from '../../../../../types'

export type ConstantFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    dataType: FixedValueDataType
    validationRules: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    value: unknown
    _editingEntityId?: string | null
}

export const DEFAULT_FORM_VALUES: ConstantFormValues = {
    nameVlc: null,
    codename: null,
    codenameTouched: false,
    dataType: 'STRING',
    validationRules: { maxLength: 10, localized: false, versioned: false },
    uiConfig: {},
    value: null,
    _editingEntityId: null
}

export const appendCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback: string
): VersionedLocalizedContent<string> => {
    const normalizedLocale = normalizeLocale(uiLocale)
    const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
    if (!value?.locales) {
        return {
            _schema: '1',
            _primary: normalizedLocale,
            locales: {
                [normalizedLocale]: {
                    content: `${fallback}${suffix}`,
                    version: 1,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            }
        }
    }

    const nextLocales = Object.fromEntries(
        Object.entries(value.locales).map(([locale, localeValue]) => {
            const localeSuffix = normalizeLocale(locale) === 'ru' ? ' (копия)' : ' (copy)'
            const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
            return [locale, { ...localeValue, content: content ? `${content}${localeSuffix}` : `${fallback}${localeSuffix}` }]
        })
    )

    return { ...value, locales: nextLocales }
}

export const buildInitialFormValues = (
    source: FixedValue | null,
    mode: 'create' | 'edit' | 'copy',
    codenameStyle: 'kebab-case' | 'pascal-case',
    _codenameAlphabet: 'en' | 'en-ru',
    uiLocale: string
): ConstantFormValues => {
    if (!source) return DEFAULT_FORM_VALUES

    if (mode === 'edit') {
        return {
            nameVlc: source.name ?? null,
            codename: ensureEntityCodenameContent(source, uiLocale, getVLCString(source.codename) || ''),
            codenameTouched: true,
            dataType: source.dataType,
            validationRules: (source.validationRules as Record<string, unknown>) ?? {},
            uiConfig: (source.uiConfig as Record<string, unknown>) ?? {},
            value: source.value ?? null,
            _editingEntityId: source.id
        }
    }

    return {
        nameVlc: appendCopySuffix(source.name ?? null, uiLocale, getVLCString(source.codename) || 'Copy'),
        codename: null,
        codenameTouched: false,
        dataType: source.dataType,
        validationRules: (source.validationRules as Record<string, unknown>) ?? {},
        uiConfig: (source.uiConfig as Record<string, unknown>) ?? {},
        value: source.value ?? null,
        _editingEntityId: null
    }
}

export const normalizeDateComposition = (value: unknown): 'date' | 'time' | 'datetime' => {
    if (typeof value !== 'string') return 'datetime'
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[_\s-]+/g, '')
    if (normalized === 'date' || normalized === 'dateonly') return 'date'
    if (normalized === 'time' || normalized === 'timeonly') return 'time'
    return 'datetime'
}

export const formatDateConstantValue = (rawValue: string, dateComposition: unknown, uiLocale: string): string | null => {
    const parsed = new Date(rawValue)
    if (Number.isNaN(parsed.getTime())) {
        return null
    }

    const normalizedLocale = normalizeLocale(uiLocale)
    const locale = normalizedLocale === 'ru' ? 'ru-RU' : uiLocale
    const composition = normalizeDateComposition(dateComposition)

    if (composition === 'date') {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'UTC'
        }).format(parsed)
    }

    if (composition === 'time') {
        return new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'UTC'
        }).format(parsed)
    }

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(parsed)
}

export const renderConstantValue = (row: FixedValueDisplay, uiLocale: string, labels: { boolTrue: string; boolFalse: string }): string => {
    const value = row.value
    if (value === null || value === undefined) return '—'
    if (row.dataType === 'BOOLEAN') {
        if (typeof value === 'boolean') return value ? labels.boolTrue : labels.boolFalse
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase()
            if (normalized === 'true') return labels.boolTrue
            if (normalized === 'false') return labels.boolFalse
        }
    }
    if (row.dataType === 'DATE' && typeof value === 'string') {
        return formatDateConstantValue(value, row.validationRules?.dateComposition, uiLocale) ?? value
    }
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    if (typeof value === 'object') {
        const localized = getVLCString(value as VersionedLocalizedContent<string>, uiLocale)
        if (localized) return localized
        try {
            return JSON.stringify(value)
        } catch {
            return '—'
        }
    }
    return String(value)
}

export const extractResponseMessage = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object' || !('data' in response)) return undefined
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object') return undefined
    const message = (data as { error?: unknown; message?: unknown }).error ?? (data as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
}

export const isLocalizedContent = (value: unknown): value is VersionedLocalizedContent<string> =>
    Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

export const isValidTimeString = (value: string) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?$/.test(value)

export const isValidDateString = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00`)
    return !Number.isNaN(date.getTime())
}

export const isValidDateTimeString = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value)) return false
    const date = new Date(value)
    return !Number.isNaN(date.getTime())
}
