import type { LmsTemplateEntity } from './lms.seed-entity-helpers'
import { vlc } from './basic.template'
import { buildTransactionalObjectConfig } from './lms.seed-entity-helpers'

export const lmsSeedContentEntities: LmsTemplateEntity[] = [
    {
        codename: 'ContentProjects',
        kind: 'object',
        name: vlc('Content Projects', 'Проекты контента'),
        description: vlc(
            'Workspace-scoped Learning Content projects for grouping authored resources, courses, and tracks.',
            'Проекты учебного контента внутри рабочего пространства для группировки ресурсов, курсов и треков.'
        ),
        hubs: ['Learning'],
        config: {
            runtime: {
                menuVisibility: 'primary',
                icon: 'folder'
            }
        },
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
                validationRules: { localized: true, versioned: true },
                uiConfig: { widget: 'textarea', rows: 2 }
            },
            {
                codename: 'AccessMode',
                dataType: 'STRING',
                name: vlc('Access Mode', 'Режим доступа'),
                sortOrder: 3,
                validationRules: { maxLength: 32 },
                uiConfig: {
                    widget: 'select',
                    defaultValue: 'workspace',
                    stringOptions: [
                        { value: 'workspace', label: vlc('Workspace', 'Рабочее пространство') },
                        { value: 'restricted', label: vlc('Restricted', 'Ограниченный') },
                        { value: 'private', label: vlc('Private', 'Личный') }
                    ]
                }
            },
            {
                codename: 'Cover',
                dataType: 'JSON',
                name: vlc('Cover', 'Обложка'),
                sortOrder: 4,
                uiConfig: {
                    widget: 'resourceSource',
                    gridHidden: true
                }
            },
            {
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                sortOrder: 5,
                validationRules: { min: 0 }
            },
            {
                codename: 'ArchivedAt',
                dataType: 'DATE',
                name: vlc('Archived At', 'Дата архивации'),
                sortOrder: 6,
                validationRules: { dateComposition: 'datetime' },
                uiConfig: { formHidden: true }
            }
        ]
    },
    {
        codename: 'ContentAccessEntries',
        kind: 'object',
        name: vlc('Content Access Entries', 'Записи доступа к контенту'),
        description: vlc(
            'Generic sharing entries for Learning Content records inside the current workspace.',
            'Универсальные записи совместного доступа к учебному контенту внутри текущего рабочего пространства.'
        ),
        config: {
            runtimeAccessEntry: {
                targetObjectFieldCodename: 'TargetObjectCodename',
                targetRecordFieldCodename: 'TargetRecordId',
                principalTypeFieldCodename: 'PrincipalType',
                principalIdFieldCodename: 'PrincipalId',
                accessLevelFieldCodename: 'AccessLevel',
                supportedPrincipalTypes: ['workspaceMember', 'user']
            }
        },
        components: [
            {
                codename: 'TargetObjectCodename',
                dataType: 'STRING',
                name: vlc('Target Object', 'Целевой объект'),
                isRequired: true,
                sortOrder: 1,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'TargetRecordId',
                dataType: 'STRING',
                name: vlc('Target Record', 'Целевая запись'),
                isRequired: true,
                sortOrder: 2,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'PrincipalType',
                dataType: 'STRING',
                name: vlc('Principal Type', 'Тип субъекта'),
                isRequired: true,
                sortOrder: 3,
                validationRules: { maxLength: 64 }
            },
            {
                codename: 'PrincipalId',
                dataType: 'STRING',
                name: vlc('Principal ID', 'ID субъекта'),
                isRequired: true,
                sortOrder: 4,
                validationRules: { maxLength: 128 },
                uiConfig: { hidden: true }
            },
            {
                codename: 'AccessLevel',
                dataType: 'STRING',
                name: vlc('Access Level', 'Уровень доступа'),
                isRequired: true,
                sortOrder: 5,
                validationRules: { maxLength: 32 }
            },
            {
                codename: 'InvitedBy',
                dataType: 'STRING',
                name: vlc('Invited By', 'Пригласил'),
                sortOrder: 6,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'InvitedAt',
                dataType: 'DATE',
                name: vlc('Invited At', 'Дата приглашения'),
                sortOrder: 7,
                validationRules: { dateComposition: 'datetime' }
            }
        ]
    },
    {
        codename: 'ContentStars',
        kind: 'object',
        name: vlc('Content Stars', 'Избранный контент'),
        description: vlc('User stars for Learning Content records.', 'Пользовательское избранное для учебного контента.'),
        components: [
            {
                codename: 'TargetObjectCodename',
                dataType: 'STRING',
                name: vlc('Target Object', 'Целевой объект'),
                isRequired: true,
                sortOrder: 1,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'TargetRecordId',
                dataType: 'STRING',
                name: vlc('Target Record', 'Целевая запись'),
                isRequired: true,
                sortOrder: 2,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'UserId',
                dataType: 'STRING',
                name: vlc('User ID', 'ID пользователя'),
                isRequired: true,
                sortOrder: 3,
                validationRules: { maxLength: 128 },
                uiConfig: { hidden: true }
            },
            {
                codename: 'StarredAt',
                dataType: 'DATE',
                name: vlc('Starred At', 'Дата добавления'),
                isRequired: true,
                sortOrder: 4,
                validationRules: { dateComposition: 'datetime' }
            }
        ]
    },
    {
        codename: 'RecentContentViews',
        kind: 'object',
        name: vlc('Recent Content Views', 'Недавние просмотры контента'),
        description: vlc('Recent Learning Content view facts by user.', 'Недавние просмотры учебного контента по пользователям.'),
        components: [
            {
                codename: 'TargetObjectCodename',
                dataType: 'STRING',
                name: vlc('Target Object', 'Целевой объект'),
                isRequired: true,
                sortOrder: 1,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'TargetRecordId',
                dataType: 'STRING',
                name: vlc('Target Record ID', 'ID целевой записи'),
                isRequired: true,
                sortOrder: 2,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'UserId',
                dataType: 'STRING',
                name: vlc('User ID', 'ID пользователя'),
                isRequired: true,
                sortOrder: 3,
                validationRules: { maxLength: 128 },
                uiConfig: { hidden: true }
            },
            {
                codename: 'ViewedAt',
                dataType: 'DATE',
                name: vlc('Viewed At', 'Дата просмотра'),
                isRequired: true,
                sortOrder: 4,
                validationRules: { dateComposition: 'datetime' }
            }
        ]
    },
    {
        codename: 'ContentProgress',
        kind: 'object',
        name: vlc('Content Progress', 'Прогресс по контенту'),
        description: vlc(
            'Server-owned Learning Content page/resource progress by runtime user.',
            'Серверный прогресс по страницам и ресурсам учебного контента для runtime-пользователей.'
        ),
        config: buildTransactionalObjectConfig({
            prefix: 'CPR-',
            effectiveDateField: 'CompletedAt',
            stateField: 'ProgressStatus',
            states: [
                { codename: 'NotStarted', title: 'Not Started', isInitial: true },
                { codename: 'InProgress', title: 'In Progress' },
                { codename: 'Completed', title: 'Completed', isFinal: true }
            ],
            targetLedgers: ['ProgressLedger']
        }),
        components: [
            {
                codename: 'TargetObjectCodename',
                dataType: 'STRING',
                name: vlc('Target Object', 'Целевой объект'),
                sortOrder: 1,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'TargetRecordId',
                dataType: 'STRING',
                name: vlc('Target Record ID', 'ID целевой записи'),
                sortOrder: 2,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'UserId',
                dataType: 'STRING',
                name: vlc('User ID', 'ID пользователя'),
                sortOrder: 3,
                validationRules: { maxLength: 128 },
                uiConfig: { hidden: true }
            },
            {
                codename: 'ProgressStudentId',
                dataType: 'REF',
                name: vlc('Student', 'Студент'),
                sortOrder: 4,
                targetEntityCodename: 'Students',
                targetEntityKind: 'object'
            },
            {
                codename: 'ContentNodeId',
                dataType: 'REF',
                name: vlc('Learning Resource', 'Учебный ресурс'),
                sortOrder: 5,
                targetEntityCodename: 'LearningResources',
                targetEntityKind: 'object'
            },
            {
                codename: 'DepartmentId',
                dataType: 'REF',
                name: vlc('Department', 'Подразделение'),
                sortOrder: 6,
                targetEntityCodename: 'Departments',
                targetEntityKind: 'object'
            },
            {
                codename: 'ProgressStatus',
                dataType: 'STRING',
                name: vlc('Status', 'Статус'),
                isRequired: true,
                sortOrder: 7,
                validationRules: { maxLength: 64 }
            },
            {
                codename: 'ProgressPercent',
                dataType: 'NUMBER',
                name: vlc('Progress %', 'Прогресс %'),
                isRequired: true,
                sortOrder: 8,
                validationRules: { min: 0, max: 100 }
            },
            {
                codename: 'StartedAt',
                dataType: 'DATE',
                name: vlc('Started At', 'Начато'),
                sortOrder: 9,
                validationRules: { dateComposition: 'datetime' }
            },
            {
                codename: 'CompletedAt',
                dataType: 'DATE',
                name: vlc('Completed At', 'Завершено'),
                sortOrder: 10,
                validationRules: { dateComposition: 'datetime' }
            },
            {
                codename: 'LastViewedAt',
                dataType: 'DATE',
                name: vlc('Last Viewed At', 'Последний просмотр'),
                sortOrder: 11,
                validationRules: { dateComposition: 'datetime' }
            },
            {
                codename: 'LastAccessedItemIndex',
                dataType: 'NUMBER',
                name: vlc('Last Accessed Item', 'Последний элемент'),
                sortOrder: 12
            }
        ]
    },
    {
        codename: 'TrashEntries',
        kind: 'object',
        name: vlc('Trash Entries', 'Корзина'),
        description: vlc(
            'Object projection for deleted Learning Content records that can be restored from the workspace Trash.',
            'Объектная проекция удаленного учебного контента для восстановления из корзины рабочего пространства.'
        ),
        components: [
            {
                codename: 'TargetObjectCodename',
                dataType: 'STRING',
                name: vlc('Target Object', 'Целевой объект'),
                isRequired: true,
                sortOrder: 1,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'TargetRecordId',
                dataType: 'STRING',
                name: vlc('Target Record ID', 'ID целевой записи'),
                isRequired: true,
                sortOrder: 2,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'DeletedBy',
                dataType: 'STRING',
                name: vlc('Deleted By', 'Удалил'),
                sortOrder: 3,
                validationRules: { maxLength: 128 }
            },
            {
                codename: 'DeletedAt',
                dataType: 'DATE',
                name: vlc('Deleted At', 'Дата удаления'),
                isRequired: true,
                sortOrder: 4,
                validationRules: { dateComposition: 'datetime' }
            },
            {
                codename: 'ExpiresAt',
                dataType: 'DATE',
                name: vlc('Expires At', 'Истекает'),
                sortOrder: 5,
                validationRules: { dateComposition: 'datetime' }
            },
            {
                codename: 'RestoreState',
                dataType: 'STRING',
                name: vlc('Restore State', 'Состояние восстановления'),
                sortOrder: 6,
                validationRules: { maxLength: 64 }
            }
        ]
    }
]
