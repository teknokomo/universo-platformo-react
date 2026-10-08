import './effectiveWidgetRuntimeDataResolver.testMocks'
import {
    createMockDbExecutor,
    getLayoutWidgetDefinition,
    metadataEnvelope,
    metadataForSlot,
    metricObjectId,
    recordId,
    resetEffectiveWidgetRuntimeDataResolverMocks,
    resolveEffectiveWidgetRuntimeData,
    runtimeStore,
    scope
} from './effectiveWidgetRuntimeDataResolver.testSupport'

describe('resolveEffectiveWidgetRuntimeData series projection', () => {
    beforeEach(resetEffectiveWidgetRuntimeDataResolverMocks)

    it('validates a localized chart title and projects a localized Entity-backed series label', async () => {
        const { executor } = createMockDbExecutor()
        const config = { title: { en: 'Sessions', ru: 'Сессии' }, interval: 'day' as const, maxPoints: 7 }
        const definition = getLayoutWidgetDefinition('sessionsChart', config)
        const seriesSlot = definition?.bindingSlots?.find(({ key }) => key === 'series')
        if (!seriesSlot) throw new Error('sessionsChart series slot is missing')
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(
            metadataEnvelope([metadataForSlot(metricObjectId, 'DashboardDemoSeries', seriesSlot)])
        )
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockResolvedValueOnce([
            {
                recordId,
                data: {
                    seriesKey: 'learningActivity',
                    seriesLabel: {
                        locales: { en: { content: 'Learning activity' }, ru: { content: 'Учебная активность' } }
                    },
                    timestamp: '2026-09-25T00:00:00.000Z',
                    value: 42,
                    order: 1
                }
            }
        ])

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            scope,
            [
                {
                    id: 'placement-sessionsChart',
                    widgetKey: 'sessionsChart',
                    config,
                    isActive: true,
                    bindings: {
                        version: 1,
                        slots: [
                            {
                                slot: 'series',
                                targets: [
                                    {
                                        entityKind: 'object',
                                        entityCodename: 'DashboardDemoSeries',
                                        selector: { kind: 'record-set' },
                                        projection: seriesSlot.requirements.components.map(({ field, componentCodename }) => ({
                                            field,
                                            componentCodename
                                        }))
                                    }
                                ]
                            }
                        ]
                    }
                }
            ],
            'ru'
        )

        expect(resolved.get('placement-sessionsChart')).toEqual({
            status: 'ready',
            data: {
                kind: 'series',
                title: 'Сессии',
                labels: ['2026-09-25T00:00:00.000Z'],
                series: [{ id: 'learningActivity', label: 'Учебная активность', values: [42] }]
            }
        })
    })
})
