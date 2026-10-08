import type { LmsTemplateEntity } from './lms.seed-entity-helpers'
import { vlc } from './basic.template'
import { LMS_LEARNING_RESOURCE_PUBLICATION_WORKFLOW_ACTIONS } from './lms.seed-workflows'

export const lmsSeedLearningEntities: LmsTemplateEntity[] = [
    {
        codename: 'LearningResources',
        kind: 'object',
        name: vlc('Learning Resources', 'Учебные ресурсы'),
        description: vlc(
            'Reusable content resources such as pages, links, videos, documents, embeds, and deferred package standards.',
            'Переиспользуемые учебные ресурсы: страницы, ссылки, видео, документы, встраивания и отложенные пакетные стандарты.'
        ),
        config: {
            workflowActions: LMS_LEARNING_RESOURCE_PUBLICATION_WORKFLOW_ACTIONS,
            runtimeLibrary: {
                projection: {
                    displayType: 'resource',
                    titleFieldCodename: 'Title',
                    statusFieldCodename: 'PublicationStatus',
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
                validationRules: { maxLength: 255, localized: true, versioned: true },
                uiConfig: {
                    syncTargets: [{ fieldId: 'Name', manualFlagFieldId: 'NameManuallyEdited' }]
                }
            },
            {
                codename: 'Name',
                dataType: 'STRING',
                name: vlc('Name', 'Название страницы'),
                sortOrder: 3,
                validationRules: { maxLength: 500 }
            },
            {
                codename: 'NameManuallyEdited',
                dataType: 'BOOLEAN',
                name: vlc('Name Manually Edited', 'Название изменено вручную'),
                sortOrder: 4,
                uiConfig: {
                    hidden: true
                }
            },
            {
                codename: 'ResourceType',
                dataType: 'REF',
                name: vlc('Resource Type', 'Тип ресурса'),
                isRequired: true,
                sortOrder: 5,
                targetEntityCodename: 'ResourceType',
                targetEntityKind: 'enumeration'
            },
            {
                codename: 'Source',
                dataType: 'JSON',
                name: vlc('Source', 'Источник'),
                isRequired: true,
                sortOrder: 6,
                uiConfig: {
                    widget: 'resourceSource',
                    autoPageCodename: {
                        sourceFields: ['Name', 'Title']
                    },
                    gridHidden: true
                }
            },
            {
                codename: 'Body',
                dataType: 'JSON',
                name: vlc('Body', 'Содержимое'),
                sortOrder: 7,
                uiConfig: {
                    gridHidden: true,
                    widget: 'editorjsBlockContent',
                    blockEditor: {
                        allowedBlockTypes: ['paragraph', 'header', 'list', 'quote', 'table', 'image', 'embed', 'delimiter'],
                        maxBlocks: 200
                    }
                }
            },
            {
                codename: 'PublicationStatus',
                dataType: 'REF',
                name: vlc('Publication Status', 'Статус публикации'),
                sortOrder: 8,
                targetEntityCodename: 'PublicationStatus',
                targetEntityKind: 'enumeration'
            },
            {
                codename: 'EstimatedTimeMinutes',
                dataType: 'NUMBER',
                name: vlc('Estimated Time, min', 'Оценочное время, мин'),
                sortOrder: 9,
                validationRules: { min: 0 }
            },
            {
                codename: 'Language',
                dataType: 'STRING',
                name: vlc('Language', 'Язык'),
                sortOrder: 10,
                validationRules: { maxLength: 16 }
            },
            {
                codename: 'Version',
                dataType: 'STRING',
                name: vlc('Version', 'Версия'),
                sortOrder: 11,
                validationRules: { maxLength: 64 }
            },
            {
                codename: 'Thumbnail',
                dataType: 'JSON',
                name: vlc('Thumbnail', 'Миниатюра'),
                sortOrder: 12,
                uiConfig: {
                    widget: 'resourceSource',
                    gridHidden: true
                }
            },
            {
                codename: 'CreatedBy',
                dataType: 'STRING',
                name: vlc('Created By', 'Создал'),
                sortOrder: 13,
                validationRules: { maxLength: 128 },
                uiConfig: { hidden: true }
            },
            {
                codename: 'Instructor',
                dataType: 'STRING',
                name: vlc('Instructor', 'Преподаватель'),
                sortOrder: 14,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'ContentItems',
                dataType: 'TABLE',
                name: vlc('Content Items', 'Элементы контента'),
                sortOrder: 15,
                childComponents: [
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
                        dataType: 'REF',
                        name: vlc('Quiz', 'Тест'),
                        sortOrder: 4,
                        targetEntityCodename: 'Quizzes',
                        targetEntityKind: 'object'
                    },
                    {
                        codename: 'SortOrder',
                        dataType: 'NUMBER',
                        name: vlc('Sort Order', 'Порядок'),
                        sortOrder: 5
                    }
                ]
            },
            {
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                isRequired: true,
                sortOrder: 16,
                validationRules: { min: 0 },
                uiConfig: { defaultValue: 0 }
            }
        ]
    },
    {
        codename: 'Courses',
        kind: 'object',
        name: vlc('Courses', 'Курсы'),
        description: vlc(
            'Courses that group ordered sections and Learning Content items.',
            'Курсы, объединяющие упорядоченные разделы и элементы учебного контента.'
        ),
        hubs: ['Learning'],
        config: {
            runtimeLibrary: {
                projection: {
                    displayType: 'course',
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
                        objectCodename: 'CourseSections',
                        parentFieldCodename: 'CourseId',
                        orderFieldCodename: 'SortOrder'
                    },
                    {
                        objectCodename: 'CourseItems',
                        parentFieldCodename: 'CourseId',
                        orderFieldCodename: 'SortOrder',
                        refRemaps: [
                            {
                                fieldCodename: 'SectionId',
                                sourceObjectCodename: 'CourseSections'
                            }
                        ]
                    }
                ]
            },
            runtime: {
                menuVisibility: 'primary',
                icon: 'school'
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
                codename: 'NavigationMode',
                dataType: 'STRING',
                name: vlc('Navigation Mode', 'Режим навигации'),
                sortOrder: 5,
                validationRules: { maxLength: 32 },
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'free', label: vlc('Free', 'Свободная') },
                        { value: 'sequential', label: vlc('Sequential', 'Последовательная') }
                    ]
                }
            },
            {
                codename: 'CompletionCondition',
                dataType: 'STRING',
                name: vlc('Completion Condition', 'Условие завершения'),
                sortOrder: 6,
                validationRules: { maxLength: 64 },
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'allItems', label: vlc('All items', 'Все элементы') },
                        { value: 'selectedItems', label: vlc('Selected items', 'Выбранные элементы') }
                    ]
                }
            },
            {
                codename: 'StatusFormat',
                dataType: 'STRING',
                name: vlc('Status Format', 'Формат статуса'),
                sortOrder: 7,
                validationRules: { maxLength: 64 },
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'completeIncomplete', label: vlc('Complete / Incomplete', 'Завершен / Не завершен') },
                        { value: 'passedFailed', label: vlc('Passed / Failed', 'Пройден / Не пройден') }
                    ]
                }
            },
            {
                codename: 'Cover',
                dataType: 'JSON',
                name: vlc('Cover', 'Обложка'),
                sortOrder: 8,
                uiConfig: {
                    widget: 'resourceSource',
                    gridHidden: true
                }
            },
            {
                codename: 'Instructor',
                dataType: 'STRING',
                name: vlc('Instructor', 'Преподаватель'),
                sortOrder: 9,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'Tags',
                dataType: 'STRING',
                name: vlc('Tags', 'Теги'),
                sortOrder: 10,
                validationRules: { maxLength: 500 }
            },
            {
                codename: 'CatalogVisible',
                dataType: 'BOOLEAN',
                name: vlc('Catalog Visible', 'Показывать в каталоге'),
                sortOrder: 11
            },
            {
                codename: 'CatalogCategory',
                dataType: 'STRING',
                name: vlc('Catalog Category', 'Категория каталога'),
                sortOrder: 12,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'CatalogAudience',
                dataType: 'STRING',
                name: vlc('Catalog Audience', 'Аудитория каталога'),
                sortOrder: 13,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'SelfEnrollmentMode',
                dataType: 'STRING',
                name: vlc('Self-Enrollment Mode', 'Режим самостоятельной записи'),
                sortOrder: 14,
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
                codename: 'EstimatedTimeMinutes',
                dataType: 'NUMBER',
                name: vlc('Estimated Time, min', 'Оценочное время, мин'),
                sortOrder: 15,
                validationRules: { min: 0 }
            },
            {
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                isRequired: true,
                sortOrder: 16,
                validationRules: { min: 0 }
            }
        ]
    },
    {
        codename: 'CourseSections',
        kind: 'object',
        name: vlc('Course Sections', 'Разделы курса'),
        description: vlc('Ordered sections inside courses.', 'Упорядоченные разделы внутри курсов.'),
        config: {
            runtimeRecordParentAccess: {
                mode: 'parentRecord',
                parentObjectCodename: 'Courses',
                parentFieldCodename: 'CourseId'
            }
        },
        components: [
            {
                codename: 'CourseId',
                dataType: 'REF',
                name: vlc('Course', 'Курс'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'Courses',
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
                validationRules: { localized: true, versioned: true },
                uiConfig: { widget: 'textarea', rows: 2 }
            },
            {
                isRequired: true,
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                sortOrder: 4,
                validationRules: { min: 0 },
                uiConfig: { serverOwned: true, formHidden: true, gridHidden: true }
            }
        ]
    },
    {
        codename: 'CourseItems',
        kind: 'object',
        name: vlc('Course Items', 'Элементы курса'),
        description: vlc(
            'Ordered polymorphic content references inside course sections.',
            'Упорядоченные полиморфные ссылки на контент внутри разделов курса.'
        ),
        config: {
            runtimeRecordParentAccess: {
                mode: 'parentRecord',
                parentObjectCodename: 'Courses',
                parentFieldCodename: 'CourseId'
            },
            runtimeProgress: {
                sequencePolicy: {
                    mode: 'sequential',
                    scopeFieldCodename: 'CourseId',
                    orderFieldCodename: 'SortOrder'
                },
                aggregateParents: [
                    {
                        parentObjectCodename: 'Courses',
                        parentIdFieldCodename: 'CourseId',
                        itemWeightFieldCodename: 'CompletionWeight',
                        itemRequiredFieldCodename: 'IsRequired',
                        requiredOnly: true
                    }
                ]
            }
        },
        components: [
            {
                codename: 'CourseId',
                dataType: 'REF',
                name: vlc('Course', 'Курс'),
                isRequired: true,
                sortOrder: 1,
                targetEntityCodename: 'Courses',
                targetEntityKind: 'object',
                uiConfig: { serverOwned: true, formHidden: true, gridHidden: true }
            },
            {
                codename: 'SectionId',
                dataType: 'REF',
                name: vlc('Section', 'Раздел'),
                sortOrder: 2,
                targetEntityCodename: 'CourseSections',
                targetEntityKind: 'object',
                uiConfig: { gridHidden: true }
            },
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Заголовок'),
                isRequired: true,
                isDisplayComponent: true,
                sortOrder: 3,
                validationRules: { maxLength: 255, localized: true, versioned: true }
            },
            {
                codename: 'TargetObjectCodename',
                dataType: 'STRING',
                name: vlc('Target Object', 'Целевой объект'),
                isRequired: true,
                sortOrder: 4,
                validationRules: { maxLength: 128 },
                uiConfig: {
                    widget: 'select',
                    stringOptions: [
                        { value: 'LearningResources', label: vlc('Learning Resources', 'Учебные ресурсы') },
                        { value: 'Quizzes', label: vlc('Quizzes', 'Тесты') }
                    ]
                }
            },
            {
                codename: 'TargetRecordId',
                dataType: 'STRING',
                name: vlc('Target Record', 'Целевая запись'),
                isRequired: true,
                sortOrder: 5,
                validationRules: { maxLength: 128 },
                uiConfig: {
                    gridHidden: true,
                    widget: 'runtimeRecordPicker',
                    runtimeRecordPicker: {
                        targetObjectCodenameField: 'TargetObjectCodename',
                        allowedObjectCodenames: ['LearningResources', 'Quizzes'],
                        labelFields: ['Title', 'Name'],
                        limit: 100
                    }
                }
            },
            {
                codename: 'ItemType',
                dataType: 'STRING',
                name: vlc('Item Type', 'Тип элемента'),
                isRequired: true,
                sortOrder: 6,
                validationRules: { maxLength: 64 }
            },
            {
                codename: 'SortOrder',
                dataType: 'NUMBER',
                name: vlc('Sort Order', 'Порядок'),
                isRequired: true,
                sortOrder: 7,
                validationRules: { min: 0 },
                uiConfig: { serverOwned: true, formHidden: true, gridHidden: true }
            },
            {
                codename: 'IsRequired',
                dataType: 'BOOLEAN',
                name: vlc('Required', 'Обязательно'),
                sortOrder: 8
            },
            {
                codename: 'CompletionWeight',
                dataType: 'NUMBER',
                name: vlc('Completion Weight', 'Вес завершения'),
                sortOrder: 9,
                validationRules: { min: 0 }
            },
            {
                codename: 'AvailabilityOverride',
                dataType: 'JSON',
                name: vlc('Availability Override', 'Переопределение доступности'),
                sortOrder: 10,
                uiConfig: { formHidden: true, gridHidden: true }
            },
            {
                codename: 'EstimatedTimeMinutes',
                dataType: 'NUMBER',
                name: vlc('Estimated Time, min', 'Оценочное время, мин'),
                sortOrder: 11,
                validationRules: { min: 0 }
            }
        ]
    }
]
