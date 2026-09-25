import type { Response as PlaywrightResponse } from '@playwright/test'

export const readLocalizedText = (value: unknown, locale = 'en'): string | undefined => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return undefined

    const raw = value as {
        _primary?: unknown
        locales?: Record<string, { content?: unknown }>
        [locale: string]: unknown
    }
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const directRecordValue = raw[normalizedLocale]
    if (typeof directRecordValue === 'string' && directRecordValue.length > 0) return directRecordValue

    const directValue = raw.locales?.[normalizedLocale]?.content
    if (typeof directValue === 'string' && directValue.length > 0) return directValue

    const primaryLocale = typeof raw._primary === 'string' ? raw._primary : undefined
    const primaryValue = primaryLocale ? raw.locales?.[primaryLocale]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) return primaryValue

    const fallbackValue = Object.values(raw.locales ?? {}).find(
        (entry) => typeof entry?.content === 'string' && entry.content.length > 0
    )?.content
    if (typeof fallbackValue === 'string') return fallbackValue

    const fallbackRecordValue = Object.entries(raw).find(
        ([key, entry]) => key !== '_primary' && key !== 'locales' && typeof entry === 'string' && entry.length > 0
    )?.[1]
    return typeof fallbackRecordValue === 'string' ? fallbackRecordValue : undefined
}

export async function parseJsonResponse<T>(response: PlaywrightResponse, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}
