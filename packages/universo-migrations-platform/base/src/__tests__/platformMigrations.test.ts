import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import * as catalog from '@universo/migrations-catalog'
import { resolveSystemTableNames } from '@universo/schema-ddl'
import {
    diffRegisteredSystemAppCompiledDefinitions,
    diffRegisteredPlatformDefinitions,
    diffRegisteredSystemAppManifestDefinitions,
    diffRegisteredSystemAppSchemaPlanDefinitions,
    exportCatalogSystemAppCompiledDefinitionBundle,
    exportCatalogPlatformDefinitions,
    exportCatalogSystemAppManifestDefinitions,
    exportCatalogSystemAppManifestDefinitionBundle,
    exportCatalogSystemAppSchemaPlanDefinitionBundle,
    exportCatalogSystemAppCompiledDefinitions,
    exportRegisteredSystemAppCompiledDefinitionBundle,
    exportRegisteredSystemAppCompiledDefinitions,
    doctorRegisteredPlatformState,
    exportCatalogPlatformDefinitionBundle,
    exportRegisteredPlatformDefinitionBundle,
    exportRegisteredPlatformDefinitions,
    exportRegisteredSystemAppManifestDefinitionBundle,
    exportRegisteredSystemAppManifestDefinitions,
    exportRegisteredSystemAppSchemaPlanDefinitionBundle,
    exportRegisteredSystemAppSchemaPlanDefinitions,
    exportRegisteredTargetSystemAppSchemaGenerationPlans,
    importPlatformDefinitionsFromFile,
    lintRegisteredPlatformDefinitions,
    lintRegisteredSystemAppCompiledDefinitions,
    lintRegisteredSystemAppManifestDefinitions,
    lintRegisteredSystemAppSchemaPlanDefinitions,
    registeredSystemAppDefinitions,
    platformMigrations,
    syncRegisteredPlatformDefinitionsToCatalog
} from '../platformMigrations'
import { optimizeRlsPoliciesMigration } from '../rlsPolicyOptimization'
import { loadPlatformMigrationsFromSystemApps } from '../systemAppDefinitions'

const ORIGINAL_GLOBAL_MIGRATION_CATALOG_ENABLED = process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED

const TEST_SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE = 'universo-system-app-compiler'

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

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

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

const buildPlanStructureRows = (plan: ReturnType<typeof exportRegisteredTargetSystemAppSchemaGenerationPlans>[number]) => {
    const entities = plan.businessTables.map((table) => ({
        table,
        id: toDeterministicUuid(
            `${TEST_SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE}:${plan.definitionKey}:${plan.stage}:${table.kind}:${table.codename}:${table.tableName}`
        ),
        kind: mapBusinessTableKindToRuntimeEntityKind(table.kind)
    }))
    const entitiesByCodename = new Map(entities.map((entity) => [entity.table.codename, entity]))

    return {
        objectRows: entities.map((entity) => ({
            id: entity.id,
            kind: entity.kind,
            codename: entity.table.codename,
            table_name: entity.table.tableName,
            presentation_json: JSON.stringify(entity.table.presentation ?? createSyntheticPresentation(entity.table.codename)),
            config_json: JSON.stringify({
                systemAppDefinitionKey: plan.definitionKey,
                systemAppBusinessTableKind: entity.table.kind,
                systemAppCompilerStage: plan.stage
            })
        })),
        attributeRows: entities.flatMap((entity) =>
            (entity.table.fields ?? []).map((field) => {
                const targetEntity = field.targetTableCodename ? entitiesByCodename.get(field.targetTableCodename) ?? null : null

                return {
                    id: toDeterministicUuid(
                        `${TEST_SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE}:${plan.definitionKey}:${entity.table.kind}:${entity.table.codename}:${field.codename}:${field.physicalColumnName}`
                    ),
                    object_id: entity.id,
                    object_codename: entity.table.codename,
                    codename: field.codename,
                    column_name: field.physicalColumnName,
                    data_type: field.dataType,
                    is_required: field.isRequired ?? false,
                    is_display_attribute: field.isDisplayAttribute ?? false,
                    target_object_id: targetEntity?.id ?? null,
                    target_object_kind: targetEntity?.kind ?? null,
                    presentation_json: JSON.stringify(field.presentation ?? createSyntheticPresentation(field.codename)),
                    validation_rules_json: JSON.stringify(field.validationRules ?? {}),
                    ui_config_json: JSON.stringify(field.uiConfig ?? {})
                }
            })
        )
    }
}

const createStructureAwareKnex = (
    options: {
        legacyRows?: Array<{ table_schema: string; table_name: string }>
        missingAttribute?: { definitionKey: string; objectCodename: string; attributeCodename: string }
        catalogRows?: Array<Record<string, unknown>>
    } = {}
) => {
    const plans = exportRegisteredTargetSystemAppSchemaGenerationPlans().filter((plan) => plan.structureCapabilities.appCoreTables)
    return {
        raw: jest.fn(async (sql: string, bindings?: unknown[]) => {
            if (sql.includes('information_schema.tables')) {
                const schemaName = typeof bindings?.[0] === 'string' ? bindings[0] : null
                if (
                    sql.includes('(table_schema, table_name) in') &&
                    Array.isArray(bindings) &&
                    bindings.length > 2 &&
                    bindings.every((binding) => typeof binding === 'string') &&
                    bindings.some(
                        (binding) => binding === 'public' || binding === 'admin' || binding === 'applications' || binding === 'metahubs'
                    )
                ) {
                    return {
                        rows: options.legacyRows ?? []
                    }
                }

                const plan = plans.find((entry) => entry.schemaName === schemaName)
                if (!plan) {
                    return { rows: [] }
                }

                return {
                    rows: resolveSystemTableNames(plan.systemTableCapabilities).map((tableName) => ({
                        table_name: tableName
                    }))
                }
            }

            const objectMatch = sql.match(/from\s+"([^"]+)"\._app_objects/i)
            if (objectMatch) {
                const schemaName = objectMatch[1]!
                const plan = plans.find((entry) => entry.schemaName === schemaName)
                if (!plan) {
                    return { rows: [] }
                }

                const { objectRows } = buildPlanStructureRows(plan)

                if (sql.includes('presentation::text as presentation_json')) {
                    return {
                        rows: objectRows
                    }
                }

                return {
                    rows: objectRows.map(({ codename, table_name }) => ({ codename, table_name }))
                }
            }

            const attributeMatch = sql.match(/from\s+"([^"]+)"\._app_attributes/i)
            if (attributeMatch) {
                const schemaName = attributeMatch[1]!
                const plan = plans.find((entry) => entry.schemaName === schemaName)
                if (!plan) {
                    return { rows: [] }
                }

                const { attributeRows } = buildPlanStructureRows(plan)

                if (sql.includes('validation_rules::text as validation_rules_json')) {
                    return {
                        rows: attributeRows.filter((row) => {
                            if (!options.missingAttribute) {
                                return true
                            }

                            return !(
                                options.missingAttribute.definitionKey === plan.definitionKey &&
                                options.missingAttribute.objectCodename === row.object_codename &&
                                options.missingAttribute.attributeCodename === row.codename
                            )
                        })
                    }
                }

                return {
                    rows: attributeRows
                        .filter((row) => {
                            if (!options.missingAttribute) {
                                return true
                            }

                            return !(
                                options.missingAttribute.definitionKey === plan.definitionKey &&
                                options.missingAttribute.objectCodename === row.object_codename &&
                                options.missingAttribute.attributeCodename === row.codename
                            )
                        })
                        .map(({ object_codename, codename, column_name }) => ({
                            object_codename,
                            codename,
                            column_name
                        }))
                }
            }

            if (sql.includes('from upl_migrations.definition_registry registry')) {
                const requestedLogicalKeys = Array.isArray(bindings)
                    ? new Set(bindings.slice(1).filter((binding): binding is string => typeof binding === 'string'))
                    : null

                return {
                    rows:
                        options.catalogRows?.filter((row) => {
                            if (!requestedLogicalKeys) {
                                return true
                            }

                            return typeof row.logical_key === 'string' && requestedLogicalKeys.has(row.logical_key)
                        }) ?? []
                }
            }

            return { rows: [] }
        })
    } as never
}

const createCatalogStateRows = (
    artifacts: Array<{ schemaQualifiedName: string; kind: string; checksum: string }>,
    definitionFamily: string,
    options: {
        includeExport?: boolean
        includePublishedLifecycle?: boolean
        activePayloadArtifacts?: Array<Record<string, unknown>>
    } = {}
) =>
    artifacts.map((artifact, index) => ({
        logical_key: `${artifact.schemaQualifiedName}::${artifact.kind}`,
        registry_id: `registry-${definitionFamily}-${index}`,
        active_revision_id: `revision-${definitionFamily}-${index}`,
        source_kind: 'file',
        meta: {
            definitionFamily
        },
        active_checksum: artifact.checksum,
        active_payload: options.activePayloadArtifacts?.[index] ?? artifact,
        active_provenance:
            options.includePublishedLifecycle === false
                ? null
                : {
                      reviewState: 'published',
                      checksumFamily: 'sha256',
                      sourceKind: 'file'
                  },
        has_export: options.includeExport === false ? false : true
    }))

describe('platformMigrations', () => {
    beforeEach(() => {
        process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED = 'true'
    })

    afterAll(() => {
        if (ORIGINAL_GLOBAL_MIGRATION_CATALOG_ENABLED === undefined) {
            delete process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED
            return
        }

        process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED = ORIGINAL_GLOBAL_MIGRATION_CATALOG_ENABLED
    })

    it('loads package-owned system app definitions before flattening them into platform migrations', () => {
        expect(registeredSystemAppDefinitions.map((definition) => definition.key)).toEqual([
            'public',
            'admin',
            'profiles',
            'metahubs',
            'applications'
        ])
        expect(registeredSystemAppDefinitions.map((definition) => definition.ownerPackage)).toEqual([
            '@universo/migrations-platform',
            '@universo/admin-backend',
            '@universo/profile-backend',
            '@universo/metahubs-backend',
            '@universo/applications-backend'
        ])
    })

    it('rejects duplicate system app definition keys before flattening', () => {
        expect(() =>
            loadPlatformMigrationsFromSystemApps([
                registeredSystemAppDefinitions[0]!,
                {
                    ...registeredSystemAppDefinitions[0]!,
                    ownerPackage: '@universo/test'
                }
            ])
        ).toThrow('Duplicate system app definition key')
    })

    it('registers all platform schemas through native SQL definitions', () => {
        const adminMigration = platformMigrations.find((migration) => migration.id === 'PrepareAdminSchemaSupport1733400000000')
        const profileMigration = platformMigrations.find((migration) => migration.id === 'PrepareProfileSchemaSupport1741277504477')
        const metahubsMigration = platformMigrations.find((migration) => migration.id === 'PrepareMetahubsSchemaSupport1766351182000')
        const applicationsMigration = platformMigrations.find(
            (migration) => migration.id === 'PrepareApplicationsSchemaSupport1800000000000'
        )

        expect(adminMigration).toBeDefined()
        expect(profileMigration).toBeDefined()
        expect(metahubsMigration).toBeDefined()
        expect(applicationsMigration).toBeDefined()
        expect(adminMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'admin'
        })
        expect(profileMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'profiles'
        })
        expect(metahubsMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'metahubs'
        })
        expect(applicationsMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'applications'
        })
        expect(adminMigration?.checksumSource).toContain('"kind":"native-sql-migration"')
        expect(profileMigration?.checksumSource).toContain('"kind":"native-sql-migration"')
        expect(metahubsMigration?.checksumSource).toContain('"kind":"native-sql-migration"')
        expect(applicationsMigration?.checksumSource).toContain('"kind":"native-sql-migration"')
        for (const migration of platformMigrations) {
            expect(migration.checksumSource ?? '').not.toContain('typeorm-migration:')
        }
    })

    it('registers the admin soft-delete columns as part of converged admin schema bootstrap', () => {
        const adminMigration = platformMigrations.find((migration) => migration.id === 'FinalizeAdminSchemaSupport1733400000001')
        expect(adminMigration).toBeDefined()
        expect(adminMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'admin'
        })
        expect(adminMigration?.checksumSource).toContain('"kind":"native-sql-migration"')
    })

    it('registers the uuid v7 pgcrypto repair migration before schema bootstrap migrations', () => {
        const repairMigration = platformMigrations.find((migration) => migration.id === 'RepairUuidV7PgcryptoDependency1500000000001')

        expect(repairMigration).toBeDefined()
        expect(repairMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'public'
        })

        const repairIndex = platformMigrations.findIndex((migration) => migration.id === 'RepairUuidV7PgcryptoDependency1500000000001')
        const adminIndex = platformMigrations.findIndex((migration) => migration.id === 'PrepareAdminSchemaSupport1733400000000')

        expect(repairIndex).toBeGreaterThanOrEqual(0)
        expect(repairIndex).toBeLessThan(adminIndex)
    })

    it('registers built-in metahub template seeding as a versioned platform migration', () => {
        const templateSeedMigration = platformMigrations.find((migration) => migration.id === 'SeedBuiltinMetahubTemplates1800000000250')

        expect(templateSeedMigration).toBeDefined()
        expect(templateSeedMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'metahubs'
        })
        expect(templateSeedMigration?.sourceKind).toBe('template_seed')

        const templateSeedIndex = platformMigrations.findIndex((migration) => migration.id === 'SeedBuiltinMetahubTemplates1800000000250')
        const metahubsSchemaIndex = platformMigrations.findIndex(
            (migration) => migration.id === 'FinalizeMetahubsSchemaSupport1766351182001'
        )

        expect(templateSeedIndex).toBeGreaterThan(metahubsSchemaIndex)
    })

    it('sorts flattened system app migrations deterministically by version and id', () => {
        expect(platformMigrations.map((migration) => migration.id)).toEqual([
            'InitializeUuidV7Function1500000000000',
            'RepairUuidV7PgcryptoDependency1500000000001',
            'PrepareAdminSchemaSupport1733400000000',
            'FinalizeAdminSchemaSupport1733400000001',
            'PrepareProfileSchemaSupport1741277504477',
            'FinalizeProfileSchemaSupport1741277504478',
            'PrepareMetahubsSchemaSupport1766351182000',
            'FinalizeMetahubsSchemaSupport1766351182001',
            'PrepareApplicationsSchemaSupport1800000000000',
            'FinalizeApplicationsSchemaSupport1800000000001',
            'OptimizeRlsPolicies1800000000200',
            'SeedBuiltinMetahubTemplates1800000000250'
        ])
    })

    it('drops optimized RLS policies through guarded SQL so missing tables do not break startup', async () => {
        const executedSql: string[] = []

        await optimizeRlsPoliciesMigration.up({
            knex: {} as never,
            logger: {
                info: () => undefined,
                warn: () => undefined,
                error: () => undefined
            },
            raw: async (sql: string) => {
                executedSql.push(sql)
                return {} as never
            },
            runId: 'test-run',
            scope: optimizeRlsPoliciesMigration.scope
        })

        const dropStatements = executedSql.filter((sql) => sql.includes('DROP POLICY IF EXISTS'))

        expect(dropStatements.length).toBeGreaterThan(0)
        expect(dropStatements).toEqual(
            expect.arrayContaining([
                expect.stringContaining(`to_regclass('admin.cat_roles')`),
                expect.stringContaining('WHEN undefined_table THEN NULL')
            ])
        )

        for (const statement of dropStatements) {
            expect(normalizeSql(statement)).not.toMatch(/^DROP POLICY IF EXISTS /)
        }
    })

    it('keeps post-schema-only migrations out of the prelude wave', () => {
        const preludeMigrations = loadPlatformMigrationsFromSystemApps(registeredSystemAppDefinitions, [
            'standalone',
            'pre_schema_generation'
        ])

        expect(preludeMigrations.map((entry) => entry.id)).not.toContain('OptimizeRlsPolicies1800000000200')
        expect(preludeMigrations.map((entry) => entry.id)).not.toContain('SeedBuiltinMetahubTemplates1800000000250')
    })

    it('exports deterministic definition artifacts for registered platform migrations', () => {
        const artifacts = exportRegisteredPlatformDefinitions()

        expect(artifacts).toHaveLength(platformMigrations.length)
        expect(artifacts[0]).toEqual(
            expect.objectContaining({
                kind: 'custom',
                name: platformMigrations[0]?.id,
                schemaQualifiedName: expect.stringContaining(
                    `platform_migration.${platformMigrations[0]?.scope.kind}.${platformMigrations[0]?.scope.key}`
                )
            })
        )
    })

    it('exports deterministic definition artifacts for registered system app manifests', () => {
        const artifacts = exportRegisteredSystemAppManifestDefinitions()

        expect(artifacts).toHaveLength(registeredSystemAppDefinitions.length)
        expect(artifacts[0]).toEqual(
            expect.objectContaining({
                kind: 'custom',
                name: registeredSystemAppDefinitions[0]?.key,
                schemaQualifiedName: `system_app_manifest.${registeredSystemAppDefinitions[0]?.key}`
            })
        )
        const payload = JSON.parse(artifacts[0]!.sql) as {
            migrationRefs: unknown[]
            currentSystemTableCapabilities: Record<string, boolean>
            targetSystemTableCapabilities: Record<string, boolean>
            currentBusinessTables: Array<{ tableName: string }>
            targetBusinessTables: Array<{ tableName: string }>
        }
        expect(Array.isArray(payload.migrationRefs)).toBe(true)
        expect(payload.migrationRefs.length).toBeGreaterThan(0)
        expect(payload.currentSystemTableCapabilities).toEqual({
            includeAttributes: false,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
        expect(payload.targetSystemTableCapabilities).toEqual({
            includeAttributes: false,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
        expect(payload.currentBusinessTables).toEqual([])
        expect(payload.targetBusinessTables).toEqual([])
    })

    it('exports deterministic target schema generation plans for registered system apps', () => {
        const plans = exportRegisteredTargetSystemAppSchemaGenerationPlans()

        expect(plans).toHaveLength(registeredSystemAppDefinitions.length)
        expect(plans.map((plan) => plan.definitionKey)).toEqual(['public', 'admin', 'profiles', 'metahubs', 'applications'])
    })

    it('exports deterministic definition artifacts for registered system app schema plans', () => {
        const artifacts = exportRegisteredSystemAppSchemaPlanDefinitions()

        expect(artifacts).toHaveLength(registeredSystemAppDefinitions.length)
        expect(artifacts[0]).toEqual(
            expect.objectContaining({
                kind: 'custom',
                name: registeredSystemAppDefinitions[0]?.key,
                schemaQualifiedName: `system_app_schema_plan.target.${registeredSystemAppDefinitions[0]?.key}`
            })
        )
    })

    it('exports deterministic definition artifacts for registered compiled system app artifacts', () => {
        const artifacts = exportRegisteredSystemAppCompiledDefinitions()

        expect(artifacts.length).toBeGreaterThan(registeredSystemAppDefinitions.length)
        expect(artifacts[0]).toEqual(
            expect.objectContaining({
                kind: 'custom',
                name: registeredSystemAppDefinitions[0]?.key,
                schemaQualifiedName: `system_app_compiled.schema.target.${registeredSystemAppDefinitions[0]?.key}.public`
            })
        )
    })

    it('exports the canonical registered definition bundle contract', () => {
        const bundle = exportRegisteredPlatformDefinitionBundle()

        expect(bundle.kind).toBe('definition_bundle')
        expect(bundle.bundleVersion).toBe(1)
        expect(bundle.checksumFamily).toBe('sha256')
        expect(bundle.artifacts).toHaveLength(platformMigrations.length)
    })

    it('exports the canonical registered system app manifest bundle contract', () => {
        const bundle = exportRegisteredSystemAppManifestDefinitionBundle()

        expect(bundle.kind).toBe('definition_bundle')
        expect(bundle.bundleVersion).toBe(1)
        expect(bundle.checksumFamily).toBe('sha256')
        expect(bundle.artifacts).toHaveLength(registeredSystemAppDefinitions.length)
    })

    it('exports the canonical registered system app schema plan bundle contract', () => {
        const bundle = exportRegisteredSystemAppSchemaPlanDefinitionBundle()

        expect(bundle.kind).toBe('definition_bundle')
        expect(bundle.bundleVersion).toBe(1)
        expect(bundle.checksumFamily).toBe('sha256')
        expect(bundle.artifacts).toHaveLength(registeredSystemAppDefinitions.length)
    })

    it('exports the canonical registered compiled system app artifact bundle contract', () => {
        const bundle = exportRegisteredSystemAppCompiledDefinitionBundle()

        expect(bundle.kind).toBe('definition_bundle')
        expect(bundle.bundleVersion).toBe(1)
        expect(bundle.checksumFamily).toBe('sha256')
        expect(bundle.artifacts).toHaveLength(exportRegisteredSystemAppCompiledDefinitions().length)
    })

    it('records catalog exports idempotently for repeated targets', async () => {
        const artifacts = exportRegisteredPlatformDefinitions().slice(0, 2)
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest.spyOn(catalog, 'exportDefinitions').mockResolvedValue(artifacts)
        const getDefinitionByLogicalKeyMock = jest
            .spyOn(catalog, 'getDefinitionByLogicalKey')
            .mockImplementation(async (_knex, logicalKey) => ({
                id: `registry:${logicalKey}`,
                logicalKey,
                kind: 'custom',
                activeRevisionId: `revision:${logicalKey}`,
                sourceKind: 'file',
                meta: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }))
        const getActiveRevisionMock = jest.spyOn(catalog, 'getActiveRevision').mockImplementation(async (_knex, registryId) => ({
            id: `active:${registryId}`,
            registryId,
            revisionStatus: 'published',
            checksum: registryId,
            payload: artifacts[0]!,
            provenance: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }))
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-1',
            registryId: 'reg-1',
            revisionId: 'rev-1',
            exportTarget: 'stdout',
            fileChecksum: 'checksum-1',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
        const recordExportMock = jest.spyOn(catalog, 'recordDefinitionExport')

        await exportCatalogPlatformDefinitions({} as never, 'stdout')
        await exportCatalogPlatformDefinitions({} as never, 'stdout')

        expect(ensureExportMock).toHaveBeenCalledTimes(artifacts.length * 2)
        expect(recordExportMock).not.toHaveBeenCalled()

        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
        getDefinitionByLogicalKeyMock.mockRestore()
        getActiveRevisionMock.mockRestore()
        ensureExportMock.mockRestore()
        recordExportMock.mockRestore()
    })

    it('diffs registered definitions against the catalog export', async () => {
        const desiredArtifacts = exportRegisteredPlatformDefinitions()
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest
            .spyOn(catalog, 'exportDefinitions')
            .mockResolvedValue([{ ...desiredArtifacts[0], checksum: 'changed' }, desiredArtifacts[1]])

        const result = await diffRegisteredPlatformDefinitions({} as never)

        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[0]?.schemaQualifiedName}::${desiredArtifacts[0]?.kind}`,
                status: 'checksum_mismatch'
            })
        )
        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[1]?.schemaQualifiedName}::${desiredArtifacts[1]?.kind}`,
                status: 'match'
            })
        )
        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
    })

    it('lints registered definitions and reports deterministic ordering', () => {
        const lint = lintRegisteredPlatformDefinitions()

        expect(lint.ok).toBe(true)
        expect(lint.issues).toEqual([])
        expect(lint.orderedKeys.length).toBe(platformMigrations.length)
    })

    it('lints registered system app manifests and reports deterministic ordering', () => {
        const lint = lintRegisteredSystemAppManifestDefinitions()

        expect(lint.ok).toBe(true)
        expect(lint.issues).toEqual([])
        expect(lint.orderedKeys.length).toBe(registeredSystemAppDefinitions.length)
    })

    it('lints registered system app schema plans and reports deterministic ordering', () => {
        const lint = lintRegisteredSystemAppSchemaPlanDefinitions()

        expect(lint.ok).toBe(true)
        expect(lint.issues).toEqual([])
        expect(lint.orderedKeys.length).toBe(registeredSystemAppDefinitions.length)
    })

    it('lints registered compiled system app artifacts and reports deterministic ordering', () => {
        const lint = lintRegisteredSystemAppCompiledDefinitions()

        expect(lint.ok).toBe(true)
        expect(lint.issues).toEqual([])
        expect(lint.orderedKeys.length).toBe(exportRegisteredSystemAppCompiledDefinitions().length)
    })

    it('synchronizes registered platform definitions into the catalog registry', async () => {
        const artifacts = exportRegisteredPlatformDefinitions()
        const manifestArtifacts = exportRegisteredSystemAppManifestDefinitions()
        const schemaPlanArtifacts = exportRegisteredSystemAppSchemaPlanDefinitions()
        const compiledArtifacts = exportRegisteredSystemAppCompiledDefinitions()
        const knex = createStructureAwareKnex({
            catalogRows: [
                ...createCatalogStateRows([artifacts[0]!], 'registered_platform_definitions'),
                ...createCatalogStateRows([manifestArtifacts[0]!], 'registered_system_app_manifest_definitions'),
                ...createCatalogStateRows([schemaPlanArtifacts[0]!], 'registered_system_app_schema_plan_definitions'),
                ...createCatalogStateRows([compiledArtifacts[0]!], 'registered_system_app_compiled_definitions')
            ]
        })
        const importDefinitionsMock = jest.spyOn(catalog, 'importDefinitions').mockResolvedValue({
            created: 2,
            updated: 1,
            unchanged: 3
        })
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-1',
            registryId: 'reg-1',
            revisionId: 'rev-1',
            exportTarget: 'jest-sync',
            fileChecksum: 'checksum-1',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        const result = await syncRegisteredPlatformDefinitionsToCatalog(knex, {
            source: 'jest',
            syncCommand: 'jest-sync'
        })

        expect(result.created).toBe(8)
        expect(result.updated).toBe(4)
        expect(result.unchanged).toBe(12)
        expect(result.lint).toEqual(expect.objectContaining({ ok: true }))
        expect(result.legacyFixedSchemaTables).toEqual({
            ok: true,
            leftovers: [],
            issues: []
        })
        expect(result.systemAppStructureMetadataInspection).toEqual(expect.objectContaining({ ok: true }))
        expect(result.systemAppDefinitionsValidation).toEqual(expect.objectContaining({ ok: true }))
        expect(result.systemAppSchemaGenerationPlansValidation).toEqual(expect.objectContaining({ ok: true }))
        expect(result.systemAppManifestLint).toEqual(expect.objectContaining({ ok: true }))
        expect(result.systemAppSchemaPlanLint).toEqual(expect.objectContaining({ ok: true }))
        expect(result.systemAppCompiledLint).toEqual(expect.objectContaining({ ok: true }))
        expect(importDefinitionsMock).toHaveBeenCalledTimes(4)
        expect(ensureExportMock).toHaveBeenCalledTimes(4)
        importDefinitionsMock.mockRestore()
        ensureExportMock.mockRestore()
    })

    it('records exports for every synchronized artifact using the bulk catalog-state lookup', async () => {
        const artifacts = exportRegisteredPlatformDefinitions()
        const manifestArtifacts = exportRegisteredSystemAppManifestDefinitions()
        const schemaPlanArtifacts = exportRegisteredSystemAppSchemaPlanDefinitions()
        const compiledArtifacts = exportRegisteredSystemAppCompiledDefinitions()
        const knex = createStructureAwareKnex({
            catalogRows: [
                ...createCatalogStateRows(artifacts, 'registered_platform_definitions', { includeExport: false }),
                ...createCatalogStateRows(manifestArtifacts, 'registered_system_app_manifest_definitions', { includeExport: false }),
                ...createCatalogStateRows(schemaPlanArtifacts, 'registered_system_app_schema_plan_definitions', { includeExport: false }),
                ...createCatalogStateRows(compiledArtifacts, 'registered_system_app_compiled_definitions', { includeExport: false })
            ]
        })
        const importDefinitionsMock = jest.spyOn(catalog, 'importDefinitions').mockResolvedValue({
            created: 0,
            updated: 0,
            unchanged: artifacts.length
        })
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-1',
            registryId: 'reg-1',
            revisionId: 'rev-1',
            exportTarget: 'jest-sync',
            fileChecksum: 'checksum-1',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        await syncRegisteredPlatformDefinitionsToCatalog(knex, {
            source: 'jest',
            syncCommand: 'jest-sync'
        })

        expect(ensureExportMock).toHaveBeenCalledTimes(
            artifacts.length + manifestArtifacts.length + schemaPlanArtifacts.length + compiledArtifacts.length
        )

        importDefinitionsMock.mockRestore()
        ensureExportMock.mockRestore()
    })

    it('skips repeated catalog sync when every artifact checksum and export row already matches the registry state', async () => {
        const artifacts = exportRegisteredPlatformDefinitions()
        const manifestArtifacts = exportRegisteredSystemAppManifestDefinitions()
        const schemaPlanArtifacts = exportRegisteredSystemAppSchemaPlanDefinitions()
        const compiledArtifacts = exportRegisteredSystemAppCompiledDefinitions()
        const knex = createStructureAwareKnex({
            catalogRows: [
                ...createCatalogStateRows(artifacts, 'registered_platform_definitions'),
                ...createCatalogStateRows(manifestArtifacts, 'registered_system_app_manifest_definitions'),
                ...createCatalogStateRows(schemaPlanArtifacts, 'registered_system_app_schema_plan_definitions'),
                ...createCatalogStateRows(compiledArtifacts, 'registered_system_app_compiled_definitions')
            ]
        })
        const importDefinitionsMock = jest.spyOn(catalog, 'importDefinitions')
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded')

        const result = await syncRegisteredPlatformDefinitionsToCatalog(knex, {
            source: 'jest',
            syncCommand: 'jest-sync'
        })

        expect(result.created).toBe(0)
        expect(result.updated).toBe(0)
        expect(result.unchanged).toBe(artifacts.length + manifestArtifacts.length + schemaPlanArtifacts.length + compiledArtifacts.length)
        expect(importDefinitionsMock).not.toHaveBeenCalled()
        expect(ensureExportMock).not.toHaveBeenCalled()

        importDefinitionsMock.mockRestore()
        ensureExportMock.mockRestore()
    })

    it('re-synchronizes artifacts whose stored payload dependencies drift even when the SQL checksum still matches', async () => {
        const artifacts = exportRegisteredPlatformDefinitions()
        const manifestArtifacts = exportRegisteredSystemAppManifestDefinitions()
        const schemaPlanArtifacts = exportRegisteredSystemAppSchemaPlanDefinitions()
        const compiledArtifacts = exportRegisteredSystemAppCompiledDefinitions()
        const driftedPlatformArtifact = {
            ...artifacts[0]!,
            dependencies: ['platform_migration.platform_schema.admin.PrepareAdminSchemaSupport1733400000000::custom']
        }
        const knex = createStructureAwareKnex({
            catalogRows: [
                ...createCatalogStateRows(artifacts, 'registered_platform_definitions', {
                    activePayloadArtifacts: [driftedPlatformArtifact, ...artifacts.slice(1)]
                }),
                ...createCatalogStateRows(manifestArtifacts, 'registered_system_app_manifest_definitions'),
                ...createCatalogStateRows(schemaPlanArtifacts, 'registered_system_app_schema_plan_definitions'),
                ...createCatalogStateRows(compiledArtifacts, 'registered_system_app_compiled_definitions')
            ]
        })
        const importDefinitionsMock = jest.spyOn(catalog, 'importDefinitions').mockResolvedValue({
            created: 0,
            updated: 1,
            unchanged: 0
        })
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-drift-fix',
            registryId: 'reg-drift-fix',
            revisionId: 'rev-drift-fix',
            exportTarget: 'jest-sync',
            fileChecksum: 'checksum-drift-fix',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        await syncRegisteredPlatformDefinitionsToCatalog(knex, {
            source: 'jest',
            syncCommand: 'jest-sync'
        })

        expect(importDefinitionsMock).toHaveBeenCalledTimes(1)

        importDefinitionsMock.mockRestore()
        ensureExportMock.mockRestore()
    })

    it('re-synchronizes artifacts whose active revision is missing published lifecycle provenance', async () => {
        const artifacts = exportRegisteredPlatformDefinitions()
        const manifestArtifacts = exportRegisteredSystemAppManifestDefinitions()
        const schemaPlanArtifacts = exportRegisteredSystemAppSchemaPlanDefinitions()
        const compiledArtifacts = exportRegisteredSystemAppCompiledDefinitions()
        const knex = createStructureAwareKnex({
            catalogRows: [
                ...createCatalogStateRows(artifacts, 'registered_platform_definitions', { includePublishedLifecycle: false }),
                ...createCatalogStateRows(manifestArtifacts, 'registered_system_app_manifest_definitions', {
                    includePublishedLifecycle: false
                }),
                ...createCatalogStateRows(schemaPlanArtifacts, 'registered_system_app_schema_plan_definitions', {
                    includePublishedLifecycle: false
                }),
                ...createCatalogStateRows(compiledArtifacts, 'registered_system_app_compiled_definitions', {
                    includePublishedLifecycle: false
                })
            ]
        })
        const importDefinitionsMock = jest.spyOn(catalog, 'importDefinitions').mockResolvedValue({
            created: 0,
            updated: 0,
            unchanged: 0
        })
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-lifecycle-fix',
            registryId: 'reg-lifecycle-fix',
            revisionId: 'rev-lifecycle-fix',
            exportTarget: 'jest-sync',
            fileChecksum: 'checksum-lifecycle-fix',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        await syncRegisteredPlatformDefinitionsToCatalog(knex, {
            source: 'jest',
            syncCommand: 'jest-sync'
        })

        expect(importDefinitionsMock).toHaveBeenCalledTimes(4)
        importDefinitionsMock.mockRestore()
        ensureExportMock.mockRestore()
    })

    it('fails sync when legacy fixed schema tables still exist', async () => {
        const knex = createStructureAwareKnex({ legacyRows: [{ table_schema: 'admin', table_name: 'roles' }] })
        const importDefinitionsMock = jest.spyOn(catalog, 'importDefinitions')

        await expect(
            syncRegisteredPlatformDefinitionsToCatalog(knex, {
                source: 'jest',
                syncCommand: 'jest-sync'
            })
        ).rejects.toThrow('Legacy fixed schema tables remain after reconciliation: admin.roles must be reconciled to admin.cat_roles')

        expect(importDefinitionsMock).not.toHaveBeenCalled()
        importDefinitionsMock.mockRestore()
    })

    it('fails sync when fixed system app metadata is incomplete after bootstrap', async () => {
        const knex = createStructureAwareKnex({
            missingAttribute: {
                definitionKey: 'profiles',
                objectCodename: 'profiles',
                attributeCodename: 'nickname'
            }
        })
        const importDefinitionsMock = jest.spyOn(catalog, 'importDefinitions')

        await expect(
            syncRegisteredPlatformDefinitionsToCatalog(knex, {
                source: 'jest',
                syncCommand: 'jest-sync'
            })
        ).rejects.toThrow('Registered system app structure metadata inspection failed')

        expect(importDefinitionsMock).not.toHaveBeenCalled()
        importDefinitionsMock.mockRestore()
    })

    it('rejects imported bundles with checksum mismatches before catalog import', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'platform-import-'))
        const tempFile = join(tempDir, 'definitions.json')
        const artifact = exportRegisteredPlatformDefinitions()[0]
        const importDefinitionsMock = jest.spyOn(catalog, 'importDefinitions')

        await writeFile(
            tempFile,
            JSON.stringify([
                {
                    ...artifact,
                    checksum: 'broken-checksum'
                }
            ]),
            'utf8'
        )

        await expect(importPlatformDefinitionsFromFile({} as never, tempFile)).rejects.toThrow('checksum mismatch')
        expect(importDefinitionsMock).not.toHaveBeenCalled()

        importDefinitionsMock.mockRestore()
        await rm(tempDir, { recursive: true, force: true })
    })

    it('imports canonical bundle objects from disk', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'platform-import-bundle-'))
        const tempFile = join(tempDir, 'definitions.json')
        const bundle = exportRegisteredPlatformDefinitionBundle()
        const importDefinitionBundleMock = jest.spyOn(catalog, 'importDefinitionBundle').mockResolvedValue({
            created: bundle.artifacts.length,
            updated: 0,
            unchanged: 0
        })

        await writeFile(tempFile, JSON.stringify(bundle), 'utf8')

        const result = await importPlatformDefinitionsFromFile({} as never, tempFile, {
            source: 'jest-bundle-import'
        })

        expect(result.created).toBe(bundle.artifacts.length)
        expect(importDefinitionBundleMock).toHaveBeenCalledTimes(1)
        expect(importDefinitionBundleMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                meta: expect.objectContaining({
                    definitionFamily: 'registered_platform_definitions'
                })
            }),
            expect.objectContaining({
                meta: expect.objectContaining({
                    definitionFamily: 'registered_platform_definitions'
                })
            })
        )

        importDefinitionBundleMock.mockRestore()
        await rm(tempDir, { recursive: true, force: true })
    })

    it('imports canonical system app manifest bundle objects from disk', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'system-app-manifest-import-bundle-'))
        const tempFile = join(tempDir, 'definitions.json')
        const bundle = exportRegisteredSystemAppManifestDefinitionBundle()
        const importDefinitionBundleMock = jest.spyOn(catalog, 'importDefinitionBundle').mockResolvedValue({
            created: bundle.artifacts.length,
            updated: 0,
            unchanged: 0
        })

        await writeFile(tempFile, JSON.stringify(bundle), 'utf8')

        const result = await importPlatformDefinitionsFromFile({} as never, tempFile, {
            source: 'jest-manifest-bundle-import'
        })

        expect(result.created).toBe(bundle.artifacts.length)
        expect(importDefinitionBundleMock).toHaveBeenCalledTimes(1)
        expect(importDefinitionBundleMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                meta: expect.objectContaining({
                    definitionFamily: 'registered_system_app_manifest_definitions'
                })
            }),
            expect.objectContaining({
                meta: expect.objectContaining({
                    definitionFamily: 'registered_system_app_manifest_definitions'
                })
            })
        )

        importDefinitionBundleMock.mockRestore()
        await rm(tempDir, { recursive: true, force: true })
    })

    it('imports canonical system app schema plan bundle objects from disk', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'system-app-schema-plan-import-bundle-'))
        const tempFile = join(tempDir, 'definitions.json')
        const bundle = exportRegisteredSystemAppSchemaPlanDefinitionBundle()
        const importDefinitionBundleMock = jest.spyOn(catalog, 'importDefinitionBundle').mockResolvedValue({
            created: bundle.artifacts.length,
            updated: 0,
            unchanged: 0
        })

        await writeFile(tempFile, JSON.stringify(bundle), 'utf8')

        const result = await importPlatformDefinitionsFromFile({} as never, tempFile, {
            source: 'jest-schema-plan-bundle-import'
        })

        expect(result.created).toBe(bundle.artifacts.length)
        expect(importDefinitionBundleMock).toHaveBeenCalledTimes(1)
        expect(importDefinitionBundleMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                meta: expect.objectContaining({
                    definitionFamily: 'registered_system_app_schema_plan_definitions'
                })
            }),
            expect.objectContaining({
                meta: expect.objectContaining({
                    definitionFamily: 'registered_system_app_schema_plan_definitions'
                })
            })
        )

        importDefinitionBundleMock.mockRestore()
        await rm(tempDir, { recursive: true, force: true })
    })

    it('imports canonical compiled system app artifact bundle objects from disk', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'system-app-compiled-import-bundle-'))
        const tempFile = join(tempDir, 'definitions.json')
        const bundle = exportRegisteredSystemAppCompiledDefinitionBundle()
        const importDefinitionBundleMock = jest.spyOn(catalog, 'importDefinitionBundle').mockResolvedValue({
            created: bundle.artifacts.length,
            updated: 0,
            unchanged: 0
        })

        await writeFile(tempFile, JSON.stringify(bundle), 'utf8')

        const result = await importPlatformDefinitionsFromFile({} as never, tempFile, {
            source: 'jest-compiled-bundle-import'
        })

        expect(result.created).toBe(bundle.artifacts.length)
        expect(importDefinitionBundleMock).toHaveBeenCalledTimes(1)
        expect(importDefinitionBundleMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                meta: expect.objectContaining({
                    definitionFamily: 'registered_system_app_compiled_definitions'
                })
            }),
            expect.objectContaining({
                meta: expect.objectContaining({
                    definitionFamily: 'registered_system_app_compiled_definitions'
                })
            })
        )

        importDefinitionBundleMock.mockRestore()
        await rm(tempDir, { recursive: true, force: true })
    })

    it('rejects imported bundles whose declared definitionFamily mismatches artifact namespace', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'platform-import-mismatched-family-'))
        const tempFile = join(tempDir, 'definitions.json')
        const bundle = {
            ...exportRegisteredSystemAppManifestDefinitionBundle(),
            meta: {
                definitionFamily: 'registered_platform_definitions'
            }
        }

        await writeFile(tempFile, JSON.stringify(bundle), 'utf8')

        await expect(importPlatformDefinitionsFromFile({} as never, tempFile)).rejects.toThrow(
            'Imported definition bundle definitionFamily mismatch'
        )

        await rm(tempDir, { recursive: true, force: true })
    })

    it('exports catalog definitions through the canonical bundle contract', async () => {
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportBundleMock = jest.spyOn(catalog, 'exportDefinitionBundle').mockResolvedValue(exportRegisteredPlatformDefinitionBundle())
        const getDefinitionByLogicalKeyMock = jest
            .spyOn(catalog, 'getDefinitionByLogicalKey')
            .mockImplementation(async (_knex, logicalKey) => ({
                id: `registry:${logicalKey}`,
                logicalKey,
                kind: 'custom',
                activeRevisionId: `revision:${logicalKey}`,
                sourceKind: 'file',
                meta: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }))
        const getActiveRevisionMock = jest.spyOn(catalog, 'getActiveRevision').mockImplementation(async (_knex, registryId) => ({
            id: `active:${registryId}`,
            registryId,
            revisionStatus: 'published',
            checksum: registryId,
            payload: exportRegisteredPlatformDefinitions()[0]!,
            provenance: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }))
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-bundle',
            registryId: 'reg-bundle',
            revisionId: 'rev-bundle',
            exportTarget: 'stdout',
            fileChecksum: 'checksum-bundle',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        const bundle = await exportCatalogPlatformDefinitionBundle({} as never, 'stdout')

        expect(bundle.kind).toBe('definition_bundle')
        expect(exportBundleMock).toHaveBeenCalledTimes(1)
        expect(ensureExportMock).toHaveBeenCalledTimes(bundle.artifacts.length)

        storageReadyMock.mockRestore()
        exportBundleMock.mockRestore()
        getDefinitionByLogicalKeyMock.mockRestore()
        getActiveRevisionMock.mockRestore()
        ensureExportMock.mockRestore()
    })

    it('exports catalog system app manifests through the canonical bundle contract', async () => {
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportBundleMock = jest
            .spyOn(catalog, 'exportDefinitionBundle')
            .mockResolvedValue(exportRegisteredSystemAppManifestDefinitionBundle())
        const getDefinitionByLogicalKeyMock = jest
            .spyOn(catalog, 'getDefinitionByLogicalKey')
            .mockImplementation(async (_knex, logicalKey) => ({
                id: `registry:${logicalKey}`,
                logicalKey,
                kind: 'custom',
                activeRevisionId: `revision:${logicalKey}`,
                sourceKind: 'file',
                meta: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }))
        const getActiveRevisionMock = jest.spyOn(catalog, 'getActiveRevision').mockImplementation(async (_knex, registryId) => ({
            id: `active:${registryId}`,
            registryId,
            revisionStatus: 'published',
            checksum: registryId,
            payload: exportRegisteredSystemAppManifestDefinitions()[0]!,
            provenance: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }))
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-manifest-bundle',
            registryId: 'reg-manifest-bundle',
            revisionId: 'rev-manifest-bundle',
            exportTarget: 'stdout',
            fileChecksum: 'checksum-manifest-bundle',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        const bundle = await exportCatalogSystemAppManifestDefinitionBundle({} as never, 'stdout')

        expect(bundle.kind).toBe('definition_bundle')
        expect(exportBundleMock).toHaveBeenCalledTimes(1)
        expect(ensureExportMock).toHaveBeenCalledTimes(bundle.artifacts.length)

        storageReadyMock.mockRestore()
        exportBundleMock.mockRestore()
        getDefinitionByLogicalKeyMock.mockRestore()
        getActiveRevisionMock.mockRestore()
        ensureExportMock.mockRestore()
    })

    it('exports catalog system app schema plans through the canonical bundle contract', async () => {
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportBundleMock = jest
            .spyOn(catalog, 'exportDefinitionBundle')
            .mockResolvedValue(exportRegisteredSystemAppSchemaPlanDefinitionBundle())
        const getDefinitionByLogicalKeyMock = jest
            .spyOn(catalog, 'getDefinitionByLogicalKey')
            .mockImplementation(async (_knex, logicalKey) => ({
                id: `registry:${logicalKey}`,
                logicalKey,
                kind: 'custom',
                activeRevisionId: `revision:${logicalKey}`,
                sourceKind: 'file',
                meta: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }))
        const getActiveRevisionMock = jest.spyOn(catalog, 'getActiveRevision').mockImplementation(async (_knex, registryId) => ({
            id: `active:${registryId}`,
            registryId,
            revisionStatus: 'published',
            checksum: registryId,
            payload: exportRegisteredSystemAppSchemaPlanDefinitions()[0]!,
            provenance: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }))
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-schema-plan-bundle',
            registryId: 'reg-schema-plan-bundle',
            revisionId: 'rev-schema-plan-bundle',
            exportTarget: 'stdout',
            fileChecksum: 'checksum-schema-plan-bundle',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        const bundle = await exportCatalogSystemAppSchemaPlanDefinitionBundle({} as never, 'stdout')

        expect(bundle.kind).toBe('definition_bundle')
        expect(exportBundleMock).toHaveBeenCalledTimes(1)
        expect(ensureExportMock).toHaveBeenCalledTimes(bundle.artifacts.length)

        storageReadyMock.mockRestore()
        exportBundleMock.mockRestore()
        getDefinitionByLogicalKeyMock.mockRestore()
        getActiveRevisionMock.mockRestore()
        ensureExportMock.mockRestore()
    })

    it('exports catalog compiled system app artifacts through the canonical bundle contract', async () => {
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportBundleMock = jest
            .spyOn(catalog, 'exportDefinitionBundle')
            .mockResolvedValue(exportRegisteredSystemAppCompiledDefinitionBundle())
        const getDefinitionByLogicalKeyMock = jest
            .spyOn(catalog, 'getDefinitionByLogicalKey')
            .mockImplementation(async (_knex, logicalKey) => ({
                id: `registry:${logicalKey}`,
                logicalKey,
                kind: 'custom',
                activeRevisionId: `revision:${logicalKey}`,
                sourceKind: 'file',
                meta: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }))
        const getActiveRevisionMock = jest.spyOn(catalog, 'getActiveRevision').mockImplementation(async (_knex, registryId) => ({
            id: `active:${registryId}`,
            registryId,
            revisionStatus: 'published',
            checksum: registryId,
            payload: exportRegisteredSystemAppCompiledDefinitions()[0]!,
            provenance: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }))
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-compiled-bundle',
            registryId: 'reg-compiled-bundle',
            revisionId: 'rev-compiled-bundle',
            exportTarget: 'stdout',
            fileChecksum: 'checksum-compiled-bundle',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        const bundle = await exportCatalogSystemAppCompiledDefinitionBundle({} as never, 'stdout')

        expect(bundle.kind).toBe('definition_bundle')
        expect(exportBundleMock).toHaveBeenCalledTimes(1)
        expect(ensureExportMock).toHaveBeenCalledTimes(bundle.artifacts.length)

        storageReadyMock.mockRestore()
        exportBundleMock.mockRestore()
        getDefinitionByLogicalKeyMock.mockRestore()
        getActiveRevisionMock.mockRestore()
        ensureExportMock.mockRestore()
    })

    it('diffs registered system app manifests against the catalog export', async () => {
        const desiredArtifacts = exportRegisteredSystemAppManifestDefinitions()
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest
            .spyOn(catalog, 'exportDefinitions')
            .mockResolvedValue([{ ...desiredArtifacts[0], checksum: 'changed' }, desiredArtifacts[1]])

        const result = await diffRegisteredSystemAppManifestDefinitions({} as never)

        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[0]?.schemaQualifiedName}::${desiredArtifacts[0]?.kind}`,
                status: 'checksum_mismatch'
            })
        )
        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[1]?.schemaQualifiedName}::${desiredArtifacts[1]?.kind}`,
                status: 'match'
            })
        )
        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
    })

    it('diffs registered system app schema plans against the catalog export', async () => {
        const desiredArtifacts = exportRegisteredSystemAppSchemaPlanDefinitions()
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest
            .spyOn(catalog, 'exportDefinitions')
            .mockResolvedValue([{ ...desiredArtifacts[0], checksum: 'changed' }, desiredArtifacts[1]])

        const result = await diffRegisteredSystemAppSchemaPlanDefinitions({} as never)

        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[0]?.schemaQualifiedName}::${desiredArtifacts[0]?.kind}`,
                status: 'checksum_mismatch'
            })
        )
        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[1]?.schemaQualifiedName}::${desiredArtifacts[1]?.kind}`,
                status: 'match'
            })
        )
        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
    })

    it('diffs registered compiled system app artifacts against the catalog export', async () => {
        const desiredArtifacts = exportRegisteredSystemAppCompiledDefinitions()
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest
            .spyOn(catalog, 'exportDefinitions')
            .mockResolvedValue([{ ...desiredArtifacts[0], checksum: 'changed' }, desiredArtifacts[1]])

        const result = await diffRegisteredSystemAppCompiledDefinitions({} as never)

        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[0]?.schemaQualifiedName}::${desiredArtifacts[0]?.kind}`,
                status: 'checksum_mismatch'
            })
        )
        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[1]?.schemaQualifiedName}::${desiredArtifacts[1]?.kind}`,
                status: 'match'
            })
        )
        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
    })

    it('records catalog exports idempotently for repeated compiled system app artifact targets', async () => {
        const artifacts = exportRegisteredSystemAppCompiledDefinitions().slice(0, 2)
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest.spyOn(catalog, 'exportDefinitions').mockResolvedValue(artifacts)
        const getDefinitionByLogicalKeyMock = jest
            .spyOn(catalog, 'getDefinitionByLogicalKey')
            .mockImplementation(async (_knex, logicalKey) => ({
                id: `registry:${logicalKey}`,
                logicalKey,
                kind: 'custom',
                activeRevisionId: `revision:${logicalKey}`,
                sourceKind: 'file',
                meta: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }))
        const getActiveRevisionMock = jest.spyOn(catalog, 'getActiveRevision').mockImplementation(async (_knex, registryId) => ({
            id: `active:${registryId}`,
            registryId,
            revisionStatus: 'published',
            checksum: registryId,
            payload: artifacts[0]!,
            provenance: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }))
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-1',
            registryId: 'reg-1',
            revisionId: 'rev-1',
            exportTarget: 'stdout',
            fileChecksum: 'checksum-1',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
        const recordExportMock = jest.spyOn(catalog, 'recordDefinitionExport')

        await exportCatalogSystemAppCompiledDefinitions({} as never, 'stdout')
        await exportCatalogSystemAppCompiledDefinitions({} as never, 'stdout')

        expect(ensureExportMock).toHaveBeenCalledTimes(artifacts.length * 2)
        expect(recordExportMock).not.toHaveBeenCalled()

        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
        getDefinitionByLogicalKeyMock.mockRestore()
        getActiveRevisionMock.mockRestore()
        ensureExportMock.mockRestore()
        recordExportMock.mockRestore()
    })

    it('records catalog exports idempotently for repeated system app manifest targets', async () => {
        const artifacts = exportRegisteredSystemAppManifestDefinitions().slice(0, 2)
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest.spyOn(catalog, 'exportDefinitions').mockResolvedValue(artifacts)
        const getDefinitionByLogicalKeyMock = jest
            .spyOn(catalog, 'getDefinitionByLogicalKey')
            .mockImplementation(async (_knex, logicalKey) => ({
                id: `registry:${logicalKey}`,
                logicalKey,
                kind: 'custom',
                activeRevisionId: `revision:${logicalKey}`,
                sourceKind: 'file',
                meta: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }))
        const getActiveRevisionMock = jest.spyOn(catalog, 'getActiveRevision').mockImplementation(async (_knex, registryId) => ({
            id: `active:${registryId}`,
            registryId,
            revisionStatus: 'published',
            checksum: registryId,
            payload: artifacts[0]!,
            provenance: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }))
        const ensureExportMock = jest.spyOn(catalog, 'ensureDefinitionExportRecorded').mockResolvedValue({
            id: 'exp-1',
            registryId: 'reg-1',
            revisionId: 'rev-1',
            exportTarget: 'stdout',
            fileChecksum: 'checksum-1',
            meta: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
        const recordExportMock = jest.spyOn(catalog, 'recordDefinitionExport')

        await exportCatalogSystemAppManifestDefinitions({} as never, 'stdout')
        await exportCatalogSystemAppManifestDefinitions({} as never, 'stdout')

        expect(ensureExportMock).toHaveBeenCalledTimes(artifacts.length * 2)
        expect(recordExportMock).not.toHaveBeenCalled()

        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
        getDefinitionByLogicalKeyMock.mockRestore()
        getActiveRevisionMock.mockRestore()
        ensureExportMock.mockRestore()
        recordExportMock.mockRestore()
    })

    it('rejects imported bundles outside supported definition namespaces', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'platform-import-'))
        const tempFile = join(tempDir, 'definitions.json')
        const artifact = exportRegisteredPlatformDefinitions()[0]
        const importDefinitionsMock = jest.spyOn(catalog, 'importDefinitions')

        await writeFile(
            tempFile,
            JSON.stringify([
                {
                    ...artifact,
                    schemaQualifiedName: 'public.not_allowed'
                }
            ]),
            'utf8'
        )

        await expect(importPlatformDefinitionsFromFile({} as never, tempFile)).rejects.toThrow(
            'platform_migration, system_app_manifest, system_app_schema_plan, or system_app_compiled namespace'
        )
        expect(importDefinitionsMock).not.toHaveBeenCalled()

        importDefinitionsMock.mockRestore()
        await rm(tempDir, { recursive: true, force: true })
    })

    it('combines validation, lint, and diff in doctor output', async () => {
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest.spyOn(catalog, 'exportDefinitions').mockResolvedValue([])
        const getDefinitionByLogicalKeyMock = jest.spyOn(catalog, 'getDefinitionByLogicalKey').mockResolvedValue(null)
        const listExportsMock = jest.spyOn(catalog, 'listDefinitionExports').mockResolvedValue([])
        const getActiveRevisionMock = jest.spyOn(catalog, 'getActiveRevision').mockResolvedValue(null)
        const qb: Record<string, jest.Mock> = {
            where: jest.fn(() => qb),
            orderBy: jest.fn(() => qb),
            first: jest.fn(async () => undefined)
        }
        const structureAwareKnex = createStructureAwareKnex()
        const knex = Object.assign(
            jest.fn(() => qb),
            {
                raw: (structureAwareKnex as unknown as { raw: jest.Mock }).raw
            }
        )

        const doctor = await doctorRegisteredPlatformState(knex as never)

        expect(doctor.systemAppDefinitionsValidation.ok).toBe(true)
        expect(doctor.systemAppSchemaGenerationPlansValidation.ok).toBe(true)
        expect(doctor.legacyFixedSchemaTables).toEqual({
            ok: true,
            leftovers: [],
            issues: []
        })
        expect(doctor.systemAppStructureMetadataInspection).toEqual(expect.objectContaining({ ok: true }))
        expect(doctor.migrationsValidation.ok).toBe(true)
        expect(doctor.definitionsLint.ok).toBe(true)
        expect(doctor.systemAppManifestLint.ok).toBe(true)
        expect(doctor.systemAppSchemaPlanLint.ok).toBe(true)
        expect(doctor.systemAppCompiledLint.ok).toBe(true)
        expect(Array.isArray(doctor.definitionsDiff)).toBe(true)
        expect(Array.isArray(doctor.systemAppManifestDiff)).toBe(true)
        expect(Array.isArray(doctor.systemAppSchemaPlanDiff)).toBe(true)
        expect(Array.isArray(doctor.systemAppCompiledDiff)).toBe(true)
        expect(doctor.migrationPlan.dryRun).toBe(true)
        expect(doctor.catalogLifecycle.ok).toBe(false)
        expect(doctor.systemAppManifestCatalogLifecycle.ok).toBe(false)
        expect(doctor.systemAppSchemaPlanCatalogLifecycle.ok).toBe(false)
        expect(doctor.systemAppCompiledCatalogLifecycle.ok).toBe(false)
        expect(Array.isArray(doctor.catalogLifecycle.missingRegistryKeys)).toBe(true)
        expect(Array.isArray(doctor.catalogLifecycle.missingPublishedLifecycleKeys)).toBe(true)
        expect(Array.isArray(doctor.systemAppManifestCatalogLifecycle.missingRegistryKeys)).toBe(true)
        expect(Array.isArray(doctor.systemAppManifestCatalogLifecycle.missingPublishedLifecycleKeys)).toBe(true)
        expect(Array.isArray(doctor.systemAppSchemaPlanCatalogLifecycle.missingRegistryKeys)).toBe(true)
        expect(Array.isArray(doctor.systemAppSchemaPlanCatalogLifecycle.missingPublishedLifecycleKeys)).toBe(true)
        expect(Array.isArray(doctor.systemAppCompiledCatalogLifecycle.missingRegistryKeys)).toBe(true)
        expect(Array.isArray(doctor.systemAppCompiledCatalogLifecycle.missingPublishedLifecycleKeys)).toBe(true)

        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
        getDefinitionByLogicalKeyMock.mockRestore()
        listExportsMock.mockRestore()
        getActiveRevisionMock.mockRestore()
    })

    it('treats any active-revision export record as healthy in doctor lifecycle checks', async () => {
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest.spyOn(catalog, 'exportDefinitions').mockResolvedValue([])
        const getDefinitionByLogicalKeyMock = jest
            .spyOn(catalog, 'getDefinitionByLogicalKey')
            .mockImplementation(async (_knex, logicalKey) => ({
                id: `registry:${logicalKey}`,
                logicalKey,
                kind: 'custom',
                activeRevisionId: `revision:${logicalKey}`,
                sourceKind: 'file',
                meta: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }))
        const getActiveRevisionMock = jest.spyOn(catalog, 'getActiveRevision').mockImplementation(async (_knex, registryId) => ({
            id: `active:${registryId}`,
            registryId,
            revisionStatus: 'published',
            checksum: registryId,
            payload: exportRegisteredPlatformDefinitions()[0]!,
            provenance: {
                reviewState: 'published',
                checksumFamily: 'sha256',
                sourceKind: 'file'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }))
        const listExportsMock = jest.spyOn(catalog, 'listDefinitionExports').mockResolvedValue([
            {
                id: 'exp-1',
                registryId: 'registry-1',
                revisionId: 'revision-1',
                exportTarget: 'migration sync',
                fileChecksum: 'checksum-1',
                meta: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ])
        const qb: Record<string, jest.Mock> = {
            where: jest.fn(() => qb),
            orderBy: jest.fn(() => qb),
            first: jest.fn(async () => undefined)
        }
        const structureAwareKnex = createStructureAwareKnex()
        const knex = Object.assign(
            jest.fn(() => qb),
            {
                raw: (structureAwareKnex as unknown as { raw: jest.Mock }).raw
            }
        )

        const doctor = await doctorRegisteredPlatformState(knex as never)

        expect(doctor.catalogLifecycle.ok).toBe(true)
        expect(doctor.systemAppManifestCatalogLifecycle.ok).toBe(true)
        expect(doctor.systemAppSchemaPlanCatalogLifecycle.ok).toBe(true)
        expect(doctor.systemAppCompiledCatalogLifecycle.ok).toBe(true)
        expect(doctor.catalogLifecycle.exportTarget).toBe('any-active-revision-export')
        expect(listExportsMock).toHaveBeenCalled()

        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
        getDefinitionByLogicalKeyMock.mockRestore()
        getActiveRevisionMock.mockRestore()
        listExportsMock.mockRestore()
    })
})
