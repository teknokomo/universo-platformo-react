import { entityRecordPolicySchema, type EntityRecordPolicy } from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'
import { prepareEntityRecordCreationData, validateEntityRecordPolicyData } from '../../domains/shared/entityRecordPolicy'
import type { ComponentDefinitionDataType } from '@universo-react/types'

const policy: EntityRecordPolicy = entityRecordPolicySchema.parse({
    version: 1,
    semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
    denyDeleteWhenBound: true,
    immutableSemanticKeyWhenBound: true,
    runtimeMutation: 'deny',
    requiredLocales: ['en', 'ru'],
    coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
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
    { codename: 'Accent', isRequired: false, dataType: 'STRING' as ComponentDefinitionDataType, validationRules: { localized: true } },
    {
        codename: 'PrimaryAction',
        isRequired: true,
        dataType: 'JSON' as ComponentDefinitionDataType,
        validationRules: { format: 'marketingAction' }
    },
    ...['TermsText', 'TermsLinkLabel'].map((codename) => ({
        codename,
        isRequired: false,
        dataType: 'STRING' as ComponentDefinitionDataType,
        validationRules: { localized: true }
    })),
    {
        codename: 'TermsAction',
        isRequired: false,
        dataType: 'JSON' as ComponentDefinitionDataType,
        validationRules: { format: 'marketingAction' }
    }
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

        const completeTerms = {
            ...validHeroData(),
            TermsText: localized('By continuing, you agree to', 'Продолжая, вы соглашаетесь с'),
            TermsLinkLabel: localized('Terms', 'Условиями'),
            TermsAction: { kind: 'anchor', href: '#terms' }
        }
        expect(validateEntityRecordPolicyData(policy, completeTerms, components)).toEqual({ valid: true, errors: [] })
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

    it('uses component formats and policy groups instead of entity-specific validators', () => {
        const invalidAction = { ...validHeroData(), PrimaryAction: { kind: 'external', url: 'javascript:alert(1)' } }
        expect(validateEntityRecordPolicyData(policy, invalidAction, components).errors).toContain('PrimaryAction.invalid_action')
        expect(entityRecordPolicySchema.safeParse({ ...policy, validatorKey: 'marketing.hero.v1' }).success).toBe(false)
    })

    it('requires complete alternative text only when an image is not decorative', () => {
        const imagePolicy = entityRecordPolicySchema.parse({
            version: 1,
            semanticKey: { componentCodename: 'ImageKey', creationPrefix: 'image', protectedValues: ['default'] },
            denyDeleteWhenBound: true,
            immutableSemanticKeyWhenBound: true,
            runtimeMutation: 'deny',
            requiredLocales: ['en', 'ru'],
            conditionalRequired: [{ componentCodename: 'AltText', when: { componentCodename: 'Decorative', equals: false } }]
        })
        const imageComponents = [
            { codename: 'ImageKey', dataType: 'STRING', isRequired: true },
            { codename: 'Decorative', dataType: 'BOOLEAN', isRequired: true },
            { codename: 'AltText', dataType: 'STRING', isRequired: false, validationRules: { localized: true } }
        ]
        const imageData = (decorative: boolean, altText?: ReturnType<typeof localized>) => ({
            ImageKey: 'default',
            Decorative: decorative,
            ...(altText ? { AltText: altText } : {})
        })

        expect(validateEntityRecordPolicyData(imagePolicy, imageData(true), imageComponents)).toEqual({ valid: true, errors: [] })
        expect(validateEntityRecordPolicyData(imagePolicy, imageData(false), imageComponents).errors).toEqual(['AltText.required'])
        expect(
            validateEntityRecordPolicyData(imagePolicy, imageData(false, localized('Alternative text', '')), imageComponents).errors
        ).toEqual(['AltText.ru.required'])
        expect(
            validateEntityRecordPolicyData(
                imagePolicy,
                imageData(false, localized('Dashboard preview', 'Предпросмотр панели')),
                imageComponents
            )
        ).toEqual({ valid: true, errors: [] })
    })

    it('requires conditional non-localized values and preserves valid false and zero values', () => {
        const conditionalPolicy = entityRecordPolicySchema.parse({
            version: 1,
            denyDeleteWhenBound: false,
            immutableSemanticKeyWhenBound: false,
            runtimeMutation: 'allow',
            conditionalRequired: [
                { componentCodename: 'Caption', when: { componentCodename: 'ShowCaption', equals: true } },
                { componentCodename: 'Priority', when: { componentCodename: 'ShowCaption', equals: true } },
                { componentCodename: 'Enabled', when: { componentCodename: 'ShowCaption', equals: true } }
            ]
        })
        const conditionalComponents = [
            { codename: 'ShowCaption', dataType: 'BOOLEAN', isRequired: true },
            { codename: 'Caption', dataType: 'STRING', isRequired: false },
            { codename: 'Priority', dataType: 'NUMBER', isRequired: false },
            { codename: 'Enabled', dataType: 'BOOLEAN', isRequired: false }
        ]

        expect(
            validateEntityRecordPolicyData(
                conditionalPolicy,
                { ShowCaption: true, Caption: '', Priority: 0, Enabled: false },
                conditionalComponents
            ).errors
        ).toEqual(['Caption.required'])
        expect(
            validateEntityRecordPolicyData(
                conditionalPolicy,
                { ShowCaption: true, Caption: 'Visible caption', Priority: 0, Enabled: false },
                conditionalComponents
            )
        ).toEqual({ valid: true, errors: [] })
        expect(
            validateEntityRecordPolicyData(
                conditionalPolicy,
                { ShowCaption: true, Caption: 'Visible caption', Priority: '0', Enabled: false },
                conditionalComponents
            ).errors
        ).toContain('Priority.required')
        expect(validateEntityRecordPolicyData(conditionalPolicy, { ShowCaption: false }, conditionalComponents)).toEqual({
            valid: true,
            errors: []
        })
    })
})
