import { buildVLC } from '@universo-react/utils'
import { LMS_LYCEUM_MARATHON_CLASSES } from './lmsMarathonFixtureContract.ts'
import { LMS_SAMPLE_LINK, LMS_SECONDARY_LINK } from './lmsFixtureDataOverview.ts'

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

export const LMS_FIXTURE_CLASSES = [...LMS_DEMO_CLASSES, ...LMS_LYCEUM_MARATHON_CLASSES] as const

const LMS_DEMO_OPTION_IDS = {
    learningQ1Correct: '0199e000-0000-7000-8000-000000000001',
    learningQ1Incorrect: '0199e000-0000-7000-8000-000000000002',
    learningQ2Correct: '0199e000-0000-7000-8000-000000000003',
    learningQ2Incorrect: '0199e000-0000-7000-8000-000000000004',
    dockingQ1Correct: '0199e000-0000-7000-8000-000000000005',
    dockingQ1Incorrect: '0199e000-0000-7000-8000-000000000006',
    dockingQ2Correct: '0199e000-0000-7000-8000-000000000007',
    dockingQ2Incorrect: '0199e000-0000-7000-8000-000000000008',
    logisticsQ1Correct: '0199e000-0000-7000-8000-000000000009',
    logisticsQ1Incorrect: '0199e000-0000-7000-8000-00000000000a',
    logisticsQ2Correct: '0199e000-0000-7000-8000-00000000000b',
    logisticsQ2Incorrect: '0199e000-0000-7000-8000-00000000000c'
} as const

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
                        {
                            id: LMS_DEMO_OPTION_IDS.learningQ1Correct,
                            label: buildVLC('Departure window', 'Окно отправления'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.learningQ1Incorrect,
                            label: buildVLC('Docking corridor', 'Коридор стыковки'),
                            isCorrect: false
                        }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Which signal confirms a stable route?',
                    description: 'Choose one answer.',
                    explanation: 'The navigation beacon confirms stability.',
                    options: [
                        {
                            id: LMS_DEMO_OPTION_IDS.learningQ2Correct,
                            label: buildVLC('Navigation beacon', 'Навигационный маяк'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.learningQ2Incorrect,
                            label: buildVLC('Cabin humidity alert', 'Сигнал влажности кабины'),
                            isCorrect: false
                        }
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
                        {
                            id: LMS_DEMO_OPTION_IDS.learningQ1Correct,
                            label: buildVLC('Departure window', 'Окно отправления'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.learningQ1Incorrect,
                            label: buildVLC('Docking corridor', 'Коридор стыковки'),
                            isCorrect: false
                        }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Какой сигнал подтверждает устойчивость маршрута?',
                    description: 'Выберите один вариант.',
                    explanation: 'Навигационный маяк подтверждает устойчивость.',
                    options: [
                        {
                            id: LMS_DEMO_OPTION_IDS.learningQ2Correct,
                            label: buildVLC('Navigation beacon', 'Навигационный маяк'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.learningQ2Incorrect,
                            label: buildVLC('Cabin humidity alert', 'Сигнал влажности кабины'),
                            isCorrect: false
                        }
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
                        {
                            id: LMS_DEMO_OPTION_IDS.dockingQ1Correct,
                            label: buildVLC('Green corridor beacon', 'Зелёный маяк коридора'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.dockingQ1Incorrect,
                            label: buildVLC('Cargo hatch alarm', 'Сигнал люка грузового отсека'),
                            isCorrect: false
                        }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'What to verify before opening the seal?',
                    description: 'Choose one answer.',
                    explanation: 'Confirm pressure balance first.',
                    options: [
                        {
                            id: LMS_DEMO_OPTION_IDS.dockingQ2Correct,
                            label: buildVLC('Pressure balance', 'Баланс давления'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.dockingQ2Incorrect,
                            label: buildVLC('Passenger manifest', 'Пассажирский манифест'),
                            isCorrect: false
                        }
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
                        {
                            id: LMS_DEMO_OPTION_IDS.dockingQ1Correct,
                            label: buildVLC('Green corridor beacon', 'Зелёный маяк коридора'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.dockingQ1Incorrect,
                            label: buildVLC('Cargo hatch alarm', 'Сигнал люка грузового отсека'),
                            isCorrect: false
                        }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Что проверить перед открытием пломбы?',
                    description: 'Выберите один вариант.',
                    explanation: 'Сначала подтвердите баланс давления.',
                    options: [
                        {
                            id: LMS_DEMO_OPTION_IDS.dockingQ2Correct,
                            label: buildVLC('Pressure balance', 'Баланс давления'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.dockingQ2Incorrect,
                            label: buildVLC('Passenger manifest', 'Пассажирский манифест'),
                            isCorrect: false
                        }
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
                            id: LMS_DEMO_OPTION_IDS.logisticsQ1Correct,
                            label: buildVLC('Outbound supply manifest', 'Манифест исходящих поставок'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.logisticsQ1Incorrect,
                            label: buildVLC('Crew meal rota', 'График питания экипажа'),
                            isCorrect: false
                        }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'What shows the payload route is ready?',
                    description: 'Choose one answer.',
                    explanation: 'The ready dispatch window shows approval.',
                    options: [
                        {
                            id: LMS_DEMO_OPTION_IDS.logisticsQ2Correct,
                            label: buildVLC('Ready dispatch window', 'Готовое окно отправки'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.logisticsQ2Incorrect,
                            label: buildVLC('Cabin lighting alert', 'Сигнал подсветки кабины'),
                            isCorrect: false
                        }
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
                            id: LMS_DEMO_OPTION_IDS.logisticsQ1Correct,
                            label: buildVLC('Outbound supply manifest', 'Манифест исходящих поставок'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.logisticsQ1Incorrect,
                            label: buildVLC('Crew meal rota', 'График питания экипажа'),
                            isCorrect: false
                        }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Что показывает готовность маршрута?',
                    description: 'Выберите один вариант.',
                    explanation: 'Готовое окно отправки показывает одобрение.',
                    options: [
                        {
                            id: LMS_DEMO_OPTION_IDS.logisticsQ2Correct,
                            label: buildVLC('Ready dispatch window', 'Готовое окно отправки'),
                            isCorrect: true
                        },
                        {
                            id: LMS_DEMO_OPTION_IDS.logisticsQ2Incorrect,
                            label: buildVLC('Cabin lighting alert', 'Сигнал подсветки кабины'),
                            isCorrect: false
                        }
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

export const LMS_DEMO_CLASS = LMS_DEMO_CLASSES[0]
export const LMS_DEMO_STUDENT = LMS_DEMO_STUDENTS[0]
export const LMS_DEMO_CONTENT_NODE = LMS_DEMO_CONTENT_NODES[0]
export const LMS_DEMO_QUIZ = LMS_DEMO_QUIZZES[0]
