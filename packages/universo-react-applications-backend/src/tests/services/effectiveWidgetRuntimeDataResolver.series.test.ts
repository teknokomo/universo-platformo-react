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

    it('rejects anonymous chart series whose metadata label identifies a person before reading records', async () => {
        const { executor } = createMockDbExecutor()
        const config = { title: 'Activity', maxPoints: 366 }
        const definition = getLayoutWidgetDefinition('sessionsChart', config)
        const seriesSlot = definition?.bindingSlots?.find(({ key }) => key === 'series')
        if (!seriesSlot) throw new Error('sessionsChart series slot is missing')
        const metadata = metadataForSlot(metricObjectId, 'DashboardDemoSeries', seriesSlot)
        const unsafeMetadata = {
            ...metadata,
            components: metadata.components.map((component) =>
                component.codename === 'SeriesLabel'
                    ? {
                          ...component,
                          presentation: {
                              name: { _primary: 'en', locales: { en: { content: 'Person Name' } } }
                          }
                      }
                    : component
            )
        }
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(metadataEnvelope([unsafeMetadata]))

        const candidate = {
            id: 'placement-sessionsChart-public',
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
        } as const
        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            {
                ...scope,
                currentUserId: null,
                role: null,
                publishedRecordsOnly: true,
                publicRuntimePolicy: 'messenger-app',
                maxResolvedRecordsPerSlot: 30
            },
            [candidate],
            'en'
        )

        expect(resolved.get('placement-sessionsChart-public')).toEqual({ status: 'stale-source' })
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).not.toHaveBeenCalled()
    })

    it('caps anonymous chart source reads at thirty points before querying records', async () => {
        const { executor } = createMockDbExecutor()
        const config = { title: 'Activity', maxPoints: 366 }
        const definition = getLayoutWidgetDefinition('sessionsChart', config)
        const seriesSlot = definition?.bindingSlots?.find(({ key }) => key === 'series')
        if (!seriesSlot) throw new Error('sessionsChart series slot is missing')
        ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(
            metadataEnvelope([metadataForSlot(metricObjectId, 'DashboardDemoSeries', seriesSlot)])
        )
        ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockResolvedValueOnce([
            {
                recordId,
                data: { seriesKey: 'activity', seriesLabel: 'Activity', timestamp: '2026-10-25T00:00:00.000Z', value: 1, order: 1 }
            }
        ])
        const candidate = {
            id: 'placement-sessionsChart-bounded',
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
        } as const

        const resolved = await resolveEffectiveWidgetRuntimeData(
            executor,
            {
                ...scope,
                currentUserId: null,
                role: null,
                publishedRecordsOnly: true,
                publicRuntimePolicy: 'messenger-app',
                maxResolvedRecordsPerSlot: 30,
                maxResolvedRecordsPerLayout: 256
            },
            [candidate],
            'en'
        )

        expect(resolved.get('placement-sessionsChart-bounded')).toMatchObject({ status: 'ready' })
        expect(runtimeStore.loadWidgetBindingRuntimeRecords).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({
                slot: expect.objectContaining({ maxResolvedRecords: 30 }),
                query: expect.objectContaining({ ordered: expect.objectContaining({ limit: 30 }) })
            })
        )
    })
})
