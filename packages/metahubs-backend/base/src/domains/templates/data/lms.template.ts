import type { MetahubTemplateManifest, TemplateSeedZoneWidget } from '@universo/types'
import { vlc, enrichConfigWithVlcTimestamps } from './basic.template'

function buildLmsSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return [
        {
            zone: 'left' as const,
            widgetKey: 'menuWidget',
            sortOrder: 3,
            config: enrichConfigWithVlcTimestamps({
                showTitle: true,
                title: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Learning', version: 1, isActive: true },
                        ru: { content: 'Обучение', version: 1, isActive: true }
                    }
                },
                autoShowAllCatalogs: false,
                bindToHub: false,
                boundTreeEntityId: null,
                maxPrimaryItems: 6,
                overflowLabelKey: 'runtime.menu.more',
                startPage: 'Modules',
                workspacePlacement: 'primary',
                items: [
                    {
                        id: 'lms-nav-learning',
                        kind: 'hub',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Learning', version: 1, isActive: true },
                                ru: { content: 'Обучение', version: 1, isActive: true }
                            }
                        },
                        icon: 'school',
                        href: null,
                        hubId: 'Learning',
                        sortOrder: 1,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-catalog',
                        kind: 'catalog',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Catalog', version: 1, isActive: true },
                                ru: { content: 'Каталог', version: 1, isActive: true }
                            }
                        },
                        icon: 'catalog',
                        href: null,
                        catalogId: 'Modules',
                        sortOrder: 2,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-knowledge',
                        kind: 'catalog',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Knowledge', version: 1, isActive: true },
                                ru: { content: 'Знания', version: 1, isActive: true }
                            }
                        },
                        icon: 'folder',
                        href: null,
                        catalogId: 'Quizzes',
                        sortOrder: 3,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-development',
                        kind: 'catalog',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Development', version: 1, isActive: true },
                                ru: { content: 'Развитие', version: 1, isActive: true }
                            }
                        },
                        icon: 'tasks',
                        href: null,
                        catalogId: 'Classes',
                        sortOrder: 4,
                        isActive: true
                    },
                    {
                        id: 'lms-nav-reports',
                        kind: 'catalog',
                        title: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Reports', version: 1, isActive: true },
                                ru: { content: 'Отчеты', version: 1, isActive: true }
                            }
                        },
                        icon: 'analytics',
                        href: null,
                        catalogId: 'ModuleProgress',
                        sortOrder: 5,
                        isActive: true
                    }
                ]
            })
        },
        { zone: 'top' as const, widgetKey: 'appNavbar', sortOrder: 1 },
        { zone: 'top' as const, widgetKey: 'header', sortOrder: 2 },
        { zone: 'center' as const, widgetKey: 'detailsTitle', sortOrder: 5 },
        { zone: 'center' as const, widgetKey: 'detailsTable', sortOrder: 7 }
    ]
}

export const lmsTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'lms',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('LMS', 'LMS'),
    description: vlc(
        'Learning Management System template with classes, modules, quizzes, and student tracking.',
        'Шаблон системы управления обучением с классами, модулями, тестами и отслеживанием студентов.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['lms', 'education', 'quiz'],
        icon: 'School'
    },
    presets: [],
    seed: {
        layouts: [
            {
                codename: 'main',
                templateKey: 'dashboard',
                name: vlc('Main', 'Основной'),
                description: vlc('Main layout for LMS application', 'Основной макет для приложения LMS'),
                isDefault: true,
                isActive: true,
                sortOrder: 0
            }
        ],
        layoutZoneWidgets: {
            main: buildLmsSeedZoneWidgets()
        },
        entities: [
            {
                codename: 'Learning',
                kind: 'hub',
                name: vlc('Learning', 'Обучение'),
                description: vlc('Root learning navigation hub for LMS resources.', 'Корневой учебный хаб для навигации по ресурсам LMS.')
            },
            {
                codename: 'Classes',
                kind: 'catalog',
                name: vlc('Classes', 'Классы'),
                description: vlc('Student groups for learning management.', 'Группы студентов для управления обучением.'),
                attributes: [
                    {
                        codename: 'Name',
                        dataType: 'STRING',
                        name: vlc('Name', 'Название'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 255, localized: true, versioned: true }
                    },
                    {
                        codename: 'Description',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 2,
                        validationRules: { localized: true, versioned: true }
                    },
                    {
                        codename: 'SchoolYear',
                        dataType: 'STRING',
                        name: vlc('School Year', 'Учебный год'),
                        sortOrder: 3,
                        validationRules: { maxLength: 20 }
                    },
                    {
                        codename: 'StudentCountLimit',
                        dataType: 'NUMBER',
                        name: vlc('Student Count Limit', 'Лимит студентов'),
                        sortOrder: 4,
                        validationRules: { min: 1, max: 1000 }
                    }
                ]
            },
            {
                codename: 'Students',
                kind: 'catalog',
                name: vlc('Students', 'Студенты'),
                description: vlc('Registered and guest students.', 'Зарегистрированные и гостевые студенты.'),
                attributes: [
                    {
                        codename: 'DisplayName',
                        dataType: 'STRING',
                        name: vlc('Display Name', 'Отображаемое имя'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 255 }
                    },
                    {
                        codename: 'Email',
                        dataType: 'STRING',
                        name: vlc('Email', 'Электронная почта'),
                        sortOrder: 2,
                        validationRules: { maxLength: 320 }
                    },
                    {
                        codename: 'IsGuest',
                        dataType: 'BOOLEAN',
                        name: vlc('Is Guest', 'Гость'),
                        sortOrder: 3
                    },
                    {
                        codename: 'GuestSessionToken',
                        dataType: 'STRING',
                        name: vlc('Guest Session Token', 'Токен гостевой сессии'),
                        sortOrder: 4
                    }
                ]
            },
            {
                codename: 'Modules',
                kind: 'catalog',
                name: vlc('Modules', 'Модули'),
                description: vlc(
                    'Learning content modules with structured content items.',
                    'Учебные модули со структурированными элементами контента.'
                ),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'Description',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 2,
                        validationRules: { localized: true, versioned: true }
                    },
                    {
                        codename: 'Status',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 3,
                        targetEntityCodename: 'ModuleStatus',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'CoverImageUrl',
                        dataType: 'STRING',
                        name: vlc('Cover Image URL', 'URL обложки'),
                        sortOrder: 4,
                        validationRules: { maxLength: 2048 }
                    },
                    {
                        codename: 'EstimatedDurationMinutes',
                        dataType: 'NUMBER',
                        name: vlc('Estimated Duration (min)', 'Ожидаемая длительность (мин)'),
                        sortOrder: 5,
                        validationRules: { min: 1 }
                    },
                    {
                        codename: 'AccessLinkSlug',
                        dataType: 'STRING',
                        name: vlc('Access Link Slug', 'Слаг ссылки доступа'),
                        sortOrder: 6,
                        validationRules: { maxLength: 255 }
                    },
                    {
                        codename: 'ContentItems',
                        dataType: 'TABLE',
                        name: vlc('Content Items', 'Элементы контента'),
                        sortOrder: 7,
                        childAttributes: [
                            {
                                codename: 'ItemType',
                                dataType: 'REF',
                                name: vlc('Item Type', 'Тип элемента'),
                                isRequired: true,
                                sortOrder: 1,
                                targetEntityCodename: 'ContentType',
                                targetEntityKind: 'enumeration'
                            },
                            {
                                codename: 'ItemTitle',
                                dataType: 'STRING',
                                name: vlc('Item Title', 'Заголовок элемента'),
                                sortOrder: 2,
                                validationRules: { maxLength: 500, localized: true, versioned: true }
                            },
                            {
                                codename: 'ItemContent',
                                dataType: 'STRING',
                                name: vlc('Item Content', 'Содержимое элемента'),
                                sortOrder: 3,
                                validationRules: { localized: true, versioned: true }
                            },
                            {
                                codename: 'QuizId',
                                dataType: 'STRING',
                                name: vlc('Quiz ID', 'ID теста'),
                                sortOrder: 4
                            },
                            {
                                codename: 'SortOrder',
                                dataType: 'NUMBER',
                                name: vlc('Sort Order', 'Порядок'),
                                sortOrder: 5
                            }
                        ]
                    }
                ]
            },
            {
                codename: 'Quizzes',
                kind: 'catalog',
                name: vlc('Quizzes', 'Тесты'),
                description: vlc('Quiz assessments with questions stored as JSON.', 'Тестовые задания с вопросами, хранящимися как JSON.'),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    },
                    {
                        codename: 'Description',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 2,
                        validationRules: { localized: true, versioned: true }
                    },
                    {
                        codename: 'PassingScorePercent',
                        dataType: 'NUMBER',
                        name: vlc('Passing Score %', 'Проходной балл %'),
                        sortOrder: 3,
                        validationRules: { min: 0, max: 100 }
                    },
                    {
                        codename: 'MaxAttempts',
                        dataType: 'NUMBER',
                        name: vlc('Max Attempts', 'Макс. попыток'),
                        sortOrder: 4,
                        validationRules: { min: 1 }
                    },
                    {
                        codename: 'Questions',
                        dataType: 'TABLE',
                        name: vlc('Questions', 'Вопросы'),
                        sortOrder: 5,
                        childAttributes: [
                            {
                                codename: 'Prompt',
                                dataType: 'STRING',
                                name: vlc('Prompt', 'Текст вопроса'),
                                isRequired: true,
                                sortOrder: 1,
                                validationRules: { localized: true, versioned: true }
                            },
                            {
                                codename: 'QuestionDescription',
                                dataType: 'STRING',
                                name: vlc('Description', 'Описание'),
                                sortOrder: 2,
                                validationRules: { localized: true, versioned: true }
                            },
                            {
                                codename: 'QuestionType',
                                dataType: 'REF',
                                name: vlc('Question Type', 'Тип вопроса'),
                                isRequired: true,
                                sortOrder: 3,
                                targetEntityCodename: 'QuestionType',
                                targetEntityKind: 'enumeration'
                            },
                            {
                                codename: 'Difficulty',
                                dataType: 'NUMBER',
                                name: vlc('Difficulty', 'Сложность'),
                                sortOrder: 4,
                                validationRules: { min: 1, max: 5 }
                            },
                            {
                                codename: 'Explanation',
                                dataType: 'STRING',
                                name: vlc('Explanation', 'Пояснение'),
                                sortOrder: 5,
                                validationRules: { localized: true, versioned: true }
                            },
                            {
                                codename: 'Options',
                                dataType: 'JSON',
                                name: vlc('Options', 'Варианты ответов'),
                                sortOrder: 6
                            },
                            {
                                codename: 'SortOrder',
                                dataType: 'NUMBER',
                                name: vlc('Sort Order', 'Порядок'),
                                sortOrder: 7
                            }
                        ]
                    }
                ]
            },
            {
                codename: 'QuizResponses',
                kind: 'catalog',
                name: vlc('Quiz Responses', 'Ответы на тесты'),
                description: vlc('Individual quiz answer records for scoring.', 'Записи ответов на тесты для подсчёта баллов.'),
                attributes: [
                    {
                        codename: 'StudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'QuizId',
                        dataType: 'REF',
                        name: vlc('Quiz', 'Тест'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'Quizzes',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'QuestionId',
                        dataType: 'STRING',
                        name: vlc('Question ID', 'ID вопроса'),
                        isRequired: true,
                        sortOrder: 3
                    },
                    {
                        codename: 'SelectedOptionIds',
                        dataType: 'JSON',
                        name: vlc('Selected Options', 'Выбранные варианты'),
                        sortOrder: 4
                    },
                    {
                        codename: 'IsCorrect',
                        dataType: 'BOOLEAN',
                        name: vlc('Is Correct', 'Правильно'),
                        sortOrder: 5
                    },
                    {
                        codename: 'AttemptNumber',
                        dataType: 'NUMBER',
                        name: vlc('Attempt Number', 'Номер попытки'),
                        sortOrder: 6,
                        validationRules: { min: 1 }
                    },
                    {
                        codename: 'SubmittedAt',
                        dataType: 'DATE',
                        name: vlc('Submitted At', 'Отправлено'),
                        sortOrder: 7
                    }
                ]
            },
            {
                codename: 'ModuleProgress',
                kind: 'catalog',
                name: vlc('Module Progress', 'Прогресс по модулям'),
                description: vlc('Per-student module completion tracking.', 'Отслеживание прохождения модулей по студентам.'),
                attributes: [
                    {
                        codename: 'ProgressStudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ModuleId',
                        dataType: 'REF',
                        name: vlc('Module', 'Модуль'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'Modules',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ProgressStatus',
                        dataType: 'STRING',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 3,
                        validationRules: { maxLength: 30 }
                    },
                    {
                        codename: 'ProgressPercent',
                        dataType: 'NUMBER',
                        name: vlc('Progress %', 'Прогресс %'),
                        sortOrder: 4,
                        validationRules: { min: 0, max: 100 }
                    },
                    {
                        codename: 'StartedAt',
                        dataType: 'DATE',
                        name: vlc('Started At', 'Начато'),
                        sortOrder: 5
                    },
                    {
                        codename: 'CompletedAt',
                        dataType: 'DATE',
                        name: vlc('Completed At', 'Завершено'),
                        sortOrder: 6
                    },
                    {
                        codename: 'LastAccessedItemIndex',
                        dataType: 'NUMBER',
                        name: vlc('Last Accessed Item', 'Последний элемент'),
                        sortOrder: 7
                    }
                ]
            },
            {
                codename: 'AccessLinks',
                kind: 'catalog',
                name: vlc('Access Links', 'Ссылки доступа'),
                description: vlc(
                    'Direct access links and QR codes for modules and quizzes.',
                    'Прямые ссылки и QR-коды для модулей и тестов.'
                ),
                attributes: [
                    {
                        codename: 'Slug',
                        dataType: 'STRING',
                        name: vlc('Slug', 'Слаг'),
                        isRequired: true,
                        isDisplayAttribute: true,
                        sortOrder: 1,
                        validationRules: { maxLength: 255 }
                    },
                    {
                        codename: 'TargetType',
                        dataType: 'STRING',
                        name: vlc('Target Type', 'Тип цели'),
                        isRequired: true,
                        sortOrder: 2,
                        validationRules: { maxLength: 30 }
                    },
                    {
                        codename: 'TargetId',
                        dataType: 'STRING',
                        name: vlc('Target ID', 'ID цели'),
                        isRequired: true,
                        sortOrder: 3
                    },
                    {
                        codename: 'LinkClassId',
                        dataType: 'REF',
                        name: vlc('Class', 'Класс'),
                        sortOrder: 4,
                        targetEntityCodename: 'Classes',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'IsActive',
                        dataType: 'BOOLEAN',
                        name: vlc('Is Active', 'Активна'),
                        sortOrder: 5
                    },
                    {
                        codename: 'ExpiresAt',
                        dataType: 'DATE',
                        name: vlc('Expires At', 'Истекает'),
                        sortOrder: 6
                    },
                    {
                        codename: 'MaxUses',
                        dataType: 'NUMBER',
                        name: vlc('Max Uses', 'Макс. использований'),
                        sortOrder: 7,
                        validationRules: { min: 1 }
                    },
                    {
                        codename: 'UseCount',
                        dataType: 'NUMBER',
                        name: vlc('Use Count', 'Счётчик'),
                        sortOrder: 8,
                        validationRules: { min: 0 }
                    },
                    {
                        codename: 'LinkTitle',
                        dataType: 'STRING',
                        name: vlc('Title', 'Заголовок'),
                        sortOrder: 9,
                        validationRules: { maxLength: 500, localized: true, versioned: true }
                    }
                ]
            },
            {
                codename: 'Enrollments',
                kind: 'catalog',
                name: vlc('Enrollments', 'Записи'),
                description: vlc('Class-student-module enrollment bridge.', 'Связь класс-студент-модуль.'),
                attributes: [
                    {
                        codename: 'EnrollmentStudentId',
                        dataType: 'REF',
                        name: vlc('Student', 'Студент'),
                        isRequired: true,
                        sortOrder: 1,
                        targetEntityCodename: 'Students',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'EnrollmentClassId',
                        dataType: 'REF',
                        name: vlc('Class', 'Класс'),
                        isRequired: true,
                        sortOrder: 2,
                        targetEntityCodename: 'Classes',
                        targetEntityKind: 'catalog'
                    },
                    {
                        codename: 'ModuleIdRef',
                        dataType: 'STRING',
                        name: vlc('Module ID', 'ID модуля'),
                        isRequired: true,
                        sortOrder: 3
                    },
                    {
                        codename: 'EnrollmentStatus',
                        dataType: 'REF',
                        name: vlc('Status', 'Статус'),
                        isRequired: true,
                        sortOrder: 4,
                        targetEntityCodename: 'EnrollmentStatus',
                        targetEntityKind: 'enumeration'
                    },
                    {
                        codename: 'EnrolledAt',
                        dataType: 'DATE',
                        name: vlc('Enrolled At', 'Записан'),
                        isRequired: true,
                        sortOrder: 5
                    },
                    {
                        codename: 'CompletedAt',
                        dataType: 'DATE',
                        name: vlc('Completed At', 'Завершено'),
                        sortOrder: 6
                    },
                    {
                        codename: 'Score',
                        dataType: 'NUMBER',
                        name: vlc('Score', 'Балл'),
                        sortOrder: 7
                    }
                ]
            },
            {
                codename: 'ModuleStatus',
                kind: 'enumeration',
                name: vlc('Module Status', 'Статус модуля'),
                description: vlc('Status values for learning modules.', 'Значения статуса учебных модулей.')
            },
            {
                codename: 'EnrollmentStatus',
                kind: 'enumeration',
                name: vlc('Enrollment Status', 'Статус записи'),
                description: vlc('Status values for student enrollments.', 'Значения статуса записей студентов.')
            },
            {
                codename: 'QuestionType',
                kind: 'enumeration',
                name: vlc('Question Type', 'Тип вопроса'),
                description: vlc('Types of quiz questions.', 'Типы вопросов теста.')
            },
            {
                codename: 'ContentType',
                kind: 'enumeration',
                name: vlc('Content Type', 'Тип контента'),
                description: vlc('Types of content items in modules.', 'Типы элементов контента в модулях.')
            }
        ],
        optionValues: {
            ModuleStatus: [
                { codename: 'Draft', name: vlc('Draft', 'Черновик'), sortOrder: 1 },
                { codename: 'Published', name: vlc('Published', 'Опубликовано'), sortOrder: 2, isDefault: true },
                { codename: 'Archived', name: vlc('Archived', 'Архив'), sortOrder: 3 }
            ],
            EnrollmentStatus: [
                { codename: 'Invited', name: vlc('Invited', 'Приглашён'), sortOrder: 1 },
                { codename: 'Active', name: vlc('Active', 'Активен'), sortOrder: 2, isDefault: true },
                { codename: 'Completed', name: vlc('Completed', 'Завершён'), sortOrder: 3 },
                { codename: 'Dropped', name: vlc('Dropped', 'Покинул'), sortOrder: 4 }
            ],
            QuestionType: [
                { codename: 'SingleChoice', name: vlc('Single Choice', 'Одиночный выбор'), sortOrder: 1, isDefault: true },
                { codename: 'MultipleChoice', name: vlc('Multiple Choice', 'Множественный выбор'), sortOrder: 2 }
            ],
            ContentType: [
                { codename: 'Text', name: vlc('Text', 'Текст'), sortOrder: 1, isDefault: true },
                { codename: 'Image', name: vlc('Image', 'Изображение'), sortOrder: 2 },
                { codename: 'VideoUrl', name: vlc('Video URL', 'URL видео'), sortOrder: 3 },
                { codename: 'QuizRef', name: vlc('Quiz Reference', 'Ссылка на тест'), sortOrder: 4 }
            ]
        },
        settings: [
            { key: 'general.language', value: { _value: 'system' } },
            { key: 'general.timezone', value: { _value: 'UTC' } },
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'general.codenameAutoConvertMixedAlphabets', value: { _value: true } },
            { key: 'general.codenameAutoReformat', value: { _value: true } },
            { key: 'general.codenameRequireReformat', value: { _value: true } },
            { key: 'entity.catalog.allowAttributeCopy', value: { _value: true } },
            { key: 'entity.catalog.allowAttributeDelete', value: { _value: true } },
            { key: 'entity.catalog.allowDeleteLastDisplayAttribute', value: { _value: true } }
        ]
    }
}
