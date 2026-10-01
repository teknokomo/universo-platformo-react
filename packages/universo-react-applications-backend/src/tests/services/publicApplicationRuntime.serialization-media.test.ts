import { serializePublicMarketingRuntime } from '../../services/publicMarketingRuntime'
import { PublicMarketingMaterializationError } from '../../persistence/publicApplicationRuntimeStore'
import {
    createPublicMarketingEffectiveLayout,
    createPublicMarketingRecordLoader,
    createPublicMarketingWidget,
    publicApplicationRoute
} from './publicApplicationRuntime.fixtures'

const serializeImage = async (url: string | null) => {
    const heroWidget = createPublicMarketingWidget('marketing.hero', 'marketing-main', 0)
    const widget = createPublicMarketingWidget('marketing.image', 'marketing-main', 1)
    const fixtureLoader = createPublicMarketingRecordLoader()
    const loadRecords = jest.fn(async (request: Parameters<typeof fixtureLoader>[0]) => {
        const [record] = await fixtureLoader(request)
        if (request.widgetKey !== 'marketing.image') return [record!]
        return [
            {
                ...record!,
                data: {
                    ...record!.data,
                    resource: url ? { type: 'url', url, launchMode: 'inline' } : null,
                    altText: { en: 'Hero image', ru: 'Изображение первого экрана' },
                    decorative: false
                }
            }
        ]
    })

    return serializePublicMarketingRuntime({
        route: publicApplicationRoute,
        locale: 'en',
        effectiveLayout: createPublicMarketingEffectiveLayout([heroWidget, widget]),
        loadRecords
    })
}

describe('public marketing runtime media serialization', () => {
    it('returns a sanitized HTTPS resource from the bound image Object', async () => {
        const payload = await serializeImage('https://cdn.example.test/hero.webp')
        const image = payload.marketingPage.widgets.find((widget) => widget.widgetKey === 'marketing.image')

        expect(image?.widgetKey).toBe('marketing.image')
        if (image?.widgetKey === 'marketing.image') {
            expect(image.data.records[0]?.media).toMatchObject({
                kind: 'hero',
                resource: { type: 'url', url: 'https://cdn.example.test/hero.webp', launchMode: 'inline' },
                decorative: false,
                alt: { en: 'Hero image', ru: 'Изображение первого экрана' }
            })
        }
    })

    it.each(['http://images.example.test/hero.webp', 'https://user:password@cdn.example.test/hero.webp'])(
        'rejects unsafe public media URL %s',
        async (url) => {
            await expect(serializeImage(url)).rejects.toBeInstanceOf(PublicMarketingMaterializationError)
        }
    )

    it('does not fall back to inline media stored on widget config', async () => {
        const inlineOnlyWidget = {
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312391',
            zone: 'marketing-main',
            semanticRegion: 'main',
            widgetKey: 'marketing.image',
            sortOrder: 0,
            config: {
                instanceKey: 'hero-image',
                media: {
                    kind: 'hero',
                    resource: { type: 'url', url: 'https://cdn.example.test/legacy.webp', launchMode: 'inline' },
                    decorative: true
                }
            },
            isActive: true,
            version: 1
        }
        const loadRecords = jest.fn()

        await expect(
            serializePublicMarketingRuntime({
                route: publicApplicationRoute,
                locale: 'en',
                effectiveLayout: createPublicMarketingEffectiveLayout([inlineOnlyWidget]),
                loadRecords
            })
        ).rejects.toBeInstanceOf(PublicMarketingMaterializationError)
        expect(loadRecords).not.toHaveBeenCalled()
    })

    it('omits a bound Image widget when its optional ResourceSource is empty', async () => {
        const payload = await serializeImage(null)

        expect(payload.marketingPage.widgets.map(({ widgetKey }) => widgetKey)).toContain('marketing.hero')
        expect(payload.marketingPage.widgets.map(({ widgetKey }) => widgetKey)).not.toContain('marketing.image')
    })

    it('keeps optional relation-set child records empty when a Pricing source has no child rows', async () => {
        const pricingWidget = createPublicMarketingWidget('marketing.pricing', 'marketing-main', 0)
        const fixtureLoader = createPublicMarketingRecordLoader()
        const loadRecords = jest.fn(async (request: Parameters<typeof fixtureLoader>[0]) => {
            if (request.widgetKey === 'marketing.pricing' && request.query.slot === 'benefits') return []
            return fixtureLoader(request)
        })

        const payload = await serializePublicMarketingRuntime({
            route: publicApplicationRoute,
            locale: 'en',
            effectiveLayout: createPublicMarketingEffectiveLayout([pricingWidget]),
            loadRecords
        })
        const pricing = payload.marketingPage.widgets.find(({ widgetKey }) => widgetKey === 'marketing.pricing')

        expect(pricing?.widgetKey).toBe('marketing.pricing')
        if (pricing?.widgetKey === 'marketing.pricing') {
            expect(pricing.data.records.map(({ kind }) => kind)).toEqual(['sectionCopy', 'pricingTier'])
        }
        expect(loadRecords).toHaveBeenCalledWith(
            expect.objectContaining({ widgetKey: 'marketing.pricing', query: expect.objectContaining({ slot: 'benefits' }) })
        )
    })
})
