import { resolveTrustedServerOwnedSeedValue } from '../../services/trustedSeedValues'

describe('trusted server-owned seed value resolution', () => {
    it('preserves an explicit trusted seed value over a metadata default', () => {
        expect(
            resolveTrustedServerOwnedSeedValue({
                hasTrustedValue: true,
                trustedValue: 'content',
                hasMetadataDefault: true,
                metadataDefault: 'quiz',
                resetOnCopy: false
            })
        ).toEqual({ hasValue: true, value: 'content' })
    })

    it('uses a metadata default when the trusted seed omits the field', () => {
        expect(
            resolveTrustedServerOwnedSeedValue({
                hasTrustedValue: false,
                trustedValue: undefined,
                hasMetadataDefault: true,
                metadataDefault: 'quiz',
                resetOnCopy: false
            })
        ).toEqual({ hasValue: true, value: 'quiz' })
    })

    it('resets a server-owned copy field to its default even when the source has a value', () => {
        expect(
            resolveTrustedServerOwnedSeedValue({
                hasTrustedValue: true,
                trustedValue: 99,
                hasMetadataDefault: true,
                metadataDefault: 0,
                resetOnCopy: true
            })
        ).toEqual({ hasValue: true, value: 0 })
    })

    it('keeps an explicit null and leaves an absent optional field to the database default', () => {
        expect(
            resolveTrustedServerOwnedSeedValue({
                hasTrustedValue: true,
                trustedValue: null,
                hasMetadataDefault: true,
                metadataDefault: 'quiz',
                resetOnCopy: false
            })
        ).toEqual({ hasValue: true, value: null })
        expect(
            resolveTrustedServerOwnedSeedValue({
                hasTrustedValue: false,
                trustedValue: undefined,
                hasMetadataDefault: false,
                metadataDefault: undefined,
                resetOnCopy: false
            })
        ).toEqual({ hasValue: false })
    })
})
