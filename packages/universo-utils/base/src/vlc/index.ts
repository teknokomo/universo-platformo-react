import type { VersionedLocalizedContent, LocalizedContentEntry, LocaleCode } from '@universo/types'
import { DEFAULT_LOCALE } from '@universo/types'

/**
 * Create a new localized content object with initial content
 */
export function createLocalizedContent<T = string>(
    primaryLocale: LocaleCode = DEFAULT_LOCALE,
    initialContent: T
): VersionedLocalizedContent<T> {
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
 * Add or update a locale in localized content
 * Returns a new object (immutable)
 */
export function updateLocalizedContentLocale<T = string>(
    content: VersionedLocalizedContent<T>,
    locale: LocaleCode,
    newContent: T
): VersionedLocalizedContent<T> {
    const now = new Date().toISOString()
    const existing = content.locales[locale]

    const entry: LocalizedContentEntry<T> = existing
        ? {
              ...existing,
              content: newContent,
              version: existing.version + 1,
              updatedAt: now
          }
        : {
              content: newContent,
              version: 1,
              isActive: true,
              createdAt: now,
              updatedAt: now
          }

    return {
        ...content,
        locales: {
            ...content.locales,
            [locale]: entry
        }
    }
}

/**
 * Resolve content from localized content for a given locale with fallback chain
 *
 * @param content - The localized content object
 * @param locale - Requested locale
 * @param fallback - Fallback value if nothing found (guarantees return type)
 * @returns Resolved content (guaranteed when fallback provided)
 */
export function resolveLocalizedContent<T = string>(
    content: VersionedLocalizedContent<T> | null | undefined,
    locale: LocaleCode,
    fallback: T
): T

/**
 * Resolve content from localized content for a given locale with fallback chain
 *
 * @param content - The localized content object
 * @param locale - Requested locale
 * @returns Resolved content or undefined
 */
export function resolveLocalizedContent<T = string>(
    content: VersionedLocalizedContent<T> | null | undefined,
    locale: LocaleCode
): T | undefined

// Implementation
export function resolveLocalizedContent<T = string>(
    content: VersionedLocalizedContent<T> | null | undefined,
    locale: LocaleCode,
    fallback?: T
): T | undefined {
    if (!content || !content.locales) {
        return fallback
    }

    // 1. Try requested locale
    const requested = content.locales[locale]
    if (requested?.isActive && requested.content !== undefined) {
        return requested.content
    }

    // 2. Try primary locale
    const primary = content.locales[content._primary]
    if (primary?.isActive && primary.content !== undefined) {
        return primary.content
    }

    // 3. Try any active locale
    for (const entry of Object.values(content.locales)) {
        if (entry?.isActive && entry.content !== undefined) {
            return entry.content
        }
    }

    return fallback
}

/**
 * Get list of available locales in localized content
 */
export function getLocalizedContentLocales<T = string>(content: VersionedLocalizedContent<T> | null | undefined): LocaleCode[] {
    if (!content?.locales) return []
    return Object.keys(content.locales).filter((k) => content.locales[k]?.isActive)
}

/**
 * Type guard to check if object is localized content format
 */
export function isLocalizedContent(obj: unknown): obj is VersionedLocalizedContent<unknown> {
    return typeof obj === 'object' && obj !== null && '_schema' in obj && (obj as Record<string, unknown>)._schema === '1'
}
