import { getLayoutWidgetDefinition, type WidgetBindingSlotDefinition } from '@universo-react/types'
import { getWidgetBindingRuntimeMutationIdentity, resolveWidgetBindingTargets } from '../../services/widgetBindingResolver'
import type { WidgetBindingRecordQuery } from '../../services/widgetBindingQuery'

const projectionFor = (slot: WidgetBindingSlotDefinition) =>
    slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))

describe('resolveWidgetBindingTargets', () => {
    it('resolves one semantic record and returns only registered logical fields', async () => {
        const definition = getLayoutWidgetDefinition('marketing.hero')
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'content')
        if (!definition || !slot) throw new Error('Marketing Hero widget definition is missing')
        const projection = projectionFor(slot)
        const bindings = {
            version: 1,
            slots: [
                {
                    slot: 'content',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'ArticleContent',
                            selector: { kind: 'semantic-key', field: 'key', value: 'article-welcome' },
                            projection
                        }
                    ]
                }
            ]
        }
        const row = {
            recordId: '0190a9b5-3cde-7abc-8def-0123456789b2',
            data: {
                key: 'article-welcome',
                title: { en: 'Welcome' },
                accent: { en: 'Hello' },
                description: { en: 'Article introduction' },
                emailLabel: { en: 'Email' },
                emailPlaceholder: { en: 'you@example.com' },
                primaryActionLabel: { en: 'Read more' },
                primaryAction: { kind: 'internal', path: '/articles' },
                termsText: { en: 'Terms' },
                termsLinkLabel: { en: 'Read terms' },
                termsAction: { kind: 'internal', path: '/terms' },
                internalPublicationId: 'must-not-leave-the-adapter'
            }
        }
        const loadRecords = jest.fn(() => [row])

        const resolved = await resolveWidgetBindingTargets(definition, bindings, loadRecords)

        expect(resolved).toEqual([
            {
                slot: 'content',
                entityKind: 'object',
                entityCodename: 'ArticleContent',
                semanticKey: 'article-welcome',
                data: {
                    key: 'article-welcome',
                    title: { en: 'Welcome' },
                    accent: { en: 'Hello' },
                    description: { en: 'Article introduction' },
                    emailLabel: { en: 'Email' },
                    emailPlaceholder: { en: 'you@example.com' },
                    primaryActionLabel: { en: 'Read more' },
                    primaryAction: { kind: 'internal', path: '/articles' },
                    termsText: { en: 'Terms' },
                    termsLinkLabel: { en: 'Read terms' },
                    termsAction: { kind: 'internal', path: '/terms' }
                }
            }
        ])
        expect(JSON.stringify(resolved)).not.toContain('0190a9b5')
        expect(loadRecords).toHaveBeenCalledWith(
            expect.objectContaining({
                slot: 'content',
                kind: 'semantic-key',
                selector: { componentCodename: 'HeroKey', value: 'article-welcome' },
                limit: 2
            })
        )
    })

    it('loads bounded visible record sets with registry order rules', async () => {
        const definition = getLayoutWidgetDefinition('marketing.collection', { variant: 'logos' })
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'items')
        if (!definition || !slot) throw new Error('Marketing collection items slot is missing')
        const bindings = {
            version: 1,
            slots: [
                {
                    slot: 'section',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MarketingPageSection',
                            selector: { kind: 'semantic-key', field: 'key', value: 'logos' },
                            projection: projectionFor(definition.bindingSlots?.find(({ key }) => key === 'section')!)
                        }
                    ]
                },
                {
                    slot: 'items',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'CustomerLogos',
                            selector: { kind: 'record-set' },
                            projection: projectionFor(slot)
                        }
                    ]
                }
            ]
        }
        const loadRecords = jest.fn((query: WidgetBindingRecordQuery) => {
            if (query.slot === 'section') return [{ recordId: 'section-1', data: { key: 'logos', title: { en: 'Logos' } } }]
            if (query.kind !== 'record-set') throw new Error('Expected a record-set query')
            expect(query.ordered).toEqual({ orderByComponentCodename: 'SortOrder', visibilityComponentCodename: 'IsVisible', limit: 100 })
            return [
                {
                    recordId: 'logo-1',
                    version: 9,
                    data: {
                        key: 'sydney',
                        imageLight: { type: 'url', url: 'https://example.test/sydney.svg' },
                        imageDark: { type: 'url', url: 'https://example.test/sydney-dark.svg' },
                        altText: { en: 'Sydney logo' },
                        order: 1,
                        visible: true
                    }
                }
            ]
        })

        const resolved = await resolveWidgetBindingTargets(definition, bindings, loadRecords)

        expect(resolved.map(({ slot, semanticKey }) => [slot, semanticKey])).toEqual([
            ['section', 'logos'],
            ['items', 'sydney']
        ])
        const itemTarget = resolved.find(({ slot }) => slot === 'items')
        expect(itemTarget).toBeDefined()
        if (itemTarget) expect(getWidgetBindingRuntimeMutationIdentity(itemTarget)).toEqual({ recordId: 'logo-1', version: 9 })
    })

    it('resolves relation sets against parent UUIDs and exposes only parent semantic keys', async () => {
        const definition = getLayoutWidgetDefinition('marketing.pricing')
        const section = definition?.bindingSlots?.find(({ key }) => key === 'section')
        const tiers = definition?.bindingSlots?.find(({ key }) => key === 'tiers')
        const benefits = definition?.bindingSlots?.find(({ key }) => key === 'benefits')
        if (!definition || !section || !tiers || !benefits) throw new Error('Marketing pricing binding slots are missing')
        const parentId = '0190a9b5-3cde-7abc-8def-0123456789b3'
        const bindings = {
            version: 1,
            slots: [
                {
                    slot: 'section',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MarketingPageSection',
                            selector: { kind: 'semantic-key', field: 'key', value: 'pricing' },
                            projection: projectionFor(section)
                        }
                    ]
                },
                {
                    slot: 'tiers',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MarketingPagePricing',
                            selector: { kind: 'record-set' },
                            projection: projectionFor(tiers)
                        }
                    ]
                },
                {
                    slot: 'benefits',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MarketingPagePricingBenefit',
                            selector: { kind: 'relation-set', parentSlot: 'tiers' },
                            projection: projectionFor(benefits)
                        }
                    ]
                }
            ]
        }
        const loadRecords = jest.fn((query: WidgetBindingRecordQuery) => {
            if (query.slot === 'section') return [{ recordId: 'section-1', data: { key: 'pricing', title: { en: 'Pricing' } } }]
            if (query.slot === 'tiers') {
                return [
                    {
                        recordId: parentId,
                        data: {
                            key: 'starter',
                            title: { en: 'Starter' },
                            price: 10,
                            period: { en: 'month' },
                            actionLabel: { en: 'Select' },
                            actionHref: '#signup',
                            featured: false,
                            order: 1,
                            visible: true
                        }
                    }
                ]
            }
            if (query.kind !== 'relation-set') throw new Error('Expected a relation-set query')
            expect(query.selector.parentRecordIds).toEqual([parentId])
            expect(query.selector.relationComponentCodename).toBe('TierRef')
            return [
                {
                    recordId: 'benefit-1',
                    data: { key: 'starter-support', tier: parentId, label: { en: 'Email support' }, order: 1, visible: true }
                }
            ]
        })

        const resolved = await resolveWidgetBindingTargets(definition, bindings, loadRecords)
        const benefit = resolved.find(({ slot }) => slot === 'benefits')

        expect(benefit).toEqual({
            slot: 'benefits',
            entityKind: 'object',
            entityCodename: 'MarketingPagePricingBenefit',
            semanticKey: 'starter-support',
            parentSemanticKey: 'starter',
            data: { key: 'starter-support', tier: 'starter', label: { en: 'Email support' }, order: 1, visible: true }
        })
        expect(JSON.stringify(resolved)).not.toContain(parentId)
    })
})
