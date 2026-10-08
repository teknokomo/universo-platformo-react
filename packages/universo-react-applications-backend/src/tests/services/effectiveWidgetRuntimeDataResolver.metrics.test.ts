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
        const serialized = JSON.stringify(resolved.get('placement-overviewCards'))
        expect(serialized).not.toContain(metricObjectId)
        expect(serialized).not.toContain(recordId)
        expect(serialized).not.toContain(applicationId)
    })
})
