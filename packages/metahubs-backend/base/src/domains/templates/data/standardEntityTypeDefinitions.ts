import { DEFAULT_LEDGER_CONFIG, type ComponentManifest, type EntityTypeUIConfig, type PresetDefaultInstance } from '@universo/types'
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

export const STANDARD_PAGE_NAME = vlc('Pages', 'Страницы')
export const STANDARD_PAGE_DESCRIPTION = vlc(
    'Standard page entity type for structured block content stored on metadata objects.',
    'Стандартный тип страницы для структурированного блочного контента, хранящегося в объектах метаданных.'
)

export const STANDARD_LEDGER_NAME = vlc('Ledgers', 'Регистры')
export const STANDARD_LEDGER_DESCRIPTION = vlc(
    'Standard ledger entity type for append-only facts, dimensions, resources, and projection-based reporting.',
    'Стандартный тип регистра для неизменяемых фактов, измерений, ресурсов и отчетов на основе проекций.'
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
    blockContent: false,
    layoutConfig: false,
    runtimeBehavior: false,
    physicalTable: false,
    identityFields: false,
    recordLifecycle: false,
    posting: false,
    ledgerSchema: false
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
    title: vlc('Attributes', 'Атрибуты'),
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
    blockContent: false,
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix: 'cat' },
    identityFields: { enabled: true, allowNumber: true, allowEffectiveDate: true },
    recordLifecycle: { enabled: true, allowCustomStates: true },
    posting: { enabled: true, allowManualPosting: true, allowAutomaticPosting: true },
    ledgerSchema: { enabled: true, allowProjections: true, allowRegistrarPolicy: true, allowManualFacts: true }
}

export const CATALOG_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconDatabase',
    tabs: ['general', 'behavior', 'ledgerSchema', 'hubs', 'layout', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 30,
    nameKey: 'metahubs:catalogs.title',
    resourceSurfaces: [FIELD_DEFINITIONS_RESOURCE_SURFACE]
}

export const SET_TYPE_COMPONENTS: ComponentManifest = {
    dataSchema: { enabled: true },
    records: false,
    treeAssignment: { enabled: true },
    optionValues: false,
    fixedValues: { enabled: true },
    hierarchy: false,
    nestedCollections: false,
    relations: false,
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    blockContent: false,
    layoutConfig: { enabled: true },
    runtimeBehavior: false,
    physicalTable: false,
    identityFields: false,
    recordLifecycle: false,
    posting: false,
    ledgerSchema: false
}

export const SET_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconStack2',
    tabs: ['general', 'hubs', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 40,
    nameKey: 'metahubs:sets.title',
    resourceSurfaces: [
        {
            key: 'fixedValues',
            capability: 'fixedValues',
            routeSegment: 'fixed-values',
            title: vlc('Constants', 'Константы'),
            titleKey: 'metahubs:fixedValues.resourceTabTitle',
            fallbackTitle: 'Constants'
        }
    ]
}

export const ENUMERATION_TYPE_COMPONENTS: ComponentManifest = {
    dataSchema: false,
    records: false,
    treeAssignment: { enabled: true },
    optionValues: { enabled: true },
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: false,
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    blockContent: false,
    layoutConfig: false,
    runtimeBehavior: false,
    physicalTable: false,
    identityFields: false,
    recordLifecycle: false,
    posting: false,
    ledgerSchema: false
}

export const ENUMERATION_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconFiles',
    tabs: ['general', 'hubs', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 50,
    nameKey: 'metahubs:enumerations.title',
    resourceSurfaces: [
        {
            key: 'optionValues',
            capability: 'optionValues',
            routeSegment: 'values',
            title: vlc('Values', 'Значения'),
            titleKey: 'metahubs:optionValues.resourceTabTitle',
            fallbackTitle: 'Values'
        }
    ]
}

export const PAGE_TYPE_COMPONENTS: ComponentManifest = {
    dataSchema: false,
    records: false,
    treeAssignment: { enabled: true, isSingleHub: false, isRequiredHub: false },
    optionValues: false,
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: false,
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    blockContent: {
        enabled: true,
        storage: 'objectConfig',
        defaultFormat: 'editorjs',
        supportedFormats: ['editorjs'],
        allowedBlockTypes: ['paragraph', 'header', 'list', 'quote', 'table', 'image', 'embed', 'delimiter'],
        maxBlocks: 500
    },
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: false,
    identityFields: false,
    recordLifecycle: false,
    posting: false,
    ledgerSchema: false
}

export const PAGE_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconFileText',
    tabs: ['general', 'hubs', 'content', 'layout', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 20,
    nameKey: 'metahubs:pages.title'
}

export const LEDGER_TYPE_COMPONENTS: ComponentManifest = {
    dataSchema: { enabled: true },
    records: false,
    treeAssignment: { enabled: true },
    optionValues: false,
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    blockContent: false,
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix: 'led' },
    identityFields: false,
    recordLifecycle: false,
    posting: false,
    ledgerSchema: { enabled: true, allowProjections: true, allowRegistrarPolicy: true, allowManualFacts: false }
}

export const LEDGER_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconReceipt',
    tabs: ['general', 'ledgerSchema', 'hubs', 'layout', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 60,
    nameKey: 'metahubs:ledgers.title',
    resourceSurfaces: [FIELD_DEFINITIONS_RESOURCE_SURFACE]
}

export const LEDGER_TYPE_CONFIG = {
    ledger: DEFAULT_LEDGER_CONFIG
}

export const HUB_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
    {
        codename: 'MainHub',
        name: vlc('Main', 'Основной'),
        description: vlc('Main hub for organizing metahub content', 'Основной хаб для организации контента метахаба')
    }
]

export const PAGE_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
    {
        codename: 'WelcomePage',
        name: vlc('Welcome', 'Добро пожаловать'),
        description: vlc('Starter page with structured block content.', 'Стартовая страница со структурированным блочным контентом.'),
        config: {
            blockContent: {
                format: 'editorjs',
                data: {
                    time: 0,
                    version: '2.29.1',
                    blocks: [
                        {
                            id: 'welcome-title',
                            type: 'header',
                            data: {
                                text: vlc('Welcome', 'Добро пожаловать'),
                                level: 2
                            }
                        },
                        {
                            id: 'welcome-body',
                            type: 'paragraph',
                            data: {
                                text: vlc(
                                    'Use this page to publish structured application content.',
                                    'Используйте эту страницу для публикации структурированного контента приложения.'
                                )
                            }
                        }
                    ]
                }
            },
            runtime: {
                routeSegment: 'welcome',
                menuVisibility: 'visible'
            }
        }
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

export const LEDGER_DEFAULT_INSTANCES: PresetDefaultInstance[] = [
    {
        codename: 'MainLedger',
        name: vlc('Main', 'Основной'),
        description: vlc('Main ledger for append-only facts and reporting', 'Основной регистр для неизменяемых фактов и отчетности'),
        config: LEDGER_TYPE_CONFIG,
        attributes: [
            {
                codename: 'Subject',
                dataType: 'STRING',
                name: vlc('Subject', 'Субъект'),
                sortOrder: 1,
                isRequired: true
            },
            {
                codename: 'ResourceValue',
                dataType: 'NUMBER',
                name: vlc('Resource Value', 'Значение ресурса'),
                sortOrder: 2
            },
            {
                codename: 'OccurredAt',
                dataType: 'DATE',
                name: vlc('Occurred At', 'Дата события'),
                sortOrder: 3,
                validationRules: { dateComposition: 'datetime' }
            },
            {
                codename: 'SourceObjectId',
                dataType: 'STRING',
                name: vlc('Source Object ID', 'ID объекта-источника'),
                sortOrder: 4
            },
            {
                codename: 'SourceRowId',
                dataType: 'STRING',
                name: vlc('Source Row ID', 'ID строки-источника'),
                sortOrder: 5
            },
            {
                codename: 'SourceLineId',
                dataType: 'STRING',
                name: vlc('Source Line ID', 'ID строки движения'),
                sortOrder: 6
            }
        ]
    }
]
