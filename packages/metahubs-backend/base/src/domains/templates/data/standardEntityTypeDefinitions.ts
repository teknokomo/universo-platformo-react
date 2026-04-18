import type { ComponentManifest, EntityTypeUIConfig, PresetDefaultInstance } from '@universo/types'
import { vlc } from './basic.template'

export const STANDARD_HUB_NAME = vlc('Hubs', 'Хабы')
export const STANDARD_HUB_DESCRIPTION = vlc(
    'Standard hub entity type for organizing metahub content with design-time automation hooks.',
    'Стандартный тип хаба для организации контента метахаба и design-time автоматизации.'
)

export const STANDARD_CATALOG_NAME = vlc('Catalogs', 'Каталоги')
export const STANDARD_CATALOG_DESCRIPTION = vlc(
    'Standard catalog entity type with schema, hierarchy, references, scripts, and runtime layout support.',
    'Стандартный тип каталога со схемой, иерархией, связями, скриптами и поддержкой runtime layout.'
)

export const STANDARD_SET_NAME = vlc('Sets', 'Наборы')
export const STANDARD_SET_DESCRIPTION = vlc(
    'Standard set entity type for typed fixed values and design-time automation.',
    'Стандартный тип набора для типизированных фиксированных значений и design-time автоматизации.'
)

export const STANDARD_ENUMERATION_NAME = vlc('Enumerations', 'Перечисления')
export const STANDARD_ENUMERATION_DESCRIPTION = vlc(
    'Standard enumeration entity type for enumerated values and design-time automation.',
    'Стандартный тип перечисления для перечислимых значений и design-time автоматизации.'
)

export const HUB_TYPE_COMPONENTS: ComponentManifest = {
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

export const HUB_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconHierarchy',
    tabs: ['general'],
    sidebarSection: 'objects',
    sidebarOrder: 10,
    nameKey: 'metahubs:hubs.title'
}

const FIELD_DEFINITIONS_RESOURCE_SURFACE: NonNullable<EntityTypeUIConfig['resourceSurfaces']>[number] = {
    key: 'fieldDefinitions',
    capability: 'dataSchema',
    routeSegment: 'field-definitions',
    titleKey: 'metahubs:fieldDefinitions.resourceTabTitle',
    fallbackTitle: 'Attributes'
}

export const CATALOG_TYPE_COMPONENTS: ComponentManifest = {
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

export const CATALOG_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconDatabase',
    tabs: ['general', 'hubs', 'layout', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 20,
    nameKey: 'metahubs:catalogs.title',
    resourceSurfaces: [FIELD_DEFINITIONS_RESOURCE_SURFACE]
}

export const SET_TYPE_COMPONENTS: ComponentManifest = {
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

export const SET_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconFileText',
    tabs: ['general', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 30,
    nameKey: 'metahubs:sets.title',
    resourceSurfaces: [
        {
            key: 'fixedValues',
            capability: 'fixedValues',
            routeSegment: 'fixed-values',
            titleKey: 'metahubs:fixedValues.resourceTabTitle',
            fallbackTitle: 'Constants'
        }
    ]
}

export const ENUMERATION_TYPE_COMPONENTS: ComponentManifest = {
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

export const ENUMERATION_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconFiles',
    tabs: ['general', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 40,
    nameKey: 'metahubs:enumerations.title',
    resourceSurfaces: [
        {
            key: 'optionValues',
            capability: 'optionValues',
            routeSegment: 'values',
            titleKey: 'metahubs:optionValues.resourceTabTitle',
            fallbackTitle: 'Values'
        }
    ]
}

export const HUB_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
    {
        codename: 'MainHub',
        name: vlc('Main', 'Основной'),
        description: vlc('Main hub for organizing metahub content', 'Основной хаб для организации контента метахаба')
    }
]

export const CATALOG_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
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

export const SET_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
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

export const ENUMERATION_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
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
