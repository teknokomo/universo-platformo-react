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

        expect(
            parseApplicationLayoutWidgetConfig('overviewCards', {
                cards: [
                    {
                        title: 'Average progress',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'report.aggregation',
                            params: {
                                reportCodename: 'LearnerProgress',
                                aggregationAlias: 'AverageProgress'
                            }
                        }
                    }
                ]
            })
        ).toMatchObject({
            cards: [
                {
                    title: 'Average progress',
                    datasource: {
                        kind: 'metric',
                        metricKey: 'report.aggregation',
                        params: {
                            reportCodename: 'LearnerProgress',
                            aggregationAlias: 'AverageProgress'
                        }
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

    it('accepts sequence policy contracts for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'CourseModules'
                },
                sequencePolicy: {
                    mode: 'sequential',
                    orderFieldCodename: 'SortOrder',
                    completion: [{ kind: 'scoreAtLeast', field: 'ScorePercent', value: 80 }],
                    maxAttempts: 3
                }
            })
        ).toMatchObject({
            datasource: {
                kind: 'records.list',
                sectionCodename: 'CourseModules'
            },
            sequencePolicy: {
                mode: 'sequential',
                orderFieldCodename: 'SortOrder',
                completion: [{ kind: 'scoreAtLeast', field: 'ScorePercent', value: 80 }],
                maxAttempts: 3
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                sequencePolicy: {
                    mode: 'sequential',
                    completion: Array.from({ length: 17 }, () => ({ kind: 'manual' }))
                }
            })
        ).toThrow()
    })

    it('accepts inline report definition contracts for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                reportDefinition: {
                    codename: 'LearnerProgress',
                    title: 'Learner progress',
                    datasource: {
                        kind: 'records.list',
                        sectionCodename: 'ModuleProgress'
                    },
                    columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }],
                    filters: [{ field: 'Status', operator: 'equals', value: 'completed' }],
                    aggregations: [{ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' }]
                }
            })
        ).toMatchObject({
            reportDefinition: {
                codename: 'LearnerProgress',
                title: 'Learner progress',
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'ModuleProgress'
                },
                columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }]
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                reportDefinition: {
                    codename: 'BrokenReport',
                    title: 'Broken report',
                    datasource: {
                        kind: 'records.list',
                        sectionCodename: 'ModuleProgress'
                    },
                    columns: []
                }
            })
        ).toThrow()
    })

    it('accepts workflow action contracts for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                workflowActions: [
                    {
                        codename: 'AcceptSubmission',
                        title: 'Accept submission',
                        from: ['PendingReview'],
                        to: 'Accepted',
                        statusFieldCodename: 'ReviewStatus',
                        requiredCapabilities: ['workflow.execute'],
                        postingCommand: 'post',
                        confirmation: {
                            required: true,
                            title: 'Accept submission?',
                            message: 'This will update the review status.'
                        }
                    }
                ]
            })
        ).toMatchObject({
            workflowActions: [
                {
                    codename: 'AcceptSubmission',
                    title: 'Accept submission',
                    from: ['PendingReview'],
                    to: 'Accepted',
                    requiredCapabilities: ['workflow.execute'],
                    postingCommand: 'post'
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                workflowActions: [
                    {
                        codename: '',
                        title: '',
                        from: [],
                        to: '',
                        requiredCapabilities: []
                    }
                ]
            })
        ).toThrow()
    })

    it('accepts generic resource preview widget contracts with safe resource sources', () => {
        expect(
            parseApplicationLayoutWidgetConfig('resourcePreview', {
                title: 'Intro video',
                description: 'Reusable learning resource.',
                source: {
                    type: 'video',
                    url: 'https://cdn.example.com/intro.mp4',
                    mimeType: 'video/mp4'
                }
            })
        ).toMatchObject({
            title: 'Intro video',
            source: {
                type: 'video',
                url: 'https://cdn.example.com/intro.mp4',
                mimeType: 'video/mp4',
                launchMode: 'inline'
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('resourcePreview', {
                source: {
                    type: 'embed',
                    url: 'https://evil.example.com/embed'
                }
            })
        ).toThrow()

        expect(
            parseApplicationLayoutWidgetConfig('resourcePreview', {
                source: {
                    type: 'xapi',
                    packageDescriptor: {
                        standard: 'xAPI',
                        status: 'deferred',
                        launch: 'index.html'
                    }
                }
            })
        ).toMatchObject({
            source: {
                type: 'xapi',
                launchMode: 'inline'
            }
        })
    })
})
