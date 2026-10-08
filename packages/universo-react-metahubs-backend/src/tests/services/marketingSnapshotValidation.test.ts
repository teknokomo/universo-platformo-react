import {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    validateWidgetBindings
} from '@universo-react/types'
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
    heroEntity: '0190a9b5-3cde-7abc-8def-0123456789b4',
    sections: '0190a9b5-3cde-7abc-8def-0123456789b5'
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
        ...(component.pattern === undefined ? {} : { pattern: component.pattern }),
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

const validBindingRecordData = (
    components: readonly {
        readonly componentCodename: string
        readonly semanticKey?: boolean
        readonly localized: boolean
        readonly valueType: string
        readonly format?: string
    }[],
    semanticKey: string
): Record<string, unknown> =>
    Object.fromEntries(
        components.map((component) => {
            if (component.semanticKey) return [component.componentCodename, semanticKey]
            if (component.localized) return [component.componentCodename, localizedHeroText('Sample content', 'Тестовое содержимое')]
            if (component.valueType === 'number') return [component.componentCodename, 1]
            if (component.valueType === 'boolean') return [component.componentCodename, true]
            if (component.valueType === 'ref') return [component.componentCodename, ids.collectionOne]
            if (component.format === 'marketingAction') {
                return [component.componentCodename, { kind: 'internal', path: '/pricing', target: 'same-tab' }]
            }
            if (component.format === 'marketingMediaReference') {
                return [component.componentCodename, { type: 'url', url: 'https://example.test/marketing-media.svg', launchMode: 'inline' }]
            }
            if (component.valueType === 'json') return [component.componentCodename, {}]
            return [component.componentCodename, 'Sample content']
        })
    )

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

const collectionWidget = (id: string, instanceKey: string, sourceCodename: string, variant: 'logos' | 'features', sortOrder: number) => {
    const widgetKey = 'marketing.collection'
    const rendererConfig = { variant, maxItems: 12, showTitle: true, showDescription: true }
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition) throw new Error('Expected marketing.collection widget definition')

    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: (definition.bindingSlots ?? []).map((slot) => {
            const selectorKind = slot.selectorKinds[0]
            const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
            const selector =
                selectorKind === 'semantic-key'
                    ? { kind: selectorKind, field: semanticComponent?.field ?? 'key', value: variant }
                    : selectorKind === 'relation-set'
                    ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? 'items' }
                    : { kind: 'record-set' as const }
            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename: slot.key === 'section' ? 'MarketingPageSection' : sourceCodename,
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })

    return {
        id,
        layoutId: ids.layout,
        instanceKey,
        parentWidgetId: null,
        slotKey: null,
        zone: 'marketing-main',
        widgetKey,
        sortOrder,
        config: encodeWidgetConfigEnvelope(
            { rendererConfig, neutral: { bindings } },
            { templateKey: 'marketing-page', widgetKey, zone: 'marketing-main' }
        ),
        isActive: true
    }
}

const bindingSourceFixtures = (widgets: unknown[]) => {
    const sourceEntities: Record<string, Record<string, unknown>> = {}
    const sourceElements: Record<string, Array<Record<string, unknown>>> = {}
    const sourceIds: Record<string, string> = {
        MarketingPageSection: ids.sections,
        MarketingPageLogo: ids.logos,
        MarketingPageFeature: ids.features
    }
    let nextRecord = 1

    for (const value of widgets) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue
        const widget = value as Record<string, unknown>
        if (typeof widget.widgetKey !== 'string' || typeof widget.zone !== 'string') continue
        const decoded = decodeWidgetConfigEnvelope(widget.config, {
            templateKey: 'marketing-page',
            widgetKey: widget.widgetKey,
            zone: widget.zone,
            requireBindings: true
        })
        const definition = getLayoutWidgetDefinition(widget.widgetKey, decoded.rendererConfig)
        if (!definition || !decoded.neutral.bindings) continue

        for (const binding of decoded.neutral.bindings.slots) {
            const slot = definition.bindingSlots?.find(({ key }) => key === binding.slot)
            if (!slot) continue
            for (const target of binding.targets) {
                // The canonical Hero entity and record are supplied by makeSnapshot below.
                if (target.entityCodename === 'MarketingPageHero') continue
                const entityId = sourceIds[target.entityCodename]
                if (!entityId) throw new Error(`Unexpected binding source ${target.entityCodename}`)
                if (!sourceEntities[entityId]) {
                    sourceEntities[entityId] = {
                        kind: target.entityKind,
                        codename: target.entityCodename,
                        config: {
                            capabilities: Object.fromEntries(
                                slot.requirements.entityCapabilities.map((capability) => [capability, { enabled: true }])
                            ),
                            ...(slot.requirements.recordPolicy ? { recordPolicy: { version: 1, ...slot.requirements.recordPolicy } } : {})
                        },
                        fields: slot.requirements.components.map((component) => ({
                            codename: component.componentCodename,
                            dataType: component.valueType.toUpperCase(),
                            isRequired: component.required,
                            validationRules: {
                                ...(component.localized ? { localized: true } : {}),
                                ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
                                ...(component.semanticKey ? { unique: true } : {}),
                                ...(component.pattern === undefined ? {} : { pattern: component.pattern }),
                                ...(component.format !== undefined ? { format: component.format } : {})
                            }
                        }))
                    }
                }

                const records = sourceElements[entityId] ?? []
                if (target.selector.kind === 'semantic-key') {
                    const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
                    const componentCodename = semanticComponent?.componentCodename
                    if (
                        componentCodename &&
                        !records.some(
                            (record) => (record.data as Record<string, unknown> | undefined)?.[componentCodename] === target.selector.value
                        )
                    ) {
                        records.push({
                            id: `0190a9b5-3cde-7abc-8def-${String(nextRecord++).padStart(12, '0')}`,
                            data: validBindingRecordData(slot.requirements.components, target.selector.value)
                        })
                    }
                }
                sourceElements[entityId] = records
            }
        }
    }

    return { sourceEntities, sourceElements }
}

const makeSnapshot = (widgets: unknown[]): MetahubSnapshot => {
    const sources = bindingSourceFixtures(widgets)
    return {
        version: 1,
        versionEnvelope: {},
        generatedAt: '2026-09-04T00:00:00.000Z',
        metahubId: '0190a9b5-3cde-7abc-8def-0123456789a0',
        entities: {
            [ids.siteSettings]: objectEntity('MarketingPageSiteSettings'),
            ...sources.sourceEntities,
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
        elements: { ...sources.sourceElements, [ids.heroEntity]: [{ data: heroRecordData() }] },
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
    } as unknown as MetahubSnapshot
}

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

    it.each(['source', 'copySource'] as const)('rejects legacy marketing %s renderer configuration', (field) => {
        const snapshot = makeSnapshot([collectionWidget(ids.collectionOne, 'logos', 'MarketingPageLogo', 'logos', 0)])
        const widget = snapshot.layoutZoneWidgets?.[0]
        if (!widget) throw new Error('Expected marketing collection widget')
        const decoded = decodeWidgetConfigEnvelope(widget.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.collection',
            zone: 'marketing-main',
            requireBindings: true
        })
        widget.config = encodeWidgetConfigEnvelope(
            {
                rendererConfig: {
                    ...decoded.rendererConfig,
                    [field]: { entityKind: 'object', entityCodename: 'MarketingPageLogo' }
                },
                neutral: decoded.neutral
            },
            { templateKey: 'marketing-page', widgetKey: 'marketing.collection', zone: 'marketing-main' }
        )

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Snapshot widget configuration is invalid')
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
            instanceKey,
            parentWidgetId: null,
            slotKey: null,
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            sortOrder: 0,
            config: encodeWidgetConfigEnvelope(
                {
                    rendererConfig: { showLeadForm: false },
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

    it('rejects a binding target entity that is absent from the snapshot entities', () => {
        const snapshot = makeSnapshot([collectionWidget(ids.collectionOne, 'logos', 'MarketingPageLogo', 'logos', 0)])
        delete snapshot.entities[ids.logos]

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('binding entity is missing')
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
