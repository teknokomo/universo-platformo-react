import { describe, expect, it } from 'vitest'
import { buildSingleTargetWidgetBinding, encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } from '@universo-react/types'

import {
    validateMarketingSnapshotLayouts,
    validateMarketingSnapshotTransportLayouts,
    validateSnapshotLayoutIdentities,
    validateSnapshotLayoutNeutralMetadata,
    type MarketingSnapshotLike
} from '../marketingSnapshot'

const ids = {
    layout: '0190a9b5-3cde-7abc-8def-0123456789a1',
    secondLayout: '0190a9b5-3cde-7abc-8def-0123456789a2',
    widget: '0190a9b5-3cde-7abc-8def-0123456789a3',
    secondWidget: '0190a9b5-3cde-7abc-8def-0123456789a4',
    scopedLayout: '0190a9b5-3cde-7abc-8def-0123456789a5',
    override: '0190a9b5-3cde-7abc-8def-0123456789a6',
    scopeEntity: '0190a9b5-3cde-7abc-8def-0123456789a7',
    heroEntity: '0190a9b5-3cde-7abc-8def-0123456789a8'
} as const

const heroDefinition = getLayoutWidgetDefinition('marketing.hero')
if (!heroDefinition?.bindingSlots?.[0]) throw new Error('Expected Hero binding slot definition')
const heroComponents = heroDefinition.bindingSlots[0].requirements.components.map((component) => ({
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

const localizedVlc = (en: string, ru?: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ...(ru === undefined ? {} : { ru: { content: ru, version: 1, isActive: true } })
    }
})

const heroRecordData = () => ({
    HeroKey: 'default',
    Title: localizedVlc('Build with confidence', 'Создавайте с уверенностью'),
    Accent: localizedVlc('A better way', 'Лучший подход'),
    Description: localizedVlc('A complete platform for your team.', 'Полная платформа для вашей команды.'),
    EmailLabel: localizedVlc('Email', 'Электронная почта'),
    EmailPlaceholder: localizedVlc('you@example.com', 'you@example.com'),
    PrimaryActionLabel: localizedVlc('Get started', 'Начать'),
    PrimaryAction: { kind: 'internal', path: '/sign-up', target: 'same-tab' },
    TermsText: localizedVlc('By continuing, you agree to our', 'Продолжая, вы соглашаетесь с'),
    TermsLinkLabel: localizedVlc('Terms of Service', 'Условиями использования'),
    TermsAction: { kind: 'anchor', href: '#terms' }
})

const getHeroRecordData = (snapshot: MarketingSnapshotLike): Record<string, unknown> => {
    const records = snapshot.elements?.[ids.heroEntity]
    const record = Array.isArray(records) ? records[0] : undefined
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Expected a Hero snapshot record')
    const data = (record as Record<string, unknown>).data
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected Hero snapshot record data')
    return data as Record<string, unknown>
}

const entities = {
    [ids.scopeEntity]: { kind: 'object', codename: 'MarketingPageSiteSettings' },
    logos: { kind: 'object', codename: 'MarketingPageLogo' },
    features: { kind: 'object', codename: 'MarketingPageFeature' },
    pricing: { kind: 'object', codename: 'MarketingPagePricing' },
    benefits: { kind: 'object', codename: 'MarketingPagePricingBenefit' },
    [ids.heroEntity]: {
        kind: 'object',
        codename: 'MarketingPageHero',
        config: {
            capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
            recordPolicy: {
                version: 1,
                denyDeleteWhenBound: true,
                immutableSemanticKeyWhenBound: true,
                runtimeMutation: 'deny',
                semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                requiredLocales: ['en', 'ru'],
                validatorKey: 'marketing.hero.v1'
            }
        },
        fields: heroComponents
    }
}

const collectionWidget = (id: string, instanceKey: string, sourceCodename = 'MarketingPageLogo') => ({
    id,
    layoutId: ids.layout,
    zone: 'marketing-main',
    widgetKey: 'marketing.collection',
    sortOrder: 0,
    config: {
        instanceKey,
        source: { entityCodename: sourceCodename, entityKind: 'object' },
        variant: sourceCodename === 'MarketingPageFeature' ? 'features' : 'logos'
    },
    isActive: true
})

const heroWidget = (id: string, instanceKey: string) => {
    const definition = getLayoutWidgetDefinition('marketing.hero')
    if (!definition) throw new Error('Expected marketing.hero widget definition')

    return {
        id,
        layoutId: ids.layout,
        zone: 'marketing-main',
        widgetKey: 'marketing.hero',
        sortOrder: 0,
        config: encodeWidgetConfigEnvelope(
            {
                rendererConfig: { instanceKey, showLeadForm: true },
                neutral: {
                    bindings: buildSingleTargetWidgetBinding(definition, 'content', {
                        entityKind: 'object',
                        entityCodename: 'MarketingPageHero',
                        semanticKey: 'default'
                    })
                }
            },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        ),
        isActive: true
    }
}

const createSnapshot = (widgets: unknown[] = [collectionWidget(ids.widget, 'logos')]): MarketingSnapshotLike => ({
    entities: {
        ...entities,
        [ids.heroEntity]: {
            ...entities[ids.heroEntity],
            config: {
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                recordPolicy: {
                    version: 1,
                    denyDeleteWhenBound: true,
                    immutableSemanticKeyWhenBound: true,
                    runtimeMutation: 'deny',
                    semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                    requiredLocales: ['en', 'ru'],
                    validatorKey: 'marketing.hero.v1'
                }
            },
            fields: heroComponents.map((field) => ({ ...field, validationRules: { ...field.validationRules } }))
        }
    },
    layouts: [
        {
            id: ids.layout,
            templateKey: 'marketing-page',
            name: { en: 'Marketing page' },
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
    elements: {
        [ids.heroEntity]: [{ data: heroRecordData() }]
    },
    layoutZoneWidgets: widgets
})

describe('validateMarketingSnapshotLayouts', () => {
    it.each([
        ['missing', undefined],
        ['runtime-writable', { ...entities[ids.heroEntity].config!.recordPolicy!, runtimeMutation: 'allow' }],
        ['deletable while bound', { ...entities[ids.heroEntity].config!.recordPolicy!, denyDeleteWhenBound: false }],
        ['mutable semantic key', { ...entities[ids.heroEntity].config!.recordPolicy!, immutableSemanticKeyWhenBound: false }],
        [
            'unprotected default key',
            {
                ...entities[ids.heroEntity].config!.recordPolicy!,
                semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['other'] }
            }
        ],
        ['missing required locale', { ...entities[ids.heroEntity].config!.recordPolicy!, requiredLocales: ['en'] }],
        ['unknown validator', { ...entities[ids.heroEntity].config!.recordPolicy!, validatorKey: 'other.v1' }]
    ])('rejects a Hero binding Entity with a %s record policy', (_label, policy) => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities?.[ids.heroEntity]
        if (heroEntity) {
            const config = (heroEntity.config ?? {}) as Record<string, unknown>
            heroEntity.config = { ...config, ...(policy === undefined ? {} : { recordPolicy: policy }) }
            if (policy === undefined) delete (heroEntity.config as Record<string, unknown>).recordPolicy
        }

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Entity record policy')
    })

    it('accepts valid repeatable collection widgets', () => {
        expect(() =>
            validateMarketingSnapshotLayouts(
                createSnapshot([
                    collectionWidget(ids.widget, 'logos'),
                    collectionWidget(ids.secondWidget, 'features', 'MarketingPageFeature')
                ])
            )
        ).not.toThrow()
    })

    it('accepts static image widgets without an entity source', () => {
        const image = {
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: {
                instanceKey: 'hero-image',
                media: {
                    kind: 'hero',
                    resource: { type: 'url', url: 'https://example.test/hero.webp', launchMode: 'inline' },
                    decorative: true
                }
            },
            isActive: true
        }

        expect(() => validateMarketingSnapshotLayouts(createSnapshot([collectionWidget(ids.widget, 'logos'), image]))).not.toThrow()
    })

    it('rejects an empty or inactive marketing composition', () => {
        expect(() => validateMarketingSnapshotLayouts(createSnapshot([]))).toThrow('at least one active widget')

        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.isActive = false
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('at least one active widget')
    })

    it('requires the referenced global layout to be explicitly default and active', () => {
        const snapshot = createSnapshot()
        snapshot.layouts![0]!.isDefault = false
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('active and marked as default')
    })

    it('accepts repeated widget keys and rejects duplicate instance keys', () => {
        expect(() =>
            validateMarketingSnapshotLayouts(createSnapshot([heroWidget(ids.widget, 'hero'), heroWidget(ids.secondWidget, 'hero-second')]))
        ).not.toThrow()
        expect(() =>
            validateMarketingSnapshotLayouts(
                createSnapshot([collectionWidget(ids.widget, 'same'), collectionWidget(ids.secondWidget, 'same')])
            )
        ).toThrow('duplicate widget instance keys')
    })

    it('requires a registered Entity binding for every Hero placement', () => {
        const missingBinding = createSnapshot([
            {
                ...heroWidget(ids.widget, 'hero'),
                config: { instanceKey: 'hero', showLeadForm: true }
            }
        ])
        expect(() => validateMarketingSnapshotLayouts(missingBinding)).toThrow('widget binding is invalid')

        const v3Binding = createSnapshot([heroWidget(ids.widget, 'hero')])
        v3Binding.versionEnvelope = { snapshotFormatVersion: 3 }
        expect(() => validateMarketingSnapshotLayouts(v3Binding)).not.toThrow()

        const missingEntity = createSnapshot([heroWidget(ids.widget, 'hero')])
        delete missingEntity.entities?.[ids.heroEntity]
        expect(() => validateMarketingSnapshotLayouts(missingEntity)).toThrow('binding entity is missing')
    })

    it('requires the bound semantic selector to resolve to exactly one snapshot record', () => {
        const missingTarget = createSnapshot([heroWidget(ids.widget, 'hero')])
        missingTarget.elements![ids.heroEntity] = []
        expect(() => validateMarketingSnapshotLayouts(missingTarget)).toThrow('binding target record is missing')

        const duplicateTarget = createSnapshot([heroWidget(ids.widget, 'hero')])
        duplicateTarget.elements![ids.heroEntity] = [{ data: { HeroKey: 'default' } }, { data: { HeroKey: 'default' } }]
        expect(() => validateMarketingSnapshotLayouts(duplicateTarget)).toThrow('binding target record is missing or ambiguous')
    })

    it.each([
        ['required Title', 'Title'],
        ['authored optional Accent', 'Accent']
    ])('rejects a bound Hero record whose %s omits a required locale', (_label, codename) => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        getHeroRecordData(snapshot)[codename] = localizedVlc('English only')

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('bound record data is invalid')
    })

    it('accepts null values for optional bound Hero fields', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const data = getHeroRecordData(snapshot)
        data.Accent = null
        data.TermsText = null
        data.TermsLinkLabel = null
        data.TermsAction = null

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('rejects malformed bound Hero actions without including their content in the error', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const invalidAction = { kind: 'external', url: 'javascript:alert("private")' }
        getHeroRecordData(snapshot).PrimaryAction = invalidAction

        let errorMessage = ''
        try {
            validateMarketingSnapshotLayouts(snapshot)
        } catch (error) {
            errorMessage = `${(error as Error).message} ${JSON.stringify((error as { details?: unknown }).details)}`
        }

        expect(errorMessage).toContain('bound record data is invalid')
        expect(errorMessage).not.toContain('javascript:alert')
    })

    it('rejects an incomplete optional Hero terms group', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        delete getHeroRecordData(snapshot).TermsAction

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('bound record data is invalid')
    })

    it('rejects bound Entities whose Components do not satisfy the registered slot contract', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) => (field.codename === 'Title' ? { ...field, dataType: 'NUMBER' } : field))
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it('rejects a bound Hero Entity whose required Component is nested', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) =>
            field.codename === 'PrimaryAction' ? { ...field, parentComponentId: ids.scopeEntity } : field
        )

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it('rejects bound optional Components that are marked required by the Entity', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) => (field.codename === 'Accent' ? { ...field, isRequired: true } : field))

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it.each(['PrimaryAction', 'TermsAction'])('rejects a bound Hero %s Component without its registered validator format', (codename) => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) =>
            field.codename === codename
                ? { ...field, validationRules: { ...(field.validationRules as Record<string, unknown>), format: 'untrusted' } }
                : field
        )

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it('rejects a bound Hero action Component that omits its registered validator format', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) => {
            if (field.codename !== 'PrimaryAction') return field
            const validationRules = { ...(field.validationRules as Record<string, unknown>) }
            delete validationRules.format
            return { ...field, validationRules }
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it('validates bound Hero configuration in scoped widget overrides', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                compositionMode: 'overlay',
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.widget,
                zone: 'marketing-main',
                config: heroWidget(ids.secondWidget, 'hero').config,
                isDeletedOverride: false
            }
        ]

        expect(() => validateMarketingSnapshotTransportLayouts(snapshot)).not.toThrow()

        snapshot.layoutWidgetOverrides[0]!.config = { instanceKey: 'hero' }
        expect(() => validateMarketingSnapshotTransportLayouts(snapshot)).toThrow('widget override binding is invalid')
    })

    it('rejects missing source entities, invalid zones, and non-v7 identifiers', () => {
        const missingSource = createSnapshot()
        delete missingSource.entities?.logos
        expect(() => validateMarketingSnapshotLayouts(missingSource)).toThrow('source entity is missing')

        const invalidZone = createSnapshot()
        invalidZone.layoutZoneWidgets![0]!.zone = 'marketing-footer'
        expect(() => validateMarketingSnapshotLayouts(invalidZone)).toThrow('placement is invalid')

        const invalidId = createSnapshot()
        invalidId.layouts![0]!.id = '0190a9b5-3cde-4abc-8def-0123456789a1'
        invalidId.defaultLayoutId = invalidId.layouts![0]!.id
        invalidId.layoutZoneWidgets![0]!.layoutId = invalidId.layouts![0]!.id
        expect(() => validateMarketingSnapshotLayouts(invalidId)).toThrow('UUID v7')
    })

    it('rejects a non-UUID-v7 source lineage reference before sync', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.sourceBaseWidgetId = 'source-widget'

        expect(() => validateSnapshotLayoutIdentities(snapshot)).toThrow('widget source base id')
    })

    it('rejects a UUID-v7 source lineage reference that is not a valid scoped overlay relation', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.sourceBaseWidgetId = ids.secondWidget

        expect(() => validateSnapshotLayoutIdentities(snapshot)).toThrow('source base reference is invalid')
    })

    it('validates scoped layouts and override targets against the global composition', () => {
        const missingComposition = createSnapshot()
        missingComposition.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        expect(() => validateMarketingSnapshotLayouts(missingComposition)).toThrow('composition mode')

        const snapshot = createSnapshot()
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                compositionMode: 'overlay',
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.widget,
                isDeletedOverride: false
            }
        ]
        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()

        snapshot.layoutWidgetOverrides![0]!.baseWidgetId = ids.secondWidget
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('missing global widget')
    })

    it('accepts independent marketing composition without a base layout', () => {
        const snapshot = createSnapshot()
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: null,
                compositionMode: 'independent',
                templateKey: 'marketing-page',
                name: { en: 'Independent marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutZoneWidgets![0]!.layoutId = ids.scopedLayout

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()

        snapshot.scopedLayouts[0]!.baseLayoutId = ids.layout
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('null base layout id')
    })

    it('accepts dashboard and marketing layouts in one snapshot', () => {
        const snapshot = createSnapshot()
        snapshot.layouts!.unshift({
            id: ids.secondLayout,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            config: {},
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        })
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.secondLayout,
            zone: 'center',
            widgetKey: 'overviewTitle',
            sortOrder: 0,
            config: {},
            isActive: true
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
        expect(() => validateSnapshotLayoutIdentities(snapshot)).not.toThrow()
    })

    it('accepts shared template widgets inside a marketing layout', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'languageSwitcher',
            sortOrder: 1,
            config: {},
            isActive: true
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('accepts the authentication header widget without a content source', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'marketing.auth',
            sortOrder: 1,
            config: { instanceKey: 'auth', showAuthActions: true },
            isActive: true
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('rejects a scoped override whose base widget belongs to another global layout', () => {
        const snapshot = createSnapshot()
        snapshot.layouts!.unshift({
            id: ids.secondLayout,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            config: {},
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        })
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.secondLayout,
            zone: 'center',
            widgetKey: 'overviewTitle',
            sortOrder: 0,
            config: {},
            isActive: true
        })
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                compositionMode: 'overlay',
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.secondWidget,
                isDeletedOverride: false
            }
        ]

        expect(() => validateSnapshotLayoutIdentities(snapshot)).toThrow('wrong layout')
    })

    it('rejects a dashboard scoped override with a foreign base widget in mixed templates', () => {
        const snapshot = createSnapshot()
        snapshot.layouts!.unshift({
            id: ids.secondLayout,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            config: {},
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        })
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.secondLayout,
            zone: 'center',
            widgetKey: 'overviewTitle',
            sortOrder: 0,
            config: {},
            isActive: true
        })
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.secondLayout,
                compositionMode: 'overlay',
                templateKey: 'dashboard',
                name: { en: 'Scoped dashboard' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.widget,
                isDeletedOverride: false
            }
        ]

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow(
            'Dashboard widget override base widget belongs to the wrong layout'
        )
    })

    it('requires pricing benefits when pricing widget benefits are enabled', () => {
        const pricing = createSnapshot([
            {
                id: ids.widget,
                layoutId: ids.layout,
                zone: 'marketing-main',
                widgetKey: 'marketing.pricing',
                sortOrder: 0,
                config: {
                    instanceKey: 'pricing',
                    source: { entityCodename: 'MarketingPagePricing', entityKind: 'object' },
                    showBenefits: true
                },
                isActive: true
            }
        ])
        delete pricing.entities?.benefits
        expect(() => validateMarketingSnapshotLayouts(pricing)).toThrow('source entity is missing')
    })
})

describe('validateMarketingSnapshotTransportLayouts', () => {
    it('rejects plain widgets with an unsupported template zone before render validation', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.zone = 'marketing-footer'

        expect(() => validateSnapshotLayoutNeutralMetadata(snapshot)).toThrow('Snapshot widget configuration is invalid')
    })

    it('validates neutral layout metadata and strips it before renderer validation', () => {
        const snapshot = createSnapshot()
        const neutralLayoutConfig = {
            __layout: {
                zoneSettings: {
                    'marketing-header': { position: 'flow' }
                }
            }
        }
        snapshot.layouts![0]!.config = neutralLayoutConfig
        snapshot.layoutConfig = neutralLayoutConfig
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'languageSwitcher',
            sortOrder: 1,
            config: { __layout: { placement: 'end' } },
            isActive: true
        })

        expect(() => validateMarketingSnapshotTransportLayouts(snapshot)).not.toThrow()
    })

    it('fails closed on application-only or duplicated transport metadata', () => {
        const sourceSettings = createSnapshot()
        sourceSettings.layouts![0]!.config = {
            __layout: {
                sourceZoneSettings: {
                    'marketing-header': { position: 'fixed' }
                }
            }
        }
        expect(() => validateMarketingSnapshotTransportLayouts(sourceSettings)).toThrow('application-only source zone settings')

        const duplicatedComposition = createSnapshot()
        duplicatedComposition.layouts![0]!.config = {
            __layout: {
                composition: {
                    mode: 'independent',
                    baseLayoutId: null
                }
            }
        }
        expect(() => validateMarketingSnapshotTransportLayouts(duplicatedComposition)).toThrow(
            'must not duplicate top-level composition metadata'
        )
    })

    it('fails closed on null layout and widget config envelopes', () => {
        const nullLayoutConfig = createSnapshot()
        nullLayoutConfig.layouts![0]!.config = null as never
        expect(() => validateMarketingSnapshotTransportLayouts(nullLayoutConfig)).toThrow('neutral metadata is invalid')

        const nullWidgetConfig = createSnapshot()
        nullWidgetConfig.layoutZoneWidgets![0]!.config = null as never
        expect(() => validateMarketingSnapshotTransportLayouts(nullWidgetConfig)).toThrow('widget configuration is invalid')
    })
})
