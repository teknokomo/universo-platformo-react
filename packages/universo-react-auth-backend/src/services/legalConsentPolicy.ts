const MAX_DOCUMENT_VERSION_LENGTH = 50
const INVALID_CONFIGURATION_MESSAGE =
    'LEGAL_TERMS_VERSION and LEGAL_PRIVACY_VERSION must be non-empty versions of at most 50 characters without surrounding whitespace or control characters'

export interface LegalConsentDocumentVersions {
    termsVersion: string
    privacyVersion: string
}

interface LegalConsentEnvironment {
    LEGAL_TERMS_VERSION?: string
    LEGAL_PRIVACY_VERSION?: string
}

const hasControlCharacters = (value: string): boolean => {
    for (const character of value) {
        const codePoint = character.codePointAt(0)
        if (codePoint !== undefined && (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))) {
            return true
        }
    }

    return false
}

const readVersion = (value: string | undefined): string => {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.trim() !== value ||
        [...value].length > MAX_DOCUMENT_VERSION_LENGTH ||
        hasControlCharacters(value)
    ) {
        throw new Error(INVALID_CONFIGURATION_MESSAGE)
    }

    return value
}

/**
 * Resolve the platform legal document versions recorded by registration and guest consent flows.
 * Values are returned exactly as configured; invalid configuration fails closed without exposing its values.
 */
export const getLegalConsentDocumentVersions = (environment: LegalConsentEnvironment = process.env): LegalConsentDocumentVersions => ({
    termsVersion: readVersion(environment.LEGAL_TERMS_VERSION),
    privacyVersion: readVersion(environment.LEGAL_PRIVACY_VERSION)
})
