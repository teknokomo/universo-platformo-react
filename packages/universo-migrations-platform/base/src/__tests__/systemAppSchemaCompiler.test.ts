import { createHash } from 'node:crypto'

const mockGenerateFullSchema = jest.fn()
const mockCreateSchema = jest.fn()
const mockSyncSystemMetadata = jest.fn()
const mockGetLatestMigration = jest.fn()
const mockCalculateDiff = jest.fn(() => ({ hasChanges: false, additive: [], destructive: [], summary: 'no changes' }))
const mockApplyAllChanges = jest.fn().mockResolvedValue({ success: true, changesApplied: 1, errors: [] })
const MockMigrationManager = jest.fn().mockImplementation(() => ({ tag: 'migration-manager', getLatestMigration: mockGetLatestMigration }))
const mockBuildSchemaSnapshot = jest.fn(() => ({
    version: 2,
    generatedAt: '2026-03-13T00:00:00.000Z',
    hasSystemTables: true,
    entities: {}
}))
const MockSchemaGenerator = jest.fn().mockImplementation(() => ({
    generateFullSchema: mockGenerateFullSchema,
    createSchema: mockCreateSchema,
    syncSystemMetadata: mockSyncSystemMetadata
}))
const MockSchemaMigrator = jest.fn().mockImplementation(() => ({
    calculateDiff: mockCalculateDiff,
    applyAllChanges: mockApplyAllChanges
}))
type MockSystemTableCapabilityOptions = {
    includeAttributes?: boolean
    includeValues?: boolean
    includeLayouts?: boolean
    includeWidgets?: boolean
}

const mockResolveSystemTableNames = jest.fn((options?: MockSystemTableCapabilityOptions) => {
    const tableNames = ['_app_migrations', '_app_settings', '_app_objects']

    if (options?.includeAttributes !== false) {
        tableNames.push('_app_attributes')
    }

    if (options?.includeValues !== false) {
        tableNames.push('_app_values')
    }

    if (options?.includeLayouts !== false) {
        tableNames.push('_app_layouts')
    }

    if (options?.includeWidgets !== false) {
        tableNames.push('_app_widgets')
    }

    return tableNames
})

jest.mock('@universo/schema-ddl', () => ({
    SchemaGenerator: MockSchemaGenerator,
    SchemaMigrator: MockSchemaMigrator,
    MigrationManager: MockMigrationManager,
    buildSchemaSnapshot: mockBuildSchemaSnapshot,
    resolveSystemTableNames: mockResolveSystemTableNames
}))

import {
    planRegisteredSystemAppSchemaGenerationPlans,
    compileSystemAppSchemaDefinitionArtifacts,
    compileRegisteredSystemAppSchemaDefinitionArtifacts,
    validateSystemAppCompiledArtifactSet,
    validateRegisteredSystemAppCompiledDefinitions,
    inspectRegisteredSystemAppStructureMetadata,
    bootstrapRegisteredSystemAppStructureMetadata,
    bootstrapSystemAppStructureMetadata,
    applyRegisteredSystemAppSchemaGenerationPlans,
    applyRegisteredSystemAppSchemaGenerationPlan,
    applySystemAppSchemaGenerationPlan,
    buildSystemAppSchemaGenerationOptions,
    ensureRegisteredSystemAppSchemaGenerationPlans
} from '../systemAppSchemaCompiler'
import { buildRegisteredSystemAppSchemaGenerationPlan } from '../systemAppDefinitions'

const TEST_SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE = 'universo-system-app-compiler'

const buildExpectedBaselineMigrationName = (definitionKey: string): string => {
    const plan = buildRegisteredSystemAppSchemaGenerationPlan(definitionKey)
    return `baseline_${definitionKey}_structure_${plan.structureVersion.replaceAll('.', '_')}`
}

const toDeterministicUuid = (seed: string): string => {
    const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('')
    hex[12] = '5'
    hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
    return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex
        .slice(20, 32)
        .join('')}`
}

const createSyntheticPresentation = (value: string) => ({
    name: {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: value,
                version: 1,
                isActive: true,
                createdAt: '1970-01-01T00:00:00.000Z',
                updatedAt: '1970-01-01T00:00:00.000Z'
            }
        }
    }
})

const createSyntheticCodenameVlc = (value: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content: value,
            version: 1,
            isActive: true,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z'
        }
    }
})

const mapBusinessTableKindToRuntimeEntityKind = (kind: string): string => {
    switch (kind) {
        case 'catalog':
            return 'catalog'
        case 'document':
            return 'document'
        case 'relation':
            return 'relation'
        case 'settings':
            return 'settings'
        default:
            return kind
    }
}

const buildProfilesStructureRows = () => {
    const plan = buildRegisteredSystemAppSchemaGenerationPlan('profiles')
    const table = plan.businessTables[0]!
    const objectId = toDeterministicUuid(
        `${TEST_SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE}:${plan.definitionKey}:${plan.stage}:${table.kind}:${table.codename}:${table.tableName}`
    )
    const objectKind = mapBusinessTableKindToRuntimeEntityKind(table.kind)

    return {
        objectRows: [
            {
                id: objectId,
                kind: objectKind,
                codename: table.codename,
                table_name: table.tableName,
                presentation_json: JSON.stringify(table.presentation ?? createSyntheticPresentation(table.codename)),
                config_json: JSON.stringify({
                    systemAppDefinitionKey: plan.definitionKey,
                    systemAppBusinessTableKind: table.kind,
                    systemAppCompilerStage: plan.stage
                })
            }
        ],
        attributeRows: (table.fields ?? []).map((field) => {
            const targetTable = field.targetTableCodename
                ? plan.businessTables.find((candidate) => candidate.codename === field.targetTableCodename) ?? null
                : null
            const targetObjectId = targetTable
                ? toDeterministicUuid(
                      `${TEST_SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE}:${plan.definitionKey}:${plan.stage}:${targetTable.kind}:${targetTable.codename}:${targetTable.tableName}`
                  )
                : null

            return {
                id: toDeterministicUuid(
                    `${TEST_SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE}:${plan.definitionKey}:${table.kind}:${table.codename}:${field.codename}:${field.physicalColumnName}`
                ),
                object_id: objectId,
                object_codename: table.codename,
                codename: field.codename,
                column_name: field.physicalColumnName,
                data_type: field.dataType,
                is_required: field.isRequired ?? false,
                is_display_attribute: field.isDisplayAttribute ?? false,
                target_object_id: targetObjectId,
                target_object_kind: targetTable ? mapBusinessTableKindToRuntimeEntityKind(targetTable.kind) : null,
                presentation_json: JSON.stringify(field.presentation ?? createSyntheticPresentation(field.codename)),
                validation_rules_json: JSON.stringify(field.validationRules ?? {}),
                ui_config_json: JSON.stringify(field.uiConfig ?? {})
            }
        })
    }
}

const createStructureInspectionKnex = (options: { fingerprintDrift?: boolean; jsonbCodenames?: boolean } = {}) => ({
    raw: jest.fn(async (sql: string, bindings?: unknown[]) => {
        const { objectRows, attributeRows } = buildProfilesStructureRows()

        if (sql.includes('information_schema.tables')) {
            const schemaName = typeof bindings?.[0] === 'string' ? bindings[0] : null
            if (schemaName === 'profiles') {
                return {
                    rows: [
                        { table_name: '_app_migrations' },
                        { table_name: '_app_settings' },
                        { table_name: '_app_objects' },
                        { table_name: '_app_attributes' }
                    ]
                }
            }

            return { rows: [] }
        }

        if (sql.includes('presentation::text as presentation_json') && sql.includes('._app_objects')) {
            return {
                rows: objectRows.map((row) => {
                    const baseRow = options.fingerprintDrift
                        ? {
                              ...row,
                              presentation_json: JSON.stringify(createSyntheticPresentation('Profiles Drifted'))
                          }
                        : row

                    return options.jsonbCodenames
                        ? {
                              ...baseRow,
                              codename: createSyntheticCodenameVlc(String(baseRow.codename))
                          }
                        : baseRow
                })
            }
        }

        if (sql.includes('validation_rules::text as validation_rules_json') && sql.includes('._app_attributes')) {
            return {
                rows: attributeRows.map((row) =>
                    options.jsonbCodenames
                        ? {
                              ...row,
                              codename: createSyntheticCodenameVlc(String(row.codename))
                          }
                        : row
                )
            }
        }

        if (sql.includes('._app_attributes')) {
            return {
                rows: attributeRows.map(({ object_codename, codename, column_name }) => ({
                    object_codename: options.jsonbCodenames ? createSyntheticCodenameVlc(String(object_codename)) : object_codename,
                    codename: options.jsonbCodenames ? createSyntheticCodenameVlc(String(codename)) : codename,
                    column_name
                }))
            }
        }

        if (sql.includes('._app_objects')) {
            return {
                rows: objectRows.map(({ codename, table_name }) => ({
                    codename: options.jsonbCodenames ? createSyntheticCodenameVlc(String(codename)) : codename,
                    table_name
                }))
            }
        }

        return { rows: [] }
    })
})

describe('systemAppSchemaCompiler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGenerateFullSchema.mockResolvedValue({
            success: true,
            schemaName: 'profiles',
            tablesCreated: [],
            errors: []
        })
        mockCreateSchema.mockResolvedValue(undefined)
        mockSyncSystemMetadata.mockResolvedValue(undefined)
        mockGetLatestMigration.mockResolvedValue({
            id: 'migration-1',
            name: 'baseline_profiles_structure_1_0_0',
            appliedAt: new Date('2026-03-13T00:00:00.000Z'),
            meta: {
                snapshotAfter: {
                    version: 2,
                    generatedAt: '2026-03-13T00:00:00.000Z',
                    hasSystemTables: true,
                    entities: {}
                }
            }
        })
        mockCalculateDiff.mockReturnValue({ hasChanges: false, additive: [], destructive: [], summary: 'no changes' })
        mockApplyAllChanges.mockResolvedValue({ success: true, changesApplied: 1, errors: [] })
    })

    it('builds schema generation options from a registered compiler plan', () => {
        const plan = buildRegisteredSystemAppSchemaGenerationPlan('profiles')

        expect(
            buildSystemAppSchemaGenerationOptions(plan, {
                recordMigration: true,
                migrationDescription: 'system-app-cutover'
            })
        ).toEqual({
            recordMigration: true,
            migrationDescription: 'system-app-cutover',
            systemTableCapabilities: {
                includeAttributes: true,
                includeValues: false,
                includeLayouts: false,
                includeWidgets: false
            }
        })
    })

    it('applies a schema generation plan through schema-ddl with synthetic business entities', async () => {
        const plan = buildRegisteredSystemAppSchemaGenerationPlan('metahubs')

        const result = await applySystemAppSchemaGenerationPlan({ tag: 'knex' } as never, plan, {
            recordMigration: true,
            migrationDescription: 'metahubs-cutover'
        })

        expect(MockSchemaGenerator).toHaveBeenCalledWith({ tag: 'knex' })
        expect(mockGenerateFullSchema).toHaveBeenCalledWith(
            'metahubs',
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'metahubs',
                    kind: 'catalog',
                    physicalTableName: 'cat_metahubs',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'codename',
                            physicalColumnName: 'codename',
                            dataType: 'STRING',
                            isRequired: true
                        })
                    ])
                }),
                expect.objectContaining({
                    codename: 'metahub_users',
                    kind: 'relation',
                    physicalTableName: 'rel_metahub_users',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'user_id',
                            physicalColumnName: 'user_id',
                            dataType: 'REF',
                            isRequired: true
                        })
                    ])
                }),
                expect.objectContaining({
                    codename: 'template_versions',
                    kind: 'document',
                    physicalTableName: 'doc_template_versions',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'manifest_json',
                            physicalColumnName: 'manifest_json',
                            dataType: 'JSON',
                            isRequired: true
                        })
                    ])
                })
            ]),
            expect.objectContaining({
                recordMigration: true,
                migrationDescription: 'metahubs-cutover',
                migrationName: buildExpectedBaselineMigrationName('metahubs'),
                migrationManager: expect.objectContaining({ tag: 'migration-manager' }),
                systemTableCapabilities: {
                    includeAttributes: true,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            })
        )
        expect(result).toEqual({
            success: true,
            schemaName: 'profiles',
            tablesCreated: [],
            errors: []
        })
    })

    it('can apply a registered system app key directly', async () => {
        await applyRegisteredSystemAppSchemaGenerationPlan({ tag: 'knex' } as never, 'profiles')

        expect(mockGenerateFullSchema).toHaveBeenCalledWith(
            'profiles',
            [
                expect.objectContaining({
                    codename: 'profiles',
                    kind: 'catalog',
                    physicalTableName: 'cat_profiles',
                    presentation: expect.objectContaining({
                        name: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({
                                    content: 'Profiles'
                                })
                            })
                        })
                    }),
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'nickname',
                            physicalColumnName: 'nickname',
                            dataType: 'STRING',
                            isDisplayAttribute: true,
                            presentation: expect.objectContaining({
                                name: expect.objectContaining({
                                    locales: expect.objectContaining({
                                        en: expect.objectContaining({
                                            content: 'Nickname'
                                        })
                                    })
                                })
                            }),
                            validationRules: {
                                minLength: 2,
                                maxLength: 50,
                                trim: true
                            }
                        }),
                        expect.objectContaining({
                            codename: 'settings',
                            physicalColumnName: 'settings',
                            uiConfig: {
                                editor: 'json'
                            }
                        })
                    ])
                })
            ],
            expect.objectContaining({
                recordMigration: true,
                migrationName: buildExpectedBaselineMigrationName('profiles'),
                migrationDescription: 'profiles fixed-system baseline schema',
                migrationManager: expect.objectContaining({ tag: 'migration-manager' }),
                systemTableCapabilities: {
                    includeAttributes: true,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            })
        )
    })

    it('builds synthetic business fields for admin fixed schema compiler plans', async () => {
        await applyRegisteredSystemAppSchemaGenerationPlan({ tag: 'knex' } as never, 'admin')

        expect(mockGenerateFullSchema).toHaveBeenCalledWith(
            'admin',
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'roles',
                    physicalTableName: 'cat_roles',
                    presentation: expect.objectContaining({
                        name: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({
                                    content: 'Roles'
                                })
                            })
                        })
                    }),
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'codename',
                            physicalColumnName: 'codename',
                            dataType: 'STRING',
                            isRequired: true,
                            validationRules: {
                                maxLength: 50,
                                pattern: '^[a-z0-9:_-]+$'
                            }
                        }),
                        expect.objectContaining({
                            codename: 'name',
                            physicalColumnName: 'name',
                            dataType: 'JSON',
                            isDisplayAttribute: true,
                            presentation: expect.objectContaining({
                                name: expect.objectContaining({
                                    locales: expect.objectContaining({
                                        en: expect.objectContaining({
                                            content: 'Role Name'
                                        })
                                    })
                                })
                            })
                        })
                    ])
                }),
                expect.objectContaining({
                    codename: 'settings',
                    physicalTableName: 'cfg_settings',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'value',
                            physicalColumnName: 'value',
                            dataType: 'JSON',
                            isRequired: true,
                            uiConfig: {
                                editor: 'json'
                            }
                        })
                    ])
                }),
                expect.objectContaining({
                    codename: 'role_permissions',
                    physicalTableName: 'rel_role_permissions',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'role_id',
                            physicalColumnName: 'role_id',
                            dataType: 'REF',
                            isRequired: true,
                            targetEntityKind: 'catalog',
                            targetEntityId: expect.any(String)
                        })
                    ])
                })
            ]),
            expect.objectContaining({
                recordMigration: true,
                migrationName: buildExpectedBaselineMigrationName('admin'),
                migrationDescription: 'admin fixed-system baseline schema',
                migrationManager: expect.objectContaining({ tag: 'migration-manager' }),
                systemTableCapabilities: {
                    includeAttributes: true,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            })
        )
    })

    it('builds synthetic business fields for applications fixed schema compiler plans', async () => {
        await applyRegisteredSystemAppSchemaGenerationPlan({ tag: 'knex' } as never, 'applications')

        expect(mockGenerateFullSchema).toHaveBeenCalledWith(
            'applications',
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'applications',
                    physicalTableName: 'cat_applications',
                    presentation: expect.objectContaining({
                        name: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({
                                    content: 'Applications'
                                })
                            })
                        })
                    }),
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'name',
                            physicalColumnName: 'name',
                            dataType: 'JSON',
                            isRequired: true,
                            isDisplayAttribute: true,
                            presentation: expect.objectContaining({
                                name: expect.objectContaining({
                                    locales: expect.objectContaining({
                                        en: expect.objectContaining({
                                            content: 'Application Name'
                                        })
                                    })
                                })
                            })
                        }),
                        expect.objectContaining({
                            codename: 'schema_status',
                            physicalColumnName: 'schema_status',
                            dataType: 'STRING',
                            uiConfig: {
                                readOnly: true
                            }
                        })
                    ])
                }),
                expect.objectContaining({
                    codename: 'connectors',
                    physicalTableName: 'cat_connectors',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'application_id',
                            physicalColumnName: 'application_id',
                            dataType: 'REF',
                            isRequired: true,
                            targetEntityKind: 'catalog',
                            targetEntityId: expect.any(String)
                        })
                    ])
                }),
                expect.objectContaining({
                    codename: 'application_users',
                    physicalTableName: 'rel_application_users',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'user_id',
                            physicalColumnName: 'user_id',
                            dataType: 'REF',
                            isRequired: true
                        })
                    ])
                })
            ]),
            expect.objectContaining({
                recordMigration: true,
                migrationName: buildExpectedBaselineMigrationName('applications'),
                migrationDescription: 'applications fixed-system baseline schema',
                migrationManager: expect.objectContaining({ tag: 'migration-manager' }),
                systemTableCapabilities: {
                    includeAttributes: true,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            })
        )
    })

    it('builds synthetic business fields for metahubs fixed schema compiler plans', async () => {
        await applyRegisteredSystemAppSchemaGenerationPlan({ tag: 'knex' } as never, 'metahubs')

        expect(mockGenerateFullSchema).toHaveBeenCalledWith(
            'metahubs',
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'metahubs',
                    physicalTableName: 'cat_metahubs',
                    presentation: expect.objectContaining({
                        name: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({
                                    content: 'Metahubs'
                                })
                            })
                        })
                    }),
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'codename',
                            physicalColumnName: 'codename',
                            dataType: 'STRING',
                            isRequired: true
                        }),
                        expect.objectContaining({
                            codename: 'template_version_id',
                            physicalColumnName: 'template_version_id',
                            dataType: 'REF',
                            targetEntityKind: 'document',
                            targetEntityId: expect.any(String)
                        })
                    ])
                }),
                expect.objectContaining({
                    codename: 'publications',
                    physicalTableName: 'doc_publications',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'access_mode',
                            physicalColumnName: 'access_mode',
                            dataType: 'STRING',
                            isRequired: true,
                            uiConfig: {
                                control: 'select'
                            }
                        }),
                        expect.objectContaining({
                            codename: 'schema_snapshot',
                            physicalColumnName: 'schema_snapshot',
                            dataType: 'JSON'
                        })
                    ])
                }),
                expect.objectContaining({
                    codename: 'publication_versions',
                    physicalTableName: 'doc_publication_versions',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'snapshot_json',
                            physicalColumnName: 'snapshot_json',
                            dataType: 'JSON',
                            isRequired: true,
                            uiConfig: {
                                editor: 'json'
                            }
                        }),
                        expect.objectContaining({
                            codename: 'publication_id',
                            physicalColumnName: 'publication_id',
                            dataType: 'REF',
                            isRequired: true,
                            targetEntityKind: 'document',
                            targetEntityId: expect.any(String)
                        })
                    ])
                })
            ]),
            expect.objectContaining({
                recordMigration: true,
                migrationName: buildExpectedBaselineMigrationName('metahubs'),
                migrationDescription: 'metahubs fixed-system baseline schema',
                migrationManager: expect.objectContaining({ tag: 'migration-manager' }),
                systemTableCapabilities: {
                    includeAttributes: true,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            })
        )
    })

    it('applies registered schema generation plans in deterministic registry order', async () => {
        mockGenerateFullSchema
            .mockResolvedValueOnce({
                success: true,
                schemaName: 'public',
                tablesCreated: ['_app_settings'],
                errors: []
            })
            .mockResolvedValueOnce({
                success: true,
                schemaName: 'profiles',
                tablesCreated: ['_app_settings'],
                errors: []
            })

        const result = await applyRegisteredSystemAppSchemaGenerationPlans({ tag: 'knex' } as never, {
            keys: ['public', 'profiles']
        })

        expect(mockGenerateFullSchema).toHaveBeenNthCalledWith(
            1,
            'public',
            [],
            expect.objectContaining({
                recordMigration: true,
                migrationName: buildExpectedBaselineMigrationName('public'),
                migrationDescription: 'public fixed-system baseline schema',
                migrationManager: expect.objectContaining({ tag: 'migration-manager' }),
                systemTableCapabilities: {
                    includeAttributes: false,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            })
        )
        expect(mockGenerateFullSchema).toHaveBeenNthCalledWith(
            2,
            'profiles',
            [
                expect.objectContaining({
                    codename: 'profiles',
                    kind: 'catalog',
                    physicalTableName: 'cat_profiles'
                })
            ],
            expect.objectContaining({
                recordMigration: true,
                migrationName: buildExpectedBaselineMigrationName('profiles'),
                migrationDescription: 'profiles fixed-system baseline schema',
                migrationManager: expect.objectContaining({ tag: 'migration-manager' }),
                systemTableCapabilities: {
                    includeAttributes: true,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            })
        )
        expect(result).toEqual({
            applied: [
                {
                    definitionKey: 'public',
                    schemaName: 'public',
                    stage: 'target',
                    storageModel: 'legacy_fixed',
                    tablesCreated: ['_app_settings']
                },
                {
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    stage: 'target',
                    storageModel: 'application_like',
                    tablesCreated: ['_app_settings']
                }
            ]
        })
    })

    it('rejects unknown keys when applying multiple registered system app plans', async () => {
        await expect(
            applyRegisteredSystemAppSchemaGenerationPlans({ tag: 'knex' } as never, {
                keys: ['profiles', 'unknown']
            })
        ).rejects.toThrow('Unknown registered system app definition keys: unknown')
    })

    it('can plan a filtered registered system app cutover wave without executing it', () => {
        expect(planRegisteredSystemAppSchemaGenerationPlans('target', ['profiles', 'metahubs']).map((plan) => plan.definitionKey)).toEqual([
            'profiles',
            'metahubs'
        ])
        expect(mockGenerateFullSchema).not.toHaveBeenCalled()
    })

    it('validates registered compiled system app artifacts as a deterministic compiler contract', () => {
        const validation = validateRegisteredSystemAppCompiledDefinitions('target', ['profiles', 'metahubs'])

        expect(validation.ok).toBe(true)
        expect(validation.issues).toEqual([])
        expect(validation.artifactSets.map((entry) => entry.plan.definitionKey)).toEqual(['profiles', 'metahubs'])
    })

    it('rejects compiled object artifacts that lose explicit manifest presentation metadata', () => {
        const [artifactSet] = compileRegisteredSystemAppSchemaDefinitionArtifacts('target', ['applications'])

        expect(artifactSet).toBeDefined()

        const brokenArtifacts = artifactSet!.artifacts.map((artifact) => {
            if (artifact.schemaQualifiedName !== 'system_app_compiled.object.target.applications.applications.cat_applications') {
                return artifact
            }

            const payload = JSON.parse(artifact.sql) as Record<string, unknown>
            delete payload.presentation

            return {
                ...artifact,
                sql: JSON.stringify(payload)
            }
        })

        expect(
            validateSystemAppCompiledArtifactSet({
                ...artifactSet!,
                artifacts: brokenArtifacts
            })
        ).toContain('applications: compiled object artifact cat_applications must preserve manifest presentation metadata')
    })

    it('rejects compiled attribute artifacts that lose explicit manifest validation/ui metadata', () => {
        const [artifactSet] = compileRegisteredSystemAppSchemaDefinitionArtifacts('target', ['profiles'])

        expect(artifactSet).toBeDefined()

        const brokenArtifacts = artifactSet!.artifacts.map((artifact) => {
            if (artifact.schemaQualifiedName !== 'system_app_compiled.attribute.target.profiles.profiles.cat_profiles.nickname') {
                return artifact
            }

            const payload = JSON.parse(artifact.sql) as Record<string, unknown>
            payload.validationRules = null

            return {
                ...artifact,
                sql: JSON.stringify(payload)
            }
        })

        expect(
            validateSystemAppCompiledArtifactSet({
                ...artifactSet!,
                artifacts: brokenArtifacts
            })
        ).toContain('profiles: compiled attribute artifact cat_profiles.nickname must preserve manifest metadata')
    })

    it('bootstraps fixed system app metadata without recreating business tables', async () => {
        const transactionKnex = { tag: 'trx' }
        const knex = {
            raw: jest.fn(async () => ({ rows: [] })),
            transaction: jest.fn(async (callback: (trx: unknown) => Promise<void>) => callback(transactionKnex))
        }

        const result = await bootstrapSystemAppStructureMetadata(knex as never, buildRegisteredSystemAppSchemaGenerationPlan('profiles'))

        expect(MockSchemaGenerator).toHaveBeenCalledWith(knex)
        expect(mockCreateSchema).toHaveBeenCalledWith('profiles', transactionKnex)
        expect(mockSyncSystemMetadata).toHaveBeenCalledWith(
            'profiles',
            [
                expect.objectContaining({
                    codename: 'profiles',
                    physicalTableName: 'cat_profiles',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'nickname',
                            physicalColumnName: 'nickname',
                            dataType: 'STRING'
                        })
                    ])
                })
            ],
            {
                trx: transactionKnex,
                userId: null,
                removeMissing: true,
                systemTableCapabilities: {
                    includeAttributes: true,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            }
        )
        expect(result).toEqual({
            definitionKey: 'profiles',
            schemaName: 'profiles',
            stage: 'target',
            storageModel: 'application_like',
            metadataObjectCount: 1,
            metadataAttributeCount: 12,
            systemTables: ['_app_migrations', '_app_settings', '_app_objects', '_app_attributes'],
            syncStrategy: 'full_sync'
        })
        expect(mockGenerateFullSchema).not.toHaveBeenCalled()
    })

    it('skips metadata synchronization when live system app metadata already matches the compiled target state', async () => {
        const knex = createStructureInspectionKnex()

        const result = await bootstrapSystemAppStructureMetadata(knex as never, buildRegisteredSystemAppSchemaGenerationPlan('profiles'))

        expect(mockCreateSchema).not.toHaveBeenCalled()
        expect(mockSyncSystemMetadata).not.toHaveBeenCalled()
        expect(result).toEqual({
            definitionKey: 'profiles',
            schemaName: 'profiles',
            stage: 'target',
            storageModel: 'application_like',
            metadataObjectCount: 1,
            metadataAttributeCount: 12,
            systemTables: ['_app_migrations', '_app_settings', '_app_objects', '_app_attributes'],
            syncStrategy: 'noop'
        })
    })

    it('falls back to a full metadata sync when the live metadata fingerprint drifts from the compiled target state', async () => {
        const transactionKnex = { tag: 'trx' }
        const knex = {
            ...createStructureInspectionKnex({ fingerprintDrift: true }),
            transaction: jest.fn(async (callback: (trx: unknown) => Promise<void>) => callback(transactionKnex))
        }

        const result = await bootstrapSystemAppStructureMetadata(knex as never, buildRegisteredSystemAppSchemaGenerationPlan('profiles'))

        expect(mockCreateSchema).toHaveBeenCalledWith('profiles', transactionKnex)
        expect(mockSyncSystemMetadata).toHaveBeenCalledTimes(1)
        expect(result.syncStrategy).toBe('full_sync')
    })

    it('bootstraps only application-like fixed system apps in deterministic registry order', async () => {
        const transactionKnex = { tag: 'trx' }
        const knex = {
            raw: jest.fn(async () => ({ rows: [] })),
            transaction: jest.fn(async (callback: (trx: unknown) => Promise<void>) => callback(transactionKnex))
        }

        const result = await bootstrapRegisteredSystemAppStructureMetadata(knex as never, {
            keys: ['public', 'profiles', 'admin']
        })

        expect(mockCreateSchema).toHaveBeenNthCalledWith(1, 'admin', transactionKnex)
        expect(mockCreateSchema).toHaveBeenNthCalledWith(2, 'profiles', transactionKnex)
        expect(result.bootstrapped.map((entry) => entry.definitionKey)).toEqual(['admin', 'profiles'])
        expect(result.bootstrapped).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    definitionKey: 'admin',
                    metadataObjectCount: 6,
                    metadataAttributeCount: 33
                }),
                expect.objectContaining({
                    definitionKey: 'profiles',
                    metadataObjectCount: 1,
                    metadataAttributeCount: 12
                })
            ])
        )
    })

    it('inspects registered structure metadata for fixed system apps', async () => {
        const knex = createStructureInspectionKnex()

        const result = await inspectRegisteredSystemAppStructureMetadata(knex as never, 'target', ['profiles'])

        expect(result).toEqual({
            ok: true,
            issues: [],
            entries: [
                expect.objectContaining({
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    missingSystemTables: [],
                    missingObjectCodenames: [],
                    missingAttributeKeys: [],
                    objectCount: 1,
                    attributeCount: 12
                })
            ]
        })
    })

    it('inspects registered structure metadata when system metadata codenames are stored as JSONB VLC', async () => {
        const knex = createStructureInspectionKnex({ jsonbCodenames: true })

        const result = await inspectRegisteredSystemAppStructureMetadata(knex as never, 'target', ['profiles'])

        expect(result).toEqual({
            ok: true,
            issues: [],
            entries: [
                expect.objectContaining({
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    missingSystemTables: [],
                    missingObjectCodenames: [],
                    missingAttributeKeys: [],
                    objectCount: 1,
                    attributeCount: 12,
                    metadataFingerprintMatches: true
                })
            ]
        })
    })

    it('compiles deterministic declarative schema artifacts for a single fixed system-app plan', () => {
        const plan = buildRegisteredSystemAppSchemaGenerationPlan('profiles')
        const artifacts = compileSystemAppSchemaDefinitionArtifacts(plan)
        const schemaQualifiedNames = artifacts.map((artifact) => artifact.schemaQualifiedName)

        expect(artifacts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'profiles',
                    schemaQualifiedName: 'system_app_compiled.schema.target.profiles.profiles'
                }),
                expect.objectContaining({
                    name: 'profiles._app_migrations',
                    schemaQualifiedName: 'system_app_compiled.table.target.profiles.profiles._app_migrations'
                }),
                expect.objectContaining({
                    name: 'profiles._app_settings',
                    schemaQualifiedName: 'system_app_compiled.table.target.profiles.profiles._app_settings'
                }),
                expect.objectContaining({
                    name: 'profiles._app_objects',
                    schemaQualifiedName: 'system_app_compiled.table.target.profiles.profiles._app_objects'
                }),
                expect.objectContaining({
                    name: 'profiles._app_attributes',
                    schemaQualifiedName: 'system_app_compiled.table.target.profiles.profiles._app_attributes'
                }),
                expect.objectContaining({
                    name: 'profiles.cat_profiles',
                    schemaQualifiedName: 'system_app_compiled.table.target.profiles.profiles.cat_profiles',
                    dependencies: expect.arrayContaining(['system_app_compiled.table.target.profiles.profiles._app_objects::custom'])
                }),
                expect.objectContaining({
                    name: 'profiles.cat_profiles.__object__',
                    schemaQualifiedName: 'system_app_compiled.object.target.profiles.profiles.cat_profiles',
                    dependencies: expect.arrayContaining([
                        'system_app_compiled.table.target.profiles.profiles._app_objects::custom',
                        'system_app_compiled.table.target.profiles.profiles.cat_profiles::custom'
                    ])
                }),
                expect.objectContaining({
                    name: 'profiles.cat_profiles.__attr__.nickname',
                    schemaQualifiedName: 'system_app_compiled.attribute.target.profiles.profiles.cat_profiles.nickname',
                    dependencies: expect.arrayContaining([
                        'system_app_compiled.table.target.profiles.profiles._app_attributes::custom',
                        'system_app_compiled.object.target.profiles.profiles.cat_profiles::custom'
                    ])
                })
            ])
        )
        expect(schemaQualifiedNames.slice(0, 6)).toEqual([
            'system_app_compiled.schema.target.profiles.profiles',
            'system_app_compiled.table.target.profiles.profiles._app_migrations',
            'system_app_compiled.table.target.profiles.profiles._app_settings',
            'system_app_compiled.table.target.profiles.profiles._app_objects',
            'system_app_compiled.table.target.profiles.profiles._app_attributes',
            'system_app_compiled.table.target.profiles.profiles.cat_profiles'
        ])
        expect(schemaQualifiedNames.indexOf('system_app_compiled.object.target.profiles.profiles.cat_profiles')).toBeGreaterThan(
            schemaQualifiedNames.indexOf('system_app_compiled.table.target.profiles.profiles.cat_profiles')
        )
        expect(
            schemaQualifiedNames.indexOf('system_app_compiled.attribute.target.profiles.profiles.cat_profiles.nickname')
        ).toBeGreaterThan(schemaQualifiedNames.indexOf('system_app_compiled.object.target.profiles.profiles.cat_profiles'))

        const profileNicknameArtifact = artifacts.find(
            (artifact) => artifact.schemaQualifiedName === 'system_app_compiled.attribute.target.profiles.profiles.cat_profiles.nickname'
        )
        expect(profileNicknameArtifact).toBeDefined()
        expect(JSON.parse(profileNicknameArtifact!.sql)).toEqual(
            expect.objectContaining({
                kind: 'system-app-compiled-attribute',
                targetObjectCodename: null,
                presentation: expect.objectContaining({
                    name: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({
                                content: 'Nickname'
                            })
                        })
                    })
                }),
                validationRules: {
                    minLength: 2,
                    maxLength: 50,
                    trim: true
                },
                uiConfig: null
            })
        )

        const profileObjectArtifact = artifacts.find(
            (artifact) => artifact.schemaQualifiedName === 'system_app_compiled.object.target.profiles.profiles.cat_profiles'
        )
        expect(profileObjectArtifact).toBeDefined()
        expect(JSON.parse(profileObjectArtifact!.sql)).toEqual(
            expect.objectContaining({
                kind: 'system-app-compiled-object',
                presentation: expect.objectContaining({
                    name: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({
                                content: 'Profiles'
                            })
                        })
                    })
                })
            })
        )
    })

    it('compiles registered fixed system-app artifacts in deterministic registry order', () => {
        const compiled = compileRegisteredSystemAppSchemaDefinitionArtifacts('target', ['profiles', 'metahubs'])
        const profileNames = compiled[0]?.artifacts.map((artifact) => artifact.schemaQualifiedName) ?? []
        const metahubNames = compiled[1]?.artifacts.map((artifact) => artifact.schemaQualifiedName) ?? []

        expect(compiled.map((entry) => entry.plan.definitionKey)).toEqual(['profiles', 'metahubs'])
        expect(profileNames.slice(0, 6)).toEqual([
            'system_app_compiled.schema.target.profiles.profiles',
            'system_app_compiled.table.target.profiles.profiles._app_migrations',
            'system_app_compiled.table.target.profiles.profiles._app_settings',
            'system_app_compiled.table.target.profiles.profiles._app_objects',
            'system_app_compiled.table.target.profiles.profiles._app_attributes',
            'system_app_compiled.table.target.profiles.profiles.cat_profiles'
        ])
        expect(profileNames).toEqual(
            expect.arrayContaining([
                'system_app_compiled.object.target.profiles.profiles.cat_profiles',
                'system_app_compiled.attribute.target.profiles.profiles.cat_profiles.nickname'
            ])
        )
        expect(metahubNames.slice(0, 12)).toEqual([
            'system_app_compiled.schema.target.metahubs.metahubs',
            'system_app_compiled.table.target.metahubs.metahubs._app_migrations',
            'system_app_compiled.table.target.metahubs.metahubs._app_settings',
            'system_app_compiled.table.target.metahubs.metahubs._app_objects',
            'system_app_compiled.table.target.metahubs.metahubs._app_attributes',
            'system_app_compiled.table.target.metahubs.metahubs.cat_metahubs',
            'system_app_compiled.table.target.metahubs.metahubs.cat_metahub_branches',
            'system_app_compiled.table.target.metahubs.metahubs.rel_metahub_users',
            'system_app_compiled.table.target.metahubs.metahubs.cat_templates',
            'system_app_compiled.table.target.metahubs.metahubs.doc_template_versions',
            'system_app_compiled.table.target.metahubs.metahubs.doc_publications',
            'system_app_compiled.table.target.metahubs.metahubs.doc_publication_versions'
        ])
        expect(metahubNames).toEqual(
            expect.arrayContaining([
                'system_app_compiled.object.target.metahubs.metahubs.cat_metahubs',
                'system_app_compiled.object.target.metahubs.metahubs.doc_publications',
                'system_app_compiled.attribute.target.metahubs.metahubs.doc_publications.access_mode',
                'system_app_compiled.attribute.target.metahubs.metahubs.doc_publication_versions.snapshot_json'
            ])
        )

        const publicationIdAttribute = compiled[1]?.artifacts.find(
            (artifact) =>
                artifact.schemaQualifiedName ===
                'system_app_compiled.attribute.target.metahubs.metahubs.doc_publication_versions.publication_id'
        )
        expect(publicationIdAttribute).toBeDefined()
        expect(JSON.parse(publicationIdAttribute!.sql)).toEqual(
            expect.objectContaining({
                kind: 'system-app-compiled-attribute',
                targetObjectCodename: 'publications',
                presentation: expect.any(Object)
            })
        )
    })

    it('throws a deterministic error when schema-ddl reports generation failure', async () => {
        mockGenerateFullSchema.mockResolvedValue({
            success: false,
            schemaName: 'profiles',
            tablesCreated: [],
            errors: ['cannot create _app_settings']
        })

        await expect(applyRegisteredSystemAppSchemaGenerationPlan({ tag: 'knex' } as never, 'profiles')).rejects.toThrow(
            'Failed to apply system app schema generation plan for profiles: cannot create _app_settings'
        )
    })

    it('upgrades an already bootstrapped application-like fixed system app when the latest local snapshot drifts from target', async () => {
        const transactionChain = {
            table: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            onConflict: jest.fn().mockReturnThis(),
            ignore: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([])
        }
        const knex = {
            raw: jest.fn(async () => ({ rows: [{ table_name: '_app_migrations' }, { table_name: 'cat_profiles' }] })),
            transaction: jest.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback({
                    withSchema: jest.fn(() => transactionChain)
                })
            )
        }

        mockGetLatestMigration.mockResolvedValue({
            id: 'migration-2',
            name: 'baseline_profiles_structure_0_9_0',
            appliedAt: new Date('2026-03-12T00:00:00.000Z'),
            meta: {
                snapshotAfter: {
                    version: 2,
                    generatedAt: '2026-03-12T00:00:00.000Z',
                    hasSystemTables: true,
                    entities: {
                        'entity-1': {
                            codename: 'profiles',
                            kind: 'catalog',
                            tableName: 'cat_profiles',
                            fields: {}
                        }
                    }
                }
            }
        })
        mockCalculateDiff.mockReturnValue({
            hasChanges: true,
            additive: [{ type: 'ADD_COLUMN', tableName: 'cat_profiles', columnName: 'timezone' }],
            destructive: [],
            summary: 'Add timezone column'
        })

        const result = await ensureRegisteredSystemAppSchemaGenerationPlans(knex as never, {
            keys: ['profiles']
        })

        expect(MockSchemaMigrator).toHaveBeenCalledWith(knex, expect.any(Object), expect.objectContaining({ tag: 'migration-manager' }))
        expect(mockApplyAllChanges).toHaveBeenCalledWith(
            'profiles',
            expect.objectContaining({
                hasChanges: true,
                summary: 'Add timezone column'
            }),
            [
                expect.objectContaining({
                    codename: 'profiles',
                    physicalTableName: 'cat_profiles'
                })
            ],
            true,
            expect.objectContaining({
                recordMigration: true,
                migrationDescription: 'profiles fixed-system schema upgrade',
                systemTableCapabilities: {
                    includeAttributes: true,
                    includeValues: false,
                    includeLayouts: false,
                    includeWidgets: false
                }
            })
        )
        expect(result).toEqual({
            ensured: [
                {
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    stage: 'target',
                    storageModel: 'application_like',
                    action: 'upgraded',
                    tablesCreated: []
                }
            ]
        })
        expect(mockApplyAllChanges.mock.calls[0]?.[4]?.migrationName).toBeUndefined()
    })

    it('backfills the fixed-system baseline once and skips when the canonical local snapshot already matches target', async () => {
        const transactionChain = {
            table: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            onConflict: jest.fn().mockReturnThis(),
            ignore: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{ id: 'baseline-row' }])
        }
        const knex = {
            raw: jest.fn(async () => ({ rows: [{ table_name: '_app_migrations' }, { table_name: 'cat_profiles' }] })),
            transaction: jest.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback({
                    withSchema: jest.fn(() => transactionChain)
                })
            )
        }

        const result = await ensureRegisteredSystemAppSchemaGenerationPlans(knex as never, {
            keys: ['profiles']
        })

        expect(mockApplyAllChanges).not.toHaveBeenCalled()
        expect(result).toEqual({
            ensured: [
                {
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    stage: 'target',
                    storageModel: 'application_like',
                    action: 'baseline_backfilled',
                    tablesCreated: []
                }
            ]
        })
    })

    it('skips repeated startup when the latest local fixed-system snapshot already uses the canonical object-shaped schema snapshot', async () => {
        const transactionChain = {
            table: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            onConflict: jest.fn().mockReturnThis(),
            ignore: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([])
        }
        const knex = {
            raw: jest.fn(async () => ({ rows: [{ table_name: '_app_migrations' }, { table_name: 'cat_profiles' }] })),
            transaction: jest.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback({
                    withSchema: jest.fn(() => transactionChain)
                })
            )
        }

        mockGetLatestMigration.mockResolvedValue({
            id: 'migration-3',
            name: 'baseline_profiles_structure_0_1_0',
            appliedAt: new Date('2026-03-13T00:00:00.000Z'),
            meta: {
                snapshotAfter: {
                    version: 2,
                    generatedAt: '2026-03-13T00:00:00.000Z',
                    hasSystemTables: true,
                    entities: {
                        'entity-1': {
                            codename: 'profiles',
                            kind: 'catalog',
                            tableName: 'cat_profiles',
                            fields: {}
                        }
                    }
                }
            }
        })

        const result = await ensureRegisteredSystemAppSchemaGenerationPlans(knex as never, {
            keys: ['profiles']
        })

        expect(mockApplyAllChanges).not.toHaveBeenCalled()
        expect(result).toEqual({
            ensured: [
                {
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    stage: 'target',
                    storageModel: 'application_like',
                    action: 'skipped',
                    tablesCreated: []
                }
            ]
        })
    })

    it('fails loudly when an application-like fixed system app is only partially bootstrapped', async () => {
        const knex = {
            raw: jest.fn(async () => ({ rows: [{ table_name: 'cat_roles' }, { table_name: '_app_migrations' }] }))
        }

        await expect(
            ensureRegisteredSystemAppSchemaGenerationPlans(knex as never, {
                keys: ['admin']
            })
        ).rejects.toThrow('System app admin is in a partially bootstrapped fixed-schema state')
    })
})
