import {
    createSystemAppManifestPresentation,
    type SystemAppBusinessTableDefinition,
    type SystemAppDefinition
} from '@universo/migrations-core'
import { ComponentDefinitionDataType } from '@universo/types'
import {
    addApplicationSettingsMigrationDefinition,
    finalizeApplicationsSchemaSupportMigrationDefinition,
    prepareApplicationsSchemaSupportMigrationDefinition
} from './migrations'

const p = createSystemAppManifestPresentation

const applicationBusinessTables: readonly SystemAppBusinessTableDefinition[] = [
    {
        kind: 'object',
        codename: 'applications',
        tableName: 'obj_applications',
        presentation: p('Applications', 'Registered applications managed by the platform'),
        fields: [
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true,
                defaultSqlExpression: `'{}'::jsonb`,
                isDisplayComponent: true,
                presentation: p('Application Name', 'Localized display name of the application')
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            {
                codename: 'settings',
                physicalColumnName: 'settings',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true,
                defaultSqlExpression: `'{}'::jsonb`,
                presentation: p('Application Settings', 'Persisted UI and behavior settings for the application control panel')
            },
            {
                codename: 'slug',
                physicalColumnName: 'slug',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(100)'
            },
            {
                codename: 'is_public',
                physicalColumnName: 'is_public',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                isRequired: true,
                defaultSqlExpression: 'false'
            },
            {
                codename: 'workspaces_enabled',
                physicalColumnName: 'workspaces_enabled',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                isRequired: true,
                defaultSqlExpression: 'false'
            },
            {
                codename: 'schema_name',
                physicalColumnName: 'schema_name',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(100)'
            },
            {
                codename: 'schema_status',
                physicalColumnName: 'schema_status',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'applications.application_schema_status',
                defaultSqlExpression: `'draft'::applications.application_schema_status`,
                presentation: p('Schema Status', 'Lifecycle state of the application schema'),
                uiConfig: {
                    readOnly: true
                }
            },
            { codename: 'schema_error', physicalColumnName: 'schema_error', dataType: ComponentDefinitionDataType.STRING },
            { codename: 'schema_synced_at', physicalColumnName: 'schema_synced_at', dataType: ComponentDefinitionDataType.DATE },
            { codename: 'schema_snapshot', physicalColumnName: 'schema_snapshot', dataType: ComponentDefinitionDataType.JSON },
            {
                codename: 'app_structure_version',
                physicalColumnName: 'app_structure_version',
                dataType: ComponentDefinitionDataType.NUMBER,
                physicalDataType: 'INTEGER'
            },
            {
                codename: 'last_synced_publication_version_id',
                physicalColumnName: 'last_synced_publication_version_id',
                dataType: ComponentDefinitionDataType.REF
            },
            {
                codename: 'installed_release_metadata',
                physicalColumnName: 'installed_release_metadata',
                dataType: ComponentDefinitionDataType.JSON,
                presentation: p('Installed Release Metadata', 'Canonical bundle/install metadata for file-backed application releases'),
                uiConfig: {
                    readOnly: true
                }
            }
        ]
    },
    {
        kind: 'object',
        codename: 'connectors',
        tableName: 'obj_connectors',
        presentation: p('Connectors', 'Connections between applications and metahub publications'),
        fields: [
            {
                codename: 'application_id',
                physicalColumnName: 'application_id',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true,
                targetTableCodename: 'applications'
            },
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true,
                defaultSqlExpression: `'{}'::jsonb`,
                isDisplayComponent: true,
                presentation: p('Connector Name', 'Localized display name of the connector')
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            {
                codename: 'sort_order',
                physicalColumnName: 'sort_order',
                dataType: ComponentDefinitionDataType.NUMBER,
                physicalDataType: 'INTEGER',
                isRequired: true,
                defaultSqlExpression: '0'
            },
            {
                codename: 'is_single_metahub',
                physicalColumnName: 'is_single_metahub',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                isRequired: true,
                defaultSqlExpression: 'true'
            },
            {
                codename: 'is_required_metahub',
                physicalColumnName: 'is_required_metahub',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                isRequired: true,
                defaultSqlExpression: 'true'
            }
        ]
    },
    {
        kind: 'relation',
        codename: 'connector_publications',
        tableName: 'rel_connector_publications',
        presentation: p('Connector Publications', 'Publication bindings attached to a connector'),
        fields: [
            {
                codename: 'connector_id',
                physicalColumnName: 'connector_id',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true,
                targetTableCodename: 'connectors'
            },
            {
                codename: 'publication_id',
                physicalColumnName: 'publication_id',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true
            },
            {
                codename: 'sort_order',
                physicalColumnName: 'sort_order',
                dataType: ComponentDefinitionDataType.NUMBER,
                physicalDataType: 'INTEGER',
                isRequired: true,
                defaultSqlExpression: '0'
            },
            {
                codename: 'schema_options',
                physicalColumnName: 'schema_options',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true,
                defaultSqlExpression: `'{}'::jsonb`,
                presentation: p('Schema Options', 'Connector-level schema installation options')
            }
        ]
    },
    {
        kind: 'relation',
        codename: 'application_users',
        tableName: 'rel_application_users',
        presentation: p('Application Users', 'Membership records for application access'),
        fields: [
            {
                codename: 'application_id',
                physicalColumnName: 'application_id',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true,
                targetTableCodename: 'applications'
            },
            { codename: 'user_id', physicalColumnName: 'user_id', dataType: ComponentDefinitionDataType.REF, isRequired: true },
            {
                codename: 'role',
                physicalColumnName: 'role',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(50)',
                isRequired: true,
                defaultSqlExpression: `'owner'`,
                presentation: p('Role', 'Assigned application role for the member')
            },
            { codename: 'comment', physicalColumnName: 'comment', dataType: ComponentDefinitionDataType.JSON }
        ]
    }
]

export const applicationsSystemAppDefinition: SystemAppDefinition = {
    manifestVersion: 1,
    key: 'applications',
    displayName: 'Applications',
    ownerPackage: '@universo/applications-backend',
    engineVersion: '0.1.0',
    structureVersion: '0.1.0',
    configurationVersion: '0.1.0',
    schemaTarget: {
        kind: 'fixed',
        schemaName: 'applications'
    },
    runtimeCapabilities: {
        supportsPublicationSync: true,
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
        settingsTables: true,
        layoutTables: false,
        widgetTables: false,
        componentValueTables: false
    },
    targetStructureCapabilities: {
        appCoreTables: true,
        objectTables: true,
        documentTables: false,
        relationTables: true,
        settingsTables: true,
        layoutTables: false,
        widgetTables: false,
        componentValueTables: false
    },
    currentBusinessTables: applicationBusinessTables,
    targetBusinessTables: applicationBusinessTables,
    summary: 'Fixed-schema platform definition for the applications system app',
    migrations: [
        {
            kind: 'sql',
            definition: prepareApplicationsSchemaSupportMigrationDefinition,
            bootstrapPhase: 'pre_schema_generation'
        },
        {
            kind: 'sql',
            definition: finalizeApplicationsSchemaSupportMigrationDefinition,
            bootstrapPhase: 'post_schema_generation'
        },
        {
            kind: 'sql',
            definition: addApplicationSettingsMigrationDefinition,
            bootstrapPhase: 'post_schema_generation'
        }
    ],
    repeatableSeeds: []
}
