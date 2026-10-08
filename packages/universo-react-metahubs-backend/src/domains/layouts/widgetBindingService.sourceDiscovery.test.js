const {
    schemaName,
    metahubId,
    widgetId,
    layoutId,
    objectId,
    recordId,
    componentRows,
    createHarness
} = require('./widgetBindingService.fixtures')
const { WidgetBindingService } = require('./widgetBindingService')
const { RESERVED_LAYOUT_METADATA_KEY } = require('@universo-react/types')

describe('generic Metahub widget binding service', () => {
    it('provisions an empty source model only from a compatible source on a top-level Marketing layout', async () => {
        const harness = createHarness({ widgetKey: 'marketing.hero', rendererConfig: {} })
        harness.chooseSource('content', 'MarketingPageHero')
        harness.store.loadSourceLayout = jest.fn(async () => ({
            id: layoutId,
            template_key: 'marketing-page',
            scope_entity_id: null,
            base_layout_id: null
        }))
        const provisionSource = jest.fn(async () => ({ sourceKey: 'MarketingWidgetSourceNew', label: 'Alternative hero', recordsCount: 0 }))
        const service = new WidgetBindingService({ schemaService: harness.schemaService, store: harness.store, provisionSource })

        const result = await service.provisionSource(
            { executor: harness.executor, metahubId, userId: 'user-1' },
            {
                layoutId,
                widgetKey: 'marketing.hero',
                slot: 'content',
                locale: 'en',
                templateSourceKey: 'MarketingPageHero',
                name: '  Alternative   hero  '
            }
        )

        expect(result).toEqual({
            widgetKey: 'marketing.hero',
            slot: 'content',
            source: {
                sourceKey: 'MarketingWidgetSourceNew',
                label: 'Alternative hero',
                recordsCount: 0,
                selectorKinds: ['semantic-key']
            }
        })
        expect(provisionSource).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId,
                userId: 'user-1',
                templateSource: expect.objectContaining({ codename: 'MarketingPageHero' }),
                slot: expect.objectContaining({ key: 'content' }),
                name: 'Alternative hero',
                locale: 'en'
            })
        )
        expect(harness.store.loadSourceLayout).toHaveBeenCalledWith(harness.savepointExecutor, schemaName, layoutId, true)
    })

    it('rejects source provisioning on an inherited scoped layout', async () => {
        const harness = createHarness({ widgetKey: 'marketing.hero', rendererConfig: {} })
        harness.chooseSource('content', 'MarketingPageHero')
        harness.store.loadSourceLayout = jest.fn(async () => ({
            id: layoutId,
            template_key: 'marketing-page',
            scope_entity_id: recordId,
            base_layout_id: objectId
        }))
        const provisionSource = jest.fn()
        const service = new WidgetBindingService({ schemaService: harness.schemaService, store: harness.store, provisionSource })

        await expect(
            service.provisionSource(
                { executor: harness.executor, metahubId },
                {
                    layoutId,
                    widgetKey: 'marketing.hero',
                    slot: 'content',
                    templateSourceKey: 'MarketingPageHero',
                    name: 'Alternative hero'
                }
            )
        ).rejects.toThrow('This placement inherits or specializes its Entity bindings')
        expect(provisionSource).not.toHaveBeenCalled()
    })

    it('discovers only Objects whose capabilities, policy and Components satisfy the selected slot contract', async () => {
        const harness = createHarness({ widgetKey: 'marketing.collection', rendererConfig: { variant: 'logos' } })
        const slot = harness.definition.bindingSlots?.find(({ key }) => key === 'items')
        if (!slot) throw new Error('Missing items slot')
        harness.chooseSource('items', 'MarketingLogos')

        const result = await harness.service.listSources(
            { executor: harness.executor, metahubId },
            { layoutId, widgetId, slot: 'items', locale: 'en' }
        )

        expect(result).toEqual({
            widgetKey: 'marketing.collection',
            slot: 'items',
            selectorKinds: ['record-set'],
            sources: [{ sourceKey: 'MarketingLogos', label: 'items source', recordsCount: 3, selectorKinds: ['record-set'] }],
            nextOffset: null,
            truncated: false
        })
        expect(harness.store.listCandidates).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.objectContaining({
                entityCapabilities: ['dataSchema', 'records'],
                components: expect.arrayContaining([expect.objectContaining({ componentCodename: 'LogoKey' })])
            }),
            0,
            undefined
        )
        expect(harness.schemaService.ensureSchema).toHaveBeenCalledWith(metahubId, undefined)
        expect(harness.executor.transaction).toHaveBeenCalledTimes(1)
    })

    it('discovers Add sources with normalized backend search and validates marketing variants', async () => {
        const harness = createHarness({ widgetKey: 'marketing.collection', rendererConfig: { variant: 'logos' } })
        const slot = harness.definition.bindingSlots?.find(({ key }) => key === 'items')
        if (!slot) throw new Error('Missing items slot')
        harness.chooseSource('items', 'MarketingLogos')

        const result = await harness.service.discoverSources(
            { executor: harness.executor, metahubId },
            {
                layoutId,
                widgetKey: 'marketing.collection',
                slot: 'items',
                variant: 'logos',
                search: '  logo\tcompany  '
            }
        )

        expect(result.sources).toEqual([
            { sourceKey: 'MarketingLogos', label: 'items source', recordsCount: 3, selectorKinds: ['record-set'] }
        ])
        expect(harness.store.listCandidates).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.objectContaining({ components: expect.arrayContaining([expect.objectContaining({ componentCodename: 'LogoKey' })]) }),
            0,
            'logo company'
        )
        expect(JSON.stringify(result)).not.toContain(objectId)
        expect(JSON.stringify(result)).not.toContain(recordId)

        await expect(
            harness.service.discoverSources(
                { executor: harness.executor, metahubId },
                { layoutId, templateKey: 'marketing-page', widgetKey: 'marketing.collection', slot: 'items' }
            )
        ).rejects.toThrow()
        await expect(
            harness.service.discoverSources(
                { executor: harness.executor, metahubId },
                { layoutId, templateKey: 'marketing-page', widgetKey: 'marketing.collection', slot: 'items', variant: 'invalid' }
            )
        ).rejects.toThrow()
        await expect(
            harness.service.discoverSources(
                { executor: harness.executor, metahubId },
                { layoutId, templateKey: 'dashboard', widgetKey: 'marketing.collection', slot: 'items', variant: 'logos' }
            )
        ).rejects.toThrow()
    })

    it('accepts common PostgreSQL type aliases and still requires exact registered Component metadata', async () => {
        const harness = createHarness({ widgetKey: 'marketing.navigation' })
        const slot = harness.definition.bindingSlots?.find(({ key }) => key === 'items')
        if (!slot) throw new Error('Missing items slot')
        harness.chooseSource('items', 'MarketingNavigation')

        const aliases = {
            NavKey: 'VARCHAR(255)',
            Label: 'CHARACTER VARYING(120)',
            Href: 'TEXT',
            SectionKey: 'CHAR(64)',
            SortOrder: 'NUMERIC(12, 2)',
            IsVisible: 'BOOL'
        }
        const aliasedComponents = componentRows(objectId, slot).map((component) => ({
            ...component,
            data_type: aliases[component.codename] ?? component.data_type
        }))
        harness.store.listComponents = jest.fn(async () => aliasedComponents)

        const compatibleResult = await harness.service.listSources(
            { executor: harness.executor, metahubId },
            { layoutId, widgetId, slot: 'items' }
        )
        expect(compatibleResult.sources.map(({ sourceKey }) => sourceKey)).toEqual(['MarketingNavigation'])

        harness.store.listComponents = jest.fn(async () =>
            aliasedComponents.map((component) => (component.codename === 'NavKey' ? { ...component, is_required: false } : component))
        )
        const incompatibleResult = await harness.service.listSources(
            { executor: harness.executor, metahubId },
            { layoutId, widgetId, slot: 'items' }
        )
        expect(incompatibleResult.sources).toEqual([])
    })

    it('rejects relation source discovery when its required parent binding is absent', async () => {
        const harness = createHarness({ widgetKey: 'marketing.pricing' })
        const layoutMetadata = harness.row.config[RESERVED_LAYOUT_METADATA_KEY]
        harness.row.config[RESERVED_LAYOUT_METADATA_KEY] = {
            ...layoutMetadata,
            bindings: {
                ...layoutMetadata.bindings,
                slots: layoutMetadata.bindings.slots.filter(({ slot }) => slot !== 'tiers')
            }
        }

        await expect(
            harness.service.listSources({ executor: harness.executor, metahubId }, { layoutId, widgetId, slot: 'benefits' })
        ).rejects.toThrow('Widget binding metadata is not valid for its registered template')
        expect(harness.store.listCandidates).not.toHaveBeenCalled()
    })

    it('marks source pagination as truncated when the bounded offset cannot advance', async () => {
        const harness = createHarness({ widgetKey: 'marketing.navigation' })
        const candidates = Array.from({ length: 251 }, (_, index) => ({
            id: objectId,
            kind: 'object',
            codename: `IncompatibleSource${index}`,
            presentation: {},
            config: {},
            capabilities: {}
        }))
        harness.store.listCandidates = jest.fn(async () => candidates)
        harness.store.listComponents = jest.fn(async () => [])

        const result = await harness.service.listSources(
            { executor: harness.executor, metahubId },
            { layoutId, widgetId, slot: 'items', offset: 10000 }
        )

        expect(result.nextOffset).toBeNull()
        expect(result.truncated).toBe(true)
    })
})
