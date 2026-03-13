import type { PlatformMigrationFile, SystemAppDefinition, SystemAppMigrationEntry } from '@universo/migrations-core'
import { runPlatformMigrations, validateDependencyGraph, validatePlatformMigrations, type MigrationLogger } from '@universo/migrations-core'
import type { DefinitionArtifact } from '@universo/migrations-catalog'
import {
    PlatformMigrationCatalog,
    PlatformMigrationKernelCatalog,
    areDefinitionArtifactsEquivalent,
    buildLogicalKey,
    calculateDefinitionChecksum,
    createDefinitionBundle,
    createDefinitionArtifact,
    ensureDefinitionExportRecorded,
    exportDefinitionBundle,
    exportDefinitions,
    getActiveRevision,
    getDefinitionByLogicalKey,
    importDefinitionBundle,
    importDefinitions,
    listDefinitionExports
} from '@universo/migrations-catalog'
import type { Knex } from 'knex'
import { readFile } from 'fs/promises'
import {
    exportRegisteredSystemAppSchemaGenerationPlans,
    loadPlatformMigrationsFromSystemApps,
    resolveSystemAppSystemTableCapabilities,
    systemAppDefinitions,
    type SystemAppMigrationBootstrapPhase,
    type SystemAppSchemaGenerationPlan,
    validateRegisteredSystemAppDefinitions,
    validateRegisteredSystemAppSchemaGenerationPlans
} from './systemAppDefinitions'
import {
    compileRegisteredSystemAppSchemaDefinitionArtifacts,
    inspectRegisteredSystemAppStructureMetadata,
    validateRegisteredSystemAppCompiledDefinitions
} from './systemAppSchemaCompiler'
import { isGlobalMigrationCatalogEnabled } from '@universo/utils'

export const registeredSystemAppDefinitions = systemAppDefinitions
export const platformMigrations: PlatformMigrationFile[] = loadPlatformMigrationsFromSystemApps()
const platformPreludeMigrations: PlatformMigrationFile[] = loadPlatformMigrationsFromSystemApps(systemAppDefinitions, [
    'standalone',
    'pre_schema_generation'
])
const platformPostSchemaMigrations: PlatformMigrationFile[] = loadPlatformMigrationsFromSystemApps(systemAppDefinitions, [
    'post_schema_generation'
])

const registeredPlatformDefinitionFamily = 'registered_platform_definitions'
const registeredSystemAppManifestDefinitionFamily = 'registered_system_app_manifest_definitions'
const registeredSystemAppSchemaPlanDefinitionFamily = 'registered_system_app_schema_plan_definitions'
const registeredSystemAppCompiledDefinitionFamily = 'registered_system_app_compiled_definitions'
const mixedRegisteredDefinitionFamily = 'mixed_registered_definition_families'
const anyRegisteredPlatformLifecycleExportTarget = 'any-active-revision-export'
export const globalMigrationCatalogDisabledMessage = 'Global migration catalog is disabled by UPL_GLOBAL_MIGRATION_CATALOG_ENABLED=false'

const createPlatformMigrationRepository = (knex: Knex) =>
    isGlobalMigrationCatalogEnabled() ? new PlatformMigrationCatalog(knex) : new PlatformMigrationKernelCatalog(knex)

const assertGlobalMigrationCatalogEnabled = (): void => {
    if (!isGlobalMigrationCatalogEnabled()) {
        throw new Error(`${globalMigrationCatalogDisabledMessage}. Enable it to use catalog-backed definition lifecycle commands.`)
    }
}

export const validateRegisteredPlatformMigrations = () => validatePlatformMigrations(platformMigrations)

export interface RegisteredPlatformDefinitionLintResult {
    ok: boolean
    issues: string[]
    orderedKeys: string[]
}

const buildRegisteredDefinitionPayload = (migration: PlatformMigrationFile): string =>
    JSON.stringify({
        kind: 'platform-migration-definition',
        id: migration.id,
        version: migration.version,
        scope: migration.scope,
        sourceKind: migration.sourceKind ?? 'file',
        transactionMode: migration.transactionMode ?? 'single',
        lockMode: migration.lockMode ?? 'transaction_advisory',
        summary: migration.summary ?? null,
        checksumSource: migration.checksumSource ?? null,
        deliveryStage: migration.deliveryStage ?? 'one_shot',
        executionBudget: migration.executionBudget ?? null
    })

const buildRegisteredDefinitionArtifact = (migration: PlatformMigrationFile): DefinitionArtifact =>
    createDefinitionArtifact({
        kind: 'custom',
        name: migration.id,
        schemaQualifiedName: `platform_migration.${migration.scope.kind}.${migration.scope.key}.${migration.id}`,
        sql: buildRegisteredDefinitionPayload(migration),
        dependencies: []
    })

interface RegisteredSystemAppManifestPayload {
    kind: 'system-app-manifest-definition'
    manifestVersion: number
    key: string
    displayName: string
    ownerPackage: string
    engineVersion: string
    structureVersion: string
    configurationVersion: string
    schemaTarget: SystemAppDefinition['schemaTarget']
    runtimeCapabilities: SystemAppDefinition['runtimeCapabilities']
    currentStorageModel: SystemAppDefinition['currentStorageModel']
    targetStorageModel: SystemAppDefinition['targetStorageModel']
    currentStructureCapabilities: SystemAppDefinition['currentStructureCapabilities']
    targetStructureCapabilities: SystemAppDefinition['targetStructureCapabilities']
    currentSystemTableCapabilities: ReturnType<typeof resolveSystemAppSystemTableCapabilities>
    targetSystemTableCapabilities: ReturnType<typeof resolveSystemAppSystemTableCapabilities>
    summary: string | null
    repeatableSeeds: SystemAppDefinition['repeatableSeeds']
    currentBusinessTables: SystemAppDefinition['currentBusinessTables']
    targetBusinessTables: SystemAppDefinition['targetBusinessTables']
    migrationRefs: Array<{
        kind: SystemAppMigrationEntry['kind']
        id: string
        version: string
        scope: {
            kind: string
            key: string
        }
    }>
}

interface RegisteredSystemAppSchemaPlanPayload {
    kind: 'system-app-schema-generation-plan'
    definitionKey: string
    displayName: string
    schemaName: string
    stage: SystemAppSchemaGenerationPlan['stage']
    storageModel: SystemAppSchemaGenerationPlan['storageModel']
    structureVersion: string
    configurationVersion: string
    structureCapabilities: SystemAppSchemaGenerationPlan['structureCapabilities']
    systemTableCapabilities: SystemAppSchemaGenerationPlan['systemTableCapabilities']
    businessTables: SystemAppSchemaGenerationPlan['businessTables']
}

interface RegisteredSystemAppCompiledSchemaPayload {
    kind: 'system-app-compiled-schema'
    definitionKey: string
    displayName: string
    schemaName: string
    stage: 'current' | 'target'
    storageModel: string
    structureVersion: string
    configurationVersion: string
}

interface RegisteredSystemAppCompiledTablePayload extends Omit<RegisteredSystemAppCompiledSchemaPayload, 'kind'> {
    kind: 'system-app-compiled-table'
    tableName: string
}

interface RegisteredSystemAppCompiledObjectPayload extends Omit<RegisteredSystemAppCompiledSchemaPayload, 'kind'> {
    kind: 'system-app-compiled-object'
    objectCodename: string
    tableName: string
    objectKind: string
    presentation?: Record<string, unknown>
}

interface RegisteredSystemAppCompiledAttributePayload extends Omit<RegisteredSystemAppCompiledSchemaPayload, 'kind'> {
    kind: 'system-app-compiled-attribute'
    objectCodename: string
    tableName: string
    attributeCodename: string
    physicalColumnName: string
    targetObjectCodename?: string | null
    dataType: string
    isRequired: boolean
    isDisplayAttribute: boolean
    presentation?: Record<string, unknown> | null
    validationRules?: Record<string, unknown> | null
    uiConfig?: Record<string, unknown> | null
}

const buildRegisteredSystemAppManifestPayload = (definition: SystemAppDefinition): RegisteredSystemAppManifestPayload => ({
    kind: 'system-app-manifest-definition',
    manifestVersion: definition.manifestVersion,
    key: definition.key,
    displayName: definition.displayName,
    ownerPackage: definition.ownerPackage,
    engineVersion: definition.engineVersion,
    structureVersion: definition.structureVersion,
    configurationVersion: definition.configurationVersion,
    schemaTarget: definition.schemaTarget,
    runtimeCapabilities: definition.runtimeCapabilities,
    currentStorageModel: definition.currentStorageModel,
    targetStorageModel: definition.targetStorageModel,
    currentStructureCapabilities: definition.currentStructureCapabilities,
    targetStructureCapabilities: definition.targetStructureCapabilities,
    currentSystemTableCapabilities: resolveSystemAppSystemTableCapabilities(definition, 'current'),
    targetSystemTableCapabilities: resolveSystemAppSystemTableCapabilities(definition, 'target'),
    summary: definition.summary ?? null,
    repeatableSeeds: [...definition.repeatableSeeds],
    currentBusinessTables: [...definition.currentBusinessTables],
    targetBusinessTables: [...definition.targetBusinessTables],
    migrationRefs: definition.migrations.map((entry) =>
        entry.kind === 'file'
            ? {
                  kind: entry.kind,
                  id: entry.migration.id,
                  version: entry.migration.version,
                  scope: entry.migration.scope
              }
            : {
                  kind: entry.kind,
                  id: entry.definition.id,
                  version: entry.definition.version,
                  scope: {
                      kind: 'platform_schema',
                      key: definition.schemaTarget.kind === 'fixed' ? definition.schemaTarget.schemaName : definition.key
                  }
              }
    )
})

const buildRegisteredSystemAppManifestArtifact = (definition: SystemAppDefinition): DefinitionArtifact =>
    createDefinitionArtifact({
        kind: 'custom',
        name: definition.key,
        schemaQualifiedName: `system_app_manifest.${definition.key}`,
        sql: JSON.stringify(buildRegisteredSystemAppManifestPayload(definition)),
        dependencies: []
    })

const buildRegisteredSystemAppSchemaPlanPayload = (plan: SystemAppSchemaGenerationPlan): RegisteredSystemAppSchemaPlanPayload => ({
    kind: 'system-app-schema-generation-plan',
    definitionKey: plan.definitionKey,
    displayName: plan.displayName,
    schemaName: plan.schemaName,
    stage: plan.stage,
    storageModel: plan.storageModel,
    structureVersion: plan.structureVersion,
    configurationVersion: plan.configurationVersion,
    structureCapabilities: plan.structureCapabilities,
    systemTableCapabilities: plan.systemTableCapabilities,
    businessTables: [...plan.businessTables]
})

const buildRegisteredSystemAppSchemaPlanArtifact = (plan: SystemAppSchemaGenerationPlan): DefinitionArtifact =>
    createDefinitionArtifact({
        kind: 'custom',
        name: plan.definitionKey,
        schemaQualifiedName: `system_app_schema_plan.${plan.stage}.${plan.definitionKey}`,
        sql: JSON.stringify(buildRegisteredSystemAppSchemaPlanPayload(plan)),
        dependencies: []
    })

export const exportRegisteredPlatformDefinitions = (): DefinitionArtifact[] =>
    platformMigrations.map((migration) => buildRegisteredDefinitionArtifact(migration))

export const exportRegisteredSystemAppManifestDefinitions = (): DefinitionArtifact[] =>
    registeredSystemAppDefinitions.map((definition) => buildRegisteredSystemAppManifestArtifact(definition))

export const exportRegisteredTargetSystemAppSchemaGenerationPlans = () => exportRegisteredSystemAppSchemaGenerationPlans('target')

export const exportRegisteredSystemAppSchemaPlanDefinitions = (): DefinitionArtifact[] =>
    exportRegisteredTargetSystemAppSchemaGenerationPlans().map((plan) => buildRegisteredSystemAppSchemaPlanArtifact(plan))

export const exportRegisteredSystemAppCompiledDefinitions = (): DefinitionArtifact[] =>
    compileRegisteredSystemAppSchemaDefinitionArtifacts('target').flatMap((entry) => entry.artifacts)

export const exportRegisteredPlatformDefinitionBundle = () =>
    createDefinitionBundle({
        artifacts: exportRegisteredPlatformDefinitions(),
        sourceKind: 'file',
        meta: {
            definitionFamily: registeredPlatformDefinitionFamily
        },
        provenance: {
            source: 'registered-platform-definitions'
        }
    })

export const exportRegisteredSystemAppManifestDefinitionBundle = () =>
    createDefinitionBundle({
        artifacts: exportRegisteredSystemAppManifestDefinitions(),
        sourceKind: 'file',
        meta: {
            definitionFamily: registeredSystemAppManifestDefinitionFamily
        },
        provenance: {
            source: 'registered-system-app-manifests'
        }
    })

export const exportRegisteredSystemAppSchemaPlanDefinitionBundle = () =>
    createDefinitionBundle({
        artifacts: exportRegisteredSystemAppSchemaPlanDefinitions(),
        sourceKind: 'file',
        meta: {
            definitionFamily: registeredSystemAppSchemaPlanDefinitionFamily
        },
        provenance: {
            source: 'registered-system-app-schema-plans'
        }
    })

export const exportRegisteredSystemAppCompiledDefinitionBundle = () =>
    createDefinitionBundle({
        artifacts: exportRegisteredSystemAppCompiledDefinitions(),
        sourceKind: 'file',
        meta: {
            definitionFamily: registeredSystemAppCompiledDefinitionFamily
        },
        provenance: {
            source: 'registered-system-app-compiled-definitions'
        }
    })

export const lintRegisteredPlatformDefinitions = (): RegisteredPlatformDefinitionLintResult => {
    const artifacts = exportRegisteredPlatformDefinitions()
    const graph = validateDependencyGraph(
        artifacts.map((artifact) => ({
            logicalKey: buildLogicalKey(artifact),
            dependencies: artifact.dependencies
        }))
    )

    return {
        ok: graph.ok,
        issues: graph.issues,
        orderedKeys: graph.orderedKeys
    }
}

export const lintRegisteredSystemAppManifestDefinitions = (): RegisteredPlatformDefinitionLintResult => {
    const artifacts = exportRegisteredSystemAppManifestDefinitions()
    const graph = validateDependencyGraph(
        artifacts.map((artifact) => ({
            logicalKey: buildLogicalKey(artifact),
            dependencies: artifact.dependencies
        }))
    )

    return {
        ok: graph.ok,
        issues: graph.issues,
        orderedKeys: graph.orderedKeys
    }
}

export const lintRegisteredSystemAppSchemaPlanDefinitions = (): RegisteredPlatformDefinitionLintResult => {
    const artifacts = exportRegisteredSystemAppSchemaPlanDefinitions()
    const graph = validateDependencyGraph(
        artifacts.map((artifact) => ({
            logicalKey: buildLogicalKey(artifact),
            dependencies: artifact.dependencies
        }))
    )

    return {
        ok: graph.ok,
        issues: graph.issues,
        orderedKeys: graph.orderedKeys
    }
}

export const lintRegisteredSystemAppCompiledDefinitions = (): RegisteredPlatformDefinitionLintResult => {
    const artifacts = exportRegisteredSystemAppCompiledDefinitions()
    const graph = validateDependencyGraph(
        artifacts.map((artifact) => ({
            logicalKey: buildLogicalKey(artifact),
            dependencies: artifact.dependencies
        }))
    )

    return {
        ok: graph.ok,
        issues: graph.issues,
        orderedKeys: graph.orderedKeys
    }
}

export interface RegisteredPlatformDefinitionDiffEntry {
    logicalKey: string
    status: 'match' | 'missing_in_catalog' | 'checksum_mismatch' | 'catalog_only'
    desiredChecksum: string | null
    actualChecksum: string | null
}

export const diffRegisteredPlatformDefinitions = async (knex: Knex): Promise<RegisteredPlatformDefinitionDiffEntry[]> => {
    const desiredArtifacts = exportRegisteredPlatformDefinitions()
    const desiredByKey = new Map<string, DefinitionArtifact>(
        desiredArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact] as const)
    )
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return desiredArtifacts
            .map((artifact) => ({
                logicalKey: `${artifact.schemaQualifiedName}::${artifact.kind}`,
                status: 'missing_in_catalog' as const,
                desiredChecksum: artifact.checksum,
                actualChecksum: null
            }))
            .sort((left, right) => left.logicalKey.localeCompare(right.logicalKey))
    }

    const catalogArtifacts = await exportDefinitions(knex, { logicalKeyPrefix: 'platform_migration.' })
    const catalogByKey = new Map<string, DefinitionArtifact>(
        catalogArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact] as const)
    )
    const keys: string[] = Array.from(new Set<string>([...desiredByKey.keys(), ...catalogByKey.keys()])).sort((left, right) =>
        left.localeCompare(right)
    )

    return keys.map((logicalKey): RegisteredPlatformDefinitionDiffEntry => {
        const desired = desiredByKey.get(logicalKey) ?? null
        const actual = catalogByKey.get(logicalKey) ?? null

        if (desired && actual) {
            return {
                logicalKey,
                status: desired.checksum === actual.checksum ? 'match' : 'checksum_mismatch',
                desiredChecksum: desired.checksum,
                actualChecksum: actual.checksum
            }
        }

        if (desired) {
            return {
                logicalKey,
                status: 'missing_in_catalog',
                desiredChecksum: desired.checksum,
                actualChecksum: null
            }
        }

        return {
            logicalKey,
            status: 'catalog_only',
            desiredChecksum: null,
            actualChecksum: actual?.checksum ?? null
        }
    })
}

export const diffRegisteredSystemAppManifestDefinitions = async (knex: Knex): Promise<RegisteredPlatformDefinitionDiffEntry[]> => {
    const desiredArtifacts = exportRegisteredSystemAppManifestDefinitions()
    const desiredByKey = new Map<string, DefinitionArtifact>(
        desiredArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact] as const)
    )
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return desiredArtifacts
            .map((artifact) => ({
                logicalKey: `${artifact.schemaQualifiedName}::${artifact.kind}`,
                status: 'missing_in_catalog' as const,
                desiredChecksum: artifact.checksum,
                actualChecksum: null
            }))
            .sort((left, right) => left.logicalKey.localeCompare(right.logicalKey))
    }

    const catalogArtifacts = await exportDefinitions(knex, { logicalKeyPrefix: 'system_app_manifest.' })
    const catalogByKey = new Map<string, DefinitionArtifact>(
        catalogArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact] as const)
    )
    const keys: string[] = Array.from(new Set<string>([...desiredByKey.keys(), ...catalogByKey.keys()])).sort((left, right) =>
        left.localeCompare(right)
    )

    return keys.map((logicalKey): RegisteredPlatformDefinitionDiffEntry => {
        const desired = desiredByKey.get(logicalKey) ?? null
        const actual = catalogByKey.get(logicalKey) ?? null

        if (desired && actual) {
            return {
                logicalKey,
                status: desired.checksum === actual.checksum ? 'match' : 'checksum_mismatch',
                desiredChecksum: desired.checksum,
                actualChecksum: actual.checksum
            }
        }

        if (desired) {
            return {
                logicalKey,
                status: 'missing_in_catalog',
                desiredChecksum: desired.checksum,
                actualChecksum: null
            }
        }

        return {
            logicalKey,
            status: 'catalog_only',
            desiredChecksum: null,
            actualChecksum: actual?.checksum ?? null
        }
    })
}

export const diffRegisteredSystemAppSchemaPlanDefinitions = async (knex: Knex): Promise<RegisteredPlatformDefinitionDiffEntry[]> => {
    const desiredArtifacts = exportRegisteredSystemAppSchemaPlanDefinitions()
    const desiredByKey = new Map<string, DefinitionArtifact>(
        desiredArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact] as const)
    )
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return desiredArtifacts
            .map((artifact) => ({
                logicalKey: `${artifact.schemaQualifiedName}::${artifact.kind}`,
                status: 'missing_in_catalog' as const,
                desiredChecksum: artifact.checksum,
                actualChecksum: null
            }))
            .sort((left, right) => left.logicalKey.localeCompare(right.logicalKey))
    }

    const catalogArtifacts = await exportDefinitions(knex, { logicalKeyPrefix: 'system_app_schema_plan.' })
    const catalogByKey = new Map<string, DefinitionArtifact>(
        catalogArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact] as const)
    )
    const keys: string[] = Array.from(new Set<string>([...desiredByKey.keys(), ...catalogByKey.keys()])).sort((left, right) =>
        left.localeCompare(right)
    )

    return keys.map((logicalKey): RegisteredPlatformDefinitionDiffEntry => {
        const desired = desiredByKey.get(logicalKey) ?? null
        const actual = catalogByKey.get(logicalKey) ?? null

        if (desired && actual) {
            return {
                logicalKey,
                status: desired.checksum === actual.checksum ? 'match' : 'checksum_mismatch',
                desiredChecksum: desired.checksum,
                actualChecksum: actual.checksum
            }
        }

        if (desired) {
            return {
                logicalKey,
                status: 'missing_in_catalog',
                desiredChecksum: desired.checksum,
                actualChecksum: null
            }
        }

        return {
            logicalKey,
            status: 'catalog_only',
            desiredChecksum: null,
            actualChecksum: actual?.checksum ?? null
        }
    })
}

export const diffRegisteredSystemAppCompiledDefinitions = async (knex: Knex): Promise<RegisteredPlatformDefinitionDiffEntry[]> => {
    const desiredArtifacts = exportRegisteredSystemAppCompiledDefinitions()
    const desiredByKey = new Map<string, DefinitionArtifact>(
        desiredArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact] as const)
    )
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return desiredArtifacts
            .map((artifact) => ({
                logicalKey: `${artifact.schemaQualifiedName}::${artifact.kind}`,
                status: 'missing_in_catalog' as const,
                desiredChecksum: artifact.checksum,
                actualChecksum: null
            }))
            .sort((left, right) => left.logicalKey.localeCompare(right.logicalKey))
    }

    const catalogArtifacts = await exportDefinitions(knex, { logicalKeyPrefix: 'system_app_compiled.' })
    const catalogByKey = new Map<string, DefinitionArtifact>(
        catalogArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact] as const)
    )
    const keys: string[] = Array.from(new Set<string>([...desiredByKey.keys(), ...catalogByKey.keys()])).sort((left, right) =>
        left.localeCompare(right)
    )

    return keys.map((logicalKey): RegisteredPlatformDefinitionDiffEntry => {
        const desired = desiredByKey.get(logicalKey) ?? null
        const actual = catalogByKey.get(logicalKey) ?? null

        if (desired && actual) {
            return {
                logicalKey,
                status: desired.checksum === actual.checksum ? 'match' : 'checksum_mismatch',
                desiredChecksum: desired.checksum,
                actualChecksum: actual.checksum
            }
        }

        if (desired) {
            return {
                logicalKey,
                status: 'missing_in_catalog',
                desiredChecksum: desired.checksum,
                actualChecksum: null
            }
        }

        return {
            logicalKey,
            status: 'catalog_only',
            desiredChecksum: null,
            actualChecksum: actual?.checksum ?? null
        }
    })
}

export const exportCatalogPlatformDefinitions = async (knex: Knex, exportTarget = 'stdout'): Promise<DefinitionArtifact[]> => {
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return []
    }

    const artifacts = await exportDefinitions(knex, { logicalKeyPrefix: 'platform_migration.' })
    await recordCatalogDefinitionExports(knex, artifacts, exportTarget)

    return artifacts
}

export const exportCatalogSystemAppManifestDefinitions = async (knex: Knex, exportTarget = 'stdout'): Promise<DefinitionArtifact[]> => {
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return []
    }

    const artifacts = await exportDefinitions(knex, { logicalKeyPrefix: 'system_app_manifest.' })
    await recordCatalogDefinitionExports(knex, artifacts, exportTarget)

    return artifacts
}

export const exportCatalogSystemAppSchemaPlanDefinitions = async (knex: Knex, exportTarget = 'stdout'): Promise<DefinitionArtifact[]> => {
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return []
    }

    const artifacts = await exportDefinitions(knex, { logicalKeyPrefix: 'system_app_schema_plan.' })
    await recordCatalogDefinitionExports(knex, artifacts, exportTarget)

    return artifacts
}

export const exportCatalogSystemAppCompiledDefinitions = async (knex: Knex, exportTarget = 'stdout'): Promise<DefinitionArtifact[]> => {
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return []
    }

    const artifacts = await exportDefinitions(knex, { logicalKeyPrefix: 'system_app_compiled.' })
    await recordCatalogDefinitionExports(knex, artifacts, exportTarget)

    return artifacts
}

const recordCatalogDefinitionExports = async (
    knex: Knex,
    artifacts: DefinitionArtifact[],
    exportTarget: string,
    meta: Record<string, unknown> | null = null
): Promise<void> => {
    const exportedAt = new Date().toISOString()

    for (const artifact of artifacts) {
        const record = await getDefinitionByLogicalKey(knex, buildLogicalKey(artifact))
        if (!record) {
            continue
        }

        const revision = await getActiveRevision(knex, record.id)
        await ensureDefinitionExportRecorded(knex, {
            registryId: record.id,
            revisionId: revision?.id ?? null,
            exportTarget,
            fileChecksum: revision?.checksum ?? null,
            meta: {
                exportedAt,
                ...(meta ?? {})
            }
        })
    }
}

export const exportCatalogPlatformDefinitionBundle = async (knex: Knex, exportTarget = 'stdout') => {
    const bundle = await exportDefinitionBundle(
        knex,
        { logicalKeyPrefix: 'platform_migration.' },
        {
            sourceKind: 'declarative',
            meta: {
                exportTarget,
                definitionFamily: registeredPlatformDefinitionFamily
            },
            provenance: {
                exportedFrom: exportTarget,
                source: 'catalog-platform-definitions'
            }
        }
    )

    await recordCatalogDefinitionExports(knex, bundle.artifacts, exportTarget, {
        bundleVersion: bundle.bundleVersion,
        checksumFamily: bundle.checksumFamily,
        source: 'catalog-platform-definitions'
    })

    return bundle
}

export const exportCatalogSystemAppManifestDefinitionBundle = async (knex: Knex, exportTarget = 'stdout') => {
    const bundle = await exportDefinitionBundle(
        knex,
        { logicalKeyPrefix: 'system_app_manifest.' },
        {
            sourceKind: 'declarative',
            meta: {
                exportTarget,
                definitionFamily: registeredSystemAppManifestDefinitionFamily
            },
            provenance: {
                exportedFrom: exportTarget,
                source: 'catalog-system-app-manifests'
            }
        }
    )

    await recordCatalogDefinitionExports(knex, bundle.artifacts, exportTarget, {
        bundleVersion: bundle.bundleVersion,
        checksumFamily: bundle.checksumFamily,
        source: 'catalog-system-app-manifests'
    })

    return bundle
}

export const exportCatalogSystemAppSchemaPlanDefinitionBundle = async (knex: Knex, exportTarget = 'stdout') => {
    const bundle = await exportDefinitionBundle(
        knex,
        { logicalKeyPrefix: 'system_app_schema_plan.' },
        {
            sourceKind: 'declarative',
            meta: {
                exportTarget,
                definitionFamily: registeredSystemAppSchemaPlanDefinitionFamily
            },
            provenance: {
                exportedFrom: exportTarget,
                source: 'catalog-system-app-schema-plans'
            }
        }
    )

    await recordCatalogDefinitionExports(knex, bundle.artifacts, exportTarget, {
        bundleVersion: bundle.bundleVersion,
        checksumFamily: bundle.checksumFamily,
        source: 'catalog-system-app-schema-plans'
    })

    return bundle
}

export const exportCatalogSystemAppCompiledDefinitionBundle = async (knex: Knex, exportTarget = 'stdout') => {
    const bundle = await exportDefinitionBundle(
        knex,
        { logicalKeyPrefix: 'system_app_compiled.' },
        {
            sourceKind: 'declarative',
            meta: {
                exportTarget,
                definitionFamily: registeredSystemAppCompiledDefinitionFamily
            },
            provenance: {
                exportedFrom: exportTarget,
                source: 'catalog-system-app-compiled-definitions'
            }
        }
    )

    await recordCatalogDefinitionExports(knex, bundle.artifacts, exportTarget, {
        bundleVersion: bundle.bundleVersion,
        checksumFamily: bundle.checksumFamily,
        source: 'catalog-system-app-compiled-definitions'
    })

    return bundle
}

export interface RegisteredPlatformDefinitionSyncResult {
    created: number
    updated: number
    unchanged: number
    lint: RegisteredPlatformDefinitionLintResult
    legacyFixedSchemaTables?: LegacyFixedSchemaTablesInspection
    systemAppStructureMetadataInspection?: Awaited<ReturnType<typeof inspectRegisteredSystemAppStructureMetadata>>
    systemAppDefinitionsValidation?: ReturnType<typeof validateRegisteredSystemAppDefinitions>
    systemAppSchemaGenerationPlansValidation?: ReturnType<typeof validateRegisteredSystemAppSchemaGenerationPlans>
    systemAppCompiledDefinitionsValidation?: ReturnType<typeof validateRegisteredSystemAppCompiledDefinitions>
    systemAppManifestLint?: RegisteredPlatformDefinitionLintResult
    systemAppSchemaPlanLint?: RegisteredPlatformDefinitionLintResult
    systemAppCompiledLint?: RegisteredPlatformDefinitionLintResult
}

export interface RegisteredPlatformCatalogLifecycleHealth {
    ok: boolean
    storageReady: boolean
    exportTarget: string
    registeredCount: number
    activeRevisionCount: number
    publishedLifecycleCount: number
    exportCount: number
    missingRegistryKeys: string[]
    missingPublishedLifecycleKeys: string[]
    missingExportKeys: string[]
}

interface RegisteredPlatformDefinitionPayload {
    kind: 'platform-migration-definition'
    id: string
    version: string
    scope: {
        kind: string
        key: string
    }
}

interface RegisteredSystemAppManifestImportPayload {
    kind: 'system-app-manifest-definition'
    manifestVersion: number
    key: string
    displayName: string
    ownerPackage: string
    engineVersion: string
    structureVersion: string
    configurationVersion: string
}

interface LegacyFixedSchemaTableTarget {
    definitionKey: string
    schemaName: string
    legacyTableName: string
    targetSchemaName: string
    targetTableName: string
}

export interface LegacyFixedSchemaTableState {
    definitionKey: string
    schemaName: string
    legacyTableName: string
    targetSchemaName: string
    targetTableName: string
    legacyQualifiedName: string
    targetQualifiedName: string
}

export interface LegacyFixedSchemaTablesInspection {
    ok: boolean
    leftovers: LegacyFixedSchemaTableState[]
    issues: string[]
}

const legacyFixedSchemaTableTargets: LegacyFixedSchemaTableTarget[] = [
    {
        definitionKey: 'profiles',
        schemaName: 'public',
        legacyTableName: 'profiles',
        targetSchemaName: 'profiles',
        targetTableName: 'cat_profiles'
    },
    {
        definitionKey: 'profiles',
        schemaName: 'profiles',
        legacyTableName: 'profiles',
        targetSchemaName: 'profiles',
        targetTableName: 'cat_profiles'
    },
    {
        definitionKey: 'admin',
        schemaName: 'admin',
        legacyTableName: 'instances',
        targetSchemaName: 'admin',
        targetTableName: 'cfg_instances'
    },
    {
        definitionKey: 'admin',
        schemaName: 'admin',
        legacyTableName: 'roles',
        targetSchemaName: 'admin',
        targetTableName: 'cat_roles'
    },
    {
        definitionKey: 'admin',
        schemaName: 'admin',
        legacyTableName: 'role_permissions',
        targetSchemaName: 'admin',
        targetTableName: 'rel_role_permissions'
    },
    {
        definitionKey: 'admin',
        schemaName: 'admin',
        legacyTableName: 'user_roles',
        targetSchemaName: 'admin',
        targetTableName: 'rel_user_roles'
    },
    {
        definitionKey: 'admin',
        schemaName: 'admin',
        legacyTableName: 'locales',
        targetSchemaName: 'admin',
        targetTableName: 'cfg_locales'
    },
    {
        definitionKey: 'admin',
        schemaName: 'admin',
        legacyTableName: 'settings',
        targetSchemaName: 'admin',
        targetTableName: 'cfg_settings'
    },
    {
        definitionKey: 'applications',
        schemaName: 'applications',
        legacyTableName: 'applications',
        targetSchemaName: 'applications',
        targetTableName: 'cat_applications'
    },
    {
        definitionKey: 'applications',
        schemaName: 'applications',
        legacyTableName: 'connectors',
        targetSchemaName: 'applications',
        targetTableName: 'cat_connectors'
    },
    {
        definitionKey: 'applications',
        schemaName: 'applications',
        legacyTableName: 'connectors_publications',
        targetSchemaName: 'applications',
        targetTableName: 'rel_connector_publications'
    },
    {
        definitionKey: 'applications',
        schemaName: 'applications',
        legacyTableName: 'applications_users',
        targetSchemaName: 'applications',
        targetTableName: 'rel_application_users'
    },
    {
        definitionKey: 'metahubs',
        schemaName: 'metahubs',
        legacyTableName: 'metahubs',
        targetSchemaName: 'metahubs',
        targetTableName: 'cat_metahubs'
    },
    {
        definitionKey: 'metahubs',
        schemaName: 'metahubs',
        legacyTableName: 'metahubs_branches',
        targetSchemaName: 'metahubs',
        targetTableName: 'cat_metahub_branches'
    },
    {
        definitionKey: 'metahubs',
        schemaName: 'metahubs',
        legacyTableName: 'metahubs_users',
        targetSchemaName: 'metahubs',
        targetTableName: 'rel_metahub_users'
    },
    {
        definitionKey: 'metahubs',
        schemaName: 'metahubs',
        legacyTableName: 'templates',
        targetSchemaName: 'metahubs',
        targetTableName: 'cat_templates'
    },
    {
        definitionKey: 'metahubs',
        schemaName: 'metahubs',
        legacyTableName: 'templates_versions',
        targetSchemaName: 'metahubs',
        targetTableName: 'doc_template_versions'
    },
    {
        definitionKey: 'metahubs',
        schemaName: 'metahubs',
        legacyTableName: 'publications',
        targetSchemaName: 'metahubs',
        targetTableName: 'doc_publications'
    },
    {
        definitionKey: 'metahubs',
        schemaName: 'metahubs',
        legacyTableName: 'publications_versions',
        targetSchemaName: 'metahubs',
        targetTableName: 'doc_publication_versions'
    }
]

const normalizeRawRows = (value: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(value)) {
        return value.filter(isRecord)
    }

    if (isRecord(value) && Array.isArray(value.rows)) {
        return value.rows.filter(isRecord)
    }

    return []
}

export const inspectLegacyFixedSchemaTables = async (knex: Knex): Promise<LegacyFixedSchemaTablesInspection> => {
    const tuplePlaceholders = legacyFixedSchemaTableTargets.map(() => '(?, ?)').join(', ')
    const bindings = legacyFixedSchemaTableTargets.flatMap((target) => [target.schemaName, target.legacyTableName])
    const result = await knex.raw(
        `
            select table_schema, table_name
            from information_schema.tables
            where table_type = 'BASE TABLE'
              and (table_schema, table_name) in (${tuplePlaceholders})
        `,
        bindings
    )
    const rows = normalizeRawRows(result)
    const targetByLegacyKey = new Map(
        legacyFixedSchemaTableTargets.map((target) => [`${target.schemaName}.${target.legacyTableName}`, target] as const)
    )

    const leftovers = rows
        .map((row) => {
            const schemaName = typeof row.table_schema === 'string' ? row.table_schema : null
            const legacyTableName = typeof row.table_name === 'string' ? row.table_name : null
            if (!schemaName || !legacyTableName) {
                return null
            }

            const target = targetByLegacyKey.get(`${schemaName}.${legacyTableName}`)
            if (!target) {
                return null
            }

            return {
                definitionKey: target.definitionKey,
                schemaName,
                legacyTableName,
                targetSchemaName: target.targetSchemaName,
                targetTableName: target.targetTableName,
                legacyQualifiedName: `${schemaName}.${legacyTableName}`,
                targetQualifiedName: `${target.targetSchemaName}.${target.targetTableName}`
            } satisfies LegacyFixedSchemaTableState
        })
        .filter((entry): entry is LegacyFixedSchemaTableState => entry !== null)
        .sort((left, right) => left.legacyQualifiedName.localeCompare(right.legacyQualifiedName))

    return {
        ok: leftovers.length === 0,
        leftovers,
        issues: leftovers.map((entry) => `${entry.legacyQualifiedName} must be reconciled to ${entry.targetQualifiedName}`)
    }
}

interface RegisteredSystemAppSchemaPlanImportPayload {
    kind: 'system-app-schema-generation-plan'
    definitionKey: string
    displayName: string
    schemaName: string
    stage: 'current' | 'target'
    storageModel: string
    structureVersion: string
    configurationVersion: string
}

type RegisteredSystemAppCompiledImportPayload =
    | RegisteredSystemAppCompiledSchemaPayload
    | RegisteredSystemAppCompiledTablePayload
    | RegisteredSystemAppCompiledObjectPayload
    | RegisteredSystemAppCompiledAttributePayload

const inferImportedDefinitionFamily = (artifacts: DefinitionArtifact[]): string => {
    const families = new Set(
        artifacts.map((artifact) => {
            if (artifact.schemaQualifiedName.startsWith('platform_migration.')) {
                return registeredPlatformDefinitionFamily
            }

            if (artifact.schemaQualifiedName.startsWith('system_app_schema_plan.')) {
                return registeredSystemAppSchemaPlanDefinitionFamily
            }

            if (artifact.schemaQualifiedName.startsWith('system_app_compiled.')) {
                return registeredSystemAppCompiledDefinitionFamily
            }

            return registeredSystemAppManifestDefinitionFamily
        })
    )

    if (families.size === 1) {
        return Array.from(families)[0]!
    }

    return mixedRegisteredDefinitionFamily
}

const syncDefinitionArtifactsToCatalog = async (
    knex: Knex,
    artifacts: DefinitionArtifact[],
    options: {
        definitionFamily: string
        provenanceSource: string
        exportTarget: string
        meta?: Record<string, unknown>
    }
): Promise<Pick<RegisteredPlatformDefinitionSyncResult, 'created' | 'updated' | 'unchanged'>> => {
    if (artifacts.length === 0) {
        return {
            created: 0,
            updated: 0,
            unchanged: 0
        }
    }

    const syncedAt = new Date().toISOString()
    const existingState = await loadRegisteredDefinitionCatalogState(knex, artifacts, options.exportTarget)
    if (isRegisteredDefinitionCatalogStateCurrent(existingState, artifacts, options.definitionFamily)) {
        return {
            created: 0,
            updated: 0,
            unchanged: artifacts.length
        }
    }

    const result = await importDefinitions(knex, artifacts, {
        sourceKind: 'file',
        meta: {
            definitionFamily: options.definitionFamily,
            ...(options.meta ?? {})
        },
        provenance: {
            source: options.provenanceSource,
            syncedAt
        }
    })

    const importedState = await loadRegisteredDefinitionCatalogState(knex, artifacts, options.exportTarget)
    for (const artifact of artifacts) {
        const state = importedState.get(buildLogicalKey(artifact))
        if (!state?.registryId || !state.activeRevisionId || !state.activeChecksum) {
            continue
        }

        await ensureDefinitionExportRecorded(knex, {
            registryId: state.registryId,
            revisionId: state.activeRevisionId,
            exportTarget: options.exportTarget,
            fileChecksum: state.activeChecksum,
            meta: {
                checksumFamily: 'sha256',
                bundleVersion: 1,
                syncedAt,
                source: options.meta?.source ?? options.provenanceSource
            }
        })
    }

    return result
}

interface RegisteredDefinitionCatalogStateRow {
    logicalKey: string
    registryId: string | null
    activeRevisionId: string | null
    activeChecksum: string | null
    activePayload: DefinitionArtifact | null
    sourceKind: string | null
    definitionFamily: string | null
    hasExport: boolean
    hasPublishedLifecycle: boolean
}

const normalizeDefinitionRegistryMeta = (value: unknown): Record<string, unknown> | null => {
    if (isRecord(value)) {
        return value
    }

    if (typeof value !== 'string') {
        return null
    }

    try {
        const parsed = JSON.parse(value)
        return isRecord(parsed) ? parsed : null
    } catch {
        return null
    }
}

const parseActiveDefinitionArtifact = (value: unknown): DefinitionArtifact | null => {
    if (typeof value === 'string') {
        return JSON.parse(value) as DefinitionArtifact
    }

    if (isRecord(value)) {
        return value as unknown as DefinitionArtifact
    }

    return null
}

const loadRegisteredDefinitionCatalogState = async (
    knex: Knex,
    artifacts: DefinitionArtifact[],
    exportTarget: string
): Promise<Map<string, RegisteredDefinitionCatalogStateRow>> => {
    const logicalKeys = artifacts.map((artifact) => buildLogicalKey(artifact))
    const placeholders = logicalKeys.map(() => '?').join(', ')
    const rows = normalizeRawRows(
        await knex.raw(
            `
                select
                    registry.logical_key,
                    registry.id as registry_id,
                    registry.active_revision_id,
                    registry.source_kind,
                    registry.meta,
                    revision.checksum as active_checksum,
                    revision.payload as active_payload,
                    revision.provenance as active_provenance,
                    case when count(export_record.id) > 0 then true else false end as has_export
                from upl_migrations.definition_registry registry
                left join upl_migrations.definition_revisions revision on revision.id = registry.active_revision_id
                left join upl_migrations.definition_exports export_record
                    on export_record.registry_id = registry.id
                   and export_record.revision_id is not distinct from registry.active_revision_id
                   and export_record.export_target = ?
                where registry.logical_key in (${placeholders})
                group by registry.logical_key, registry.id, registry.active_revision_id, registry.source_kind, registry.meta, revision.checksum, revision.payload, revision.provenance
            `,
            [exportTarget, ...logicalKeys]
        )
    )

    return new Map(
        rows
            .map((row) => {
                const logicalKey = typeof row.logical_key === 'string' ? row.logical_key : null
                if (!logicalKey) {
                    return null
                }

                const meta = normalizeDefinitionRegistryMeta(row.meta)
                const provenance = normalizeDefinitionRegistryMeta(row.active_provenance)
                const activePayload = parseActiveDefinitionArtifact(row.active_payload)
                return [
                    logicalKey,
                    {
                        logicalKey,
                        registryId: typeof row.registry_id === 'string' ? row.registry_id : null,
                        activeRevisionId: typeof row.active_revision_id === 'string' ? row.active_revision_id : null,
                        activeChecksum: typeof row.active_checksum === 'string' ? row.active_checksum : null,
                        activePayload,
                        sourceKind: typeof row.source_kind === 'string' ? row.source_kind : null,
                        definitionFamily: typeof meta?.definitionFamily === 'string' ? meta.definitionFamily : null,
                        hasExport: row.has_export === true || row.has_export === 1 || row.has_export === '1' || row.has_export === 't',
                        hasPublishedLifecycle:
                            provenance?.reviewState === 'published' &&
                            provenance?.checksumFamily === 'sha256' &&
                            typeof provenance?.sourceKind === 'string'
                    } satisfies RegisteredDefinitionCatalogStateRow
                ] as const
            })
            .filter((entry): entry is readonly [string, RegisteredDefinitionCatalogStateRow] => entry !== null)
    )
}

const isRegisteredDefinitionCatalogStateCurrent = (
    state: Map<string, RegisteredDefinitionCatalogStateRow>,
    artifacts: DefinitionArtifact[],
    definitionFamily: string
): boolean => {
    if (state.size !== artifacts.length) {
        return false
    }

    return artifacts.every((artifact) => {
        const entry = state.get(buildLogicalKey(artifact))
        if (!entry) {
            return false
        }

        return (
            entry.sourceKind === 'file' &&
            entry.definitionFamily === definitionFamily &&
            entry.activeRevisionId !== null &&
            entry.activeChecksum === artifact.checksum &&
            entry.activePayload !== null &&
            areDefinitionArtifactsEquivalent(entry.activePayload, artifact) &&
            entry.hasPublishedLifecycle &&
            entry.hasExport
        )
    })
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

const parsePlatformDefinitionPayload = (sql: string, index: number): RegisteredPlatformDefinitionPayload => {
    let parsed: unknown
    try {
        parsed = JSON.parse(sql)
    } catch (error) {
        throw new Error(
            `Definition artifact at index ${index} contains invalid platform payload JSON: ${
                error instanceof Error ? error.message : String(error)
            }`
        )
    }

    if (
        !isRecord(parsed) ||
        parsed.kind !== 'platform-migration-definition' ||
        typeof parsed.id !== 'string' ||
        typeof parsed.version !== 'string' ||
        !isRecord(parsed.scope) ||
        typeof parsed.scope.kind !== 'string' ||
        typeof parsed.scope.key !== 'string'
    ) {
        throw new Error(`Definition artifact at index ${index} contains an invalid platform payload`)
    }

    return parsed as unknown as RegisteredPlatformDefinitionPayload
}

const parseSystemAppManifestPayload = (sql: string, index: number): RegisteredSystemAppManifestImportPayload => {
    let parsed: unknown
    try {
        parsed = JSON.parse(sql)
    } catch (error) {
        throw new Error(
            `Definition artifact at index ${index} contains invalid system app manifest payload JSON: ${
                error instanceof Error ? error.message : String(error)
            }`
        )
    }

    if (
        !isRecord(parsed) ||
        parsed.kind !== 'system-app-manifest-definition' ||
        !Number.isInteger(parsed.manifestVersion) ||
        typeof parsed.key !== 'string' ||
        typeof parsed.displayName !== 'string' ||
        typeof parsed.ownerPackage !== 'string' ||
        typeof parsed.engineVersion !== 'string' ||
        typeof parsed.structureVersion !== 'string' ||
        typeof parsed.configurationVersion !== 'string'
    ) {
        throw new Error(`Definition artifact at index ${index} contains an invalid system app manifest payload`)
    }

    return parsed as unknown as RegisteredSystemAppManifestImportPayload
}

const parseSystemAppSchemaPlanPayload = (sql: string, index: number): RegisteredSystemAppSchemaPlanImportPayload => {
    let parsed: unknown
    try {
        parsed = JSON.parse(sql)
    } catch (error) {
        throw new Error(
            `Definition artifact at index ${index} contains invalid system app schema plan payload JSON: ${
                error instanceof Error ? error.message : String(error)
            }`
        )
    }

    if (
        !isRecord(parsed) ||
        parsed.kind !== 'system-app-schema-generation-plan' ||
        typeof parsed.definitionKey !== 'string' ||
        typeof parsed.displayName !== 'string' ||
        typeof parsed.schemaName !== 'string' ||
        (parsed.stage !== 'current' && parsed.stage !== 'target') ||
        typeof parsed.storageModel !== 'string' ||
        typeof parsed.structureVersion !== 'string' ||
        typeof parsed.configurationVersion !== 'string'
    ) {
        throw new Error(`Definition artifact at index ${index} contains an invalid system app schema plan payload`)
    }

    return parsed as unknown as RegisteredSystemAppSchemaPlanImportPayload
}

const parseSystemAppCompiledPayload = (sql: string, index: number): RegisteredSystemAppCompiledImportPayload => {
    let parsed: unknown
    try {
        parsed = JSON.parse(sql)
    } catch (error) {
        throw new Error(
            `Definition artifact at index ${index} contains invalid system app compiled payload JSON: ${
                error instanceof Error ? error.message : String(error)
            }`
        )
    }

    if (
        !isRecord(parsed) ||
        (parsed.kind !== 'system-app-compiled-schema' &&
            parsed.kind !== 'system-app-compiled-table' &&
            parsed.kind !== 'system-app-compiled-object' &&
            parsed.kind !== 'system-app-compiled-attribute') ||
        typeof parsed.definitionKey !== 'string' ||
        typeof parsed.displayName !== 'string' ||
        typeof parsed.schemaName !== 'string' ||
        (parsed.stage !== 'current' && parsed.stage !== 'target') ||
        typeof parsed.storageModel !== 'string' ||
        typeof parsed.structureVersion !== 'string' ||
        typeof parsed.configurationVersion !== 'string'
    ) {
        throw new Error(`Definition artifact at index ${index} contains an invalid system app compiled payload`)
    }

    if (parsed.kind === 'system-app-compiled-table' && typeof parsed.tableName !== 'string') {
        throw new Error(`Definition artifact at index ${index} contains an invalid system app compiled payload`)
    }

    if (
        parsed.kind === 'system-app-compiled-object' &&
        (typeof parsed.tableName !== 'string' ||
            typeof parsed.objectCodename !== 'string' ||
            typeof parsed.objectKind !== 'string' ||
            !(typeof parsed.presentation === 'undefined' || isRecord(parsed.presentation)))
    ) {
        throw new Error(`Definition artifact at index ${index} contains an invalid system app compiled payload`)
    }

    if (
        parsed.kind === 'system-app-compiled-attribute' &&
        (typeof parsed.tableName !== 'string' ||
            typeof parsed.objectCodename !== 'string' ||
            typeof parsed.attributeCodename !== 'string' ||
            typeof parsed.physicalColumnName !== 'string' ||
            !(
                typeof parsed.targetObjectCodename === 'string' ||
                typeof parsed.targetObjectCodename === 'undefined' ||
                parsed.targetObjectCodename === null
            ) ||
            !(typeof parsed.presentation === 'undefined' || parsed.presentation === null || isRecord(parsed.presentation)) ||
            !(typeof parsed.validationRules === 'undefined' || parsed.validationRules === null || isRecord(parsed.validationRules)) ||
            !(typeof parsed.uiConfig === 'undefined' || parsed.uiConfig === null || isRecord(parsed.uiConfig)) ||
            typeof parsed.dataType !== 'string' ||
            typeof parsed.isRequired !== 'boolean' ||
            typeof parsed.isDisplayAttribute !== 'boolean')
    ) {
        throw new Error(`Definition artifact at index ${index} contains an invalid system app compiled payload`)
    }

    return parsed as unknown as RegisteredSystemAppCompiledImportPayload
}

const assertDefinitionArtifact = (value: unknown, index: number): DefinitionArtifact => {
    if (!value || typeof value !== 'object') {
        throw new Error(`Definition artifact at index ${index} must be an object`)
    }

    const candidate = value as Partial<DefinitionArtifact>
    if (
        typeof candidate.kind !== 'string' ||
        typeof candidate.name !== 'string' ||
        typeof candidate.schemaQualifiedName !== 'string' ||
        typeof candidate.sql !== 'string' ||
        typeof candidate.checksum !== 'string' ||
        !Array.isArray(candidate.dependencies)
    ) {
        throw new Error(`Definition artifact at index ${index} has an invalid shape`)
    }

    if (candidate.kind !== 'custom') {
        throw new Error(`Definition artifact at index ${index} must use kind="custom" for platform imports`)
    }

    const checksum = calculateDefinitionChecksum(candidate.sql)
    if (candidate.checksum !== checksum) {
        throw new Error(`Definition artifact at index ${index} has a checksum mismatch`)
    }

    if (candidate.schemaQualifiedName.startsWith('platform_migration.')) {
        const payload = parsePlatformDefinitionPayload(candidate.sql, index)
        const expectedSchemaQualifiedName = `platform_migration.${payload.scope.kind}.${payload.scope.key}.${payload.id}`
        if (candidate.name !== payload.id) {
            throw new Error(`Definition artifact at index ${index} has a name/payload mismatch`)
        }

        if (candidate.schemaQualifiedName !== expectedSchemaQualifiedName) {
            throw new Error(`Definition artifact at index ${index} has a schemaQualifiedName/payload mismatch`)
        }
    } else if (candidate.schemaQualifiedName.startsWith('system_app_manifest.')) {
        const payload = parseSystemAppManifestPayload(candidate.sql, index)
        const expectedSchemaQualifiedName = `system_app_manifest.${payload.key}`
        if (candidate.name !== payload.key) {
            throw new Error(`Definition artifact at index ${index} has a name/payload mismatch`)
        }

        if (candidate.schemaQualifiedName !== expectedSchemaQualifiedName) {
            throw new Error(`Definition artifact at index ${index} has a schemaQualifiedName/payload mismatch`)
        }
    } else if (candidate.schemaQualifiedName.startsWith('system_app_schema_plan.')) {
        const payload = parseSystemAppSchemaPlanPayload(candidate.sql, index)
        const expectedSchemaQualifiedName = `system_app_schema_plan.${payload.stage}.${payload.definitionKey}`
        if (candidate.name !== payload.definitionKey) {
            throw new Error(`Definition artifact at index ${index} has a name/payload mismatch`)
        }

        if (candidate.schemaQualifiedName !== expectedSchemaQualifiedName) {
            throw new Error(`Definition artifact at index ${index} has a schemaQualifiedName/payload mismatch`)
        }
    } else if (candidate.schemaQualifiedName.startsWith('system_app_compiled.')) {
        const payload = parseSystemAppCompiledPayload(candidate.sql, index)
        let expectedSchemaQualifiedName: string
        let expectedName: string
        switch (payload.kind) {
            case 'system-app-compiled-schema':
                expectedSchemaQualifiedName = `system_app_compiled.schema.${payload.stage}.${payload.definitionKey}.${payload.schemaName}`
                expectedName = payload.definitionKey
                break
            case 'system-app-compiled-table':
                expectedSchemaQualifiedName = `system_app_compiled.table.${payload.stage}.${payload.definitionKey}.${payload.schemaName}.${payload.tableName}`
                expectedName = `${payload.definitionKey}.${payload.tableName}`
                break
            case 'system-app-compiled-object':
                expectedSchemaQualifiedName = `system_app_compiled.object.${payload.stage}.${payload.definitionKey}.${payload.schemaName}.${payload.tableName}`
                expectedName = `${payload.definitionKey}.${payload.tableName}.__object__`
                break
            case 'system-app-compiled-attribute':
                expectedSchemaQualifiedName = `system_app_compiled.attribute.${payload.stage}.${payload.definitionKey}.${payload.schemaName}.${payload.tableName}.${payload.physicalColumnName}`
                expectedName = `${payload.definitionKey}.${payload.tableName}.__attr__.${payload.physicalColumnName}`
                break
        }
        if (candidate.name !== expectedName) {
            throw new Error(`Definition artifact at index ${index} has a name/payload mismatch`)
        }

        if (candidate.schemaQualifiedName !== expectedSchemaQualifiedName) {
            throw new Error(`Definition artifact at index ${index} has a schemaQualifiedName/payload mismatch`)
        }
    } else {
        throw new Error(
            `Definition artifact at index ${index} must target the platform_migration, system_app_manifest, system_app_schema_plan, or system_app_compiled namespace`
        )
    }

    return {
        kind: candidate.kind,
        name: candidate.name,
        schemaQualifiedName: candidate.schemaQualifiedName,
        sql: candidate.sql,
        checksum,
        dependencies: candidate.dependencies.map((dependency: unknown) => String(dependency))
    }
}

export const syncRegisteredPlatformDefinitionsToCatalog = async (
    knex: Knex,
    meta?: Record<string, unknown>
): Promise<RegisteredPlatformDefinitionSyncResult> => {
    assertGlobalMigrationCatalogEnabled()

    const systemAppDefinitionsValidation = validateRegisteredSystemAppDefinitions()
    if (!systemAppDefinitionsValidation.ok) {
        throw new Error(
            `Registered system app definition validation failed: ${systemAppDefinitionsValidation.issues
                .map((issue) => `${issue.definitionKey}: ${issue.message}`)
                .join('; ')}`
        )
    }

    const systemAppSchemaGenerationPlansValidation = validateRegisteredSystemAppSchemaGenerationPlans()
    if (!systemAppSchemaGenerationPlansValidation.ok) {
        throw new Error(
            `Registered system app schema generation plan validation failed: ${systemAppSchemaGenerationPlansValidation.issues.join('; ')}`
        )
    }

    const systemAppCompiledDefinitionsValidation = validateRegisteredSystemAppCompiledDefinitions()
    if (!systemAppCompiledDefinitionsValidation.ok) {
        throw new Error(
            `Registered system app compiled definition validation failed: ${systemAppCompiledDefinitionsValidation.issues.join('; ')}`
        )
    }

    const lint = lintRegisteredPlatformDefinitions()
    if (!lint.ok) {
        throw new Error(`Registered platform definition lint failed: ${lint.issues.join('; ')}`)
    }

    const exportTarget = String(meta?.syncCommand ?? meta?.source ?? 'registered-platform-sync')
    const systemAppManifestLint = lintRegisteredSystemAppManifestDefinitions()
    if (!systemAppManifestLint.ok) {
        throw new Error(`Registered system app manifest lint failed: ${systemAppManifestLint.issues.join('; ')}`)
    }
    const systemAppSchemaPlanLint = lintRegisteredSystemAppSchemaPlanDefinitions()
    if (!systemAppSchemaPlanLint.ok) {
        throw new Error(`Registered system app schema plan lint failed: ${systemAppSchemaPlanLint.issues.join('; ')}`)
    }
    const systemAppCompiledLint = lintRegisteredSystemAppCompiledDefinitions()
    if (!systemAppCompiledLint.ok) {
        throw new Error(`Registered system app compiled definition lint failed: ${systemAppCompiledLint.issues.join('; ')}`)
    }

    const legacyFixedSchemaTables = await inspectLegacyFixedSchemaTables(knex)
    if (!legacyFixedSchemaTables.ok) {
        throw new Error(`Legacy fixed schema tables remain after reconciliation: ${legacyFixedSchemaTables.issues.join('; ')}`)
    }

    const systemAppStructureMetadataInspection = await inspectRegisteredSystemAppStructureMetadata(knex)
    if (!systemAppStructureMetadataInspection.ok) {
        throw new Error(
            `Registered system app structure metadata inspection failed: ${systemAppStructureMetadataInspection.issues.join('; ')}`
        )
    }

    const platformResult = await syncDefinitionArtifactsToCatalog(knex, exportRegisteredPlatformDefinitions(), {
        definitionFamily: registeredPlatformDefinitionFamily,
        provenanceSource: 'registered-platform-definitions',
        exportTarget,
        meta
    })
    const manifestResult = await syncDefinitionArtifactsToCatalog(knex, exportRegisteredSystemAppManifestDefinitions(), {
        definitionFamily: registeredSystemAppManifestDefinitionFamily,
        provenanceSource: 'registered-system-app-manifests',
        exportTarget,
        meta
    })
    const schemaPlanResult = await syncDefinitionArtifactsToCatalog(knex, exportRegisteredSystemAppSchemaPlanDefinitions(), {
        definitionFamily: registeredSystemAppSchemaPlanDefinitionFamily,
        provenanceSource: 'registered-system-app-schema-plans',
        exportTarget,
        meta
    })
    const compiledResult = await syncDefinitionArtifactsToCatalog(knex, exportRegisteredSystemAppCompiledDefinitions(), {
        definitionFamily: registeredSystemAppCompiledDefinitionFamily,
        provenanceSource: 'registered-system-app-compiled-definitions',
        exportTarget,
        meta
    })

    return {
        created: platformResult.created + manifestResult.created + schemaPlanResult.created + compiledResult.created,
        updated: platformResult.updated + manifestResult.updated + schemaPlanResult.updated + compiledResult.updated,
        unchanged: platformResult.unchanged + manifestResult.unchanged + schemaPlanResult.unchanged + compiledResult.unchanged,
        lint,
        legacyFixedSchemaTables,
        systemAppStructureMetadataInspection,
        systemAppDefinitionsValidation,
        systemAppSchemaGenerationPlansValidation,
        systemAppCompiledDefinitionsValidation,
        systemAppManifestLint,
        systemAppSchemaPlanLint,
        systemAppCompiledLint
    }
}

type PlatformDefinitionImportPayload = DefinitionArtifact[] | ReturnType<typeof exportRegisteredPlatformDefinitionBundle>

export const importPlatformDefinitionsFromFile = async (
    knex: Knex,
    filePath: string,
    meta?: Record<string, unknown>
): Promise<RegisteredPlatformDefinitionSyncResult> => {
    assertGlobalMigrationCatalogEnabled()

    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as PlatformDefinitionImportPayload
    const parsedBundle = !Array.isArray(parsed) && parsed?.kind === 'definition_bundle' ? parsed : null
    const rawArtifacts = Array.isArray(parsed) ? parsed : parsedBundle?.artifacts

    if (!Array.isArray(rawArtifacts)) {
        throw new Error('Imported definition bundle must be a JSON array or a definition_bundle object')
    }

    const artifacts = rawArtifacts.map((value, index) => assertDefinitionArtifact(value, index))
    const definitionFamily = inferImportedDefinitionFamily(artifacts)
    const graph = validateDependencyGraph(
        artifacts.map((artifact) => ({
            logicalKey: buildLogicalKey(artifact),
            dependencies: artifact.dependencies
        }))
    )

    if (!graph.ok) {
        throw new Error(`Imported definition bundle is invalid: ${graph.issues.join('; ')}`)
    }

    if (parsedBundle?.meta?.definitionFamily && parsedBundle.meta.definitionFamily !== definitionFamily) {
        throw new Error(
            `Imported definition bundle definitionFamily mismatch: expected "${definitionFamily}", received "${String(
                parsedBundle.meta.definitionFamily
            )}"`
        )
    }

    const result = parsedBundle
        ? await importDefinitionBundle(
              knex,
              {
                  ...parsedBundle,
                  artifacts
              },
              {
                  meta: {
                      definitionFamily,
                      importTarget: filePath,
                      ...(meta ?? {})
                  },
                  provenance: {
                      source: 'imported-definition-bundle',
                      importPath: filePath,
                      importedAt: new Date().toISOString()
                  }
              }
          )
        : await importDefinitions(knex, artifacts, {
              sourceKind: 'file',
              meta: {
                  definitionFamily,
                  importTarget: filePath,
                  ...(meta ?? {})
              },
              provenance: {
                  source: 'imported-definition-bundle',
                  importPath: filePath,
                  importedAt: new Date().toISOString()
              }
          })

    return {
        ...result,
        lint: {
            ok: graph.ok,
            issues: graph.issues,
            orderedKeys: graph.orderedKeys
        }
    }
}

export interface RegisteredPlatformDoctorResult {
    systemAppDefinitionsValidation: ReturnType<typeof validateRegisteredSystemAppDefinitions>
    systemAppSchemaGenerationPlansValidation: ReturnType<typeof validateRegisteredSystemAppSchemaGenerationPlans>
    systemAppCompiledDefinitionsValidation?: ReturnType<typeof validateRegisteredSystemAppCompiledDefinitions>
    legacyFixedSchemaTables: LegacyFixedSchemaTablesInspection
    systemAppStructureMetadataInspection: Awaited<ReturnType<typeof inspectRegisteredSystemAppStructureMetadata>>
    migrationsValidation: ReturnType<typeof validateRegisteredPlatformMigrations>
    definitionsLint: RegisteredPlatformDefinitionLintResult
    definitionsDiff: RegisteredPlatformDefinitionDiffEntry[]
    systemAppManifestLint: RegisteredPlatformDefinitionLintResult
    systemAppManifestDiff: RegisteredPlatformDefinitionDiffEntry[]
    systemAppSchemaPlanLint: RegisteredPlatformDefinitionLintResult
    systemAppSchemaPlanDiff: RegisteredPlatformDefinitionDiffEntry[]
    systemAppCompiledLint: RegisteredPlatformDefinitionLintResult
    systemAppCompiledDiff: RegisteredPlatformDefinitionDiffEntry[]
    migrationPlan: Awaited<ReturnType<typeof planRegisteredPlatformMigrations>>
    catalogLifecycle: RegisteredPlatformCatalogLifecycleHealth
    systemAppManifestCatalogLifecycle: RegisteredPlatformCatalogLifecycleHealth
    systemAppSchemaPlanCatalogLifecycle: RegisteredPlatformCatalogLifecycleHealth
    systemAppCompiledCatalogLifecycle: RegisteredPlatformCatalogLifecycleHealth
}

const inspectDefinitionCatalogLifecycle = async (
    knex: Knex,
    desired: DefinitionArtifact[],
    exportTarget: string
): Promise<RegisteredPlatformCatalogLifecycleHealth> => {
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return {
            ok: false,
            storageReady: false,
            exportTarget,
            registeredCount: 0,
            activeRevisionCount: 0,
            publishedLifecycleCount: 0,
            exportCount: 0,
            missingRegistryKeys: desired.map((artifact) => buildLogicalKey(artifact)),
            missingPublishedLifecycleKeys: desired.map((artifact) => buildLogicalKey(artifact)),
            missingExportKeys: desired.map((artifact) => buildLogicalKey(artifact))
        }
    }

    const desiredKeys = new Set(desired.map((artifact) => buildLogicalKey(artifact)))

    const missingRegistryKeys: string[] = []
    const missingPublishedLifecycleKeys: string[] = []
    const missingExportKeys: string[] = []
    let registeredCount = 0
    let activeRevisionCount = 0
    let publishedLifecycleCount = 0
    let exportCount = 0

    for (const logicalKey of desiredKeys) {
        const record = await getDefinitionByLogicalKey(knex, logicalKey)
        if (!record) {
            missingRegistryKeys.push(logicalKey)
            missingExportKeys.push(logicalKey)
            continue
        }

        registeredCount += 1
        const revision = await getActiveRevision(knex, record.id)
        if (!revision) {
            missingPublishedLifecycleKeys.push(logicalKey)
            missingExportKeys.push(logicalKey)
            continue
        }

        activeRevisionCount += 1
        if (revision.provenance?.reviewState !== 'published') {
            missingPublishedLifecycleKeys.push(logicalKey)
        } else {
            publishedLifecycleCount += 1
        }

        const exports =
            exportTarget === anyRegisteredPlatformLifecycleExportTarget
                ? await listDefinitionExports(knex, {
                      registryId: record.id,
                      revisionId: revision.id,
                      limit: 1
                  })
                : await listDefinitionExports(knex, {
                      registryId: record.id,
                      revisionId: revision.id,
                      exportTarget,
                      limit: 1
                  })
        if (exports.length === 0) {
            missingExportKeys.push(logicalKey)
            continue
        }

        exportCount += 1
    }

    return {
        ok: missingRegistryKeys.length === 0 && missingPublishedLifecycleKeys.length === 0 && missingExportKeys.length === 0,
        storageReady: true,
        exportTarget,
        registeredCount,
        activeRevisionCount,
        publishedLifecycleCount,
        exportCount,
        missingRegistryKeys,
        missingPublishedLifecycleKeys,
        missingExportKeys
    }
}

const inspectRegisteredPlatformCatalogLifecycle = async (knex: Knex): Promise<RegisteredPlatformCatalogLifecycleHealth> =>
    inspectDefinitionCatalogLifecycle(knex, exportRegisteredPlatformDefinitions(), anyRegisteredPlatformLifecycleExportTarget)

const inspectRegisteredSystemAppManifestCatalogLifecycle = async (knex: Knex): Promise<RegisteredPlatformCatalogLifecycleHealth> =>
    inspectDefinitionCatalogLifecycle(knex, exportRegisteredSystemAppManifestDefinitions(), anyRegisteredPlatformLifecycleExportTarget)

const inspectRegisteredSystemAppSchemaPlanCatalogLifecycle = async (knex: Knex): Promise<RegisteredPlatformCatalogLifecycleHealth> =>
    inspectDefinitionCatalogLifecycle(knex, exportRegisteredSystemAppSchemaPlanDefinitions(), anyRegisteredPlatformLifecycleExportTarget)

const inspectRegisteredSystemAppCompiledCatalogLifecycle = async (knex: Knex): Promise<RegisteredPlatformCatalogLifecycleHealth> =>
    inspectDefinitionCatalogLifecycle(knex, exportRegisteredSystemAppCompiledDefinitions(), anyRegisteredPlatformLifecycleExportTarget)

export const doctorRegisteredPlatformState = async (knex: Knex): Promise<RegisteredPlatformDoctorResult> => ({
    systemAppDefinitionsValidation: validateRegisteredSystemAppDefinitions(),
    systemAppSchemaGenerationPlansValidation: validateRegisteredSystemAppSchemaGenerationPlans(),
    systemAppCompiledDefinitionsValidation: validateRegisteredSystemAppCompiledDefinitions(),
    legacyFixedSchemaTables: await inspectLegacyFixedSchemaTables(knex),
    systemAppStructureMetadataInspection: await inspectRegisteredSystemAppStructureMetadata(knex),
    migrationsValidation: validateRegisteredPlatformMigrations(),
    definitionsLint: lintRegisteredPlatformDefinitions(),
    definitionsDiff: await diffRegisteredPlatformDefinitions(knex),
    systemAppManifestLint: lintRegisteredSystemAppManifestDefinitions(),
    systemAppManifestDiff: await diffRegisteredSystemAppManifestDefinitions(knex),
    systemAppSchemaPlanLint: lintRegisteredSystemAppSchemaPlanDefinitions(),
    systemAppSchemaPlanDiff: await diffRegisteredSystemAppSchemaPlanDefinitions(knex),
    systemAppCompiledLint: lintRegisteredSystemAppCompiledDefinitions(),
    systemAppCompiledDiff: await diffRegisteredSystemAppCompiledDefinitions(knex),
    migrationPlan: await planRegisteredPlatformMigrations(knex),
    catalogLifecycle: await inspectRegisteredPlatformCatalogLifecycle(knex),
    systemAppManifestCatalogLifecycle: await inspectRegisteredSystemAppManifestCatalogLifecycle(knex),
    systemAppSchemaPlanCatalogLifecycle: await inspectRegisteredSystemAppSchemaPlanCatalogLifecycle(knex),
    systemAppCompiledCatalogLifecycle: await inspectRegisteredSystemAppCompiledCatalogLifecycle(knex)
})

export const runRegisteredPlatformMigrations = async (knex: Knex, logger?: MigrationLogger) => {
    const catalog = createPlatformMigrationRepository(knex)
    return runPlatformMigrations({
        knex,
        migrations: platformMigrations,
        catalog,
        logger
    })
}

export const runRegisteredPlatformPreludeMigrations = async (knex: Knex, logger?: MigrationLogger) => {
    const catalog = createPlatformMigrationRepository(knex)
    return runPlatformMigrations({
        knex,
        migrations: platformPreludeMigrations,
        catalog,
        logger
    })
}

export const runRegisteredPlatformPostSchemaMigrations = async (knex: Knex, logger?: MigrationLogger) => {
    const catalog = createPlatformMigrationRepository(knex)
    return runPlatformMigrations({
        knex,
        migrations: platformPostSchemaMigrations,
        catalog,
        logger
    })
}

export const planRegisteredPlatformMigrations = async (knex: Knex, logger?: MigrationLogger) => {
    const catalog = createPlatformMigrationRepository(knex)
    return runPlatformMigrations({
        knex,
        migrations: platformMigrations,
        catalog,
        logger,
        dryRun: true
    })
}

export const planRegisteredPlatformMigrationsForPhases = async (
    knex: Knex,
    phases: readonly SystemAppMigrationBootstrapPhase[],
    logger?: MigrationLogger
) => {
    const catalog = createPlatformMigrationRepository(knex)
    return runPlatformMigrations({
        knex,
        migrations: loadPlatformMigrationsFromSystemApps(systemAppDefinitions, phases),
        catalog,
        logger,
        dryRun: true
    })
}
