import {
    buildSingleTargetWidgetBinding,
    getLayoutWidgetDefinition,
    marketingHeroWidgetDataSchema,
    marketingPageConfigSchema
} from '@universo-react/types'
import { isCompatibleMarketingHeroObject, projectMarketingWidgetBindingData } from '../../services/marketingHeroEntityBinding'

const definition = getLayoutWidgetDefinition('marketing.hero')!
const config = marketingPageConfigSchema.parse({ themeMode: 'system' })
const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
    entityKind: 'object',
    entityCodename: 'MarketingPageHero',
    semanticKey: 'hero-default'
})

const record = {
    id: '019ccefc-2f7b-7b36-82f4-85cdb1312272',
    HeroKey: 'hero-default',
    Title: { locales: { en: { content: 'Welcome', isActive: true }, ru: { content: 'Добро пожаловать', isActive: true } } },
    Accent: { locales: { en: { content: 'today', isActive: false }, ru: { content: 'сегодня', isActive: true } } },
    Description: { en: 'Description' },
    EmailLabel: { en: 'Email' },
    EmailPlaceholder: { en: 'you@example.test' },
    PrimaryActionLabel: { en: 'Join' },
    PrimaryAction: { kind: 'internal', path: '/join' },
    TermsText: { en: 'Accept' },
    TermsLinkLabel: { en: 'Terms' },
    TermsAction: { kind: 'external', url: 'https://example.test/terms', target: 'same-tab' },
    secret: 'must-not-be-projected'
}

describe('shared marketing widget binding projection', () => {
    it('requires the complete registered Object and Component contract for public Hero sources', () => {
        const object = {
            kind: 'object',
            config: {
                recordPolicy: {
                    version: 1,
                    runtimeMutation: 'deny',
                    denyDeleteWhenBound: true,
                    immutableSemanticKeyWhenBound: true,
                    semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                    requiredLocales: ['en', 'ru'],
                    validatorKey: 'marketing.hero.v1'
                }
            }
        }
        const components = definition.bindingSlots![0]!.requirements.components.map((requirement) => ({
            codename: requirement.componentCodename,
            dataType: requirement.valueType === 'json' ? 'jsonb' : 'text',
            isRequired: requirement.required,
            validationRules: {
                ...(requirement.localized ? { localized: true } : {}),
                ...(requirement.maxLength !== undefined ? { maxLength: requirement.maxLength } : {}),
                ...(requirement.semanticKey ? { unique: true } : {}),
                ...(requirement.format ? { format: requirement.format } : {})
            }
        }))

        expect(isCompatibleMarketingHeroObject(object, components)).toBe(true)
        expect(
            isCompatibleMarketingHeroObject(
                object,
                components.map(({ codename, ...component }) => ({
                    ...component,
                    codename: { _schema: '1', _primary: 'en', locales: { en: { content: codename } } }
                }))
            )
        ).toBe(true)
        expect(
            isCompatibleMarketingHeroObject(
                object,
                components.map((component) => (component.codename === 'Accent' ? { ...component, isRequired: true } : component))
            )
        ).toBe(false)
        expect(
            isCompatibleMarketingHeroObject(
                object,
                components.filter((component) => component.codename !== 'Accent')
            )
        ).toBe(false)
    })

    const project = (rawBindings: unknown = bindings, rows: readonly Record<string, unknown>[] = [record]) =>
        projectMarketingWidgetBindingData({
            widgetKey: 'marketing.hero',
            bindings: rawBindings,
            loadRecords: () => rows,
            config
        })

    it('resolves a registered semantic target into the strict typed Hero renderer DTO', () => {
        const data = project()

        expect(data).toEqual({
            records: [
                {
                    kind: 'heroContent',
                    semanticKey: 'content',
                    order: 0,
                    isVisible: true,
                    content: {
                        title: { en: 'Welcome', ru: 'Добро пожаловать' },
                        accent: { ru: 'сегодня' },
                        description: { en: 'Description' },
                        emailLabel: { en: 'Email' },
                        emailPlaceholder: { en: 'you@example.test' },
                        primaryActionLabel: { en: 'Join' },
                        primaryAction: { kind: 'internal', path: '/join', target: 'same-tab' },
                        termsText: { en: 'Accept' },
                        termsLinkLabel: { en: 'Terms' },
                        termsAction: { kind: 'external', url: 'https://example.test/terms', target: 'new-tab' }
                    }
                }
            ]
        })
        expect(marketingHeroWidgetDataSchema.parse(data)).toEqual(data)
        expect(JSON.stringify(data)).not.toContain(record.id)
        expect(JSON.stringify(data)).not.toContain('must-not-be-projected')
    })

    it('fails closed for missing and ambiguous semantic targets', () => {
        expect(() => project(null)).toThrow('MARKETING_HERO_BINDING_INVALID')
        expect(() => project(bindings, [])).toThrow('MARKETING_HERO_BINDING_TARGET_UNAVAILABLE')
        expect(() => project(bindings, [record, record])).toThrow('MARKETING_HERO_BINDING_TARGET_UNAVAILABLE')
    })

    it('rejects an action that violates the application marketing action policy', () => {
        const emailRecord = { ...record, PrimaryAction: { kind: 'email', address: 'team@example.test' } }
        const restrictedConfig = marketingPageConfigSchema.parse({ themeMode: 'system', allowEmailActions: false })

        expect(() =>
            projectMarketingWidgetBindingData({
                widgetKey: 'marketing.hero',
                bindings,
                loadRecords: () => [emailRecord],
                config: restrictedConfig
            })
        ).toThrow('MARKETING_HERO_ACTION_DISABLED')
    })

    it('accepts a compatible custom Object binding and resolves the renderer DTO', () => {
        const customBinding = buildSingleTargetWidgetBinding(definition, 'content', {
            entityKind: 'object',
            entityCodename: 'CustomLandingHero',
            semanticKey: 'hero-default'
        })
        const loadRecords = jest.fn(() => [record])

        expect(
            projectMarketingWidgetBindingData({ widgetKey: 'marketing.hero', bindings: customBinding, loadRecords, config })
        ).toBeDefined()
        expect(loadRecords).toHaveBeenCalledWith(expect.objectContaining({ entityCodename: 'CustomLandingHero' }))
    })

    it('leaves widgets without registered binding slots on their existing record path', () => {
        const loadRecords = jest.fn(() => [record])

        expect(
            projectMarketingWidgetBindingData({
                widgetKey: 'marketing.collection',
                bindings: undefined,
                loadRecords,
                config
            })
        ).toBeUndefined()
        expect(loadRecords).not.toHaveBeenCalled()
    })
})
