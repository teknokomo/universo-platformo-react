import './effectiveWidgetRuntimeDataResolver.testMocks'
import {
    createMockDbExecutor,
    resetEffectiveWidgetRuntimeDataResolverMocks,
    getLayoutWidgetDefinition,
    runtimeStore,
    resolveEffectiveWidgetRuntimeData,
    recordId,
    applicationId,
    metricObjectId,
    recordSetCandidate,
    metadataForSlot,
    metadataEnvelope,
    scope
} from './effectiveWidgetRuntimeDataResolver.testSupport'

describe('resolveEffectiveWidgetRuntimeData overviewCards projection', () => {
    beforeEach(resetEffectiveWidgetRuntimeDataResolverMocks)

    it('projects bounded metric cards from Entity records without persistence identifiers', async () => {
        const { executor } = createMockDbExecutor()
        const definition = getLayoutWidgetDefinition('overviewCards', {})
        const metrics = definition?.bindingSlots?.find(({ key }) => key === 'metrics')
        if (!metrics) throw new Error('overviewCards metrics slot is missing')
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(
            metadataEnvelope([metadataForSlot(metricObjectId, 'DashboardDemoMetrics', metrics)])
        )
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockResolvedValueOnce([
            {
                recordId,
                data: {
                    metricKey: 'activeLearners',
                    title: { locales: { en: { content: 'Active learners' }, ru: { content: 'Активные учащиеся' } } },
                    interval: { locales: { en: { content: 'This week' } } },
                    value: 128,
                    order: 1,
                    privateId: applicationId
                }
            }
        ])

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            scope,
            [recordSetCandidate('overviewCards', 'metrics', 'DashboardDemoMetrics')],
            'en'
        )
        expect(resolved.get('placement-overviewCards')).toEqual({
            status: 'ready',
            data: { kind: 'metrics', cards: [{ label: 'Active learners', value: '128', trendLabel: 'This week' }] }
        })
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({
                slot: expect.objectContaining({ maxResolvedRecords: 4 }),
                query: expect.objectContaining({ ordered: expect.objectContaining({ limit: 4 }) })
            })
        )
        const serialized = JSON.stringify(resolved.get('placement-overviewCards'))
        expect(serialized).not.toContain(metricObjectId)
        expect(serialized).not.toContain(recordId)
        expect(serialized).not.toContain(applicationId)
    })

    it('rejects anonymous metrics whose display component metadata identifies a person', async () => {
        const { executor } = createMockDbExecutor()
        const definition = getLayoutWidgetDefinition('overviewCards', {})
        const metrics = definition?.bindingSlots?.find(({ key }) => key === 'metrics')
        if (!metrics) throw new Error('overviewCards metrics slot is missing')
        const metadata = metadataForSlot(metricObjectId, 'DashboardDemoMetrics', metrics)
        const unsafeMetadata = {
            ...metadata,
            components: metadata.components.map((component) =>
                component.codename === 'Title'
                    ? {
                          ...component,
                          presentation: {
                              name: { _primary: 'en', locales: { en: { content: 'Customer Name' } } }
                          }
                      }
                    : component
            )
        }
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(metadataEnvelope([unsafeMetadata]))

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            { ...scope, currentUserId: null, role: null, publishedRecordsOnly: true, publicRuntimePolicy: 'messenger-app' },
            [recordSetCandidate('overviewCards', 'metrics', 'DashboardDemoMetrics')],
            'en'
        )

        expect(resolved.get('placement-overviewCards')).toEqual({ status: 'stale-source' })
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).not.toHaveBeenCalled()
    })
})
