import type { LmsTemplateEntity } from './lms.seed-entity-helpers'
import { vlc } from './basic.template'

export const lmsSeedTrackEntities: LmsTemplateEntity[] = [
    {
        codename: 'LearningTracks',
        kind: 'object',
        name: vlc('Learning Tracks', 'Учебные треки'),
        description: vlc('Ordered programs that combine courses into stages.', 'Последовательные программы, объединяющие курсы по этапам.'),
        hubs: ['Learning'],
        config: {
            runtimeLibrary: {
                projection: {
                    displayType: 'track',
                    titleFieldCodename: 'Title',
                    statusFieldCodename: 'Status',
                    projectFieldCodename: 'ProjectId',
                    projectedFieldCodenames: ['Instructor']
                },
                recent: {
                    objectCodename: 'RecentContentViews',
                    targetObjectFieldCodename: 'TargetObjectCodename',
                    targetRecordFieldCodename: 'TargetRecordId',
                    actorFieldCodename: 'UserId',
                    timestampFieldCodename: 'ViewedAt'
                },
                starred: {
                    objectCodename: 'ContentStars',
                    targetObjectFieldCodename: 'TargetObjectCodename',
                    targetRecordFieldCodename: 'TargetRecordId',
                    actorFieldCodename: 'UserId',
                    timestampFieldCodename: 'StarredAt'
                },
                shared: {
                    objectCodename: 'ContentAccessEntries',
                    targetObjectFieldCodename: 'TargetObjectCodename',
                    targetRecordFieldCodename: 'TargetRecordId',
                    principalTypeFieldCodename: 'PrincipalType',
                    principalIdFieldCodename: 'PrincipalId',
                    accessLevelFieldCodename: 'AccessLevel',
                    defaultAccessLevel: 'canView',
                    timestampFieldCodename: 'InvitedAt',
                    allowedPrincipalTypes: ['workspaceMember', 'user']
                }
            },
            runtimeRecordAccess: {
                mode: 'ownerOrShared',
                ownerColumnName: '_upl_created_by',
                sharedRelationKey: 'shared'
            },
            runtimeCopy: {
                relations: [
                    {
                        objectCodename: 'TrackStages',
                        parentFieldCodename: 'TrackId',
                        orderFieldCodename: 'SortOrder'
                    },
                    {
                        objectCodename: 'TrackSteps',
                        parentFieldCodename: 'TrackId',
                        orderFieldCodename: 'SortOrder',
                        refRemaps: [
                            {
                                fieldCodename: 'StageId',
                                sourceObjectCodename: 'TrackStages'
                            }
                        ]
                    }
                ]
            },
            runtime: {
                menuVisibility: 'primary',
                icon: 'tasks'
            }
        },
        components: [
            {
                codename: 'ProjectId',
                dataType: 'REF',
                name: vlc('Project', 'Проект'),
                sortOrder: 1,
                targetEntityCodename: 'ContentProjects',
                targetEntityKind: 'object'
            },
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 2,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'Description',
                dataType: 'STRING',
                name: vlc('Description', 'Описание'),
                sortOrder: 3,
                validationRules: { localized: true, versioned: true },
                uiConfig: { widget: 'textarea', rows: 2 }
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
                codename: 'OrderMode',
                dataType: 'STRING',
                name: vlc('Order Mode', 'Режим порядка'),
                sortOrder: 5,
                validationRules: { maxLength: 32 },
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'byDays', label: vlc('By days', 'По дням') },
                        { value: 'sequential', label: vlc('Sequential', 'Последовательно') },
                        { value: 'free', label: vlc('Free', 'Свободно') }
                    ]
                }
            },
            {
                codename: 'Cover',
                dataType: 'JSON',
                name: vlc('Cover', 'Обложка'),
                sortOrder: 6,
                uiConfig: {
                    widget: 'resourceSource',
                    gridHidden: true
                }
            },
            {
                codename: 'Instructor',
                dataType: 'STRING',
                name: vlc('Instructor', 'Преподаватель'),
                sortOrder: 7,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'Tags',
                dataType: 'STRING',
                name: vlc('Tags', 'Теги'),
                sortOrder: 8,
                validationRules: { maxLength: 500 }
            },
            {
                codename: 'CatalogVisible',
                dataType: 'BOOLEAN',
                name: vlc('Catalog Visible', 'Показывать в каталоге'),
                sortOrder: 9
            },
            {
                codename: 'CatalogCategory',
                dataType: 'STRING',
                name: vlc('Catalog Category', 'Категория каталога'),
                sortOrder: 10,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'CatalogAudience',
                dataType: 'STRING',
                name: vlc('Catalog Audience', 'Аудитория каталога'),
                sortOrder: 11,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'SelfEnrollmentMode',
                dataType: 'STRING',
                name: vlc('Self-Enrollment Mode', 'Режим самостоятельной записи'),
                sortOrder: 12,
                validationRules: { maxLength: 32 },
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'disabled', label: vlc('Disabled', 'Отключена') },
                        { value: 'open', label: vlc('Open', 'Открытая') }
                    ]
                }
            },
            {
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                isRequired: true,
                sortOrder: 13,
                validationRules: { min: 0 },
                uiConfig: { serverOwned: true, formHidden: true, gridHidden: true }
            }
        ]
    },
    {
        codename: 'TrackStages',
        kind: 'object',
        name: vlc('Track Stages', 'Этапы трека'),
        description: vlc('Ordered stage headers inside learning tracks.', 'Упорядоченные этапы внутри учебных треков.'),
        config: {
            runtimeRecordParentAccess: {
                mode: 'parentRecord',
                parentObjectCodename: 'LearningTracks',
                parentFieldCodename: 'TrackId'
            }
        },
        components: [
            {
                codename: 'TrackId',
                dataType: 'REF',
                name: vlc('Learning Track', 'Учебный трек'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'LearningTracks',
                targetEntityKind: 'object',
                uiConfig: { serverOwned: true, formHidden: true, gridHidden: true }
            },
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
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
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                isRequired: true,
                sortOrder: 4,
                validationRules: { min: 0 },
                uiConfig: { serverOwned: true, formHidden: true, gridHidden: true }
            }
        ]
    },
    {
        codename: 'TrackSteps',
        kind: 'object',
        name: vlc('Track Steps', 'Шаги трека'),
        description: vlc(
            'Reusable ordered steps for learning track progression and prerequisite checks.',
            'Переиспользуемые упорядоченные шаги учебных треков и проверок prerequisites.'
        ),
        config: {
            runtimeRecordParentAccess: {
                mode: 'parentRecord',
                parentObjectCodename: 'LearningTracks',
                parentFieldCodename: 'TrackId'
            },
            runtimeProgress: {
                sequencePolicy: {
                    mode: 'sequential',
                    scopeFieldCodename: 'TrackId',
                    orderFieldCodename: 'SortOrder'
                },
                aggregateParents: [
                    {
                        parentObjectCodename: 'LearningTracks',
                        parentIdFieldCodename: 'TrackId',
                        itemRequiredFieldCodename: 'IsRequired',
                        requiredOnly: true
                    }
                ]
            }
        },
        components: [
            {
                codename: 'TrackId',
                dataType: 'REF',
                name: vlc('Learning Track', 'Учебный трек'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'LearningTracks',
                targetEntityKind: 'object',
                uiConfig: { serverOwned: true, formHidden: true, gridHidden: true }
            },
            {
                codename: 'StageId',
                dataType: 'REF',
                name: vlc('Stage', 'Этап'),
                sortOrder: 2,
                targetEntityCodename: 'TrackStages',
                targetEntityKind: 'object',
                uiConfig: { gridHidden: true }
            },
            {
                codename: 'CourseId',
                dataType: 'REF',
                name: vlc('Course', 'Курс'),
                isRequired: true,
                sortOrder: 3,
                targetEntityCodename: 'Courses',
                targetEntityKind: 'object',
                uiConfig: { gridHidden: true }
            },
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 4,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                isRequired: true,
                sortOrder: 5,
                validationRules: { min: 0 },
                uiConfig: { serverOwned: true, formHidden: true, gridHidden: true }
            },
            {
                codename: 'EnrollmentOffsetDays',
                dataType: 'NUMBER',
                name: vlc('Enrollment Offset Days', 'Смещение зачисления, дни'),
                sortOrder: 6,
                validationRules: { min: 0 }
            },
            {
                codename: 'DueOffsetDays',
                dataType: 'NUMBER',
                name: vlc('Due Offset Days', 'Срок выполнения, дни'),
                sortOrder: 7,
                validationRules: { min: 0 }
            },
            {
                codename: 'RestrictAfterDueDate',
                dataType: 'BOOLEAN',
                name: vlc('Restrict After Due Date', 'Ограничить после срока'),
                sortOrder: 8
            },
            {
                codename: 'IsRequired',
                dataType: 'BOOLEAN',
                name: vlc('Required', 'Обязательно'),
                sortOrder: 9
            }
        ]
    }
]
