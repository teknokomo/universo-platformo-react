import type { VersionedLocalizedContent } from '@universo/types'
import { createLocalizedContent, filterLocalizedContent, updateLocalizedContentLocale } from '@universo/utils'

// Re-export centralized VLC utilities
export { normalizeLocale, getSimpleLocalizedValue, type SimpleLocalizedInput } from '@universo/utils/vlc'
import { normalizeLocale as normalizeLocaleCode } from '@universo/utils/vlc'

import type { SimpleLocalizedInput } from '@universo/utils/vlc'

export const extractLocalizedInput = (value?: VersionedLocalizedContent<string> | null) => {
    // Compatibility with legacy plain object payloads: { en: '...', ru: '...' }
    if (value && typeof value === 'object' && !('locales' in value)) {
        const input: SimpleLocalizedInput = {}
        for (const [locale, content] of Object.entries(value as Record<string, unknown>)) {
            if (typeof content === 'string' && content.trim() !== '') {
                input[locale] = content.trim()
            }
        }
        if (Object.keys(input).length > 0) {
            return { input, primaryLocale: undefined }
        }
    }

    const filtered = filterLocalizedContent(value)
    if (!filtered) return { input: undefined, primaryLocale: undefined }
    const input: SimpleLocalizedInput = {}
    for (const [locale, entry] of Object.entries(filtered.locales)) {
        if (typeof entry?.content === 'string' && entry.content.trim() !== '') {
            input[locale] = entry.content.trim()
        }
    }
    if (Object.keys(input).length === 0) {
        return { input: undefined, primaryLocale: undefined }
    }
    return { input, primaryLocale: filtered._primary }
}

export const hasPrimaryContent = (value?: VersionedLocalizedContent<string> | null) => {
    const filtered = filterLocalizedContent(value)
    if (!filtered) return false
    const primaryEntry = filtered.locales[filtered._primary]
    return typeof primaryEntry?.content === 'string' && primaryEntry.content.trim() !== ''
}

export const ensureLocalizedContent = (
    value: VersionedLocalizedContent<string> | string | null | undefined,
    fallbackLocale: string,
    fallbackText: string
): VersionedLocalizedContent<string> => {
    const normalizedFallbackLocale = normalizeLocaleCode(fallbackLocale)

    if (value && typeof value === 'object' && 'locales' in value) {
        return value as VersionedLocalizedContent<string>
    }

    if (value && typeof value === 'object') {
        const localizedEntries = Object.entries(value as Record<string, unknown>)
            .filter(([, content]) => typeof content === 'string' && content.trim() !== '')
            .map(([locale, content]) => [normalizeLocaleCode(locale), (content as string).trim()] as const)

        if (localizedEntries.length > 0) {
            const localizedMap = new Map(localizedEntries)
            const primaryLocale = localizedMap.has(normalizedFallbackLocale) ? normalizedFallbackLocale : Array.from(localizedMap.keys())[0]

            let localizedContent = createLocalizedContent(primaryLocale, localizedMap.get(primaryLocale) ?? '')
            for (const [locale, content] of localizedMap.entries()) {
                if (locale === primaryLocale) continue
                localizedContent = updateLocalizedContentLocale(localizedContent, locale, content)
            }

            return localizedContent
        }
    }

    if (typeof value === 'string') {
        return createLocalizedContent(normalizedFallbackLocale, value)
    }

    return createLocalizedContent(normalizedFallbackLocale, fallbackText)
}

export const ensureEntityCodenameContent = (
    value:
        | {
              codename?: VersionedLocalizedContent<string> | string | null
          }
        | null
        | undefined,
    fallbackLocale: string,
    fallbackText: string
): VersionedLocalizedContent<string> => {
    const canonicalCodename = value?.codename
    const hasCanonicalLocales =
        canonicalCodename && typeof canonicalCodename === 'object' && 'locales' in canonicalCodename && canonicalCodename.locales

    if (hasCanonicalLocales) {
        return ensureLocalizedContent(canonicalCodename, fallbackLocale, fallbackText)
    }

    return ensureLocalizedContent(canonicalCodename ?? null, fallbackLocale, fallbackText)
}

export const getLocalizedContentText = (
    value: VersionedLocalizedContent<string> | string | null | undefined,
    locale: string,
    fallback = ''
): string => {
    if (typeof value === 'string') {
        return value
    }

    const filtered = filterLocalizedContent(value)
    if (!filtered) {
        return fallback
    }

    const normalizedLocale = normalizeLocaleCode(locale)
    const preferred = filtered.locales[normalizedLocale]?.content
    if (typeof preferred === 'string' && preferred.trim() !== '') {
        return preferred
    }

    const primary = filtered.locales[filtered._primary]?.content
    if (typeof primary === 'string' && primary.trim() !== '') {
        return primary
    }

    for (const entry of Object.values(filtered.locales)) {
        if (typeof entry?.content === 'string' && entry.content.trim() !== '') {
            return entry.content
        }
    }

    return fallback
}
