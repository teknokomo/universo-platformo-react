import { createSystemAppManifestPresentation, type SystemAppDefinition } from '@universo/migrations-core'
import { AttributeDataType } from '@universo/types'
import { finalizeAdminSchemaSupportMigrationDefinition, prepareAdminSchemaSupportMigrationDefinition } from './migrations'

const p = createSystemAppManifestPresentation

const adminBusinessTables = [
    {
        kind: 'settings',
        codename: 'instances',
        tableName: 'cfg_instances',
        presentation: p('Instances', 'Global instance configuration records'),
        fields: [
            {
                codename: 'codename',
                physicalColumnName: 'codename',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(100)',
                isRequired: true
            },
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: AttributeDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`,
                isDisplayAttribute: true
            },
            {
                codename: 'description',
                physicalColumnName: 'description',
                dataType: AttributeDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            { codename: 'url', physicalColumnName: 'url', dataType: AttributeDataType.STRING, physicalDataType: 'VARCHAR(255)' },
            {
                codename: 'status',
                physicalColumnName: 'status',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(20)',
                defaultSqlExpression: `'active'`,
                isRequired: true
            },
            {
                codename: 'is_local',
                physicalColumnName: 'is_local',
                dataType: AttributeDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            }
        ]
    },
    {
        kind: 'catalog',
        codename: 'roles',
        tableName: 'cat_roles',
        presentation: p('Roles', 'System-wide access roles'),
        fields: [
            {
                codename: 'codename',
                physicalColumnName: 'codename',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(50)',
                isRequired: true,
                presentation: p('Role Codename', 'Stable internal role identifier'),
                validationRules: {
                    maxLength: 50,
                    pattern: '^[a-z0-9:_-]+$'
                }
            },
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: AttributeDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`,
                isDisplayAttribute: true,
                presentation: p('Role Name', 'Localized display name for the role')
            },
            { codename: 'description', physicalColumnName: 'description', dataType: AttributeDataType.JSON },
            {
                codename: 'color',
                physicalColumnName: 'color',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(7)',
                defaultSqlExpression: `'#9e9e9e'`
            },
            {
                codename: 'is_superuser',
                physicalColumnName: 'is_superuser',
                dataType: AttributeDataType.BOOLEAN,
                defaultSqlExpression: 'false'
            },
            { codename: 'is_system', physicalColumnName: 'is_system', dataType: AttributeDataType.BOOLEAN, defaultSqlExpression: 'false' }
        ]
    },
    {
        kind: 'relation',
        codename: 'role_permissions',
        tableName: 'rel_role_permissions',
        presentation: p('Role Permissions', 'Permission rules granted to roles'),
        fields: [
            {
                codename: 'role_id',
                physicalColumnName: 'role_id',
                dataType: AttributeDataType.REF,
                isRequired: true,
                targetTableCodename: 'roles',
                presentation: p('Role', 'Role that receives the permission grant')
            },
            {
                codename: 'subject',
                physicalColumnName: 'subject',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(100)',
                isRequired: true
            },
            {
                codename: 'action',
                physicalColumnName: 'action',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(20)',
                isRequired: true
            },
            {
                codename: 'conditions',
                physicalColumnName: 'conditions',
                dataType: AttributeDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`
            },
            {
                codename: 'fields',
                physicalColumnName: 'fields',
                dataType: AttributeDataType.JSON,
                physicalDataType: 'TEXT[]',
                defaultSqlExpression: 'ARRAY[]::TEXT[]'
            }
        ]
    },
    {
        kind: 'relation',
        codename: 'user_roles',
        tableName: 'rel_user_roles',
        fields: [
            { codename: 'user_id', physicalColumnName: 'user_id', dataType: AttributeDataType.REF, isRequired: true },
            {
                codename: 'role_id',
                physicalColumnName: 'role_id',
                dataType: AttributeDataType.REF,
                isRequired: true,
                targetTableCodename: 'roles'
            },
            { codename: 'granted_by', physicalColumnName: 'granted_by', dataType: AttributeDataType.REF },
            { codename: 'comment', physicalColumnName: 'comment', dataType: AttributeDataType.STRING, physicalDataType: 'TEXT' }
        ]
    },
    {
        kind: 'settings',
        codename: 'locales',
        tableName: 'cfg_locales',
        presentation: p('Locales', 'System locale configuration'),
        fields: [
            {
                codename: 'code',
                physicalColumnName: 'code',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(10)',
                isRequired: true,
                isDisplayAttribute: true,
                presentation: p('Locale Code', 'Canonical locale code')
            },
            {
                codename: 'name',
                physicalColumnName: 'name',
                dataType: AttributeDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`,
                isRequired: true
            },
            {
                codename: 'native_name',
                physicalColumnName: 'native_name',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(100)'
            },
            {
                codename: 'is_enabled_content',
                physicalColumnName: 'is_enabled_content',
                dataType: AttributeDataType.BOOLEAN,
                defaultSqlExpression: 'true',
                isRequired: true
            },
            {
                codename: 'is_enabled_ui',
                physicalColumnName: 'is_enabled_ui',
                dataType: AttributeDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            },
            {
                codename: 'is_default_content',
                physicalColumnName: 'is_default_content',
                dataType: AttributeDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            },
            {
                codename: 'is_default_ui',
                physicalColumnName: 'is_default_ui',
                dataType: AttributeDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            },
            {
                codename: 'is_system',
                physicalColumnName: 'is_system',
                dataType: AttributeDataType.BOOLEAN,
                defaultSqlExpression: 'false',
                isRequired: true
            },
            {
                codename: 'sort_order',
                physicalColumnName: 'sort_order',
                dataType: AttributeDataType.NUMBER,
                physicalDataType: 'INTEGER',
                defaultSqlExpression: '0',
                isRequired: true
            }
        ]
    },
    {
        kind: 'settings',
        codename: 'settings',
        tableName: 'cfg_settings',
        presentation: p('Settings', 'System-wide key-value configuration records'),
        fields: [
            {
                codename: 'category',
                physicalColumnName: 'category',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(50)',
                isRequired: true
            },
            {
                codename: 'key',
                physicalColumnName: 'key',
                dataType: AttributeDataType.STRING,
                physicalDataType: 'VARCHAR(100)',
                isRequired: true,
                isDisplayAttribute: true
            },
            {
                codename: 'value',
                physicalColumnName: 'value',
                dataType: AttributeDataType.JSON,
                defaultSqlExpression: `'{}'::jsonb`,
                isRequired: true,
                presentation: p('Setting Value', 'Serialized configuration value'),
                uiConfig: {
                    editor: 'json'
                }
            }
        ]
    }
] as const

export const adminSystemAppDefinition: SystemAppDefinition = {
    manifestVersion: 1,
    key: 'admin',
    displayName: 'Admin',
    ownerPackage: '@universo/admin-backend',
    engineVersion: '0.1.0',
    structureVersion: '0.1.0',
    configurationVersion: '0.1.0',
    schemaTarget: {
        kind: 'fixed',
        schemaName: 'admin'
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
    currentBusinessTables: adminBusinessTables,
    targetBusinessTables: adminBusinessTables,
    summary: 'Fixed-schema platform definition for the admin system app',
    migrations: [
        {
            kind: 'sql',
            definition: prepareAdminSchemaSupportMigrationDefinition,
            bootstrapPhase: 'pre_schema_generation'
        },
        {
            kind: 'sql',
            definition: finalizeAdminSchemaSupportMigrationDefinition,
            bootstrapPhase: 'post_schema_generation'
        }
    ],
    repeatableSeeds: []
}
