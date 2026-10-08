const { MetahubWidgetBindingsService } = require('./MetahubWidgetBindingsService')

describe('MetahubWidgetBindingsService adapter', () => {
    const executor = { query: jest.fn() }
    const metahubId = 'metahub-1'
    const layoutId = 'layout-1'
    const userId = 'user-1'

    it('passes the lookup without client-selected source authority', async () => {
        const discoverSources = jest.fn().mockResolvedValue({ sources: [] })
        const service = new MetahubWidgetBindingsService(executor, { discoverSources })

        await service.discoverWidgetBindingSources(
            metahubId,
            layoutId,
            { widgetKey: 'marketing.hero', slot: 'content', locale: 'ru' },
            userId
        )

        expect(discoverSources).toHaveBeenCalledWith(
            { executor, metahubId, userId },
            { widgetKey: 'marketing.hero', slot: 'content', locale: 'ru', layoutId }
        )
    })

    it('passes the provision request without client-selected source authority', async () => {
        const provisionSource = jest.fn().mockResolvedValue({ sourceKey: 'MarketingHeroContent' })
        const service = new MetahubWidgetBindingsService(executor, { provisionSource })
        const input = {
            widgetKey: 'marketing.hero',
            slot: 'content',
            templateSourceKey: 'MarketingHeroContentTemplate',
            name: 'Hero content',
            locale: 'en-GB'
        }

        await service.provisionWidgetBindingSource(metahubId, layoutId, input, userId)

        expect(provisionSource).toHaveBeenCalledWith({ executor, metahubId, userId }, { ...input, layoutId })
    })

    it('preserves the request scope while replacing a widget binding', async () => {
        const replaceBindings = jest.fn().mockResolvedValue({ widgetKey: 'marketing.hero', version: 2 })
        const service = new MetahubWidgetBindingsService(executor, { replaceBindings })
        const input = { expectedVersion: 1, bindings: [], locale: 'en-GB' }

        await service.updateWidgetBinding(metahubId, layoutId, 'widget-1', input, userId)

        expect(replaceBindings).toHaveBeenCalledWith({ executor, metahubId, userId }, { ...input, layoutId, widgetId: 'widget-1' })
    })
})
