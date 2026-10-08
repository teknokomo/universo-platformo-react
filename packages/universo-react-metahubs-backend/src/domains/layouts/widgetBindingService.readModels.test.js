const {
    schemaName,
    metahubId,
    widgetId,
    layoutId,
    objectId,
    recordId,
    localized,
    projectionFor,
    sourceRecordData,
    createHarness
} = require('./widgetBindingService.fixtures')
const { encodeWidgetConfigEnvelope, validateWidgetBindings } = require('@universo-react/types')

describe('generic Metahub widget binding service', () => {
    it('lists semantic records by the registered key and excludes physical record identifiers', async () => {
        const harness = createHarness({ widgetKey: 'marketing.collection', rendererConfig: { variant: 'logos' } })
        const section = harness.definition.bindingSlots?.find(({ key }) => key === 'section')
        if (!section) throw new Error('Missing section slot')
        harness.chooseSource('section', 'MarketingPageSections')
        harness.store.listRecords = jest.fn(async () => [{ id: recordId, data: sourceRecordData(section, 'logos'), version: 3 }])

        const result = await harness.service.listSemanticRecords(
            { executor: harness.executor, metahubId },
            { layoutId, widgetId, slot: 'section', sourceKey: 'MarketingPageSections', locale: 'en' }
        )

        expect(result.records).toEqual([{ semanticKey: 'logos', label: 'section content' }])
        expect(harness.store.listRecords).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            objectId,
            'SectionKey',
            101,
            0,
            undefined,
            expect.arrayContaining(['SectionKey', 'Title', 'Description'])
        )
        const dto = JSON.stringify(result)
        expect(dto).not.toContain(widgetId)
        expect(dto).not.toContain(objectId)
        expect(dto).not.toContain(recordId)
    })

    it('resolves a selected semantic record separately from the bounded search page', async () => {
        const harness = createHarness({ widgetKey: 'marketing.hero' })
        const slot = harness.definition.bindingSlots?.find(({ key }) => key === 'content')
        if (!slot) throw new Error('Missing content slot')
        harness.chooseSource('content', 'MarketingHeroContent')
        harness.store.listRecords = jest.fn(async () => [])
        harness.store.findRecord = jest.fn(async () => [
            {
                id: recordId,
                data: {
                    HeroKey: 'hero-selected',
                    Title: localized('Welcome'),
                    Description: localized('Describe your product'),
                    EmailLabel: localized('Email'),
                    EmailPlaceholder: localized('you@example.com'),
                    PrimaryActionLabel: localized('Get started'),
                    PrimaryAction: { kind: 'internal', path: '/auth' }
                },
                version: 3
            }
        ])

        const result = await harness.service.discoverSemanticRecords(
            { executor: harness.executor, metahubId },
            {
                layoutId,
                widgetKey: 'marketing.hero',
                slot: 'content',
                sourceKey: 'MarketingHeroContent',
                search: ' no page match ',
                selectedSemanticKey: 'hero-selected'
            }
        )

        expect(result.records).toEqual([])
        expect(result.selectedRecord).toEqual({ semanticKey: 'hero-selected', label: 'Welcome' })
        expect(harness.store.listRecords).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            objectId,
            'HeroKey',
            101,
            0,
            'no page match',
            expect.arrayContaining(['HeroKey', 'Title', 'Description'])
        )
        expect(harness.store.findRecord).toHaveBeenCalledWith(expect.anything(), schemaName, objectId, 'HeroKey', 'hero-selected')
        expect(JSON.stringify(result)).not.toContain(objectId)
        expect(JSON.stringify(result)).not.toContain(recordId)
    })

    it('marks semantic-record pagination as truncated at the offset limit', async () => {
        const harness = createHarness({ widgetKey: 'marketing.collection', rendererConfig: { variant: 'logos' } })
        harness.chooseSource('section', 'MarketingPageSections')
        harness.store.listRecords = jest.fn(async () => Array.from({ length: 101 }, () => ({ id: recordId, data: {}, version: 1 })))

        const result = await harness.service.listSemanticRecords(
            { executor: harness.executor, metahubId },
            { layoutId, widgetId, slot: 'section', sourceKey: 'MarketingPageSections', offset: 10000 }
        )

        expect(result.records).toEqual([])
        expect(result.nextOffset).toBeNull()
        expect(result.truncated).toBe(true)
    })

    it('validates read-binding input before opening its transaction', async () => {
        const harness = createHarness({ widgetKey: 'marketing.collection', rendererConfig: { variant: 'logos' } })
        const context = { executor: harness.executor, metahubId }

        await expect(harness.service.readBinding(context, null)).rejects.toThrow()
        await expect(harness.service.readBinding(context, { layoutId, widgetId, unexpected: true })).rejects.toThrow()

        expect(harness.executor.transaction).not.toHaveBeenCalled()
    })

    it('returns a sanitized read model without persisted config or physical identifiers', async () => {
        const harness = createHarness({ widgetKey: 'marketing.hero' })
        harness.chooseSource('content', 'MarketingHeroContent')
        const heroSlot = harness.definition.bindingSlots?.[0]
        if (!heroSlot) throw new Error('Missing Hero binding slot')
        const data = sourceRecordData(heroSlot, 'hero-selected')
        data.PrimaryAction = { kind: 'internal', path: '/auth' }
        data.TermsAction = { kind: 'internal', path: '/auth' }
        const bindings = validateWidgetBindings(harness.definition, {
            version: 1,
            slots: [
                {
                    slot: 'content',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MarketingHeroContent',
                            selector: { kind: 'semantic-key', field: 'key', value: 'hero-selected' },
                            projection: projectionFor(heroSlot)
                        }
                    ]
                }
            ]
        })
        harness.row.config = encodeWidgetConfigEnvelope(
            { rendererConfig: {}, neutral: { bindings } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: harness.row.zone }
        )
        harness.store.findRecord = jest.fn(async () => [{ id: recordId, data, version: 2 }])

        const read = await harness.service.readBinding({ executor: harness.executor, metahubId }, { layoutId, widgetId })

        expect(read).toEqual({
            widgetKey: 'marketing.hero',
            version: 5,
            bindings: [
                {
                    slot: 'content',
                    sourceKey: 'MarketingHeroContent',
                    sourceName: 'content source',
                    selectorKind: 'semantic-key',
                    selectionLabel: 'content content',
                    semanticKey: 'hero-selected'
                }
            ]
        })
        expect(JSON.stringify(read)).not.toContain(widgetId)
        expect(JSON.stringify(read)).not.toContain(objectId)
        expect(JSON.stringify(read)).not.toContain(recordId)
        expect(JSON.stringify(read)).not.toContain('projection')
        expect(JSON.stringify(read)).not.toContain('config')
    })

    it('checks source usage within the resolved metahub schema and excludes the current widget by default', async () => {
        const harness = createHarness({ widgetKey: 'marketing.collection', rendererConfig: { variant: 'logos' } })
        harness.chooseSource('section', 'MarketingPageSections')

        await expect(
            harness.service.checkUsage(
                { executor: harness.executor, metahubId },
                { layoutId, widgetId, slot: 'section', sourceKey: 'MarketingPageSections', semanticKey: 'section-selected' }
            )
        ).resolves.toEqual({ inUse: true })

        expect(harness.store.hasUsage).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.objectContaining({
                entityKind: 'object',
                entityCodename: 'MarketingPageSections',
                semanticKey: 'section-selected',
                excludeWidgetId: widgetId
            })
        )
    })

    it('rejects a non-v7 metahub or widget identity before opening a transaction', async () => {
        const harness = createHarness({ widgetKey: 'marketing.collection', rendererConfig: { variant: 'logos' } })
        await expect(
            harness.service.listSources(
                { executor: harness.executor, metahubId: '550e8400-e29b-41d4-a716-446655440000' },
                { layoutId, widgetId, slot: 'items' }
            )
        ).rejects.toThrow()
        await expect(
            harness.service.listSources(
                { executor: harness.executor, metahubId },
                { layoutId, widgetId: '550e8400-e29b-41d4-a716-446655440000', slot: 'items' }
            )
        ).rejects.toThrow()
        expect(harness.executor.transaction).not.toHaveBeenCalled()
    })
})
