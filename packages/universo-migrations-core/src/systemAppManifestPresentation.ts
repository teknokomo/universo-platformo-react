import type { MetaPresentation, VersionedLocalizedContent } from '@universo/types'

const MANIFEST_BASELINE_TIMESTAMP = '1970-01-01T00:00:00.000Z'

export const createSystemAppManifestLocalizedContent = (content: string): VersionedLocalizedContent<string> => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: MANIFEST_BASELINE_TIMESTAMP,
            updatedAt: MANIFEST_BASELINE_TIMESTAMP
        }
    }
})

export const createSystemAppManifestPresentation = (name: string, description?: string): MetaPresentation => ({
    name: createSystemAppManifestLocalizedContent(name),
    ...(description ? { description: createSystemAppManifestLocalizedContent(description) } : {})
})
