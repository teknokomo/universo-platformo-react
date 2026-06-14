import { describe, expect, it } from 'vitest'

import { parseApplicationLayoutWidgetConfig } from '../common/applicationLayouts'

describe('application layout widget config contracts', () => {
    it('accepts generic PlayCanvas canvas widget configuration', () => {
        expect(
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                title: { en: 'Flight simulator', ru: 'Симулятор полета' },
                minHeight: 560,
                heightMode: 'fitViewport',
                moduleCodename: 'flight-runtime',
                serverModuleCodename: 'fixed-tick-runtime',
                attachedToKind: 'metahub',
                visibleFor: { sectionCodenames: ['FlightWorld'] },
                scene: {
                    controlledObjectId: 'ship',
                    targetObjectId: 'station',
                    cruiseSpeed: 36,
                    intentDistance: 720,
                    objects: [
                        {
                            id: 'ship',
                            position: { x: 0, y: 0, z: 0 },
                            scale: { x: 12, y: 4, z: 4 },
                            selectable: true
                        },
                        {
                            id: 'station',
                            position: { x: 72, y: 0, z: -48 },
                            scale: { x: 48, y: 16, z: 16 },
                            selectable: true,
                            guard: true
                        }
                    ]
                }
            })
        ).toMatchObject({
            minHeight: 560,
            heightMode: 'fitViewport',
            visibleFor: { sectionCodenames: ['FlightWorld'] },
            scene: {
                controlledObjectId: 'ship',
                targetObjectId: 'station',
                intentDistance: 720
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                minHeight: 120,
                scene: {
                    objects: []
                }
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                scene: {
                    controlledObjectId: 'missing-ship',
                    targetObjectId: 'station',
                    objects: [
                        {
                            id: 'ship',
                            position: { x: 0, y: 0, z: 0 },
                            scale: { x: 12, y: 4, z: 4 }
                        },
                        {
                            id: 'station',
                            position: { x: 72, y: 0, z: -48 },
                            scale: { x: 48, y: 16, z: 16 }
                        }
                    ]
                }
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                scene: {
                    controlledObjectId: 'ship',
                    objects: [
                        {
                            id: 'ship',
                            position: { x: 0, y: 0, z: 0 },
                            scale: { x: 12, y: 4, z: 4 }
                        },
                        {
                            id: 'ship',
                            position: { x: 72, y: 0, z: -48 },
                            scale: { x: 48, y: 16, z: 16 }
                        }
                    ]
                }
            })
        ).toThrow()
    })

    it('accepts PlayCanvas canvas widget binding to a published runtime manifest', () => {
        const checksum = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        expect(
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                title: { en: 'MMOOMM', ru: 'MMOOMM' },
                runtimeManifest: {
                    source: 'publishedManifest',
                    projectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
                    sceneId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d105',
                    checksum
                }
            })
        ).toMatchObject({
            runtimeManifest: {
                source: 'publishedManifest',
                projectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
                sceneId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d105',
                checksum,
                failClosed: true
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                runtimeManifest: {
                    source: 'publishedManifest',
                    projectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
                    checksum: 'not-a-checksum'
                }
            })
        ).toThrow()
    })

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

    it('accepts generic create targets for records.union detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    projectedFields: ['Instructor'],
                    targets: [
                        { sectionCodename: 'LearningResources', displayType: 'resource' },
                        { sectionCodename: 'Courses', displayType: 'course' }
                    ]
                },
                showSearch: true,
                targetFilters: [
                    {
                        id: 'resources',
                        label: 'Resources',
                        targetDisplayTypes: ['resource']
                    },
                    {
                        id: 'courses',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Courses' },
                                ru: { content: 'Курсы' }
                            }
                        },
                        targetSectionCodenames: ['Courses']
                    }
                ],
                createTargets: [
                    {
                        id: 'create-page',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Page' },
                                ru: { content: 'Страница' }
                            }
                        },
                        sectionCodename: 'LearningResources',
                        surface: 'dialog',
                        createDefaults: [
                            { fieldCodename: 'ResourceType', enumCodename: 'Page' },
                            { fieldCodename: 'Source', resourceSourceType: 'page' },
                            {
                                fieldCodename: 'NavigationMode',
                                contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                            }
                        ]
                    },
                    {
                        id: 'create-course',
                        label: 'Course',
                        objectCollectionCodename: 'Courses'
                    }
                ]
            })
        ).toMatchObject({
            showSearch: true,
            targetFilters: [
                { id: 'resources', targetDisplayTypes: ['resource'] },
                { id: 'courses', targetSectionCodenames: ['Courses'] }
            ],
            createTargets: [
                {
                    id: 'create-page',
                    sectionCodename: 'LearningResources',
                    surface: 'dialog',
                    createDefaults: [
                        { fieldCodename: 'ResourceType', enumCodename: 'Page' },
                        { fieldCodename: 'Source', resourceSourceType: 'page' },
                        {
                            fieldCodename: 'NavigationMode',
                            contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                        }
                    ]
                },
                { id: 'create-course', objectCollectionCodename: 'Courses' }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                createTargets: [{ id: 'invalid', label: 'Invalid' }]
            })
        ).toThrow()

        const extendedCreateTargets = parseApplicationLayoutWidgetConfig('detailsTable', {
            createTargets: Array.from({ length: 16 }, (_, index) => ({
                id: `create-target-${index + 1}`,
                label: `Target ${index + 1}`,
                sectionCodename: 'LearningResources'
            }))
        })
        expect(extendedCreateTargets.createTargets).toHaveLength(16)
        expect(extendedCreateTargets.createTargets?.[0]).toMatchObject({
            id: 'create-target-1',
            sectionCodename: 'LearningResources'
        })
        expect(extendedCreateTargets.createTargets?.[15]).toMatchObject({
            id: 'create-target-16',
            sectionCodename: 'LearningResources'
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                createTargets: Array.from({ length: 17 }, (_, index) => ({
                    id: `create-target-${index + 1}`,
                    label: `Target ${index + 1}`,
                    sectionCodename: 'LearningResources'
                }))
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                targetFilters: [{ id: 'invalid-filter', label: 'Invalid filter' }]
            })
        ).toThrow()

        for (const fieldCodename of ['OwnerUserId', 'workspace_id', 'ProgressPercent', 'LifecycleState', '_upl_created_by']) {
            expect(() =>
                parseApplicationLayoutWidgetConfig('detailsTable', {
                    createTargets: [
                        {
                            id: `unsafe-default-${fieldCodename}`,
                            label: 'Unsafe',
                            sectionCodename: 'LearningResources',
                            createDefaults: [{ fieldCodename, value: 'attacker' }]
                        }
                    ]
                })
            ).toThrow()
        }

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                createTargets: [
                    {
                        id: 'ambiguous-default',
                        label: 'Ambiguous',
                        sectionCodename: 'LearningResources',
                        createDefaults: [
                            {
                                fieldCodename: 'ResourceType',
                                value: 'Page',
                                enumCodename: 'Page',
                                contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                            }
                        ]
                    }
                ]
            })
        ).toThrow()

        for (const contextPath of ['learningContent.__proto__.navigationMode', 'learningContent[0].navigationMode']) {
            expect(() =>
                parseApplicationLayoutWidgetConfig('detailsTable', {
                    createTargets: [
                        {
                            id: `unsafe-context-${contextPath}`,
                            label: 'Unsafe',
                            sectionCodename: 'Courses',
                            createDefaults: [{ fieldCodename: 'NavigationMode', contextPath }]
                        }
                    ]
                })
            ).toThrow()
        }
    })

    it('accepts generic library row actions for records.union detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    projectedFields: ['Instructor'],
                    targets: [
                        { sectionCodename: 'LearningResources', displayType: 'resource' },
                        { sectionCodename: 'Courses', displayType: 'course' }
                    ]
                },
                rowActions: [
                    {
                        id: 'toggle-starred',
                        kind: 'library.toggle',
                        libraryView: 'starred',
                        icon: 'star',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Add to starred' },
                                ru: { content: 'Добавить в избранное' }
                            }
                        },
                        activeLabel: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Remove from starred' },
                                ru: { content: 'Убрать из избранного' }
                            }
                        }
                    },
                    {
                        id: 'toggle-shared',
                        kind: 'library.toggle',
                        libraryView: 'shared',
                        icon: 'share',
                        principalTarget: 'workspaceMember',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Share' },
                                ru: { content: 'Поделиться' }
                            }
                        },
                        activeLabel: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Share' },
                                ru: { content: 'Поделиться' }
                            }
                        },
                        dialogTitle: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Share content' },
                                ru: { content: 'Поделиться контентом' }
                            }
                        },
                        targetLabel: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Workspace member' },
                                ru: { content: 'Участник рабочего пространства' }
                            }
                        }
                    },
                    {
                        id: 'move-project',
                        kind: 'field.updateWithTarget',
                        fieldCodename: 'ProjectId',
                        targetObjectCollectionCodename: 'ContentProjects',
                        labelFields: ['Name', 'Title'],
                        icon: 'move',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Move to project' },
                                ru: { content: 'Переместить в проект' }
                            }
                        },
                        dialogTitle: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Move to project' },
                                ru: { content: 'Переместить в проект' }
                            }
                        },
                        targetLabel: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Project' },
                                ru: { content: 'Проект' }
                            }
                        }
                    }
                ]
            })
        ).toMatchObject({
            rowActions: [
                {
                    id: 'toggle-starred',
                    kind: 'library.toggle',
                    libraryView: 'starred',
                    icon: 'star'
                },
                {
                    id: 'toggle-shared',
                    kind: 'library.toggle',
                    libraryView: 'shared',
                    icon: 'share',
                    principalTarget: 'workspaceMember'
                },
                {
                    id: 'move-project',
                    kind: 'field.updateWithTarget',
                    fieldCodename: 'ProjectId',
                    targetObjectCollectionCodename: 'ContentProjects',
                    labelFields: ['Name', 'Title'],
                    icon: 'move'
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    targets: [{ sectionCodename: 'LearningResources' }]
                },
                rowActions: [{ id: 'bad-action', kind: 'library.toggle', libraryView: 'recent' }]
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    targets: [{ sectionCodename: 'LearningResources' }]
                },
                rowActions: [{ id: 'bad-target-action', kind: 'field.updateWithTarget', fieldCodename: 'ProjectId' }]
            })
        ).toThrow()
    })

    it('accepts generic restore target pickers for deleted records.union detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    targets: [{ sectionCodename: 'LearningResources', displayType: 'resource' }],
                    query: { lifecycleState: 'deleted' }
                },
                restoreTarget: {
                    targetObjectCollectionCodename: 'ContentProjects',
                    parentFieldCodename: 'ProjectId',
                    labelFields: ['Name', 'Title'],
                    dialogTitle: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Restore to project' },
                            ru: { content: 'Восстановить в проект' }
                        }
                    },
                    targetLabel: 'Project'
                }
            })
        ).toMatchObject({
            restoreTarget: {
                targetObjectCollectionCodename: 'ContentProjects',
                parentFieldCodename: 'ProjectId',
                labelFields: ['Name', 'Title']
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                restoreTarget: {
                    parentFieldCodename: 'ProjectId'
                }
            })
        ).toThrow()
    })

    it('accepts context-derived create defaults for writable scalar fields', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                createTargets: [
                    {
                        id: 'create-course',
                        label: 'Course',
                        sectionCodename: 'Courses',
                        createDefaults: [
                            {
                                fieldCodename: 'NavigationMode',
                                contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                            },
                            {
                                fieldCodename: 'CompletionCondition',
                                contextPath: 'learningContent.courseCompletionPolicy.completionCondition'
                            }
                        ]
                    }
                ]
            })
        ).toMatchObject({
            createTargets: [
                {
                    id: 'create-course',
                    createDefaults: [
                        {
                            fieldCodename: 'NavigationMode',
                            contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                        },
                        {
                            fieldCodename: 'CompletionCondition',
                            contextPath: 'learningContent.courseCompletionPolicy.completionCondition'
                        }
                    ]
                }
            ]
        })
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
                    projectedFields: ['Instructor'],
                    targets: [
                        {
                            sectionCodename: 'LearningResources',
                            displayType: 'page',
                            titleField: 'Title',
                            statusField: 'PublicationStatus',
                            projectField: 'ProjectId'
                        },
                        {
                            sectionCodename: 'Courses',
                            displayType: 'course',
                            titleField: 'Title',
                            statusField: 'Status',
                            projectField: 'ProjectId'
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
                projectedFields: ['Instructor'],
                targets: [
                    {
                        sectionCodename: 'LearningResources',
                        displayType: 'page',
                        projectField: 'ProjectId'
                    },
                    {
                        sectionCodename: 'Courses',
                        displayType: 'course',
                        projectField: 'ProjectId'
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

    it('accepts saved report codename references for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                reportCodename: 'CourseBuilderOutline'
            })
        ).toMatchObject({
            reportCodename: 'CourseBuilderOutline'
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                reportCodename: ''
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
