import { createSystemAppManifestPresentation, type SystemAppDefinition } from '@universo/migrations-core'
import { ComponentDefinitionDataType } from '@universo/types'
import { finalizeProfileSchemaSupportMigrationDefinition, prepareProfileSchemaSupportMigrationDefinition } from './migrations'

export const profileSystemAppDefinition: SystemAppDefinition = {
    manifestVersion: 1,
    key: 'profiles',
    displayName: 'Profiles',
    ownerPackage: '@universo/profile-backend',
    engineVersion: '0.1.0',
    structureVersion: '0.1.0',
    configurationVersion: '0.1.0',
    schemaTarget: {
        kind: 'fixed',
        schemaName: 'profiles'
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
        relationTables: false,
        settingsTables: true,
        layoutTables: false,
        widgetTables: false,
        componentValueTables: false
    },
    targetStructureCapabilities: {
        appCoreTables: true,
        objectTables: true,
        documentTables: false,
        relationTables: false,
        settingsTables: true,
        layoutTables: false,
        widgetTables: false,
        componentValueTables: false
    },
    currentBusinessTables: [
        {
            kind: 'object',
            codename: 'profiles',
            tableName: 'obj_profiles',
            presentation: createSystemAppManifestPresentation('Profiles', 'System profiles stored in the fixed profiles schema'),
            fields: [
                {
                    codename: 'user_id',
                    physicalColumnName: 'user_id',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'UUID',
                    isRequired: true
                },
                {
                    codename: 'nickname',
                    physicalColumnName: 'nickname',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(50)',
                    isRequired: true,
                    isDisplayComponent: true,
                    presentation: createSystemAppManifestPresentation('Nickname', 'Primary display name for the profile'),
                    validationRules: {
                        minLength: 2,
                        maxLength: 50,
                        trim: true
                    }
                },
                {
                    codename: 'first_name',
                    physicalColumnName: 'first_name',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(100)'
                },
                {
                    codename: 'last_name',
                    physicalColumnName: 'last_name',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(100)'
                },
                {
                    codename: 'settings',
                    physicalColumnName: 'settings',
                    dataType: ComponentDefinitionDataType.JSON,
                    isRequired: true,
                    defaultSqlExpression: `'{}'::jsonb`,
                    presentation: createSystemAppManifestPresentation('Settings', 'JSON profile settings payload'),
                    uiConfig: {
                        editor: 'json'
                    }
                },
                {
                    codename: 'onboarding_completed',
                    physicalColumnName: 'onboarding_completed',
                    dataType: ComponentDefinitionDataType.BOOLEAN,
                    isRequired: true,
                    defaultSqlExpression: 'false'
                },
                {
                    codename: 'terms_accepted',
                    physicalColumnName: 'terms_accepted',
                    dataType: ComponentDefinitionDataType.BOOLEAN,
                    isRequired: true,
                    defaultSqlExpression: 'false'
                },
                {
                    codename: 'terms_accepted_at',
                    physicalColumnName: 'terms_accepted_at',
                    dataType: ComponentDefinitionDataType.DATE
                },
                {
                    codename: 'privacy_accepted',
                    physicalColumnName: 'privacy_accepted',
                    dataType: ComponentDefinitionDataType.BOOLEAN,
                    isRequired: true,
                    defaultSqlExpression: 'false'
                },
                {
                    codename: 'privacy_accepted_at',
                    physicalColumnName: 'privacy_accepted_at',
                    dataType: ComponentDefinitionDataType.DATE
                },
                {
                    codename: 'terms_version',
                    physicalColumnName: 'terms_version',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(50)'
                },
                {
                    codename: 'privacy_version',
                    physicalColumnName: 'privacy_version',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(50)'
                }
            ]
        }
    ],
    targetBusinessTables: [
        {
            kind: 'object',
            codename: 'profiles',
            tableName: 'obj_profiles',
            presentation: createSystemAppManifestPresentation('Profiles', 'System profiles stored in the fixed profiles schema'),
            fields: [
                {
                    codename: 'user_id',
                    physicalColumnName: 'user_id',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'UUID',
                    isRequired: true
                },
                {
                    codename: 'nickname',
                    physicalColumnName: 'nickname',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(50)',
                    isRequired: true,
                    isDisplayComponent: true,
                    presentation: createSystemAppManifestPresentation('Nickname', 'Primary display name for the profile'),
                    validationRules: {
                        minLength: 2,
                        maxLength: 50,
                        trim: true
                    }
                },
                {
                    codename: 'first_name',
                    physicalColumnName: 'first_name',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(100)'
                },
                {
                    codename: 'last_name',
                    physicalColumnName: 'last_name',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(100)'
                },
                {
                    codename: 'settings',
                    physicalColumnName: 'settings',
                    dataType: ComponentDefinitionDataType.JSON,
                    isRequired: true,
                    defaultSqlExpression: `'{}'::jsonb`,
                    presentation: createSystemAppManifestPresentation('Settings', 'JSON profile settings payload'),
                    uiConfig: {
                        editor: 'json'
                    }
                },
                {
                    codename: 'onboarding_completed',
                    physicalColumnName: 'onboarding_completed',
                    dataType: ComponentDefinitionDataType.BOOLEAN,
                    isRequired: true,
                    defaultSqlExpression: 'false'
                },
                {
                    codename: 'terms_accepted',
                    physicalColumnName: 'terms_accepted',
                    dataType: ComponentDefinitionDataType.BOOLEAN,
                    isRequired: true,
                    defaultSqlExpression: 'false'
                },
                {
                    codename: 'terms_accepted_at',
                    physicalColumnName: 'terms_accepted_at',
                    dataType: ComponentDefinitionDataType.DATE
                },
                {
                    codename: 'privacy_accepted',
                    physicalColumnName: 'privacy_accepted',
                    dataType: ComponentDefinitionDataType.BOOLEAN,
                    isRequired: true,
                    defaultSqlExpression: 'false'
                },
                {
                    codename: 'privacy_accepted_at',
                    physicalColumnName: 'privacy_accepted_at',
                    dataType: ComponentDefinitionDataType.DATE
                },
                {
                    codename: 'terms_version',
                    physicalColumnName: 'terms_version',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(50)'
                },
                {
                    codename: 'privacy_version',
                    physicalColumnName: 'privacy_version',
                    dataType: ComponentDefinitionDataType.STRING,
                    physicalDataType: 'VARCHAR(50)'
                }
            ]
        }
    ],
    summary: 'Fixed-schema platform definition for the profiles system app stored in profiles schema',
    migrations: [
        {
            kind: 'sql',
            definition: prepareProfileSchemaSupportMigrationDefinition,
            bootstrapPhase: 'pre_schema_generation'
        },
        {
            kind: 'sql',
            definition: finalizeProfileSchemaSupportMigrationDefinition,
            bootstrapPhase: 'post_schema_generation'
        }
    ],
    repeatableSeeds: []
}
