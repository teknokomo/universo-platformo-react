import type { PublishedApplicationSnapshot, SnapshotEntityDefinition } from '../../services/applicationSyncContracts'
import {
    buildSingleTargetWidgetBinding,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    LAYOUT_WIDGET_DEFINITIONS,
    validateWidgetBindings
} from '@universo-react/types'
import type { SyncWidgetInput } from '../../persistence/applicationLayoutSyncStore'
import type { StoredRow } from './syncLayoutPersistenceHarness'

export const createSnapshot = (): PublishedApplicationSnapshot => ({
    entities: {},
    layouts: [
        {
            id: dashboardIds.layout,
            scopeEntityId: null,
            templateKey: 'dashboard',
            compositionMode: 'independent',
            baseLayoutId: null,
            name: { en: 'Main' },
            description: null,
            config: { showHeader: true },
            isActive: true,
            isDefault: true,
            sortOrder: 0
        }
    ],
    layoutZoneWidgets: [
        {
            id: dashboardIds.widget,
            layoutId: dashboardIds.layout,
            zone: 'center',
            widgetKey: 'detailsTable',
            sortOrder: 1,
            config: { datasource: { kind: 'records.list', sectionCodename: 'object-1' } },
            isActive: true
        }
    ],
    defaultLayoutId: dashboardIds.layout
})

export const dashboardIds = {
    layout: '0190a9b5-3cde-7abc-8def-1123456789a1',
    widget: '0190a9b5-3cde-7abc-8def-1123456789a2',
    scopedLayout: '0190a9b5-3cde-7abc-8def-1123456789a3',
    scopedWidget: '0190a9b5-3cde-7abc-8def-1123456789a4',
    homeLayout: '0190a9b5-3cde-7abc-8def-1123456789a5',
    courseLayout: '0190a9b5-3cde-7abc-8def-1123456789a6',
    homeEntity: '0190a9b5-3cde-7abc-8def-1123456789a7',
    courseEntity: '0190a9b5-3cde-7abc-8def-1123456789a8',
    baseWidget: '0190a9b5-3cde-7abc-8def-1123456789a9',
    courseWidget: '0190a9b5-3cde-7abc-8def-1123456789aa'
} as const

export const createScopedEntity = (id: string, codename: string): SnapshotEntityDefinition => ({
    id,
    kind: 'page',
    codename,
    presentation: {
        name: {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: {
                    content: codename,
                    version: 1,
                    isActive: true,
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z'
                }
            }
        }
    },
    fields: []
})

export const marketingIds = {
    layout: '0190a9b5-3cde-7abc-8def-0123456789a1',
    widget: '0190a9b5-3cde-7abc-8def-0123456789a2',
    siteSettings: '0190a9b5-3cde-7abc-8def-0123456789a3',
    logos: '0190a9b5-3cde-7abc-8def-0123456789a4',
    sharedWidget: '0190a9b5-3cde-7abc-8def-0123456789a5',
    hero: '0190a9b5-3cde-7abc-8def-0123456789a6',
    sections: '0190a9b5-3cde-7abc-8def-0123456789a7'
} as const

export const marketingCollectionDefinition = getLayoutWidgetDefinition('marketing.collection', { variant: 'logos' })
if (!marketingCollectionDefinition) throw new Error('Expected marketing.collection widget definition')
export const marketingSectionKeyComponent = marketingCollectionDefinition.bindingSlots
    ?.find(({ key }) => key === 'section')
    ?.requirements.components.find(({ semanticKey }) => semanticKey === true)
if (!marketingSectionKeyComponent) throw new Error('Expected marketing.collection section semantic key')

export const createBoundMarketingCollectionConfig = () => {
    const rendererConfig = { instanceKey: 'logos', variant: 'logos' }
    const definition = getLayoutWidgetDefinition('marketing.collection', rendererConfig)
    if (!definition) throw new Error('Expected marketing.collection widget definition')

    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: (definition.bindingSlots ?? []).map((slot) => {
            const selectorKind = slot.selectorKinds[0]
            const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
            const selector =
                selectorKind === 'semantic-key'
                    ? { kind: selectorKind, field: semanticComponent?.field ?? 'key', value: 'logos' }
                    : selectorKind === 'relation-set'
                    ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? 'items' }
                    : { kind: 'record-set' as const }
            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename: slot.key === 'section' ? 'MarketingPageSection' : 'MarketingPageLogo',
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })

    return encodeLayoutWidgetConfigEnvelope(
        { rendererConfig, neutral: { bindings } },
        { templateKey: 'marketing-page', widgetKey: 'marketing.collection', zone: 'marketing-main' }
    )
}

export const marketingBindingEntity = (slotKey: string, codename: string) => {
    const slot = marketingCollectionDefinition.bindingSlots?.find(({ key }) => key === slotKey)
    if (!slot) throw new Error(`Expected marketing.collection/${slotKey} binding slot`)
    return {
        kind: 'object',
        codename,
        config: {
            capabilities: Object.fromEntries(slot.requirements.entityCapabilities.map((capability) => [capability, { enabled: true }])),
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

export const marketingHeroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
export const marketingHeroContentSlot = marketingHeroDefinition?.bindingSlots?.find(({ key }) => key === 'content')
if (!marketingHeroContentSlot) throw new Error('Expected marketing.hero content binding slot')

export const marketingHeroComponents = marketingHeroContentSlot.requirements.components.map((component) => ({
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

export const localizedHeroValue = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ru: { content: ru, version: 1, isActive: true }
    }
})

export const marketingHeroRecordData = () => ({
    HeroKey: 'default',
    Title: localizedHeroValue('Build with confidence', 'Создавайте с уверенностью'),
    Accent: localizedHeroValue('A better way', 'Лучший подход'),
    Description: localizedHeroValue('A complete platform for your team.', 'Полная платформа для вашей команды.'),
    EmailLabel: localizedHeroValue('Email', 'Электронная почта'),
    EmailPlaceholder: localizedHeroValue('you@example.com', 'you@example.com'),
    PrimaryActionLabel: localizedHeroValue('Get started', 'Начать'),
    PrimaryAction: { kind: 'internal', path: '/sign-up', target: 'same-tab' },
    TermsText: localizedHeroValue('By continuing, you agree to our', 'Продолжая, вы соглашаетесь с'),
    TermsLinkLabel: localizedHeroValue('Terms of Service', 'Условиями использования'),
    TermsAction: { kind: 'anchor', href: '#terms' }
})

export const createMarketingSnapshot = (): PublishedApplicationSnapshot =>
    ({
        entities: {
            [marketingIds.siteSettings]: { kind: 'object', codename: 'MarketingPageSiteSettings' },
            [marketingIds.sections]: marketingBindingEntity('section', 'MarketingPageSection'),
            [marketingIds.logos]: marketingBindingEntity('items', 'MarketingPageLogo')
        },
        elements: {
            [marketingIds.sections]: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a8',
                    data: { [marketingSectionKeyComponent.componentCodename]: 'logos' }
                }
            ],
            [marketingIds.logos]: []
        },
        layouts: [
            {
                id: marketingIds.layout,
                templateKey: 'marketing-page',
                compositionMode: 'independent',
                baseLayoutId: null,
                name: { en: 'Marketing page' },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0
            }
        ],
        layoutZoneWidgets: [
            {
                id: marketingIds.widget,
                layoutId: marketingIds.layout,
                zone: 'marketing-main',
                widgetKey: 'marketing.collection',
                sortOrder: 0,
                config: createBoundMarketingCollectionConfig(),
                isActive: true
            }
        ],
        defaultLayoutId: marketingIds.layout,
        layoutConfig: {}
    } as unknown as PublishedApplicationSnapshot)

export const createMarketingHeroSnapshot = (): PublishedApplicationSnapshot =>
    ({
        entities: {
            [marketingIds.hero]: {
                kind: 'object',
                codename: 'MarketingPageHero',
                config: {
                    capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                    recordPolicy: {
                        version: 1,
                        semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                        denyDeleteWhenBound: true,
                        immutableSemanticKeyWhenBound: true,
                        runtimeMutation: 'deny',
                        requiredLocales: ['en', 'ru'],
                        coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
                    }
                },
                fields: marketingHeroComponents
            }
        },
        elements: { [marketingIds.hero]: [{ codename: 'default', data: marketingHeroRecordData() }] },
        layouts: [
            {
                id: marketingIds.layout,
                scopeEntityId: null,
                templateKey: 'marketing-page',
                compositionMode: 'independent',
                baseLayoutId: null,
                name: { en: 'Marketing page' },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0
            }
        ],
        layoutZoneWidgets: [createBoundHeroSyncWidget()],
        defaultLayoutId: marketingIds.layout
    } as unknown as PublishedApplicationSnapshot)

export const createBoundHeroSyncWidget = (): SyncWidgetInput => {
    const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
    if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')

    return {
        id: marketingIds.widget,
        layoutId: marketingIds.layout,
        zone: 'marketing-main',
        widgetKey: 'marketing.hero',
        sortOrder: 0,
        config: encodeLayoutWidgetConfigEnvelope(
            {
                rendererConfig: { instanceKey: 'hero', showLeadForm: true },
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
        isActive: true,
        sourceContentHash: 'hero-widget-current'
    }
}

export const modifiedSourceLayoutRow = (layoutId: string, templateKey: string, isDefault: boolean): StoredRow => ({
    id: layoutId,
    scope_entity_id: null,
    template_key: templateKey,
    name: { en: 'Locally modified layout' },
    description: null,
    config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
    is_active: true,
    is_default: isDefault,
    sort_order: 0,
    source_kind: 'metahub',
    source_layout_id: layoutId,
    source_snapshot_hash: 'snapshot-old',
    source_content_hash: 'source-old',
    local_content_hash: 'local-custom',
    sync_state: 'local_modified',
    is_source_excluded: false,
    _upl_deleted: false,
    _app_deleted: false,
    _upl_version: 2
})
