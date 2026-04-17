import { createSystemAppManifestPresentation, type SystemAppDefinition } from '@universo/migrations-core'
import { FieldDefinitionDataType } from '@universo/types'
import {
    applyStartSchemaPoliciesMigrationDefinition,
    finalizeStartSchemaSupportMigrationDefinition,
    prepareStartSchemaSupportMigrationDefinition
} from './migrations'

const p = createSystemAppManifestPresentation

const createCatalogFields = (maxNameLength: number, maxDescLength: number) => [
    {
        codename: 'codename',
        physicalColumnName: 'codename',
        dataType: FieldDefinitionDataType.STRING,
        physicalDataType: 'VARCHAR(50)',
        isRequired: true,
        presentation: p('Codename', 'Stable internal identifier'),
        validationRules: { maxLength: 50, pattern: '^[a-z0-9_-]+$' }
    },
    {
        codename: 'name',
        physicalColumnName: 'name',
        dataType: FieldDefinitionDataType.JSON,
        defaultSqlExpression: `'{}'::jsonb`,
        isDisplayAttribute: true,
        presentation: p('Name', 'Localized display name'),
        validationRules: { maxLength: maxNameLength }
    },
    {
        codename: 'description',
        physicalColumnName: 'description',
        dataType: FieldDefinitionDataType.JSON,
        defaultSqlExpression: `'{}'::jsonb`,
        presentation: p('Description', 'Localized description text'),
        validationRules: { maxLength: maxDescLength }
    },
    {
        codename: 'sort_order',
        physicalColumnName: 'sort_order',
        dataType: FieldDefinitionDataType.NUMBER,
        physicalDataType: 'INTEGER',
        defaultSqlExpression: '0',
        isRequired: true
    },
    {
        codename: 'is_active',
        physicalColumnName: 'is_active',
        dataType: FieldDefinitionDataType.BOOLEAN,
        defaultSqlExpression: 'true',
        isRequired: true
    }
]

const startBusinessTables = [
    {
        kind: 'catalog' as const,
        codename: 'goals',
        tableName: 'cat_goals',
        presentation: p('Goals', 'Predefined global goals for onboarding'),
        fields: createCatalogFields(100, 500)
    },
    {
        kind: 'catalog' as const,
        codename: 'topics',
        tableName: 'cat_topics',
        presentation: p('Topics', 'Predefined interesting topics for onboarding'),
        fields: createCatalogFields(100, 500)
    },
    {
        kind: 'catalog' as const,
        codename: 'features',
        tableName: 'cat_features',
        presentation: p('Features', 'Predefined platform features for onboarding'),
        fields: createCatalogFields(100, 500)
    },
    {
        kind: 'relation' as const,
        codename: 'user_selections',
        tableName: 'rel_user_selections',
        presentation: p('User Selections', 'Records of user onboarding choices'),
        fields: [
            {
                codename: 'user_id',
                physicalColumnName: 'user_id',
                dataType: FieldDefinitionDataType.REF,
                physicalDataType: 'UUID',
                isRequired: true,
                presentation: p('User', 'Authenticated user who made the selection')
            },
            {
                codename: 'catalog_kind',
                physicalColumnName: 'catalog_kind',
                dataType: FieldDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(20)',
                isRequired: true,
                presentation: p('Catalog Kind', 'Type of catalog: goals, topics, or features')
            },
            {
                codename: 'item_id',
                physicalColumnName: 'item_id',
                dataType: FieldDefinitionDataType.REF,
                physicalDataType: 'UUID',
                isRequired: true,
                presentation: p('Item', 'Reference to the selected catalog item')
            }
        ]
    }
] as const

export const startSystemAppDefinition: SystemAppDefinition = {
    manifestVersion: 1,
    key: 'start',
    displayName: 'Start',
    ownerPackage: '@universo/start-backend',
    engineVersion: '0.1.0',
    structureVersion: '0.1.0',
    configurationVersion: '0.1.0',
    schemaTarget: {
        kind: 'fixed',
        schemaName: 'start'
    },
    runtimeCapabilities: {
        supportsPublicationSync: false,
        supportsTemplateVersions: false,
        usesCurrentUiShell: 'universo-template-mui'
    },
    currentStorageModel: 'application_like',
    targetStorageModel: 'application_like',
    currentStructureCapabilities: {
        appCoreTables: true,
        catalogTables: true,
        documentTables: false,
        relationTables: true,
        settingsTables: false,
        layoutTables: false,
        widgetTables: false,
        attributeValueTables: false
    },
    targetStructureCapabilities: {
        appCoreTables: true,
        catalogTables: true,
        documentTables: false,
        relationTables: true,
        settingsTables: false,
        layoutTables: false,
        widgetTables: false,
        attributeValueTables: false
    },
    currentBusinessTables: startBusinessTables,
    targetBusinessTables: startBusinessTables,
    summary: 'Fixed-schema platform definition for the start/onboarding system app',
    migrations: [
        {
            kind: 'sql',
            definition: prepareStartSchemaSupportMigrationDefinition,
            bootstrapPhase: 'pre_schema_generation'
        },
        {
            kind: 'sql',
            definition: finalizeStartSchemaSupportMigrationDefinition,
            bootstrapPhase: 'post_schema_generation'
        },
        {
            kind: 'sql',
            definition: applyStartSchemaPoliciesMigrationDefinition,
            bootstrapPhase: 'post_schema_generation'
        }
    ],
    repeatableSeeds: []
}
