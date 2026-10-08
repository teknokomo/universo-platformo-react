import { getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'
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
): WidgetEntityBindingEnvelope => {
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition) {
        throw new Error(`Marketing widget is not registered: ${widgetKey}`)
    }

    return validateWidgetBindings(definition, createBindings(definition))
}

const encodeMarketingWidgetWithTargets = (
    widgetKey: string,
    zone: string,
    rendererConfig: Record<string, unknown>,
    targets: readonly MarketingBindingSeedTarget[]
): WidgetEntityBindingEnvelope =>
    encodeBoundMarketingWidget(widgetKey, zone, rendererConfig, (definition) => createBindingInput(definition, targets))

const marketingSeedPlacement = (
    zone: string,
    widgetKey: string,
    instanceKey: string,
    sortOrder: number,
    rendererConfig: Record<string, unknown> = {},
    bindings?: WidgetEntityBindingEnvelope
): TemplateSeedZoneWidget => ({
    zone,
    widgetKey,
    instanceKey,
    parentInstanceKey: null,
    slotKey: null,
    sortOrder,
    rendererConfig,
    ...(bindings ? { bindings } : {}),
    isActive: true
})

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
        variant,
        maxItems: 100,
        showTitle: true,
        showDescription: true
    }

    return marketingSeedPlacement(
        'marketing-main',
        'marketing.collection',
        variant,
        sortOrder,
        rendererConfig,
        encodeMarketingWidgetWithTargets('marketing.collection', 'marketing-main', rendererConfig, [
            semanticTarget('section', 'MarketingPageSection', variant),
            recordSetTarget('items', entityCodename)
        ])
    )
}

/**
 * The marketing page is composed exclusively from persisted widget instances.
 * Entity-backed content is bound through the shared widget registry; section
 * records provide localized copy and do not control top-level order or visibility.
 */
export const marketingLayoutZoneWidgets: Record<string, TemplateSeedZoneWidget[]> = {
    'marketing-main': [
        marketingSeedPlacement(
            'marketing-header',
            'marketing.brand',
            'brand',
            0,
            {},
            encodeMarketingWidgetWithTargets('marketing.brand', 'marketing-header', {}, [
                semanticTarget('site', 'MarketingPageSiteSettings', 'site-settings')
            ])
        ),
        marketingSeedPlacement(
            'marketing-header',
            'marketing.navigation',
            'navigation',
            1,
            { maxItems: 24 },
            encodeMarketingWidgetWithTargets('marketing.navigation', 'marketing-header', { maxItems: 24 }, [
                recordSetTarget('items', 'MarketingPageNavigation')
            ])
        ),
        marketingSeedPlacement('marketing-header', 'marketing.auth', 'auth', 2, { showAuthActions: true }),
        marketingSeedPlacement('marketing-header', 'languageSwitcher', 'language-switcher', 3),
        marketingSeedPlacement('marketing-header', 'colorModeSwitcher', 'color-mode-switcher', 4),
        marketingSeedPlacement(
            'marketing-main',
            'marketing.hero',
            'hero',
            0,
            { showLeadForm: true },
            encodeBoundMarketingWidget('marketing.hero', 'marketing-main', { showLeadForm: true }, () => defaultMarketingHeroBinding)
        ),
        marketingSeedPlacement(
            'marketing-main',
            'marketing.image',
            'hero-image',
            1,
            {},
            encodeMarketingWidgetWithTargets('marketing.image', 'marketing-main', {}, [
                semanticTarget('content', 'MarketingPageImage', 'default')
            ])
        ),
        collectionWidget('logos', 'MarketingPageLogo', 2),
        collectionWidget('features', 'MarketingPageFeature', 3),
        collectionWidget('testimonials', 'MarketingPageTestimonial', 4),
        collectionWidget('highlights', 'MarketingPageHighlight', 5),
        marketingSeedPlacement(
            'marketing-main',
            'marketing.pricing',
            'pricing',
            6,
            { maxItems: 24, showBenefits: true },
            encodeMarketingWidgetWithTargets('marketing.pricing', 'marketing-main', { maxItems: 24, showBenefits: true }, [
                semanticTarget('section', 'MarketingPageSection', 'pricing'),
                recordSetTarget('tiers', 'MarketingPagePricing'),
                relationSetTarget('benefits', 'MarketingPagePricingBenefit')
            ])
        ),
        collectionWidget('faq', 'MarketingPageFaq', 7),
        marketingSeedPlacement(
            'marketing-footer',
            'marketing.footer',
            'footer',
            0,
            { maxItems: 100, showNewsletter: true },
            encodeMarketingWidgetWithTargets('marketing.footer', 'marketing-footer', { maxItems: 100, showNewsletter: true }, [
                semanticTarget('site', 'MarketingPageSiteSettings', 'site-settings'),
                recordSetTarget('links', 'MarketingPageFooterLink')
            ])
        )
    ]
}
