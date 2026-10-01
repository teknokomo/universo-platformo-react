const {
    schemaName,
    metahubId,
    widgetId,
    layoutId,
    objectId,
    recordId,
    sectionObjectId,
    projectionFor,
    sourceRecordData,
    createHarness,
    configureSourceFixtures
} = require('./widgetBindingService.fixtures')
const { decodeWidgetConfigEnvelope, encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } = require('@universo-react/types')

describe('generic Metahub widget binding service', () => {
    it('rejects binding replacement for a Marketing widget owned by a scoped overlay', async () => {
        const harness = createHarness({ widgetKey: 'marketing.hero' })
        harness.row.scope_entity_id = '0190a9b5-3cde-7abc-8def-0123456789a6'
        harness.row.base_layout_id = '0190a9b5-3cde-7abc-8def-0123456789a7'

        await expect(
            harness.service.replaceBindings(
                { executor: harness.executor, metahubId },
                { layoutId, widgetId, expectedVersion: 5, bindings: [] }
            )
        ).rejects.toThrow('Marketing overlay layouts must inherit Entity bindings from their base placements')

        expect(harness.store.updateConfig).not.toHaveBeenCalled()
    })

    it('replaces the complete pricing binding set in one versioned mutation', async () => {
        const harness = createHarness({ widgetKey: 'marketing.pricing' })
        const fixtures = configureSourceFixtures(harness, [
            { slotKey: 'section', sourceKey: 'MarketingPricingSections', id: sectionObjectId },
            { slotKey: 'tiers', sourceKey: 'PricingTiers', id: objectId },
            { slotKey: 'benefits', sourceKey: 'PricingBenefits', id: recordId }
        ])
        const result = await harness.service.replaceBindings(
            { executor: harness.executor, metahubId },
            {
                layoutId,
                widgetId,
                expectedVersion: 5,
                locale: 'en',
                bindings: [
                    { slot: 'section', sourceKey: 'MarketingPricingSections', selector: { kind: 'semantic-key', value: 'pricing' } },
                    { slot: 'tiers', sourceKey: 'PricingTiers', selector: { kind: 'record-set' } },
                    { slot: 'benefits', sourceKey: 'PricingBenefits', selector: { kind: 'relation-set' } }
                ]
            }
        )

        expect(result).toEqual({ widgetKey: 'marketing.pricing', version: 6 })
        expect(harness.store.updateConfig).toHaveBeenCalledTimes(1)
        expect(harness.store.updateConfig).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.objectContaining({ widgetId, layoutId, expectedVersion: 5 })
        )
        expect(harness.store.findRecord).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            fixtures.sourcesByCodename.get('MarketingPricingSections').id,
            'SectionKey',
            'pricing'
        )
        expect(harness.store.listRelationCompatibleObjectIds).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            [fixtures.sourcesByCodename.get('PricingBenefits').id],
            fixtures.sourcesByCodename.get('PricingTiers').id,
            'TierRef',
            true
        )

        const updated = decodeWidgetConfigEnvelope(harness.persistedConfigs[0], {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.pricing',
            zone: harness.row.zone
        })
        expect(updated.neutral.bindings?.slots.map(({ slot }) => slot).sort()).toEqual(['benefits', 'section', 'tiers'])
        expect(updated.neutral.bindings?.slots.find(({ slot }) => slot === 'benefits')?.targets[0].selector).toEqual({
            kind: 'relation-set',
            parentSlot: 'tiers'
        })
    })

    it('rolls back widget config and version if application layout synchronization fails', async () => {
        const transactionState = { layoutConfigVersion: 5 }
        const syncLayoutConfig = jest.fn(async () => {
            transactionState.layoutConfigVersion = 6
            throw new Error('Application layout synchronization failed')
        })
        const harness = createHarness({ widgetKey: 'marketing.hero', syncLayoutConfig, transactionState })
        harness.chooseSource('content', 'MarketingHeroContent')
        const contentSlot = harness.definition.bindingSlots?.find(({ key }) => key === 'content')
        if (!contentSlot) throw new Error('Missing Hero content binding slot')
        const selectedHeroData = sourceRecordData(contentSlot, 'hero-selected')
        selectedHeroData.PrimaryAction = { kind: 'internal', path: '/auth' }
        selectedHeroData.TermsAction = { kind: 'internal', path: '/auth' }
        harness.store.findRecord = jest.fn(async () => [{ id: recordId, data: selectedHeroData, version: 3 }])
        const originalConfig = harness.row.config

        await expect(
            harness.service.replaceBindings(
                { executor: harness.executor, metahubId },
                {
                    layoutId,
                    widgetId,
                    expectedVersion: 5,
                    bindings: [
                        { slot: 'content', sourceKey: 'MarketingHeroContent', selector: { kind: 'semantic-key', value: 'hero-selected' } }
                    ]
                }
            )
        ).rejects.toThrow('Application layout synchronization failed')

        expect(harness.executor.transaction).toHaveBeenCalledTimes(1)
        expect(harness.savepointExecutor.transaction).toHaveBeenCalledTimes(1)
        expect(harness.store.updateConfig).toHaveBeenCalledTimes(1)
        expect(syncLayoutConfig).toHaveBeenCalledTimes(1)
        expect(harness.row.config).toBe(originalConfig)
        expect(harness.row.widget_version).toBe(5)
        expect(harness.transactionState.layoutConfigVersion).toBe(5)
    })

    it('atomically changes collection variant with its new registry slot bindings and preserves other renderer settings', async () => {
        const harness = createHarness({
            widgetKey: 'marketing.collection',
            rendererConfig: { instanceKey: 'collection-instance', variant: 'logos', maxItems: 8 }
        })
        const nextDefinition = getLayoutWidgetDefinition('marketing.collection', { variant: 'features' })
        if (!nextDefinition) throw new Error('Missing features collection definition')
        const fixtures = configureSourceFixtures(
            harness,
            [
                { slotKey: 'section', sourceKey: 'MarketingFeatureSections', id: sectionObjectId },
                { slotKey: 'items', sourceKey: 'MarketingFeatures', id: objectId }
            ],
            nextDefinition
        )
        const current = decodeWidgetConfigEnvelope(harness.row.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.collection',
            zone: harness.row.zone
        })
        harness.row.config = encodeWidgetConfigEnvelope(
            { rendererConfig: { ...current.rendererConfig, maxItems: 8 }, neutral: current.neutral },
            { templateKey: 'marketing-page', widgetKey: 'marketing.collection', zone: harness.row.zone }
        )

        const result = await harness.service.replaceBindings(
            { executor: harness.executor, metahubId },
            {
                layoutId,
                widgetId,
                expectedVersion: 5,
                rendererConfig: { instanceKey: 'collection-instance', variant: 'features', maxItems: 8 },
                bindings: [
                    { slot: 'section', sourceKey: 'MarketingFeatureSections', selector: { kind: 'semantic-key', value: 'features' } },
                    { slot: 'items', sourceKey: 'MarketingFeatures', selector: { kind: 'record-set' } }
                ]
            }
        )

        expect(result).toEqual({ widgetKey: 'marketing.collection', version: 6 })
        expect(harness.store.updateConfig).toHaveBeenCalledTimes(1)
        expect(harness.store.updateConfig).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            expect.objectContaining({ widgetId, layoutId, expectedVersion: 5 })
        )
        const updated = decodeWidgetConfigEnvelope(harness.persistedConfigs[0], {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.collection',
            zone: harness.row.zone
        })
        expect(updated.rendererConfig).toMatchObject({ instanceKey: 'collection-instance', variant: 'features', maxItems: 8 })
        expect(updated.neutral.bindings?.slots.map(({ slot }) => slot).sort()).toEqual(['items', 'section'])
        expect(updated.neutral.bindings?.slots.find(({ slot }) => slot === 'items')?.targets[0].projection).toEqual(
            projectionFor(nextDefinition.bindingSlots.find(({ key }) => key === 'items'))
        )
        expect(
            fixtures.slotsByKey.get('items').requirements.components.some(({ componentCodename }) => componentCodename === 'FeatureKey')
        ).toBe(true)
    })
})
