import { buildSingleTargetWidgetBinding, encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } from '@universo-react/types'
import { validateMarketingSnapshotLayouts } from '../../domains/publications/services/marketingSnapshotValidation'
import type { MetahubSnapshot } from '../../domains/publications/services/SnapshotSerializer'

const ids = {
    layout: '0190a9b5-3cde-7abc-8def-0123456789a1',
    collectionOne: '0190a9b5-3cde-7abc-8def-0123456789a2',
    collectionTwo: '0190a9b5-3cde-7abc-8def-0123456789a3',
    heroOne: '0190a9b5-3cde-7abc-8def-0123456789a4',
    heroTwo: '0190a9b5-3cde-7abc-8def-0123456789a5',
    scopedLayout: '0190a9b5-3cde-7abc-8def-0123456789a6',
    overrideOne: '0190a9b5-3cde-7abc-8def-0123456789a7',
    overrideTwo: '0190a9b5-3cde-7abc-8def-0123456789a8',
    siteSettings: '0190a9b5-3cde-7abc-8def-0123456789b1',
    logos: '0190a9b5-3cde-7abc-8def-0123456789b2',
    features: '0190a9b5-3cde-7abc-8def-0123456789b3',
    heroEntity: '0190a9b5-3cde-7abc-8def-0123456789b4'
} as const

const heroDefinition = getLayoutWidgetDefinition('marketing.hero')
const heroBindingSlot = heroDefinition?.bindingSlots?.[0]
if (!heroDefinition || !heroBindingSlot) throw new Error('Expected Hero binding slot definition')
const heroComponents = heroBindingSlot.requirements.components.map((component) => ({
    codename: component.componentCodename,
    dataType: component.valueType.toUpperCase(),
    isRequired: component.required,
    validationRules: {
        ...(component.localized ? { localized: true } : {}),
        ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
        ...(component.semanticKey ? { unique: true } : {}),
        ...(component.format !== undefined ? { format: component.format } : {})
    }
}))

const objectEntity = (codename: string) => ({
    kind: 'object',
    codename,
    presentation: { name: { en: codename } },
    fields: [],
    hubs: [],
    config: {}
})

const localizedHeroText = (en: string, ru: string) => ({
    locales: {
        en: { content: en, isActive: true },
        ru: { content: ru, isActive: true }
    }
})

const heroRecordData = () => ({
    HeroKey: 'default',
    Title: localizedHeroText('Our latest', 'Наши новые'),
    Accent: localizedHeroText('products', 'продукты'),
    Description: localizedHeroText('Explore the product.', 'Изучите продукт.'),
    EmailLabel: localizedHeroText('Email', 'Электронная почта'),
    EmailPlaceholder: localizedHeroText('you@example.test', 'name@example.test'),
    PrimaryActionLabel: localizedHeroText('Start now', 'Начать'),
    PrimaryAction: { kind: 'internal', path: '/auth', target: 'same-tab' }
})

const collectionWidget = (id: string, instanceKey: string, sourceCodename: string, variant: 'logos' | 'features', sortOrder: number) => ({
    id,
    layoutId: ids.layout,
    zone: 'marketing-main',
    widgetKey: 'marketing.collection',
    sortOrder,
    config: {
        instanceKey,
        source: { entityCodename: sourceCodename, entityKind: 'object' },
        variant,
        maxItems: 12,
        showTitle: true,
        showDescription: true
    },
    isActive: true
})

const makeSnapshot = (widgets: unknown[]): MetahubSnapshot =>
    ({
        version: 1,
        versionEnvelope: {},
        generatedAt: '2026-09-04T00:00:00.000Z',
        metahubId: '0190a9b5-3cde-7abc-8def-0123456789a0',
        entities: {
            [ids.siteSettings]: objectEntity('MarketingPageSiteSettings'),
            [ids.logos]: objectEntity('MarketingPageLogo'),
            [ids.features]: objectEntity('MarketingPageFeature'),
            [ids.heroEntity]: {
                ...objectEntity('MarketingPageHero'),
                config: {
                    capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                    recordPolicy: { version: 1, ...heroBindingSlot.requirements.recordPolicy }
                },
                fields: heroComponents
            }
        },
        fixedValues: {},
        optionValues: {},
        elements: { [ids.heroEntity]: [{ data: heroRecordData() }] },
        systemFields: {},
        layouts: [
            {
                id: ids.layout,
                templateKey: 'marketing-page',
                name: { en: 'Marketing page' },
                description: null,
                config: {},
                isDefault: true,
                isActive: true,
                sortOrder: 0,
                compositionMode: 'independent',
                baseLayoutId: null
            }
        ],
        defaultLayoutId: ids.layout,
        layoutConfig: {},
        layoutZoneWidgets: widgets
    } as unknown as MetahubSnapshot)

describe('validateMarketingSnapshotLayouts', () => {
    it('accepts repeated collection instances with distinct semantic keys', () => {
        expect(() =>
            validateMarketingSnapshotLayouts(
                makeSnapshot([
                    collectionWidget(ids.collectionOne, 'logos', 'MarketingPageLogo', 'logos', 0),
                    collectionWidget(ids.collectionTwo, 'features', 'MarketingPageFeature', 'features', 1)
                ])
            )
        ).not.toThrow()
    })

    it('rejects an empty marketing composition with an explicit contract error', () => {
        expect(() => validateMarketingSnapshotLayouts(makeSnapshot([]))).toThrow('at least one active widget')
    })

    it('rejects a marketing composition whose widgets are all inactive', () => {
        const snapshot = makeSnapshot([collectionWidget(ids.collectionOne, 'logos', 'MarketingPageLogo', 'logos', 0)])
        snapshot.layoutZoneWidgets![0]!.isActive = false

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('at least one active widget')
    })

    it('accepts repeated widget keys and still rejects duplicate instance keys before restore', () => {
        const heroWidget = (id: string, instanceKey = 'hero') => ({
            id,
            layoutId: ids.layout,
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            sortOrder: 0,
            config: encodeWidgetConfigEnvelope(
                {
                    rendererConfig: { instanceKey, showLeadForm: false },
                    neutral: {
                        bindings: buildSingleTargetWidgetBinding(heroDefinition, 'content', {
                            entityKind: 'object',
                            entityCodename: 'MarketingPageHero',
                            semanticKey: 'default'
                        })
                    }
                },
                { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
            ),
            isActive: true
        })

        expect(() =>
            validateMarketingSnapshotLayouts(makeSnapshot([heroWidget(ids.heroOne), heroWidget(ids.heroTwo, 'hero-second')]))
        ).not.toThrow()
        expect(() => validateMarketingSnapshotLayouts(makeSnapshot([heroWidget(ids.heroOne), heroWidget(ids.heroTwo)]))).toThrow(
            'duplicate widget instance keys'
        )
    })

    it('rejects a source codename that is absent from the snapshot entities', () => {
        const snapshot = makeSnapshot([collectionWidget(ids.collectionOne, 'logos', 'MarketingPageLogo', 'logos', 0)])
        delete snapshot.entities[ids.logos]

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('source entity is missing')
    })

    it('rejects a marketing snapshot with no explicit default layout or widget array', () => {
        const snapshot = makeSnapshot([])
        delete snapshot.defaultLayoutId
        delete snapshot.layoutZoneWidgets

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('layout widgets are missing')
    })

    it('rejects duplicate scoped widget override identities and targets', () => {
        const snapshot = makeSnapshot([
            collectionWidget(ids.collectionOne, 'logos', 'MarketingPageLogo', 'logos', 0),
            collectionWidget(ids.collectionTwo, 'features', 'MarketingPageFeature', 'features', 1)
        ])
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.siteSettings,
                baseLayoutId: ids.layout,
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                description: null,
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0,
                compositionMode: 'overlay'
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.overrideOne,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.collectionOne,
                isDeletedOverride: false
            },
            {
                id: ids.overrideOne,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.collectionTwo,
                isDeletedOverride: false
            }
        ]

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('duplicate widget override ids')

        snapshot.layoutWidgetOverrides[1] = {
            id: ids.overrideTwo,
            layoutId: ids.scopedLayout,
            baseWidgetId: ids.collectionOne,
            isDeletedOverride: false
        }
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('duplicate widget override targets')
    })
})
