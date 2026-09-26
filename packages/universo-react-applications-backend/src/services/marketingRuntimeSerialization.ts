import { MARKETING_MAX_RUNTIME_RECORDS, marketingSemanticKeySchema, normalizeMarketingNumericText } from '@universo-react/types'
import { PUBLIC_MARKETING_ROW_LIMIT } from '../persistence/publicApplicationRuntimeStore'
import { resolveLocalizedContent, resolveRuntimeCodenameText } from '../shared/runtimeHelpers'

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

export type MarketingFieldMapOptions<TRecord> = {
    /** Optional allowlist; both the alias and its logical field must pass. */
    isFieldAllowed?: (alias: string, logicalField: string) => boolean
    /** Re-validates one mapped record; returning `null` drops that record only. */
    parseRecord: (record: MarketingSerializableRecord) => TRecord | null
}

/**
 * Applies the widget source `fieldMap` (alias -> persisted field) with
 * per-record degradation: one unusable row is dropped while the rest of the
 * collection survives, and a fully unusable collection returns `null` so the
 * caller can fail closed. Both marketing serializers share this implementation.
 */
export const applyMarketingFieldMap = <TRecord extends object>(
    records: readonly TRecord[],
    fieldMap: Record<string, string>,
    options: MarketingFieldMapOptions<TRecord>
): TRecord[] | null => {
    if (Object.keys(fieldMap).length === 0 || records.length === 0) return [...records]
    const mapped: Array<Record<string, unknown>> = []
    for (const record of records) {
        const source = record as MarketingSerializableRecord
        const next: Record<string, unknown> = { ...source }
        let complete = true
        for (const [alias, field] of Object.entries(fieldMap)) {
            const logicalField = field.length > 0 ? `${field[0].toLowerCase()}${field.slice(1)}` : field
            if (options.isFieldAllowed && !options.isFieldAllowed(alias, logicalField)) {
                complete = false
                break
            }
            const value = source[field] ?? source[logicalField]
            if (value === undefined) {
                complete = false
                break
            }
            next[alias] = value
        }
        if (complete) mapped.push(next)
    }
    if (mapped.length === 0) return null
    const accepted: TRecord[] = []
    for (const record of mapped) {
        const parsed = options.parseRecord(record)
        if (parsed !== null) accepted.push(parsed)
    }
    return accepted.length === 0 ? null : accepted
}

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

/**
 * Child records of a widget must never share the parent list `maxItems` budget.
 * Pricing tiers are bounded by `maxItems`, while their benefits are bounded only
 * by the aggregate marketing record limit and are restricted to the tiers that
 * actually reached the payload. Benefits are matched on either the persisted
 * tier id (`TierRef`) or the semantic tier key (`TierKey`).
 */
export const selectPricingBenefitSemanticKeysForTiers = (
    benefitRows: readonly object[],
    includedTierRows: readonly object[]
): Set<string> => {
    const result = new Set<string>()
    if (benefitRows.length === 0 || includedTierRows.length === 0) return result
    const read = (record: object, key: string): string => asMarketingString((record as MarketingSerializableRecord)[key])
    const tierReferences = new Set<string>()
    for (const tier of includedTierRows) {
        for (const candidate of [read(tier, 'id'), read(tier, 'TierKey')]) {
            if (candidate.length > 0) tierReferences.add(candidate)
        }
    }
    const matchesIncludedTier = (value: unknown): boolean => {
        const candidate = asMarketingString(value)
        return candidate.length > 0 && tierReferences.has(candidate)
    }
    for (const [index, benefit] of benefitRows.entries()) {
        if (result.size >= MARKETING_CHILD_RECORD_LIMIT) break
        if (!matchesIncludedTier(read(benefit, 'TierRef')) && !matchesIncludedTier(read(benefit, 'TierKey'))) continue
        // Both serializers derive the payload semantic key from the row's key
        // component with the same positional fallback, so the mapped records can
        // be selected without exposing persisted identifiers.
        result.add(toMarketingSemanticKey(read(benefit, 'BenefitKey') || read(benefit, 'codename'), `pricing-benefit-${index + 1}`))
    }
    return result
}
