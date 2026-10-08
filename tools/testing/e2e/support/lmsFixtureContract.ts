import { buildVLC, computeSnapshotHash, isUuidV7 } from '@universo-react/utils'
import {
    CURRENT_METAHUB_SNAPSHOT_FORMAT_VERSION,
    catalogPublicationPolicySchema,
    isDeferredResourceSource,
    LMS_ACCEPTANCE_AREAS,
    lmsAcceptanceMatrixSchema,
    reportDefinitionSchema,
    resourceDefinitionSchema,
    workflowActionSchema
} from '@universo-react/types'
import { assertLmsDashboardFixtureContract } from './lmsDashboardFixtureContract.ts'

export const LMS_FIXTURE_FILENAME = 'metahubs-lms-app-snapshot.json'
const LMS_EXPECTED_BUNDLE_VERSION = 1
const LMS_EXPECTED_SNAPSHOT_VERSION = 1
const LMS_EXPECTED_STRUCTURE_VERSION = '0.1.0'
const LMS_EXPECTED_SNAPSHOT_FORMAT_VERSION = CURRENT_METAHUB_SNAPSHOT_FORMAT_VERSION

export const LMS_CANONICAL_METAHUB = {
    name: {
        en: 'Learning Portal LMS',
        ru: 'Учебный портал LMS'
    },
    description: {
        en: 'Canonical bilingual LMS metahub fixture with seeded classes, content resources, and public learning links.',
        ru: 'Канонический двуязычный LMS fixture metahub с заполненными классами, учебными ресурсами и публичными учебными ссылками.'
    },
    codename: {
        en: 'LearningPortalLms',
        ru: 'УчебныйПорталLms'
    }
}

export const LMS_PUBLICATION = {
    name: {
        en: 'Learning Portal Publication',
        ru: 'Публикация учебного портала'
    },
    applicationName: {
        en: 'Learning Portal App',
        ru: 'Приложение учебного портала'
    }
}

export const LMS_WELCOME_PAGE = {
    title: {
        en: 'Welcome to your learning portal',
        ru: 'Добро пожаловать в учебный портал'
    },
    intro: {
        en: 'This portal brings together the learning paths, content resources, assignments, tests, and progress indicators that learners need every day. Start with your assigned content, continue from the last opened activity, and use the content library to find approved materials for independent study.',
        ru: 'Этот портал объединяет учебные траектории, учебные ресурсы, задания, тесты и показатели прогресса, которые нужны учащимся каждый день. Начните с назначенного контента, продолжите обучение с последнего открытого материала и используйте библиотеку контента для самостоятельного изучения утвержденных материалов.'
    },
    howToStartTitle: {
        en: 'How to start',
        ru: 'Как начать'
    },
    workspaceGuidance: {
        en: 'Workspaces separate personal learning, team learning, and shared training areas. The main workspace is created automatically, and additional workspaces can be added later when a team needs isolated content, members, and reporting.',
        ru: 'Рабочие пространства разделяют личное обучение, обучение команд и общие учебные области. Основное рабочее пространство создается автоматически, а дополнительные рабочие пространства можно добавить позже, когда команде понадобятся отдельные материалы, участники и отчеты.'
    }
} as const

export const LMS_SAMPLE_LINK = {
    slug: 'demo-content',
    title: {
        en: 'Learning path guest journey',
        ru: 'Гостевой учебный маршрут'
    }
}

export const LMS_SECONDARY_LINK = {
    slug: 'docking-drill',
    title: {
        en: 'Docking corridor guest drill',
        ru: 'Гостевая тренировка по стыковочному коридору'
    }
}

export const LMS_DEMO_CLASSES = [
    {
        key: 'learning-path',
        name: {
            en: 'Learning Design Cohort',
            ru: 'Когорта учебного дизайна'
        },
        description: {
            en: 'Crew training for learning checkpoints.',
            ru: 'Подготовка экипажа по учебным точкам.'
        },
        schoolYear: '2061',
        studentCountLimit: 24
    },
    {
        key: 'lunar-logistics',
        name: {
            en: 'Lunar Logistics Cohort',
            ru: 'Когорта лунной логистики'
        },
        description: {
            en: 'Ops training for docking and cargo routes.',
            ru: 'Подготовка по стыковке и грузовым маршрутам.'
        },
        schoolYear: '2061',
        studentCountLimit: 18
    }
] as const

export const LMS_DEMO_STUDENTS = [
    {
        key: 'ava-solaris',
        displayName: {
            en: 'Ava Solaris',
            ru: 'Ава Солярис'
        },
        email: 'ava.solaris@example.test'
    },
    {
        key: 'maksim-vega',
        displayName: {
            en: 'Maksim Vega',
            ru: 'Максим Вега'
        },
        email: 'maksim.vega@example.test'
    }
] as const

export const LMS_DEMO_QUIZZES = [
    {
        key: 'learning-path',
        title: {
            en: 'Learning Readiness Check',
            ru: 'Проверка готовности к обучению'
        },
        description: {
            en: 'Two questions confirm corridor readiness.',
            ru: 'Два вопроса подтверждают готовность к коридору.'
        },
        passingScorePercent: 50,
        maxAttempts: 3,
        questions: {
            en: [
                {
                    prompt: 'Which checkpoint comes before transfer burn?',
                    description: 'Choose one answer.',
                    explanation: 'Confirm the departure window first.',
                    options: [
                        { id: 'learning-q1-opt-a', label: buildVLC('Departure window', 'Окно отправления'), isCorrect: true },
                        { id: 'learning-q1-opt-b', label: buildVLC('Docking corridor', 'Коридор стыковки'), isCorrect: false }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Which signal confirms a stable route?',
                    description: 'Choose one answer.',
                    explanation: 'The navigation beacon confirms stability.',
                    options: [
                        { id: 'learning-q2-opt-a', label: buildVLC('Navigation beacon', 'Навигационный маяк'), isCorrect: true },
                        { id: 'learning-q2-opt-b', label: buildVLC('Cabin humidity alert', 'Сигнал влажности кабины'), isCorrect: false }
                    ],
                    sortOrder: 2
                }
            ],
            ru: [
                {
                    prompt: 'Что подтвердить перед трансферным импульсом?',
                    description: 'Выберите один вариант.',
                    explanation: 'Сначала подтвердите окно отправления.',
                    options: [
                        { id: 'learning-q1-opt-a', label: buildVLC('Departure window', 'Окно отправления'), isCorrect: true },
                        { id: 'learning-q1-opt-b', label: buildVLC('Docking corridor', 'Коридор стыковки'), isCorrect: false }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Какой сигнал подтверждает устойчивость маршрута?',
                    description: 'Выберите один вариант.',
                    explanation: 'Навигационный маяк подтверждает устойчивость.',
                    options: [
                        { id: 'learning-q2-opt-a', label: buildVLC('Navigation beacon', 'Навигационный маяк'), isCorrect: true },
                        { id: 'learning-q2-opt-b', label: buildVLC('Cabin humidity alert', 'Сигнал влажности кабины'), isCorrect: false }
                    ],
                    sortOrder: 2
                }
            ]
        }
    },
    {
        key: 'docking-corridor',
        title: {
            en: 'Docking Corridor Check',
            ru: 'Проверка стыковочного коридора'
        },
        description: {
            en: 'A short drill for docking alignment.',
            ru: 'Короткая тренировка по выравниванию стыковки.'
        },
        passingScorePercent: 50,
        maxAttempts: 3,
        questions: {
            en: [
                {
                    prompt: 'Which signal confirms the docking corridor?',
                    description: 'Choose one answer.',
                    explanation: 'The green beacon confirms alignment.',
                    options: [
                        { id: 'docking-q1-opt-a', label: buildVLC('Green corridor beacon', 'Зелёный маяк коридора'), isCorrect: true },
                        { id: 'docking-q1-opt-b', label: buildVLC('Cargo hatch alarm', 'Сигнал люка грузового отсека'), isCorrect: false }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'What to verify before opening the seal?',
                    description: 'Choose one answer.',
                    explanation: 'Confirm pressure balance first.',
                    options: [
                        { id: 'docking-q2-opt-a', label: buildVLC('Pressure balance', 'Баланс давления'), isCorrect: true },
                        { id: 'docking-q2-opt-b', label: buildVLC('Passenger manifest', 'Пассажирский манифест'), isCorrect: false }
                    ],
                    sortOrder: 2
                }
            ],
            ru: [
                {
                    prompt: 'Какой сигнал подтверждает коридор стыковки?',
                    description: 'Выберите один вариант.',
                    explanation: 'Зелёный маяк подтверждает выравнивание.',
                    options: [
                        { id: 'docking-q1-opt-a', label: buildVLC('Green corridor beacon', 'Зелёный маяк коридора'), isCorrect: true },
                        { id: 'docking-q1-opt-b', label: buildVLC('Cargo hatch alarm', 'Сигнал люка грузового отсека'), isCorrect: false }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Что проверить перед открытием пломбы?',
                    description: 'Выберите один вариант.',
                    explanation: 'Сначала подтвердите баланс давления.',
                    options: [
                        { id: 'docking-q2-opt-a', label: buildVLC('Pressure balance', 'Баланс давления'), isCorrect: true },
                        { id: 'docking-q2-opt-b', label: buildVLC('Passenger manifest', 'Пассажирский манифест'), isCorrect: false }
                    ],
                    sortOrder: 2
                }
            ]
        }
    },
    {
        key: 'lunar-logistics',
        title: {
            en: 'Lunar Logistics Audit',
            ru: 'Аудит лунной логистики'
        },
        description: {
            en: 'Validate launch windows and cargo routes.',
            ru: 'Проверьте стартовые окна и грузовые маршруты.'
        },
        passingScorePercent: 50,
        maxAttempts: 3,
        questions: {
            en: [
                {
                    prompt: 'Which manifest opens the lunar cargo window?',
                    description: 'Choose one answer.',
                    explanation: 'Use the outbound supply manifest.',
                    options: [
                        {
                            id: 'logistics-q1-opt-a',
                            label: buildVLC('Outbound supply manifest', 'Манифест исходящих поставок'),
                            isCorrect: true
                        },
                        { id: 'logistics-q1-opt-b', label: buildVLC('Crew meal rota', 'График питания экипажа'), isCorrect: false }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'What shows the payload route is ready?',
                    description: 'Choose one answer.',
                    explanation: 'The ready dispatch window shows approval.',
                    options: [
                        { id: 'logistics-q2-opt-a', label: buildVLC('Ready dispatch window', 'Готовое окно отправки'), isCorrect: true },
                        { id: 'logistics-q2-opt-b', label: buildVLC('Cabin lighting alert', 'Сигнал подсветки кабины'), isCorrect: false }
                    ],
                    sortOrder: 2
                }
            ],
            ru: [
                {
                    prompt: 'Какой манифест открывает окно лунного груза?',
                    description: 'Выберите один вариант.',
                    explanation: 'Используйте манифест исходящих поставок.',
                    options: [
                        {
                            id: 'logistics-q1-opt-a',
                            label: buildVLC('Outbound supply manifest', 'Манифест исходящих поставок'),
                            isCorrect: true
                        },
                        { id: 'logistics-q1-opt-b', label: buildVLC('Crew meal rota', 'График питания экипажа'), isCorrect: false }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Что показывает готовность маршрута?',
                    description: 'Выберите один вариант.',
                    explanation: 'Готовое окно отправки показывает одобрение.',
                    options: [
                        { id: 'logistics-q2-opt-a', label: buildVLC('Ready dispatch window', 'Готовое окно отправки'), isCorrect: true },
                        { id: 'logistics-q2-opt-b', label: buildVLC('Cabin lighting alert', 'Сигнал подсветки кабины'), isCorrect: false }
                    ],
                    sortOrder: 2
                }
            ]
        }
    }
] as const

export const LMS_DEMO_CONTENT_NODES = [
    {
        key: 'learning-path',
        linkedQuizKey: 'learning-path',
        linkedClassKey: 'learning-path',
        title: {
            en: 'Learning Path 101',
            ru: 'Учебный маршрут 101'
        },
        description: {
            en: 'Lesson on transfer windows and checkpoints.',
            ru: 'Урок о трансферных окнах и контрольных точках.'
        },
        estimatedDurationMinutes: 12,
        accessLinkSlug: LMS_SAMPLE_LINK.slug,
        contentItems: {
            en: [
                {
                    itemType: 'Text',
                    itemTitle: 'Mission brief',
                    itemContent: 'Review the route, verify checkpoints, then open the quiz.',
                    sortOrder: 1
                },
                {
                    itemType: 'QuizRef',
                    itemTitle: 'Readiness check',
                    sortOrder: 2
                }
            ],
            ru: [
                {
                    itemType: 'Text',
                    itemTitle: 'Брифинг миссии',
                    itemContent: 'Проверьте маршрут, точки и откройте тест.',
                    sortOrder: 1
                },
                {
                    itemType: 'QuizRef',
                    itemTitle: 'Проверка готовности',
                    sortOrder: 2
                }
            ]
        }
    },
    {
        key: 'docking-corridor',
        linkedQuizKey: 'docking-corridor',
        linkedClassKey: 'learning-path',
        title: {
            en: 'Docking Corridor Basics',
            ru: 'Основы стыковочного коридора'
        },
        description: {
            en: 'Lesson on corridor alignment and docking.',
            ru: 'Урок по выравниванию коридора и стыковке.'
        },
        estimatedDurationMinutes: 10,
        accessLinkSlug: LMS_SECONDARY_LINK.slug,
        contentItems: {
            en: [
                {
                    itemType: 'Text',
                    itemTitle: 'Corridor alignment',
                    itemContent: 'Lock the beacon, verify pressure, then finish the drill.',
                    sortOrder: 1
                },
                {
                    itemType: 'QuizRef',
                    itemTitle: 'Docking drill',
                    sortOrder: 2
                }
            ],
            ru: [
                {
                    itemType: 'Text',
                    itemTitle: 'Выравнивание коридора',
                    itemContent: 'Зафиксируйте маяк, подтвердите давление и завершите тренировку.',
                    sortOrder: 1
                },
                {
                    itemType: 'QuizRef',
                    itemTitle: 'Стыковочная тренировка',
                    sortOrder: 2
                }
            ]
        }
    },
    {
        key: 'lunar-logistics',
        linkedQuizKey: 'lunar-logistics',
        linkedClassKey: 'lunar-logistics',
        title: {
            en: 'Lunar Supply Windows',
            ru: 'Окна лунных поставок'
        },
        description: {
            en: 'Logistics lesson for routes and dispatch.',
            ru: 'Логистический урок по маршрутам и отправке.'
        },
        estimatedDurationMinutes: 14,
        accessLinkSlug: null,
        contentItems: {
            en: [
                {
                    itemType: 'Text',
                    itemTitle: 'Cargo overview',
                    itemContent: 'Review the manifest, confirm the route, then finish the audit.',
                    sortOrder: 1
                },
                {
                    itemType: 'QuizRef',
                    itemTitle: 'Logistics audit',
                    sortOrder: 2
                }
            ],
            ru: [
                {
                    itemType: 'Text',
                    itemTitle: 'Обзор грузов',
                    itemContent: 'Проверьте манифест, маршрут и завершите аудит.',
                    sortOrder: 1
                },
                {
                    itemType: 'QuizRef',
                    itemTitle: 'Логистический аудит',
                    sortOrder: 2
                }
            ]
        }
    }
] as const

const acceptanceGates = (
    gates: Partial<{
        seeded: boolean
        visible: boolean
        actionable: boolean
        audited: boolean
        'workspace-isolated': boolean
        'covered-by-e2e': boolean
    }> = {}
) => ({
    seeded: false,
    visible: false,
    actionable: false,
    audited: false,
    'workspace-isolated': false,
    'covered-by-e2e': false,
    ...gates
})

export const LMS_PRODUCT_ACCEPTANCE_MATRIX = lmsAcceptanceMatrixSchema.parse([
    {
        area: 'learnerHome',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearnerHome', 'LearningResources', 'Courses', 'ContentProgress'],
        requiredStatuses: ['NotStarted', 'InProgress', 'Completed'],
        evidence: ['snapshot-import-lms-runtime flow opens learner home and public content progress'],
        browserEvidence: ['snapshot-import-lms-runtime opens learner home and verifies public content progress'],
        gaps: [
            'Deferred beyond current Learning Content release scope: learner-home activity is not yet written to a dedicated audit ledger'
        ]
    },
    {
        area: 'contentLibrary',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['ContentProjects', 'LearningResources', 'Courses', 'CourseSections', 'CourseItems', 'KnowledgeArticles'],
        requiredStatuses: ['Published'],
        evidence: ['resource source contract, app-side block authoring, and runtime preview tests cover early safe resource types'],
        browserEvidence: [
            'snapshot-import-lms-runtime creates Page, Link, Project, and Knowledge Article content through the published app'
        ],
        fixtureEvidence: ['resource source and block-content fixture contracts cover supported early resource types'],
        gaps: [
            'Deferred beyond current Learning Content release scope: broad package ingestion for SCORM, xAPI, Office, and advanced media'
        ]
    },
    {
        area: 'contentProjects',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['ContentProjects', 'ContentAccessEntries', 'ContentStars', 'RecentContentViews'],
        browserEvidence: [
            'snapshot-import-lms-runtime opens the Projects-backed Learning Content library and verifies project create defaults'
        ],
        evidence: [
            'Learning Content V2 metadata seeds workspace-scoped project containers and the Playwright flow opens the Projects-backed library view'
        ]
    },
    {
        area: 'learningContentShell',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['ContentProjects', 'LearningResources', 'Courses', 'LearningTracks', 'TrashEntries'],
        browserEvidence: ['snapshot-import-lms-runtime captures Library, Recent, Starred, Shared with me, and Trash runtime views'],
        evidence: [
            'Primary LMS navigation targets ContentProjects and LearningResources',
            'snapshot-import-lms-runtime captures Learning Content, Recent, Starred, Shared with me, and Trash screenshots'
        ]
    },
    {
        area: 'standalonePageAuthoring',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearningResources'],
        requiredStatuses: ['Draft', 'Published'],
        browserEvidence: ['snapshot-import-lms-runtime creates and edits block-authored Page content through the published app runtime'],
        evidence: [
            'LearningResources.Body uses the shared Editor.js block-content field',
            'snapshot-import-lms-runtime creates and edits block-authored content through the published app runtime'
        ]
    },
    {
        area: 'standaloneLinkResources',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearningResources', 'ResourceType'],
        browserEvidence: ['snapshot-import-lms-runtime validates Link authoring and RU unsafe URL validation in the published app runtime'],
        fixtureEvidence: ['resource-source fixture contract validates safe URL-backed resource metadata'],
        evidence: [
            'Shared resource-source contract validates safe URL-backed resources',
            'Resource preview unit coverage verifies URL-backed and deferred resource states without LMS-specific widgets'
        ]
    },
    {
        area: 'courseDetail',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['CourseOverview', 'Courses', 'CourseSections', 'CourseItems', 'LearningResources'],
        requiredStatuses: ['Published'],
        browserEvidence: [
            'snapshot-import-lms-runtime captures first-class Course Builder tabs, bound child tables, reports, and ordering proof'
        ],
        evidence: [
            'course overview page and published-app authoring flows create content resources through the LMS fixture',
            'CourseSections and CourseItems have scoped generic ordering layouts backed by SortOrder',
            'snapshot-import-lms-runtime captures first-class Course Builder tabs, bound child tables, reports, and ordering proof'
        ]
    },
    {
        area: 'courseBuilder',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Courses', 'CourseSections', 'CourseItems', 'LearningResources'],
        requiredReports: ['LearningContentSummary', 'LearnerProgress'],
        requiredStatuses: ['Draft', 'Published'],
        browserEvidence: [
            'snapshot-import-lms-runtime verifies Course Builder first-class tabs, bound child tables, reports, and outline reordering'
        ],
        evidence: [
            'CourseItems is the canonical Course -> Section -> Content item model',
            'CourseSections and CourseItems are source-managed through neutral record-set bindings on first-class detailsTable placements',
            'Generic details tables can persist CourseSections and CourseItems order through the runtime reorder endpoint',
            'Course Builder is organized through detailsTabs whose child widgets are separate parent_widget_id/slot_key placements',
            'snapshot-import-lms-runtime verifies builder tabs, bound child tables, saved reports, and outline reordering'
        ]
    },
    {
        area: 'learningTrackProgression',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearningTracks', 'TrackStages', 'TrackSteps', 'Courses', 'Enrollments', 'ProgressLedger'],
        requiredStatuses: ['NotStarted', 'InProgress', 'Completed', 'Overdue', 'Expired'],
        browserEvidence: ['snapshot-import-lms-runtime verifies track runtime progression and guest progress flows'],
        evidence: ['guest content flow writes progress and direct ledger facts are verified in LMS runtime E2E']
    },
    {
        area: 'trackBuilder',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['LearningTracks', 'TrackStages', 'TrackSteps', 'Courses'],
        requiredReports: ['LearningContentSummary', 'LearnerProgress'],
        browserEvidence: [
            'snapshot-import-lms-runtime verifies Track Builder first-class tabs, bound child tables, reports, and outline reordering'
        ],
        evidence: [
            'TrackStages and course-centered TrackSteps are present in the canonical metadata model',
            'TrackStages and TrackSteps are source-managed through neutral record-set bindings on first-class detailsTable placements',
            'Generic details tables can persist TrackStages and TrackSteps order through the runtime reorder endpoint',
            'Track Builder is organized through detailsTabs whose child widgets are separate parent_widget_id/slot_key placements',
            'snapshot-import-lms-runtime verifies builder tabs, bound child tables, saved reports, and outline reordering'
        ]
    },
    {
        area: 'manualEnrollment',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Enrollments', 'Students', 'Courses', 'LearningTracks'],
        requiredStatuses: ['NotStarted', 'InProgress', 'Completed', 'Overdue'],
        browserEvidence: [
            'snapshot-import-lms-runtime verifies My Courses and My Tracks against the actor-scoped shared Enrollments Object'
        ],
        evidence: [
            'Course and Track enrollments remain ordinary runtime records in the shared Enrollments Object',
            'Seeded enrollment rows use the runtime current-user token for learner-scoped assignment ownership',
            'snapshot-import-lms-runtime verifies enrollment runtime records and posting/unposting ledger behavior independently of builder composition'
        ]
    },
    {
        area: 'learnerPlayer',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Courses', 'CourseItems', 'LearningTracks', 'TrackSteps', 'LearnerHome', 'ContentProgress'],
        requiredStatuses: ['NotStarted', 'InProgress', 'Completed'],
        browserEvidence: [
            'snapshot-import-lms-runtime verifies registry-bound course and track learnerPlayer sequencing and persisted progress, plus guest completion flows'
        ],
        evidence: [
            'CourseItems and TrackSteps keep generic runtime progress sequence policies in Entity metadata',
            'Course and Track learnerPlayer placements bind parent record sets and parent-scoped item relation sets through the registry',
            'Published learning pages, learnerPlayer flows, and guest flows persist progress through the shared runtime progress endpoint'
        ]
    },
    {
        area: 'trashRestore',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['TrashEntries'],
        browserEvidence: [
            'snapshot-import-lms-runtime captures Trash and restore-target picker flows in the workspace-scoped Learning Content runtime'
        ],
        evidence: [
            'Runtime delete uses existing lifecycle fields and TrashEntries projects restore metadata',
            'Runtime restore endpoint and generic Trash restore action are covered by focused runtime tests',
            'snapshot-import-lms-runtime captures the workspace-scoped Learning Content Trash view'
        ]
    },
    {
        area: 'assignmentSubmissionAndGrading',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': false
        }),
        requiredEntities: ['Assignments', 'AssignmentSubmissions'],
        requiredStatuses: ['NotStarted', 'PendingReview', 'Declined', 'Accepted'],
        apiEvidence: ['backend and runtime workflow command tests cover assignment review, accept, and decline transitions'],
        evidence: ['backend and runtime workflow command tests cover review, accept, and decline transitions'],
        gaps: [
            'Deferred beyond current Learning Content release scope: browser proof for creating assignment prerequisites entirely through the published UI'
        ]
    },
    {
        area: 'trainingAttendance',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': false
        }),
        requiredEntities: ['TrainingEvents', 'TrainingAttendance', 'AttendanceLedger'],
        requiredStatuses: ['Registered', 'Attended', 'NoShow', 'Cancelled'],
        apiEvidence: ['backend and runtime workflow command tests cover training attendance, no-show, and cancellation transitions'],
        evidence: ['backend and runtime workflow command tests cover attended, no-show, and cancellation transitions'],
        gaps: [
            'Deferred beyond current Learning Content release scope: browser proof for creating training-event prerequisites entirely through the published UI'
        ]
    },
    {
        area: 'certificateIssue',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': false
        }),
        requiredEntities: ['Certificates', 'CertificateIssues', 'CertificateLedger'],
        requiredStatuses: ['Eligible', 'Issued', 'Revoked', 'Expired'],
        apiEvidence: ['backend and runtime workflow command tests cover certificate issue and revoke transitions'],
        evidence: ['backend and runtime workflow command tests cover certificate issue and revoke transitions'],
        gaps: [
            'Deferred beyond current Learning Content release scope: browser proof for creating certificate prerequisites entirely through the published UI'
        ]
    },
    {
        area: 'reports',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Reports'],
        requiredReports: ['LearnerProgress', 'LearningContentSummary'],
        browserEvidence: [
            'snapshot-import-lms-runtime runs and exports the primary Learning Content summary report through the Reports UI'
        ],
        apiEvidence: [
            'runtime report route tests verify saved-definition-only execution, permissions, safe records.union output, and CSV export'
        ],
        evidence: [
            'generic saved report definitions execute through runtime reports API in LMS E2E',
            'runtime report route tests verify saved-definition-only execution, permission checks, safe records.union output, and CSV export without runtime identifiers'
        ],
        gaps: ['Deferred beyond current Learning Content release scope: saved-filter management and scheduled report delivery']
    },
    {
        area: 'knowledgeBase',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: [
            'KnowledgeHome',
            'KnowledgeSpaces',
            'KnowledgeFolders',
            'KnowledgeArticles',
            'KnowledgeBookmarks',
            'KnowledgeArticle'
        ],
        evidence: [
            'Knowledge navigation targets the authored KnowledgeArticles object surface and no longer points to surrogate collections',
            'snapshot-import-lms-runtime creates and edits Knowledge Articles through the published application CRUD surface',
            'fixture contract validates KnowledgeSpaces, KnowledgeFolders, KnowledgeArticles, and article-targeted KnowledgeBookmarks seed rows',
            'generic runtime mutation and Learning Content trash/restore coverage provide the current auditable lifecycle boundary for authored knowledge records'
        ],
        browserEvidence: [
            'snapshot-import-lms-runtime creates and edits Knowledge Articles through the published application CRUD surface'
        ],
        fixtureEvidence: [
            'fixture contract validates KnowledgeSpaces, KnowledgeFolders, KnowledgeArticles, and article-targeted KnowledgeBookmarks seed rows'
        ],
        gaps: [
            'Deferred beyond current Learning Content release scope: Knowledge bookmark UI and permission-limited search product capabilities'
        ]
    },
    {
        area: 'developmentPlan',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': false
        }),
        requiredEntities: ['DevelopmentHome', 'DevelopmentPlans', 'DevelopmentPlanStages', 'DevelopmentPlanTasks'],
        apiEvidence: ['backend and runtime workflow command tests cover development task start, complete, and reopen transitions'],
        evidence: ['backend and runtime workflow command tests cover development task start, complete, and reopen transitions'],
        gaps: [
            'Deferred beyond current Learning Content release scope: browser proof for creating development-plan prerequisites entirely through the published UI',
            'Deferred beyond current Learning Content release scope: mentor comments and export on generic scoped collaboration primitives'
        ]
    },
    {
        area: 'roleVisibility',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Students', 'Departments', 'Classes'],
        browserEvidence: ['snapshot-import-lms-runtime verifies owner/shared Learning Content access behavior in published runtime views'],
        apiEvidence: ['backend route tests verify owner/shared predicates and fail-closed unsupported scoped role policies'],
        evidence: [
            'Learning Content resources, courses, and tracks use generic owner-or-shared runtimeRecordAccess backed by ContentAccessEntries',
            'backend runtime route tests verify read-only members receive owner/shared predicates before rows are returned',
            'unsupported recordOwner, department, class, and group role-policy allow rules are downgraded and tested fail-closed in backend and application settings UI'
        ],
        gaps: [
            'Deferred beyond current Learning Content release scope: department, class, and group predicates beyond the current workspace plus owner/shared visibility scope'
        ]
    },
    {
        area: 'workspaceIsolation',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['Students', 'Departments', 'Classes'],
        browserEvidence: ['snapshot-import-lms-runtime verifies imported LMS runtime rows with workspace context and workspace navigation'],
        evidence: ['runtime workspaces and imported LMS runtime rows are verified with workspace context']
    },
    {
        area: 'publicGuestAccess',
        gates: acceptanceGates({
            seeded: true,
            visible: true,
            actionable: true,
            audited: true,
            'workspace-isolated': true,
            'covered-by-e2e': true
        }),
        requiredEntities: ['AccessLinks', 'LearningResources', 'QuizAttempts', 'ProgressLedger'],
        requiredStatuses: ['Completed'],
        browserEvidence: ['snapshot-import-lms-runtime verifies public guest session, progress, quiz submit, and completion flows'],
        evidence: ['public guest session, progress, quiz submit, and completion flow pass in LMS runtime E2E']
    }
])

export const LMS_DEMO_RESOURCES = [
    resourceDefinitionSchema.parse({
        codename: 'CourseOverviewPageResource',
        title: buildVLC('Course overview page', 'Страница обзора курса'),
        source: { type: 'page', pageCodename: 'CourseOverview' },
        estimatedTimeMinutes: 5,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'SafetyVideoResource',
        title: buildVLC('Safety intro video', 'Вводное видео по безопасности'),
        source: { type: 'video', url: 'https://example.test/lms/safety-intro.mp4', mimeType: 'video/mp4' },
        estimatedTimeMinutes: 8,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'LearningPortalLinkResource',
        title: buildVLC('Learning portal web link', 'Веб-ссылка учебного портала'),
        source: { type: 'url', url: 'https://example.test/lms/portal-guide', launchMode: 'newTab' },
        estimatedTimeMinutes: 3,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'SafetyAudioBriefingResource',
        title: buildVLC('Safety audio briefing', 'Аудиобрифинг по безопасности'),
        source: { type: 'audio', url: 'https://example.test/lms/safety-briefing.mp3', mimeType: 'audio/mpeg' },
        estimatedTimeMinutes: 4,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'CertificatePolicyDocumentResource',
        title: buildVLC('Certificate policy PDF', 'PDF политики сертификатов'),
        source: { type: 'document', url: 'https://example.test/lms/certificate-policy.pdf', mimeType: 'application/pdf' },
        estimatedTimeMinutes: 6,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'EmbeddedOrientationResource',
        title: buildVLC('Embedded orientation video', 'Встроенное вводное видео'),
        source: { type: 'embed', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
        estimatedTimeMinutes: 5,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'ScormPlaceholderResource',
        title: buildVLC('SCORM package placeholder', 'Заполнитель SCORM-пакета'),
        source: {
            type: 'scorm',
            packageDescriptor: {
                standard: 'SCORM 2004',
                status: 'deferred',
                manifest: 'imsmanifest.xml'
            }
        },
        estimatedTimeMinutes: 15,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'XapiPlaceholderResource',
        title: buildVLC('xAPI package placeholder', 'Заполнитель пакета xAPI'),
        source: {
            type: 'xapi',
            packageDescriptor: {
                standard: 'xAPI',
                status: 'deferred',
                launch: 'index.html'
            }
        },
        estimatedTimeMinutes: 12,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'CertificatePolicyResource',
        title: buildVLC('Certificate policy page', 'Страница политики сертификатов'),
        source: { type: 'page', pageCodename: 'CertificatePolicy' },
        estimatedTimeMinutes: 4,
        language: 'en'
    })
] as const

export const LMS_DEMO_COURSES = [
    {
        key: 'onboarding-course',
        title: { en: 'Learner Onboarding Course', ru: 'Курс адаптации учащегося' },
        description: { en: 'A short course for the first learner journey.', ru: 'Короткий курс для первого учебного маршрута.' },
        instructor: { en: 'Training Team', ru: 'Команда обучения' },
        estimatedTimeMinutes: 22,
        catalogCategory: { en: 'Onboarding', ru: 'Адаптация' },
        catalogAudience: { en: 'New learners', ru: 'Новые учащиеся' },
        selfEnrollmentMode: 'open'
    },
    {
        key: 'compliance-course',
        title: { en: 'Compliance Refresh Course', ru: 'Курс обновления требований' },
        description: { en: 'Required refresher materials and checks.', ru: 'Обязательные материалы и проверки.' },
        instructor: { en: 'Training Team', ru: 'Команда обучения' },
        estimatedTimeMinutes: 18,
        catalogCategory: { en: 'Compliance', ru: 'Соответствие' },
        catalogAudience: { en: 'All learners', ru: 'Все учащиеся' },
        selfEnrollmentMode: 'disabled'
    }
] as const

export const LMS_DEMO_KNOWLEDGE_SPACE = {
    key: 'operations-knowledge',
    title: { en: 'Operations Knowledge', ru: 'Операционные знания' },
    description: { en: 'Shared articles for daily learning support.', ru: 'Общие статьи для ежедневной поддержки обучения.' }
} as const

export const LMS_DEMO_KNOWLEDGE_ARTICLE = {
    key: 'getting-started',
    title: { en: 'Getting started with learning', ru: 'Как начать обучение' },
    body: {
        en: 'Open your assigned content, review the brief, and complete the readiness check.',
        ru: 'Откройте назначенный контент, изучите брифинг и завершите проверку готовности.'
    }
} as const

export const LMS_DEMO_DEVELOPMENT_PLAN = {
    key: 'ava-onboarding-plan',
    title: { en: 'Ava onboarding plan', ru: 'План адаптации Авы' },
    stageTitle: { en: 'First week', ru: 'Первая неделя' },
    taskTitle: { en: 'Complete the learner onboarding course', ru: 'Завершить курс адаптации учащегося' }
} as const

export const LMS_DEMO_GAMIFICATION_SETTINGS = [
    {
        key: 'application-default',
        scope: 'application',
        workspaceKey: null,
        enabled: true,
        leaderboardPeriodDays: 30,
        rules: {
            leaderboard: { period: 'rolling_30_days', tieBreaker: 'completed_at' },
            achievementsPage: { showCertificates: true, showBadges: true, showRank: true }
        }
    }
] as const

export const LMS_DEMO_POINT_AWARD_RULES = [
    {
        key: 'content-completed',
        ruleCode: 'content.completed',
        name: { en: 'Content completed', ru: 'Контент завершён' },
        sourceType: 'Course',
        points: 25,
        isActive: true,
        conditions: { completionStatus: 'Completed' }
    },
    {
        key: 'assignment-accepted',
        ruleCode: 'assignment.accepted',
        name: { en: 'Assignment accepted', ru: 'Задание принято' },
        sourceType: 'Assignment',
        points: 15,
        isActive: true,
        conditions: { status: 'Accepted' }
    },
    {
        key: 'manual-adjustment',
        ruleCode: 'manual.adjustment',
        name: { en: 'Manual adjustment', ru: 'Ручная корректировка' },
        sourceType: 'Manual',
        points: 10,
        isActive: true,
        conditions: { requiresApproval: true }
    }
] as const

export const LMS_DEMO_POINT_TRANSACTIONS = [
    {
        key: 'ava-content-completion',
        studentKey: 'ava-solaris',
        sourceType: 'Course',
        sourceObjectKey: 'learning-path',
        pointsDelta: 25,
        reason: { en: 'Completed Learning Path 101', ru: 'Завершён Учебный маршрут 101' },
        awardedAt: '2061-02-01T10:05:00.000Z',
        status: 'Approved'
    },
    {
        key: 'ava-manual-bonus',
        studentKey: 'ava-solaris',
        sourceType: 'Manual',
        sourceObjectKey: 'manual-adjustment',
        pointsDelta: 10,
        reason: { en: 'Instructor bonus for early completion', ru: 'Бонус преподавателя за раннее завершение' },
        awardedAt: '2061-02-01T10:10:00.000Z',
        status: 'Pending'
    },
    {
        key: 'maksim-assignment-credit',
        studentKey: 'maksim-vega',
        sourceType: 'Assignment',
        sourceObjectKey: 'assignment-accepted',
        pointsDelta: 15,
        reason: { en: 'Accepted assignment submission', ru: 'Принятая сдача задания' },
        awardedAt: '2061-02-01T11:00:00.000Z',
        status: 'Approved'
    }
] as const

export const LMS_DEMO_BADGES = [
    {
        key: 'first-content',
        badgeCode: 'first.content',
        name: { en: 'First content completed', ru: 'Первый контент завершён' },
        description: { en: 'Awarded after the first completed content.', ru: 'Выдаётся после первого завершённого контента.' },
        requiredPoints: 25,
        icon: 'WorkspacePremium',
        isActive: true
    },
    {
        key: 'fast-starter',
        badgeCode: 'fast.starter',
        name: { en: 'Fast starter', ru: 'Быстрый старт' },
        description: {
            en: 'Awarded for early completion or instructor bonus.',
            ru: 'Выдаётся за раннее завершение или бонус преподавателя.'
        },
        requiredPoints: 35,
        icon: 'Bolt',
        isActive: true
    }
] as const

export const LMS_DEMO_BADGE_ISSUES = [
    {
        key: 'ava-first-content',
        studentKey: 'ava-solaris',
        badgeKey: 'first-content',
        issuedAt: '2061-02-01T10:15:00.000Z',
        revokedAt: null,
        status: 'Issued',
        reason: { en: 'Completed the first content item.', ru: 'Завершён первый элемент контента.' }
    },
    {
        key: 'ava-fast-starter',
        studentKey: 'ava-solaris',
        badgeKey: 'fast-starter',
        issuedAt: '2061-02-01T10:20:00.000Z',
        revokedAt: null,
        status: 'Eligible',
        reason: { en: 'Pending manual bonus approval.', ru: 'Ожидается подтверждение ручного бонуса.' }
    }
] as const

export const LMS_DEMO_LEADERBOARD = [
    {
        key: 'ava-current',
        studentKey: 'ava-solaris',
        period: 'current',
        totalPoints: 35,
        rank: 1,
        badgeCount: 1,
        calculatedAt: '2061-02-01T12:00:00.000Z'
    },
    {
        key: 'maksim-current',
        studentKey: 'maksim-vega',
        period: 'current',
        totalPoints: 15,
        rank: 2,
        badgeCount: 0,
        calculatedAt: '2061-02-01T12:00:00.000Z'
    }
] as const

/** Report identities covered by the fixture contract; definitions live in the LMS template seed. */
export const LMS_DEMO_REPORTS = [
    { codename: 'LearningContentSummary' },
    { codename: 'LearnerProgress' },
    { codename: 'CourseProgress' },
    { codename: 'CourseBuilderOutline' },
    { codename: 'TrackBuilderOutline' },
    { codename: 'Leaderboard' },
    { codename: 'Achievements' }
] as const

export const LMS_DEMO_ACCESS_LINKS = [
    {
        key: 'demo-content',
        slug: LMS_SAMPLE_LINK.slug,
        title: LMS_SAMPLE_LINK.title,
        contentKey: 'learning-path',
        classKey: 'learning-path'
    },
    {
        key: 'docking-drill',
        slug: LMS_SECONDARY_LINK.slug,
        title: LMS_SECONDARY_LINK.title,
        contentKey: 'docking-corridor',
        classKey: 'learning-path'
    }
] as const

export const LMS_DEMO_ENROLLMENTS = [
    {
        key: 'ava-learning-path',
        studentKey: 'ava-solaris',
        classKey: 'learning-path',
        contentKey: 'learning-path'
    },
    {
        key: 'ava-docking-corridor',
        studentKey: 'ava-solaris',
        classKey: 'learning-path',
        contentKey: 'docking-corridor'
    },
    {
        key: 'maksim-lunar-logistics',
        studentKey: 'maksim-vega',
        classKey: 'lunar-logistics',
        contentKey: 'lunar-logistics'
    }
] as const

export const LMS_RUNTIME_CURRENT_USER_ID_TOKEN = '{{runtime.currentUserId}}'

export const LMS_DEMO_CONTENT_PROGRESS = [
    {
        key: 'ava-learning-path-progress',
        studentKey: 'ava-solaris',
        contentKey: 'learning-path',
        status: 'completed',
        progressPercent: 100
    },
    {
        key: 'ava-docking-corridor-progress',
        studentKey: 'ava-solaris',
        contentKey: 'docking-corridor',
        status: 'in_progress',
        progressPercent: 50
    },
    {
        key: 'maksim-lunar-logistics-progress',
        studentKey: 'maksim-vega',
        contentKey: 'lunar-logistics',
        status: 'completed',
        progressPercent: 100
    }
] as const

export const LMS_DEMO_QUIZ_RESPONSES = [
    {
        key: 'ava-learning-path-q1',
        studentKey: 'ava-solaris',
        quizKey: 'learning-path',
        questionId: 'learning-path-question-1',
        selectedOptionIds: ['learning-q1-opt-a'],
        isCorrect: true,
        attemptNumber: 1
    },
    {
        key: 'ava-learning-path-q2',
        studentKey: 'ava-solaris',
        quizKey: 'learning-path',
        questionId: 'learning-path-question-2',
        selectedOptionIds: ['learning-q2-opt-a'],
        isCorrect: true,
        attemptNumber: 1
    },
    {
        key: 'ava-docking-corridor-q1',
        studentKey: 'ava-solaris',
        quizKey: 'docking-corridor',
        questionId: 'docking-corridor-question-1',
        selectedOptionIds: ['docking-q1-opt-a'],
        isCorrect: true,
        attemptNumber: 1
    },
    {
        key: 'ava-docking-corridor-q2',
        studentKey: 'ava-solaris',
        quizKey: 'docking-corridor',
        questionId: 'docking-corridor-question-2',
        selectedOptionIds: ['docking-q2-opt-a'],
        isCorrect: true,
        attemptNumber: 1
    },
    {
        key: 'maksim-lunar-logistics-q1',
        studentKey: 'maksim-vega',
        quizKey: 'lunar-logistics',
        questionId: 'lunar-logistics-question-1',
        selectedOptionIds: ['logistics-q1-opt-a'],
        isCorrect: true,
        attemptNumber: 1
    },
    {
        key: 'maksim-lunar-logistics-q2',
        studentKey: 'maksim-vega',
        quizKey: 'lunar-logistics',
        questionId: 'lunar-logistics-question-2',
        selectedOptionIds: ['logistics-q2-opt-a'],
        isCorrect: true,
        attemptNumber: 1
    }
] as const

export const LMS_DEMO_CLASS = LMS_DEMO_CLASSES[0]
export const LMS_DEMO_STUDENT = LMS_DEMO_STUDENTS[0]
export const LMS_DEMO_CONTENT_NODE = LMS_DEMO_CONTENT_NODES[0]
export const LMS_DEMO_QUIZ = LMS_DEMO_QUIZZES[0]

type SnapshotEntity = {
    id?: string
    codename?: unknown
    kind?: string
    fields?: Array<Record<string, unknown>>
    config?: Record<string, unknown>
    presentation?: {
        name?: unknown
    }
}
type SnapshotElement = { id?: string; data?: Record<string, unknown> }
type SnapshotModule = Record<string, unknown>
type SnapshotLayoutWidget = Record<string, unknown>

export type SnapshotEnvelope = Record<string, unknown> & {
    bundleVersion?: unknown
    snapshot?: {
        version?: unknown
        entities?: Record<string, SnapshotEntity>
        entityTypeDefinitions?: Record<string, Record<string, unknown>>
        elements?: Record<string, SnapshotElement[]>
        fixedValues?: Record<string, Array<Record<string, unknown>>>
        optionValues?: Record<string, Array<Record<string, unknown>>>
        modules?: SnapshotModule[]
        layouts?: Array<Record<string, unknown>>
        scopedLayouts?: Array<Record<string, unknown>>
        layoutZoneWidgets?: SnapshotLayoutWidget[]
        defaultLayoutId?: unknown
        runtimePolicy?: {
            workspaceMode?: unknown
        }
        versionEnvelope?: {
            structureVersion?: unknown
            templateVersion?: unknown
            snapshotFormatVersion?: unknown
        }
    }
    metahub?: {
        name?: unknown
        description?: unknown
        codename?: unknown
    }
    snapshotHash?: string
}

const REQUIRED_ENTITY_CODENAMES = [
    'LearnerHome',
    'CourseOverview',
    'KnowledgeHome',
    'KnowledgeArticle',
    'DevelopmentHome',
    'AssignmentInstructions',
    'CertificatePolicy',
    'Classes',
    'Students',
    'Departments',
    'ContentProjects',
    'ContentAccessEntries',
    'ContentStars',
    'RecentContentViews',
    'ContentProgress',
    'TrashEntries',
    'LearningContentDefaults',
    'SupportedResourceTypes',
    'PlayerPresets',
    'LearningContentColumnPresets',
    'EnrollmentDefaults',
    'CompletionDefaults',
    'LearningResources',
    'Courses',
    'CourseSections',
    'CourseItems',
    'LearningTracks',
    'TrackStages',
    'TrackSteps',
    'Quizzes',
    'QuizResponses',
    'QuizAttempts',
    'LearningActivityLedger',
    'ProgressLedger',
    'ScoreLedger',
    'EnrollmentLedger',
    'AttendanceLedger',
    'CertificateLedger',
    'PointsLedger',
    'NotificationLedger',
    'ContentProgress',
    'AccessLinks',
    'Enrollments',
    'Assignments',
    'AssignmentSubmissions',
    'TrainingEvents',
    'TrainingAttendance',
    'Certificates',
    'CertificateIssues',
    'KnowledgeSpaces',
    'KnowledgeFolders',
    'KnowledgeArticles',
    'KnowledgeBookmarks',
    'DevelopmentPlans',
    'DevelopmentPlanStages',
    'DevelopmentPlanTasks',
    'NotificationRules',
    'NotificationOutbox',
    'GamificationSettings',
    'PointAwardRules',
    'PointTransactions',
    'BadgeDefinitions',
    'BadgeIssues',
    'LeaderboardSnapshots',
    'Reports',
    'ResourceType',
    'PublicationStatus',
    'CompletionStatus',
    'AttemptStatus',
    'AssignmentReviewStatus',
    'TrainingAttendanceStatus',
    'AssignmentStatus',
    'TrainingEventType',
    'CertificateStatus',
    'PointSourceType',
    'ReportType'
]

type RequiredWorkflowAction = {
    entityCodename: string
    actionCodename: string
    from: string[]
    to: string
    statusFieldCodename?: string
    requiredCapabilities: string[]
    postingCommand?: 'post' | 'unpost' | 'void'
    moduleCodename?: string
}

const REQUIRED_WORKFLOW_ACTIONS: RequiredWorkflowAction[] = [
    {
        entityCodename: 'LearningResources',
        actionCodename: 'PublishLearningResource',
        from: ['Draft', 'UnpublishedChanges'],
        to: 'Published',
        statusFieldCodename: 'PublicationStatus',
        requiredCapabilities: ['workflow.execute']
    },
    {
        entityCodename: 'LearningResources',
        actionCodename: 'ReturnLearningResourceToDraft',
        from: ['Published', 'UnpublishedChanges'],
        to: 'Draft',
        statusFieldCodename: 'PublicationStatus',
        requiredCapabilities: ['workflow.execute']
    },
    {
        entityCodename: 'LearningResources',
        actionCodename: 'MarkLearningResourceChanged',
        from: ['Published'],
        to: 'UnpublishedChanges',
        statusFieldCodename: 'PublicationStatus',
        requiredCapabilities: ['workflow.execute']
    },
    {
        entityCodename: 'AssignmentSubmissions',
        actionCodename: 'StartSubmissionReview',
        from: ['Submitted'],
        to: 'PendingReview',
        requiredCapabilities: ['assignment.review']
    },
    {
        entityCodename: 'AssignmentSubmissions',
        actionCodename: 'AcceptSubmission',
        from: ['PendingReview'],
        to: 'Accepted',
        requiredCapabilities: ['assignment.review'],
        postingCommand: 'post'
    },
    {
        entityCodename: 'AssignmentSubmissions',
        actionCodename: 'DeclineSubmission',
        from: ['PendingReview'],
        to: 'Declined',
        requiredCapabilities: ['assignment.review']
    },
    {
        entityCodename: 'TrainingAttendance',
        actionCodename: 'MarkAttendanceAttended',
        from: ['Registered'],
        to: 'Attended',
        requiredCapabilities: ['attendance.mark'],
        postingCommand: 'post'
    },
    {
        entityCodename: 'TrainingAttendance',
        actionCodename: 'MarkAttendanceNoShow',
        from: ['Registered'],
        to: 'NoShow',
        requiredCapabilities: ['attendance.mark'],
        postingCommand: 'post'
    },
    {
        entityCodename: 'TrainingAttendance',
        actionCodename: 'CancelAttendance',
        from: ['Registered', 'Attended', 'NoShow'],
        to: 'Cancelled',
        requiredCapabilities: ['attendance.manage'],
        postingCommand: 'void'
    },
    {
        entityCodename: 'CertificateIssues',
        actionCodename: 'IssueCertificate',
        from: ['Eligible'],
        to: 'Issued',
        requiredCapabilities: ['certificate.issue'],
        postingCommand: 'post',
        moduleCodename: 'CertificateIssuePostingModule'
    },
    {
        entityCodename: 'CertificateIssues',
        actionCodename: 'RevokeCertificate',
        from: ['Issued'],
        to: 'Revoked',
        requiredCapabilities: ['certificate.revoke'],
        postingCommand: 'post',
        moduleCodename: 'CertificateIssuePostingModule'
    },
    {
        entityCodename: 'DevelopmentPlanTasks',
        actionCodename: 'StartDevelopmentTask',
        from: ['NotStarted'],
        to: 'InProgress',
        requiredCapabilities: ['development.task.update']
    },
    {
        entityCodename: 'DevelopmentPlanTasks',
        actionCodename: 'CompleteDevelopmentTask',
        from: ['InProgress'],
        to: 'Completed',
        requiredCapabilities: ['development.task.update']
    },
    {
        entityCodename: 'DevelopmentPlanTasks',
        actionCodename: 'ReopenDevelopmentTask',
        from: ['Completed'],
        to: 'InProgress',
        requiredCapabilities: ['development.task.update']
    },
    {
        entityCodename: 'NotificationOutbox',
        actionCodename: 'MarkNotificationSent',
        from: ['Queued', 'Failed'],
        to: 'Sent',
        requiredCapabilities: ['notification.deliver'],
        postingCommand: 'post'
    },
    {
        entityCodename: 'NotificationOutbox',
        actionCodename: 'MarkNotificationFailed',
        from: ['Queued'],
        to: 'Failed',
        requiredCapabilities: ['notification.deliver']
    },
    {
        entityCodename: 'NotificationOutbox',
        actionCodename: 'CancelNotification',
        from: ['Queued', 'Failed'],
        to: 'Cancelled',
        requiredCapabilities: ['notification.manage'],
        postingCommand: 'void'
    },
    {
        entityCodename: 'PointTransactions',
        actionCodename: 'ApprovePointAdjustment',
        from: ['Pending'],
        to: 'Approved',
        requiredCapabilities: ['gamification.points.adjust'],
        postingCommand: 'post',
        moduleCodename: 'PointTransactionPostingModule'
    },
    {
        entityCodename: 'PointTransactions',
        actionCodename: 'ReversePointAdjustment',
        from: ['Approved'],
        to: 'Reversed',
        requiredCapabilities: ['gamification.points.adjust'],
        postingCommand: 'void',
        moduleCodename: 'PointTransactionPostingModule'
    },
    {
        entityCodename: 'BadgeIssues',
        actionCodename: 'IssueBadge',
        from: ['Eligible'],
        to: 'Issued',
        requiredCapabilities: ['badge.issue']
    },
    {
        entityCodename: 'BadgeIssues',
        actionCodename: 'RevokeBadge',
        from: ['Issued'],
        to: 'Revoked',
        requiredCapabilities: ['badge.revoke']
    }
] as const

const REQUIRED_BASIC_BASELINE_ENTITIES = [
    { kind: 'hub', name: 'Main' },
    { kind: 'object', name: 'Main' },
    { kind: 'set', name: 'Main' },
    { kind: 'enumeration', name: 'Main' }
] as const

const readLocalizedText = (value: unknown, locale = 'en'): string | undefined => {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object') {
        return undefined
    }

    const localized = value as {
        _primary?: string
        locales?: Record<string, { content?: string }>
        [key: string]: unknown
    }
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const locales = localized.locales ?? {}
    const readLocaleValue = (entry: unknown): string | undefined => {
        if (typeof entry === 'string' && entry.length > 0) return entry
        if (!entry || typeof entry !== 'object') return undefined
        const content = (entry as { content?: unknown }).content
        return typeof content === 'string' && content.length > 0 ? content : undefined
    }
    const directValue = readLocaleValue(locales[normalizedLocale]) ?? readLocaleValue(localized[normalizedLocale])
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryValue = localized._primary
        ? readLocaleValue(locales[localized._primary]) ?? readLocaleValue(localized[localized._primary])
        : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.entries(Object.keys(locales).length > 0 ? locales : localized)
        .filter(([key]) => !key.startsWith('_') && key !== 'locales')
        .map(([, entry]) => readLocaleValue(entry))
        .find((entry): entry is string => typeof entry === 'string')
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

const readWidgetConfig = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const readRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const assertLocalizedFixtureValue = (errors: string[], value: unknown, expected: { en: string; ru: string }, label: string) => {
    const actualEn = readLocalizedText(value, 'en')
    const actualRu = readLocalizedText(value, 'ru')
    if (actualEn !== expected.en) {
        errors.push(`${label} is missing the canonical English value`)
    }
    if (actualRu !== expected.ru) {
        errors.push(`${label} is missing the canonical Russian value`)
    }
}

const assertLmsReportSeedRows = (
    errors: string[],
    reportRows: SnapshotElement[],
    expectedReports: ReadonlyArray<{ codename: string }>,
    progressReportTypeId: unknown
): Map<string, SnapshotElement> => {
    const reportRowsByCodename = new Map<string, SnapshotElement>()

    for (const expectedReport of expectedReports) {
        const reportMatches = reportRows.filter((row) => readRecord(row?.data?.__templateSeed)?.codename === expectedReport.codename)
        if (reportMatches.length !== 1) {
            errors.push(
                `LMS fixture must contain exactly one template-seeded Reports row for ${expectedReport.codename}; found ${reportMatches.length}`
            )
            continue
        }

        const reportRow = reportMatches[0]
        reportRowsByCodename.set(expectedReport.codename, reportRow)

        if (!isUuidV7(reportRow.id)) {
            errors.push(`LMS report ${expectedReport.codename} must keep its UUID v7 identity`)
        }
        if (typeof progressReportTypeId !== 'string' || reportRow.data?.ReportType !== progressReportTypeId) {
            errors.push(`LMS report ${expectedReport.codename} must resolve ReportType to the seeded Progress option`)
        }

        const reportDefinition = reportDefinitionSchema.safeParse(reportRow.data?.Definition)
        if (!reportDefinition.success) {
            errors.push(`LMS report ${expectedReport.codename} must store a valid generic report definition`)
            continue
        }
        if (reportDefinition.data.codename !== expectedReport.codename) {
            errors.push(`LMS report ${expectedReport.codename} must keep its canonical report codename`)
        }

        const title = {
            en: readLocalizedText(reportDefinition.data.title, 'en') ?? '',
            ru: readLocalizedText(reportDefinition.data.title, 'ru') ?? ''
        }
        assertLocalizedFixtureValue(errors, reportRow.data?.Name, title, `LMS report ${expectedReport.codename} name`)

        if (expectedReport.codename === 'LearningContentSummary') {
            if (reportDefinition.data.datasource.kind !== 'records.union') {
                errors.push('LMS LearningContentSummary report must use the generic records.union datasource')
            } else {
                const targetDisplayTypes = new Set(
                    reportDefinition.data.datasource.targets
                        .map((target) => target.displayType)
                        .filter((value): value is string => typeof value === 'string')
                )
                for (const displayType of ['resource', 'course', 'track']) {
                    if (!targetDisplayTypes.has(displayType)) {
                        errors.push(`LMS LearningContentSummary report must include the ${displayType} union target`)
                    }
                }
                if (!reportDefinition.data.datasource.projectedFields?.includes('Instructor')) {
                    errors.push('LMS LearningContentSummary report must project the generic Instructor component')
                }
                const columnFields = new Set(reportDefinition.data.columns.map((column) => column.field))
                for (const field of ['type', 'title', 'status', 'Instructor', 'project']) {
                    if (!columnFields.has(field)) {
                        errors.push(`LMS LearningContentSummary report must expose the safe ${field} column`)
                    }
                }
            }
        } else if (expectedReport.codename === 'LearnerProgress') {
            const datasource = reportDefinition.data.datasource
            if (datasource.kind !== 'records.list' || datasource.sectionCodename !== 'ContentProgress') {
                errors.push('LMS LearnerProgress report must list entity-backed ContentProgress records')
            }

            const requiredAggregation = reportDefinition.data.aggregations.some(
                (aggregation) =>
                    aggregation.field === 'ProgressPercent' && aggregation.function === 'avg' && aggregation.alias === 'AverageProgress'
            )
            if (!requiredAggregation) {
                errors.push('LMS LearnerProgress report must aggregate ProgressPercent as AverageProgress')
            }

            const requiredColumns = [
                { field: 'ProgressStudentId', type: 'text' },
                { field: 'ProgressPercent', type: 'number' },
                { field: 'ProgressStatus', type: 'status' }
            ] as const
            for (const requiredColumn of requiredColumns) {
                const column = reportDefinition.data.columns.find(({ field }) => field === requiredColumn.field)
                if (!column || column.type !== requiredColumn.type) {
                    errors.push(`LMS LearnerProgress report must include the ${requiredColumn.type} ${requiredColumn.field} column`)
                }
            }
        } else if (reportDefinition.data.datasource.kind !== 'records.list') {
            errors.push(`LMS report ${expectedReport.codename} must use an existing generic records.list datasource`)
        }
    }

    return reportRowsByCodename
}

const isVersionedLocalizedText = (value: unknown): boolean => {
    const record = readRecord(value)
    const locales = readRecord(record?.locales)
    if (!locales) return false

    const english = readRecord(locales.en)?.content
    const russian = readRecord(locales.ru)?.content
    return typeof english === 'string' && english.trim().length > 0 && typeof russian === 'string' && russian.trim().length > 0
}

const assertEditorBlockTextLocalized = (errors: string[], body: unknown, label: string) => {
    const bodyRecord = readRecord(body)
    const blocks = Array.isArray(bodyRecord?.blocks) ? bodyRecord.blocks : []
    for (const [index, block] of blocks.entries()) {
        const blockRecord = readRecord(block)
        const data = readRecord(blockRecord?.data)
        const text = data?.text
        if (text === undefined || text === null || text === '') continue
        if (!isVersionedLocalizedText(text)) {
            errors.push(`${label} block ${index + 1} text must be a localized English/Russian VLC value`)
        }
    }
}

const getSeededRows = (elementsByEntityId: Record<string, SnapshotElement[]>, entityId: string | undefined) => {
    if (!entityId) {
        return []
    }

    return Array.isArray(elementsByEntityId[entityId]) ? elementsByEntityId[entityId] : []
}

const findRowByField = (rows: SnapshotElement[], fieldName: string, expectedValue: string, locale: 'en' | 'ru' = 'en') =>
    rows.find((row) => {
        const value = row?.data?.[fieldName]
        if (typeof value === 'string') {
            return value === expectedValue
        }
        return readLocalizedText(value, locale) === expectedValue
    })

export function buildLmsLiveMetahubName(_runId?: string) {
    return { ...LMS_CANONICAL_METAHUB.name }
}

export function buildLmsLiveMetahubCodename(_runId?: string) {
    return buildVLC(LMS_CANONICAL_METAHUB.codename.en, LMS_CANONICAL_METAHUB.codename.ru)
}

function assertLmsSeededRowsContract(options: {
    envelope: SnapshotEnvelope
    entityByCodename: Map<string, SnapshotEntity>
    errors: string[]
}): void {
    const { envelope, entityByCodename, errors } = options
    const elementsByEntityId = envelope.snapshot?.elements ?? {}
    const classRows = getSeededRows(elementsByEntityId, entityByCodename.get('Classes')?.id)
    const studentRows = getSeededRows(elementsByEntityId, entityByCodename.get('Students')?.id)
    const contentProjectRows = getSeededRows(elementsByEntityId, entityByCodename.get('ContentProjects')?.id)
    const contentAccessRows = getSeededRows(elementsByEntityId, entityByCodename.get('ContentAccessEntries')?.id)
    const contentStarRows = getSeededRows(elementsByEntityId, entityByCodename.get('ContentStars')?.id)
    const recentContentRows = getSeededRows(elementsByEntityId, entityByCodename.get('RecentContentViews')?.id)
    const resourceRows = getSeededRows(elementsByEntityId, entityByCodename.get('LearningResources')?.id)
    const courseRows = getSeededRows(elementsByEntityId, entityByCodename.get('Courses')?.id)
    const courseSectionRows = getSeededRows(elementsByEntityId, entityByCodename.get('CourseSections')?.id)
    const courseItemRows = getSeededRows(elementsByEntityId, entityByCodename.get('CourseItems')?.id)
    const learningTrackRows = getSeededRows(elementsByEntityId, entityByCodename.get('LearningTracks')?.id)
    const trackStageRows = getSeededRows(elementsByEntityId, entityByCodename.get('TrackStages')?.id)
    const trackStepRows = getSeededRows(elementsByEntityId, entityByCodename.get('TrackSteps')?.id)
    const quizRows = getSeededRows(elementsByEntityId, entityByCodename.get('Quizzes')?.id)
    const quizResponseRows = getSeededRows(elementsByEntityId, entityByCodename.get('QuizResponses')?.id)
    const contentProgressRows = getSeededRows(elementsByEntityId, entityByCodename.get('ContentProgress')?.id)
    const accessLinkRows = getSeededRows(elementsByEntityId, entityByCodename.get('AccessLinks')?.id)
    const enrollmentRows = getSeededRows(elementsByEntityId, entityByCodename.get('Enrollments')?.id)
    const knowledgeSpaceRows = getSeededRows(elementsByEntityId, entityByCodename.get('KnowledgeSpaces')?.id)
    const knowledgeFolderRows = getSeededRows(elementsByEntityId, entityByCodename.get('KnowledgeFolders')?.id)
    const knowledgeArticleRows = getSeededRows(elementsByEntityId, entityByCodename.get('KnowledgeArticles')?.id)
    const knowledgeBookmarkRows = getSeededRows(elementsByEntityId, entityByCodename.get('KnowledgeBookmarks')?.id)
    const developmentPlanRows = getSeededRows(elementsByEntityId, entityByCodename.get('DevelopmentPlans')?.id)
    const developmentPlanStageRows = getSeededRows(elementsByEntityId, entityByCodename.get('DevelopmentPlanStages')?.id)
    const developmentPlanTaskRows = getSeededRows(elementsByEntityId, entityByCodename.get('DevelopmentPlanTasks')?.id)
    const gamificationSettingRows = getSeededRows(elementsByEntityId, entityByCodename.get('GamificationSettings')?.id)
    const pointAwardRuleRows = getSeededRows(elementsByEntityId, entityByCodename.get('PointAwardRules')?.id)
    const pointTransactionRows = getSeededRows(elementsByEntityId, entityByCodename.get('PointTransactions')?.id)
    const badgeDefinitionRows = getSeededRows(elementsByEntityId, entityByCodename.get('BadgeDefinitions')?.id)
    const badgeIssueRows = getSeededRows(elementsByEntityId, entityByCodename.get('BadgeIssues')?.id)
    const leaderboardRows = getSeededRows(elementsByEntityId, entityByCodename.get('LeaderboardSnapshots')?.id)
    const reportRows = getSeededRows(elementsByEntityId, entityByCodename.get('Reports')?.id)
    const reportTypeEntityId = entityByCodename.get('ReportType')?.id
    const progressReportType = reportTypeEntityId
        ? (envelope.snapshot?.optionValues?.[reportTypeEntityId] ?? []).find(
              (optionValue) => readLocalizedText(optionValue.codename, 'en') === 'Progress'
          )
        : undefined
    if (typeof progressReportType?.id !== 'string') {
        errors.push('LMS ReportType enumeration must export the seeded Progress option')
    }

    const expectedCounts = [
        ['class', classRows.length, LMS_DEMO_CLASSES.length],
        ['student', studentRows.length, LMS_DEMO_STUDENTS.length],
        ['content project', contentProjectRows.length, 2],
        ['content access entry', contentAccessRows.length, 1],
        ['content star', contentStarRows.length, 1],
        ['recent content view', recentContentRows.length, 1],
        ['resource', resourceRows.length, LMS_DEMO_RESOURCES.length + LMS_DEMO_CONTENT_NODES.length],
        ['course', courseRows.length, LMS_DEMO_COURSES.length],
        ['course section', courseSectionRows.length, 3],
        ['course item', courseItemRows.length, 3],
        ['learning track', learningTrackRows.length, 2],
        ['track stage', trackStageRows.length, 2],
        ['track step', trackStepRows.length, 3],
        ['quiz', quizRows.length, LMS_DEMO_QUIZZES.length],
        ['quiz response', quizResponseRows.length, LMS_DEMO_QUIZ_RESPONSES.length],
        ['content progress', contentProgressRows.length, LMS_DEMO_CONTENT_PROGRESS.length],
        ['access link', accessLinkRows.length, LMS_DEMO_ACCESS_LINKS.length],
        ['enrollment', enrollmentRows.length, LMS_DEMO_ENROLLMENTS.length + 2],
        ['knowledge space', knowledgeSpaceRows.length, 1],
        ['knowledge folder', knowledgeFolderRows.length, 1],
        ['knowledge article', knowledgeArticleRows.length, 1],
        ['knowledge bookmark', knowledgeBookmarkRows.length, 1],
        ['development plan', developmentPlanRows.length, 1],
        ['development plan stage', developmentPlanStageRows.length, 1],
        ['development plan task', developmentPlanTaskRows.length, 1],
        ['gamification setting', gamificationSettingRows.length, LMS_DEMO_GAMIFICATION_SETTINGS.length],
        ['point award rule', pointAwardRuleRows.length, LMS_DEMO_POINT_AWARD_RULES.length],
        ['point transaction', pointTransactionRows.length, LMS_DEMO_POINT_TRANSACTIONS.length],
        ['badge definition', badgeDefinitionRows.length, LMS_DEMO_BADGES.length],
        ['badge issue', badgeIssueRows.length, LMS_DEMO_BADGE_ISSUES.length],
        ['leaderboard snapshot', leaderboardRows.length, LMS_DEMO_LEADERBOARD.length],
        ['report', reportRows.length, LMS_DEMO_REPORTS.length]
    ] as const

    for (const [label, actual, expected] of expectedCounts) {
        if (actual !== expected) {
            errors.push(`LMS fixture must seed exactly ${expected} ${label} row(s), received ${actual}`)
        }
    }

    if (resourceRows.some((row) => !row.data?.Body)) {
        errors.push('LMS fixture must seed authored LearningResources.Body content for direct app-side editing')
    }
    for (const resourceRow of resourceRows) {
        const label = readLocalizedText(resourceRow.data?.Title, 'en') ?? resourceRow.id
        assertEditorBlockTextLocalized(errors, resourceRow.data?.Body, `LMS learning resource ${label}`)
    }
    if (!knowledgeArticleRows[0]?.data?.Body) {
        errors.push('LMS fixture must seed at least one authored KnowledgeArticles.Body document')
    }
    if (knowledgeArticleRows.some((row) => typeof row.data?.SortOrder !== 'number')) {
        errors.push('LMS fixture KnowledgeArticles rows must include their required numeric SortOrder')
    }
    for (const articleRow of knowledgeArticleRows) {
        const label = readLocalizedText(articleRow.data?.Title, 'en') ?? articleRow.id
        assertEditorBlockTextLocalized(errors, articleRow.data?.Body, `LMS knowledge article ${label}`)
    }
    if (!knowledgeBookmarkRows[0]?.data?.ArticleId || knowledgeBookmarkRows[0]?.data?.FolderId) {
        errors.push('LMS fixture knowledge bookmarks must point at KnowledgeArticles instead of folders')
    }

    for (const seededCourse of LMS_DEMO_COURSES) {
        const courseRow = courseRows.find((row) => readLocalizedText(row?.data?.Title, 'en') === seededCourse.title.en)
        if (!courseRow) continue
        const parsedCatalogPolicy = catalogPublicationPolicySchema.safeParse({
            visible: courseRow.data?.CatalogVisible,
            category: courseRow.data?.CatalogCategory,
            audience: courseRow.data?.CatalogAudience,
            selfEnrollmentMode: courseRow.data?.SelfEnrollmentMode
        })
        if (!parsedCatalogPolicy.success) {
            errors.push(`LMS course ${seededCourse.key} must expose valid catalog-ready metadata`)
        } else if (
            parsedCatalogPolicy.data.visible !== true ||
            readLocalizedText(parsedCatalogPolicy.data.category, 'en') !== seededCourse.catalogCategory.en ||
            readLocalizedText(parsedCatalogPolicy.data.audience, 'en') !== seededCourse.catalogAudience.en ||
            parsedCatalogPolicy.data.selfEnrollmentMode !== seededCourse.selfEnrollmentMode
        ) {
            errors.push(`LMS course ${seededCourse.key} must keep deterministic catalog policy metadata`)
        }
    }

    for (const expectedTrack of [
        {
            title: 'New learner onboarding track',
            category: 'Onboarding',
            audience: 'New learners',
            selfEnrollmentMode: 'open'
        },
        {
            title: 'Compliance refresh track',
            category: 'Compliance',
            audience: 'All learners',
            selfEnrollmentMode: 'disabled'
        }
    ] as const) {
        const trackRow = learningTrackRows.find((row) => readLocalizedText(row?.data?.Title, 'en') === expectedTrack.title)
        if (!trackRow) continue
        const parsedCatalogPolicy = catalogPublicationPolicySchema.safeParse({
            visible: trackRow.data?.CatalogVisible,
            category: trackRow.data?.CatalogCategory,
            audience: trackRow.data?.CatalogAudience,
            selfEnrollmentMode: trackRow.data?.SelfEnrollmentMode
        })
        if (!parsedCatalogPolicy.success) {
            errors.push(`LMS learning track ${expectedTrack.title} must expose valid catalog-ready metadata`)
        } else if (
            parsedCatalogPolicy.data.visible !== true ||
            readLocalizedText(parsedCatalogPolicy.data.category, 'en') !== expectedTrack.category ||
            readLocalizedText(parsedCatalogPolicy.data.audience, 'en') !== expectedTrack.audience ||
            parsedCatalogPolicy.data.selfEnrollmentMode !== expectedTrack.selfEnrollmentMode
        ) {
            errors.push(`LMS learning track ${expectedTrack.title} must keep deterministic catalog policy metadata`)
        }
    }

    const enabledGamificationSetting = gamificationSettingRows.find((row) => row.data?.Scope === 'application')
    if (enabledGamificationSetting?.data?.Enabled !== true) {
        errors.push('LMS fixture must seed enabled application-level gamification settings')
    }
    const pointRuleCodes = new Set(pointAwardRuleRows.map((row) => row.data?.RuleCode).filter(Boolean))
    for (const requiredRuleCode of ['content.completed', 'assignment.accepted', 'manual.adjustment']) {
        if (!pointRuleCodes.has(requiredRuleCode)) {
            errors.push(`LMS fixture must seed point award rule ${requiredRuleCode}`)
        }
    }
    const approvedPoints = pointTransactionRows.reduce((sum, row) => {
        if (row.data?.Status !== 'Approved') return sum
        const value = typeof row.data?.PointsDelta === 'number' ? row.data.PointsDelta : Number(row.data?.PointsDelta)
        return Number.isFinite(value) ? sum + value : sum
    }, 0)
    const currentLeaderboardTotal = leaderboardRows.reduce((sum, row) => {
        if (row.data?.Period !== 'current') return sum
        const value = typeof row.data?.TotalPoints === 'number' ? row.data.TotalPoints : Number(row.data?.TotalPoints)
        return Number.isFinite(value) ? sum + value : sum
    }, 0)
    if (approvedPoints !== 40 || currentLeaderboardTotal !== 50) {
        errors.push('LMS fixture must keep deterministic approved points and current leaderboard totals for achievements')
    }
    const issuedBadgeCount = badgeIssueRows.filter((row) => row.data?.Status === 'Issued').length
    if (issuedBadgeCount < 1) {
        errors.push('LMS fixture must seed at least one issued learner badge')
    }
    const topLeaderboardRow = leaderboardRows.find((row) => row.data?.Rank === 1)
    if (!topLeaderboardRow || topLeaderboardRow.data?.TotalPoints !== 35 || topLeaderboardRow.data?.BadgeCount !== 1) {
        errors.push('LMS fixture must seed the deterministic top leaderboard achievement row')
    }

    const exportedResourceSourceTypes = new Set<string>()
    let hasDeferredScormPlaceholder = false
    let hasDeferredXapiPlaceholder = false
    for (const expectedResource of LMS_DEMO_RESOURCES) {
        const resourceRow = resourceRows.find(
            (row) => readLocalizedText(row?.data?.Title, 'en') === readLocalizedText(expectedResource.title, 'en')
        )
        if (!resourceRow) {
            errors.push(`LMS fixture is missing learning resource ${expectedResource.codename}`)
            continue
        }
        const resourceDefinition = resourceDefinitionSchema.safeParse({
            codename: expectedResource.codename,
            title: resourceRow.data?.Title,
            source: resourceRow.data?.Source,
            estimatedTimeMinutes: resourceRow.data?.EstimatedTimeMinutes,
            language: resourceRow.data?.Language
        })
        if (!resourceDefinition.success) {
            errors.push(`LMS learning resource ${expectedResource.codename} must match the generic resource contract`)
            continue
        }
        exportedResourceSourceTypes.add(resourceDefinition.data.source.type)
        if (resourceDefinition.data.source.type === 'scorm' && isDeferredResourceSource(resourceDefinition.data.source)) {
            hasDeferredScormPlaceholder = true
        }
        if (resourceDefinition.data.source.type === 'xapi' && isDeferredResourceSource(resourceDefinition.data.source)) {
            hasDeferredXapiPlaceholder = true
        }
        if (resourceDefinition.data.source.type !== expectedResource.source.type) {
            errors.push(
                `LMS learning resource ${expectedResource.codename} must keep source type ${expectedResource.source.type}, received ${resourceDefinition.data.source.type}`
            )
        }
    }
    for (const requiredResourceType of ['page', 'url', 'video', 'audio', 'document', 'embed', 'scorm', 'xapi']) {
        if (!exportedResourceSourceTypes.has(requiredResourceType)) {
            errors.push(`LMS fixture must seed a realistic ${requiredResourceType} learning resource source`)
        }
    }
    if (!hasDeferredScormPlaceholder) {
        errors.push('LMS fixture must keep SCORM as an explicit deferred placeholder, not a silently supported runtime player')
    }
    if (!hasDeferredXapiPlaceholder) {
        errors.push('LMS fixture must keep xAPI as an explicit deferred placeholder, not a silently supported runtime player')
    }

    const reportRowsByCodename = assertLmsReportSeedRows(errors, reportRows, LMS_DEMO_REPORTS, progressReportType?.id)

    for (const acceptanceArea of LMS_PRODUCT_ACCEPTANCE_MATRIX) {
        for (const reportCodename of acceptanceArea.requiredReports) {
            if (!reportRowsByCodename.has(reportCodename)) {
                errors.push(`LMS acceptance area ${acceptanceArea.area} is missing report ${reportCodename}`)
            }
        }
    }

    const classRowsByKey = new Map<string, SnapshotElement>()
    for (const seededClass of LMS_DEMO_CLASSES) {
        const classRow = findRowByField(classRows, 'Name', seededClass.name.en)
        if (!classRow) {
            errors.push(`LMS fixture is missing class ${seededClass.name.en}`)
            continue
        }
        classRowsByKey.set(seededClass.key, classRow)

        const classData = classRow.data ?? {}
        assertLocalizedFixtureValue(errors, classData.Name, seededClass.name, `LMS class ${seededClass.name.en} name`)
        assertLocalizedFixtureValue(errors, classData.Description, seededClass.description, `LMS class ${seededClass.name.en} description`)
        if (classData.SchoolYear !== seededClass.schoolYear) {
            errors.push(`LMS class ${seededClass.name.en} must use SchoolYear=${seededClass.schoolYear}`)
        }
        if (classData.StudentCountLimit !== seededClass.studentCountLimit) {
            errors.push(`LMS class ${seededClass.name.en} must use StudentCountLimit=${seededClass.studentCountLimit}`)
        }
    }

    const studentRowsByKey = new Map<string, SnapshotElement>()
    for (const seededStudent of LMS_DEMO_STUDENTS) {
        const studentRow = studentRows.find((row) => row?.data?.Email === seededStudent.email)
        if (!studentRow) {
            errors.push(`LMS fixture is missing student ${seededStudent.email}`)
            continue
        }
        studentRowsByKey.set(seededStudent.key, studentRow)

        const studentData = studentRow.data ?? {}
        if (readLocalizedText(studentData.DisplayName, 'en') !== seededStudent.displayName.en) {
            errors.push(`LMS student ${seededStudent.email} is missing the canonical English display name`)
        }
    }

    const quizRowsByKey = new Map<string, SnapshotElement>()
    for (const seededQuiz of LMS_DEMO_QUIZZES) {
        const quizRow = findRowByField(quizRows, 'Title', seededQuiz.title.en)
        if (!quizRow) {
            errors.push(`LMS fixture is missing quiz ${seededQuiz.title.en}`)
            continue
        }
        quizRowsByKey.set(seededQuiz.key, quizRow)

        const quizData = quizRow.data ?? {}
        if (readLocalizedText(quizData.Title, 'ru') !== seededQuiz.title.ru) {
            errors.push(`LMS quiz ${seededQuiz.title.en} is missing the canonical Russian title`)
        }
        if (readLocalizedText(quizData.Description, 'en') !== seededQuiz.description.en) {
            errors.push(`LMS quiz ${seededQuiz.title.en} is missing the canonical English description`)
        }
        if (readLocalizedText(quizData.Description, 'ru') !== seededQuiz.description.ru) {
            errors.push(`LMS quiz ${seededQuiz.title.en} is missing the canonical Russian description`)
        }
        if (quizData.PassingScorePercent !== seededQuiz.passingScorePercent) {
            errors.push(`LMS quiz ${seededQuiz.title.en} must keep PassingScorePercent=${seededQuiz.passingScorePercent}`)
        }
        if (quizData.MaxAttempts !== seededQuiz.maxAttempts) {
            errors.push(`LMS quiz ${seededQuiz.title.en} must keep MaxAttempts=${seededQuiz.maxAttempts}`)
        }

        const quizQuestions = Array.isArray(quizData.Questions) ? quizData.Questions : []
        if (quizQuestions.length !== seededQuiz.questions.en.length) {
            errors.push(`LMS quiz ${seededQuiz.title.en} must contain ${seededQuiz.questions.en.length} questions`)
        }
        if (seededQuiz.questions.ru.length !== seededQuiz.questions.en.length) {
            errors.push(`LMS quiz ${seededQuiz.title.en} must define equal English and Russian question counts`)
        }
        for (const [index, expectedEnQuestion] of seededQuiz.questions.en.entries()) {
            const expectedRuQuestion = seededQuiz.questions.ru[index]
            const actualQuestion = readRecord(quizQuestions[index])
            if (!actualQuestion || !expectedRuQuestion) {
                continue
            }

            assertLocalizedFixtureValue(
                errors,
                actualQuestion.Prompt,
                { en: expectedEnQuestion.prompt, ru: expectedRuQuestion.prompt },
                `LMS quiz ${seededQuiz.title.en} question ${index + 1} prompt`
            )
            assertLocalizedFixtureValue(
                errors,
                actualQuestion.QuestionDescription,
                { en: expectedEnQuestion.description, ru: expectedRuQuestion.description },
                `LMS quiz ${seededQuiz.title.en} question ${index + 1} description`
            )
            assertLocalizedFixtureValue(
                errors,
                actualQuestion.Explanation,
                { en: expectedEnQuestion.explanation, ru: expectedRuQuestion.explanation },
                `LMS quiz ${seededQuiz.title.en} question ${index + 1} explanation`
            )
            const actualOptions = Array.isArray(actualQuestion.Options) ? actualQuestion.Options : []
            if (actualOptions.length !== expectedEnQuestion.options.length) {
                errors.push(
                    `LMS quiz ${seededQuiz.title.en} question ${index + 1} must contain ${
                        expectedEnQuestion.options.length
                    } answer option(s)`
                )
            }
            if (expectedRuQuestion.options.length !== expectedEnQuestion.options.length) {
                errors.push(`LMS quiz ${seededQuiz.title.en} question ${index + 1} must define equal English and Russian option counts`)
            }
            for (const [optionIndex, expectedEnOption] of expectedEnQuestion.options.entries()) {
                const expectedRuOption = expectedRuQuestion.options[optionIndex]
                const actualOption = readRecord(actualOptions[optionIndex])
                if (!actualOption || !expectedRuOption) {
                    continue
                }
                assertLocalizedFixtureValue(
                    errors,
                    actualOption.label,
                    {
                        en: readLocalizedText(expectedEnOption.label, 'en') ?? '',
                        ru: readLocalizedText(expectedRuOption.label, 'ru') ?? ''
                    },
                    `LMS quiz ${seededQuiz.title.en} question ${index + 1} option ${optionIndex + 1} label`
                )
                if (actualOption.isCorrect !== expectedEnOption.isCorrect || actualOption.isCorrect !== expectedRuOption.isCorrect) {
                    errors.push(
                        `LMS quiz ${seededQuiz.title.en} question ${index + 1} option ${
                            optionIndex + 1
                        } must keep the same correctness flag in both locales`
                    )
                }
            }
        }
    }

    const guestContentRowsByKey = new Map<string, SnapshotElement>()
    for (const seededContent of LMS_DEMO_CONTENT_NODES) {
        const contentRow = findRowByField(resourceRows, 'Title', seededContent.title.en)
        if (!contentRow) {
            errors.push(`LMS fixture is missing guest content ${seededContent.title.en}`)
            continue
        }
        guestContentRowsByKey.set(seededContent.key, contentRow)

        const contentData = contentRow.data ?? {}
        if (readLocalizedText(contentData.Title, 'ru') !== seededContent.title.ru) {
            errors.push(`LMS guest content ${seededContent.title.en} is missing the canonical Russian title`)
        }
        if (readLocalizedText(contentData.Description, 'en') !== seededContent.description.en) {
            errors.push(`LMS guest content ${seededContent.title.en} is missing the canonical English description`)
        }
        if (readLocalizedText(contentData.Description, 'ru') !== seededContent.description.ru) {
            errors.push(`LMS guest content ${seededContent.title.en} is missing the canonical Russian description`)
        }
        if (contentData.EstimatedTimeMinutes !== seededContent.estimatedDurationMinutes) {
            errors.push(
                `LMS guest content ${seededContent.title.en} must keep EstimatedTimeMinutes=${seededContent.estimatedDurationMinutes}`
            )
        }

        const contentItems = Array.isArray(contentData.ContentItems) ? contentData.ContentItems : []
        if (contentItems.length !== seededContent.contentItems.en.length) {
            errors.push(`LMS guest content ${seededContent.title.en} must contain ${seededContent.contentItems.en.length} content item(s)`)
        }
        if (seededContent.contentItems.ru.length !== seededContent.contentItems.en.length) {
            errors.push(`LMS guest content ${seededContent.title.en} must define equal English and Russian content item counts`)
        }
        for (const [index, expectedEnItem] of seededContent.contentItems.en.entries()) {
            const expectedRuItem = seededContent.contentItems.ru[index]
            const actualItem = readRecord(contentItems[index])
            if (!actualItem || !expectedRuItem) {
                continue
            }

            assertLocalizedFixtureValue(
                errors,
                actualItem.ItemTitle,
                { en: expectedEnItem.itemTitle, ru: expectedRuItem.itemTitle },
                `LMS guest content ${seededContent.title.en} item ${index + 1} title`
            )
            const expectedEnContent = 'itemContent' in expectedEnItem ? expectedEnItem.itemContent : undefined
            const expectedRuContent = 'itemContent' in expectedRuItem ? expectedRuItem.itemContent : undefined
            if (expectedEnContent || expectedRuContent) {
                assertLocalizedFixtureValue(
                    errors,
                    actualItem.ItemContent,
                    { en: expectedEnContent ?? '', ru: expectedRuContent ?? '' },
                    `LMS guest content ${seededContent.title.en} item ${index + 1} content`
                )
            }
            if (actualItem.SortOrder !== expectedEnItem.sortOrder || actualItem.SortOrder !== expectedRuItem.sortOrder) {
                errors.push(`LMS guest content ${seededContent.title.en} item ${index + 1} must keep the same sort order in both locales`)
            }
        }

        const quizRefItem = contentItems.find((item) => item && typeof item === 'object' && (item as Record<string, unknown>).QuizId)
        const linkedQuizRow = quizRowsByKey.get(seededContent.linkedQuizKey)
        if (!quizRefItem || !linkedQuizRow?.id) {
            errors.push(`LMS guest content ${seededContent.title.en} must include a quiz_ref item linked to ${seededContent.linkedQuizKey}`)
        } else if ((quizRefItem as Record<string, unknown>).QuizId !== linkedQuizRow.id) {
            errors.push(`LMS guest content ${seededContent.title.en} quiz_ref item must point at the canonical seeded quiz row id`)
        }
    }

    for (const seededLink of LMS_DEMO_ACCESS_LINKS) {
        const accessLinkRow = accessLinkRows.find((row) => row?.data?.Slug === seededLink.slug)
        if (!accessLinkRow) {
            errors.push(`LMS fixture is missing access link ${seededLink.slug}`)
            continue
        }

        const accessLinkData = accessLinkRow.data ?? {}
        if (readLocalizedText(accessLinkData.LinkTitle, 'en') !== seededLink.title.en) {
            errors.push(`LMS access link ${seededLink.slug} is missing the canonical English title`)
        }
        if (readLocalizedText(accessLinkData.LinkTitle, 'ru') !== seededLink.title.ru) {
            errors.push(`LMS access link ${seededLink.slug} is missing the canonical Russian title`)
        }
        if (accessLinkData.TargetType !== 'content') {
            errors.push(`LMS access link ${seededLink.slug} must target the guest content journey`)
        }

        const linkedContentRow = guestContentRowsByKey.get(seededLink.contentKey)
        const linkedClassRow = classRowsByKey.get(seededLink.classKey)
        if (linkedContentRow?.id && accessLinkData.TargetId !== linkedContentRow.id) {
            errors.push(`LMS access link ${seededLink.slug} must keep the seeded guest content row id in TargetId`)
        }
        if (linkedContentRow?.id && accessLinkData.ContentNodeIdRef !== linkedContentRow.id) {
            errors.push(`LMS access link ${seededLink.slug} must reference the seeded guest content row through ContentNodeIdRef`)
        }
        if (linkedClassRow?.id && accessLinkData.LinkClassId !== linkedClassRow.id) {
            errors.push(`LMS access link ${seededLink.slug} must reference the seeded class row id`)
        }
    }

    for (const seededEnrollment of LMS_DEMO_ENROLLMENTS) {
        const expectedStudentRow = studentRowsByKey.get(seededEnrollment.studentKey)
        const expectedClassRow = classRowsByKey.get(seededEnrollment.classKey)
        const expectedContentRow = guestContentRowsByKey.get(seededEnrollment.contentKey)
        const enrollmentRow = enrollmentRows.find(
            (row) =>
                row?.data?.EnrollmentStudentId === expectedStudentRow?.id &&
                row?.data?.EnrollmentClassId === expectedClassRow?.id &&
                row?.data?.TargetType === 'content' &&
                row?.data?.TargetId === expectedContentRow?.id &&
                row?.data?.ContentNodeIdRef === expectedContentRow?.id
        )

        if (!enrollmentRow) {
            errors.push(`LMS fixture is missing enrollment ${seededEnrollment.key}`)
        } else {
            if (enrollmentRow.data?.AssignedUserId !== LMS_RUNTIME_CURRENT_USER_ID_TOKEN) {
                errors.push(`LMS enrollment ${seededEnrollment.key} must use the runtime current-user seed token`)
            }
            if (!readLocalizedText(enrollmentRow.data?.TargetTitle, 'en')) {
                errors.push(`LMS enrollment ${seededEnrollment.key} must expose a learner-facing TargetTitle`)
            }
            if (enrollmentRow.data?.DueDateMode !== 'ByDate' || typeof enrollmentRow.data?.DuePeriodDays !== 'number') {
                errors.push(`LMS enrollment ${seededEnrollment.key} must seed due-date mode and period metadata`)
            }
        }
    }

    const courseEnrollment = enrollmentRows.find((row) => row?.data?.TargetType === 'course')
    if (
        !courseEnrollment?.data?.TargetId ||
        !courseEnrollment.data.DueDate ||
        courseEnrollment.data.DueDateMode !== 'ByDate' ||
        courseEnrollment.data.DuePeriodDays !== 14 ||
        courseEnrollment.data.RestrictAfterDueDate !== true ||
        courseEnrollment.data.AssignedUserId !== LMS_RUNTIME_CURRENT_USER_ID_TOKEN ||
        readLocalizedText(courseEnrollment.data.TargetTitle, 'en') !== 'Compliance Refresh Course'
    ) {
        errors.push('LMS fixture must seed at least one due-date restricted course enrollment')
    }
    const trackEnrollment = enrollmentRows.find((row) => row?.data?.TargetType === 'track')
    if (
        !trackEnrollment?.data?.TargetId ||
        !trackEnrollment.data.DueDate ||
        trackEnrollment.data.DueDateMode !== 'ForPeriod' ||
        trackEnrollment.data.DuePeriodDays !== 20 ||
        trackEnrollment.data.RestrictAfterDueDate !== true ||
        trackEnrollment.data.AssignedUserId !== LMS_RUNTIME_CURRENT_USER_ID_TOKEN ||
        readLocalizedText(trackEnrollment.data.TargetTitle, 'en') !== 'Compliance refresh track'
    ) {
        errors.push('LMS fixture must seed at least one due-date restricted track enrollment')
    }

    for (const seededProgress of LMS_DEMO_CONTENT_PROGRESS) {
        const expectedStudentRow = studentRowsByKey.get(seededProgress.studentKey)
        const expectedContentRow = guestContentRowsByKey.get(seededProgress.contentKey)
        const contentProgressRow = contentProgressRows.find(
            (row) => row?.data?.ProgressStudentId === expectedStudentRow?.id && row?.data?.ContentNodeId === expectedContentRow?.id
        )

        if (!contentProgressRow) {
            errors.push(`LMS fixture is missing content progress ${seededProgress.key}`)
            continue
        }

        const contentProgressData = contentProgressRow.data ?? {}
        if (contentProgressData.ProgressStatus !== seededProgress.status) {
            errors.push(`LMS content progress ${seededProgress.key} must keep ProgressStatus=${seededProgress.status}`)
        }
        if (contentProgressData.ProgressPercent !== seededProgress.progressPercent) {
            errors.push(`LMS content progress ${seededProgress.key} must keep ProgressPercent=${seededProgress.progressPercent}`)
        }
    }

    for (const seededResponse of LMS_DEMO_QUIZ_RESPONSES) {
        const expectedStudentRow = studentRowsByKey.get(seededResponse.studentKey)
        const expectedQuizRow = quizRowsByKey.get(seededResponse.quizKey)
        const quizResponseRow = quizResponseRows.find(
            (row) =>
                row?.data?.StudentId === expectedStudentRow?.id &&
                row?.data?.QuizId === expectedQuizRow?.id &&
                row?.data?.QuestionId === seededResponse.questionId
        )

        if (!quizResponseRow) {
            errors.push(`LMS fixture is missing quiz response ${seededResponse.key}`)
            continue
        }

        const quizResponseData = quizResponseRow.data ?? {}
        const normalizedSelectedOptionIds = Array.isArray(quizResponseData.SelectedOptionIds) ? quizResponseData.SelectedOptionIds : []

        if (quizResponseData.QuestionId !== seededResponse.questionId) {
            errors.push(`LMS quiz response ${seededResponse.key} must keep QuestionId=${seededResponse.questionId}`)
        }
        if (JSON.stringify(normalizedSelectedOptionIds) !== JSON.stringify(seededResponse.selectedOptionIds)) {
            errors.push(`LMS quiz response ${seededResponse.key} must keep the canonical SelectedOptionIds payload`)
        }
        if (quizResponseData.IsCorrect !== seededResponse.isCorrect) {
            errors.push(`LMS quiz response ${seededResponse.key} must keep IsCorrect=${String(seededResponse.isCorrect)}`)
        }
        if (quizResponseData.AttemptNumber !== seededResponse.attemptNumber) {
            errors.push(`LMS quiz response ${seededResponse.key} must keep AttemptNumber=${seededResponse.attemptNumber}`)
        }
    }
}

export function assertLmsFixtureEnvelopeContract(envelope: SnapshotEnvelope) {
    const errors: string[] = []

    if (envelope.kind !== 'metahub_snapshot_bundle') {
        errors.push('LMS fixture must keep kind="metahub_snapshot_bundle"')
    }
    if (envelope.bundleVersion !== LMS_EXPECTED_BUNDLE_VERSION) {
        errors.push(`LMS fixture bundleVersion must remain ${LMS_EXPECTED_BUNDLE_VERSION}`)
    }

    if (!envelope?.snapshot || typeof envelope.snapshot !== 'object') {
        errors.push('LMS fixture is missing the snapshot payload')
    } else if (envelope.snapshotHash !== computeSnapshotHash(envelope.snapshot)) {
        errors.push('LMS fixture snapshotHash drifted from the canonical snapshot payload')
    }
    if (envelope.snapshot?.version !== LMS_EXPECTED_SNAPSHOT_VERSION) {
        errors.push(`LMS fixture snapshot version must remain ${LMS_EXPECTED_SNAPSHOT_VERSION}`)
    }
    if (envelope.snapshot?.versionEnvelope?.structureVersion !== LMS_EXPECTED_STRUCTURE_VERSION) {
        errors.push(`LMS fixture structureVersion must remain ${LMS_EXPECTED_STRUCTURE_VERSION}`)
    }
    if (envelope.snapshot?.versionEnvelope?.snapshotFormatVersion !== LMS_EXPECTED_SNAPSHOT_FORMAT_VERSION) {
        errors.push(`LMS fixture snapshotFormatVersion must remain ${LMS_EXPECTED_SNAPSHOT_FORMAT_VERSION}`)
    }
    if (envelope.snapshot?.versionEnvelope?.templateVersion != null) {
        errors.push('LMS fixture must not pin or bump templateVersion in exported snapshots')
    }

    if (envelope.snapshot?.runtimePolicy?.workspaceMode !== 'required') {
        errors.push('LMS fixture publication runtime policy must require application workspaces')
    }

    const metahubNameEn = readLocalizedText(envelope.metahub?.name, 'en')
    const metahubNameRu = readLocalizedText(envelope.metahub?.name, 'ru')
    const metahubDescriptionEn = readLocalizedText(envelope.metahub?.description, 'en')
    const metahubDescriptionRu = readLocalizedText(envelope.metahub?.description, 'ru')
    const metahubCodenameEn = readLocalizedText(envelope.metahub?.codename, 'en')
    const metahubCodenameRu = readLocalizedText(envelope.metahub?.codename, 'ru')

    if (metahubNameEn !== LMS_CANONICAL_METAHUB.name.en) {
        errors.push(`Unexpected LMS fixture metahub name: ${metahubNameEn ?? '<missing>'}`)
    }
    if (metahubNameRu !== LMS_CANONICAL_METAHUB.name.ru) {
        errors.push(`Unexpected LMS fixture Russian metahub name: ${metahubNameRu ?? '<missing>'}`)
    }
    if (metahubDescriptionEn !== LMS_CANONICAL_METAHUB.description.en) {
        errors.push('LMS fixture is missing the canonical English metahub description')
    }
    if (metahubDescriptionRu !== LMS_CANONICAL_METAHUB.description.ru) {
        errors.push('LMS fixture is missing the canonical Russian metahub description')
    }
    if (metahubCodenameEn !== LMS_CANONICAL_METAHUB.codename.en) {
        errors.push(`Unexpected LMS fixture codename: ${metahubCodenameEn ?? '<missing>'}`)
    }
    if (metahubCodenameRu !== LMS_CANONICAL_METAHUB.codename.ru) {
        errors.push(`Unexpected LMS fixture Russian codename: ${metahubCodenameRu ?? '<missing>'}`)
    }

    if (
        [metahubNameEn, metahubNameRu, metahubCodenameEn, metahubCodenameRu].some(
            (value) => typeof value === 'string' && /e2e|runid|imported-/i.test(value)
        )
    ) {
        errors.push('LMS fixture identity still contains run-specific markers')
    }

    const entities = Object.values(envelope.snapshot?.entities ?? {})
    const entityTypeDefinitions =
        envelope.snapshot?.entityTypeDefinitions && typeof envelope.snapshot.entityTypeDefinitions === 'object'
            ? envelope.snapshot.entityTypeDefinitions
            : {}
    const objectEntityType = entityTypeDefinitions.object
    const objectEntityTypeUi =
        objectEntityType?.ui && typeof objectEntityType.ui === 'object' && !Array.isArray(objectEntityType.ui)
            ? (objectEntityType.ui as Record<string, unknown>)
            : null
    const objectEntityTypeTabs = Array.isArray(objectEntityTypeUi?.tabs) ? objectEntityTypeUi.tabs : []
    const objectEntityTypeComponents =
        objectEntityType?.capabilities && typeof objectEntityType.capabilities === 'object' && !Array.isArray(objectEntityType.capabilities)
            ? (objectEntityType.capabilities as Record<string, unknown>)
            : objectEntityType?.components && typeof objectEntityType.components === 'object' && !Array.isArray(objectEntityType.components)
            ? (objectEntityType.components as Record<string, unknown>)
            : null

    if (!objectEntityTypeTabs.includes('behavior')) {
        errors.push('LMS fixture Object entity type must expose the generic behavior tab')
    }
    if (!objectEntityTypeTabs.includes('ledgerSchema')) {
        errors.push('LMS fixture Object entity type must expose the generic ledger schema tab')
    }
    for (const componentKey of ['identityFields', 'recordLifecycle', 'posting', 'ledgerSchema']) {
        const component = objectEntityTypeComponents?.[componentKey]
        if (
            !component ||
            typeof component !== 'object' ||
            Array.isArray(component) ||
            (component as Record<string, unknown>).enabled !== true
        ) {
            errors.push(`LMS fixture Object entity type must enable ${componentKey} for runtime behavior authoring`)
        }
    }

    const entityByCodename = new Map<string, SnapshotEntity>()
    for (const entity of entities) {
        const codename = readLocalizedText(entity?.codename, 'en')
        if (codename) {
            if (
                entities.some(
                    (candidate) =>
                        candidate !== entity && candidate.kind === entity.kind && readLocalizedText(candidate?.codename, 'en') === codename
                )
            ) {
                errors.push(`LMS fixture contains duplicate ${entity.kind} entity codename ${codename}`)
            }
            entityByCodename.set(codename, entity)
        }

        const fieldCodenames = new Set<string>()
        for (const field of entity?.fields ?? []) {
            const fieldCodename = readLocalizedText(field?.codename, 'en')
            if (!fieldCodename) continue
            if (fieldCodenames.has(fieldCodename)) {
                errors.push(`LMS ${codename ?? 'unknown entity'} contains duplicate field codename ${fieldCodename}`)
            }
            fieldCodenames.add(fieldCodename)
        }
    }

    for (const [entityCodename, fieldCodename] of [
        ['LearningResources', 'Body'],
        ['KnowledgeArticles', 'Body']
    ] as const) {
        const field = entityByCodename
            .get(entityCodename)
            ?.fields?.find((candidate) => readLocalizedText(candidate.codename, 'en') === fieldCodename)
        const uiConfig =
            field?.uiConfig && typeof field.uiConfig === 'object' && !Array.isArray(field.uiConfig)
                ? (field.uiConfig as Record<string, unknown>)
                : null
        if (!field || field.dataType !== 'JSON' || uiConfig?.widget !== 'editorjsBlockContent') {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must expose the shared Editor.js block-content runtime field`)
        }
    }

    for (const entityCodename of ['LearningResources', 'Courses', 'LearningTracks'] as const) {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const runtimeLibrary = readRecord(config?.runtimeLibrary)
        const projection = readRecord(runtimeLibrary?.projection)
        const expectedDisplayType = entityCodename === 'LearningResources' ? 'resource' : entityCodename === 'Courses' ? 'course' : 'track'
        const expectedStatusField = entityCodename === 'LearningResources' ? 'PublicationStatus' : 'Status'
        const projectedFieldCodenames = Array.isArray(projection?.projectedFieldCodenames) ? projection.projectedFieldCodenames : []
        if (
            projection?.displayType !== expectedDisplayType ||
            projection.titleFieldCodename !== 'Title' ||
            projection.statusFieldCodename !== expectedStatusField ||
            projection.projectFieldCodename !== 'ProjectId' ||
            !projectedFieldCodenames.includes('Instructor')
        ) {
            errors.push(`LMS ${entityCodename} must own the trusted Learning Content runtime projection metadata`)
        }
        const recent = readRecord(runtimeLibrary?.recent)
        if (
            recent?.objectCodename !== 'RecentContentViews' ||
            recent.targetObjectFieldCodename !== 'TargetObjectCodename' ||
            recent.targetRecordFieldCodename !== 'TargetRecordId' ||
            recent.actorFieldCodename !== 'UserId' ||
            recent.timestampFieldCodename !== 'ViewedAt'
        ) {
            errors.push(`LMS ${entityCodename} must configure recent content through generic runtimeLibrary metadata`)
        }
        const starred = readRecord(runtimeLibrary?.starred)
        if (
            starred?.objectCodename !== 'ContentStars' ||
            starred.targetObjectFieldCodename !== 'TargetObjectCodename' ||
            starred.targetRecordFieldCodename !== 'TargetRecordId' ||
            starred.actorFieldCodename !== 'UserId' ||
            starred.timestampFieldCodename !== 'StarredAt'
        ) {
            errors.push(`LMS ${entityCodename} must configure starred content through generic runtimeLibrary metadata`)
        }
        const shared = readRecord(runtimeLibrary?.shared)
        if (
            shared?.objectCodename !== 'ContentAccessEntries' ||
            shared.targetObjectFieldCodename !== 'TargetObjectCodename' ||
            shared.targetRecordFieldCodename !== 'TargetRecordId' ||
            shared.principalTypeFieldCodename !== 'PrincipalType' ||
            shared.principalIdFieldCodename !== 'PrincipalId' ||
            shared.accessLevelFieldCodename !== 'AccessLevel' ||
            shared.defaultAccessLevel !== 'canView' ||
            shared.timestampFieldCodename !== 'InvitedAt'
        ) {
            errors.push(`LMS ${entityCodename} must configure shared content through generic runtimeLibrary metadata`)
        }
    }

    const findEntityByKindAndName = (kind: string, name: string) =>
        entities.find((entity) => entity?.kind === kind && readLocalizedText(entity?.presentation?.name, 'en') === name)

    for (const codename of REQUIRED_ENTITY_CODENAMES) {
        if (!entityByCodename.has(codename)) {
            errors.push(`LMS fixture is missing entity ${codename}`)
        }
    }

    const findFieldByCodename = (entityCodename: string, fieldCodename: string) =>
        entityByCodename.get(entityCodename)?.fields?.find((field) => readLocalizedText(field?.codename, 'en') === fieldCodename)

    const readFieldUiConfig = (entityCodename: string, fieldCodename: string) => {
        const field = findFieldByCodename(entityCodename, fieldCodename)
        return field?.uiConfig && typeof field.uiConfig === 'object' && !Array.isArray(field.uiConfig)
            ? (field.uiConfig as Record<string, unknown>)
            : null
    }

    const assertTextareaField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.widget !== 'textarea' || Number(uiConfig.rows ?? 0) < 2) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must be a textarea with at least 2 rows`)
        }
    }

    const assertResourceSourceField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.widget !== 'resourceSource' || uiConfig.gridHidden !== true) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must use resourceSource and stay hidden from default grids`)
        }
    }

    const assertGridHiddenField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.gridHidden !== true) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must stay hidden from normal runtime grids`)
        }
    }

    const assertHiddenRuntimeField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.hidden !== true && (uiConfig?.formHidden !== true || uiConfig?.gridHidden !== true)) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must stay hidden from normal runtime forms and grids`)
        }
    }

    const assertServerOwnedRuntimeField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.serverOwned !== true) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must be marked server-owned in Entity metadata`)
        }
    }

    const assertNoEditableRuntimeIdentityIdFields = (entityCodename: string) => {
        const entity = entityByCodename.get(entityCodename)
        for (const field of entity?.fields ?? []) {
            const fieldCodename = readLocalizedText(field?.codename, 'en') ?? ''
            if (!/(?:Owner|User|AssignedUser|CreatedByUser|Reviewer|Principal)Id$/i.test(fieldCodename)) {
                continue
            }

            const uiConfig = readFieldUiConfig(entityCodename, fieldCodename) ?? {}
            const isHidden = uiConfig.hidden === true || (uiConfig.formHidden === true && uiConfig.gridHidden === true)
            const isReferenceField = field.dataType === 'REF'
            const widget = typeof uiConfig.widget === 'string' ? uiConfig.widget : ''
            const hasSemanticPicker =
                ['runtimeRecordPicker', 'recordPicker', 'userPicker', 'workspaceMemberPicker'].includes(widget) ||
                readRecord(uiConfig.runtimeRecordPicker) !== null

            if (!isHidden && !isReferenceField && !hasSemanticPicker) {
                errors.push(
                    `LMS ${entityCodename}.${fieldCodename} must not expose an editable raw identity ID field; hide it or use a semantic picker/reference control`
                )
            }
        }
    }

    assertTextareaField('ContentProjects', 'Description')
    assertResourceSourceField('ContentProjects', 'Cover')
    assertTextareaField('Courses', 'Description')
    assertResourceSourceField('Courses', 'Cover')
    assertResourceSourceField('LearningResources', 'Source')
    assertHiddenRuntimeField('LearningResources', 'CreatedBy')
    assertHiddenRuntimeField('CourseItems', 'SortOrder')
    assertHiddenRuntimeField('KnowledgeArticles', 'SortOrder')
    {
        const knowledgeArticleSortOrderField = entityByCodename
            .get('KnowledgeArticles')
            ?.fields?.find((field) => readLocalizedText(field?.codename, 'en') === 'SortOrder')
        const knowledgeArticleSortOrderUiConfig = readFieldUiConfig('KnowledgeArticles', 'SortOrder') ?? {}
        if (
            knowledgeArticleSortOrderField?.dataType !== 'NUMBER' ||
            knowledgeArticleSortOrderField.isRequired !== true ||
            knowledgeArticleSortOrderUiConfig.defaultValue !== 0 ||
            knowledgeArticleSortOrderUiConfig.formHidden !== true ||
            knowledgeArticleSortOrderUiConfig.gridHidden !== true
        ) {
            errors.push(
                'LMS KnowledgeArticles.SortOrder must be a required numeric Entity field defaulted to 0 and hidden from runtime forms and grids'
            )
        }
    }
    assertServerOwnedRuntimeField('CourseItems', 'SortOrder')
    assertHiddenRuntimeField('CourseItems', 'AvailabilityOverride')
    assertGridHiddenField('Reports', 'Filters')
    assertGridHiddenField('Reports', 'Definition')
    assertGridHiddenField('Reports', 'SavedFilters')
    {
        const sourceUiConfig = readFieldUiConfig('LearningResources', 'Source') ?? {}
        const autoPageCodename = readRecord(sourceUiConfig.autoPageCodename)
        const sourceFields = Array.isArray(autoPageCodename?.sourceFields) ? autoPageCodename.sourceFields : []
        if (!sourceFields.includes('Name') || !sourceFields.includes('Title')) {
            errors.push('LMS LearningResources.Source must auto-resolve page resource codenames from Name/Title metadata fields')
        }
    }
    assertResourceSourceField('LearningResources', 'Thumbnail')
    for (const entityCodename of REQUIRED_ENTITY_CODENAMES) {
        assertNoEditableRuntimeIdentityIdFields(entityCodename)
    }

    const acceptanceAreas = new Set(LMS_PRODUCT_ACCEPTANCE_MATRIX.map((area) => area.area))
    for (const expectedArea of LMS_ACCEPTANCE_AREAS) {
        if (!acceptanceAreas.has(expectedArea)) {
            errors.push(`LMS acceptance matrix is missing declared area ${expectedArea}`)
        }
    }
    for (const acceptanceArea of LMS_PRODUCT_ACCEPTANCE_MATRIX) {
        const gatesComplete = Object.values(acceptanceArea.gates).every((value) => value === true)
        if (!gatesComplete && acceptanceArea.gaps.length === 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} has incomplete phase gates without explicit gaps`)
        }
        if (acceptanceArea.gaps.some((gap) => !gap.startsWith('Deferred beyond current Learning Content release scope:'))) {
            errors.push(
                `LMS acceptance area ${acceptanceArea.area} has a gap that is not explicitly scoped out of the current Learning Content release`
            )
        }
        if (!acceptanceArea.gates['covered-by-e2e'] && acceptanceArea.gaps.length === 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} is not browser-covered and must declare an explicit deferred gap`)
        }
        if (acceptanceArea.gates['covered-by-e2e'] && acceptanceArea.browserEvidence.length === 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} is marked browser-covered without typed browserEvidence`)
        }
        if (!acceptanceArea.gates['covered-by-e2e'] && acceptanceArea.browserEvidence.length > 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} declares browserEvidence while covered-by-e2e is false`)
        }
        if (
            !acceptanceArea.gates['covered-by-e2e'] &&
            acceptanceArea.apiEvidence.length === 0 &&
            acceptanceArea.fixtureEvidence.length === 0
        ) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} is deferred from browser coverage without API or fixture evidence`)
        }
        if (acceptanceArea.gates.seeded && acceptanceArea.requiredEntities.length === 0) {
            errors.push(`LMS acceptance area ${acceptanceArea.area} is marked seeded without required entities`)
        }
    }
    for (const acceptanceArea of LMS_PRODUCT_ACCEPTANCE_MATRIX) {
        for (const entityCodename of acceptanceArea.requiredEntities) {
            if (!entityByCodename.has(entityCodename)) {
                errors.push(`LMS acceptance area ${acceptanceArea.area} is missing required entity ${entityCodename}`)
            }
        }
    }

    for (const requiredEntity of REQUIRED_BASIC_BASELINE_ENTITIES) {
        if (!findEntityByKindAndName(requiredEntity.kind, requiredEntity.name)) {
            errors.push(`LMS fixture is missing Basic baseline ${requiredEntity.kind} entity "${requiredEntity.name}"`)
        }
    }

    const modules = Array.isArray(envelope.snapshot?.modules) ? envelope.snapshot.modules : []
    assertLmsDashboardFixtureContract({
        envelope,
        entityByCodename,
        modules,
        errors,
        readRecord,
        readWidgetConfig,
        readLocalizedText,
        assertLocalizedFixtureValue
    })

    const assertRuntimeProgressSequencePolicy = (
        entityCodename: 'CourseItems' | 'TrackSteps',
        expectedScopeFieldCodename: 'CourseId' | 'TrackId'
    ) => {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const runtimeProgress = readRecord(config?.runtimeProgress)
        const sequencePolicy = readRecord(runtimeProgress?.sequencePolicy)
        if (
            sequencePolicy?.mode !== 'sequential' ||
            sequencePolicy.scopeFieldCodename !== expectedScopeFieldCodename ||
            sequencePolicy.orderFieldCodename !== 'SortOrder'
        ) {
            errors.push(
                `LMS ${entityCodename} must declare a runtimeProgress sequencePolicy so direct progress writes cannot bypass ordering`
            )
        }
    }

    assertRuntimeProgressSequencePolicy('CourseItems', 'CourseId')
    assertRuntimeProgressSequencePolicy('TrackSteps', 'TrackId')

    const assertRuntimeProgressAggregation = (
        entityCodename: 'CourseItems' | 'TrackSteps',
        expectedParentObjectCodename: 'Courses' | 'LearningTracks',
        expectedParentFieldCodename: 'CourseId' | 'TrackId'
    ) => {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const runtimeProgress = readRecord(config?.runtimeProgress)
        const aggregateParents = Array.isArray(runtimeProgress?.aggregateParents) ? runtimeProgress.aggregateParents.map(readRecord) : []
        const aggregateParent = aggregateParents.find(
            (candidate) =>
                candidate?.parentObjectCodename === expectedParentObjectCodename &&
                candidate.parentIdFieldCodename === expectedParentFieldCodename &&
                candidate.requiredOnly === true
        )

        if (!aggregateParent) {
            errors.push(
                `LMS ${entityCodename} must aggregate learner progress into ${expectedParentObjectCodename} through runtimeProgress.aggregateParents`
            )
        }
    }

    assertRuntimeProgressAggregation('CourseItems', 'Courses', 'CourseId')
    assertRuntimeProgressAggregation('TrackSteps', 'LearningTracks', 'TrackId')

    const assertRuntimeParentRecordAccess = (
        entityCodename: 'CourseSections' | 'CourseItems' | 'TrackStages' | 'TrackSteps',
        expectedParentObjectCodename: 'Courses' | 'LearningTracks',
        expectedParentFieldCodename: 'CourseId' | 'TrackId'
    ) => {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const parentAccess = readRecord(config?.runtimeRecordParentAccess)

        if (
            parentAccess?.mode !== 'parentRecord' ||
            parentAccess.parentObjectCodename !== expectedParentObjectCodename ||
            parentAccess.parentFieldCodename !== expectedParentFieldCodename
        ) {
            errors.push(
                `LMS ${entityCodename} must inherit runtime record access from ${expectedParentObjectCodename} through ${expectedParentFieldCodename}`
            )
        }
    }

    assertRuntimeParentRecordAccess('CourseSections', 'Courses', 'CourseId')
    assertRuntimeParentRecordAccess('CourseItems', 'Courses', 'CourseId')
    assertRuntimeParentRecordAccess('TrackStages', 'LearningTracks', 'TrackId')
    assertRuntimeParentRecordAccess('TrackSteps', 'LearningTracks', 'TrackId')

    const assertRuntimeCopyRelations = (
        entityCodename: 'Courses' | 'LearningTracks',
        expectedRelations: Array<{
            objectCodename: string
            parentFieldCodename: string
            refRemap?: { fieldCodename: string; sourceObjectCodename: string }
        }>
    ) => {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const runtimeCopy = readRecord(config?.runtimeCopy)
        const relations = Array.isArray(runtimeCopy?.relations) ? runtimeCopy.relations.map(readRecord) : []

        for (const expectedRelation of expectedRelations) {
            const expectedRefRemap = expectedRelation.refRemap
            const relation = relations.find(
                (candidate) =>
                    candidate?.objectCodename === expectedRelation.objectCodename &&
                    candidate.parentFieldCodename === expectedRelation.parentFieldCodename &&
                    candidate.orderFieldCodename === 'SortOrder'
            )
            const refRemaps = Array.isArray(relation?.refRemaps) ? relation.refRemaps.map(readRecord) : []
            const hasExpectedRefRemap =
                !expectedRefRemap ||
                refRemaps.some(
                    (candidate) =>
                        candidate?.fieldCodename === expectedRefRemap.fieldCodename &&
                        candidate.sourceObjectCodename === expectedRefRemap.sourceObjectCodename
                )

            if (!relation || !hasExpectedRefRemap) {
                errors.push(
                    `LMS ${entityCodename} must declare runtimeCopy relation ${expectedRelation.objectCodename} with safe outline remapping`
                )
            }
        }
    }

    assertRuntimeCopyRelations('Courses', [
        { objectCodename: 'CourseSections', parentFieldCodename: 'CourseId' },
        {
            objectCodename: 'CourseItems',
            parentFieldCodename: 'CourseId',
            refRemap: { fieldCodename: 'SectionId', sourceObjectCodename: 'CourseSections' }
        }
    ])
    assertRuntimeCopyRelations('LearningTracks', [
        { objectCodename: 'TrackStages', parentFieldCodename: 'TrackId' },
        {
            objectCodename: 'TrackSteps',
            parentFieldCodename: 'TrackId',
            refRemap: { fieldCodename: 'StageId', sourceObjectCodename: 'TrackStages' }
        }
    ])

    const learnerHomeEntity = entityByCodename.get('LearnerHome')
    if (learnerHomeEntity?.kind !== 'page') {
        errors.push('LMS fixture must include LearnerHome as a Page entity')
    } else {
        const learnerHomeCodenameRu = readLocalizedText(learnerHomeEntity.codename, 'ru')
        if (!learnerHomeCodenameRu) {
            errors.push('LMS LearnerHome page must export a Russian codename value')
        }
        const learnerHomeNameEn = readLocalizedText(learnerHomeEntity.presentation?.name, 'en')
        const learnerHomeNameRu = readLocalizedText(learnerHomeEntity.presentation?.name, 'ru')
        if (learnerHomeNameEn !== 'Welcome' || learnerHomeNameRu !== 'Добро пожаловать') {
            errors.push('LMS LearnerHome page must be presented as the visible Welcome page')
        }
        const pageConfig = learnerHomeEntity as SnapshotEntity & { config?: Record<string, unknown> }
        const blockContent = pageConfig.config?.blockContent as Record<string, unknown> | undefined
        const blocks = Array.isArray(blockContent?.blocks) ? blockContent.blocks : []
        if (blockContent?.format !== 'editorjs') {
            errors.push('LMS LearnerHome page must use Editor.js-compatible block content')
        }
        if (blocks.length < 2) {
            errors.push('LMS LearnerHome page must include starter header and paragraph blocks')
        }
        if (blocks.length < 5) {
            errors.push('LMS LearnerHome page must include a complete starter page, not only a short placeholder')
        }
        const blockContentText = JSON.stringify(blockContent)
        if (!blockContentText.includes(LMS_WELCOME_PAGE.intro.en)) {
            errors.push('LMS LearnerHome page must include the full English onboarding text')
        }
        if (!blockContentText.includes(LMS_WELCOME_PAGE.intro.ru)) {
            errors.push('LMS LearnerHome page must include the full Russian onboarding text')
        }
    }
    for (const pageCodename of [
        'CourseOverview',
        'KnowledgeHome',
        'KnowledgeArticle',
        'DevelopmentHome',
        'AssignmentInstructions',
        'CertificatePolicy'
    ]) {
        const pageEntity = entityByCodename.get(pageCodename)
        if (pageEntity?.kind !== 'page') {
            errors.push(`LMS fixture must include ${pageCodename} as a Page entity`)
            continue
        }
        const pageCodenameRu = readLocalizedText(pageEntity.codename, 'ru')
        if (!pageCodenameRu) {
            errors.push(`LMS ${pageCodename} page must export a Russian codename value`)
        }
        const pageConfig = pageEntity as SnapshotEntity & { config?: Record<string, unknown> }
        const blockContent = pageConfig.config?.blockContent as Record<string, unknown> | undefined
        const blocks = Array.isArray(blockContent?.blocks) ? blockContent.blocks : []
        const blockContentText = JSON.stringify(blockContent)
        if (blockContent?.format !== 'editorjs' || blocks.length < 2) {
            errors.push(`LMS ${pageCodename} page must use Editor.js-compatible bilingual content blocks`)
        }
        if (!blockContentText.includes('"_primary":"en"') || !blockContentText.includes('"ru"')) {
            errors.push(`LMS ${pageCodename} page must include English and Russian localized content`)
        }
    }

    const shortPresetPage = entities.find(
        (entity) =>
            entity?.kind === 'page' &&
            JSON.stringify(entity?.config ?? {}).includes('Use this page to publish structured application content.')
    )
    if (shortPresetPage) {
        errors.push('LMS fixture must not expose the short Basic preset Welcome page as product content')
    }

    const lmsConfigurationEntity =
        entityByCodename.get('LmsConfiguration') ??
        entityByCodename.get('LMSConfiguration') ??
        findEntityByKindAndName('set', 'LMS Configuration')
    if (lmsConfigurationEntity?.kind !== 'set') {
        errors.push('LMS fixture must include LmsConfiguration as a Set entity')
    }
    for (const ledgerCodename of [
        'LearningActivityLedger',
        'ProgressLedger',
        'ScoreLedger',
        'EnrollmentLedger',
        'AttendanceLedger',
        'CertificateLedger',
        'PointsLedger',
        'NotificationLedger'
    ]) {
        const ledgerEntity = entityByCodename.get(ledgerCodename)
        if (ledgerEntity?.kind !== 'object') {
            errors.push(`LMS fixture must include ${ledgerCodename} as a register-enabled Object entity`)
        } else if (ledgerEntity.config?.ledger === undefined) {
            errors.push(`LMS ${ledgerCodename} must carry the canonical ledger configuration`)
        }
    }
    for (const transactionalObjectCodename of [
        'QuizResponses',
        'QuizAttempts',
        'ContentProgress',
        'Assignments',
        'AssignmentSubmissions',
        'TrainingEvents',
        'TrainingAttendance',
        'Certificates',
        'CertificateIssues',
        'DevelopmentPlanTasks',
        'NotificationOutbox',
        'PointTransactions',
        'BadgeIssues',
        'Enrollments'
    ]) {
        const objectEntity = entityByCodename.get(transactionalObjectCodename)
        const recordBehavior =
            objectEntity?.config?.recordBehavior &&
            typeof objectEntity.config.recordBehavior === 'object' &&
            !Array.isArray(objectEntity.config.recordBehavior)
                ? (objectEntity.config.recordBehavior as Record<string, unknown>)
                : null
        if (recordBehavior?.mode !== 'transactional') {
            errors.push(`LMS ${transactionalObjectCodename} object must use transactional record behavior`)
        }
    }
    for (const expectedWorkflowAction of REQUIRED_WORKFLOW_ACTIONS) {
        const objectEntity = entityByCodename.get(expectedWorkflowAction.entityCodename)
        const actions = Array.isArray(objectEntity?.config?.workflowActions) ? objectEntity.config.workflowActions : []
        const action = actions.find(
            (candidate) =>
                candidate &&
                typeof candidate === 'object' &&
                (candidate as Record<string, unknown>).codename === expectedWorkflowAction.actionCodename
        )
        if (!action) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename} must configure workflow action ${expectedWorkflowAction.actionCodename}`
            )
            continue
        }
        const parsedAction = workflowActionSchema.safeParse(action)
        if (!parsedAction.success) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must match the generic workflow action contract`
            )
            continue
        }
        const expectedStatusFieldCodename = expectedWorkflowAction.statusFieldCodename ?? 'Status'
        if (parsedAction.data.statusFieldCodename !== expectedStatusFieldCodename) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must use the ${expectedStatusFieldCodename} field as workflow state`
            )
        }
        if (JSON.stringify(parsedAction.data.from) !== JSON.stringify(expectedWorkflowAction.from)) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${
                    expectedWorkflowAction.actionCodename
                } must keep from=${expectedWorkflowAction.from.join(',')}`
            )
        }
        if (parsedAction.data.to !== expectedWorkflowAction.to) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must transition to ${expectedWorkflowAction.to}`
            )
        }
        for (const requiredCapability of expectedWorkflowAction.requiredCapabilities) {
            if (!parsedAction.data.requiredCapabilities.includes(requiredCapability)) {
                errors.push(
                    `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must require ${requiredCapability}`
                )
            }
        }
        if (expectedWorkflowAction.postingCommand && parsedAction.data.postingCommand !== expectedWorkflowAction.postingCommand) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must declare postingCommand=${expectedWorkflowAction.postingCommand}`
            )
        }
        if (expectedWorkflowAction.moduleCodename && parsedAction.data.moduleCodename !== expectedWorkflowAction.moduleCodename) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must bind module ${expectedWorkflowAction.moduleCodename}`
            )
        }
    }
    const enrollmentEntity = entityByCodename.get('Enrollments')
    const enrollmentRecordBehavior =
        enrollmentEntity?.config?.recordBehavior &&
        typeof enrollmentEntity.config.recordBehavior === 'object' &&
        !Array.isArray(enrollmentEntity.config.recordBehavior)
            ? (enrollmentEntity.config.recordBehavior as Record<string, unknown>)
            : null
    const enrollmentPosting =
        enrollmentRecordBehavior?.posting &&
        typeof enrollmentRecordBehavior.posting === 'object' &&
        !Array.isArray(enrollmentRecordBehavior.posting)
            ? (enrollmentRecordBehavior.posting as Record<string, unknown>)
            : null
    const targetLedgers = Array.isArray(enrollmentPosting?.targetLedgers) ? enrollmentPosting.targetLedgers : []
    if (enrollmentRecordBehavior?.mode !== 'transactional') {
        errors.push('LMS Enrollments object must use transactional record behavior')
    }
    if (enrollmentPosting?.mode !== 'manual' || !targetLedgers.includes('ProgressLedger')) {
        errors.push('LMS Enrollments posting behavior must manually target ProgressLedger')
    }
    const enrollmentRuntimeValidations =
        enrollmentEntity?.config?.runtimeValidations &&
        typeof enrollmentEntity.config.runtimeValidations === 'object' &&
        !Array.isArray(enrollmentEntity.config.runtimeValidations)
            ? (enrollmentEntity.config.runtimeValidations as Record<string, unknown>)
            : null
    const enrollmentRequiredWhen = Array.isArray(enrollmentRuntimeValidations?.requiredWhen)
        ? enrollmentRuntimeValidations.requiredWhen
        : []
    const hasDueDateRequiredWhen = enrollmentRequiredWhen.some(
        (rule) =>
            rule &&
            typeof rule === 'object' &&
            !Array.isArray(rule) &&
            (rule as Record<string, unknown>).field === 'DueDate' &&
            (rule as Record<string, unknown>).when &&
            typeof (rule as Record<string, unknown>).when === 'object' &&
            !Array.isArray((rule as Record<string, unknown>).when) &&
            ((rule as Record<string, unknown>).when as Record<string, unknown>).field === 'DueDateMode' &&
            ((rule as Record<string, unknown>).when as Record<string, unknown>).equals === 'ByDate'
    )
    const hasDuePeriodRequiredWhen = enrollmentRequiredWhen.some(
        (rule) =>
            rule &&
            typeof rule === 'object' &&
            !Array.isArray(rule) &&
            (rule as Record<string, unknown>).field === 'DuePeriodDays' &&
            (rule as Record<string, unknown>).when &&
            typeof (rule as Record<string, unknown>).when === 'object' &&
            !Array.isArray((rule as Record<string, unknown>).when) &&
            ((rule as Record<string, unknown>).when as Record<string, unknown>).field === 'DueDateMode' &&
            ((rule as Record<string, unknown>).when as Record<string, unknown>).equals === 'ForPeriod'
    )
    if (!hasDueDateRequiredWhen || !hasDuePeriodRequiredWhen) {
        errors.push('LMS Enrollments must enforce conditional due-date requiredWhen runtime validations')
    }
    const enrollmentFields = enrollmentEntity?.fields ?? []
    for (const [fieldCodename, expectedMode] of [
        ['DueDate', 'ByDate'],
        ['DuePeriodDays', 'ForPeriod']
    ] as const) {
        const field = enrollmentFields.find((candidate) => readLocalizedText(candidate.codename, 'en') === fieldCodename)
        const uiConfig =
            field?.uiConfig && typeof field.uiConfig === 'object' && !Array.isArray(field.uiConfig)
                ? (field.uiConfig as Record<string, unknown>)
                : null
        const requiredWhen =
            uiConfig?.requiredWhen && typeof uiConfig.requiredWhen === 'object' && !Array.isArray(uiConfig.requiredWhen)
                ? (uiConfig.requiredWhen as Record<string, unknown>)
                : null
        if (requiredWhen?.field !== 'DueDateMode' || requiredWhen.equals !== expectedMode) {
            errors.push(`LMS Enrollments.${fieldCodename} must declare form requiredWhen metadata`)
        }
    }
    if (modules.some((candidate) => readLocalizedText(candidate?.codename, 'en') === 'AutoEnrollmentRuleModule')) {
        errors.push('LMS fixture must not include AutoEnrollmentRuleModule until canonical auto-enrollment target rules are modeled')
    }
    for (const requiredModule of [
        { codename: 'EnrollmentPostingModule', attachedTo: 'Enrollments', capabilities: ['lifecycle', 'posting', 'ledger.write'] },
        { codename: 'QuizAttemptPostingModule', attachedTo: 'QuizAttempts', capabilities: ['lifecycle', 'posting', 'ledger.write'] },
        {
            codename: 'ContentCompletionPostingModule',
            attachedTo: 'ContentProgress',
            capabilities: ['lifecycle', 'posting', 'ledger.write']
        },
        {
            codename: 'CertificateIssuePostingModule',
            attachedTo: 'CertificateIssues',
            capabilities: ['lifecycle', 'posting', 'ledger.write']
        },
        {
            codename: 'PointTransactionPostingModule',
            attachedTo: 'PointTransactions',
            capabilities: ['lifecycle', 'posting', 'ledger.write']
        }
    ]) {
        const module = modules.find((candidate) => readLocalizedText(candidate?.codename, 'en') === requiredModule.codename)
        if (!module) {
            errors.push(`LMS fixture must include the ${requiredModule.codename} lifecycle module`)
            continue
        }
        const manifest = module.manifest && typeof module.manifest === 'object' ? (module.manifest as Record<string, unknown>) : null
        const capabilities = Array.isArray(manifest?.capabilities) ? manifest.capabilities : []
        const attachedEntity = entityByCodename.get(requiredModule.attachedTo)
        if (module.attachedToKind !== 'object' || !attachedEntity?.id || module.attachedToId !== attachedEntity.id) {
            errors.push(`LMS ${requiredModule.codename} must be attached to ${requiredModule.attachedTo}`)
        }
        for (const capability of requiredModule.capabilities) {
            if (!capabilities.includes(capability)) {
                errors.push(`LMS ${requiredModule.codename} must declare ${capability} capability`)
            }
        }
    }

    const enrollmentPostingModule = modules.find((module) => readLocalizedText(module?.codename, 'en') === 'EnrollmentPostingModule')
    if (!enrollmentPostingModule) {
        errors.push('LMS fixture must include the EnrollmentPostingModule lifecycle module')
    } else {
        const manifest =
            enrollmentPostingModule.manifest && typeof enrollmentPostingModule.manifest === 'object'
                ? (enrollmentPostingModule.manifest as Record<string, unknown>)
                : {}
        const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : []
        const methods = Array.isArray(manifest.methods) ? manifest.methods : []
        const hasBeforePost = methods.some(
            (method) =>
                method &&
                typeof method === 'object' &&
                (method as Record<string, unknown>).target === 'server' &&
                (method as Record<string, unknown>).eventName === 'beforePost'
        )
        if (enrollmentPostingModule.attachedToKind !== 'object' || enrollmentPostingModule.attachedToId !== enrollmentEntity?.id) {
            errors.push('LMS EnrollmentPostingModule must be attached to the Enrollments object')
        }
        if (enrollmentPostingModule.moduleRole !== 'lifecycle') {
            errors.push('LMS EnrollmentPostingModule must use the lifecycle module role')
        }
        for (const capability of ['metadata.read', 'lifecycle', 'posting', 'ledger.write']) {
            if (!capabilities.includes(capability)) {
                errors.push(`LMS EnrollmentPostingModule must declare ${capability}`)
            }
        }
        if (!hasBeforePost) {
            errors.push('LMS EnrollmentPostingModule must declare a beforePost server handler')
        }
    }
    const exportedFixedValues = Object.values(envelope.snapshot?.fixedValues ?? {}).flat()
    const exportedOptionValues = Object.values(envelope.snapshot?.optionValues ?? {}).flat()
    const fixedValueCodenames = new Set(exportedFixedValues.map((value) => readLocalizedText(value?.codename, 'en')).filter(Boolean))
    const optionValueCodenames = new Set(exportedOptionValues.map((value) => readLocalizedText(value?.codename, 'en')).filter(Boolean))
    const defaultLibraryColumns = exportedFixedValues.find((value) => readLocalizedText(value?.codename, 'en') === 'DefaultLibraryColumns')
    if (defaultLibraryColumns?.value !== 'type,title,status,ResourceType') {
        errors.push('LMS DefaultLibraryColumns must use safe generic union display columns without raw reference or identity fields')
    }
    for (const codename of [
        'AppName',
        'DefaultPassingScore',
        'CertificateValidityDays',
        'AutoEnrollEnabled',
        'SupportEmail',
        'GamificationEnabled',
        'DefaultPointAward'
    ]) {
        if (!fixedValueCodenames.has(codename)) {
            errors.push(`LMS fixture is missing Set/Constants fixed value ${codename}`)
        }
    }
    for (const acceptanceArea of LMS_PRODUCT_ACCEPTANCE_MATRIX) {
        for (const statusCodename of acceptanceArea.requiredStatuses) {
            if (!fixedValueCodenames.has(statusCodename) && !optionValueCodenames.has(statusCodename)) {
                errors.push(`LMS acceptance area ${acceptanceArea.area} is missing status value ${statusCodename}`)
            }
        }
    }

    assertLmsSeededRowsContract({ envelope, entityByCodename, errors })
    if (errors.length > 0) {
        throw new Error(errors.join('\n'))
    }
}
