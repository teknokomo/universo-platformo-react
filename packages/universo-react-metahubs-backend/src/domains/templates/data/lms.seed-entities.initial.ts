import type { LmsTemplateEntity } from './lms.seed-entity-helpers'
import { enrichConfigWithVlcTimestamps, vlc } from './basic.template'
import {
    LMS_ADDITIONAL_LEDGER_ENTITIES,
    buildEditorHeaderBlock,
    buildEditorParagraphBlock,
    buildLmsPageEntity
} from './lms.seed-entity-helpers'

export const lmsSeedInitialEntities: LmsTemplateEntity[] = [
    {
        codename: 'Learning',
        kind: 'hub',
        name: vlc('Learning', 'Обучение'),
        description: vlc('Root learning navigation hub for LMS resources.', 'Корневой учебный хаб для навигации по ресурсам LMS.')
    },
    {
        codename: 'LmsConfiguration',
        kind: 'set',
        name: vlc('LMS Configuration', 'Настройки LMS'),
        description: vlc(
            'Shared constants that drive default LMS behavior across workspaces.',
            'Общие константы, которые задают базовое поведение LMS во всех рабочих пространствах.'
        ),
        fixedValues: [
            {
                codename: 'DefaultPassingScore',
                dataType: 'NUMBER',
                name: vlc('Default Passing Score', 'Проходной балл по умолчанию'),
                sortOrder: 1,
                value: 80
            },
            {
                codename: 'CertificateValidityDays',
                dataType: 'NUMBER',
                name: vlc('Certificate Validity Days', 'Срок действия сертификата в днях'),
                sortOrder: 2,
                value: 365
            },
            {
                codename: 'AutoEnrollEnabled',
                dataType: 'BOOLEAN',
                name: vlc('Auto Enroll Enabled', 'Автозачисление включено'),
                sortOrder: 3,
                value: false
            },
            {
                codename: 'SupportEmail',
                dataType: 'STRING',
                name: vlc('Support Email', 'Email поддержки'),
                sortOrder: 4,
                value: ''
            },
            {
                codename: 'GamificationEnabled',
                dataType: 'BOOLEAN',
                name: vlc('Gamification Enabled', 'Геймификация включена'),
                sortOrder: 5,
                value: true
            },
            {
                codename: 'DefaultPointAward',
                dataType: 'NUMBER',
                name: vlc('Default Point Award', 'Баллы по умолчанию'),
                sortOrder: 6,
                value: 10
            }
        ]
    },
    {
        codename: 'LearningContentDefaults',
        kind: 'set',
        name: vlc('Learning Content Defaults', 'Настройки учебного контента'),
        description: vlc(
            'Default workspace authoring behavior for Learning Content projects, resources, courses, and tracks.',
            'Поведение по умолчанию для проектов, ресурсов, курсов и треков учебного контента в рабочем пространстве.'
        ),
        fixedValues: [
            {
                codename: 'DefaultContentView',
                dataType: 'STRING',
                name: vlc('Default Content View', 'Представление по умолчанию'),
                sortOrder: 1,
                value: 'table'
            },
            {
                codename: 'DefaultPublicationStatus',
                dataType: 'STRING',
                name: vlc('Default Publication Status', 'Статус публикации по умолчанию'),
                sortOrder: 2,
                value: 'Draft'
            },
            {
                codename: 'AllowWorkspaceAuthorsToCreateProjects',
                dataType: 'BOOLEAN',
                name: vlc('Allow Workspace Authors to Create Projects', 'Разрешить авторам создавать проекты'),
                sortOrder: 3,
                value: true
            }
        ]
    },
    {
        codename: 'SupportedResourceTypes',
        kind: 'set',
        name: vlc('Supported Resource Types', 'Поддерживаемые типы ресурсов'),
        description: vlc(
            'Resource type support policy for early Learning Content authoring.',
            'Политика поддержки типов ресурсов для раннего создания учебного контента.'
        ),
        fixedValues: [
            {
                codename: 'EnabledTypes',
                dataType: 'STRING',
                name: vlc('Enabled Types', 'Включенные типы'),
                sortOrder: 1,
                value: 'Page,Url,Embed'
            },
            {
                codename: 'DeferredTypes',
                dataType: 'STRING',
                name: vlc('Deferred Types', 'Отложенные типы'),
                sortOrder: 2,
                value: 'Scorm,Xapi,File,Video,Audio,Document'
            }
        ]
    },
    {
        codename: 'PlayerPresets',
        kind: 'set',
        name: vlc('Player Presets', 'Пресеты плеера'),
        description: vlc(
            'Default learner player behavior reused by courses and learning tracks.',
            'Поведение плеера учащегося по умолчанию, используемое курсами и учебными треками.'
        ),
        fixedValues: [
            {
                codename: 'DefaultCoursePlayer',
                dataType: 'STRING',
                name: vlc('Default Course Player', 'Плеер курса по умолчанию'),
                sortOrder: 1,
                value: 'showOutline=true;allowSearch=true;showProgress=true;allowManualComplete=true'
            }
        ]
    },
    {
        codename: 'LearningContentColumnPresets',
        kind: 'set',
        name: vlc('Learning Content Column Presets', 'Пресеты колонок учебного контента'),
        description: vlc(
            'Reusable metadata-driven column presets for Learning Content list surfaces.',
            'Переиспользуемые metadata-driven пресеты колонок для списков учебного контента.'
        ),
        fixedValues: [
            {
                codename: 'DefaultLibraryColumns',
                dataType: 'STRING',
                name: vlc('Default Library Columns', 'Колонки библиотеки по умолчанию'),
                sortOrder: 1,
                value: 'type,title,status,ResourceType'
            }
        ]
    },
    {
        codename: 'EnrollmentDefaults',
        kind: 'set',
        name: vlc('Enrollment Defaults', 'Настройки назначений'),
        description: vlc(
            'Default manual enrollment parameters for courses and tracks.',
            'Параметры ручных назначений по умолчанию для курсов и треков.'
        ),
        fixedValues: [
            {
                codename: 'DefaultDueDateMode',
                dataType: 'STRING',
                name: vlc('Default Due Date Mode', 'Режим срока по умолчанию'),
                sortOrder: 1,
                value: 'NoDueDate'
            },
            {
                codename: 'RestrictAfterDueDate',
                dataType: 'BOOLEAN',
                name: vlc('Restrict After Due Date', 'Ограничить после срока'),
                sortOrder: 2,
                value: false
            }
        ]
    },
    {
        codename: 'CompletionDefaults',
        kind: 'set',
        name: vlc('Completion Defaults', 'Настройки завершения'),
        description: vlc(
            'Default completion policies for courses and learning tracks.',
            'Политики завершения по умолчанию для курсов и учебных треков.'
        ),
        fixedValues: [
            {
                codename: 'CourseNavigationMode',
                dataType: 'STRING',
                name: vlc('Course Navigation Mode', 'Режим навигации курса'),
                sortOrder: 1,
                value: 'free'
            },
            {
                codename: 'CourseCompletionCondition',
                dataType: 'STRING',
                name: vlc('Course Completion Condition', 'Условие завершения курса'),
                sortOrder: 2,
                value: 'allItems'
            },
            {
                codename: 'TrackOrderMode',
                dataType: 'STRING',
                name: vlc('Track Order Mode', 'Режим порядка трека'),
                sortOrder: 3,
                value: 'sequential'
            }
        ]
    },
    {
        codename: 'LearnerHome',
        kind: 'page',
        name: vlc('Welcome', 'Добро пожаловать'),
        description: vlc(
            'Full LMS landing page with structured onboarding content.',
            'Полная стартовая страница LMS со структурированным вводным контентом.'
        ),
        hubs: ['Learning'],
        config: enrichConfigWithVlcTimestamps({
            blockContent: {
                format: 'editorjs',
                version: '2.29.0',
                blocks: [
                    {
                        id: 'welcome-title',
                        type: 'header',
                        data: {
                            level: 2,
                            text: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Welcome to your learning portal', version: 1, isActive: true },
                                    ru: { content: 'Добро пожаловать в учебный портал', version: 1, isActive: true }
                                }
                            }
                        }
                    },
                    {
                        id: 'welcome-intro',
                        type: 'paragraph',
                        data: {
                            text: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: {
                                        content:
                                            'This portal brings together the learning paths, content resources, assignments, tests, and progress indicators that learners need every day. Start with your assigned content, continue from the last opened activity, and use the content library to find approved materials for independent study.',
                                        version: 1,
                                        isActive: true
                                    },
                                    ru: {
                                        content:
                                            'Этот портал объединяет учебные траектории, учебные ресурсы, задания, тесты и показатели прогресса, которые нужны учащимся каждый день. Начните с назначенного контента, продолжите обучение с последнего открытого материала и используйте библиотеку контента для самостоятельного изучения утвержденных материалов.',
                                        version: 1,
                                        isActive: true
                                    }
                                }
                            }
                        }
                    },
                    {
                        id: 'welcome-how-to-start-title',
                        type: 'header',
                        data: {
                            level: 3,
                            text: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'How to start', version: 1, isActive: true },
                                    ru: { content: 'Как начать', version: 1, isActive: true }
                                }
                            }
                        }
                    },
                    {
                        id: 'welcome-how-to-start-list',
                        type: 'list',
                        data: {
                            style: 'unordered',
                            items: [
                                {
                                    _schema: '1',
                                    _primary: 'en',
                                    locales: {
                                        en: {
                                            content:
                                                'Open Learning Content to review available courses, resources, and knowledge-base materials.',
                                            version: 1,
                                            isActive: true
                                        },
                                        ru: {
                                            content:
                                                'Откройте учебный контент, чтобы посмотреть доступные курсы, ресурсы и материалы базы знаний.',
                                            version: 1,
                                            isActive: true
                                        }
                                    }
                                },
                                {
                                    _schema: '1',
                                    _primary: 'en',
                                    locales: {
                                        en: {
                                            content:
                                                'Use assignments and progress pages to understand what has already been completed and what requires attention.',
                                            version: 1,
                                            isActive: true
                                        },
                                        ru: {
                                            content:
                                                'Используйте страницы назначений и прогресса, чтобы понимать, что уже выполнено и что требует внимания.',
                                            version: 1,
                                            isActive: true
                                        }
                                    }
                                },
                                {
                                    _schema: '1',
                                    _primary: 'en',
                                    locales: {
                                        en: {
                                            content:
                                                'Complete tests and practical tasks inside learning resources so that managers can track learning outcomes.',
                                            version: 1,
                                            isActive: true
                                        },
                                        ru: {
                                            content:
                                                'Проходите тесты и практические задания в учебных ресурсах, чтобы руководители могли отслеживать результаты обучения.',
                                            version: 1,
                                            isActive: true
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    {
                        id: 'welcome-workspaces-title',
                        type: 'header',
                        data: {
                            level: 3,
                            text: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Workspaces', version: 1, isActive: true },
                                    ru: { content: 'Рабочие пространства', version: 1, isActive: true }
                                }
                            }
                        }
                    },
                    {
                        id: 'welcome-workspaces',
                        type: 'paragraph',
                        data: {
                            text: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: {
                                        content:
                                            'Workspaces separate personal learning, team learning, and shared training areas. The main workspace is created automatically, and additional workspaces can be added later when a team needs isolated content, members, and reporting.',
                                        version: 1,
                                        isActive: true
                                    },
                                    ru: {
                                        content:
                                            'Рабочие пространства разделяют личное обучение, обучение команд и общие учебные области. Основное рабочее пространство создается автоматически, а дополнительные рабочие пространства можно добавить позже, когда команде понадобятся отдельные материалы, участники и отчеты.',
                                        version: 1,
                                        isActive: true
                                    }
                                }
                            }
                        }
                    },
                    {
                        id: 'welcome-support',
                        type: 'paragraph',
                        data: {
                            text: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: {
                                        content:
                                            'If you cannot find an assigned content, check the knowledge section first and then contact the learning administrator. The support address and common LMS rules are stored in the shared configuration set, so they can be updated without changing page content.',
                                        version: 1,
                                        isActive: true
                                    },
                                    ru: {
                                        content:
                                            'Если назначенный контент не найден, сначала проверьте раздел знаний, а затем обратитесь к администратору обучения. Адрес поддержки и общие правила LMS хранятся в общем наборе настроек, поэтому их можно обновлять без изменения контента страницы.',
                                        version: 1,
                                        isActive: true
                                    }
                                }
                            }
                        }
                    }
                ]
            },
            runtime: {
                menuVisibility: 'primary',
                routeSegment: 'home',
                icon: 'home'
            }
        })
    },
    buildLmsPageEntity({
        codename: 'CourseOverview',
        nameEn: 'Course Overview',
        nameRu: 'Обзор курса',
        descriptionEn: 'Reusable course overview page for published LMS workspaces.',
        descriptionRu: 'Переиспользуемая страница обзора курса для опубликованных LMS-пространств.',
        routeSegment: 'course-overview',
        icon: 'analytics',
        blocks: [
            buildEditorHeaderBlock('course-overview-title', 2, 'Course overview', 'Обзор курса'),
            buildEditorParagraphBlock(
                'course-overview-purpose',
                'Use this page to present the learning goal, target audience, prerequisites, completion rules, and expected outcomes for a course or learning track.',
                'Используйте эту страницу, чтобы описать учебную цель, аудиторию, предварительные требования, правила завершения и ожидаемые результаты курса или учебного трека.'
            ),
            buildEditorHeaderBlock('course-overview-path-title', 3, 'Learning path', 'Учебная траектория'),
            buildEditorParagraphBlock(
                'course-overview-path',
                'Course structure should be driven by Learning Resources, Learning Tracks, Assignments, Quizzes, and transactional progress records. The page stays informational while completion state is calculated from Learning Content records and Ledgers.',
                'Структура курса должна задаваться учебными ресурсами, учебными треками, назначениями, тестами и транзакционными записями прогресса. Страница остается информационной, а состояние прохождения рассчитывается по записям контента и регистрам.'
            )
        ]
    }),
    buildLmsPageEntity({
        codename: 'KnowledgeHome',
        nameEn: 'Knowledge Home',
        nameRu: 'Раздел знаний',
        descriptionEn: 'Portal page for knowledge-base spaces, folders, articles, and learner bookmarks.',
        descriptionRu: 'Портальная страница для пространств знаний, папок, статей и закладок учащихся.',
        routeSegment: 'knowledge',
        icon: 'apps',
        blocks: [
            buildEditorHeaderBlock('knowledge-home-title', 2, 'Knowledge base', 'База знаний'),
            buildEditorParagraphBlock(
                'knowledge-home-purpose',
                'Use this page as the learner-facing entry point for approved reference materials. Knowledge spaces, folders, article bindings, and bookmarks are stored as records so they can be filtered by workspace and role policy.',
                'Используйте эту страницу как вход учащегося в утвержденные справочные материалы. Пространства знаний, папки, привязки статей и закладки хранятся как записи, поэтому их можно фильтровать по рабочему пространству и политике ролей.'
            ),
            buildEditorHeaderBlock('knowledge-home-structure-title', 3, 'Structure', 'Структура'),
            buildEditorParagraphBlock(
                'knowledge-home-structure',
                'KnowledgeSpaces define ownership and visibility, KnowledgeFolders organize article pages, and KnowledgeBookmarks preserve each learner’s saved references without duplicating article content.',
                'KnowledgeSpaces задают владение и видимость, KnowledgeFolders организуют страницы статей, а KnowledgeBookmarks сохраняют личные ссылки учащегося без дублирования содержимого статей.'
            )
        ]
    }),
    buildLmsPageEntity({
        codename: 'KnowledgeArticle',
        nameEn: 'Knowledge Article',
        nameRu: 'Статья базы знаний',
        descriptionEn: 'Reusable knowledge-base article page for learning materials.',
        descriptionRu: 'Переиспользуемая статья базы знаний для учебных материалов.',
        routeSegment: 'knowledge-article',
        icon: 'page',
        blocks: [
            buildEditorHeaderBlock('knowledge-article-title', 2, 'Knowledge article', 'Статья базы знаний'),
            buildEditorParagraphBlock(
                'knowledge-article-summary',
                'Use this page for reference material that supports learning resources, assignments, and instructor-led events. Keep facts, examples, and source links in the article, and keep operational state in content records and Ledgers.',
                'Используйте эту страницу для справочных материалов, которые поддерживают учебные ресурсы, задания и учебные мероприятия. Факты, примеры и ссылки на источники храните в статье, а операционное состояние — в записях контента и регистрах.'
            ),
            buildEditorHeaderBlock('knowledge-article-maintenance-title', 3, 'Maintenance', 'Сопровождение'),
            buildEditorParagraphBlock(
                'knowledge-article-maintenance',
                'Versioned localized content makes it possible to update the article without changing learner progress, assignment history, or certificate facts.',
                'Версионируемый локализованный контент позволяет обновлять статью без изменения прогресса учащихся, истории назначений или фактов сертификатов.'
            )
        ]
    }),
    buildLmsPageEntity({
        codename: 'DevelopmentHome',
        nameEn: 'Development Home',
        nameRu: 'Раздел развития',
        descriptionEn: 'Portal page for development plans, stages, tasks, mentors, and monitors.',
        descriptionRu: 'Портальная страница для планов развития, этапов, задач, наставников и наблюдателей.',
        routeSegment: 'development',
        icon: 'tasks',
        blocks: [
            buildEditorHeaderBlock('development-home-title', 2, 'Development plans', 'Планы развития'),
            buildEditorParagraphBlock(
                'development-home-purpose',
                'Use this page as the employee-facing entry point for individual development plans. Plan records define ownership and status, stages group milestones, and tasks hold actionable work with workflow status changes.',
                'Используйте эту страницу как вход сотрудника в индивидуальные планы развития. Записи планов задают владельца и состояние, этапы группируют вехи, а задачи содержат практическую работу со сменой статусов процесса.'
            ),
            buildEditorHeaderBlock('development-home-operations-title', 3, 'Operations', 'Операции'),
            buildEditorParagraphBlock(
                'development-home-operations',
                'Development plan progress should be calculated from DevelopmentPlans, DevelopmentPlanStages, and DevelopmentPlanTasks instead of custom LMS screens, so reports and dashboards can reuse generic runtime datasources.',
                'Прогресс плана развития должен рассчитываться по DevelopmentPlans, DevelopmentPlanStages и DevelopmentPlanTasks вместо специальных LMS-экранов, чтобы отчеты и панели использовали универсальные runtime-источники данных.'
            )
        ]
    }),
    buildLmsPageEntity({
        codename: 'AssignmentInstructions',
        nameEn: 'Assignment Instructions',
        nameRu: 'Инструкции к заданию',
        descriptionEn: 'Reusable instructions page for practical LMS assignments.',
        descriptionRu: 'Переиспользуемая страница инструкций для практических заданий LMS.',
        routeSegment: 'assignment-instructions',
        icon: 'school',
        blocks: [
            buildEditorHeaderBlock('assignment-instructions-title', 2, 'Assignment instructions', 'Инструкции к заданию'),
            buildEditorParagraphBlock(
                'assignment-instructions-rules',
                'Describe the expected deliverable, due-date policy, review criteria, allowed file formats, and resubmission rules. Individual submissions are stored in AssignmentSubmissions and posted to the configured Ledgers.',
                'Опишите ожидаемый результат, правила срока сдачи, критерии проверки, допустимые форматы файлов и правила повторной отправки. Индивидуальные сдачи хранятся в AssignmentSubmissions и проводятся в настроенные регистры.'
            ),
            buildEditorHeaderBlock('assignment-instructions-review-title', 3, 'Review result', 'Результат проверки'),
            buildEditorParagraphBlock(
                'assignment-instructions-review',
                'Reviewers should record status, score, and feedback on the submission record so reports and dashboards can use the same generic datasource and Ledger model.',
                'Проверяющие должны фиксировать статус, балл и обратную связь в записи сдачи, чтобы отчеты и панели использовали одну и ту же универсальную модель источников данных и регистров.'
            )
        ]
    }),
    buildLmsPageEntity({
        codename: 'CertificatePolicy',
        nameEn: 'Certificate Policy',
        nameRu: 'Правила сертификатов',
        descriptionEn: 'Reusable certificate policy page for completion and revocation rules.',
        descriptionRu: 'Переиспользуемая страница правил сертификатов для завершения и отзыва.',
        routeSegment: 'certificate-policy',
        icon: 'star',
        blocks: [
            buildEditorHeaderBlock('certificate-policy-title', 2, 'Certificate policy', 'Правила сертификатов'),
            buildEditorParagraphBlock(
                'certificate-policy-eligibility',
                'Certificates should be issued only after required learning resources, assignments, and quiz attempts meet the configured completion thresholds. The policy text explains the rule; CertificateIssues and CertificateLedger store the auditable facts.',
                'Сертификаты следует выдавать только после того, как обязательные учебные ресурсы, задания и попытки тестов достигли настроенных порогов завершения. Текст правил объясняет условие, а CertificateIssues и CertificateLedger хранят проверяемые факты.'
            ),
            buildEditorHeaderBlock('certificate-policy-lifecycle-title', 3, 'Lifecycle', 'Жизненный цикл'),
            buildEditorParagraphBlock(
                'certificate-policy-lifecycle',
                'Issue, expiration, and revocation should be represented as transactional records so workspace administrators can audit changes without editing historical completion data.',
                'Выдача, истечение срока и отзыв должны представляться транзакционными записями, чтобы администраторы пространства могли проверять изменения без редактирования исторических данных завершения.'
            )
        ]
    }),
    {
        codename: 'ProgressLedger',
        kind: 'object',
        name: vlc('Progress Ledger', 'Регистр прогресса'),
        description: vlc(
            'Append-only progress facts by learner and learning item.',
            'Неизменяемые факты прогресса по учащемуся и учебному элементу.'
        ),
        hubs: ['Learning'],
        config: {
            ledger: {
                mode: 'balance',
                mutationPolicy: 'appendOnly',
                periodicity: 'instant',
                sourcePolicy: 'registrar',
                registrarKinds: ['object'],
                fieldRoles: [
                    { fieldCodename: 'Learner', role: 'dimension', required: true },
                    { fieldCodename: 'LearningItem', role: 'dimension', required: true },
                    { fieldCodename: 'ProgressDelta', role: 'resource', aggregate: 'sum', required: true },
                    { fieldCodename: 'Status', role: 'component' },
                    { fieldCodename: 'OccurredAt', role: 'component' },
                    { fieldCodename: 'SourceObjectId', role: 'component' },
                    { fieldCodename: 'SourceRowId', role: 'component' },
                    { fieldCodename: 'SourceLineId', role: 'component' }
                ],
                projections: [
                    {
                        codename: 'ProgressByLearner',
                        kind: 'balance',
                        dimensions: ['Learner', 'LearningItem'],
                        resources: ['ProgressDelta'],
                        period: 'none'
                    }
                ],
                idempotency: {
                    keyFields: ['source_object_id', 'source_row_id', 'source_line_id']
                }
            }
        },
        components: [
            { codename: 'Learner', dataType: 'STRING', name: vlc('Learner', 'Учащийся'), sortOrder: 1, isRequired: true },
            {
                codename: 'LearningItem',
                dataType: 'STRING',
                name: vlc('Learning Item', 'Учебный элемент'),
                sortOrder: 2,
                isRequired: true
            },
            {
                codename: 'ProgressDelta',
                dataType: 'NUMBER',
                name: vlc('Progress Delta', 'Изменение прогресса'),
                sortOrder: 3,
                isRequired: true
            },
            { codename: 'Status', dataType: 'STRING', name: vlc('Status', 'Статус'), sortOrder: 4 },
            {
                codename: 'OccurredAt',
                dataType: 'DATE',
                name: vlc('Occurred At', 'Дата события'),
                sortOrder: 5,
                validationRules: { dateComposition: 'datetime' }
            },
            { codename: 'SourceObjectId', dataType: 'STRING', name: vlc('Source Object ID', 'ID объекта-источника'), sortOrder: 6 },
            { codename: 'SourceRowId', dataType: 'STRING', name: vlc('Source Row ID', 'ID строки-источника'), sortOrder: 7 },
            {
                codename: 'SourceLineId',
                dataType: 'STRING',
                name: vlc('Source Line ID', 'ID строки движения'),
                sortOrder: 8
            }
        ]
    },
    {
        codename: 'ScoreLedger',
        kind: 'object',
        name: vlc('Score Ledger', 'Регистр оценок'),
        description: vlc('Append-only quiz and assignment score facts.', 'Неизменяемые факты оценок тестов и заданий.'),
        hubs: ['Learning'],
        config: {
            ledger: {
                mode: 'balance',
                mutationPolicy: 'appendOnly',
                periodicity: 'instant',
                sourcePolicy: 'registrar',
                registrarKinds: ['object'],
                fieldRoles: [
                    { fieldCodename: 'Learner', role: 'dimension', required: true },
                    { fieldCodename: 'Assessment', role: 'dimension', required: true },
                    { fieldCodename: 'Score', role: 'resource', aggregate: 'latest', required: true },
                    { fieldCodename: 'Passed', role: 'component' },
                    { fieldCodename: 'OccurredAt', role: 'component' },
                    { fieldCodename: 'SourceObjectId', role: 'component' },
                    { fieldCodename: 'SourceRowId', role: 'component' },
                    { fieldCodename: 'SourceLineId', role: 'component' }
                ],
                projections: [
                    {
                        codename: 'LatestScoreByAssessment',
                        kind: 'latest',
                        dimensions: ['Learner', 'Assessment'],
                        resources: ['Score'],
                        period: 'none'
                    }
                ],
                idempotency: {
                    keyFields: ['source_object_id', 'source_row_id', 'source_line_id']
                }
            }
        },
        components: [
            { codename: 'Learner', dataType: 'STRING', name: vlc('Learner', 'Учащийся'), sortOrder: 1, isRequired: true },
            { codename: 'Assessment', dataType: 'STRING', name: vlc('Assessment', 'Оценивание'), sortOrder: 2, isRequired: true },
            { codename: 'Score', dataType: 'NUMBER', name: vlc('Score', 'Балл'), sortOrder: 3, isRequired: true },
            { codename: 'Passed', dataType: 'BOOLEAN', name: vlc('Passed', 'Пройдено'), sortOrder: 4 },
            {
                codename: 'OccurredAt',
                dataType: 'DATE',
                name: vlc('Occurred At', 'Дата события'),
                sortOrder: 5,
                validationRules: { dateComposition: 'datetime' }
            },
            { codename: 'SourceObjectId', dataType: 'STRING', name: vlc('Source Object ID', 'ID объекта-источника'), sortOrder: 6 },
            { codename: 'SourceRowId', dataType: 'STRING', name: vlc('Source Row ID', 'ID строки-источника'), sortOrder: 7 },
            {
                codename: 'SourceLineId',
                dataType: 'STRING',
                name: vlc('Source Line ID', 'ID строки движения'),
                sortOrder: 8
            }
        ]
    },
    ...LMS_ADDITIONAL_LEDGER_ENTITIES,
    {
        codename: 'Classes',
        kind: 'object',
        name: vlc('Classes', 'Классы'),
        description: vlc('Student groups for learning management.', 'Группы студентов для управления обучением.'),
        components: [
            {
                codename: 'Name',
                dataType: 'STRING',
                name: vlc('Name', 'Название'),
                isRequired: true,
                isDisplayComponent: true,
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
        kind: 'object',
        name: vlc('Students', 'Студенты'),
        description: vlc('Registered and guest students.', 'Зарегистрированные и гостевые студенты.'),
        components: [
            {
                codename: 'DisplayName',
                dataType: 'STRING',
                name: vlc('Display Name', 'Отображаемое имя'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 255, localized: true, versioned: true }
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
                codename: 'DepartmentId',
                dataType: 'REF',
                name: vlc('Department', 'Подразделение'),
                sortOrder: 4,
                targetEntityCodename: 'Departments',
                targetEntityKind: 'object'
            },
            {
                codename: 'GuestSessionToken',
                dataType: 'STRING',
                name: vlc('Guest Session Token', 'Токен гостевой сессии'),
                sortOrder: 5
            }
        ]
    },
    {
        codename: 'Departments',
        kind: 'object',
        name: vlc('Departments', 'Подразделения'),
        description: vlc(
            'Organization units used for learner segmentation and reporting.',
            'Подразделения для сегментации учащихся и отчетности.'
        ),
        components: [
            {
                codename: 'Name',
                dataType: 'STRING',
                name: vlc('Name', 'Название'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'Code',
                dataType: 'STRING',
                name: vlc('Code', 'Код'),
                sortOrder: 2,
                validationRules: { maxLength: 64 }
            },
            {
                codename: 'ParentDepartmentId',
                dataType: 'REF',
                name: vlc('Parent Department', 'Родительское подразделение'),
                sortOrder: 3,
                targetEntityCodename: 'Departments',
                targetEntityKind: 'object'
            },
            {
                codename: 'ManagerEmail',
                dataType: 'STRING',
                name: vlc('Manager Email', 'Email руководителя'),
                sortOrder: 4,
                validationRules: { maxLength: 320 }
            }
        ]
    }
]
