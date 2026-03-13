import {
    createSystemAppManifestPresentation,
    type SystemAppBusinessTableDefinition,
    type SystemAppDefinition
} from '@universo/migrations-core'
import { AttributeDataType } from '@universo/types'
import { finalizeApplicationsSchemaSupportMigrationDefinition, prepareApplicationsSchemaSupportMigrationDefinition } from './migrations'

const p = createSystemAppManifestPresentation

const applicationBusinessTables: readonly SystemAppBusinessTableDefinition[] = [
    {
        kind: 'catalog',
        codename: 'applications',
        tableName: 'cat_applications',
        presentation: p('Applications', 'Registered applications managed by the platform'),
        fields: [
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: AttributeDataType.JSON,
                isRequired: true,
                defaultSqlExpression: `'{}'::jsonb`,
                isDisplayAttribute: true,
                presentation: p('Application Name', 'Localized display name of the application')
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: AttributeDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            { codename: 'slug', physicalColumnName: 'slug', dataType: AttributeDataType.STRING, physicalDataType: 'VARCHAR(100)' },
            {
                codename: 'is_public',
                physicalColumnName: 'is_public',
                dataType: AttributeDataType.BOOLEAN,
                isRequired: true,
                defaultSqlExpression: 'false'
            },
            {
                codename: 'schema_name',
                physicalColumnName: 'schema_name',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(100)'
            },
            {
                codename: 'schema_status',
                physicalColumnName: 'schema_status',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'applications.application_schema_status',
                defaultSqlExpression: `'draft'::applications.application_schema_status`,
                presentation: p('Schema Status', 'Lifecycle state of the application schema'),
                uiConfig: {
                    readOnly: true
                }
            },
            { codename: 'schema_error', physicalColumnName: 'schema_error', dataType: AttributeDataType.STRING },
            { codename: 'schema_synced_at', physicalColumnName: 'schema_synced_at', dataType: AttributeDataType.DATE },
            { codename: 'schema_snapshot', physicalColumnName: 'schema_snapshot', dataType: AttributeDataType.JSON },
            {
                codename: 'app_structure_version',
                physicalColumnName: 'app_structure_version',
                dataType: AttributeDataType.NUMBER,
                physicalDataType: 'INTEGER'
            },
            {
                codename: 'last_synced_publication_version_id',
                physicalColumnName: 'last_synced_publication_version_id',
                dataType: AttributeDataType.REF
            },
            {
                codename: 'installed_release_metadata',
                physicalColumnName: 'installed_release_metadata',
                dataType: AttributeDataType.JSON,
                presentation: p('Installed Release Metadata', 'Canonical bundle/install metadata for file-backed application releases'),
                uiConfig: {
                    readOnly: true
                }
            }
        ]
    },
    {
        kind: 'catalog',
        codename: 'connectors',
        tableName: 'cat_connectors',
        presentation: p('Connectors', 'Connections between applications and metahub publications'),
        fields: [
            {
                codename: 'application_id',
                physicalColumnName: 'application_id',
                dataType: AttributeDataType.REF,
                isRequired: true,
                targetTableCodename: 'applications'
            },
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: AttributeDataType.JSON,
                isRequired: true,
                defaultSqlExpression: `'{}'::jsonb`,
                isDisplayAttribute: true,
                presentation: p('Connector Name', 'Localized display name of the connector')
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: AttributeDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            {
                codename: 'sort_order',
                physicalColumnName: 'sort_order',
                dataType: AttributeDataType.NUMBER,
                physicalDataType: 'INTEGER',
                isRequired: true,
                defaultSqlExpression: '0'
            },
            {
                codename: 'is_single_metahub',
                physicalColumnName: 'is_single_metahub',
                dataType: AttributeDataType.BOOLEAN,
                isRequired: true,
                defaultSqlExpression: 'true'
            },
            {
                codename: 'is_required_metahub',
                physicalColumnName: 'is_required_metahub',
                dataType: AttributeDataType.BOOLEAN,
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
                dataType: AttributeDataType.REF,
                isRequired: true,
                targetTableCodename: 'connectors'
            },
            { codename: 'publication_id', physicalColumnName: 'publication_id', dataType: AttributeDataType.REF, isRequired: true },
            {
                codename: 'sort_order',
                physicalColumnName: 'sort_order',
                dataType: AttributeDataType.NUMBER,
                physicalDataType: 'INTEGER',
                isRequired: true,
                defaultSqlExpression: '0'
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
                dataType: AttributeDataType.REF,
                isRequired: true,
                targetTableCodename: 'applications'
            },
            { codename: 'user_id', physicalColumnName: 'user_id', dataType: AttributeDataType.REF, isRequired: true },
            {
                codename: 'role',
                physicalColumnName: 'role',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(50)',
                isRequired: true,
                defaultSqlExpression: `'owner'`,
                presentation: p('Role', 'Assigned application role for the member')
            },
            { codename: 'comment', physicalColumnName: 'comment', dataType: AttributeDataType.JSON }
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
        catalogTables: true,
        documentTables: false,
        relationTables: true,
        settingsTables: true,
        layoutTables: false,
        widgetTables: false,
        attributeValueTables: false
    },
    targetStructureCapabilities: {
        appCoreTables: true,
        catalogTables: true,
        documentTables: false,
        relationTables: true,
        settingsTables: true,
        layoutTables: false,
        widgetTables: false,
        attributeValueTables: false
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
        }
    ],
    repeatableSeeds: []
}
