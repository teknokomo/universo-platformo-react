import {
    normalizeMarketingLocaleKey,
    readMarketingLocalizedMap,
    toMarketingLocalizedNumericMap,
    toMarketingSemanticKey
} from '../../services/marketingRuntimeSerialization'

describe('marketingRuntimeSerialization', () => {
    it('keeps the full locale tag when reading localized maps and ignores null locales', () => {
        expect(readMarketingLocalizedMap({ locales: null }, 'fallback')).toEqual({ en: 'fallback' })
        expect(readMarketingLocalizedMap({ locales: { 'en-gb': { content: 'Colour' }, _schema: '1' } }, 'fallback')).toEqual({
            'en-gb': 'Colour'
        })
        expect(normalizeMarketingLocaleKey('RU_ru')).toBe('ru-ru')
    })

    it('canonicalizes numeric price maps per locale', () => {
        expect(toMarketingLocalizedNumericMap(1, 'en', '')).toEqual({ en: '1' })
        expect(toMarketingLocalizedNumericMap({ locales: { en: { content: '15.50' }, ru: { content: '150,25' } } }, 'en', '')).toEqual({
            en: '15.5',
            ru: '150.25'
        })
    })

    it('derives renderer semantic keys with the positional fallback', () => {
        expect(toMarketingSemanticKey('Pre-Seed Benefit 1', 'pricing-benefit-1')).toBe('pre-seed-benefit-1')
        expect(toMarketingSemanticKey('__bad__', 'pricing-benefit-2')).toBe('pricing-benefit-2')
    })
})
