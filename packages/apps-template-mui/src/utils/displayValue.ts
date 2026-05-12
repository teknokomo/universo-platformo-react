import { getVLCString } from '@universo/utils'

const DISPLAY_KEYS = ['label', 'name', 'title', 'displayName', 'codename', 'id'] as const

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isLocalizedValue = (value: object): boolean => {
    if ('locales' in value && isPlainObject((value as Record<string, unknown>).locales)) return true
    return ('en' in value || 'ru' in value) && !DISPLAY_KEYS.some((key) => key in value)
}

const stringifyJson = (value: unknown): string => {
    try {
        return JSON.stringify(value)
    } catch {
        return ''
    }
}

const readDisplayKey = (value: Record<string, unknown>, locale: string, seen: WeakSet<object>): string => {
    for (const key of DISPLAY_KEYS) {
        if (!(key in value)) continue
        const displayValue = formatRuntimeValue(value[key], locale, seen)
        if (displayValue) return displayValue
    }
    return ''
}

export function formatRuntimeValue(value: unknown, locale = 'en', seen = new WeakSet<object>()): string {
    if (value === null || value === undefined) return ''

    if (typeof value === 'string') return value
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
        return labels.length > 0 ? labels.join(', ') : stringifyJson(value)
    }

    if (value instanceof Date) return value.toISOString()

    const keyedValue = isPlainObject(value) ? readDisplayKey(value, locale, seen) : ''
    if (keyedValue) return keyedValue

    return stringifyJson(value)
}
