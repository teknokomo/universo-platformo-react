import {
    buildCodenameAttempt,
    CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT,
    CODENAME_RETRY_MAX_ATTEMPTS
} from '../../domains/shared/codenameStyleHelper'

describe('codenameStyleHelper', () => {
    it('returns base codename for first attempt', () => {
        expect(buildCodenameAttempt('ProductCode', 1, 'pascal-case')).toBe('ProductCode')
        expect(buildCodenameAttempt('product-code', 1, 'kebab-case')).toBe('product-code')
    })

    it('adds kebab separator for retry attempts', () => {
        expect(buildCodenameAttempt('product-code', 2, 'kebab-case')).toBe('product-code-2')
    })

    it('adds numeric suffix for pascal retry attempts', () => {
        expect(buildCodenameAttempt('ProductCode', 2, 'pascal-case')).toBe('ProductCode2')
    })

    it('keeps kebab attempts within max length and without trailing hyphen artifacts', () => {
        const base = `${'a'.repeat(99)}-`
        const candidate = buildCodenameAttempt(base, 12, 'kebab-case')

        expect(candidate.length).toBeLessThanOrEqual(100)
        expect(candidate.endsWith('-12')).toBe(true)
        expect(candidate.includes('--')).toBe(false)
    })

    it('keeps pascal attempts within max length', () => {
        const candidate = buildCodenameAttempt('A'.repeat(80), 999, 'pascal-case')
        expect(candidate.length).toBe(80)
        expect(candidate.endsWith('999')).toBe(true)
    })

    it('exports shared retry constants used by copy/rename flows', () => {
        expect(CODENAME_RETRY_MAX_ATTEMPTS).toBe(1000)
        expect(CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT).toBe(5)
    })
})
