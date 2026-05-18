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

    it('accepts localized row-count warnings for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'CourseItems'
                },
                rowCountWarning: {
                    threshold: 100,
                    message: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Large outline' },
                            ru: { content: 'Большая структура' }
                        }
                    }
                }
            })
        ).toMatchObject({
            rowCountWarning: {
                threshold: 100
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                rowCountWarning: {
                    threshold: 0,
                    message: 'Invalid warning'
                }
            })
        ).toThrow()
    })

    it('accepts generic relation builder widgets for parent-scoped child records', () => {
        expect(
            parseApplicationLayoutWidgetConfig('relationBuilder', {
                parentDatasource: {
                    kind: 'records.list',
                    sectionCodename: 'Courses'
                },
                parentLabel: 'Course',
                parentTitleFieldCodename: 'Title',
                panels: [
                    {
                        id: 'course-items',
                        title: 'Items',
                        datasource: {
                            kind: 'records.list',
                            sectionCodename: 'CourseItems'
                        },
                        parentFieldCodename: 'CourseId',
                        sortOrderFieldCodename: 'SortOrder',
                        enableRowReordering: true,
                        createDefaults: { TargetType: 'course' }
                    }
                ]
            })
        ).toMatchObject({
            parentDatasource: {
                kind: 'records.list',
                sectionCodename: 'Courses'
            },
            panels: [
                {
                    id: 'course-items',
                    parentFieldCodename: 'CourseId',
                    createDefaults: { TargetType: 'course' }
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('relationBuilder', {
                panels: []
            })
        ).toThrow()
    })

    it('accepts generic learner player widgets with static metadata target objects', () => {
        expect(
            parseApplicationLayoutWidgetConfig('learnerPlayer', {
                parentDatasource: {
                    kind: 'records.list',
                    sectionCodename: 'LearningTracks',
                    query: { sort: [{ field: 'Title', direction: 'asc' }] }
                },
                itemsDatasource: {
                    kind: 'records.list',
                    sectionCodename: 'TrackSteps',
                    query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                },
                parentLabel: {
                    _primary: 'en',
                    locales: {
                        en: { content: 'Learning Track' },
                        ru: { content: 'Учебный трек' }
                    }
                },
                parentFieldCodename: 'TrackId',
                itemTitleFieldCodename: 'Title',
                targetObjectCodename: 'Courses',
                targetRecordIdField: 'CourseId',
                completionTargetObjectCodename: 'TrackSteps',
                sequencePolicy: {
                    mode: 'sequential',
                    scopeFieldCodename: 'TrackId',
                    orderFieldCodename: 'SortOrder'
                },
                targetContent: {
                    titleFieldCodename: 'Title',
                    descriptionFieldCodename: 'Description'
                }
            })
        ).toMatchObject({
            parentDatasource: {
                kind: 'records.list',
                sectionCodename: 'LearningTracks'
            },
            itemsDatasource: {
                kind: 'records.list',
                sectionCodename: 'TrackSteps'
            },
            targetObjectCodename: 'Courses',
            targetRecordIdField: 'CourseId',
            completionTargetObjectCodename: 'TrackSteps'
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('learnerPlayer', {
                targetObjectCodename: ''
            })
        ).toThrow()
    })

    it('accepts generic records.union datasources for unified runtime content libraries', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    targets: [
                        {
                            sectionCodename: 'LearningResources',
                            displayType: 'page',
                            titleField: 'Title',
                            statusField: 'PublicationStatus'
                        },
                        {
                            sectionCodename: 'Courses',
                            displayType: 'course',
                            titleField: 'Title',
                            statusField: 'Status'
                        }
                    ],
                    query: {
                        libraryView: 'starred',
                        search: 'onboarding',
                        sort: [{ field: 'UpdatedAt', direction: 'desc' }]
                    }
                }
            })
        ).toMatchObject({
            datasource: {
                kind: 'records.union',
                targets: [
                    {
                        sectionCodename: 'LearningResources',
                        displayType: 'page'
                    },
                    {
                        sectionCodename: 'Courses',
                        displayType: 'course'
                    }
                ],
                query: {
                    libraryView: 'starred'
                }
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    targets: [{ displayType: 'page' }]
                }
            })
        ).toThrow(/Union datasource targets/)
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

    it('accepts generic details tab widgets and rejects recursive tab nesting', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTabs', {
                tabs: [
                    {
                        id: 'outline',
                        label: { en: { content: 'Outline' }, ru: { content: 'Structure' } },
                        widgets: [
                            {
                                widgetKey: 'columnsContainer',
                                config: {
                                    columns: [
                                        {
                                            id: 'outline-main',
                                            width: 12,
                                            widgets: [{ widgetKey: 'detailsTable' }]
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    {
                        id: 'reports',
                        label: 'Reports',
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    reportDefinition: {
                                        codename: 'OutlineReport',
                                        title: 'Outline report',
                                        datasource: {
                                            kind: 'records.list',
                                            sectionCodename: 'CourseItems'
                                        },
                                        columns: [{ field: 'Title', label: 'Title', type: 'text' }]
                                    }
                                }
                            }
                        ]
                    }
                ]
            })
        ).toMatchObject({
            tabs: [
                {
                    id: 'outline',
                    widgets: [{ widgetKey: 'columnsContainer' }]
                },
                {
                    id: 'reports',
                    widgets: [{ widgetKey: 'detailsTable' }]
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTabs', {
                tabs: [
                    {
                        id: 'broken',
                        widgets: [{ widgetKey: 'detailsTabs' }]
                    }
                ]
            })
        ).toThrow()
    })
})
