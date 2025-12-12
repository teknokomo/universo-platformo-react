import type { VersionedLocalizedContent, VlcLocaleEntry, SupportedLocale } from '@universo/types'

/**
 * Create a new VLC object with initial content
 */
export function createVlc<T = string>(primaryLocale: SupportedLocale, initialContent: T): VersionedLocalizedContent<T> {
    const now = new Date().toISOString()
    return {
        _schema: '1',
        _primary: primaryLocale,
        locales: {
            [primaryLocale]: {
                content: initialContent,
                version: 1,
                isActive: true,
                createdAt: now,
                updatedAt: now
            }
        }
    }
}

/**
 * Add or update a locale in VLC
 * Returns a new VLC object (immutable)
 */
export function updateVlcLocale<T = string>(
    vlc: VersionedLocalizedContent<T>,
    locale: SupportedLocale,
    content: T
): VersionedLocalizedContent<T> {
    const now = new Date().toISOString()
    const existing = vlc.locales[locale]

    const entry: VlcLocaleEntry<T> = existing
        ? {
              ...existing,
              content,
              version: existing.version + 1,
              updatedAt: now
          }
        : {
              content,
              version: 1,
              isActive: true,
              createdAt: now,
              updatedAt: now
          }

    return {
        ...vlc,
        locales: {
            ...vlc.locales,
            [locale]: entry
        }
    }
}

/**
 * Resolve content from VLC for a given locale with fallback chain
 *
 * @param vlc - The VLC object
 * @param locale - Requested locale
 * @param fallback - Fallback value if nothing found (guarantees return type)
 * @returns Resolved content (guaranteed when fallback provided)
 */
export function resolveVlcContent<T = string>(
    vlc: VersionedLocalizedContent<T> | null | undefined,
    locale: SupportedLocale,
    fallback: T
): T

/**
 * Resolve content from VLC for a given locale with fallback chain
 *
 * @param vlc - The VLC object
 * @param locale - Requested locale
 * @returns Resolved content or undefined
 */
export function resolveVlcContent<T = string>(
    vlc: VersionedLocalizedContent<T> | null | undefined,
    locale: SupportedLocale
): T | undefined

// Implementation
export function resolveVlcContent<T = string>(
    vlc: VersionedLocalizedContent<T> | null | undefined,
    locale: SupportedLocale,
    fallback?: T
): T | undefined {
    if (!vlc || !vlc.locales) {
        return fallback
    }

    // 1. Try requested locale
    const requested = vlc.locales[locale]
    if (requested?.isActive && requested.content !== undefined) {
        return requested.content
    }

    // 2. Try primary locale
    const primary = vlc.locales[vlc._primary]
    if (primary?.isActive && primary.content !== undefined) {
        return primary.content
    }

    // 3. Try any active locale
    for (const entry of Object.values(vlc.locales)) {
        if (entry?.isActive && entry.content !== undefined) {
            return entry.content
        }
    }

    return fallback
}

/**
 * Get list of available locales in VLC
 */
export function getVlcLocales<T = string>(vlc: VersionedLocalizedContent<T> | null | undefined): SupportedLocale[] {
    if (!vlc?.locales) return []
    return Object.keys(vlc.locales).filter((k) => vlc.locales[k as SupportedLocale]?.isActive) as SupportedLocale[]
}

/**
 * Type guard to check if object is VLC format
 */
export function isVlc(obj: unknown): obj is VersionedLocalizedContent<unknown> {
    return typeof obj === 'object' && obj !== null && '_schema' in obj && (obj as Record<string, unknown>)._schema === '1'
}
