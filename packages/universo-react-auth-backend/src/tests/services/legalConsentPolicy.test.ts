import { getLegalConsentDocumentVersions } from '../../services/legalConsentPolicy'

describe('getLegalConsentDocumentVersions', () => {
    const validEnvironment = {
        LEGAL_TERMS_VERSION: 'terms-2026.10',
        LEGAL_PRIVACY_VERSION: 'privacy-2026.10'
    }

    it('returns the exact configured versions', () => {
        const result = getLegalConsentDocumentVersions({
            LEGAL_TERMS_VERSION: 'terms 2026.10',
            LEGAL_PRIVACY_VERSION: 'privacy 2026.10'
        })

        expect(result).toEqual({ termsVersion: 'terms 2026.10', privacyVersion: 'privacy 2026.10' })
    })

    it.each([
        ['missing Terms version', { ...validEnvironment, LEGAL_TERMS_VERSION: undefined }],
        ['missing Privacy version', { ...validEnvironment, LEGAL_PRIVACY_VERSION: undefined }],
        ['empty Terms version', { ...validEnvironment, LEGAL_TERMS_VERSION: '' }],
        ['whitespace-only Privacy version', { ...validEnvironment, LEGAL_PRIVACY_VERSION: '   ' }],
        ['surrounding whitespace', { ...validEnvironment, LEGAL_TERMS_VERSION: ' terms-2026.10 ' }],
        ['version longer than the persisted column', { ...validEnvironment, LEGAL_PRIVACY_VERSION: 'p'.repeat(51) }],
        ['control character', { ...validEnvironment, LEGAL_TERMS_VERSION: 'terms\n2026.10' }]
    ])('rejects %s', (_case, environment) => {
        expect(() => getLegalConsentDocumentVersions(environment)).toThrow(
            'LEGAL_TERMS_VERSION and LEGAL_PRIVACY_VERSION must be non-empty versions of at most 50 characters'
        )
    })

    it('accepts a 50-character version', () => {
        const termsVersion = 't'.repeat(50)

        expect(getLegalConsentDocumentVersions({ ...validEnvironment, LEGAL_TERMS_VERSION: termsVersion }).termsVersion).toBe(termsVersion)
    })
})
