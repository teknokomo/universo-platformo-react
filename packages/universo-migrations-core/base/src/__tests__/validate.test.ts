import { createSystemAppManifestPresentation } from '../systemAppManifestPresentation'
import { validatePlatformMigrations, validateSystemAppDefinitions } from '../validate'
import type { PlatformMigrationFile, SystemAppDefinition } from '../types'

const createMigration = (overrides: Partial<PlatformMigrationFile> = {}): PlatformMigrationFile => ({
    id: 'CreateMetahubsSchema1766351182000',
    version: '1766351182000',
    scope: {
        kind: 'platform_schema',
        key: 'metahubs'
    },
    sourceKind: 'file',
    up: async () => Promise.resolve(),
    ...overrides
})

const createSystemAppDefinition = (overrides: Partial<SystemAppDefinition> = {}): SystemAppDefinition => ({
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
    currentStorageModel: 'legacy_fixed',
    targetStorageModel: 'application_like',
    currentStructureCapabilities: {
        appCoreTables: false,
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
        settingsTables: true,
        layoutTables: false,
        widgetTables: false,
        componentValueTables: false
    },
    currentBusinessTables: [
        {
            kind: 'object',
            codename: 'metahubs',
            tableName: 'metahubs'
        },
        {
            kind: 'relation',
            codename: 'metahub_users',
            tableName: 'metahubs_users'
        }
    ],
    targetBusinessTables: [
        {
            kind: 'object',
            codename: 'metahubs',
            tableName: 'obj_metahubs'
        },
        {
            kind: 'relation',
            codename: 'metahub_users',
            tableName: 'rel_metahub_users'
        }
    ],
    migrations: [
        {
            kind: 'file',
            migration: createMigration()
        }
    ],
    repeatableSeeds: [],
    ...overrides
})

describe('validatePlatformMigrations', () => {
    it('reports duplicate ids and versions', () => {
        const result = validatePlatformMigrations([
            createMigration(),
            createMigration({
                id: 'CreateApplicationsSchema1800000000000',
                version: '1766351182000',
                scope: { kind: 'platform_schema', key: 'applications' }
            }),
            createMigration()
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ message: 'Duplicate migration id detected' }),
                expect.objectContaining({ message: expect.stringContaining('duplicated by') })
            ])
        )
    })

    it('rejects transaction advisory locks without a transaction', () => {
        const result = validatePlatformMigrations([
            createMigration({
                id: 'UnsafeMigration1800000000001',
                version: '1800000000001',
                transactionMode: 'none',
                lockMode: 'transaction_advisory'
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                level: 'error',
                message: 'transactionMode="none" cannot be combined with lockMode="transaction_advisory"'
            })
        )
    })

    it('warns when destructive migrations omit explicit review', () => {
        const result = validatePlatformMigrations([
            createMigration({
                id: 'DropLegacyIndex1800000000002',
                version: '1800000000002',
                isDestructive: true
            })
        ])

        expect(result.ok).toBe(true)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                level: 'warning',
                message: 'Destructive migration should declare requiresReview=true'
            })
        )
    })

    it('accepts synthetic cross-schema platform scope keys', () => {
        const result = validatePlatformMigrations([
            createMigration({
                id: 'OptimizeRlsPolicies1800000000200',
                version: '1800000000200',
                scope: { kind: 'platform_schema', key: 'cross_schema' }
            })
        ])

        expect(result.ok).toBe(true)
        expect(result.issues).toEqual([])
    })

    it('rejects invalid DDL execution budgets', () => {
        const result = validatePlatformMigrations([
            createMigration({
                id: 'BudgetedMigration1800000000201',
                version: '1800000000201',
                executionBudget: {
                    lockTimeoutMs: 5000,
                    statementTimeoutMs: 1000,
                    riskLevel: 'medium'
                }
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                level: 'error',
                message: 'executionBudget.lockTimeoutMs must not exceed executionBudget.statementTimeoutMs'
            })
        )
    })

    it('rejects execution budgets for non-transactional migrations', () => {
        const result = validatePlatformMigrations([
            createMigration({
                id: 'UnsafeBudgetedMigration1800000000204',
                version: '1800000000204',
                transactionMode: 'none',
                lockMode: 'none',
                executionBudget: {
                    lockTimeoutMs: 1000,
                    statementTimeoutMs: 5000,
                    riskLevel: 'low'
                }
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                level: 'error',
                message: 'executionBudget is currently supported only for transactional migrations'
            })
        )
    })

    it('warns when contract-stage migrations are not cleanup oriented', () => {
        const result = validatePlatformMigrations([
            createMigration({
                id: 'ContractMigration1800000000202',
                version: '1800000000202',
                deliveryStage: 'contract',
                isDestructive: false
            })
        ])

        expect(result.ok).toBe(true)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                level: 'warning',
                message: 'deliveryStage="contract" is typically expected to be destructive or cleanup-oriented'
            })
        )
    })

    it('validates system app definitions with explicit version metadata', () => {
        const result = validateSystemAppDefinitions([createSystemAppDefinition()])

        expect(result.ok).toBe(true)
        expect(result.issues).toEqual([])
    })

    it('accepts explicit presentation, validationRules, and uiConfig metadata for business fields', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                currentBusinessTables: [
                    {
                        kind: 'object',
                        codename: 'metahubs',
                        tableName: 'obj_metahubs',
                        presentation: createSystemAppManifestPresentation('Metahubs', 'System metahub registry'),
                        fields: [
                            {
                                codename: 'name',
                                physicalColumnName: 'name',
                                dataType: 'STRING',
                                isRequired: true,
                                isDisplayComponent: true,
                                presentation: createSystemAppManifestPresentation('Name', 'Primary metahub name'),
                                validationRules: {
                                    minLength: 1
                                },
                                uiConfig: {
                                    control: 'text'
                                }
                            }
                        ]
                    }
                ],
                targetBusinessTables: [
                    {
                        kind: 'object',
                        codename: 'metahubs',
                        tableName: 'obj_metahubs',
                        presentation: createSystemAppManifestPresentation('Metahubs', 'System metahub registry'),
                        fields: [
                            {
                                codename: 'name',
                                physicalColumnName: 'name',
                                dataType: 'STRING',
                                isRequired: true,
                                isDisplayComponent: true,
                                presentation: createSystemAppManifestPresentation('Name', 'Primary metahub name'),
                                validationRules: {
                                    minLength: 1
                                },
                                uiConfig: {
                                    control: 'text'
                                }
                            }
                        ]
                    }
                ]
            })
        ])

        expect(result.ok).toBe(true)
        expect(result.issues).toEqual([])
    })

    it('rejects duplicate system app keys and invalid custom schemas', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                schemaTarget: {
                    kind: 'managed_custom',
                    schemaName: 'bad-schema-name',
                    ownerKind: 'system_app'
                }
            }),
            createSystemAppDefinition()
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ message: 'Duplicate system app definition key detected' }),
                expect.objectContaining({ message: 'Invalid managed custom schema name: bad-schema-name' })
            ])
        )
    })

    it('accepts managed dynamic schema targets with deterministic names', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                manifestVersion: 2,
                key: 'application-runtime',
                displayName: 'Application Runtime',
                currentStorageModel: 'application_like',
                currentBusinessTables: [
                    {
                        kind: 'object',
                        codename: 'applications',
                        tableName: 'applications'
                    }
                ],
                schemaTarget: {
                    kind: 'managed_dynamic',
                    prefix: 'app',
                    ownerId: '019ccfad-de2d-7108-b32e-1de9e32359a4'
                },
                currentStructureCapabilities: {
                    appCoreTables: true,
                    objectTables: true,
                    documentTables: false,
                    relationTables: false,
                    settingsTables: true,
                    layoutTables: true,
                    widgetTables: true,
                    componentValueTables: true
                }
            })
        ])

        expect(result.ok).toBe(true)
        expect(result.issues).toEqual([])
    })

    it('rejects invalid manifest metadata for application-like targets', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                manifestVersion: 0,
                currentStorageModel: 'application_like',
                currentStructureCapabilities: {
                    appCoreTables: false,
                    objectTables: true,
                    documentTables: false,
                    relationTables: false,
                    settingsTables: false,
                    layoutTables: true,
                    widgetTables: false,
                    componentValueTables: false
                }
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ message: 'System app manifestVersion must be a positive integer' }),
                expect.objectContaining({
                    message:
                        'currentStructureCapabilities requires appCoreTables=true when layout, widget, or component value tables are enabled'
                }),
                expect.objectContaining({
                    message: 'System app currentStructureCapabilities.appCoreTables must be true for application_like storage'
                })
            ])
        )
    })

    it('rejects widget tables without layouts in structure capabilities', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                targetStructureCapabilities: {
                    appCoreTables: true,
                    objectTables: true,
                    documentTables: false,
                    relationTables: false,
                    settingsTables: true,
                    layoutTables: false,
                    widgetTables: true,
                    componentValueTables: false
                }
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                message: 'targetStructureCapabilities requires layoutTables=true when widgetTables=true'
            })
        )
    })

    it('rejects duplicate physical field names inside a system app business table', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                targetBusinessTables: [
                    {
                        kind: 'object',
                        codename: 'metahubs',
                        tableName: 'obj_metahubs',
                        fields: [
                            {
                                codename: 'name',
                                physicalColumnName: 'name',
                                dataType: 'STRING'
                            },
                            {
                                codename: 'title',
                                physicalColumnName: 'name',
                                dataType: 'STRING'
                            }
                        ]
                    }
                ]
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                message: 'targetBusinessTables.metahubs.fields contains duplicate physicalColumnName: name'
            })
        )
    })

    it('rejects targetTableCodename on non-REF business fields', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                targetBusinessTables: [
                    {
                        kind: 'object',
                        codename: 'metahubs',
                        tableName: 'obj_metahubs',
                        fields: [
                            {
                                codename: 'name',
                                physicalColumnName: 'name',
                                dataType: 'STRING',
                                targetTableCodename: 'metahub_users'
                            }
                        ]
                    },
                    {
                        kind: 'relation',
                        codename: 'metahub_users',
                        tableName: 'rel_metahub_users'
                    }
                ]
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                message: 'targetBusinessTables.metahubs.fields targetTableCodename is supported only for REF fields'
            })
        )
    })

    it('rejects unknown targetTableCodename references inside business field metadata', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                targetBusinessTables: [
                    {
                        kind: 'object',
                        codename: 'metahubs',
                        tableName: 'obj_metahubs',
                        fields: [
                            {
                                codename: 'default_branch_id',
                                physicalColumnName: 'default_branch_id',
                                dataType: 'REF',
                                targetTableCodename: 'missing_branch'
                            }
                        ]
                    }
                ]
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                message: 'targetBusinessTables.metahubs.fields references unknown targetTableCodename: missing_branch'
            })
        )
    })

    it('rejects repeatable seeds without explicit lifecycle versioning metadata', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                repeatableSeeds: [
                    {
                        id: 'builtin.templates',
                        version: '',
                        checksum: 'sha256:seed',
                        scope: 'system_app',
                        lifecycle: 'configuration_template'
                    }
                ]
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                message: 'Repeatable seed version must not be empty'
            })
        )
    })

    it('rejects duplicate target business table names and non-canonical application-like prefixes', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                targetBusinessTables: [
                    {
                        kind: 'object',
                        codename: 'metahubs',
                        tableName: 'metahubs'
                    },
                    {
                        kind: 'object',
                        codename: 'metahubs_duplicate',
                        tableName: 'metahubs'
                    }
                ]
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    message: 'targetBusinessTables must use obj_* table names for kind=object'
                }),
                expect.objectContaining({
                    message: 'targetBusinessTables contains duplicate tableName: metahubs'
                })
            ])
        )
    })

    it('rejects business tables that contradict enabled structure capabilities', () => {
        const result = validateSystemAppDefinitions([
            createSystemAppDefinition({
                currentStructureCapabilities: {
                    appCoreTables: false,
                    objectTables: true,
                    documentTables: false,
                    relationTables: false,
                    settingsTables: false,
                    layoutTables: false,
                    widgetTables: false,
                    componentValueTables: false
                },
                currentBusinessTables: [
                    {
                        kind: 'relation',
                        codename: 'metahub_users',
                        tableName: 'metahubs_users'
                    }
                ]
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                message: 'currentBusinessTables requires relationTables=true for metahubs_users'
            })
        )
    })
})
