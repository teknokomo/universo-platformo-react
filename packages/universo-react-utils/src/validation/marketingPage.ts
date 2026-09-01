import {
    marketingActionSchema,
    marketingLocaleCodeSchema,
    marketingLocalizedTextSchema,
    marketingLocalizedTextValueSchema,
    marketingMediaSchema,
    marketingPageConfigSchema,
    marketingPageDataSchema,
    type MarketingAction,
    type MarketingMedia,
    type MarketingPageConfig,
    type MarketingPageData,
    type MarketingLocalizedText
} from '@universo-react/types'

import { sanitizeMenuHref } from './menuHref'

type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord | undefined =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : undefined

const normalizeLocale = (value: string): string => {
    const normalized = value.trim().replace(/_/g, '-').toLowerCase()
    if (!marketingLocaleCodeSchema.safeParse(normalized).success) {
        throw new Error('Marketing locale code is invalid.')
    }
    return normalized
}

const parseLocalizedTextValue = (value: unknown): string => {
    const parsed = marketingLocalizedTextValueSchema.safeParse(value)
    if (!parsed.success) {
        throw new Error('Marketing localized text is invalid.')
    }
    return parsed.data
}

/**
 * Normalize a plain string, a locale map, or the canonical VersionedLocalizedContent
 * shape into the small locale map used by the runtime read model.
 */
export function normalizeMarketingLocalizedText(value: unknown): MarketingLocalizedText {
    if (typeof value === 'string') {
        return { en: parseLocalizedTextValue(value) }
    }

    const record = asRecord(value)
    if (!record) {
        throw new Error('Marketing localized text must be a string or locale map.')
    }

    const source = asRecord(record.locales) ?? record
    const normalized: Record<string, string> = {}
    const normalizedBases = new Set<string>()

    for (const [rawLocale, rawEntry] of Object.entries(source)) {
        const locale = normalizeLocale(rawLocale)
        const baseLocale = locale.split('-')[0]
        if (Object.prototype.hasOwnProperty.call(normalized, locale) || normalizedBases.has(baseLocale)) {
            throw new Error('Marketing localized text contains duplicate locale keys.')
        }
        normalizedBases.add(baseLocale)

        const entry = asRecord(rawEntry)
        const content = entry && Object.prototype.hasOwnProperty.call(entry, 'content') ? entry.content : rawEntry
        normalized[locale] = parseLocalizedTextValue(content)
    }

    const parsed = marketingLocalizedTextSchema.safeParse(normalized)
    if (!parsed.success) {
        throw new Error('Marketing localized text must contain at least one valid locale.')
    }
    return parsed.data
}

/** Resolve the selected locale, its language base, and the configured fallbacks. */
export function resolveMarketingLocalizedText(
    value: unknown,
    locale = 'en',
    fallbackLocales: readonly string[] = ['en', 'ru']
): string | undefined {
    let normalized: MarketingLocalizedText
    try {
        normalized = normalizeMarketingLocalizedText(value)
    } catch {
        return undefined
    }

    const candidates = [locale, ...fallbackLocales]
        .map((candidate) => {
            try {
                return normalizeLocale(candidate)
            } catch {
                return undefined
            }
        })
        .filter((candidate): candidate is string => Boolean(candidate))

    for (const candidate of candidates) {
        const exact = normalized[candidate]
        if (exact) return exact

        const baseLocale = candidate.split('-')[0]
        const base = normalized[baseLocale]
        if (base) return base
    }

    return Object.values(normalized)[0]
}

/** Parse and normalize an action at the write/render boundary. */
export function normalizeMarketingAction(value: unknown): MarketingAction {
    const parsed = marketingActionSchema.safeParse(value)
    if (!parsed.success) {
        const candidate = asRecord(value)
        if (candidate?.kind === 'internal' && candidate.path === '#') {
            throw new Error('Marketing internal actions must use a non-placeholder application path.')
        }
        throw new Error('Marketing action is invalid.')
    }

    if (parsed.data.kind !== 'internal') {
        return parsed.data
    }

    // Reuse the platform menu policy, then apply the stricter marketing rule
    // that forbids placeholder links and protocol-relative paths.
    const safePath = sanitizeMenuHref(parsed.data.path)
    if (!safePath || !safePath.startsWith('/') || safePath.startsWith('//') || safePath === '#') {
        throw new Error('Marketing internal actions must use a non-placeholder application path.')
    }

    return { ...parsed.data, path: safePath }
}

/**
 * Parse a persisted href into the canonical marketing action union.
 *
 * Runtime data may still contain a single href string, but consumers should
 * not each implement their own protocol and query-string allowlist. Keep the
 * conversion at this boundary so the same schema and internal-path policy
 * are applied by API controllers and browser renderers.
 */
export function parseMarketingActionHref(
    value: unknown,
    options: { externalTarget?: 'same-tab' | 'new-tab' } = {}
): MarketingAction | null {
    if (typeof value !== 'string') return null

    const href = value.trim()
    if (!href) return null

    let candidate:
        | { kind: 'anchor'; href: string }
        | { kind: 'internal'; path: string; target: 'same-tab' }
        | { kind: 'email'; address: string; subject?: string }
        | { kind: 'tel'; number: string }
        | { kind: 'external'; url: string; target: 'new-tab' }

    if (href.startsWith('#')) {
        candidate = { kind: 'anchor', href }
    } else if (href.startsWith('/') && !href.startsWith('//')) {
        candidate = { kind: 'internal', path: href, target: 'same-tab' }
    } else if (/^mailto:/i.test(href)) {
        const mailtoPayload = href.slice('mailto:'.length)
        const separatorIndex = mailtoPayload.indexOf('?')
        const address = separatorIndex === -1 ? mailtoPayload : mailtoPayload.slice(0, separatorIndex)
        const query = separatorIndex === -1 ? '' : mailtoPayload.slice(separatorIndex + 1)
        let subject: string | undefined

        if (query) {
            try {
                const params = new URLSearchParams(query)
                for (const key of params.keys()) {
                    if (key !== 'subject') return null
                }
                const subjectValue = params.get('subject')
                if (subjectValue) subject = subjectValue
            } catch {
                return null
            }
        }

        candidate = { kind: 'email', address, ...(subject ? { subject } : {}) }
    } else if (/^tel:/i.test(href)) {
        candidate = { kind: 'tel', number: href.slice('tel:'.length) }
    } else {
        candidate = { kind: 'external', url: href, target: options.externalTarget ?? 'new-tab' }
    }

    try {
        return normalizeMarketingAction(candidate)
    } catch {
        return null
    }
}

/** Convert a typed action to the only href forms the renderer is allowed to emit. */
export function toMarketingActionHref(value: MarketingAction): string {
    const action = normalizeMarketingAction(value)

    switch (action.kind) {
        case 'internal':
            return action.path
        case 'external':
            return action.url
        case 'anchor':
            return action.href
        case 'email':
            return `mailto:${action.address}${action.subject ? `?subject=${encodeURIComponent(action.subject)}` : ''}`
        case 'tel':
            return `tel:${action.number.replace(/[()\s-]/g, '')}`
    }
}

export type MarketingActionLinkAttributes = {
    href: string
    target?: '_blank'
    rel?: 'noopener noreferrer'
}

/** Return safe anchor attributes, including the mandatory external-link policy. */
export function toMarketingActionLinkAttributes(value: MarketingAction): MarketingActionLinkAttributes {
    const action = normalizeMarketingAction(value)
    const href = toMarketingActionHref(action)

    if (action.kind === 'external' && action.target === 'new-tab') {
        return { href, target: '_blank', rel: 'noopener noreferrer' }
    }

    return { href }
}

export function normalizeMarketingMedia(value: unknown): MarketingMedia {
    const parsed = marketingMediaSchema.safeParse(value)
    if (!parsed.success) {
        throw new Error('Marketing media metadata is invalid.')
    }
    return parsed.data
}

export function normalizeMarketingPageConfig(value: unknown): MarketingPageConfig {
    const parsed = marketingPageConfigSchema.safeParse(value)
    if (!parsed.success) {
        throw new Error('Marketing page configuration is invalid.')
    }
    return parsed.data
}

/** Validate a complete transport payload without allowing a dashboard fallback. */
export function normalizeMarketingPageData(value: unknown): MarketingPageData {
    const parsed = marketingPageDataSchema.safeParse(value)
    if (!parsed.success) {
        throw new Error('Marketing page runtime data is invalid.')
    }
    return parsed.data
}
