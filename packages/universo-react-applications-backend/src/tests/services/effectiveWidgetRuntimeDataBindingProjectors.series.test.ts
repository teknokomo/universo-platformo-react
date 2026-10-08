import { projectSeries } from '../../services/effectiveWidgetRuntimeDataBindingProjectors'

const seriesTarget = {
    slot: 'series',
    semanticKey: 'day-1',
    data: {
        seriesKey: 'learningActivity',
        seriesLabel: { locales: { en: { content: 'Learning activity' }, ru: { content: 'Учебная активность' } } },
        timestamp: '2026-09-25T00:00:00.000Z',
        value: 42,
        order: 1
    }
}

const preparedWidget = (config: Record<string, unknown> = {}) =>
    ({
        candidate: {
            id: 'placement-sessions-chart',
            widgetKey: 'sessionsChart',
            config,
            isActive: true,
            bindings: { version: 1, slots: [] }
        },
        definition: {},
        bindings: { version: 1, slots: [] },
        slotByKey: new Map(),
        targets: []
    } as unknown as Parameters<typeof projectSeries>[0])

describe('projectSeries', () => {
    it('does not inject an English chart title when presentation config has no title', () => {
        const result = projectSeries(preparedWidget(), [seriesTarget] as unknown as Parameters<typeof projectSeries>[1], 'ru')

        expect(result).toMatchObject({ kind: 'series', title: '' })
    })

    it('resolves a localized presentation title for the requested runtime locale', () => {
        const result = projectSeries(
            preparedWidget({ title: { en: 'Sessions', ru: 'Сессии' } }),
            [seriesTarget] as unknown as Parameters<typeof projectSeries>[1],
            'ru'
        )

        expect(result).toMatchObject({
            kind: 'series',
            title: 'Сессии',
            series: [{ id: 'learningActivity', label: 'Учебная активность', values: [42] }]
        })
    })
})
