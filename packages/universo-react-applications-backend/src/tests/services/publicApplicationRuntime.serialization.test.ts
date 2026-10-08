import { serializePublicMarketingRuntime } from '../../services/publicMarketingRuntime'
import { PublicMarketingMaterializationError } from '../../persistence/publicApplicationRuntimeStore'
import {
    createPublicMarketingEffectiveLayout,
    createPublicMarketingRecordLoader,
    createPublicMarketingWidget,
    publicApplicationIdForTests,
    publicApplicationRoute
} from './publicApplicationRuntime.fixtures'

describe('public marketing runtime serialization', () => {
    it('accepts an empty independent entity-scoped marketing layout', async () => {
        const payload = await serializePublicMarketingRuntime({
            route: publicApplicationRoute,
            locale: 'en',
            effectiveLayout: createPublicMarketingEffectiveLayout([], 'entity'),
            loadRecords: jest.fn(createPublicMarketingRecordLoader())
        })

        expect(payload.marketingPage.widgets).toEqual([])
        expect(payload.marketingPage.headerWidgets).toEqual([])
        expect(payload.marketingPage.headerPosition).toBe('fixed')
    })

    it('rejects an empty global marketing layout', async () => {
        await expect(
            serializePublicMarketingRuntime({
                route: publicApplicationRoute,
                locale: 'en',
                effectiveLayout: createPublicMarketingEffectiveLayout([]),
                loadRecords: jest.fn(createPublicMarketingRecordLoader())
            })
        ).rejects.toBeInstanceOf(PublicMarketingMaterializationError)
    })

    it('resolves every entity-backed registry widget through the shared binding resolver and Marketing adapter', async () => {
        const widgets = [
            createPublicMarketingWidget('marketing.brand', 'marketing-header', 0),
            createPublicMarketingWidget('marketing.navigation', 'marketing-header', 1, { maxItems: 10 }),
            createPublicMarketingWidget('marketing.hero', 'marketing-main', 2, { showLeadForm: true }),
            createPublicMarketingWidget('marketing.image', 'marketing-main', 3),
            createPublicMarketingWidget('marketing.collection', 'marketing-main', 4, { variant: 'features', maxItems: 10 }),
            createPublicMarketingWidget('marketing.pricing', 'marketing-main', 5, { maxItems: 2, showBenefits: true }),
            createPublicMarketingWidget('marketing.footer', 'marketing-footer', 6, { maxItems: 10, showNewsletter: true })
        ]
        const loadRecords = jest.fn(createPublicMarketingRecordLoader())

        const payload = await serializePublicMarketingRuntime({
            route: publicApplicationRoute,
            locale: 'en',
            effectiveLayout: createPublicMarketingEffectiveLayout(widgets, 'global', 'flow'),
            loadRecords
        })

        expect(payload.templateKey).toBe('marketing-page')
        expect(payload.marketingPage.headerPosition).toBe('flow')
        expect(payload.marketingPage.widgets.map(({ widgetKey }) => widgetKey)).toEqual([
            'marketing.brand',
            'marketing.navigation',
            'marketing.hero',
            'marketing.image',
            'marketing.collection',
            'marketing.pricing',
            'marketing.footer'
        ])
        expect(payload.marketingPage.headerWidgets).toHaveLength(2)
        expect(loadRecords).toHaveBeenCalledTimes(11)
        expect(loadRecords.mock.calls.every(([request]) => request.widgetKey && request.query.projection.length > 0)).toBe(true)

        const hero = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.hero')
        expect(hero?.widgetKey).toBe('marketing.hero')
        if (hero?.widgetKey === 'marketing.hero') {
            expect(hero.data.records[0]?.content.title).toEqual({ en: 'Entity owned title', ru: 'RU Entity owned title' })
        }

        const image = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.image')
        if (image?.widgetKey === 'marketing.image') {
            expect(image.data.records[0]?.media.resource.url).toBe('https://cdn.example.test/hero.webp')
        }

        const collection = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.collection')
        if (collection?.widgetKey === 'marketing.collection') {
            expect(collection.data.records.map(({ kind }) => kind)).toEqual(['sectionCopy', 'feature'])
            expect(collection.data.records[1]).toMatchObject({ title: { en: 'Fast setup' }, description: { en: 'Start quickly' } })
        }

        const pricing = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.pricing')
        if (pricing?.widgetKey === 'marketing.pricing') {
            expect(pricing.data.records.map(({ kind }) => kind)).toEqual(['sectionCopy', 'pricingTier', 'pricingBenefit'])
            expect(pricing.data.records[1]).toMatchObject({ benefitKeys: ['priority-support'] })
        }

        const footer = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.footer')
        if (footer?.widgetKey === 'marketing.footer') {
            expect(footer.data.records.find(({ kind }) => kind === 'siteSettings')).toMatchObject({
                brandLogo: {
                    kind: 'logo',
                    resource: { url: 'https://cdn.example.test/brand.svg' }
                }
            })
        }

        const serialized = JSON.stringify(payload)
        expect(serialized).not.toContain(publicApplicationIdForTests)
        expect(serialized).not.toContain('CustomMarketing')
        expect(serialized).not.toContain('cmp_')
        expect(serialized).not.toContain('privateColumn')
        expect(serialized).not.toContain('recordId')
        expect(serialized).not.toContain('sourceContentHash')
        expect(serialized).not.toContain('copySource')
    })

    it('does not fall back to legacy source or copySource when an Entity binding is absent', async () => {
        const legacyHero = {
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312390',
            zone: 'marketing-main',
            semanticRegion: 'main',
            widgetKey: 'marketing.hero',
            instanceKey: 'hero-legacy',
            sortOrder: 0,
            config: {
                source: { entityKind: 'object', entityCodename: 'MarketingPageHero' },
                copySource: { entityKind: 'object', entityCodename: 'MarketingPageSection', recordKey: 'hero' }
            },
            isActive: true,
            version: 1
        }
        const loadRecords = jest.fn(createPublicMarketingRecordLoader())

        await expect(
            serializePublicMarketingRuntime({
                route: publicApplicationRoute,
                locale: 'en',
                effectiveLayout: createPublicMarketingEffectiveLayout([legacyHero]),
                loadRecords
            })
        ).rejects.toBeInstanceOf(PublicMarketingMaterializationError)
        expect(loadRecords).not.toHaveBeenCalled()
    })

    it('rejects unsafe Hero actions instead of emitting active content with an unsafe target', async () => {
        const widget = createPublicMarketingWidget('marketing.hero', 'marketing-main', 0)
        const baseLoader = createPublicMarketingRecordLoader()
        const loadRecords = jest.fn(async (request: Parameters<typeof baseLoader>[0]) => {
            const [record] = await baseLoader(request)
            if (request.query.slot === 'content') {
                return [{ ...record!, data: { ...record!.data, primaryAction: { kind: 'external', href: 'javascript:alert(1)' } } }]
            }
            return [record!]
        })

        await expect(
            serializePublicMarketingRuntime({
                route: publicApplicationRoute,
                locale: 'en',
                effectiveLayout: createPublicMarketingEffectiveLayout([widget]),
                loadRecords
            })
        ).rejects.toBeInstanceOf(PublicMarketingMaterializationError)
    })
})
