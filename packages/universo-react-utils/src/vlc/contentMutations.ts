import type { LocalizedContentEntry, LocaleCode, VersionedLocalizedContent } from '@universo-react/types'
import { DEFAULT_LOCALE } from '@universo-react/types'

/** Create a new localized content object with initial content. */
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

/** Add or update a locale in localized content without mutating the input. */
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
