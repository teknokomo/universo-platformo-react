import { describe, expect, it } from 'vitest'

import { entityRecordPolicySchema, resolveEntityRecordPolicy } from '../common/entityRecordPolicy'

const heroRecordPolicy = {
    version: 1,
    semanticKey: {
        componentCodename: 'HeroKey',
        creationPrefix: 'hero',
        protectedValues: ['default']
    },
    denyDeleteWhenBound: true,
    immutableSemanticKeyWhenBound: true,
    runtimeMutation: 'deny',
    requiredLocales: ['en', 'ru'],
    coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
} as const

describe('Entity record policy', () => {
    it('parses the bounded semantic-key, lifecycle, runtime, locale, and group policy', () => {
        expect(entityRecordPolicySchema.parse(heroRecordPolicy)).toEqual(heroRecordPolicy)
        expect(resolveEntityRecordPolicy({ recordPolicy: heroRecordPolicy })).toEqual(heroRecordPolicy)
    })

    it('returns no policy for ordinary entities and rejects malformed persisted policy', () => {
        expect(resolveEntityRecordPolicy({ marketingRole: 'feature' })).toBeUndefined()
        expect(() => resolveEntityRecordPolicy({ recordPolicy: { ...heroRecordPolicy, unknown: true } })).toThrow()
        expect(() =>
            entityRecordPolicySchema.parse({
                ...heroRecordPolicy,
                semanticKey: { ...heroRecordPolicy.semanticKey, protectedValues: ['default', 'default'] }
            })
        ).toThrow()
    })

    it('rejects key immutability without a semantic key and duplicate locale policies', () => {
        expect(
            entityRecordPolicySchema.safeParse({
                version: 1,
                denyDeleteWhenBound: false,
                immutableSemanticKeyWhenBound: true,
                runtimeMutation: 'allow'
            }).success
        ).toBe(false)
        expect(
            entityRecordPolicySchema.safeParse({
                ...heroRecordPolicy,
                requiredLocales: ['en', 'en']
            }).success
        ).toBe(false)
    })

    it('rejects duplicate or overlapping co-required Component groups and strict legacy validator fields', () => {
        expect(entityRecordPolicySchema.safeParse({ ...heroRecordPolicy, coRequiredGroups: [['Title', 'Title']] }).success).toBe(false)
        expect(
            entityRecordPolicySchema.safeParse({
                ...heroRecordPolicy,
                coRequiredGroups: [
                    ['TermsText', 'TermsLinkLabel'],
                    ['TermsLinkLabel', 'TermsAction']
                ]
            }).success
        ).toBe(false)
        expect(entityRecordPolicySchema.safeParse({ ...heroRecordPolicy, validatorKey: 'marketing.hero.v1' }).success).toBe(false)
    })

    it('accepts bounded conditional requirements and rejects self-referential or duplicate targets', () => {
        const imagePolicy = {
            ...heroRecordPolicy,
            conditionalRequired: [{ componentCodename: 'AltText', when: { componentCodename: 'Decorative', equals: false } }]
        }
        expect(entityRecordPolicySchema.parse(imagePolicy)).toEqual(imagePolicy)
        expect(
            entityRecordPolicySchema.safeParse({
                ...heroRecordPolicy,
                conditionalRequired: [{ componentCodename: 'Decorative', when: { componentCodename: 'Decorative', equals: false } }]
            }).success
        ).toBe(false)
        expect(
            entityRecordPolicySchema.safeParse({
                ...heroRecordPolicy,
                conditionalRequired: [
                    { componentCodename: 'AltText', when: { componentCodename: 'Decorative', equals: false } },
                    { componentCodename: 'AltText', when: { componentCodename: 'Visible', equals: true } }
                ]
            }).success
        ).toBe(false)
    })
})
