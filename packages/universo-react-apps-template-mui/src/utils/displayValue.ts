import { getVLCString } from '@universo-react/utils'

const DISPLAY_KEYS = ['label', 'name', 'title', 'displayName'] as const
const UUID_SUBSTRING_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
const RAW_RUNTIME_JSON_PATTERN =
    /\{[\s\S]{0,700}"(?:type|url|source|blocks|data|_schema|storageKey|mimeType|launchMode|packageDescriptor|recordId|targetId)"\s*:[\s\S]{0,700}\}|\[[\s\S]{0,120}\{[\s\S]{0,700}"(?:type|url|source|blocks|data|_schema|storageKey|mimeType|launchMode|packageDescriptor|recordId|targetId)"\s*:[\s\S]{0,700}\}[\s\S]{0,120}\]|\[object Object\]/i
const TECHNICAL_RUNTIME_FIELD_KEYS = new Set([
    'uplversion',
    'createdby',
    'updatedby',
    'deletedby',
    'projectid',
    'owneruserid',
    'userid',
    'assigneduserid',
    'targetrecordid',
    'targetobjectcodename',
    'principalid',
    'sourcejson',
    'resourcejson',
    'storagejson',
    'namemanuallyedited'
])

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isLocalizedValue = (value: object): boolean => {
    if ('locales' in value && isPlainObject((value as Record<string, unknown>).locales)) return true
    return ('en' in value || 'ru' in value) && !DISPLAY_KEYS.some((key) => key in value)
}

const readDisplayKey = (value: Record<string, unknown>, locale: string, seen: WeakSet<object>): string => {
    for (const key of DISPLAY_KEYS) {
        if (!(key in value)) continue
        const displayValue = formatRuntimeValue(value[key], locale, seen)
        if (displayValue) return displayValue
    }
    return ''
}

type RuntimeDisplayColumn = {
    dataType?: string
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
}

type DateComposition = 'date' | 'time' | 'datetime'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

const readRuntimeStringOptionLabel = (column: RuntimeDisplayColumn, value: unknown, locale: string): string | null => {
    if (column.dataType !== 'STRING' || typeof value !== 'string' || value.trim().length === 0) return null

    const rawOptions = column.uiConfig?.stringOptions ?? column.uiConfig?.options
    if (!Array.isArray(rawOptions)) return null

    for (const option of rawOptions) {
        if (typeof option === 'string') {
            if (option === value) return option
            continue
        }
        if (!isPlainObject(option) || option.value !== value) continue

        const localizedLabel = formatRuntimeValue(option.label, locale).trim()
        return localizedLabel || value
    }

    return null
}

export function formatRuntimeColumnValue(column: RuntimeDisplayColumn, value: unknown, locale = 'en'): string {
    const optionLabel = readRuntimeStringOptionLabel(column, value, locale)
    if (optionLabel) return formatRuntimeSafeValue(optionLabel, locale)
    if (column.dataType === 'DATE') {
        return formatRuntimeDateValue(value, locale, getDateComposition(column.validationRules))
    }
    return formatRuntimeSafeValue(value, locale)
}

const getIntlLocale = (locale: string): string => (locale.toLowerCase().startsWith('ru') ? 'ru-RU' : 'en-US')

const getDateComposition = (validationRules?: Record<string, unknown>): DateComposition => {
    const composition = validationRules?.dateComposition
    return composition === 'date' || composition === 'time' || composition === 'datetime' ? composition : 'datetime'
}

const toRuntimeDate = (value: unknown): Date | null => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!ISO_DATE_PATTERN.test(trimmed) && !ISO_DATETIME_PATTERN.test(trimmed)) return null
        const parsed = new Date(trimmed)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    if (typeof value === 'number') {
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    return null
}

export function formatRuntimeDateValue(value: unknown, locale = 'en', composition: DateComposition = 'datetime'): string {
    if (value === null || value === undefined || value === '') return ''

    const resolvedComposition = typeof value === 'string' && ISO_DATE_PATTERN.test(value.trim()) ? 'date' : composition
    const date = toRuntimeDate(value)
    if (!date) return typeof value === 'string' && !hasRuntimeTechnicalValueLeakage(value) ? value.trim() : ''

    const baseOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'UTC'
    }
    const options: Intl.DateTimeFormatOptions =
        resolvedComposition === 'date'
            ? { ...baseOptions, year: 'numeric', month: '2-digit', day: '2-digit' }
            : resolvedComposition === 'time'
            ? { ...baseOptions, hour: '2-digit', minute: '2-digit', hour12: false }
            : {
                  ...baseOptions,
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
              }

    return new Intl.DateTimeFormat(getIntlLocale(locale), options).format(date)
}

export function formatRuntimeValue(value: unknown, locale = 'en', seen = new WeakSet<object>()): string {
    if (value === null || value === undefined) return ''

    if (typeof value === 'string') {
        if (RAW_RUNTIME_JSON_PATTERN.test(value)) return ''
        if (ISO_DATE_PATTERN.test(value.trim()) || ISO_DATETIME_PATTERN.test(value.trim())) return formatRuntimeDateValue(value, locale)
        return value
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)

    if (typeof value !== 'object') return String(value)
    if (seen.has(value)) return ''
    seen.add(value)

    if (isLocalizedValue(value)) {
        const localized = getVLCString(value as never, locale)
        if (localized) return localized
    }

    if (Array.isArray(value)) {
        const labels = value
            .map((item) => formatRuntimeValue(item, locale, seen))
            .map((item) => item.trim())
            .filter(Boolean)
        return labels.length > 0 ? labels.join(', ') : ''
    }

    if (value instanceof Date) return formatRuntimeDateValue(value, locale)

    const keyedValue = isPlainObject(value) ? readDisplayKey(value, locale, seen) : ''
    if (keyedValue) return keyedValue

    return ''
}

export function isRuntimeTechnicalFieldName(value: string | undefined): boolean {
    const raw = value?.trim() ?? ''
    const normalized = raw.replace(/[-_\s]+/g, '').toLowerCase() ?? ''
    if (!normalized) return false
    if (TECHNICAL_RUNTIME_FIELD_KEYS.has(normalized)) return true
    if (normalized.startsWith('upl')) return true
    if (normalized === 'id') return true
    if (/[-_\s]id$/i.test(raw)) return true
    return /(?:Id|ID)$/.test(raw.replace(/[-_\s]+/g, ''))
}

export function hasRuntimeTechnicalValueLeakage(value: string): boolean {
    return UUID_SUBSTRING_PATTERN.test(value) || RAW_RUNTIME_JSON_PATTERN.test(value)
}

export function formatRuntimeSafeValue(value: unknown, locale = 'en'): string {
    const formatted = formatRuntimeValue(value, locale).trim()
    if (!formatted || hasRuntimeTechnicalValueLeakage(formatted)) return ''
    return formatted
}
