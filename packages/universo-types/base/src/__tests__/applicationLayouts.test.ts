import { describe, expect, it } from 'vitest'

import { parseApplicationLayoutWidgetConfig } from '../common/applicationLayouts'

describe('application layout widget config contracts', () => {
    it('accepts only implemented metric keys for overviewCards stat-card datasources', () => {
        expect(
            parseApplicationLayoutWidgetConfig('overviewCards', {
                cards: [
                    {
                        title: 'Courses',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: {
                                sectionCodename: 'Modules',
                                search: 'safety'
                            }
                        }
                    }
                ]
            })
        ).toMatchObject({
            cards: [
                {
                    title: 'Courses',
                    datasource: {
                        kind: 'metric',
                        metricKey: 'records.count'
                    }
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('overviewCards', {
                cards: [
                    {
                        title: 'Unsupported',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'unsupported.metric'
                        }
                    }
                ]
            })
        ).toThrow()
    })

    it('accepts typed records.list datasource contracts for chart widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('pageViewsChart', {
                title: 'Completions',
                value: '120',
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'ModuleProgress',
                    query: {
                        search: 'cohort',
                        sort: [{ field: 'period', direction: 'asc' }],
                        filters: [{ field: 'status', operator: 'equals', value: 'completed' }]
                    }
                },
                xField: 'period',
                maxRows: 12,
                series: [{ field: 'completed', label: 'Completed', stack: 'learning' }]
            })
        ).toMatchObject({
            title: 'Completions',
            datasource: {
                kind: 'records.list',
                sectionCodename: 'ModuleProgress'
            },
            xField: 'period',
            series: [{ field: 'completed', label: 'Completed' }]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('sessionsChart', {
                datasource: {
                    kind: 'metric',
                    metricKey: 'records.count'
                },
                xField: 'period',
                series: [{ field: 'completed' }]
            })
        ).toThrow()
    })
})
