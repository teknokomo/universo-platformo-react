const {
    schemaName,
    metahubId,
    widgetId,
    layoutId,
    objectId,
    recordId,
    sectionObjectId,
    createHarness,
    configureSourceFixtures,
    overrideRelationTarget
} = require('./widgetBindingService.fixtures')

describe('generic Metahub widget binding service', () => {
    it('rejects assignment when an empty relation source declares a different parent Object', async () => {
        const harness = createHarness({ widgetKey: 'marketing.pricing' })
        const fixtures = configureSourceFixtures(harness, [
            { slotKey: 'section', sourceKey: 'SeedSection', id: sectionObjectId },
            { slotKey: 'tiers', sourceKey: 'SeedTiers', id: objectId },
            { slotKey: 'benefits', sourceKey: 'SeedBenefits', id: '0190a9b5-3cde-7abc-8def-0123456789a7' }
        ])
        const childObject = fixtures.sourcesByCodename.get('SeedBenefits')
        harness.store.countRecords = jest.fn(async () => [])
        harness.store.listRelationCompatibleObjectIds = jest.fn(async (_db, _schema, childIds) => [...childIds])
        overrideRelationTarget(harness, childObject.id, {
            id: sectionObjectId,
            kind: 'object',
            codename: 'SeedSection'
        })

        await expect(
            harness.service.validateAssignedConfig(harness.executor, schemaName, {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.pricing',
                zone: harness.row.zone,
                config: harness.row.config
            })
        ).rejects.toThrow('Relation Component target does not match the selected parent source')

        expect(harness.store.listRelationCompatibleObjectIds).not.toHaveBeenCalled()
    })

    it('excludes empty relation sources whose declared REF target differs during discovery', async () => {
        const harness = createHarness({ widgetKey: 'marketing.pricing' })
        const fixtures = configureSourceFixtures(harness, [
            { slotKey: 'tiers', sourceKey: 'PricingTiers', id: objectId },
            { slotKey: 'benefits', sourceKey: 'PricingBenefits', id: recordId }
        ])
        const childObject = fixtures.sourcesByCodename.get('PricingBenefits')
        harness.store.listCandidates = jest.fn(async () => [childObject])
        harness.store.countRecords = jest.fn(async () => [])
        harness.store.listRelationCompatibleObjectIds = jest.fn(async (_db, _schema, childIds) => [...childIds])
        overrideRelationTarget(harness, childObject.id, {
            id: objectId,
            kind: 'page',
            codename: 'PricingTiers'
        })

        const result = await harness.service.discoverSources(
            { executor: harness.executor, metahubId },
            {
                layoutId,
                templateKey: 'marketing-page',
                widgetKey: 'marketing.pricing',
                slot: 'benefits',
                parentSourceKey: 'PricingTiers',
                selectedSourceKey: 'PricingBenefits'
            }
        )

        expect(result.sources).toEqual([])
        expect(result.selectedSource).toMatchObject({ sourceKey: 'PricingBenefits', recordsCount: 0, compatible: false })
        expect(harness.store.listRelationCompatibleObjectIds).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            [],
            objectId,
            'TierRef',
            true
        )
    })

    it('rejects saving an empty relation source whose declared REF target differs from the selected parent', async () => {
        const harness = createHarness({ widgetKey: 'marketing.pricing' })
        const fixtures = configureSourceFixtures(harness, [
            { slotKey: 'section', sourceKey: 'PricingSection', id: sectionObjectId },
            { slotKey: 'tiers', sourceKey: 'PricingTiers', id: objectId },
            { slotKey: 'benefits', sourceKey: 'PricingBenefits', id: recordId }
        ])
        const childObject = fixtures.sourcesByCodename.get('PricingBenefits')
        harness.store.listRelationCompatibleObjectIds = jest.fn(async (_db, _schema, childIds) => [...childIds])
        overrideRelationTarget(harness, childObject.id, {
            id: objectId,
            kind: 'object',
            codename: 'OtherParent'
        })

        await expect(
            harness.service.replaceBindings(
                { executor: harness.executor, metahubId },
                {
                    layoutId,
                    widgetId,
                    expectedVersion: 5,
                    bindings: [
                        { slot: 'section', sourceKey: 'PricingSection', selector: { kind: 'semantic-key', value: 'pricing' } },
                        { slot: 'tiers', sourceKey: 'PricingTiers', selector: { kind: 'record-set' } },
                        { slot: 'benefits', sourceKey: 'PricingBenefits', selector: { kind: 'relation-set' } }
                    ]
                }
            )
        ).rejects.toThrow('Relation Component target does not match the selected parent source')

        expect(harness.store.listRelationCompatibleObjectIds).not.toHaveBeenCalled()
        expect(harness.store.updateConfig).not.toHaveBeenCalled()
    })

    it('rejects an initial assignment whose related source is not linked to its selected parent source', async () => {
        const harness = createHarness({ widgetKey: 'marketing.pricing' })
        configureSourceFixtures(harness, [
            { slotKey: 'section', sourceKey: 'SeedSection', id: sectionObjectId },
            { slotKey: 'tiers', sourceKey: 'SeedTiers', id: objectId },
            { slotKey: 'benefits', sourceKey: 'SeedBenefits', id: '0190a9b5-3cde-7abc-8def-0123456789a7' }
        ])
        harness.store.listRelationCompatibleObjectIds = jest.fn(async () => [])

        await expect(
            harness.service.validateAssignedConfig(harness.executor, schemaName, {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.pricing',
                zone: harness.row.zone,
                config: harness.row.config
            })
        ).rejects.toThrow('Related records do not belong to the selected parent source')

        expect(harness.store.listRelationCompatibleObjectIds).toHaveBeenCalledWith(
            expect.anything(),
            schemaName,
            ['0190a9b5-3cde-7abc-8def-0123456789a7'],
            objectId,
            'TierRef',
            true
        )
    })
})
