import type { LmsTemplateEntity } from './lms.seed-entity-helpers'
import { vlc } from './basic.template'
import { LMS_CERTIFICATE_ISSUE_WORKFLOW_ACTIONS, LMS_TRAINING_ATTENDANCE_WORKFLOW_ACTIONS } from './lms.seed-workflows'
import { buildTransactionalObjectConfig } from './lms.seed-entity-helpers'

export const lmsSeedOperationsEntities: LmsTemplateEntity[] = [
    {
        codename: 'TrainingEvents',
        kind: 'object',
        name: vlc('Training Events', 'Учебные мероприятия'),
        description: vlc(
            'Instructor-led sessions, webinars, and blended learning events.',
            'Очные занятия, вебинары и смешанные учебные мероприятия.'
        ),
        config: buildTransactionalObjectConfig({
            prefix: 'TRN-',
            effectiveDateField: 'StartsAt',
            targetLedgers: ['AttendanceLedger']
        }),
        components: [
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 500, localized: true, versioned: true }
            },
            {
                codename: 'EventType',
                dataType: 'REF',
                name: vlc('Event Type', 'Тип мероприятия'),
                sortOrder: 2,
                targetEntityCodename: 'TrainingEventType',
                targetEntityKind: 'enumeration'
            },
            {
                codename: 'StartsAt',
                dataType: 'DATE',
                name: vlc('Starts At', 'Начало'),
                sortOrder: 3
            },
            {
                codename: 'EndsAt',
                dataType: 'DATE',
                name: vlc('Ends At', 'Окончание'),
                sortOrder: 4
            },
            {
                codename: 'Capacity',
                dataType: 'NUMBER',
                name: vlc('Capacity', 'Вместимость'),
                sortOrder: 5,
                validationRules: { min: 1 }
            }
        ]
    },
    {
        codename: 'TrainingAttendance',
        kind: 'object',
        name: vlc('Training Attendance', 'Посещаемость мероприятий'),
        description: vlc('Attendance facts for instructor-led sessions and webinars.', 'Факты посещаемости очных занятий и вебинаров.'),
        config: buildTransactionalObjectConfig({
            prefix: 'ATT-',
            effectiveDateField: 'CheckedInAt',
            stateField: 'Status',
            states: [
                { codename: 'Registered', title: 'Registered', isInitial: true },
                { codename: 'Attended', title: 'Attended', isFinal: true },
                { codename: 'NoShow', title: 'No-show', isFinal: true },
                { codename: 'Cancelled', title: 'Cancelled', isFinal: true }
            ],
            targetLedgers: ['AttendanceLedger', 'LearningActivityLedger'],
            workflowActions: LMS_TRAINING_ATTENDANCE_WORKFLOW_ACTIONS
        }),
        components: [
            {
                codename: 'TrainingEventId',
                dataType: 'REF',
                name: vlc('Training Event', 'Учебное мероприятие'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'TrainingEvents',
                targetEntityKind: 'object'
            },
            {
                codename: 'StudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                isRequired: true,
                sortOrder: 2,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'CheckedInAt',
                dataType: 'DATE',
                name: vlc('Checked In At', 'Отметка посещения'),
                isRequired: true,
                sortOrder: 3
            },
            {
                codename: 'Status',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                isRequired: true,
                sortOrder: 4,
                validationRules: { maxLength: 30 }
            },
            {
                codename: 'DurationMinutes',
                dataType: 'NUMBER',
                name: vlc('Duration Minutes', 'Длительность в минутах'),
                sortOrder: 5,
                validationRules: { min: 0 }
            }
        ]
    },
    {
        codename: 'Certificates',
        kind: 'object',
        name: vlc('Certificates', 'Сертификаты'),
        description: vlc('Issued completion certificates and their lifecycle state.', 'Выданные сертификаты о прохождении и их состояние.'),
        config: buildTransactionalObjectConfig({
            prefix: 'CRT-',
            effectiveDateField: 'IssuedAt',
            stateField: 'Status',
            states: [
                { codename: 'Eligible', title: 'Eligible', isInitial: true },
                { codename: 'Issued', title: 'Issued' },
                { codename: 'Revoked', title: 'Revoked', isFinal: true },
                { codename: 'Expired', title: 'Expired', isFinal: true }
            ],
            targetLedgers: ['CertificateLedger']
        }),
        components: [
            {
                codename: 'CertificateNumber',
                dataType: 'STRING',
                name: vlc('Certificate Number', 'Номер сертификата'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 100 }
            },
            {
                codename: 'StudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                sortOrder: 2,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'ContentNodeId',
                dataType: 'REF',
                name: vlc('Learning Resource', 'Учебный ресурс'),
                sortOrder: 3,
                targetEntityCodename: 'LearningResources',
                targetEntityKind: 'object'
            },
            {
                codename: 'IssuedAt',
                dataType: 'DATE',
                name: vlc('Issued At', 'Выдан'),
                sortOrder: 4
            },
            {
                codename: 'Status',
                dataType: 'REF',
                name: vlc('Status', 'Статус'),
                sortOrder: 5,
                targetEntityCodename: 'CertificateStatus',
                targetEntityKind: 'enumeration'
            }
        ]
    },
    {
        codename: 'CertificateIssues',
        kind: 'object',
        name: vlc('Certificate Issues', 'Выдачи сертификатов'),
        description: vlc(
            'Certificate issue and revocation events posted to the certificate ledger.',
            'События выдачи и отзыва сертификатов, проводимые в регистр сертификатов.'
        ),
        config: buildTransactionalObjectConfig({
            prefix: 'CIS-',
            effectiveDateField: 'IssuedAt',
            stateField: 'Status',
            states: [
                { codename: 'Eligible', title: 'Eligible', isInitial: true },
                { codename: 'Issued', title: 'Issued' },
                { codename: 'Revoked', title: 'Revoked', isFinal: true },
                { codename: 'Expired', title: 'Expired', isFinal: true }
            ],
            targetLedgers: ['CertificateLedger', 'NotificationLedger'],
            workflowActions: LMS_CERTIFICATE_ISSUE_WORKFLOW_ACTIONS
        }),
        components: [
            {
                codename: 'CertificateId',
                dataType: 'REF',
                name: vlc('Certificate', 'Сертификат'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'Certificates',
                targetEntityKind: 'object'
            },
            {
                codename: 'CertificateNumber',
                dataType: 'STRING',
                name: vlc('Certificate Number', 'Номер сертификата'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 2,
                validationRules: { maxLength: 100 }
            },
            {
                codename: 'StudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                isRequired: true,
                sortOrder: 3,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'ContentNodeId',
                dataType: 'REF',
                name: vlc('Learning Resource', 'Учебный ресурс'),
                sortOrder: 4,
                targetEntityCodename: 'LearningResources',
                targetEntityKind: 'object'
            },
            {
                codename: 'IssuedAt',
                dataType: 'DATE',
                name: vlc('Issued At', 'Выдан'),
                isRequired: true,
                sortOrder: 5
            },
            {
                codename: 'Status',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                isRequired: true,
                sortOrder: 6,
                validationRules: { maxLength: 30 }
            }
        ]
    },
    {
        codename: 'KnowledgeSpaces',
        kind: 'object',
        name: vlc('Knowledge Spaces', 'Пространства знаний'),
        description: vlc('Knowledge base spaces with shared permissions.', 'Пространства базы знаний с общими правами доступа.'),
        components: [
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
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
                codename: 'Visibility',
                dataType: 'STRING',
                name: vlc('Visibility', 'Видимость'),
                sortOrder: 3,
                validationRules: { maxLength: 32 }
            }
        ]
    },
    {
        codename: 'KnowledgeFolders',
        kind: 'object',
        name: vlc('Knowledge Folders', 'Папки знаний'),
        description: vlc('Folders inside knowledge spaces.', 'Папки внутри пространств знаний.'),
        components: [
            {
                codename: 'SpaceId',
                dataType: 'REF',
                name: vlc('Knowledge Space', 'Пространство знаний'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'KnowledgeSpaces',
                targetEntityKind: 'object'
            },
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 2,
                validationRules: { maxLength: 500, localized: true, versioned: true }
            },
            {
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                sortOrder: 3,
                validationRules: { min: 0 }
            }
        ]
    },
    {
        codename: 'KnowledgeArticles',
        kind: 'object',
        name: vlc('Knowledge Articles', 'Статьи базы знаний'),
        description: vlc(
            'Workspace-scoped articles authored directly inside the published application.',
            'Статьи рабочего пространства, создаваемые прямо в опубликованном приложении.'
        ),
        components: [
            {
                codename: 'FolderId',
                dataType: 'REF',
                name: vlc('Knowledge Folder', 'Папка знаний'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'KnowledgeFolders',
                targetEntityKind: 'object'
            },
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 2,
                validationRules: { maxLength: 500, localized: true, versioned: true }
            },
            {
                codename: 'Body',
                dataType: 'JSON',
                name: vlc('Body', 'Содержимое'),
                isRequired: true,
                sortOrder: 3,
                uiConfig: {
                    widget: 'editorjsBlockContent',
                    blockEditor: {
                        allowedBlockTypes: ['paragraph', 'header', 'list', 'quote', 'table', 'image', 'embed', 'delimiter'],
                        maxBlocks: 200
                    }
                }
            },
            {
                codename: 'Status',
                dataType: 'REF',
                name: vlc('Status', 'Статус'),
                sortOrder: 4,
                targetEntityCodename: 'LearningResourceStatus',
                targetEntityKind: 'enumeration'
            },
            {
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                isRequired: true,
                sortOrder: 5,
                validationRules: { min: 0 },
                uiConfig: { defaultValue: 0, formHidden: true, gridHidden: true }
            }
        ]
    },
    {
        codename: 'KnowledgeBookmarks',
        kind: 'object',
        name: vlc('Knowledge Bookmarks', 'Закладки знаний'),
        description: vlc('Per-learner bookmarks for knowledge base articles.', 'Закладки учащихся для статей базы знаний.'),
        components: [
            {
                codename: 'StudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'ArticleId',
                dataType: 'REF',
                name: vlc('Knowledge Article', 'Статья базы знаний'),
                isRequired: true,
                sortOrder: 2,
                targetEntityCodename: 'KnowledgeArticles',
                targetEntityKind: 'object'
            },
            {
                codename: 'CreatedAt',
                dataType: 'DATE',
                name: vlc('Created At', 'Создано'),
                sortOrder: 3
            }
        ]
    }
]
