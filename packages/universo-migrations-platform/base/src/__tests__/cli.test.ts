import {
    definitionDiffSummary,
    isDoctorResultHealthy,
    isSystemAppCompiledSource,
    isSystemAppManifestSource,
    isSystemAppSchemaPlanSource,
    parseArgs
} from '../cli'

describe('migration cli helpers', () => {
    it('parses system app manifest export source arguments', () => {
        const result = parseArgs(['export', '--source=registered-system-app-manifests', '--out=/tmp/system-app-manifests.json'])

        expect(result).toEqual({
            command: 'export',
            options: {
                outFile: '/tmp/system-app-manifests.json',
                inFile: null,
                source: 'registered-system-app-manifests',
                stage: 'target',
                keys: null
            }
        })
    })

    it('parses system app schema apply command with stage and keys', () => {
        const result = parseArgs(['system-app-schema-apply', '--stage=current', '--keys=profiles,metahubs'])

        expect(result).toEqual({
            command: 'system-app-schema-apply',
            options: {
                outFile: null,
                inFile: null,
                source: 'catalog-platform',
                stage: 'current',
                keys: ['profiles', 'metahubs']
            }
        })
    })

    it('parses system app schema plan command with stage and keys', () => {
        const result = parseArgs(['system-app-schema-plan', '--stage=target', '--keys=profiles,applications'])

        expect(result).toEqual({
            command: 'system-app-schema-plan',
            options: {
                outFile: null,
                inFile: null,
                source: 'catalog-platform',
                stage: 'target',
                keys: ['profiles', 'applications']
            }
        })
    })

    it('parses system app schema bootstrap command with stage and keys', () => {
        const result = parseArgs(['system-app-schema-bootstrap', '--stage=target', '--keys=profiles,admin'])

        expect(result).toEqual({
            command: 'system-app-schema-bootstrap',
            options: {
                outFile: null,
                inFile: null,
                source: 'catalog-platform',
                stage: 'target',
                keys: ['profiles', 'admin']
            }
        })
    })

    it('detects manifest-oriented sources', () => {
        expect(isSystemAppManifestSource('catalog-system-app-manifests')).toBe(true)
        expect(isSystemAppManifestSource('registered-system-app-manifests')).toBe(true)
        expect(isSystemAppManifestSource('catalog-platform')).toBe(false)
        expect(isSystemAppManifestSource('registered-platform')).toBe(false)
    })

    it('detects schema-plan-oriented sources', () => {
        expect(isSystemAppSchemaPlanSource('catalog-system-app-schema-plans')).toBe(true)
        expect(isSystemAppSchemaPlanSource('registered-system-app-schema-plans')).toBe(true)
        expect(isSystemAppSchemaPlanSource('catalog-system-app-manifests')).toBe(false)
        expect(isSystemAppSchemaPlanSource('catalog-platform')).toBe(false)
    })

    it('detects compiled-artifact-oriented sources', () => {
        expect(isSystemAppCompiledSource('catalog-system-app-compiled')).toBe(true)
        expect(isSystemAppCompiledSource('registered-system-app-compiled')).toBe(true)
        expect(isSystemAppCompiledSource('catalog-system-app-schema-plans')).toBe(false)
        expect(isSystemAppCompiledSource('catalog-platform')).toBe(false)
    })

    it('builds deterministic diff summaries', () => {
        const summary = definitionDiffSummary([
            { status: 'match' },
            { status: 'missing_in_catalog' },
            { status: 'checksum_mismatch' },
            { status: 'catalog_only' },
            { status: 'match' }
        ])

        expect(summary).toEqual({
            match: 2,
            missingInCatalog: 1,
            checksumMismatch: 1,
            catalogOnly: 1
        })
    })

    it('treats doctor results as unhealthy when manifest lifecycle or diff is broken', () => {
        expect(
            isDoctorResultHealthy({
                systemAppDefinitionsValidation: { ok: true, issues: [] },
                systemAppSchemaGenerationPlansValidation: { ok: true, issues: [], plans: [] },
                legacyFixedSchemaTables: { ok: true, leftovers: [], issues: [] },
                systemAppStructureMetadataInspection: { ok: true, issues: [], entries: [] },
                migrationsValidation: { ok: true, issues: [], orderedIds: [] },
                definitionsLint: { ok: true, issues: [], orderedKeys: [] },
                definitionsDiff: [],
                systemAppManifestLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppManifestDiff: [
                    {
                        logicalKey: 'system_app_manifest.metahubs::custom',
                        status: 'missing_in_catalog',
                        desiredChecksum: 'a',
                        actualChecksum: null
                    }
                ],
                systemAppSchemaPlanLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppSchemaPlanDiff: [],
                systemAppCompiledLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppCompiledDiff: [],
                migrationPlan: { dryRun: true, planned: [] },
                catalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppManifestCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppSchemaPlanCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppCompiledCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                }
            })
        ).toBe(false)
    })

    it('treats doctor results as unhealthy when registered system app definitions are invalid', () => {
        expect(
            isDoctorResultHealthy({
                systemAppDefinitionsValidation: {
                    ok: false,
                    issues: [{ level: 'error', definitionKey: 'metahubs', message: 'invalid manifest' }]
                },
                systemAppSchemaGenerationPlansValidation: { ok: true, issues: [], plans: [] },
                legacyFixedSchemaTables: { ok: true, leftovers: [], issues: [] },
                systemAppStructureMetadataInspection: { ok: true, issues: [], entries: [] },
                migrationsValidation: { ok: true, issues: [], orderedIds: [] },
                definitionsLint: { ok: true, issues: [], orderedKeys: [] },
                definitionsDiff: [],
                systemAppManifestLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppManifestDiff: [],
                systemAppSchemaPlanLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppSchemaPlanDiff: [],
                systemAppCompiledLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppCompiledDiff: [],
                migrationPlan: { dryRun: true, planned: [] },
                catalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppManifestCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppSchemaPlanCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppCompiledCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                }
            })
        ).toBe(false)
    })

    it('treats doctor results as unhealthy when schema generation plans are invalid', () => {
        expect(
            isDoctorResultHealthy({
                systemAppDefinitionsValidation: { ok: true, issues: [] },
                systemAppSchemaGenerationPlansValidation: { ok: false, issues: ['profiles: invalid plan'], plans: [] },
                legacyFixedSchemaTables: { ok: true, leftovers: [], issues: [] },
                systemAppStructureMetadataInspection: { ok: true, issues: [], entries: [] },
                migrationsValidation: { ok: true, issues: [], orderedIds: [] },
                definitionsLint: { ok: true, issues: [], orderedKeys: [] },
                definitionsDiff: [],
                systemAppManifestLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppManifestDiff: [],
                systemAppSchemaPlanLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppSchemaPlanDiff: [],
                systemAppCompiledLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppCompiledDiff: [],
                migrationPlan: { dryRun: true, planned: [] },
                catalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppManifestCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppSchemaPlanCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppCompiledCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                }
            })
        ).toBe(false)
    })

    it('treats doctor results as unhealthy when legacy fixed schema tables remain', () => {
        expect(
            isDoctorResultHealthy({
                systemAppDefinitionsValidation: { ok: true, issues: [] },
                systemAppSchemaGenerationPlansValidation: { ok: true, issues: [], plans: [] },
                legacyFixedSchemaTables: {
                    ok: false,
                    leftovers: [
                        {
                            definitionKey: 'admin',
                            schemaName: 'admin',
                            legacyTableName: 'roles',
                            targetSchemaName: 'admin',
                            targetTableName: 'cat_roles',
                            legacyQualifiedName: 'admin.roles',
                            targetQualifiedName: 'admin.cat_roles'
                        }
                    ],
                    issues: ['admin.roles must be reconciled to admin.cat_roles']
                },
                migrationsValidation: { ok: true, issues: [], orderedIds: [] },
                definitionsLint: { ok: true, issues: [], orderedKeys: [] },
                definitionsDiff: [],
                systemAppStructureMetadataInspection: { ok: true, issues: [], entries: [] },
                systemAppManifestLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppManifestDiff: [],
                systemAppSchemaPlanLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppSchemaPlanDiff: [],
                systemAppCompiledLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppCompiledDiff: [],
                migrationPlan: { dryRun: true, planned: [] },
                catalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppManifestCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppSchemaPlanCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppCompiledCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                }
            })
        ).toBe(false)
    })

    it('treats doctor results as unhealthy when fixed system app metadata is incomplete', () => {
        expect(
            isDoctorResultHealthy({
                systemAppDefinitionsValidation: { ok: true, issues: [] },
                systemAppSchemaGenerationPlansValidation: { ok: true, issues: [], plans: [] },
                legacyFixedSchemaTables: { ok: true, leftovers: [], issues: [] },
                systemAppStructureMetadataInspection: {
                    ok: false,
                    issues: ['profiles: missing _app_attributes metadata for profiles.nickname'],
                    entries: []
                },
                migrationsValidation: { ok: true, issues: [], orderedIds: [] },
                definitionsLint: { ok: true, issues: [], orderedKeys: [] },
                definitionsDiff: [],
                systemAppManifestLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppManifestDiff: [],
                systemAppSchemaPlanLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppSchemaPlanDiff: [],
                systemAppCompiledLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppCompiledDiff: [],
                migrationPlan: { dryRun: true, planned: [] },
                catalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppManifestCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppSchemaPlanCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppCompiledCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                }
            })
        ).toBe(false)
    })

    it('treats doctor results as unhealthy when schema plan lifecycle or diff is broken', () => {
        expect(
            isDoctorResultHealthy({
                systemAppDefinitionsValidation: { ok: true, issues: [] },
                systemAppSchemaGenerationPlansValidation: { ok: true, issues: [], plans: [] },
                legacyFixedSchemaTables: { ok: true, leftovers: [], issues: [] },
                systemAppStructureMetadataInspection: { ok: true, issues: [], entries: [] },
                migrationsValidation: { ok: true, issues: [], orderedIds: [] },
                definitionsLint: { ok: true, issues: [], orderedKeys: [] },
                definitionsDiff: [],
                systemAppManifestLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppManifestDiff: [],
                systemAppSchemaPlanLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppSchemaPlanDiff: [
                    {
                        logicalKey: 'system_app_schema_plan.target.profiles::custom',
                        status: 'missing_in_catalog',
                        desiredChecksum: 'a',
                        actualChecksum: null
                    }
                ],
                systemAppCompiledLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppCompiledDiff: [],
                migrationPlan: { dryRun: true, planned: [] },
                catalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppManifestCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppSchemaPlanCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppCompiledCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                }
            })
        ).toBe(false)
    })

    it('treats doctor results as unhealthy when compiled artifact lifecycle or diff is broken', () => {
        expect(
            isDoctorResultHealthy({
                systemAppDefinitionsValidation: { ok: true, issues: [] },
                systemAppSchemaGenerationPlansValidation: { ok: true, issues: [], plans: [] },
                legacyFixedSchemaTables: { ok: true, leftovers: [], issues: [] },
                systemAppStructureMetadataInspection: { ok: true, issues: [], entries: [] },
                migrationsValidation: { ok: true, issues: [], orderedIds: [] },
                definitionsLint: { ok: true, issues: [], orderedKeys: [] },
                definitionsDiff: [],
                systemAppManifestLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppManifestDiff: [],
                systemAppSchemaPlanLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppSchemaPlanDiff: [],
                systemAppCompiledLint: { ok: true, issues: [], orderedKeys: [] },
                systemAppCompiledDiff: [
                    {
                        logicalKey: 'system_app_compiled.schema.target.profiles.profiles::custom',
                        status: 'missing_in_catalog',
                        desiredChecksum: 'a',
                        actualChecksum: null
                    }
                ],
                migrationPlan: { dryRun: true, planned: [] },
                catalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppManifestCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppSchemaPlanCatalogLifecycle: {
                    ok: true,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: [],
                    missingExportKeys: []
                },
                systemAppCompiledCatalogLifecycle: {
                    ok: false,
                    storageReady: true,
                    exportTarget: 'stdout',
                    registeredCount: 0,
                    activeRevisionCount: 0,
                    exportCount: 0,
                    missingRegistryKeys: ['system_app_compiled.schema.target.profiles.profiles::custom'],
                    missingExportKeys: []
                }
            })
        ).toBe(false)
    })
})
