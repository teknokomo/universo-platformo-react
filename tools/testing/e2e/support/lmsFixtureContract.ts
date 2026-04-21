import { buildVLC, computeSnapshotHash } from '@universo/utils'

export const LMS_FIXTURE_FILENAME = 'metahubs-lms-app-snapshot.json'
export const LMS_MODULE_SCRIPT_CODENAME = 'lms-module-viewer'
export const LMS_STATS_SCRIPT_CODENAME = 'lms-stats-viewer'

export const LMS_CANONICAL_METAHUB = {
    name: {
        en: 'Orbital Academy LMS',
        ru: 'Орбитальная академия LMS'
    },
    description: {
        en: 'Canonical bilingual LMS metahub fixture with seeded classes, modules, public links, and dashboard widgets.',
        ru: 'Канонический двуязычный LMS fixture metahub с заполненными классами, модулями, публичными ссылками и dashboard-виджетами.'
    },
    codename: {
        en: 'OrbitalAcademyLms',
        ru: 'ОрбитальнаяАкадемияLms'
    }
}

export const LMS_PUBLICATION = {
    name: {
        en: 'Orbital Academy Publication',
        ru: 'Публикация Орбитальной академии'
    },
    applicationName: {
        en: 'Orbital Academy App',
        ru: 'Приложение Орбитальной академии'
    }
}

export const LMS_SAMPLE_LINK = {
    slug: 'demo-module',
    title: {
        en: 'Orbital navigation guest journey',
        ru: 'Гостевой путь по орбитальной навигации'
    }
}

export const LMS_SECONDARY_LINK = {
    slug: 'docking-drill',
    title: {
        en: 'Docking corridor guest drill',
        ru: 'Гостевая тренировка по стыковочному коридору'
    }
}

const buildInlineRouteMapDataUri = (title: string, subtitle: string) => {
        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="${title}">
    <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#071426" />
            <stop offset="100%" stop-color="#15345c" />
        </linearGradient>
    </defs>
    <rect width="1200" height="720" fill="url(#bg)" rx="32" />
    <g fill="none" stroke="#9ed8ff" stroke-width="8" stroke-linecap="round">
        <path d="M140 520 C260 420 340 340 450 330 S660 360 760 290 S980 180 1060 140" opacity="0.9" />
        <path d="M140 520 C240 560 340 600 430 590 S620 520 720 470 S900 360 1040 320" opacity="0.35" />
    </g>
    <g fill="#f7fbff" font-family="Arial, Helvetica, sans-serif">
        <text x="96" y="112" font-size="48" font-weight="700">${title}</text>
        <text x="96" y="160" font-size="28" opacity="0.82">${subtitle}</text>
        <text x="96" y="636" font-size="22" opacity="0.7">Orbital Academy LMS demo fixture</text>
    </g>
    <g>
        <circle cx="180" cy="516" r="18" fill="#9ed8ff" />
        <circle cx="454" cy="332" r="18" fill="#9ed8ff" />
        <circle cx="762" cy="290" r="18" fill="#9ed8ff" />
        <circle cx="1060" cy="140" r="18" fill="#9ed8ff" />
        <circle cx="1040" cy="320" r="18" fill="#89f0c7" />
    </g>
</svg>`.trim()

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const LMS_ROUTE_MAP_IMAGE = {
        en: buildInlineRouteMapDataUri('Orbital Route Map', 'Shared guest path and dashboard hand-off remain available after clean import.'),
        ru: buildInlineRouteMapDataUri('Карта орбитального маршрута', 'Гостевой путь и dashboard-переход доступны сразу после чистого импорта.')
}

export const LMS_DEMO_CLASSES = [
    {
        key: 'orbital-navigation',
        name: {
            en: 'Orbital Navigation Cohort',
            ru: 'Когорта орбитальной навигации'
        },
        description: {
            en: 'Crew training for orbital checkpoints.',
            ru: 'Подготовка экипажа по орбитальным точкам.'
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
        key: 'orbital-navigation',
        title: {
            en: 'Orbital Readiness Check',
            ru: 'Проверка орбитальной готовности'
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
                        { id: 'orbital-q1-opt-a', label: buildVLC('Departure window', 'Окно отправления'), isCorrect: true },
                        { id: 'orbital-q1-opt-b', label: buildVLC('Docking corridor', 'Коридор стыковки'), isCorrect: false }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Which signal confirms a stable route?',
                    description: 'Choose one answer.',
                    explanation: 'The navigation beacon confirms stability.',
                    options: [
                        { id: 'orbital-q2-opt-a', label: buildVLC('Navigation beacon', 'Навигационный маяк'), isCorrect: true },
                        { id: 'orbital-q2-opt-b', label: buildVLC('Cabin humidity alert', 'Сигнал влажности кабины'), isCorrect: false }
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
                        { id: 'orbital-q1-opt-a', label: buildVLC('Departure window', 'Окно отправления'), isCorrect: true },
                        { id: 'orbital-q1-opt-b', label: buildVLC('Docking corridor', 'Коридор стыковки'), isCorrect: false }
                    ],
                    sortOrder: 1
                },
                {
                    prompt: 'Какой сигнал подтверждает устойчивость маршрута?',
                    description: 'Выберите один вариант.',
                    explanation: 'Навигационный маяк подтверждает устойчивость.',
                    options: [
                        { id: 'orbital-q2-opt-a', label: buildVLC('Navigation beacon', 'Навигационный маяк'), isCorrect: true },
                        { id: 'orbital-q2-opt-b', label: buildVLC('Cabin humidity alert', 'Сигнал влажности кабины'), isCorrect: false }
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
                        { id: 'logistics-q1-opt-a', label: buildVLC('Outbound supply manifest', 'Манифест исходящих поставок'), isCorrect: true },
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
                        { id: 'logistics-q1-opt-a', label: buildVLC('Outbound supply manifest', 'Манифест исходящих поставок'), isCorrect: true },
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

export const LMS_DEMO_MODULES = [
    {
        key: 'orbital-navigation',
        linkedQuizKey: 'orbital-navigation',
        linkedClassKey: 'orbital-navigation',
        title: {
            en: 'Orbital Navigation 101',
            ru: 'Орбитальная навигация 101'
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
        linkedClassKey: 'orbital-navigation',
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

export const LMS_DEMO_ACCESS_LINKS = [
    {
        key: 'demo-module',
        slug: LMS_SAMPLE_LINK.slug,
        title: LMS_SAMPLE_LINK.title,
        moduleKey: 'orbital-navigation',
        classKey: 'orbital-navigation'
    },
    {
        key: 'docking-drill',
        slug: LMS_SECONDARY_LINK.slug,
        title: LMS_SECONDARY_LINK.title,
        moduleKey: 'docking-corridor',
        classKey: 'orbital-navigation'
    }
] as const

export const LMS_DEMO_ENROLLMENTS = [
    {
        key: 'ava-orbital-navigation',
        studentKey: 'ava-solaris',
        classKey: 'orbital-navigation',
        moduleKey: 'orbital-navigation'
    },
    {
        key: 'ava-docking-corridor',
        studentKey: 'ava-solaris',
        classKey: 'orbital-navigation',
        moduleKey: 'docking-corridor'
    },
    {
        key: 'maksim-lunar-logistics',
        studentKey: 'maksim-vega',
        classKey: 'lunar-logistics',
        moduleKey: 'lunar-logistics'
    }
] as const

export const LMS_DEMO_MODULE_PROGRESS = [
    {
        key: 'ava-orbital-navigation-progress',
        studentKey: 'ava-solaris',
        moduleKey: 'orbital-navigation',
        status: 'completed',
        progressPercent: 100
    },
    {
        key: 'ava-docking-corridor-progress',
        studentKey: 'ava-solaris',
        moduleKey: 'docking-corridor',
        status: 'in_progress',
        progressPercent: 50
    },
    {
        key: 'maksim-lunar-logistics-progress',
        studentKey: 'maksim-vega',
        moduleKey: 'lunar-logistics',
        status: 'completed',
        progressPercent: 100
    }
] as const

export const LMS_DEMO_QUIZ_RESPONSES = [
    {
        key: 'ava-orbital-navigation-q1',
        studentKey: 'ava-solaris',
        quizKey: 'orbital-navigation',
        questionId: 'orbital-navigation-question-1',
        selectedOptionIds: ['orbital-q1-opt-a'],
        isCorrect: true,
        attemptNumber: 1
    },
    {
        key: 'ava-orbital-navigation-q2',
        studentKey: 'ava-solaris',
        quizKey: 'orbital-navigation',
        questionId: 'orbital-navigation-question-2',
        selectedOptionIds: ['orbital-q2-opt-a'],
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
export const LMS_DEMO_MODULE = LMS_DEMO_MODULES[0]
export const LMS_DEMO_QUIZ = LMS_DEMO_QUIZZES[0]

export const LMS_DEMO_STATS = {
    en: {
        title: 'Orbital academy stats',
        description: 'Seeded LMS metrics available immediately after fixture import.',
        categories: ['Seeded students', 'Published modules', 'Guest routes', 'Seeded quiz attempts'],
        series: [
            {
                label: 'Count',
                values: [2, 3, 2, 3]
            }
        ]
    },
    ru: {
        title: 'Статистика орбитальной академии',
        description: 'Метрики LMS, доступные сразу после импорта fixture.',
        categories: ['Заполненные студенты', 'Опубликованные модули', 'Гостевые маршруты', 'Заполненные попытки тестов'],
        series: [
            {
                label: 'Количество',
                values: [2, 3, 2, 3]
            }
        ]
    }
}

export const LMS_MODULE_VIEW = {
    en: {
        title: LMS_DEMO_MODULE.title.en,
        description: 'Dashboard preview of the canonical orbital lesson and route hand-off.',
        progressPercent: 100,
        items: [
            {
                id: 'briefing',
                itemType: 'text',
                itemTitle: 'Mission briefing',
                itemContent: 'The imported dashboard should already contain the canonical orbital lesson, seeded guest routes, and a valid QR hand-off.',
                sortOrder: 1
            },
            {
                id: 'visual',
                itemType: 'image',
                itemTitle: 'Route map',
                itemContent: LMS_ROUTE_MAP_IMAGE.en,
                sortOrder: 2
            }
        ]
    },
    ru: {
        title: LMS_DEMO_MODULE.title.ru,
        description: 'Dashboard-превью канонического урока по орбитальной навигации и передачи в гостевой маршрут.',
        progressPercent: 100,
        items: [
            {
                id: 'briefing',
                itemType: 'text',
                itemTitle: 'Брифинг миссии',
                itemContent: 'Импортированный dashboard уже должен содержать канонический орбитальный урок, заполненные гостевые маршруты и рабочий QR-переход.',
                sortOrder: 1
            },
            {
                id: 'visual',
                itemType: 'image',
                itemTitle: 'Карта маршрута',
                itemContent: LMS_ROUTE_MAP_IMAGE.ru,
                sortOrder: 2
            }
        ]
    }
}

const normalizeLocaleScript = (locale) => (typeof locale === 'string' && locale.toLowerCase().startsWith('ru') ? 'ru' : 'en')

export const LMS_MODULE_WIDGET_SOURCE = `const AtClient = () => () => undefined
const AtServer = () => () => undefined
class ExtensionScript {}

const MODULE_BY_LOCALE = ${JSON.stringify(LMS_MODULE_VIEW)}

const normalizeLocale = ${normalizeLocaleScript.toString()}

export default class LmsModuleViewerFixture extends ExtensionScript {
    @AtClient()
    async mount(locale = 'en') {
        return this.ctx.callServerMethod('getModule', [{ locale }])
    }

    @AtServer()
    async getModule(payload) {
        return MODULE_BY_LOCALE[normalizeLocale(payload?.locale)] || MODULE_BY_LOCALE.en
    }
}
`

export const LMS_STATS_WIDGET_SOURCE = `const AtClient = () => () => undefined
const AtServer = () => () => undefined
class ExtensionScript {}

const STATS_BY_LOCALE = ${JSON.stringify(LMS_DEMO_STATS)}

const normalizeLocale = ${normalizeLocaleScript.toString()}

export default class LmsStatsViewerFixture extends ExtensionScript {
    @AtClient()
    async mount(locale = 'en') {
        return this.ctx.callServerMethod('getStats', [{ locale }])
    }

    @AtServer()
    async getStats(payload) {
        return STATS_BY_LOCALE[normalizeLocale(payload?.locale)] || STATS_BY_LOCALE.en
    }
}
`

type SnapshotEntity = { id?: string; codename?: unknown; kind?: string; fields?: Array<Record<string, unknown>> }
type SnapshotElement = { id?: string; data?: Record<string, unknown> }
type SnapshotScript = Record<string, unknown>
type SnapshotLayoutWidget = Record<string, unknown>

type SnapshotEnvelope = Record<string, unknown> & {
    snapshot?: {
        entities?: Record<string, SnapshotEntity>
        elements?: Record<string, SnapshotElement[]>
        scripts?: SnapshotScript[]
        layoutZoneWidgets?: SnapshotLayoutWidget[]
    }
    metahub?: {
        name?: unknown
        description?: unknown
        codename?: unknown
    }
    snapshotHash?: string
}

const REQUIRED_ENTITY_CODENAMES = [
    'Classes',
    'Students',
    'Modules',
    'Quizzes',
    'QuizResponses',
    'ModuleProgress',
    'AccessLinks',
    'Enrollments'
]

const readLocalizedText = (value: unknown, locale = 'en'): string | undefined => {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object') {
        return undefined
    }

    const localized = value as { _primary?: string; locales?: Record<string, { content?: string }> }
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const locales = localized.locales ?? {}
    const directValue = locales[normalizedLocale]?.content
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryValue = localized._primary ? locales[localized._primary]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.length > 0)?.content
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

const readWidgetConfig = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const getSeededRows = (elementsByEntityId: Record<string, SnapshotElement[]>, entityId: string | undefined) => {
    if (!entityId) {
        return []
    }

    return Array.isArray(elementsByEntityId[entityId]) ? elementsByEntityId[entityId] : []
}

const findRowByField = (
    rows: SnapshotElement[],
    fieldName: string,
    expectedValue: string,
    locale: 'en' | 'ru' = 'en'
) =>
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

export function assertLmsFixtureEnvelopeContract(envelope: SnapshotEnvelope) {
    const errors: string[] = []

    if (envelope.kind !== 'metahub_snapshot_bundle') {
        errors.push('LMS fixture must keep kind="metahub_snapshot_bundle"')
    }

    if (!envelope?.snapshot || typeof envelope.snapshot !== 'object') {
        errors.push('LMS fixture is missing the snapshot payload')
    } else if (envelope.snapshotHash !== computeSnapshotHash(envelope.snapshot)) {
        errors.push('LMS fixture snapshotHash drifted from the canonical snapshot payload')
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

    if ([metahubNameEn, metahubNameRu, metahubCodenameEn, metahubCodenameRu].some((value) => typeof value === 'string' && /e2e|runid|imported-/i.test(value))) {
        errors.push('LMS fixture identity still contains run-specific markers')
    }

    const entities = Object.values(envelope.snapshot?.entities ?? {})
    const entityByCodename = new Map<string, SnapshotEntity>()
    for (const entity of entities) {
        const codename = readLocalizedText(entity?.codename, 'en')
        if (codename) {
            entityByCodename.set(codename, entity)
        }
    }

    for (const codename of REQUIRED_ENTITY_CODENAMES) {
        if (!entityByCodename.has(codename)) {
            errors.push(`LMS fixture is missing entity ${codename}`)
        }
    }

    const scripts = Array.isArray(envelope.snapshot?.scripts) ? envelope.snapshot.scripts : []
    if (scripts.length !== 2) {
        errors.push(`LMS fixture must contain exactly two exported scripts, received ${scripts.length}`)
    }

    const expectedScripts = [
        { codename: LMS_MODULE_SCRIPT_CODENAME, sourceCode: LMS_MODULE_WIDGET_SOURCE },
        { codename: LMS_STATS_SCRIPT_CODENAME, sourceCode: LMS_STATS_WIDGET_SOURCE }
    ]

    for (const expectedScript of expectedScripts) {
        const script = scripts.find((item) => readLocalizedText(item?.codename, 'en') === expectedScript.codename)
        if (!script) {
            errors.push(`LMS fixture is missing the canonical ${expectedScript.codename} script`)
            continue
        }

        if (script.attachedToKind !== 'metahub') {
            errors.push(`LMS script ${expectedScript.codename} must attach to metahub`)
        }
        if ((script.attachedToId ?? null) !== null) {
            errors.push(`LMS script ${expectedScript.codename} must keep a null metahub attachment id`)
        }
        if (script.moduleRole !== 'widget') {
            errors.push(`LMS script ${expectedScript.codename} must keep widget moduleRole`)
        }
        if (script.sourceKind !== 'embedded') {
            errors.push(`LMS script ${expectedScript.codename} must keep embedded sourceKind`)
        }
        if (script.isActive !== true) {
            errors.push(`LMS script ${expectedScript.codename} must stay active`)
        }
        if (script.sourceCode !== expectedScript.sourceCode) {
            errors.push(`LMS script ${expectedScript.codename} sourceCode drifted from the canonical source`) 
        }
    }

    const widgets = Array.isArray(envelope.snapshot?.layoutZoneWidgets) ? envelope.snapshot.layoutZoneWidgets : []
    const moduleWidget = widgets.find((widget) => widget?.widgetKey === 'moduleViewerWidget')
    const statsWidget = widgets.find((widget) => widget?.widgetKey === 'statsViewerWidget')
    const qrWidget = widgets.find((widget) => widget?.widgetKey === 'qrCodeWidget')

    if (!moduleWidget) {
        errors.push('LMS fixture must include moduleViewerWidget in the default layout')
    } else {
        const config = readWidgetConfig(moduleWidget.config)
        if (config.attachedToKind !== 'metahub') {
            errors.push('LMS moduleViewerWidget must bind to metahub scripts')
        }
        if (config.scriptCodename !== LMS_MODULE_SCRIPT_CODENAME) {
            errors.push('LMS moduleViewerWidget must bind to the canonical module viewer script')
        }
    }

    if (!statsWidget) {
        errors.push('LMS fixture must include statsViewerWidget in the default layout')
    } else {
        const config = readWidgetConfig(statsWidget.config)
        if (config.attachedToKind !== 'metahub') {
            errors.push('LMS statsViewerWidget must bind to metahub scripts')
        }
        if (config.scriptCodename !== LMS_STATS_SCRIPT_CODENAME) {
            errors.push('LMS statsViewerWidget must bind to the canonical stats viewer script')
        }
    }

    if (!qrWidget) {
        errors.push('LMS fixture must include qrCodeWidget in the default layout')
    } else {
        const config = readWidgetConfig(qrWidget.config)
        if (config.publicLinkSlug !== LMS_SAMPLE_LINK.slug) {
            errors.push(`LMS qrCodeWidget must bind to the canonical public link slug ${LMS_SAMPLE_LINK.slug}`)
        }
        if (typeof config.url === 'string' && config.url.length > 0) {
            errors.push('LMS qrCodeWidget must not persist a hardcoded URL')
        }
    }

    const elementsByEntityId = envelope.snapshot?.elements ?? {}
    const classRows = getSeededRows(elementsByEntityId, entityByCodename.get('Classes')?.id)
    const studentRows = getSeededRows(elementsByEntityId, entityByCodename.get('Students')?.id)
    const moduleRows = getSeededRows(elementsByEntityId, entityByCodename.get('Modules')?.id)
    const quizRows = getSeededRows(elementsByEntityId, entityByCodename.get('Quizzes')?.id)
    const quizResponseRows = getSeededRows(elementsByEntityId, entityByCodename.get('QuizResponses')?.id)
    const moduleProgressRows = getSeededRows(elementsByEntityId, entityByCodename.get('ModuleProgress')?.id)
    const accessLinkRows = getSeededRows(elementsByEntityId, entityByCodename.get('AccessLinks')?.id)
    const enrollmentRows = getSeededRows(elementsByEntityId, entityByCodename.get('Enrollments')?.id)

    const expectedCounts = [
        ['class', classRows.length, LMS_DEMO_CLASSES.length],
        ['student', studentRows.length, LMS_DEMO_STUDENTS.length],
        ['module', moduleRows.length, LMS_DEMO_MODULES.length],
        ['quiz', quizRows.length, LMS_DEMO_QUIZZES.length],
        ['quiz response', quizResponseRows.length, LMS_DEMO_QUIZ_RESPONSES.length],
        ['module progress', moduleProgressRows.length, LMS_DEMO_MODULE_PROGRESS.length],
        ['access link', accessLinkRows.length, LMS_DEMO_ACCESS_LINKS.length],
        ['enrollment', enrollmentRows.length, LMS_DEMO_ENROLLMENTS.length]
    ] as const

    for (const [label, actual, expected] of expectedCounts) {
        if (actual !== expected) {
            errors.push(`LMS fixture must seed exactly ${expected} ${label} row(s), received ${actual}`)
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
        if (readLocalizedText(classData.Description, 'en') !== seededClass.description.en) {
            errors.push(`LMS class ${seededClass.name.en} is missing the canonical English description`)
        }
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
    }

    const moduleRowsByKey = new Map<string, SnapshotElement>()
    for (const seededModule of LMS_DEMO_MODULES) {
        const moduleRow = findRowByField(moduleRows, 'Title', seededModule.title.en)
        if (!moduleRow) {
            errors.push(`LMS fixture is missing module ${seededModule.title.en}`)
            continue
        }
        moduleRowsByKey.set(seededModule.key, moduleRow)

        const moduleData = moduleRow.data ?? {}
        if (readLocalizedText(moduleData.Title, 'ru') !== seededModule.title.ru) {
            errors.push(`LMS module ${seededModule.title.en} is missing the canonical Russian title`)
        }
        if (readLocalizedText(moduleData.Description, 'en') !== seededModule.description.en) {
            errors.push(`LMS module ${seededModule.title.en} is missing the canonical English description`)
        }
        if (readLocalizedText(moduleData.Description, 'ru') !== seededModule.description.ru) {
            errors.push(`LMS module ${seededModule.title.en} is missing the canonical Russian description`)
        }
        if (moduleData.EstimatedDurationMinutes !== seededModule.estimatedDurationMinutes) {
            errors.push(`LMS module ${seededModule.title.en} must keep EstimatedDurationMinutes=${seededModule.estimatedDurationMinutes}`)
        }
        if ((moduleData.AccessLinkSlug ?? null) !== seededModule.accessLinkSlug) {
            errors.push(`LMS module ${seededModule.title.en} must keep AccessLinkSlug=${String(seededModule.accessLinkSlug)}`)
        }

        const contentItems = Array.isArray(moduleData.ContentItems) ? moduleData.ContentItems : []
        if (contentItems.length !== seededModule.contentItems.en.length) {
            errors.push(`LMS module ${seededModule.title.en} must contain ${seededModule.contentItems.en.length} content item(s)`)
        }

        const quizRefItem = contentItems.find((item) => item && typeof item === 'object' && (item as Record<string, unknown>).QuizId)
        const linkedQuizRow = quizRowsByKey.get(seededModule.linkedQuizKey)
        if (!quizRefItem || !linkedQuizRow?.id) {
            errors.push(`LMS module ${seededModule.title.en} must include a quiz_ref item linked to ${seededModule.linkedQuizKey}`)
        } else if ((quizRefItem as Record<string, unknown>).QuizId !== linkedQuizRow.id) {
            errors.push(`LMS module ${seededModule.title.en} quiz_ref item must point at the canonical seeded quiz row id`)
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
        if (accessLinkData.TargetType !== 'module') {
            errors.push(`LMS access link ${seededLink.slug} must target the module guest journey`)
        }

        const linkedModuleRow = moduleRowsByKey.get(seededLink.moduleKey)
        const linkedClassRow = classRowsByKey.get(seededLink.classKey)
        if (linkedModuleRow?.id && accessLinkData.TargetId !== linkedModuleRow.id) {
            errors.push(`LMS access link ${seededLink.slug} must point at the seeded module row id`)
        }
        if (linkedClassRow?.id && accessLinkData.LinkClassId !== linkedClassRow.id) {
            errors.push(`LMS access link ${seededLink.slug} must reference the seeded class row id`)
        }
    }

    for (const seededEnrollment of LMS_DEMO_ENROLLMENTS) {
        const expectedStudentRow = studentRowsByKey.get(seededEnrollment.studentKey)
        const expectedClassRow = classRowsByKey.get(seededEnrollment.classKey)
        const expectedModuleRow = moduleRowsByKey.get(seededEnrollment.moduleKey)
        const enrollmentRow = enrollmentRows.find(
            (row) =>
                row?.data?.EnrollmentStudentId === expectedStudentRow?.id &&
                row?.data?.EnrollmentClassId === expectedClassRow?.id &&
                row?.data?.ModuleIdRef === expectedModuleRow?.id
        )

        if (!enrollmentRow) {
            errors.push(`LMS fixture is missing enrollment ${seededEnrollment.key}`)
        }
    }

    for (const seededProgress of LMS_DEMO_MODULE_PROGRESS) {
        const expectedStudentRow = studentRowsByKey.get(seededProgress.studentKey)
        const expectedModuleRow = moduleRowsByKey.get(seededProgress.moduleKey)
        const moduleProgressRow = moduleProgressRows.find(
            (row) => row?.data?.ProgressStudentId === expectedStudentRow?.id && row?.data?.ModuleId === expectedModuleRow?.id
        )

        if (!moduleProgressRow) {
            errors.push(`LMS fixture is missing module progress ${seededProgress.key}`)
            continue
        }

        const moduleProgressData = moduleProgressRow.data ?? {}
        if (moduleProgressData.ProgressStatus !== seededProgress.status) {
            errors.push(`LMS module progress ${seededProgress.key} must keep ProgressStatus=${seededProgress.status}`)
        }
        if (moduleProgressData.ProgressPercent !== seededProgress.progressPercent) {
            errors.push(`LMS module progress ${seededProgress.key} must keep ProgressPercent=${seededProgress.progressPercent}`)
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
        const normalizedSelectedOptionIds = Array.isArray(quizResponseData.SelectedOptionIds)
            ? quizResponseData.SelectedOptionIds
            : []

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

    if (errors.length > 0) {
        throw new Error(errors.join('\n'))
    }
}