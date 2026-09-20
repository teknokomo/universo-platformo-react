import {
    applyMarketingFieldMap,
    normalizeMarketingLocaleKey,
    readMarketingLocalizedMap,
    selectPricingBenefitSemanticKeysForTiers,
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

    it('applies field maps per record and degrades unusable rows without blanking the collection', () => {
        const records = [
            { id: 'row-1', Title: 'First', Description: 'Body' },
            { id: 'row-2', Title: 'Second' },
            { id: 'row-3', Description: 'Only body' }
        ]
        const parse = (record: Record<string, unknown>) =>
            typeof record.Heading === 'string' && record.Heading.length > 0 ? (record as { Heading: string }) : null
        const mapped = applyMarketingFieldMap(records, { Heading: 'Title' }, { parseRecord: parse })
        expect(mapped).toEqual([
            { id: 'row-1', Title: 'First', Description: 'Body', Heading: 'First' },
            { id: 'row-2', Title: 'Second', Heading: 'Second' }
        ])
        expect(
            applyMarketingFieldMap(records, { Heading: 'Title' }, { isFieldAllowed: (alias) => alias === 'Lead', parseRecord: parse })
        ).toBeNull()
        expect(applyMarketingFieldMap([{ id: 'row-1' }], { Heading: 'Title' }, { parseRecord: parse })).toBeNull()
        const parseSpy = jest.fn(parse)
        const untouched = applyMarketingFieldMap(records, {}, { parseRecord: parseSpy })
        expect(untouched).toEqual(records)
        expect(untouched).not.toBe(records)
        expect(parseSpy).not.toHaveBeenCalled()
        expect(applyMarketingFieldMap([], { Heading: 'Title' }, { parseRecord: parse })).toEqual([])
    })

    it('enforces the optional allowlist for both alias and logical field', () => {
        const records = [{ id: 'row-1', Title: 'First' }]
        const allow = (alias: string, logicalField: string) => alias === 'Heading' && logicalField === 'title'
        expect(applyMarketingFieldMap(records, { Heading: 'Title' }, { isFieldAllowed: allow, parseRecord: (r) => r })).toEqual([
            { id: 'row-1', Title: 'First', Heading: 'First' }
        ])
        expect(applyMarketingFieldMap(records, { Heading: 'Secret' }, { isFieldAllowed: allow, parseRecord: (r) => r })).toBeNull()
        const aliasOnly = (alias: string) => alias === 'Heading'
        expect(applyMarketingFieldMap(records, { Heading: 'Body' }, { isFieldAllowed: aliasOnly, parseRecord: (r) => r })).toBeNull()
    })

    it('selects benefits of included tiers by persisted id or semantic key', () => {
        const tiers = [
            { id: 'tier-1', TierKey: 'pre-seed' },
            { id: 'tier-2', TierKey: 'seed' }
        ]
        const benefits = [
            { id: 'benefit-1', BenefitKey: 'pre-seed-1', TierRef: 'tier-1' },
            { id: 'benefit-2', BenefitKey: 'pre-seed-2', TierRef: 'pre-seed' },
            { id: 'benefit-3', BenefitKey: 'seed-1', TierRef: 'tier-2' },
            { id: 'benefit-4', BenefitKey: 'growth-1', TierRef: 'tier-3' }
        ]

        const keys = selectPricingBenefitSemanticKeysForTiers(benefits, tiers)
        expect([...keys].sort()).toEqual(['pre-seed-1', 'pre-seed-2', 'seed-1'])
        expect(selectPricingBenefitSemanticKeysForTiers(benefits, [])).toEqual(new Set())
    })
})
