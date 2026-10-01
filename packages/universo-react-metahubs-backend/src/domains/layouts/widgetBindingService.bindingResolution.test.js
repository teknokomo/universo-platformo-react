const {
    metahubId,
    widgetId,
    layoutId,
    objectId,
    recordId,
    sectionObjectId,
    localized,
    requirementsPolicy,
    componentRows,
    projectionFor,
    sourceRecordData,
    createHarness
} = require('./widgetBindingService.fixtures')
const { encodeWidgetConfigEnvelope, validateWidgetBindings } = require('@universo-react/types')

describe('generic Metahub widget binding service', () => {
    it('reads record-set and relation-set bindings without returning physical identifiers or widget config', async () => {
        const harness = createHarness({ widgetKey: 'marketing.pricing' })
        const sectionSlot = harness.definition.bindingSlots?.find(({ key }) => key === 'section')
        const tiersSlot = harness.definition.bindingSlots?.find(({ key }) => key === 'tiers')
        const benefitsSlot = harness.definition.bindingSlots?.find(({ key }) => key === 'benefits')
        if (!sectionSlot || !tiersSlot || !benefitsSlot?.relation) throw new Error('Missing pricing binding slots')

        const sources = [
            {
                id: sectionObjectId,
                kind: 'object',
                codename: 'MarketingSections',
                presentation: { name: localized('section source') },
                config: { recordPolicy: requirementsPolicy(sectionSlot) },
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } }
            },
            {
                id: objectId,
                kind: 'object',
                codename: 'PricingTiers',
                presentation: { name: localized('tiers source') },
                config: {},
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } }
            },
            {
                id: recordId,
                kind: 'object',
                codename: 'PricingBenefits',
                presentation: { name: localized('benefits source') },
                config: {},
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } }
            }
        ]
        const sourceByCodename = new Map(sources.map((source) => [source.codename, source]))
        const sourceById = new Map(sources.map((source) => [source.id, source]))
        harness.store.findObjectByCodename = jest.fn(
            async (_db, _schema, _requirements, sourceKey) => sourceByCodename.get(sourceKey) ?? null
        )
        harness.store.loadObject = jest.fn(async (_db, _schema, id) => sourceById.get(id))
        harness.store.listComponents = jest.fn(async (_db, _schema, ids) =>
            ids.flatMap((id) => {
                const source = sourceById.get(id)
                const slot =
                    source?.codename === 'MarketingSections' ? sectionSlot : source?.codename === 'PricingTiers' ? tiersSlot : benefitsSlot
                return source && slot
                    ? componentRows(source.id, slot).map((component) =>
                          component.codename === 'TierRef' ? { ...component, data_type: 'UUID' } : component
                      )
                    : []
            })
        )
        harness.store.findRecord = jest.fn(async (_db, _schema, id, _keyCodename, semanticKey) =>
            id === sectionObjectId && semanticKey === 'pricing'
                ? [{ id: recordId, data: sourceRecordData(sectionSlot, 'pricing'), version: 1 }]
                : []
        )
        harness.query.mockImplementation(async (sql, params) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FOR UPDATE') && sql.includes('"_mhb_objects"')) {
                const source = sourceByCodename.get(params[1])
                return source ? [source] : []
            }
            return []
        })

        const bindings = validateWidgetBindings(harness.definition, {
            version: 1,
            slots: [
                {
                    slot: 'section',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MarketingSections',
                            selector: { kind: 'semantic-key', field: 'key', value: 'pricing' },
                            projection: projectionFor(sectionSlot)
                        }
                    ]
                },
                {
                    slot: 'tiers',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'PricingTiers',
                            selector: { kind: 'record-set' },
                            projection: projectionFor(tiersSlot)
                        }
                    ]
                },
                {
                    slot: 'benefits',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'PricingBenefits',
                            selector: { kind: 'relation-set', parentSlot: benefitsSlot.relation.parentSlot },
                            projection: projectionFor(benefitsSlot)
                        }
                    ]
                }
            ]
        })
        harness.row.config = encodeWidgetConfigEnvelope(
            { rendererConfig: {}, neutral: { bindings } },
            {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.pricing',
                zone: harness.row.zone
            }
        )

        const result = await harness.service.readBinding({ executor: harness.executor, metahubId }, { layoutId, widgetId, locale: 'en' })

        expect(Object.fromEntries(result.bindings.map(({ slot, selectorKind }) => [slot, selectorKind]))).toEqual({
            benefits: 'relation-set',
            section: 'semantic-key',
            tiers: 'record-set'
        })
        const selectionLabels = Object.fromEntries(result.bindings.map(({ slot, selectionLabel }) => [slot, selectionLabel]))
        expect(selectionLabels.section).toBe('section content')
        expect(selectionLabels.tiers).toBe('tiers source')
        expect(selectionLabels.benefits).toBe('benefits source')
        const dto = JSON.stringify(result)
        expect(dto).not.toContain(widgetId)
        expect(dto).not.toContain(objectId)
        expect(dto).not.toContain(recordId)
        expect(dto).not.toContain('config')
    })
})
