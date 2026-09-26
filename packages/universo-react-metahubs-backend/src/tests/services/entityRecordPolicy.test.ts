import { entityRecordPolicySchema, type EntityRecordPolicy } from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'
import {
    isAuthoritativeMarketingHeroRecordPolicy,
    prepareEntityRecordCreationData,
    validateEntityRecordPolicyData
} from '../../domains/shared/entityRecordPolicy'
import type { ComponentDefinitionDataType } from '@universo-react/types'

const policy: EntityRecordPolicy = entityRecordPolicySchema.parse({
    version: 1,
    semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
    denyDeleteWhenBound: true,
    immutableSemanticKeyWhenBound: true,
    runtimeMutation: 'deny',
    requiredLocales: ['en', 'ru'],
    validatorKey: 'marketing.hero.v1'
})

const localized = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, isActive: true },
        ru: { content: ru, isActive: true }
    }
})

const components = [
    ...['Title', 'Description', 'EmailLabel', 'EmailPlaceholder', 'PrimaryActionLabel'].map((codename) => ({
        codename,
        isRequired: true,
        dataType: 'STRING' as ComponentDefinitionDataType,
        validationRules: { localized: true }
    })),
    { codename: 'Accent', isRequired: false, dataType: 'STRING' as ComponentDefinitionDataType, validationRules: { localized: true } }
]

const validHeroData = () => ({
    HeroKey: 'ignored-client-key',
    Title: localized('Welcome', 'Добро пожаловать'),
    Description: localized('Describe your product', 'Опишите продукт'),
    EmailLabel: localized('Email', 'Электронная почта'),
    EmailPlaceholder: localized('you@example.com', 'you@example.com'),
    PrimaryActionLabel: localized('Get started', 'Начать'),
    PrimaryAction: { kind: 'internal', path: '/auth' }
})

describe('Entity record policy', () => {
    it('recognizes only the complete server-owned Marketing Hero policy', () => {
        expect(isAuthoritativeMarketingHeroRecordPolicy(policy)).toBe(true)
        expect(isAuthoritativeMarketingHeroRecordPolicy({ ...policy, denyDeleteWhenBound: false })).toBe(false)
        expect(isAuthoritativeMarketingHeroRecordPolicy({ ...policy, runtimeMutation: 'allow' })).toBe(false)
    })

    it('replaces client-selected semantic keys with a UUID v7 key', () => {
        const data = prepareEntityRecordCreationData(policy, { ...validHeroData(), HeroKey: 'default' })
        const key = data.HeroKey

        expect(typeof key).toBe('string')
        expect(key).toMatch(/^hero-/u)
        expect(isUuidV7(String(key).slice('hero-'.length))).toBe(true)
        expect(key).not.toBe('default')
        expect(validateEntityRecordPolicyData(policy, data, components)).toEqual({ valid: true, errors: [] })
    })

    it('accepts an existing valid record with its protected seeded semantic key', () => {
        expect(validateEntityRecordPolicyData(policy, { ...validHeroData(), HeroKey: 'default' }, components)).toEqual({
            valid: true,
            errors: []
        })
    })

    it('requires every published locale and allows an omitted optional terms group', () => {
        expect(validateEntityRecordPolicyData(policy, validHeroData(), components)).toEqual({ valid: true, errors: [] })

        const incomplete = validHeroData()
        incomplete.Description = localized('Only English', '')
        expect(validateEntityRecordPolicyData(policy, incomplete, components)).toMatchObject({
            valid: false,
            errors: ['Description.ru.required']
        })
    })

    it('requires optional localized values to be complete when authored and requires the full terms group', () => {
        const accentData = { ...validHeroData(), Accent: localized('Accent', '') }
        expect(validateEntityRecordPolicyData(policy, accentData, components).errors).toContain('Accent.ru.required')

        const termsData = { ...validHeroData(), TermsAction: { kind: 'anchor', href: '#terms' } }
        expect(validateEntityRecordPolicyData(policy, termsData, components).errors).toEqual(
            expect.arrayContaining(['TermsText.required', 'TermsLinkLabel.required'])
        )
    })

    it('rejects unsafe or overlong action targets', () => {
        const unsafe = { ...validHeroData(), PrimaryAction: { kind: 'external', url: 'javascript:alert(1)' } }
        expect(validateEntityRecordPolicyData(policy, unsafe, components).errors).toContain('PrimaryAction.invalid_action')

        const overlong = { ...validHeroData(), PrimaryAction: { kind: 'internal', path: `/${'x'.repeat(500)}` } }
        expect(validateEntityRecordPolicyData(policy, overlong, components).errors).toContain('PrimaryAction.target_too_long')
    })

    it('rejects internal paths outside the marketing host route catalog', () => {
        const unknownRoute = { ...validHeroData(), PrimaryAction: { kind: 'internal', path: '/admin/users' } }
        expect(validateEntityRecordPolicyData(policy, unknownRoute, components).errors).toContain('PrimaryAction.unknown_route')
    })

    it('fails closed when the policy names an unregistered validator', () => {
        const unknownPolicy = entityRecordPolicySchema.parse({ ...policy, validatorKey: 'unknown.v1' })
        expect(validateEntityRecordPolicyData(unknownPolicy, validHeroData(), components).errors).toContain(
            'recordPolicy.unsupported_validator'
        )
    })
})
