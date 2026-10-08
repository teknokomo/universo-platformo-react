import type { LmsTemplateEntity } from './lms.seed-entity-helpers'
import { vlc } from './basic.template'
import {
    LMS_BADGE_ISSUE_WORKFLOW_ACTIONS,
    LMS_DEVELOPMENT_TASK_WORKFLOW_ACTIONS,
    LMS_NOTIFICATION_OUTBOX_WORKFLOW_ACTIONS,
    LMS_POINT_TRANSACTION_WORKFLOW_ACTIONS
} from './lms.seed-workflows'
import { buildTransactionalObjectConfig } from './lms.seed-entity-helpers'

export const lmsSeedEngagementEntities: LmsTemplateEntity[] = [
    {
        codename: 'DevelopmentPlans',
        kind: 'object',
        name: vlc('Development Plans', 'Планы развития'),
        description: vlc('Onboarding and growth plans for learners and teams.', 'Планы адаптации и развития для учащихся и команд.'),
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
                codename: 'StudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                sortOrder: 2,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'SupervisorEmail',
                dataType: 'STRING',
                name: vlc('Supervisor Email', 'Email руководителя'),
                sortOrder: 3,
                validationRules: { maxLength: 320 }
            },
            {
                codename: 'Status',
                dataType: 'REF',
                name: vlc('Status', 'Статус'),
                sortOrder: 4,
                targetEntityCodename: 'CompletionStatus',
                targetEntityKind: 'enumeration'
            }
        ]
    },
    {
        codename: 'DevelopmentPlanStages',
        kind: 'object',
        name: vlc('Development Plan Stages', 'Этапы плана развития'),
        description: vlc('Ordered stages inside development plans.', 'Упорядоченные этапы внутри планов развития.'),
        components: [
            {
                codename: 'PlanId',
                dataType: 'REF',
                name: vlc('Development Plan', 'План развития'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'DevelopmentPlans',
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
        codename: 'DevelopmentPlanTasks',
        kind: 'object',
        name: vlc('Development Plan Tasks', 'Задачи плана развития'),
        description: vlc('Actionable tasks inside development plan stages.', 'Практические задачи внутри этапов плана развития.'),
        config: buildTransactionalObjectConfig({
            prefix: 'DPT-',
            effectiveDateField: 'UpdatedAt',
            stateField: 'Status',
            states: [
                { codename: 'NotStarted', title: 'Not started', isInitial: true },
                { codename: 'InProgress', title: 'In progress' },
                { codename: 'Completed', title: 'Completed', isFinal: true },
                { codename: 'Overdue', title: 'Overdue' }
            ],
            workflowActions: LMS_DEVELOPMENT_TASK_WORKFLOW_ACTIONS
        }),
        components: [
            {
                codename: 'StageId',
                dataType: 'REF',
                name: vlc('Development Stage', 'Этап развития'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'DevelopmentPlanStages',
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
                codename: 'ResourceId',
                dataType: 'REF',
                name: vlc('Resource', 'Ресурс'),
                sortOrder: 3,
                targetEntityCodename: 'LearningResources',
                targetEntityKind: 'object'
            },
            {
                codename: 'Status',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                sortOrder: 4,
                validationRules: { maxLength: 30 }
            },
            {
                codename: 'UpdatedAt',
                dataType: 'DATE',
                name: vlc('Updated At', 'Обновлено'),
                sortOrder: 5
            }
        ]
    },
    {
        codename: 'NotificationRules',
        kind: 'object',
        name: vlc('Notification Rules', 'Правила уведомлений'),
        description: vlc(
            'Generic notification rules triggered by modules and workflow events.',
            'Универсальные правила уведомлений от модулей и workflow-событий.'
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
                codename: 'Trigger',
                dataType: 'STRING',
                name: vlc('Trigger', 'Триггер'),
                isRequired: true,
                sortOrder: 2,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'Template',
                dataType: 'JSON',
                name: vlc('Template', 'Шаблон'),
                sortOrder: 3
            }
        ]
    },
    {
        codename: 'NotificationOutbox',
        kind: 'object',
        name: vlc('Notification Outbox', 'Очередь уведомлений'),
        description: vlc('Module-generated notification events awaiting delivery.', 'События уведомлений от модулей, ожидающие доставки.'),
        config: buildTransactionalObjectConfig({
            prefix: 'NTF-',
            effectiveDateField: 'CreatedAt',
            stateField: 'Status',
            states: [
                { codename: 'Queued', title: 'Queued', isInitial: true },
                { codename: 'Sent', title: 'Sent', isFinal: true },
                { codename: 'Failed', title: 'Failed' },
                { codename: 'Cancelled', title: 'Cancelled', isFinal: true }
            ],
            targetLedgers: ['NotificationLedger'],
            workflowActions: LMS_NOTIFICATION_OUTBOX_WORKFLOW_ACTIONS
        }),
        components: [
            {
                codename: 'RuleId',
                dataType: 'REF',
                name: vlc('Notification Rule', 'Правило уведомления'),
                sortOrder: 1,
                targetEntityCodename: 'NotificationRules',
                targetEntityKind: 'object'
            },
            {
                codename: 'Recipient',
                dataType: 'STRING',
                name: vlc('Recipient', 'Получатель'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 2,
                validationRules: { maxLength: 320 }
            },
            {
                codename: 'Payload',
                dataType: 'JSON',
                name: vlc('Payload', 'Данные'),
                sortOrder: 3
            },
            {
                codename: 'CreatedAt',
                dataType: 'DATE',
                name: vlc('Created At', 'Создано'),
                sortOrder: 4
            },
            {
                codename: 'Status',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                sortOrder: 5,
                validationRules: { maxLength: 30 }
            }
        ]
    },
    {
        codename: 'GamificationSettings',
        kind: 'object',
        name: vlc('Gamification Settings', 'Настройки геймификации'),
        description: vlc(
            'Application and workspace-level gamification switches and leaderboard policy.',
            'Настройки геймификации уровня приложения и рабочего пространства, включая политику рейтинга.'
        ),
        components: [
            {
                codename: 'Scope',
                dataType: 'STRING',
                name: vlc('Scope', 'Область'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 64 }
            },
            {
                codename: 'WorkspaceKey',
                dataType: 'STRING',
                name: vlc('Workspace Key', 'Ключ рабочего пространства'),
                sortOrder: 2,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'Enabled',
                dataType: 'BOOLEAN',
                name: vlc('Enabled', 'Включено'),
                sortOrder: 3
            },
            {
                codename: 'LeaderboardPeriodDays',
                dataType: 'NUMBER',
                name: vlc('Leaderboard Period Days', 'Период рейтинга в днях'),
                sortOrder: 4,
                validationRules: { min: 1, max: 366 }
            },
            {
                codename: 'Rules',
                dataType: 'JSON',
                name: vlc('Rules', 'Правила'),
                sortOrder: 5
            }
        ]
    },
    {
        codename: 'PointAwardRules',
        kind: 'object',
        name: vlc('Point Award Rules', 'Правила начисления баллов'),
        description: vlc(
            'Declarative point award rules for learning resources, assignments, events, certificates, and manual adjustments.',
            'Декларативные правила начисления баллов за учебные ресурсы, задания, мероприятия, сертификаты и ручные корректировки.'
        ),
        components: [
            {
                codename: 'RuleCode',
                dataType: 'STRING',
                name: vlc('Rule Code', 'Код правила'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'Name',
                dataType: 'STRING',
                name: vlc('Name', 'Название'),
                isRequired: true,
                sortOrder: 2,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'SourceType',
                dataType: 'REF',
                name: vlc('Source Type', 'Тип источника'),
                isRequired: true,
                sortOrder: 3,
                targetEntityCodename: 'PointSourceType',
                targetEntityKind: 'enumeration'
            },
            {
                codename: 'Points',
                dataType: 'NUMBER',
                name: vlc('Points', 'Баллы'),
                isRequired: true,
                sortOrder: 4
            },
            {
                codename: 'IsActive',
                dataType: 'BOOLEAN',
                name: vlc('Is Active', 'Активно'),
                sortOrder: 5
            },
            {
                codename: 'Conditions',
                dataType: 'JSON',
                name: vlc('Conditions', 'Условия'),
                sortOrder: 6
            }
        ]
    },
    {
        codename: 'PointTransactions',
        kind: 'object',
        name: vlc('Point Transactions', 'Операции с баллами'),
        description: vlc(
            'Auditable point awards and manual adjustments posted to the Points Ledger.',
            'Проверяемые начисления и ручные корректировки баллов, проводимые в регистр баллов.'
        ),
        config: buildTransactionalObjectConfig({
            prefix: 'PTS-',
            effectiveDateField: 'AwardedAt',
            stateField: 'Status',
            states: [
                { codename: 'Pending', title: 'Pending', isInitial: true },
                { codename: 'Approved', title: 'Approved' },
                { codename: 'Reversed', title: 'Reversed', isFinal: true }
            ],
            targetLedgers: ['PointsLedger'],
            workflowActions: LMS_POINT_TRANSACTION_WORKFLOW_ACTIONS
        }),
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
                codename: 'SourceType',
                dataType: 'REF',
                name: vlc('Source Type', 'Тип источника'),
                isRequired: true,
                sortOrder: 2,
                targetEntityCodename: 'PointSourceType',
                targetEntityKind: 'enumeration'
            },
            {
                codename: 'SourceObjectId',
                dataType: 'STRING',
                name: vlc('Source Object ID', 'ID объекта-источника'),
                sortOrder: 3,
                validationRules: { maxLength: 255 }
            },
            {
                codename: 'PointsDelta',
                dataType: 'NUMBER',
                name: vlc('Points Delta', 'Изменение баллов'),
                isRequired: true,
                sortOrder: 4
            },
            {
                codename: 'Reason',
                dataType: 'STRING',
                name: vlc('Reason', 'Причина'),
                sortOrder: 5,
                validationRules: { localized: true, versioned: true }
            },
            {
                codename: 'AwardedAt',
                dataType: 'DATE',
                name: vlc('Awarded At', 'Начислено'),
                isRequired: true,
                sortOrder: 6
            },
            {
                codename: 'Status',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                isRequired: true,
                sortOrder: 7,
                validationRules: { maxLength: 30 }
            }
        ]
    },
    {
        codename: 'BadgeDefinitions',
        kind: 'object',
        name: vlc('Badge Definitions', 'Определения бейджей'),
        description: vlc(
            'Reusable badge definitions and eligibility thresholds.',
            'Переиспользуемые определения бейджей и пороги получения.'
        ),
        components: [
            {
                codename: 'BadgeCode',
                dataType: 'STRING',
                name: vlc('Badge Code', 'Код бейджа'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 1,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'Name',
                dataType: 'STRING',
                name: vlc('Name', 'Название'),
                isRequired: true,
                sortOrder: 2,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'Description',
                dataType: 'STRING',
                name: vlc('Description', 'Описание'),
                sortOrder: 3,
                validationRules: { localized: true, versioned: true }
            },
            {
                codename: 'RequiredPoints',
                dataType: 'NUMBER',
                name: vlc('Required Points', 'Требуемые баллы'),
                sortOrder: 4,
                validationRules: { min: 0 }
            },
            {
                codename: 'Icon',
                dataType: 'STRING',
                name: vlc('Icon', 'Иконка'),
                sortOrder: 5,
                validationRules: { maxLength: 64 }
            },
            {
                codename: 'IsActive',
                dataType: 'BOOLEAN',
                name: vlc('Is Active', 'Активно'),
                sortOrder: 6
            }
        ]
    },
    {
        codename: 'BadgeIssues',
        kind: 'object',
        name: vlc('Badge Issues', 'Выдачи бейджей'),
        description: vlc('Learner badge issue and revocation records.', 'Записи выдачи и отзыва бейджей учащихся.'),
        config: buildTransactionalObjectConfig({
            prefix: 'BDG-',
            effectiveDateField: 'IssuedAt',
            stateField: 'Status',
            states: [
                { codename: 'Eligible', title: 'Eligible', isInitial: true },
                { codename: 'Issued', title: 'Issued' },
                { codename: 'Revoked', title: 'Revoked', isFinal: true }
            ],
            workflowActions: LMS_BADGE_ISSUE_WORKFLOW_ACTIONS
        }),
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
                codename: 'BadgeId',
                dataType: 'REF',
                name: vlc('Badge', 'Бейдж'),
                isRequired: true,
                sortOrder: 2,
                targetEntityCodename: 'BadgeDefinitions',
                targetEntityKind: 'object'
            },
            {
                codename: 'IssuedAt',
                dataType: 'DATE',
                name: vlc('Issued At', 'Выдан'),
                isRequired: true,
                sortOrder: 3
            },
            {
                codename: 'RevokedAt',
                dataType: 'DATE',
                name: vlc('Revoked At', 'Отозван'),
                sortOrder: 4
            },
            {
                codename: 'Status',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                isRequired: true,
                sortOrder: 5,
                validationRules: { maxLength: 30 }
            },
            {
                codename: 'Reason',
                dataType: 'STRING',
                name: vlc('Reason', 'Причина'),
                sortOrder: 6,
                validationRules: { localized: true, versioned: true }
            }
        ]
    },
    {
        codename: 'LeaderboardSnapshots',
        kind: 'object',
        name: vlc('Leaderboard Snapshots', 'Снимки рейтинга'),
        description: vlc(
            'Deterministic leaderboard rows derived from point facts for learner-facing achievement pages.',
            'Детерминированные строки рейтинга на основе фактов баллов для страниц достижений учащегося.'
        ),
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
                codename: 'Period',
                dataType: 'STRING',
                name: vlc('Period', 'Период'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 2,
                validationRules: { maxLength: 64 }
            },
            {
                codename: 'TotalPoints',
                dataType: 'NUMBER',
                name: vlc('Total Points', 'Всего баллов'),
                isRequired: true,
                sortOrder: 3
            },
            {
                codename: 'Rank',
                dataType: 'NUMBER',
                name: vlc('Rank', 'Место'),
                isRequired: true,
                sortOrder: 4,
                validationRules: { min: 1 }
            },
            {
                codename: 'BadgeCount',
                dataType: 'NUMBER',
                name: vlc('Badge Count', 'Количество бейджей'),
                sortOrder: 5,
                validationRules: { min: 0 }
            },
            {
                codename: 'CalculatedAt',
                dataType: 'DATE',
                name: vlc('Calculated At', 'Рассчитано'),
                sortOrder: 6
            }
        ]
    },
    {
        codename: 'Reports',
        kind: 'object',
        name: vlc('Reports', 'Отчёты'),
        description: vlc(
            'Reusable LMS report definitions for administrators and instructors.',
            'Переиспользуемые определения отчётов LMS для администраторов и преподавателей.'
        ),
        hubs: ['Learning'],
        config: {
            runtime: {
                menuVisibility: 'primary',
                icon: 'analytics',
                requiresPermission: 'readReports'
            }
        },
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
                codename: 'ReportType',
                dataType: 'REF',
                name: vlc('Report Type', 'Тип отчета'),
                sortOrder: 2,
                targetEntityCodename: 'ReportType',
                targetEntityKind: 'enumeration'
            },
            {
                codename: 'Filters',
                dataType: 'JSON',
                name: vlc('Filters', 'Фильтры'),
                sortOrder: 3,
                uiConfig: { gridHidden: true }
            },
            {
                codename: 'Definition',
                dataType: 'JSON',
                name: vlc('Definition', 'Определение'),
                sortOrder: 4,
                uiConfig: { gridHidden: true }
            },
            {
                codename: 'SavedFilters',
                dataType: 'JSON',
                name: vlc('Saved Filters', 'Сохраненные фильтры'),
                sortOrder: 5,
                uiConfig: { gridHidden: true }
            }
        ]
    }
]
