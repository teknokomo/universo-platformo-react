import type { LmsTemplateEntity } from './lms.seed-entity-helpers'
import { vlc } from './basic.template'

export const lmsSeedEnumerationEntities: LmsTemplateEntity[] = [
    {
        codename: 'LearningResourceStatus',
        kind: 'enumeration',
        name: vlc('Learning Resource Status', 'Статус учебного ресурса'),
        description: vlc('Status values for learning resources.', 'Значения статуса учебных ресурсов.')
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
        description: vlc('Types of content items in learning resources.', 'Типы элементов контента в учебных ресурсах.')
    },
    {
        codename: 'ResourceType',
        kind: 'enumeration',
        name: vlc('Resource Type', 'Тип ресурса'),
        description: vlc('Generic resource types for learning content.', 'Универсальные типы ресурсов для учебного контента.')
    },
    {
        codename: 'PublicationStatus',
        kind: 'enumeration',
        name: vlc('Publication Status', 'Статус публикации'),
        description: vlc(
            'Draft, published, unpublished-changes, and archived states for authored Learning Content.',
            'Черновик, опубликовано, неопубликованные изменения и архив для авторского учебного контента.'
        )
    },
    {
        codename: 'CompletionStatus',
        kind: 'enumeration',
        name: vlc('Completion Status', 'Статус прохождения'),
        description: vlc(
            'Generic completion states for resources, courses, tracks, and plans.',
            'Универсальные статусы прохождения ресурсов, курсов, треков и планов.'
        )
    },
    {
        codename: 'AttemptStatus',
        kind: 'enumeration',
        name: vlc('Attempt Status', 'Статус попытки'),
        description: vlc('Attempt lifecycle states for quizzes and assessments.', 'Состояния жизненного цикла попыток тестов и оцениваний.')
    },
    {
        codename: 'AssignmentReviewStatus',
        kind: 'enumeration',
        name: vlc('Assignment Review Status', 'Статус проверки задания'),
        description: vlc('Review states for assignment submissions.', 'Состояния проверки отправленных заданий.')
    },
    {
        codename: 'AssignmentStatus',
        kind: 'enumeration',
        name: vlc('Assignment Status', 'Статус назначения'),
        description: vlc('Status values for learning assignments.', 'Значения статуса учебных назначений.')
    },
    {
        codename: 'TrainingAttendanceStatus',
        kind: 'enumeration',
        name: vlc('Training Attendance Status', 'Статус посещаемости'),
        description: vlc('Attendance states for instructor-led events.', 'Состояния посещаемости очных и онлайн-мероприятий.')
    },
    {
        codename: 'TrainingEventType',
        kind: 'enumeration',
        name: vlc('Training Event Type', 'Тип учебного мероприятия'),
        description: vlc('Types of instructor-led and blended training events.', 'Типы очных и смешанных учебных мероприятий.')
    },
    {
        codename: 'CertificateStatus',
        kind: 'enumeration',
        name: vlc('Certificate Status', 'Статус сертификата'),
        description: vlc('Status values for issued certificates.', 'Значения статуса выданных сертификатов.')
    },
    {
        codename: 'PointSourceType',
        kind: 'enumeration',
        name: vlc('Point Source Type', 'Тип источника баллов'),
        description: vlc(
            'Source categories for gamification point rules and point transactions.',
            'Категории источников для правил начисления и операций с баллами.'
        )
    },
    {
        codename: 'ReportType',
        kind: 'enumeration',
        name: vlc('Report Type', 'Тип отчета'),
        description: vlc('Report categories for LMS analytics.', 'Категории отчётов для аналитики LMS.')
    }
]
