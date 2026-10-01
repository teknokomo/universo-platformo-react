import { encodeWidgetConfigEnvelope, getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'
import type {
    MarketingCollectionVariant,
    TemplateSeedZoneWidget,
    WidgetBindingSelector,
    WidgetEntityBindingEnvelope
} from '@universo-react/types'
import { defaultMarketingHeroBinding } from './marketing-page.hero'

type MarketingBindingSeedTarget = {
    readonly slot: string
    readonly entityCodename: string
    readonly selector:
        | { readonly kind: 'semantic-key'; readonly value: string }
        | { readonly kind: 'record-set' }
        | { readonly kind: 'relation-set' }
}

type ResolvedMarketingWidgetDefinition = NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>

const createBindingInput = (
    definition: ResolvedMarketingWidgetDefinition,
    targets: readonly MarketingBindingSeedTarget[]
): WidgetEntityBindingEnvelope => {
    const slotDefinitions = definition.bindingSlots ?? []
    if (slotDefinitions.length === 0) {
        throw new Error(`Marketing widget has no Entity binding slots: ${definition.key}`)
    }

    const boundSlots = new Set<string>()
    const slots = targets.map(({ slot: slotKey, entityCodename, selector: requestedSelector }) => {
        const slotDefinition = slotDefinitions.find(({ key }) => key === slotKey)
        if (!slotDefinition) {
            throw new Error(`Marketing binding slot is not registered: ${definition.key}/${slotKey}`)
        }
        if (boundSlots.has(slotKey)) {
            throw new Error(`Marketing binding slot is configured more than once: ${definition.key}/${slotKey}`)
        }
        boundSlots.add(slotKey)

        const selectorKind = slotDefinition.selectorKinds.find((kind) => kind === requestedSelector.kind)
        if (!selectorKind) {
            throw new Error(`Selector kind is not registered for marketing binding slot: ${definition.key}/${slotKey}`)
        }

        let selector: WidgetBindingSelector
        if (selectorKind === 'semantic-key') {
            if (requestedSelector.kind !== selectorKind) {
                throw new Error(`Semantic-key selector is malformed for marketing binding slot: ${definition.key}/${slotKey}`)
            }
            const semanticKey = slotDefinition.requirements.components.find(({ semanticKey: isSemanticKey }) => isSemanticKey)
            if (!semanticKey) {
                throw new Error(`Marketing binding slot has no registered semantic key: ${definition.key}/${slotKey}`)
            }
            selector = { kind: selectorKind, field: semanticKey.field, value: requestedSelector.value }
        } else if (selectorKind === 'record-set') {
            if (requestedSelector.kind !== selectorKind) {
                throw new Error(`Record-set selector is malformed for marketing binding slot: ${definition.key}/${slotKey}`)
            }
            selector = { kind: selectorKind }
        } else {
            if (requestedSelector.kind !== selectorKind || !slotDefinition.relation) {
                throw new Error(`Relation-set selector is not fully registered: ${definition.key}/${slotKey}`)
            }
            selector = { kind: selectorKind, parentSlot: slotDefinition.relation.parentSlot }
        }

        const entityKind = slotDefinition.requirements.entityKinds?.[0]
        if (!entityKind) {
            throw new Error(`Marketing binding slot has no registered Entity kind: ${definition.key}/${slotKey}`)
        }

        return {
            slot: slotKey,
            targets: [
                {
                    entityKind,
                    entityCodename,
                    selector,
                    projection: slotDefinition.requirements.components.map(({ field, componentCodename }) => ({
                        field,
                        componentCodename
                    }))
                }
            ]
        }
    })

    return { version: 1, slots }
}

const encodeBoundMarketingWidget = (
    widgetKey: string,
    zone: string,
    rendererConfig: Record<string, unknown>,
    createBindings: (definition: ResolvedMarketingWidgetDefinition) => WidgetEntityBindingEnvelope
): Record<string, unknown> => {
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition) {
        throw new Error(`Marketing widget is not registered: ${widgetKey}`)
    }

    const bindings = validateWidgetBindings(definition, createBindings(definition))
    return encodeWidgetConfigEnvelope(
        { rendererConfig, neutral: { bindings } },
        { templateKey: 'marketing-page', widgetKey, zone, rendererConfig, requireBindings: true }
    )
}

const encodeMarketingWidgetWithTargets = (
    widgetKey: string,
    zone: string,
    rendererConfig: Record<string, unknown>,
    targets: readonly MarketingBindingSeedTarget[]
): Record<string, unknown> =>
    encodeBoundMarketingWidget(widgetKey, zone, rendererConfig, (definition) => createBindingInput(definition, targets))

const semanticTarget = (slot: string, entityCodename: string, value: string): MarketingBindingSeedTarget => ({
    slot,
    entityCodename,
    selector: { kind: 'semantic-key', value }
})

const recordSetTarget = (slot: string, entityCodename: string): MarketingBindingSeedTarget => ({
    slot,
    entityCodename,
    selector: { kind: 'record-set' }
})

const relationSetTarget = (slot: string, entityCodename: string): MarketingBindingSeedTarget => ({
    slot,
    entityCodename,
    selector: { kind: 'relation-set' }
})

const collectionWidget = (variant: MarketingCollectionVariant, entityCodename: string, sortOrder: number): TemplateSeedZoneWidget => {
    const rendererConfig = {
        instanceKey: variant,
        variant,
        maxItems: 100,
        showTitle: true,
        showDescription: true
    }

    return {
        zone: 'marketing-main',
        widgetKey: 'marketing.collection',
        sortOrder,
        config: encodeMarketingWidgetWithTargets('marketing.collection', 'marketing-main', rendererConfig, [
            semanticTarget('section', 'MarketingPageSection', variant),
            recordSetTarget('items', entityCodename)
        ]),
        isActive: true
    }
}

/**
 * The marketing page is composed exclusively from persisted widget instances.
 * Entity-backed content is bound through the shared widget registry; section
 * records provide localized copy and do not control top-level order or visibility.
 */
export const marketingLayoutZoneWidgets: Record<string, TemplateSeedZoneWidget[]> = {
    'marketing-main': [
        {
            zone: 'marketing-header',
            widgetKey: 'marketing.brand',
            sortOrder: 0,
            config: encodeMarketingWidgetWithTargets('marketing.brand', 'marketing-header', { instanceKey: 'brand' }, [
                semanticTarget('site', 'MarketingPageSiteSettings', 'site-settings')
            ]),
            isActive: true
        },
        {
            zone: 'marketing-header',
            widgetKey: 'marketing.navigation',
            sortOrder: 1,
            config: encodeMarketingWidgetWithTargets(
                'marketing.navigation',
                'marketing-header',
                { instanceKey: 'navigation', maxItems: 24 },
                [recordSetTarget('items', 'MarketingPageNavigation')]
            ),
            isActive: true
        },
        {
            zone: 'marketing-header',
            widgetKey: 'marketing.auth',
            sortOrder: 2,
            config: {
                instanceKey: 'auth',
                showAuthActions: true
            },
            isActive: true
        },
        {
            zone: 'marketing-header',
            widgetKey: 'languageSwitcher',
            sortOrder: 3,
            config: {
                __layout: { placement: 'end' }
            },
            isActive: true
        },
        {
            zone: 'marketing-header',
            widgetKey: 'colorModeSwitcher',
            sortOrder: 4,
            config: {
                __layout: { placement: 'end' }
            },
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            sortOrder: 0,
            config: encodeBoundMarketingWidget(
                'marketing.hero',
                'marketing-main',
                { instanceKey: 'hero', showLeadForm: true },
                () => defaultMarketingHeroBinding
            ),
            isActive: true
        },
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: encodeMarketingWidgetWithTargets('marketing.image', 'marketing-main', { instanceKey: 'hero-image' }, [
                semanticTarget('content', 'MarketingPageImage', 'default')
            ]),
            isActive: true
        },
        collectionWidget('logos', 'MarketingPageLogo', 2),
        collectionWidget('features', 'MarketingPageFeature', 3),
        collectionWidget('testimonials', 'MarketingPageTestimonial', 4),
        collectionWidget('highlights', 'MarketingPageHighlight', 5),
        {
            zone: 'marketing-main',
            widgetKey: 'marketing.pricing',
            sortOrder: 6,
            config: encodeMarketingWidgetWithTargets(
                'marketing.pricing',
                'marketing-main',
                { instanceKey: 'pricing', maxItems: 24, showBenefits: true },
                [
                    semanticTarget('section', 'MarketingPageSection', 'pricing'),
                    recordSetTarget('tiers', 'MarketingPagePricing'),
                    relationSetTarget('benefits', 'MarketingPagePricingBenefit')
                ]
            ),
            isActive: true
        },
        collectionWidget('faq', 'MarketingPageFaq', 7),
        {
            zone: 'marketing-footer',
            widgetKey: 'marketing.footer',
            sortOrder: 0,
            config: encodeMarketingWidgetWithTargets(
                'marketing.footer',
                'marketing-footer',
                { instanceKey: 'footer', maxItems: 100, showNewsletter: true },
                [semanticTarget('site', 'MarketingPageSiteSettings', 'site-settings'), recordSetTarget('links', 'MarketingPageFooterLink')]
            ),
            isActive: true
        }
    ]
}
