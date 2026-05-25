import {
    createSystemAppManifestPresentation,
    type SystemAppBusinessTableDefinition,
    type SystemAppDefinition
} from '@universo/migrations-core'
import { ComponentDefinitionDataType } from '@universo/types'
import {
    finalizeMetahubsSchemaSupportMigrationDefinition,
    prepareMetahubsSchemaSupportMigrationDefinition,
    seedBuiltinTemplatesMigration
} from './migrations'

const p = createSystemAppManifestPresentation

const metahubBusinessTables: readonly SystemAppBusinessTableDefinition[] = [
    {
        kind: 'object',
        codename: 'metahubs',
        tableName: 'obj_metahubs',
        presentation: p('Metahubs', 'Registered metahubs available in the platform'),
        fields: [
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`,
                isRequired: true,
                isDisplayComponent: true,
                presentation: p('Metahub Name', 'Localized display name of the metahub')
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            {
                codename: 'codename',
                physicalColumnName: 'codename',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true
            },
            {
                codename: 'slug',
                physicalColumnName: 'slug',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(100)'
            },
            {
                codename: 'default_branch_id',
                physicalColumnName: 'default_branch_id',
                dataType: ComponentDefinitionDataType.REF,
                targetTableCodename: 'metahub_branches',
                presentation: p('Default Branch', 'Current default branch for the metahub')
            },
            {
                codename: 'last_branch_number',
                physicalColumnName: 'last_branch_number',
                dataType: ComponentDefinitionDataType.NUMBER,
                physicalDataType: 'INT',
                defaultSqlExpression: '0',
                isRequired: true
            },
            {
                codename: 'is_public',
                physicalColumnName: 'is_public',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            },
            {
                codename: 'template_id',
                physicalColumnName: 'template_id',
                dataType: ComponentDefinitionDataType.REF,
                targetTableCodename: 'templates'
            },
            {
                codename: 'template_version_id',
                physicalColumnName: 'template_version_id',
                dataType: ComponentDefinitionDataType.REF,
                targetTableCodename: 'template_versions'
            }
        ]
    },
    {
        kind: 'object',
        codename: 'metahub_branches',
        tableName: 'obj_metahub_branches',
        presentation: p('Metahub Branches', 'Branch records for versioned metahub structures'),
        fields: [
            {
                codename: 'metahub_id',
                physicalColumnName: 'metahub_id',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true,
                targetTableCodename: 'metahubs'
            },
            {
                codename: 'source_branch_id',
                physicalColumnName: 'source_branch_id',
                dataType: ComponentDefinitionDataType.REF,
                targetTableCodename: 'metahub_branches'
            },
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`,
                isRequired: true,
                isDisplayComponent: true,
                presentation: p('Branch Name', 'Localized display name of the branch')
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            {
                codename: 'codename',
                physicalColumnName: 'codename',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true
            },
            {
                codename: 'branch_number',
                physicalColumnName: 'branch_number',
                dataType: ComponentDefinitionDataType.NUMBER,
                physicalDataType: 'INT',
                isRequired: true
            },
            {
                codename: 'schema_name',
                physicalColumnName: 'schema_name',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(100)',
                isRequired: true
            },
            {
                codename: 'structure_version',
                physicalColumnName: 'structure_version',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(20)',
                defaultSqlExpression: `'0.1.0'`,
                isRequired: true
            },
            {
                codename: 'last_template_version_id',
                physicalColumnName: 'last_template_version_id',
                dataType: ComponentDefinitionDataType.REF,
                targetTableCodename: 'template_versions'
            },
            {
                codename: 'last_template_version_label',
                physicalColumnName: 'last_template_version_label',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(20)'
            },
            {
                codename: 'last_template_synced_at',
                physicalColumnName: 'last_template_synced_at',
                dataType: ComponentDefinitionDataType.DATE
            }
        ]
    },
    {
        kind: 'relation',
        codename: 'metahub_users',
        tableName: 'rel_metahub_users',
        presentation: p('Metahub Users', 'Membership records for metahub access'),
        fields: [
            {
                codename: 'metahub_id',
                physicalColumnName: 'metahub_id',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true,
                targetTableCodename: 'metahubs'
            },
            { codename: 'user_id', physicalColumnName: 'user_id', dataType: ComponentDefinitionDataType.REF, isRequired: true },
            {
                codename: 'active_branch_id',
                physicalColumnName: 'active_branch_id',
                dataType: ComponentDefinitionDataType.REF,
                targetTableCodename: 'metahub_branches'
            },
            {
                codename: 'role',
                physicalColumnName: 'role',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(50)',
                defaultSqlExpression: `'owner'`,
                isRequired: true
            },
            { codename: 'comment', physicalColumnName: 'comment', dataType: ComponentDefinitionDataType.JSON }
        ]
    },
    {
        kind: 'object',
        codename: 'templates',
        tableName: 'obj_templates',
        presentation: p('Templates', 'Metahub templates available for branch creation'),
        fields: [
            {
                codename: 'codename',
                physicalColumnName: 'codename',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true
            },
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`,
                isRequired: true,
                isDisplayComponent: true
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            { codename: 'icon', physicalColumnName: 'icon', dataType: ComponentDefinitionDataType.STRING, physicalDataType: 'VARCHAR(50)' },
            {
                codename: 'is_system',
                physicalColumnName: 'is_system',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            },
            {
                codename: 'is_active',
                physicalColumnName: 'is_active',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                defaultSqlExpression: 'true',
                isRequired: true
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
                codename: 'active_version_id',
                physicalColumnName: 'active_version_id',
                dataType: ComponentDefinitionDataType.REF,
                targetTableCodename: 'template_versions'
            },
            {
                codename: 'definition_type',
                physicalColumnName: 'definition_type',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'TEXT',
                defaultSqlExpression: `'metahub_template'`,
                isRequired: true
            }
        ]
    },
    {
        kind: 'document',
        codename: 'template_versions',
        tableName: 'doc_template_versions',
        presentation: p('Template Versions', 'Versioned template manifests'),
        fields: [
            {
                codename: 'template_id',
                physicalColumnName: 'template_id',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true,
                targetTableCodename: 'templates'
            },
            {
                codename: 'version_number',
                physicalColumnName: 'version_number',
                dataType: ComponentDefinitionDataType.NUMBER,
                physicalDataType: 'INTEGER',
                isRequired: true
            },
            {
                codename: 'version_label',
                physicalColumnName: 'version_label',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(20)',
                isRequired: true,
                isDisplayComponent: true
            },
            {
                codename: 'min_structure_version',
                physicalColumnName: 'min_structure_version',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(20)',
                defaultSqlExpression: `'0.1.0'`,
                isRequired: true
            },
            {
                codename: 'manifest_json',
                physicalColumnName: 'manifest_json',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true
            },
            {
                codename: 'manifest_hash',
                physicalColumnName: 'manifest_hash',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(64)',
                isRequired: true
            },
            {
                codename: 'is_active',
                physicalColumnName: 'is_active',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            },
            { codename: 'changelog', physicalColumnName: 'changelog', dataType: ComponentDefinitionDataType.JSON }
        ]
    },
    {
        kind: 'document',
        codename: 'publications',
        tableName: 'doc_publications',
        presentation: p('Publications', 'Published metahub projections available for application sync'),
        fields: [
            {
                codename: 'metahub_id',
                physicalColumnName: 'metahub_id',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true,
                targetTableCodename: 'metahubs'
            },
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`,
                isRequired: true,
                isDisplayComponent: true,
                presentation: p('Publication Name', 'Localized display name of the publication')
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            {
                codename: 'access_mode',
                physicalColumnName: 'access_mode',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'metahubs.publication_access_mode',
                defaultSqlExpression: `'full'::metahubs.publication_access_mode`,
                isRequired: true,
                presentation: p('Access Mode', 'Publication access mode used by runtime delivery'),
                uiConfig: {
                    control: 'select'
                }
            },
            {
                codename: 'access_config',
                physicalColumnName: 'access_config',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
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
                physicalDataType: 'metahubs.publication_schema_status',
                defaultSqlExpression: `'draft'::metahubs.publication_schema_status`
            },
            { codename: 'schema_error', physicalColumnName: 'schema_error', dataType: ComponentDefinitionDataType.STRING },
            { codename: 'schema_synced_at', physicalColumnName: 'schema_synced_at', dataType: ComponentDefinitionDataType.DATE },
            { codename: 'schema_snapshot', physicalColumnName: 'schema_snapshot', dataType: ComponentDefinitionDataType.JSON },
            {
                codename: 'auto_create_application',
                physicalColumnName: 'auto_create_application',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            },
            {
                codename: 'active_version_id',
                physicalColumnName: 'active_version_id',
                dataType: ComponentDefinitionDataType.REF,
                targetTableCodename: 'publication_versions'
            }
        ]
    },
    {
        kind: 'document',
        codename: 'publication_versions',
        tableName: 'doc_publication_versions',
        presentation: p('Publication Versions', 'Versioned publication snapshots ready for sync'),
        fields: [
            {
                codename: 'publication_id',
                physicalColumnName: 'publication_id',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true,
                targetTableCodename: 'publications'
            },
            {
                codename: 'branch_id',
                physicalColumnName: 'branch_id',
                dataType: ComponentDefinitionDataType.REF,
                targetTableCodename: 'metahub_branches'
            },
            {
                codename: 'version_number',
                physicalColumnName: 'version_number',
                dataType: ComponentDefinitionDataType.NUMBER,
                physicalDataType: 'INTEGER',
                isRequired: true
            },
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`,
                isRequired: true,
                isDisplayComponent: true
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: ComponentDefinitionDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            {
                codename: 'snapshot_json',
                physicalColumnName: 'snapshot_json',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true,
                presentation: p('Snapshot JSON', 'Serialized publication snapshot payload'),
                uiConfig: {
                    editor: 'json'
                }
            },
            {
                codename: 'snapshot_hash',
                physicalColumnName: 'snapshot_hash',
                dataType: ComponentDefinitionDataType.STRING,
                physicalDataType: 'VARCHAR(64)',
                isRequired: true
            },
            {
                codename: 'is_active',
                physicalColumnName: 'is_active',
                dataType: ComponentDefinitionDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            }
        ]
    }
]

export const metahubsSystemAppDefinition: SystemAppDefinition = {
    manifestVersion: 1,
    key: 'metahubs',
    displayName: 'Metahubs',
    ownerPackage: '@universo/metahubs-backend',
    engineVersion: '0.1.0',
    structureVersion: '0.1.0',
    configurationVersion: '0.1.0',
    schemaTarget: {
        kind: 'fixed',
        schemaName: 'metahubs'
    },
    runtimeCapabilities: {
        supportsPublicationSync: true,
        supportsTemplateVersions: true,
        usesCurrentUiShell: 'universo-template-mui'
    },
    currentStorageModel: 'application_like',
    targetStorageModel: 'application_like',
    currentStructureCapabilities: {
        appCoreTables: true,
        objectTables: true,
        documentTables: true,
        relationTables: true,
        settingsTables: true,
        layoutTables: false,
        widgetTables: false,
        componentValueTables: false
    },
    targetStructureCapabilities: {
        appCoreTables: true,
        objectTables: true,
        documentTables: true,
        relationTables: true,
        settingsTables: true,
        layoutTables: false,
        widgetTables: false,
        componentValueTables: false
    },
    currentBusinessTables: metahubBusinessTables,
    targetBusinessTables: metahubBusinessTables,
    summary: 'Fixed-schema platform definition for the metahubs system app',
    migrations: [
        {
            kind: 'sql',
            definition: prepareMetahubsSchemaSupportMigrationDefinition,
            bootstrapPhase: 'pre_schema_generation'
        },
        {
            kind: 'sql',
            definition: finalizeMetahubsSchemaSupportMigrationDefinition,
            bootstrapPhase: 'post_schema_generation'
        },
        {
            kind: 'file',
            migration: seedBuiltinTemplatesMigration,
            bootstrapPhase: 'post_schema_generation'
        }
    ],
    repeatableSeeds: []
}
