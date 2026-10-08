import {
    buildSingleTargetWidgetBinding,
    getLayoutWidgetDefinition,
    marketingHeroWidgetDataSchema,
    marketingPageConfigSchema,
    publicMarketingPageRecordSchema,
    validateWidgetBindings
} from '@universo-react/types'
import { isCompatibleMarketingWidgetObject, projectMarketingWidgetBindingData } from '../../services/marketingWidgetEntityBinding'

const definition = getLayoutWidgetDefinition('marketing.hero')!
const config = marketingPageConfigSchema.parse({ themeMode: 'system' })
const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
    entityKind: 'object',
    entityCodename: 'MarketingPageHero',
    semanticKey: 'hero-default'
})

const record = {
    recordId: '019ccefc-2f7b-7b36-82f4-85cdb1312272',
    data: {
        key: 'hero-default',
        title: { locales: { en: { content: 'Welcome', isActive: true }, ru: { content: 'Добро пожаловать', isActive: true } } },
        accent: { locales: { en: { content: 'today', isActive: false }, ru: { content: 'сегодня', isActive: true } } },
        description: { en: 'Description' },
        emailLabel: { en: 'Email' },
        emailPlaceholder: { en: 'you@example.test' },
        primaryActionLabel: { en: 'Join' },
        primaryAction: { kind: 'internal', path: '/join' },
        termsText: { en: 'Accept' },
        termsLinkLabel: { en: 'Terms' },
        termsAction: { kind: 'external', url: 'https://example.test/terms', target: 'same-tab' }
    }
}

const projectCollectionItems = async (
    variant: 'features' | 'highlights',
    items: Array<{ key: string; iconKey: string; title: string; description: string }>
) => {
    const rendererConfig = { variant }
    const collectionDefinition = getLayoutWidgetDefinition('marketing.collection', rendererConfig)!
    const sectionSlot = collectionDefinition.bindingSlots!.find(({ key }) => key === 'section')!
    const itemsSlot = collectionDefinition.bindingSlots!.find(({ key }) => key === 'items')!
    const target = (
        slot: typeof sectionSlot | typeof itemsSlot,
        slotKey: string,
        entityCodename: string,
        selector: { kind: 'semantic-key'; field: string; value: string } | { kind: 'record-set' }
    ) => ({
        slot: slotKey,
        targets: [
            {
                entityKind: 'object' as const,
                entityCodename,
                selector,
                projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
            }
        ]
    })
    const bindings = validateWidgetBindings(collectionDefinition, {
        version: 1,
        slots: [
            target(sectionSlot, 'section', 'MarketingPageSection', { kind: 'semantic-key', field: 'key', value: variant }),
            target(itemsSlot, 'items', variant === 'features' ? 'MarketingPageFeature' : 'MarketingPageHighlight', { kind: 'record-set' })
        ]
    })
    const sectionRecord = {
        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1312301',
        data: {
            key: variant,
            title: { en: variant, ru: variant },
            description: { en: 'Section description', ru: 'Описание раздела' },
            order: 0,
            visible: true
        }
    }
    const itemRecords = items.map((item, index) => ({
        recordId: `019ccefc-2f7b-7b36-82f4-85cdb13123${String(index + 2).padStart(2, '0')}`,
        data: {
            ...item,
            title: { en: item.title, ru: item.title },
            description: { en: item.description, ru: item.description },
            ...(variant === 'features'
                ? {
                      imageLight: { type: 'url', url: 'https://example.test/light.png', launchMode: 'inline' },
                      imageDark: { type: 'url', url: 'https://example.test/dark.png', launchMode: 'inline' }
                  }
                : {}),
            order: index + 1,
            visible: true
        }
    }))

    return projectMarketingWidgetBindingData({
        widgetKey: 'marketing.collection',
        bindings,
        loadRecords: ({ target: bindingTarget }) =>
            bindingTarget.entityCodename === 'MarketingPageSection' ? [sectionRecord] : itemRecords,
        config,
        rendererConfig
    })
}

type MarketingWidgetAdapterFixture = {
    name: string
    widgetKey: string
    rendererConfig?: Record<string, unknown>
    sources: Record<
        string,
        {
            entityCodename: string
            records: Array<{ recordId: string; data: Record<string, unknown> }>
        }
    >
    expectedRecords: unknown[]
}

const projectMarketingWidgetFixture = async ({ widgetKey, rendererConfig = {}, sources }: MarketingWidgetAdapterFixture) => {
    const widgetDefinition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!widgetDefinition?.bindingSlots?.length) throw new Error(`Missing binding slots for ${widgetKey}`)

    const fixtureBindings = validateWidgetBindings(widgetDefinition, {
        version: 1,
        slots: widgetDefinition.bindingSlots.map((slot) => {
            const source = sources[slot.key]
            if (!source) throw new Error(`Missing fixture source for ${widgetKey}.${slot.key}`)

            let selector:
                | { kind: 'semantic-key'; field: string; value: string }
                | { kind: 'relation-set'; parentSlot: string }
                | { kind: 'record-set' }
            if (slot.selectorKinds.includes('semantic-key')) {
                const semanticKey = slot.requirements.components.find(({ semanticKey: isSemanticKey }) => isSemanticKey)
                const record = source.records[0]
                if (!semanticKey || !record) throw new Error(`Missing semantic record for ${widgetKey}.${slot.key}`)
                selector = {
                    kind: 'semantic-key',
                    field: semanticKey.field,
                    value: String(record.data[semanticKey.field] ?? '')
                }
            } else if (slot.selectorKinds.includes('relation-set')) {
                if (!slot.relation) throw new Error(`Missing relation contract for ${widgetKey}.${slot.key}`)
                selector = { kind: 'relation-set', parentSlot: slot.relation.parentSlot }
            } else {
                selector = { kind: 'record-set' }
            }

            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object' as const,
                        entityCodename: source.entityCodename,
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })

    return projectMarketingWidgetBindingData({
        widgetKey,
        bindings: fixtureBindings,
        loadRecords: ({ slot }) => sources[slot]!.records,
        config,
        rendererConfig
    })
}

const marketingWidgetDtoFixtures: MarketingWidgetAdapterFixture[] = [
    {
        name: 'Brand',
        widgetKey: 'marketing.brand',
        sources: {
            site: {
                entityCodename: 'MarketingPageSiteSettings',
                records: [
                    {
                        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313301',
                        data: {
                            key: 'site-settings',
                            brandName: { en: 'Universo', ru: 'Универсо' },
                            brandLogo: { type: 'url', url: 'https://cdn.example.test/brand.svg' }
                        }
                    }
                ]
            }
        },
        expectedRecords: [
            {
                semanticKey: 'site-settings',
                order: 0,
                isVisible: true,
                kind: 'siteSettings',
                brandName: { en: 'Universo', ru: 'Универсо' },
                brandLogo: {
                    kind: 'logo',
                    resource: { type: 'url', url: 'https://cdn.example.test/brand.svg', launchMode: 'inline' },
                    alt: { en: 'Universo', ru: 'Универсо' },
                    decorative: false
                }
            }
        ]
    },
    {
        name: 'Navigation',
        widgetKey: 'marketing.navigation',
        sources: {
            items: {
                entityCodename: 'MarketingPageNavigation',
                records: [
                    {
                        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313302',
                        data: {
                            key: 'pricing-link',
                            label: { en: 'Plans', ru: 'Тарифы' },
                            href: '#pricing',
                            sectionKey: 'pricing',
                            order: 2,
                            visible: true
                        }
                    }
                ]
            }
        },
        expectedRecords: [
            {
                semanticKey: 'pricing-link',
                order: 2,
                isVisible: true,
                kind: 'navigationLink',
                label: { en: 'Plans', ru: 'Тарифы' },
                action: { kind: 'anchor', href: '#pricing' }
            }
        ]
    },
    {
        name: 'Image',
        widgetKey: 'marketing.image',
        sources: {
            content: {
                entityCodename: 'MarketingPageImage',
                records: [
                    {
                        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313303',
                        data: {
                            key: 'page-banner',
                            resource: { type: 'url', url: 'https://cdn.example.test/banner.webp', launchMode: 'newTab' },
                            altText: { en: 'A wide banner', ru: 'Широкий баннер' },
                            decorative: false,
                            width: 1280,
                            height: 720
                        }
                    }
                ]
            }
        },
        expectedRecords: [
            {
                semanticKey: 'page-banner',
                order: 0,
                isVisible: true,
                kind: 'image',
                media: {
                    kind: 'hero',
                    resource: { type: 'url', url: 'https://cdn.example.test/banner.webp', launchMode: 'newTab' },
                    alt: { en: 'A wide banner', ru: 'Широкий баннер' },
                    decorative: false,
                    width: 1280,
                    height: 720
                }
            }
        ]
    },
    {
        name: 'Collection Logos',
        widgetKey: 'marketing.collection',
        rendererConfig: { variant: 'logos' },
        sources: {
            section: {
                entityCodename: 'MarketingPageSection',
                records: [
                    { recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313304', data: { key: 'logos', title: { en: 'Customers', ru: 'Клиенты' } } }
                ]
            },
            items: {
                entityCodename: 'MarketingPageLogo',
                records: [
                    {
                        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313305',
                        data: {
                            key: 'northstar',
                            imageLight: { type: 'url', url: 'https://cdn.example.test/northstar-light.svg' },
                            imageDark: { type: 'url', url: 'https://cdn.example.test/northstar-dark.svg' },
                            altText: { en: 'Northstar', ru: 'Нортстар' },
                            order: 1,
                            visible: true
                        }
                    }
                ]
            }
        },
        expectedRecords: [
            {
                semanticKey: 'logos',
                order: 0,
                isVisible: true,
                kind: 'sectionCopy',
                sectionKey: 'logos',
                title: { en: 'Customers', ru: 'Клиенты' }
            },
            {
                semanticKey: 'northstar',
                order: 1,
                isVisible: true,
                kind: 'logo',
                name: { en: 'Northstar', ru: 'Нортстар' },
                media: {
                    kind: 'logo',
                    resource: { type: 'url', url: 'https://cdn.example.test/northstar-light.svg', launchMode: 'inline' },
                    alt: { en: 'Northstar', ru: 'Нортстар' },
                    decorative: false
                },
                darkMedia: {
                    kind: 'logo',
                    resource: { type: 'url', url: 'https://cdn.example.test/northstar-dark.svg', launchMode: 'inline' },
                    alt: { en: 'Northstar', ru: 'Нортстар' },
                    decorative: false
                }
            }
        ]
    },
    {
        name: 'Collection Testimonials',
        widgetKey: 'marketing.collection',
        rendererConfig: { variant: 'testimonials' },
        sources: {
            section: {
                entityCodename: 'MarketingPageSection',
                records: [
                    {
                        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313306',
                        data: { key: 'testimonials', title: { en: 'Stories', ru: 'Истории' } }
                    }
                ]
            },
            items: {
                entityCodename: 'MarketingPageTestimonial',
                records: [
                    {
                        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313307',
                        data: {
                            key: 'ada-story',
                            name: { en: 'Ada Lovelace', ru: 'Ада Лавлейс' },
                            occupation: { en: 'Engineer', ru: 'Инженер' },
                            quote: { en: 'A thoughtful product.', ru: 'Продуманный продукт.' },
                            avatar: { type: 'url', url: 'https://cdn.example.test/ada-avatar.webp' },
                            logoLight: { type: 'url', url: 'https://cdn.example.test/company-light.svg' },
                            logoDark: { type: 'url', url: 'https://cdn.example.test/company-dark.svg' },
                            order: 3,
                            visible: true
                        }
                    }
                ]
            }
        },
        expectedRecords: [
            {
                semanticKey: 'testimonials',
                order: 0,
                isVisible: true,
                kind: 'sectionCopy',
                sectionKey: 'testimonials',
                title: { en: 'Stories', ru: 'Истории' }
            },
            {
                semanticKey: 'ada-story',
                order: 3,
                isVisible: true,
                kind: 'testimonial',
                quote: { en: 'A thoughtful product.', ru: 'Продуманный продукт.' },
                author: { en: 'Ada Lovelace', ru: 'Ада Лавлейс' },
                company: { en: 'Engineer', ru: 'Инженер' },
                avatar: {
                    kind: 'avatar',
                    resource: { type: 'url', url: 'https://cdn.example.test/ada-avatar.webp', launchMode: 'inline' },
                    alt: { en: 'Ada Lovelace', ru: 'Ада Лавлейс' },
                    decorative: false
                },
                logo: {
                    kind: 'logo',
                    resource: { type: 'url', url: 'https://cdn.example.test/company-light.svg', launchMode: 'inline' },
                    alt: { en: 'Ada Lovelace', ru: 'Ада Лавлейс' },
                    decorative: false
                },
                darkLogo: {
                    kind: 'logo',
                    resource: { type: 'url', url: 'https://cdn.example.test/company-dark.svg', launchMode: 'inline' },
                    alt: { en: 'Ada Lovelace', ru: 'Ада Лавлейс' },
                    decorative: false
                }
            }
        ]
    },
    {
        name: 'Collection FAQ',
        widgetKey: 'marketing.collection',
        rendererConfig: { variant: 'faq' },
        sources: {
            section: {
                entityCodename: 'MarketingPageSection',
                records: [
                    { recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313308', data: { key: 'faq', title: { en: 'Questions', ru: 'Вопросы' } } }
                ]
            },
            items: {
                entityCodename: 'MarketingPageFaq',
                records: [
                    {
                        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313309',
                        data: {
                            key: 'data-export',
                            question: { en: 'Can I export my data?', ru: 'Можно ли экспортировать данные?' },
                            answer: { en: 'Yes, from Settings.', ru: 'Да, в настройках.' },
                            order: 1,
                            visible: true
                        }
                    }
                ]
            }
        },
        expectedRecords: [
            {
                semanticKey: 'faq',
                order: 0,
                isVisible: true,
                kind: 'sectionCopy',
                sectionKey: 'faq',
                title: { en: 'Questions', ru: 'Вопросы' }
            },
            {
                semanticKey: 'data-export',
                order: 1,
                isVisible: true,
                kind: 'faq',
                question: { en: 'Can I export my data?', ru: 'Можно ли экспортировать данные?' },
                answer: { en: 'Yes, from Settings.', ru: 'Да, в настройках.' }
            }
        ]
    },
    {
        name: 'Pricing',
        widgetKey: 'marketing.pricing',
        sources: {
            section: {
                entityCodename: 'MarketingPageSection',
                records: [
                    { recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313310', data: { key: 'pricing', title: { en: 'Plans', ru: 'Тарифы' } } }
                ]
            },
            tiers: {
                entityCodename: 'MarketingPagePricing',
                records: [
                    {
                        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313311',
                        data: {
                            key: 'starter',
                            title: { en: 'Starter', ru: 'Старт' },
                            subheader: { en: 'For small teams', ru: 'Для небольших команд' },
                            price: 19.99,
                            period: { en: 'month', ru: 'месяц' },
                            actionLabel: { en: 'Choose plan', ru: 'Выбрать тариф' },
                            actionHref: '/start',
                            featured: true,
                            order: 1,
                            visible: true
                        }
                    }
                ]
            },
            benefits: {
                entityCodename: 'MarketingPagePricingBenefit',
                records: [
                    {
                        recordId: '019ccefc-2f7b-7b36-82f4-85cdb1313312',
                        data: {
                            key: 'starter-support',
                            tier: '019ccefc-2f7b-7b36-82f4-85cdb1313311',
                            label: { en: 'Email support', ru: 'Поддержка по почте' },
                            order: 1,
                            visible: true
                        }
                    }
                ]
            }
        },
        expectedRecords: [
            {
                semanticKey: 'pricing',
                order: 0,
                isVisible: true,
                kind: 'sectionCopy',
                sectionKey: 'pricing',
                title: { en: 'Plans', ru: 'Тарифы' }
            },
            {
                semanticKey: 'starter',
                order: 1,
                isVisible: true,
                kind: 'pricingTier',
                title: { en: 'Starter', ru: 'Старт' },
                description: { en: 'For small teams', ru: 'Для небольших команд' },
                price: { en: '19.99' },
                period: { en: 'month', ru: 'месяц' },
                action: {
                    label: { en: 'Choose plan', ru: 'Выбрать тариф' },
                    action: { kind: 'internal', path: '/start', target: 'same-tab' }
                },
                benefitKeys: ['starter-support'],
                benefits: [],
                featured: true
            },
            {
                semanticKey: 'starter-support',
                order: 1,
                isVisible: true,
                kind: 'pricingBenefit',
                label: { en: 'Email support', ru: 'Поддержка по почте' }
            }
        ]
    }
]

describe('shared marketing widget binding projection', () => {
    it.each(marketingWidgetDtoFixtures)('projects the registered $name input contract into typed DTO records', async (fixture) => {
        const data = await projectMarketingWidgetFixture(fixture)

        expect(data).toEqual({ records: fixture.expectedRecords })
        expect(data?.records.map((record) => publicMarketingPageRecordSchema.parse(record))).toEqual(fixture.expectedRecords)
        for (const recordId of Object.values(fixture.sources).flatMap(({ records }) => records.map(({ recordId }) => recordId))) {
            expect(JSON.stringify(data)).not.toContain(recordId)
        }
    })

    it('projects an Image with an empty optional ResourceSource as an empty record set', async () => {
        const imageFixture = marketingWidgetDtoFixtures.find(({ name }) => name === 'Image')
        if (!imageFixture) throw new Error('Missing Marketing Image projection fixture')
        const imageSource = imageFixture.sources.content
        const imageRecord = imageSource?.records[0]
        if (!imageSource || !imageRecord) throw new Error('Missing Marketing Image source record')
        const dataWithoutResource = { ...imageRecord.data }
        delete dataWithoutResource.resource

        await expect(
            projectMarketingWidgetFixture({
                ...imageFixture,
                sources: {
                    ...imageFixture.sources,
                    content: { ...imageSource, records: [{ ...imageRecord, data: dataWithoutResource }] }
                }
            })
        ).resolves.toEqual({ records: [] })
    })

    it('projects more than 64 Pricing benefits up to the registered relation limit', async () => {
        const pricingFixture = marketingWidgetDtoFixtures.find(({ name }) => name === 'Pricing')
        if (!pricingFixture) throw new Error('Missing Marketing Pricing projection fixture')
        const tierRecord = pricingFixture.sources.tiers?.records[0]
        const benefitSource = pricingFixture.sources.benefits
        const benefitRecord = benefitSource?.records[0]
        if (!tierRecord || !benefitSource || !benefitRecord) throw new Error('Missing Marketing Pricing relation fixture')

        const benefits = Array.from({ length: 65 }, (_, index) => ({
            recordId: `019ccefc-2f7b-7b36-82f4-${String(900000000000 + index).padStart(12, '0')}`,
            data: {
                ...benefitRecord.data,
                key: `benefit-${index + 1}`,
                tier: tierRecord.recordId,
                order: index + 1
            }
        }))
        const projected = await projectMarketingWidgetFixture({
            ...pricingFixture,
            sources: { ...pricingFixture.sources, benefits: { ...benefitSource, records: benefits } }
        })
        const tier = projected?.records.find((item) => item.kind === 'pricingTier')
        const projectedBenefits = projected?.records.filter((item) => item.kind === 'pricingBenefit') ?? []

        expect(tier).toBeDefined()
        expect(tier && 'benefitKeys' in tier ? tier.benefitKeys : []).toHaveLength(65)
        expect(tier && 'benefits' in tier ? tier.benefits : []).toHaveLength(0)
        expect(projectedBenefits).toHaveLength(65)
        expect(publicMarketingPageRecordSchema.safeParse(tier).success).toBe(true)
    })

    it('rejects a string Resource instead of coercing it into a canonical media reference', async () => {
        const imageFixture = marketingWidgetDtoFixtures.find(({ name }) => name === 'Image')
        if (!imageFixture) throw new Error('Missing Marketing Image projection fixture')
        const imageSource = imageFixture.sources.content
        const imageRecord = imageSource?.records[0]
        if (!imageSource || !imageRecord) throw new Error('Missing Marketing Image source record')

        await expect(
            projectMarketingWidgetFixture({
                ...imageFixture,
                sources: {
                    ...imageFixture.sources,
                    content: {
                        ...imageSource,
                        records: [
                            {
                                ...imageRecord,
                                data: { ...imageRecord.data, resource: 'https://cdn.example.test/legacy-banner.webp' }
                            }
                        ]
                    }
                }
            })
        ).rejects.toThrow('MARKETING_WIDGET_MEDIA_INVALID')
    })

    it('requires the complete registered Component contract and accepts canonical custom Hero sources', () => {
        const object = {
            kind: 'object',
            codename: 'MarketingPageHero',
            config: {
                recordPolicy: {
                    version: 1,
                    runtimeMutation: 'deny',
                    denyDeleteWhenBound: true,
                    immutableSemanticKeyWhenBound: true,
                    semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                    requiredLocales: ['en', 'ru'],
                    coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
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
                ...(requirement.pattern === undefined ? {} : { pattern: requirement.pattern }),
                ...(requirement.format ? { format: requirement.format } : {})
            }
        }))

        expect(isCompatibleMarketingWidgetObject(object, components, 'marketing.hero', 'content')).toBe(true)
        expect(
            isCompatibleMarketingWidgetObject({ ...object, codename: 'MarketingPageImage' }, components, 'marketing.hero', 'content')
        ).toBe(true)
        expect(
            isCompatibleMarketingWidgetObject({ ...object, codename: ' MarketingPageHero ' }, components, 'marketing.hero', 'content')
        ).toBe(false)
        expect(
            isCompatibleMarketingWidgetObject(
                object,
                components.map(({ codename, ...component }) => ({
                    ...component,
                    codename: { _schema: '1', _primary: 'en', locales: { en: { content: codename } } }
                })),
                'marketing.hero',
                'content'
            )
        ).toBe(true)
        expect(
            isCompatibleMarketingWidgetObject(
                object,
                components.map((component) => (component.codename === 'Accent' ? { ...component, isRequired: true } : component)),
                'marketing.hero',
                'content'
            )
        ).toBe(false)
        expect(
            isCompatibleMarketingWidgetObject(
                object,
                components.filter((component) => component.codename !== 'Accent'),
                'marketing.hero',
                'content'
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

    it('resolves a registered semantic target into the strict typed Hero renderer DTO', async () => {
        const data = await project()

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
        expect(JSON.stringify(data)).not.toContain(record.recordId)
        expect(JSON.stringify(data)).not.toContain('must-not-be-projected')
    })

    it('preserves every locale for newsletter labels in the footer Entity projection', async () => {
        const footerDefinition = getLayoutWidgetDefinition('marketing.footer')!
        const targetForSlot = (slotKey: string, entityCodename: string, semanticKey?: string) => {
            const slot = footerDefinition.bindingSlots!.find(({ key }) => key === slotKey)!
            const semanticComponent =
                slot.selectorKinds[0] === 'semantic-key'
                    ? slot.requirements.components.find(({ semanticKey: isSemanticKey }) => isSemanticKey)
                    : undefined
            return {
                slot: slotKey,
                targets: [
                    {
                        entityKind: 'object' as const,
                        entityCodename,
                        selector: semanticComponent
                            ? { kind: 'semantic-key' as const, field: semanticComponent.field, value: semanticKey! }
                            : { kind: 'record-set' as const },
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        }
        const footerBindings = validateWidgetBindings(footerDefinition, {
            version: 1,
            slots: [targetForSlot('site', 'MarketingPageSiteSettings', 'site-default'), targetForSlot('links', 'MarketingPageFooterLink')]
        })
        const siteRecord = {
            recordId: '019ccefc-2f7b-7b36-82f4-85cdb1312345',
            data: {
                key: 'site-default',
                brandName: { en: 'Universo', ru: 'Универсо' },
                newsletterEnabled: true,
                newsletterTitle: { en: 'Newsletter', ru: 'Рассылка' },
                newsletterLabel: { en: 'Email', ru: 'Электронная почта' },
                newsletterPlaceholder: { en: 'you@example.test', ru: 'you@example.test' },
                newsletterActionLabel: { en: 'Subscribe', ru: 'Подписаться' },
                newsletterSuccessMessage: { en: 'Thanks', ru: 'Спасибо' },
                newsletterErrorMessage: { en: 'Try again', ru: 'Попробуйте ещё раз' }
            }
        }
        const linkRecord = {
            recordId: '019ccefc-2f7b-7b36-82f4-85cdb1312347',
            data: {
                key: 'github',
                groupKey: 'social',
                groupTitle: { en: 'Social', ru: 'Социальные сети' },
                label: { en: 'GitHub', ru: 'GitHub' },
                bottomLabel: { en: 'Open source', ru: 'Открытый код' },
                href: 'https://github.com/example',
                iconKey: 'GitHub',
                order: 1,
                visible: true
            }
        }

        const projected = await projectMarketingWidgetBindingData({
            widgetKey: 'marketing.footer',
            bindings: footerBindings,
            loadRecords: ({ target }) => {
                if (target.entityCodename === 'MarketingPageSiteSettings') return [siteRecord]
                return [linkRecord]
            },
            config
        })

        expect(projected?.records.find((item) => item.kind === 'siteSettings')).toMatchObject({
            newsletter: {
                emailLabel: { en: 'Email', ru: 'Электронная почта' },
                emailPlaceholder: { en: 'you@example.test', ru: 'you@example.test' },
                submitLabel: { en: 'Subscribe', ru: 'Подписаться' }
            }
        })
        expect(projected?.records.find((item) => item.kind === 'footerLink')).toMatchObject({ iconKey: 'github' })
    })

    it('normalizes seeded PascalCase feature and highlight icon names before DTO validation', async () => {
        const featureIcons = ['ViewQuiltRounded', 'EdgesensorHighRounded', 'DevicesRounded']
        const features = await projectCollectionItems(
            'features',
            featureIcons.map((iconKey, index) => ({
                key: `feature-${index}`,
                iconKey,
                title: `Feature ${index}`,
                description: `Description ${index}`
            }))
        )
        expect(features?.records.filter((item) => item.kind === 'feature').map((item) => item.iconKey)).toEqual([
            'viewquiltrounded',
            'edgesensorhighrounded',
            'devicesrounded'
        ])

        const highlightIcons = [
            'SettingsSuggestRounded',
            'ConstructionRounded',
            'ThumbUpAltRounded',
            'AutoFixHighRounded',
            'SupportAgentRounded',
            'QueryStatsRounded'
        ]
        const highlights = await projectCollectionItems(
            'highlights',
            highlightIcons.map((iconKey, index) => ({
                key: `highlight-${index}`,
                iconKey,
                title: `Highlight ${index}`,
                description: `Description ${index}`
            }))
        )
        expect(highlights?.records.filter((item) => item.kind === 'highlight').map((item) => item.iconKey)).toEqual([
            'settingssuggestrounded',
            'constructionrounded',
            'thumbupaltrounded',
            'autofixhighrounded',
            'supportagentrounded',
            'querystatsrounded'
        ])
    })

    it('omits malformed optional icon text without weakening semantic-key validation', async () => {
        const projected = await projectCollectionItems('features', [
            { key: 'feature-with-invalid-icon', iconKey: 'unsupported icon!', title: 'Feature', description: 'Description' }
        ])

        expect(projected?.records.find((item) => item.kind === 'feature')).not.toHaveProperty('iconKey')
    })

    it('fails closed for missing and ambiguous semantic targets', async () => {
        await expect(project(null)).rejects.toThrow('MARKETING_WIDGET_BINDING_INVALID')
        await expect(project(bindings, [])).rejects.toThrow('MARKETING_WIDGET_BINDING_TARGET_UNAVAILABLE')
        await expect(project(bindings, [record, record])).rejects.toThrow('MARKETING_WIDGET_BINDING_TARGET_UNAVAILABLE')
    })

    it('rejects an action that violates the application marketing action policy', async () => {
        const emailRecord = { ...record, data: { ...record.data, primaryAction: { kind: 'email', address: 'team@example.test' } } }
        const restrictedConfig = marketingPageConfigSchema.parse({ themeMode: 'system', allowEmailActions: false })

        await expect(
            projectMarketingWidgetBindingData({
                widgetKey: 'marketing.hero',
                bindings,
                loadRecords: () => [emailRecord],
                config: restrictedConfig
            })
        ).rejects.toThrow('MARKETING_ACTION_DISABLED')
    })

    it('does not coerce a URL string into the canonical Hero terms action', async () => {
        const recordWithStringTermsAction = {
            ...record,
            data: { ...record.data, termsAction: 'https://example.test/legacy-terms' }
        }
        const projected = await project(undefined, [recordWithStringTermsAction])

        expect(projected?.records[0]).not.toHaveProperty('content.termsAction')
    })

    it('accepts a compatible custom Object binding and resolves the renderer DTO', async () => {
        const customBinding = buildSingleTargetWidgetBinding(definition, 'content', {
            entityKind: 'object',
            entityCodename: 'CustomLandingHero',
            semanticKey: 'hero-default'
        })
        const loadRecords = jest.fn(() => [record])

        await expect(
            projectMarketingWidgetBindingData({ widgetKey: 'marketing.hero', bindings: customBinding, loadRecords, config })
        ).resolves.toBeDefined()
        expect(loadRecords).toHaveBeenCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ entityCodename: 'CustomLandingHero' }) })
        )
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
        ).resolves.toBeUndefined()
        expect(loadRecords).not.toHaveBeenCalled()
    })
})
