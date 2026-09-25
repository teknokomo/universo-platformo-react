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
    validatorKey: 'marketing.hero.v1'
} as const

describe('Entity record policy', () => {
    it('parses the bounded semantic-key, lifecycle, runtime, and validator policy', () => {
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
})
