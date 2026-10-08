import type { MetahubTemplateManifest } from '@universo-react/types'
import { vlc } from './basic.template'
import { LMS_PUBLIC_GUEST_RUNTIME_CONFIG } from './lms.seed-settings'
import {
    buildLmsBaseSeedZoneWidgets,
    buildLmsHomeSeedZoneWidgets,
    buildLmsLearningContentSeedZoneWidgets,
    buildLmsTrashSeedZoneWidgets,
    buildLmsReportsSeedZoneWidgets,
    buildLmsCourseBuilderSeedZoneWidgets,
    buildLmsOrderingSeedZoneWidgets,
    buildLmsTrackBuilderSeedZoneWidgets,
    buildLmsKnowledgeArticlesSeedZoneWidgets,
    buildLmsEnrollmentsSeedZoneWidgets,
    buildLmsEntityRecordsSeedZoneWidgets
} from './lms.seed-dashboard'
import { lmsSeedInitialEntities } from './lms.seed-entities.initial'
import { lmsSeedContentEntities } from './lms.seed-entities.content'
import { lmsSeedLearningEntities } from './lms.seed-entities.learning'
import { lmsSeedTrackEntities } from './lms.seed-entities.tracks'
import { lmsSeedAssessmentEntities } from './lms.seed-entities.assessment'
import { lmsSeedOperationsEntities } from './lms.seed-entities.operations'
import { lmsSeedEngagementEntities } from './lms.seed-entities.engagement'
import { lmsSavedReportElements } from './lms.seed-report-elements'
import { lmsSeedEnumerationEntities } from './lms.seed-entities.enumerations'
import {
    LMS_ENROLLMENT_POSTING_MODULE_SOURCE,
    LMS_QUIZ_ATTEMPT_POSTING_MODULE_SOURCE,
    LMS_CONTENT_COMPLETION_POSTING_MODULE_SOURCE,
    LMS_CERTIFICATE_ISSUE_POSTING_MODULE_SOURCE,
    LMS_POINT_TRANSACTION_POSTING_MODULE_SOURCE
} from './lms.seed-posting-modules'
export const lmsTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'lms',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('LMS', 'LMS'),
    description: vlc(
        'Learning Management System template with classes, learning content, quizzes, and student tracking.',
        'Шаблон системы управления обучением с классами, учебным контентом, тестами и отслеживанием студентов.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['lms', 'education', 'quiz'],
        icon: 'School'
    },
    presets: [
        { presetCodename: 'hub', includedByDefault: true },
        { presetCodename: 'page', includedByDefault: false },
        { presetCodename: 'object', includedByDefault: true },
        { presetCodename: 'set', includedByDefault: true },
        { presetCodename: 'enumeration', includedByDefault: true }
    ],
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
        scopedLayouts: [
            {
                codename: 'learnerHome',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'LearnerHome',
                scopeEntityKind: 'page',
                name: vlc('Learner Home', 'Главная учащегося'),
                description: vlc(
                    'Home page layout with LMS overview cards and learning activity charts.',
                    'Макет главной страницы с обзорными карточками LMS и графиками учебной активности.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 0
            },
            {
                codename: 'learningContent',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'ContentProjects',
                scopeEntityKind: 'object',
                name: vlc('Learning Content Library', 'Библиотека учебного контента'),
                description: vlc(
                    'Workspace Learning Content layout with project metrics and a unified active content table.',
                    'Макет учебного контента рабочего пространства с метриками проектов и единой таблицей активного контента.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 1
            },
            {
                codename: 'learningContentRecent',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'RecentContentViews',
                scopeEntityKind: 'object',
                name: vlc('Recent Learning Content', 'Недавний учебный контент'),
                description: vlc(
                    'Recent Learning Content records resolved through metadata-defined view facts.',
                    'Недавние записи учебного контента, собранные через метаданные фактов просмотра.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 2
            },
            {
                codename: 'learningContentStarred',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'ContentStars',
                scopeEntityKind: 'object',
                name: vlc('Starred Learning Content', 'Избранный учебный контент'),
                description: vlc(
                    'Starred Learning Content records resolved through metadata-defined star facts.',
                    'Избранные записи учебного контента, собранные через метаданные фактов избранного.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 3
            },
            {
                codename: 'learningContentShared',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'ContentAccessEntries',
                scopeEntityKind: 'object',
                name: vlc('Shared Learning Content', 'Доступный учебный контент'),
                description: vlc(
                    'Learning Content records shared with the current workspace member.',
                    'Записи учебного контента, доступные текущему участнику рабочего пространства.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 4
            },
            {
                codename: 'learningContentTrash',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'TrashEntries',
                scopeEntityKind: 'object',
                name: vlc('Learning Content Trash', 'Корзина учебного контента'),
                description: vlc(
                    'Trash layout backed by deleted Learning Content runtime rows.',
                    'Макет корзины на основе удаленных runtime-записей учебного контента.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 5
            },
            {
                codename: 'courseBuilder',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'Courses',
                scopeEntityKind: 'object',
                name: vlc('Course Builder', 'Конструктор курса'),
                description: vlc(
                    'Course layout with sections and ordered CourseItems rendered through generic runtime tables.',
                    'Макет курса с разделами и упорядоченными CourseItems через универсальные runtime-таблицы.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 3
            },
            {
                codename: 'courseSectionsOrdering',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'CourseSections',
                scopeEntityKind: 'object',
                name: vlc('Course Section Ordering', 'Упорядочивание разделов курса'),
                description: vlc(
                    'Generic runtime ordering layout for course sections.',
                    'Универсальный runtime-макет упорядочивания разделов курса.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 4
            },
            {
                codename: 'courseItemsOrdering',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'CourseItems',
                scopeEntityKind: 'object',
                name: vlc('Course Item Ordering', 'Упорядочивание элементов курса'),
                description: vlc(
                    'Generic runtime ordering layout for course content references.',
                    'Универсальный runtime-макет упорядочивания ссылок на контент курса.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 5
            },
            {
                codename: 'trackBuilder',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'LearningTracks',
                scopeEntityKind: 'object',
                name: vlc('Learning Track Builder', 'Конструктор учебного трека'),
                description: vlc(
                    'Learning Track layout with stages and course steps rendered through generic runtime tables.',
                    'Макет учебного трека с этапами и шагами курсов через универсальные runtime-таблицы.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 6
            },
            {
                codename: 'trackStagesOrdering',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'TrackStages',
                scopeEntityKind: 'object',
                name: vlc('Track Stage Ordering', 'Упорядочивание этапов трека'),
                description: vlc(
                    'Generic runtime ordering layout for learning track stages.',
                    'Универсальный runtime-макет упорядочивания этапов учебного трека.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 7
            },
            {
                codename: 'trackStepsOrdering',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'TrackSteps',
                scopeEntityKind: 'object',
                name: vlc('Track Step Ordering', 'Упорядочивание шагов трека'),
                description: vlc(
                    'Generic runtime ordering layout for learning track course steps.',
                    'Универсальный runtime-макет упорядочивания шагов курсов в учебном треке.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 8
            },
            {
                codename: 'reportsDashboard',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'Reports',
                scopeEntityKind: 'object',
                name: vlc('Reports Dashboard', 'Панель отчётов'),
                description: vlc(
                    'Reports layout with saved report definitions and the primary Learning Content summary report surface.',
                    'Макет отчётов со списком сохраненных определений и основным отчётом по учебному контенту.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 9
            },
            {
                codename: 'knowledgeArticles',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'KnowledgeArticles',
                scopeEntityKind: 'object',
                name: vlc('Knowledge Articles', 'Статьи базы знаний'),
                description: vlc(
                    'Entity-backed records table for articles authored in the published application.',
                    'Таблица записей сущности для статей, созданных в опубликованном приложении.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 10
            },
            {
                codename: 'enrollments',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'Enrollments',
                scopeEntityKind: 'object',
                name: vlc('Enrollment Records', 'Записи об обучении'),
                description: vlc(
                    'Entity-backed table for transactional enrollment records and posting actions.',
                    'Таблица записей объекта для транзакционных записей об обучении и действий проведения.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 11
            },
            {
                codename: 'assignmentSubmissions',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'AssignmentSubmissions',
                scopeEntityKind: 'object',
                name: vlc('Assignment Submissions', 'Ответы на задания'),
                description: vlc(
                    'Entity-backed table for assignment submission review workflows.',
                    'Таблица записей объекта для процессов проверки ответов на задания.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 12
            },
            {
                codename: 'trainingAttendance',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'TrainingAttendance',
                scopeEntityKind: 'object',
                name: vlc('Training Attendance', 'Посещаемость обучения'),
                description: vlc(
                    'Entity-backed table for training attendance workflows.',
                    'Таблица записей объекта для процессов учёта посещаемости обучения.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 13
            },
            {
                codename: 'certificateIssues',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'CertificateIssues',
                scopeEntityKind: 'object',
                name: vlc('Certificate Issues', 'Выдача сертификатов'),
                description: vlc(
                    'Entity-backed table for certificate issue and revocation workflows.',
                    'Таблица записей объекта для процессов выдачи и отзыва сертификатов.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 14
            },
            {
                codename: 'developmentPlanTasks',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'DevelopmentPlanTasks',
                scopeEntityKind: 'object',
                name: vlc('Development Plan Tasks', 'Задачи плана развития'),
                description: vlc(
                    'Entity-backed table for development plan task workflows.',
                    'Таблица записей объекта для процессов выполнения задач плана развития.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 15
            },
            {
                codename: 'notificationOutbox',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'NotificationOutbox',
                scopeEntityKind: 'object',
                name: vlc('Notification Outbox', 'Исходящие уведомления'),
                description: vlc(
                    'Entity-backed table for notification delivery workflows.',
                    'Таблица записей объекта для процессов доставки уведомлений.'
                ),
                isDefault: true,
                isActive: true,
                sortOrder: 16
            }
        ],
        layoutZoneWidgets: {
            main: buildLmsBaseSeedZoneWidgets(),
            learnerHome: buildLmsHomeSeedZoneWidgets(),
            learningContent: buildLmsLearningContentSeedZoneWidgets(),
            learningContentRecent: buildLmsLearningContentSeedZoneWidgets('recent'),
            learningContentStarred: buildLmsLearningContentSeedZoneWidgets('starred'),
            learningContentShared: buildLmsLearningContentSeedZoneWidgets('shared'),
            learningContentTrash: buildLmsTrashSeedZoneWidgets(),
            courseBuilder: buildLmsCourseBuilderSeedZoneWidgets(),
            courseSectionsOrdering: buildLmsOrderingSeedZoneWidgets('CourseSections'),
            courseItemsOrdering: buildLmsOrderingSeedZoneWidgets('CourseItems'),
            trackBuilder: buildLmsTrackBuilderSeedZoneWidgets(),
            trackStagesOrdering: buildLmsOrderingSeedZoneWidgets('TrackStages'),
            trackStepsOrdering: buildLmsOrderingSeedZoneWidgets('TrackSteps'),
            reportsDashboard: buildLmsReportsSeedZoneWidgets(),
            knowledgeArticles: buildLmsKnowledgeArticlesSeedZoneWidgets(),
            enrollments: buildLmsEnrollmentsSeedZoneWidgets(),
            assignmentSubmissions: buildLmsEntityRecordsSeedZoneWidgets('AssignmentSubmissions', 'assignment-submissions-records'),
            trainingAttendance: buildLmsEntityRecordsSeedZoneWidgets('TrainingAttendance', 'training-attendance-records'),
            certificateIssues: buildLmsEntityRecordsSeedZoneWidgets('CertificateIssues', 'certificate-issues-records'),
            developmentPlanTasks: buildLmsEntityRecordsSeedZoneWidgets('DevelopmentPlanTasks', 'development-plan-tasks-records'),
            notificationOutbox: buildLmsEntityRecordsSeedZoneWidgets('NotificationOutbox', 'notification-outbox-records')
        },
        entities: [
            ...lmsSeedInitialEntities,
            ...lmsSeedContentEntities,
            ...lmsSeedLearningEntities,
            ...lmsSeedTrackEntities,
            ...lmsSeedAssessmentEntities,
            ...lmsSeedOperationsEntities,
            ...lmsSeedEngagementEntities,
            ...lmsSeedEnumerationEntities
        ],
        optionValues: {
            LearningResourceStatus: [
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
            ],
            ResourceType: [
                { codename: 'Page', name: vlc('Page', 'Страница'), sortOrder: 1, isDefault: true },
                { codename: 'Url', name: vlc('URL', 'URL'), sortOrder: 2 },
                { codename: 'Video', name: vlc('Video', 'Видео'), sortOrder: 3 },
                { codename: 'Audio', name: vlc('Audio', 'Аудио'), sortOrder: 4 },
                { codename: 'Document', name: vlc('Document', 'Документ'), sortOrder: 5 },
                { codename: 'Scorm', name: vlc('SCORM-like package', 'SCORM-подобный пакет'), sortOrder: 6 },
                { codename: 'Xapi', name: vlc('xAPI package', 'Пакет xAPI'), sortOrder: 7 },
                { codename: 'Embed', name: vlc('Embed', 'Встраивание'), sortOrder: 8 },
                { codename: 'File', name: vlc('File', 'Файл'), sortOrder: 9 }
            ],
            PublicationStatus: [
                { codename: 'Draft', name: vlc('Draft', 'Черновик'), sortOrder: 1, isDefault: true },
                { codename: 'Published', name: vlc('Published', 'Опубликовано'), sortOrder: 2 },
                {
                    codename: 'UnpublishedChanges',
                    name: vlc('Unpublished Changes', 'Неопубликованные изменения'),
                    sortOrder: 3
                },
                { codename: 'Archived', name: vlc('Archived', 'Архив'), sortOrder: 4 }
            ],
            CompletionStatus: [
                { codename: 'NotStarted', name: vlc('Not started', 'Не начато'), sortOrder: 1, isDefault: true },
                { codename: 'InProgress', name: vlc('In progress', 'В процессе'), sortOrder: 2 },
                { codename: 'Completed', name: vlc('Completed', 'Завершено'), sortOrder: 3 },
                { codename: 'Overdue', name: vlc('Overdue', 'Просрочено'), sortOrder: 4 },
                { codename: 'Expired', name: vlc('Expired', 'Истекло'), sortOrder: 5 }
            ],
            AttemptStatus: [
                { codename: 'NotStarted', name: vlc('Not started', 'Не начато'), sortOrder: 1, isDefault: true },
                { codename: 'InProgress', name: vlc('In progress', 'В процессе'), sortOrder: 2 },
                { codename: 'Failed', name: vlc('Failed', 'Не пройдено'), sortOrder: 3 },
                { codename: 'Passed', name: vlc('Passed', 'Пройдено'), sortOrder: 4 }
            ],
            AssignmentReviewStatus: [
                { codename: 'NotStarted', name: vlc('Not started', 'Не начато'), sortOrder: 1, isDefault: true },
                { codename: 'PendingReview', name: vlc('Pending Review', 'Ожидает проверки'), sortOrder: 2 },
                { codename: 'Declined', name: vlc('Declined', 'Отклонено'), sortOrder: 3 },
                { codename: 'Accepted', name: vlc('Accepted', 'Принято'), sortOrder: 4 }
            ],
            AssignmentStatus: [
                { codename: 'Draft', name: vlc('Draft', 'Черновик'), sortOrder: 1 },
                { codename: 'Assigned', name: vlc('Assigned', 'Назначено'), sortOrder: 2, isDefault: true },
                { codename: 'Completed', name: vlc('Completed', 'Завершено'), sortOrder: 3 },
                { codename: 'Cancelled', name: vlc('Cancelled', 'Отменено'), sortOrder: 4 }
            ],
            TrainingAttendanceStatus: [
                { codename: 'Registered', name: vlc('Registered', 'Зарегистрирован'), sortOrder: 1, isDefault: true },
                { codename: 'Attended', name: vlc('Attended', 'Посетил'), sortOrder: 2 },
                { codename: 'NoShow', name: vlc('No-show', 'Не явился'), sortOrder: 3 },
                { codename: 'Cancelled', name: vlc('Cancelled', 'Отменено'), sortOrder: 4 }
            ],
            TrainingEventType: [
                { codename: 'Classroom', name: vlc('Classroom', 'Аудиторное занятие'), sortOrder: 1, isDefault: true },
                { codename: 'Webinar', name: vlc('Webinar', 'Вебинар'), sortOrder: 2 },
                { codename: 'Blended', name: vlc('Blended', 'Смешанное'), sortOrder: 3 }
            ],
            CertificateStatus: [
                { codename: 'Eligible', name: vlc('Eligible', 'Готов к выдаче'), sortOrder: 1 },
                { codename: 'Issued', name: vlc('Issued', 'Выдан'), sortOrder: 2, isDefault: true },
                { codename: 'Revoked', name: vlc('Revoked', 'Отозван'), sortOrder: 3 },
                { codename: 'Expired', name: vlc('Expired', 'Истек'), sortOrder: 4 }
            ],
            PointSourceType: [
                { codename: 'Course', name: vlc('Course', 'Курс'), sortOrder: 1 },
                { codename: 'Track', name: vlc('Track', 'Трек'), sortOrder: 2 },
                { codename: 'Assignment', name: vlc('Assignment', 'Задание'), sortOrder: 3 },
                { codename: 'TrainingEvent', name: vlc('Training Event', 'Учебное мероприятие'), sortOrder: 4 },
                { codename: 'Certificate', name: vlc('Certificate', 'Сертификат'), sortOrder: 5 },
                { codename: 'Manual', name: vlc('Manual Adjustment', 'Ручная корректировка'), sortOrder: 6, isDefault: true }
            ],
            ReportType: [
                { codename: 'Progress', name: vlc('Progress', 'Прогресс'), sortOrder: 1, isDefault: true },
                { codename: 'Enrollment', name: vlc('Enrollment', 'Записи'), sortOrder: 2 },
                { codename: 'QuizResults', name: vlc('Quiz Results', 'Результаты тестов'), sortOrder: 3 },
                { codename: 'Gamification', name: vlc('Gamification', 'Геймификация'), sortOrder: 4 }
            ]
        },
        elements: {
            Reports: lmsSavedReportElements
        },
        modules: [
            {
                codename: 'EnrollmentPostingModule',
                name: vlc('Enrollment Posting Module', 'Модуль проведения записи'),
                description: vlc(
                    'Posts enrollment records into the generic Progress Ledger.',
                    'Проводит записи на обучение в универсальный регистр прогресса.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'Enrollments',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_ENROLLMENT_POSTING_MODULE_SOURCE
            },
            {
                codename: 'QuizAttemptPostingModule',
                name: vlc('Quiz Attempt Posting Module', 'Модуль проведения попытки теста'),
                description: vlc(
                    'Posts quiz attempt records into score and learning activity Ledgers.',
                    'Проводит попытки тестов в регистры оценок и учебной активности.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'QuizAttempts',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_QUIZ_ATTEMPT_POSTING_MODULE_SOURCE
            },
            {
                codename: 'ContentCompletionPostingModule',
                name: vlc('Content Completion Posting Module', 'Модуль проведения завершения контента'),
                description: vlc(
                    'Posts content completion progress records into the progress Ledger.',
                    'Проводит записи прогресса контента в регистр прогресса.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'ContentProgress',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_CONTENT_COMPLETION_POSTING_MODULE_SOURCE
            },
            {
                codename: 'CertificateIssuePostingModule',
                name: vlc('Certificate Issue Posting Module', 'Модуль проведения выдачи сертификата'),
                description: vlc(
                    'Posts certificate issue records into certificate and notification Ledgers.',
                    'Проводит выдачи сертификатов в регистры сертификатов и уведомлений.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'CertificateIssues',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_CERTIFICATE_ISSUE_POSTING_MODULE_SOURCE
            },
            {
                codename: 'PointTransactionPostingModule',
                name: vlc('Point Transaction Posting Module', 'Модуль проведения операций с баллами'),
                description: vlc(
                    'Posts manual point adjustments into the generic Points Ledger.',
                    'Проводит ручные корректировки баллов в универсальный регистр баллов.'
                ),
                attachedToKind: 'object',
                attachedToEntityCodename: 'PointTransactions',
                moduleRole: 'lifecycle',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['records.read', 'metadata.read', 'lifecycle', 'posting', 'ledger.write'],
                sourceCode: LMS_POINT_TRANSACTION_POSTING_MODULE_SOURCE
            }
        ],
        settings: [
            { key: 'general.language', value: { _value: 'system' } },
            { key: 'general.timezone', value: { _value: 'UTC' } },
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'general.codenameAutoConvertMixedAlphabets', value: { _value: true } },
            { key: 'general.codenameAutoReformat', value: { _value: true } },
            { key: 'general.codenameRequireReformat', value: { _value: true } },
            { key: 'application.publicRuntime.guest', value: { _value: LMS_PUBLIC_GUEST_RUNTIME_CONFIG } },
            { key: 'entity.object.allowComponentCopy', value: { _value: true } },
            { key: 'entity.object.allowComponentDelete', value: { _value: true } },
            { key: 'entity.object.allowDeleteLastDisplayComponent', value: { _value: true } }
        ]
    }
}
