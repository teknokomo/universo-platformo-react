import type { VersionedLocalizedContent } from '@universo/types'
import { createLocalizedContent, filterLocalizedContent } from '@universo/utils'

// Re-export centralized VLC utilities
export { normalizeLocale, getSimpleLocalizedValue, type SimpleLocalizedInput } from '@universo/utils/vlc'

// Import for local use
import { normalizeLocale as normalize } from '@universo/utils/vlc'
import type { SimpleLocalizedInput } from '@universo/utils/vlc'

export const extractLocalizedInput = (value?: VersionedLocalizedContent<string> | null) => {
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
    if (value && typeof value === 'object' && 'locales' in value) {
        return value as VersionedLocalizedContent<string>
    }
    if (typeof value === 'string') {
        return createLocalizedContent(fallbackLocale, value)
    }
    return createLocalizedContent(fallbackLocale, fallbackText)
}
