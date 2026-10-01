import { MARKETING_MAX_RUNTIME_RECORDS, marketingSemanticKeySchema, normalizeMarketingNumericText } from '@universo-react/types'
import { resolveLocalizedContent, resolveRuntimeCodenameText } from '../shared/runtimeHelpers'
import { PUBLIC_MARKETING_ROW_LIMIT } from '../shared/marketingRuntimeLimits'

/**
 * Shared serialization primitives for the marketing runtime surfaces.
 *
 * The anonymous public serializer (`publicMarketingRuntime`) and the
 * authenticated runtime controller (`runtimeMarketingPageController`) render the
 * same persisted rows into the same renderer contract, so every primitive lives
 * here once. Divergence between the two implementations previously caused data
 * loss (pricing benefits clipped by the tier limit) and locale-key drift.
 */

/** Bound for child collections that are not the widget's own item list. */
export const MARKETING_CHILD_RECORD_LIMIT = MARKETING_MAX_RUNTIME_RECORDS

/**
 * Per-object read bound for a single marketing object. The publishing store
 * enforces the same domain limit, so both derive from one constant.
 */
export const MARKETING_COLLECTION_ROW_LIMIT = PUBLIC_MARKETING_ROW_LIMIT

export type MarketingSerializableRecord = Record<string, unknown>

export const asMarketingRecord = (value: unknown): MarketingSerializableRecord =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as MarketingSerializableRecord) : {}

export const asMarketingString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export const asMarketingNumber = (value: unknown, fallback: number): number => {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

export const asMarketingBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

/** Payload locale maps key on the full locale tag (`en-gb`), not the base language. */
export const normalizeMarketingLocaleKey = (locale: string): string => locale.toLowerCase().replace(/_/g, '-')

export const readMarketingLocalizedMap = (value: unknown, fallback: string): Record<string, string> => {
    const record = asMarketingRecord(value)
    const localesValue = record.locales
    const locales =
        localesValue && typeof localesValue === 'object' && !Array.isArray(localesValue)
            ? (localesValue as MarketingSerializableRecord)
            : record
    const result: Record<string, string> = {}
    for (const [locale, entry] of Object.entries(locales)) {
        if (locale.startsWith('_')) continue
        const content = typeof entry === 'string' ? entry.trim() : asMarketingString(asMarketingRecord(entry).content)
        if (content) result[normalizeMarketingLocaleKey(locale)] = content
    }
    if (Object.keys(result).length > 0) return result
    if (typeof value === 'number' && Number.isFinite(value)) return { en: String(value) }
    const direct = asMarketingString(value)
    return { en: direct || fallback }
}

export const toMarketingLocalizedMap = (value: unknown, locale: string, fallback: string): Record<string, string> => {
    const map = readMarketingLocalizedMap(value, fallback)
    const selected = resolveLocalizedContent(value, locale, fallback)
    const normalizedLocale = normalizeMarketingLocaleKey(locale)
    if (!map[normalizedLocale]) map[normalizedLocale] = selected
    return map
}

/** Price maps carry canonical numeric text on every locale, never scaled "1.00". */
export const toMarketingLocalizedNumericMap = (value: unknown, locale: string, fallback: string): Record<string, string> =>
    Object.fromEntries(
        Object.entries(toMarketingLocalizedMap(value, locale, fallback)).map(([key, text]) => [key, normalizeMarketingNumericText(text)])
    )

export const hasMarketingLocalizedContent = (value: unknown): boolean =>
    Object.values(readMarketingLocalizedMap(value, '')).some((content) => content.trim().length > 0)

export const toMarketingLocalizedOptionalMap = (value: unknown, locale: string): Record<string, string> | undefined =>
    hasMarketingLocalizedContent(value) ? toMarketingLocalizedMap(value, locale, '') : undefined

export const toMarketingSemanticKey = (value: unknown, fallback: string): string => {
    const raw = resolveRuntimeCodenameText(value).trim().toLowerCase()
    const normalized = raw.replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z]+/u, '')
    return marketingSemanticKeySchema.safeParse(normalized).success ? normalized : fallback
}
