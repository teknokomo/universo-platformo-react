import { projectMetrics, projectSeries } from '../../services/effectiveWidgetRuntimeDataBindingProjectors'

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

const preparedWidget = (config: Record<string, unknown> = {}, widgetKey = 'sessionsChart') =>
    ({
        candidate: {
            id: 'placement-sessions-chart',
            widgetKey,
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

    it('normalizes finite numeric text returned by PostgreSQL for chart values and order', () => {
        const result = projectSeries(
            preparedWidget(),
            [
                {
                    ...seriesTarget,
                    data: { ...seriesTarget.data, value: '42.5', order: '1' }
                }
            ] as unknown as Parameters<typeof projectSeries>[1],
            'en'
        )

        expect(result).toMatchObject({ kind: 'series', labels: ['2026-09-25T00:00:00.000Z'], series: [{ values: [42.5] }] })
    })

    it.each(['', '1,000', 'Infinity', 'NaN', 'not-a-number'])('rejects non-numeric runtime text %j', (value) => {
        const result = projectSeries(
            preparedWidget(),
            [{ ...seriesTarget, data: { ...seriesTarget.data, value } }] as unknown as Parameters<typeof projectSeries>[1],
            'en'
        )

        expect(result).toBeNull()
    })
})

describe('projectMetrics', () => {
    it('normalizes finite numeric text returned by PostgreSQL for metric values', () => {
        const result = projectMetrics(
            preparedWidget({}, 'overviewCards'),
            [
                {
                    slot: 'metrics',
                    semanticKey: 'active-learners',
                    data: {
                        metricKey: 'active-learners',
                        title: { locales: { en: { content: 'Active learners' } } },
                        value: '128.5',
                        interval: { locales: { en: { content: 'This week' } } }
                    }
                }
            ] as unknown as Parameters<typeof projectMetrics>[1],
            'en'
        )

        expect(result).toEqual({ kind: 'metrics', cards: [{ label: 'Active learners', value: '128.5', trendLabel: 'This week' }] })
    })
})
