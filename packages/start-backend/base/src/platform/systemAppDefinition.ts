import { createSystemAppManifestPresentation, type SystemAppDefinition } from '@universo/migrations-core'
import { ComponentDefinitionDataType } from '@universo/types'
import {
    applyStartSchemaPoliciesMigrationDefinition,
    finalizeStartSchemaSupportMigrationDefinition,
    prepareStartSchemaSupportMigrationDefinition
} from './migrations'

const p = createSystemAppManifestPresentation

const createObjectFields = (maxNameLength: number, maxDescLength: number) => [
    {
        codename: 'codename',
        physicalColumnName: 'codename',
        dataType: ComponentDefinitionDataType.STRING,
        physicalDataType: 'VARCHAR(50)',
        isRequired: true,
        presentation: p('Codename', 'Stable internal identifier'),
        validationRules: { maxLength: 50, pattern: '^[a-z0-9_-]+$' }
    },
    {
        codename: 'name',
        physicalColumnName: 'name',
        dataType: ComponentDefinitionDataType.JSON,
        defaultSqlExpression: `'{}'::jsonb`,
        isDisplayComponent: true,
        presentation: p('Name', 'Localized display name'),
        validationRules: { maxLength: maxNameLength }
    },
    {
        codename: 'description',
        physicalColumnName: 'description',
        dataType: ComponentDefinitionDataType.JSON,
        defaultSqlExpression: `'{}'::jsonb`,
        presentation: p('Description', 'Localized description text'),
        validationRules: { maxLength: maxDescLength }
    },
    {
        codename: 'sort_order',
        physicalColumnName: 'sort_order',
        dataType: ComponentDefinitionDataType.NUMBER,
        physicalDataType: 'INTEGER',
        defaultSqlExpression: '0',
        isRequired: true
    },
    {
        codename: 'is_active',
        physicalColumnName: 'is_active',
        dataType: ComponentDefinitionDataType.BOOLEAN,
        defaultSqlExpression: 'true',
        isRequired: true
    }
]

const startBusinessTables = [
    {
        kind: 'object' as const,
        codename: 'goals',
        tableName: 'obj_goals',
        presentation: p('Goals', 'Predefined global goals for onboarding'),
        fields: createObjectFields(100, 500)
    },
    {
        kind: 'object' as const,
        codename: 'topics',
        tableName: 'obj_topics',
        presentation: p('Topics', 'Predefined interesting topics for onboarding'),
        fields: createObjectFields(100, 500)
    },
    {
        kind: 'object' as const,
        codename: 'features',
        tableName: 'obj_features',
        presentation: p('Features', 'Predefined platform features for onboarding'),
        fields: createObjectFields(100, 500)
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
                dataType: ComponentDefinitionDataType.REF,
                physicalDataType: 'UUID',
                isRequired: true,
                presentation: p('User', 'Authenticated user who made the selection')
            },
            {
                codename: 'object_kind',
                physicalColumnName: 'object_kind',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(20)',
                isRequired: true,
                presentation: p('Object Kind', 'Type of object: goals, topics, or features')
            },
            {
                codename: 'item_id',
                physicalColumnName: 'item_id',
                dataType: ComponentDefinitionDataType.REF,
                physicalDataType: 'UUID',
                isRequired: true,
                presentation: p('Item', 'Reference to the selected object item')
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
        objectTables: true,
        documentTables: false,
        relationTables: true,
        settingsTables: false,
        layoutTables: false,
        widgetTables: false,
        componentValueTables: false
    },
    targetStructureCapabilities: {
        appCoreTables: true,
        objectTables: true,
        documentTables: false,
        relationTables: true,
        settingsTables: false,
        layoutTables: false,
        widgetTables: false,
        componentValueTables: false
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
