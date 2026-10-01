import {
    decodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    MARKETING_SAFE_HREF_PATTERN_SOURCE,
    validateWidgetBindings
} from '@universo-react/types'
import type { TemplateSeedZoneWidget, WidgetBindingTarget } from '@universo-react/types'
import { marketingLayoutZoneWidgets } from '../../domains/templates/data/marketing-page.layouts'
import { defaultMarketingHeroBinding, marketingPageHeroEntity } from '../../domains/templates/data/marketing-page.hero'
import { marketingPageImageEntity } from '../../domains/templates/data/marketing-page.image'
import { marketingPageTemplate } from '../../domains/templates/data/marketing-page.template'

const placements = Object.values(marketingLayoutZoneWidgets).flat()

const readConfig = (widget: TemplateSeedZoneWidget) =>
    decodeWidgetConfigEnvelope(widget.config ?? {}, {
        templateKey: 'marketing-page',
        widgetKey: widget.widgetKey,
        zone: widget.zone
    })

const getPlacement = (widgetKey: string, instanceKey: string): TemplateSeedZoneWidget => {
    const widget = placements.find(
        (candidate) => candidate.widgetKey === widgetKey && readConfig(candidate).rendererConfig.instanceKey === instanceKey
    )
    if (!widget) throw new Error(`Missing marketing placement: ${widgetKey}/${instanceKey}`)
    return widget
}

const getTarget = (widget: TemplateSeedZoneWidget, slotKey: string): WidgetBindingTarget => {
    const target = readConfig(widget).neutral.bindings?.slots.find(({ slot }) => slot === slotKey)?.targets[0]
    if (!target) throw new Error(`Missing binding target: ${widget.widgetKey}/${slotKey}`)
    return target
}

const containsLegacySource = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false
    if (Array.isArray(value)) return value.some(containsLegacySource)
    return Object.entries(value).some(([key, entry]) => key === 'source' || key === 'copySource' || containsLegacySource(entry))
}

describe('marketing page initial layout seed', () => {
    it('seeds every navigable Marketing Component with the shared safe href rules', () => {
        const expected = [
            ['MarketingPageNavigation', 'Href'],
            ['MarketingPagePricing', 'ActionHref'],
            ['MarketingPageSiteSettings', 'CopyrightHref'],
            ['MarketingPageSiteSettings', 'NewsletterActionHref'],
            ['MarketingPageFooterLink', 'Href']
        ] as const

        for (const [entityCodename, componentCodename] of expected) {
            const entity = marketingPageTemplate.seed.entities?.find(({ codename }) => codename === entityCodename)
            const component = entity?.components?.find(({ codename }) => codename === componentCodename)
            expect(component?.validationRules).toMatchObject({
                format: 'marketingHref',
                maxLength: 500,
                pattern: MARKETING_SAFE_HREF_PATTERN_SOURCE
            })
        }
    })

    it('preserves auto-generated hidden semantic keys for Hero and Image records', () => {
        for (const [entity, keyCodename] of [
            [marketingPageHeroEntity, 'HeroKey'],
            [marketingPageImageEntity, 'ImageKey']
        ] as const) {
            const key = entity.components.find(({ codename }) => codename === keyCodename)
            expect(key?.uiConfig).toMatchObject({ hidden: true, gridHidden: true, autoGenerateSemanticKey: true })
        }
    })

    it('validates every entity-backed placement against its resolved widget contract', () => {
        const entityBackedPlacements = placements.filter((widget) => {
            const definition = getLayoutWidgetDefinition(widget.widgetKey, readConfig(widget).rendererConfig)
            return (definition?.bindingSlots?.length ?? 0) > 0
        })

        expect(entityBackedPlacements).toHaveLength(11)

        for (const widget of entityBackedPlacements) {
            const decoded = readConfig(widget)
            const definition = getLayoutWidgetDefinition(widget.widgetKey, decoded.rendererConfig)
            expect(definition).toBeDefined()
            if (!definition) throw new Error(`Missing marketing widget definition: ${widget.widgetKey}`)

            expect(decoded.neutral.bindings).toBeDefined()
            const validated = validateWidgetBindings(definition, decoded.neutral.bindings)

            for (const binding of validated.slots) {
                const slotDefinition = definition.bindingSlots?.find(({ key }) => key === binding.slot)
                expect(slotDefinition).toBeDefined()
                if (!slotDefinition) throw new Error(`Missing binding slot definition: ${widget.widgetKey}/${binding.slot}`)

                const expectedProjection = slotDefinition.requirements.components
                    .map(({ field, componentCodename }) => ({ field, componentCodename }))
                    .sort((left, right) => (left.field < right.field ? -1 : left.field > right.field ? 1 : 0))
                for (const target of binding.targets) {
                    expect(target.projection).toEqual(expectedProjection)
                    expect(slotDefinition.selectorKinds).toContain(target.selector.kind)
                }
            }
        }
    })

    it('uses shared site settings for Brand and Footer and record sets for collection data', () => {
        for (const widgetKey of ['marketing.brand', 'marketing.footer']) {
            const widget = getPlacement(widgetKey, widgetKey === 'marketing.brand' ? 'brand' : 'footer')
            expect(getTarget(widget, 'site')).toMatchObject({
                entityKind: 'object',
                entityCodename: 'MarketingPageSiteSettings',
                selector: { kind: 'semantic-key', field: 'key', value: 'site-settings' }
            })
        }

        const navigation = getPlacement('marketing.navigation', 'navigation')
        expect(getTarget(navigation, 'items')).toMatchObject({
            entityKind: 'object',
            entityCodename: 'MarketingPageNavigation',
            selector: { kind: 'record-set' }
        })

        const footer = getPlacement('marketing.footer', 'footer')
        expect(getTarget(footer, 'links')).toMatchObject({
            entityCodename: 'MarketingPageFooterLink',
            selector: { kind: 'record-set' }
        })

        const collections = [
            ['logos', 'MarketingPageLogo'],
            ['features', 'MarketingPageFeature'],
            ['testimonials', 'MarketingPageTestimonial'],
            ['highlights', 'MarketingPageHighlight'],
            ['faq', 'MarketingPageFaq']
        ] as const

        for (const [variant, entityCodename] of collections) {
            const widget = getPlacement('marketing.collection', variant)
            expect(getTarget(widget, 'section')).toMatchObject({
                entityCodename: 'MarketingPageSection',
                selector: { kind: 'semantic-key', field: 'key', value: variant }
            })
            expect(getTarget(widget, 'items')).toMatchObject({
                entityCodename,
                selector: { kind: 'record-set' }
            })
        }
    })

    it('binds the default Image and complete Pricing relations through Entity records', () => {
        const image = getPlacement('marketing.image', 'hero-image')
        expect(readConfig(image).rendererConfig).toEqual({ instanceKey: 'hero-image' })
        expect(getTarget(image, 'content')).toMatchObject({
            entityCodename: 'MarketingPageImage',
            selector: { kind: 'semantic-key', field: 'key', value: 'default' }
        })

        const hero = getPlacement('marketing.hero', 'hero')
        expect(readConfig(hero).neutral.bindings).toEqual(defaultMarketingHeroBinding)

        const pricing = getPlacement('marketing.pricing', 'pricing')
        expect(getTarget(pricing, 'section')).toMatchObject({
            entityCodename: 'MarketingPageSection',
            selector: { kind: 'semantic-key', field: 'key', value: 'pricing' }
        })
        expect(getTarget(pricing, 'tiers')).toMatchObject({
            entityCodename: 'MarketingPagePricing',
            selector: { kind: 'record-set' }
        })
        expect(getTarget(pricing, 'benefits')).toMatchObject({
            entityCodename: 'MarketingPagePricingBenefit',
            selector: { kind: 'relation-set', parentSlot: 'tiers' }
        })
    })

    it('keeps the renderer defaults and physical placement order while removing legacy data config', () => {
        expect(placements.map(({ widgetKey, zone, sortOrder }) => [widgetKey, zone, sortOrder])).toEqual([
            ['marketing.brand', 'marketing-header', 0],
            ['marketing.navigation', 'marketing-header', 1],
            ['marketing.auth', 'marketing-header', 2],
            ['languageSwitcher', 'marketing-header', 3],
            ['colorModeSwitcher', 'marketing-header', 4],
            ['marketing.hero', 'marketing-main', 0],
            ['marketing.image', 'marketing-main', 1],
            ['marketing.collection', 'marketing-main', 2],
            ['marketing.collection', 'marketing-main', 3],
            ['marketing.collection', 'marketing-main', 4],
            ['marketing.collection', 'marketing-main', 5],
            ['marketing.pricing', 'marketing-main', 6],
            ['marketing.collection', 'marketing-main', 7],
            ['marketing.footer', 'marketing-footer', 0]
        ])

        expect(readConfig(getPlacement('marketing.brand', 'brand')).rendererConfig).toEqual({ instanceKey: 'brand' })
        expect(readConfig(getPlacement('marketing.navigation', 'navigation')).rendererConfig).toEqual({
            instanceKey: 'navigation',
            maxItems: 24
        })
        expect(readConfig(getPlacement('marketing.hero', 'hero')).rendererConfig).toEqual({ instanceKey: 'hero', showLeadForm: true })
        expect(readConfig(getPlacement('marketing.auth', 'auth')).rendererConfig).toEqual({
            instanceKey: 'auth',
            showAuthActions: true
        })
        expect(readConfig(getPlacement('marketing.pricing', 'pricing')).rendererConfig).toEqual({
            instanceKey: 'pricing',
            maxItems: 24,
            showBenefits: true
        })
        expect(readConfig(getPlacement('marketing.footer', 'footer')).rendererConfig).toEqual({
            instanceKey: 'footer',
            maxItems: 100,
            showNewsletter: true
        })
        for (const variant of ['logos', 'features', 'testimonials', 'highlights', 'faq'] as const) {
            expect(readConfig(getPlacement('marketing.collection', variant)).rendererConfig).toEqual({
                instanceKey: variant,
                variant,
                maxItems: 100,
                showTitle: true,
                showDescription: true
            })
        }

        for (const widget of placements) {
            expect(containsLegacySource(widget.config)).toBe(false)
        }
    })
})
