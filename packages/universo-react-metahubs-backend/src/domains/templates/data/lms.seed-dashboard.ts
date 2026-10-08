import {
    getLayoutWidgetDefinition,
    validateWidgetBindings,
    type RelationBuilderPanelConfig,
    type TemplateSeedZoneWidget
} from '@universo-react/types'
import { buildBasicMinimalSeedZoneWidgets } from './basic.template'
import {
    buildDashboardLearnerPlayerBindings,
    buildDashboardRelationBindings,
    buildDashboardRecordSetBindings,
    makeDashboardSeedPlacement
} from '../services/dashboardSeedPlacement'

export function buildLmsBaseSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return buildBasicMinimalSeedZoneWidgets()
}

const dashboardText = (en: string, ru: string) => ({ en, ru })

export function buildLmsKnowledgeArticlesSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    const rendererConfig = {
        variant: 'records',
        showSearch: true,
        maxRows: 50,
        createTargets: [
            {
                id: 'knowledge-articles-create-article',
                label: dashboardText('Article', 'Статья'),
                objectCollectionCodename: 'KnowledgeArticles',
                icon: 'article'
            }
        ]
    }

    return [
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'detailsTable',
            instanceKey: 'knowledge-articles-records',
            sortOrder: 1,
            rendererConfig,
            bindings: buildDashboardRecordSetBindings('detailsTable', 'rows', ['KnowledgeArticles'], rendererConfig)
        })
    ]
}

export function buildLmsEntityRecordsSeedZoneWidgets(entityCodename: string, instanceKey: string): TemplateSeedZoneWidget[] {
    const rendererConfig = { variant: 'records', showSearch: true, maxRows: 50 }

    return [
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'detailsTable',
            instanceKey,
            sortOrder: 1,
            rendererConfig,
            bindings: buildDashboardRecordSetBindings('detailsTable', 'rows', [entityCodename], rendererConfig)
        })
    ]
}

export function buildLmsEnrollmentsSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return buildLmsEntityRecordsSeedZoneWidgets('Enrollments', 'enrollments-records')
}

const learningContentCreateTargets = [
    {
        id: 'learning-content-create-project',
        label: dashboardText('Project', 'Проект'),
        objectCollectionCodename: 'ContentProjects',
        icon: 'folder'
    },
    {
        id: 'learning-content-create-page',
        label: dashboardText('Page', 'Страница'),
        sectionCodename: 'LearningResources',
        icon: 'article',
        createDefaults: [
            { fieldCodename: 'ResourceType', enumCodename: 'Page' },
            { fieldCodename: 'Source', resourceSourceType: 'page' }
        ]
    },
    {
        id: 'learning-content-create-link',
        label: dashboardText('Link', 'Ссылка'),
        sectionCodename: 'LearningResources',
        icon: 'link',
        createDefaults: [
            { fieldCodename: 'ResourceType', enumCodename: 'Url' },
            { fieldCodename: 'Source', resourceSourceType: 'url' }
        ]
    },
    {
        id: 'learning-content-create-course',
        label: dashboardText('Course', 'Курс'),
        objectCollectionCodename: 'Courses',
        icon: 'school',
        createDefaults: [
            { fieldCodename: 'NavigationMode', contextPath: 'learningContent.courseCompletionPolicy.navigationMode' },
            { fieldCodename: 'CompletionCondition', contextPath: 'learningContent.courseCompletionPolicy.completionCondition' },
            { fieldCodename: 'StatusFormat', contextPath: 'learningContent.courseCompletionPolicy.statusFormat' }
        ]
    },
    {
        id: 'learning-content-create-track',
        label: dashboardText('Learning track', 'Учебный трек'),
        objectCollectionCodename: 'LearningTracks',
        icon: 'route',
        createDefaults: [{ fieldCodename: 'OrderMode', contextPath: 'learningContent.trackOrderPolicy.orderMode' }]
    },
    {
        id: 'learning-content-create-quiz-lite',
        label: dashboardText('Quiz', 'Тест'),
        objectCollectionCodename: 'Quizzes',
        icon: 'quiz',
        disabled: true,
        disabledReason: dashboardText(
            'Quiz authoring is planned for a later Learning Content phase.',
            'Создание тестов запланировано на следующий этап учебного контента.'
        )
    },
    {
        id: 'learning-content-create-assignment-lite',
        label: dashboardText('Assignment', 'Задание'),
        objectCollectionCodename: 'Assignments',
        icon: 'assignment',
        disabled: true,
        disabledReason: dashboardText(
            'Assignment authoring is planned for a later Learning Content phase.',
            'Создание заданий запланировано на следующий этап учебного контента.'
        )
    },
    {
        id: 'learning-content-create-package',
        label: dashboardText('Package', 'Пакет'),
        sectionCodename: 'LearningResources',
        icon: 'archive',
        disabled: true,
        disabledReason: dashboardText('File import support is planned for a later phase.', 'Импорт файлов запланирован на следующий этап.'),
        createDefaults: [
            { fieldCodename: 'ResourceType', enumCodename: 'File' },
            { fieldCodename: 'Source', resourceSourceType: 'file' }
        ]
    }
]

const learningContentRowActions = [
    {
        id: 'learning-content-toggle-starred',
        kind: 'library.toggle',
        libraryView: 'starred',
        icon: 'star',
        label: dashboardText('Add to starred', 'Добавить в избранное'),
        activeLabel: dashboardText('Remove from starred', 'Убрать из избранного')
    },
    {
        id: 'learning-content-toggle-shared',
        kind: 'library.toggle',
        libraryView: 'shared',
        icon: 'share',
        principalTarget: 'workspaceMember',
        label: dashboardText('Share', 'Поделиться'),
        activeLabel: dashboardText('Share', 'Поделиться'),
        dialogTitle: dashboardText('Share content', 'Поделиться контентом'),
        targetLabel: dashboardText('Workspace member', 'Участник рабочего пространства')
    }
]

const learningContentMoveProjectAction = {
    id: 'learning-content-move-project',
    kind: 'field.updateWithTarget',
    fieldCodename: 'ProjectId',
    targetObjectCollectionCodename: 'ContentProjects',
    labelFields: ['Name', 'Title'],
    icon: 'move',
    label: dashboardText('Move to project', 'Переместить в проект'),
    dialogTitle: dashboardText('Move to project', 'Переместить в проект'),
    targetLabel: dashboardText('Project', 'Проект')
} as const

const learningContentTargetFilters = [
    {
        id: 'learning-content-filter-resources',
        label: dashboardText('Resources', 'Ресурсы'),
        targetDisplayTypes: ['resource']
    },
    {
        id: 'learning-content-filter-courses',
        label: dashboardText('Courses', 'Курсы'),
        targetDisplayTypes: ['course']
    },
    {
        id: 'learning-content-filter-tracks',
        label: dashboardText('Learning tracks', 'Учебные треки'),
        targetDisplayTypes: ['track']
    }
] as const

const LMS_LIBRARY_ENTITIES = ['LearningResources', 'Courses', 'LearningTracks'] as const

const makeLmsLibraryTable = (instanceKey: string, sortOrder: number, rendererConfig: Record<string, unknown>): TemplateSeedZoneWidget =>
    makeDashboardSeedPlacement({
        zone: 'center',
        widgetKey: 'detailsTable',
        instanceKey,
        sortOrder,
        rendererConfig,
        bindings: buildDashboardRecordSetBindings('detailsTable', 'rows', LMS_LIBRARY_ENTITIES, rendererConfig)
    })

const makeLmsEnrollmentBindings = (targetKind: 'course' | 'track') => {
    const rendererConfig = { variant: 'learner-enrollments' }
    const definition = getLayoutWidgetDefinition('detailsTable', rendererConfig)
    const slot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
    if (!definition || !slot) throw new Error('Dashboard learner-enrollment binding contract is unavailable')

    return validateWidgetBindings(definition, {
        version: 1,
        slots: [
            {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename: 'Enrollments',
                        selector: { kind: 'learner-enrollment-set', targetKind },
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        ]
    })
}

export function buildLmsHomeSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    const tabsInstanceKey = 'learner-home-content-tabs'
    const assignmentTabsInstanceKey = 'learner-home-assignment-tabs'
    const views = [
        {
            slotKey: 'tab:recent',
            label: dashboardText('Recent', 'Недавние'),
            libraryView: 'recent' as const,
            instanceKey: 'learner-home-recent'
        },
        {
            slotKey: 'tab:starred',
            label: dashboardText('Starred', 'Избранное'),
            libraryView: 'starred' as const,
            instanceKey: 'learner-home-starred'
        },
        {
            slotKey: 'tab:shared',
            label: dashboardText('Shared with me', 'Доступные мне'),
            libraryView: 'shared' as const,
            instanceKey: 'learner-home-shared'
        }
    ]

    const assignments = [
        {
            slotKey: 'tab:my-courses',
            label: dashboardText('My Courses', 'Мои курсы'),
            targetKind: 'course' as const,
            instanceKey: 'learner-home-my-courses'
        },
        {
            slotKey: 'tab:my-tracks',
            label: dashboardText('My Tracks', 'Мои треки'),
            targetKind: 'track' as const,
            instanceKey: 'learner-home-my-tracks'
        }
    ]

    return [
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'detailsTabs',
            instanceKey: assignmentTabsInstanceKey,
            sortOrder: 1,
            rendererConfig: {
                tabs: assignments.map((assignment, index) => ({
                    slotKey: assignment.slotKey,
                    label: assignment.label,
                    ...(index === 0 ? { isDefault: true } : {})
                }))
            }
        }),
        ...assignments.map((assignment, index) =>
            makeDashboardSeedPlacement({
                zone: 'center',
                widgetKey: 'detailsTable',
                instanceKey: assignment.instanceKey,
                parentInstanceKey: assignmentTabsInstanceKey,
                slotKey: assignment.slotKey,
                sortOrder: index + 1,
                rendererConfig: { variant: 'learner-enrollments', maxRows: 24, rowHeight: 'auto' },
                bindings: makeLmsEnrollmentBindings(assignment.targetKind)
            })
        ),
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'detailsTabs',
            instanceKey: tabsInstanceKey,
            sortOrder: 2,
            rendererConfig: {
                tabs: views.map((view, index) => ({
                    slotKey: view.slotKey,
                    label: view.label,
                    ...(index === 0 ? { isDefault: true } : {})
                }))
            }
        }),
        ...views.map((view, index) =>
            makeDashboardSeedPlacement({
                zone: 'center',
                widgetKey: 'detailsTable',
                instanceKey: view.instanceKey,
                parentInstanceKey: tabsInstanceKey,
                slotKey: view.slotKey,
                sortOrder: index + 1,
                rendererConfig: {
                    variant: 'library',
                    libraryView: view.libraryView,
                    lifecycleState: 'active',
                    maxRows: 24,
                    showSearch: true,
                    showViewToggle: true,
                    targetFilters: learningContentTargetFilters,
                    rowActions: learningContentRowActions
                },
                bindings: buildDashboardRecordSetBindings('detailsTable', 'rows', LMS_LIBRARY_ENTITIES, {
                    variant: 'library',
                    libraryView: view.libraryView,
                    lifecycleState: 'active',
                    maxRows: 24,
                    showSearch: true,
                    showViewToggle: true,
                    targetFilters: learningContentTargetFilters,
                    rowActions: learningContentRowActions
                })
            })
        )
    ]
}

export function buildLmsLearningContentSeedZoneWidgets(
    libraryView: 'all' | 'recent' | 'starred' | 'shared' = 'all'
): TemplateSeedZoneWidget[] {
    return [
        makeLmsLibraryTable(`learning-content-${libraryView}`, 1, {
            variant: 'library',
            libraryView,
            lifecycleState: 'active',
            maxRows: 500,
            showSearch: true,
            showViewToggle: true,
            targetFilters: learningContentTargetFilters,
            rowActions:
                libraryView === 'all' ? [...learningContentRowActions, learningContentMoveProjectAction] : learningContentRowActions,
            ...(libraryView === 'all' ? { createTargets: learningContentCreateTargets } : {})
        })
    ]
}

export function buildLmsTrashSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return [
        makeLmsLibraryTable('learning-content-trash', 1, {
            variant: 'library',
            libraryView: 'all',
            lifecycleState: 'deleted',
            maxRows: 500,
            showSearch: true,
            showViewToggle: true,
            targetFilters: learningContentTargetFilters.map((filter) => ({
                ...filter,
                id: filter.id.replace('learning-content-filter-', 'learning-content-trash-filter-')
            })),
            restoreTarget: {
                targetObjectCollectionCodename: 'ContentProjects',
                parentFieldCodename: 'ProjectId',
                labelFields: ['Name', 'Title'],
                dialogTitle: dashboardText('Restore to project', 'Восстановить в проект'),
                targetLabel: dashboardText('Project', 'Проект')
            }
        })
    ]
}

export function buildLmsReportsSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return ['LearningContentSummary', 'LearnerProgress'].map((reportCodename, index) =>
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'detailsTable',
            instanceKey: `reports-${reportCodename.toLowerCase()}`,
            sortOrder: index + 1,
            rendererConfig: { variant: 'report', reportCodename }
        })
    )
}

type LmsRelationPanelSeed = {
    slotKey: string
    title: { en: string; ru: string }
    entityCodename: string
    parentFieldCodename: string
    sortOrderFieldCodename?: string
    createWizard?: RelationBuilderPanelConfig['createWizard']
}

function makeLmsRelationBuilder(
    instanceKey: string,
    sortOrder: number,
    parentEntityCodename: string,
    panels: LmsRelationPanelSeed[],
    placement?: { parentInstanceKey: string; slotKey: string }
): TemplateSeedZoneWidget {
    const rendererConfig = {
        parentTitleFieldCodename: 'Title',
        panels: panels.map(({ slotKey, title, parentFieldCodename, sortOrderFieldCodename, createWizard }) => ({
            slotKey,
            title,
            parentFieldCodename,
            sortOrderFieldCodename: sortOrderFieldCodename ?? 'SortOrder',
            enableRowReordering: true,
            ...(createWizard ? { createWizard } : {})
        }))
    }

    return makeDashboardSeedPlacement({
        zone: 'center',
        widgetKey: 'relationBuilder',
        instanceKey,
        sortOrder,
        rendererConfig,
        bindings: buildDashboardRelationBindings(
            parentEntityCodename,
            panels.map(({ slotKey, entityCodename }) => ({ slotKey, entityCodename })),
            rendererConfig
        ),
        ...(placement ? { parentInstanceKey: placement.parentInstanceKey, slotKey: placement.slotKey } : {})
    })
}

export function buildLmsCourseBuilderSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    const tabsInstanceKey = 'course-builder-tabs'
    return [
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'detailsTabs',
            instanceKey: tabsInstanceKey,
            sortOrder: 1,
            rendererConfig: {
                tabs: [
                    { slotKey: 'tab:sections', label: dashboardText('Sections', 'Разделы'), isDefault: true },
                    { slotKey: 'tab:items', label: dashboardText('Course items', 'Элементы курса') },
                    { slotKey: 'tab:player', label: dashboardText('Player', 'Проигрыватель') },
                    { slotKey: 'tab:reports', label: dashboardText('Reports', 'Отчёты') }
                ]
            }
        }),
        makeLmsRelationBuilder(
            'course-builder-sections',
            1,
            'Courses',
            [
                {
                    slotKey: 'panel:sections',
                    title: dashboardText('Sections', 'Разделы'),
                    entityCodename: 'CourseSections',
                    parentFieldCodename: 'CourseId'
                }
            ],
            { parentInstanceKey: tabsInstanceKey, slotKey: 'tab:sections' }
        ),
        makeLmsRelationBuilder(
            'course-builder-items',
            2,
            'Courses',
            [
                {
                    slotKey: 'panel:items',
                    title: dashboardText('Course items', 'Элементы курса'),
                    entityCodename: 'CourseItems',
                    parentFieldCodename: 'CourseId',
                    createWizard: {
                        steps: [
                            {
                                id: 'content',
                                label: dashboardText('Learning content', 'Учебный контент'),
                                helperText: dashboardText(
                                    'Name this course item, then choose the resource or quiz learners will open.',
                                    'Назовите элемент курса и выберите ресурс или тест, который откроют учащиеся.'
                                ),
                                fieldCodenames: ['Title', 'TargetObjectCodename', 'TargetRecordId']
                            },
                            {
                                id: 'course-placement',
                                label: dashboardText('Course section and completion', 'Раздел курса и завершение'),
                                helperText: dashboardText(
                                    'Choose the course section, set completion rules, and optionally estimate the time required.',
                                    'Выберите раздел курса, задайте правила завершения и при необходимости укажите время на прохождение.'
                                ),
                                fieldCodenames: ['SectionId', 'ItemType', 'IsRequired', 'CompletionWeight', 'EstimatedTimeMinutes']
                            }
                        ]
                    }
                }
            ],
            { parentInstanceKey: tabsInstanceKey, slotKey: 'tab:items' }
        ),
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'learnerPlayer',
            instanceKey: 'course-builder-player',
            sortOrder: 3,
            rendererConfig: { variant: 'course', displayMode: 'player', sequenceMode: 'strict' },
            bindings: buildDashboardLearnerPlayerBindings('course', 'Courses', 'CourseItems'),
            parentInstanceKey: tabsInstanceKey,
            slotKey: 'tab:player'
        }),
        ...buildLmsReportsSeedZoneWidgets().map((placement) => ({
            ...placement,
            instanceKey: `course-builder-${placement.instanceKey}`,
            parentInstanceKey: tabsInstanceKey,
            slotKey: 'tab:reports'
        }))
    ]
}

export function buildLmsOrderingSeedZoneWidgets(sectionCodename: string): TemplateSeedZoneWidget[] {
    const orderingSources: Record<
        string,
        { entityCodename: string; parentEntityCodename: string; parentFieldCodename: string; title: { en: string; ru: string } }
    > = {
        CourseSections: {
            entityCodename: 'CourseSections',
            parentEntityCodename: 'Courses',
            parentFieldCodename: 'CourseId',
            title: dashboardText('Sections', 'Разделы')
        },
        CourseItems: {
            entityCodename: 'CourseItems',
            parentEntityCodename: 'Courses',
            parentFieldCodename: 'CourseId',
            title: dashboardText('Course items', 'Элементы курса')
        },
        TrackStages: {
            entityCodename: 'TrackStages',
            parentEntityCodename: 'LearningTracks',
            parentFieldCodename: 'TrackId',
            title: dashboardText('Stages', 'Этапы')
        },
        TrackSteps: {
            entityCodename: 'TrackSteps',
            parentEntityCodename: 'LearningTracks',
            parentFieldCodename: 'TrackId',
            title: dashboardText('Track steps', 'Шаги трека')
        }
    }
    const source = orderingSources[sectionCodename]
    if (!source) return []

    return [
        makeLmsRelationBuilder(`ordering-${sectionCodename.toLowerCase()}`, 1, source.parentEntityCodename, [
            {
                slotKey: `panel:${sectionCodename.toLowerCase()}`,
                title: source.title,
                entityCodename: source.entityCodename,
                parentFieldCodename: source.parentFieldCodename
            }
        ])
    ]
}

export function buildLmsTrackBuilderSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    const tabsInstanceKey = 'track-builder-tabs'
    return [
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'detailsTabs',
            instanceKey: tabsInstanceKey,
            sortOrder: 1,
            rendererConfig: {
                tabs: [
                    { slotKey: 'tab:stages', label: dashboardText('Stages', 'Этапы'), isDefault: true },
                    { slotKey: 'tab:steps', label: dashboardText('Track steps', 'Шаги трека') },
                    { slotKey: 'tab:player', label: dashboardText('Player', 'Проигрыватель') },
                    { slotKey: 'tab:reports', label: dashboardText('Reports', 'Отчёты') }
                ]
            }
        }),
        makeLmsRelationBuilder(
            'track-builder-stages',
            1,
            'LearningTracks',
            [
                {
                    slotKey: 'panel:stages',
                    title: dashboardText('Stages', 'Этапы'),
                    entityCodename: 'TrackStages',
                    parentFieldCodename: 'TrackId'
                }
            ],
            { parentInstanceKey: tabsInstanceKey, slotKey: 'tab:stages' }
        ),
        makeLmsRelationBuilder(
            'track-builder-steps',
            2,
            'LearningTracks',
            [
                {
                    slotKey: 'panel:steps',
                    title: dashboardText('Track steps', 'Шаги трека'),
                    entityCodename: 'TrackSteps',
                    parentFieldCodename: 'TrackId'
                }
            ],
            { parentInstanceKey: tabsInstanceKey, slotKey: 'tab:steps' }
        ),
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'learnerPlayer',
            instanceKey: 'track-builder-player',
            sortOrder: 3,
            rendererConfig: { variant: 'track', displayMode: 'player', sequenceMode: 'strict' },
            bindings: buildDashboardLearnerPlayerBindings('track', 'LearningTracks', 'TrackSteps'),
            parentInstanceKey: tabsInstanceKey,
            slotKey: 'tab:player'
        }),
        ...buildLmsReportsSeedZoneWidgets().map((placement) => ({
            ...placement,
            instanceKey: `track-builder-${placement.instanceKey}`,
            parentInstanceKey: tabsInstanceKey,
            slotKey: 'tab:reports'
        }))
    ]
}
