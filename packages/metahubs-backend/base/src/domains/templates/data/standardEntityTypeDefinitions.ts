import type { ComponentManifest, EntityTypeUIConfig, PresetDefaultInstance } from '@universo/types'
import { vlc } from './basic.template'

export const STANDARD_TREE_ENTITY_NAME = vlc('Tree Entities', 'Древовидные сущности')
export const STANDARD_TREE_ENTITY_DESCRIPTION = vlc(
    'Standard tree entity type for organizing metahub content with design-time automation hooks.',
    'Стандартный тип древовидной сущности для организации контента метахаба и design-time автоматизации.'
)

export const STANDARD_LINKED_COLLECTION_NAME = vlc('Linked Collections', 'Связанные коллекции')
export const STANDARD_LINKED_COLLECTION_DESCRIPTION = vlc(
    'Standard linked collection entity type with schema, hierarchy, references, scripts, and runtime layout support.',
    'Стандартный тип связанной коллекции со схемой, иерархией, связями, скриптами и поддержкой runtime layout.'
)

export const STANDARD_VALUE_GROUP_NAME = vlc('Value Groups', 'Группы значений')
export const STANDARD_VALUE_GROUP_DESCRIPTION = vlc(
    'Standard value group entity type for typed fixed values and design-time automation.',
    'Стандартный тип группы значений для типизированных фиксированных значений и design-time автоматизации.'
)

export const STANDARD_OPTION_LIST_NAME = vlc('Option Lists', 'Списки опций')
export const STANDARD_OPTION_LIST_DESCRIPTION = vlc(
    'Standard option list entity type for enumerated values and design-time automation.',
    'Стандартный тип списка опций для перечислимых значений и design-time автоматизации.'
)

export const TREE_ENTITY_TYPE_COMPONENTS: ComponentManifest = {
    dataSchema: false,
    records: false,
    treeAssignment: false,
    optionValues: false,
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: false,
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    layoutConfig: false,
    runtimeBehavior: false,
    physicalTable: false
}

export const TREE_ENTITY_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconHierarchy',
    tabs: ['general'],
    sidebarSection: 'objects',
    sidebarOrder: 10,
    nameKey: 'metahubs:treeEntities.title'
}

export const LINKED_COLLECTION_TYPE_COMPONENTS: ComponentManifest = {
    dataSchema: { enabled: true },
    records: { enabled: true },
    treeAssignment: { enabled: true },
    optionValues: false,
    fixedValues: false,
    hierarchy: { enabled: true, supportsFolders: true },
    nestedCollections: false,
    relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix: 'cat' }
}

export const LINKED_COLLECTION_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconDatabase',
    tabs: ['general', 'hubs', 'layout', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 20,
    nameKey: 'metahubs:linkedCollections.title'
}

export const VALUE_GROUP_TYPE_COMPONENTS: ComponentManifest = {
    dataSchema: { enabled: true },
    records: false,
    treeAssignment: false,
    optionValues: false,
    fixedValues: { enabled: true },
    hierarchy: false,
    nestedCollections: false,
    relations: false,
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    layoutConfig: { enabled: true },
    runtimeBehavior: false,
    physicalTable: false
}

export const VALUE_GROUP_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconFileText',
    tabs: ['general', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 30,
    nameKey: 'metahubs:valueGroups.title'
}

export const OPTION_LIST_TYPE_COMPONENTS: ComponentManifest = {
    dataSchema: false,
    records: false,
    treeAssignment: false,
    optionValues: { enabled: true },
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: false,
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    layoutConfig: false,
    runtimeBehavior: false,
    physicalTable: false
}

export const OPTION_LIST_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconFiles',
    tabs: ['general', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 40,
    nameKey: 'metahubs:optionLists.title'
}

export const TREE_ENTITY_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
    {
        codename: 'MainHub',
        name: vlc('Main', 'Основной'),
        description: vlc('Main hub for organizing metahub content', 'Основной хаб для организации контента метахаба')
    }
]

export const LINKED_COLLECTION_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
    {
        codename: 'MainCatalog',
        name: vlc('Main', 'Основной'),
        description: vlc('Main catalog for storing records', 'Основной каталог для хранения записей'),
        attributes: [
            {
                codename: 'Title',
                dataType: 'STRING',
                name: vlc('Title', 'Название'),
                sortOrder: 1,
                isDisplayAttribute: true,
                validationRules: { maxLength: 255 },
                uiConfig: { isDisplay: true }
            },
            {
                codename: 'Description',
                dataType: 'STRING',
                name: vlc('Description', 'Описание'),
                sortOrder: 2
            }
        ]
    }
]

export const VALUE_GROUP_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
    {
        codename: 'MainSet',
        name: vlc('Main', 'Основной'),
        description: vlc(
            'Main set for storing constants and typed values',
            'Основной набор для хранения констант и типизированных значений'
        ),
        fixedValues: [
            {
                codename: 'AppName',
                dataType: 'STRING',
                name: vlc('Application Name', 'Название приложения'),
                sortOrder: 1,
                value: 'My Application'
            }
        ]
    }
]

export const OPTION_LIST_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
    {
        codename: 'MainEnumeration',
        name: vlc('Main', 'Основное'),
        description: vlc('Main enumeration for fixed values', 'Основное перечисление для фиксированных значений'),
        optionValues: [
            {
                codename: 'Active',
                name: vlc('Active', 'Активный'),
                sortOrder: 1,
                isDefault: true
            },
            {
                codename: 'Inactive',
                name: vlc('Inactive', 'Неактивный'),
                sortOrder: 2
            }
        ]
    }
]
