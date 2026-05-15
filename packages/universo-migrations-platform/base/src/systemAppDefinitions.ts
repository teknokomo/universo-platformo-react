import type {
    PlatformMigrationFile,
    SystemAppBusinessTableDefinition,
    SystemAppDefinition,
    SystemAppMigrationEntry,
    SystemTableCapabilityOptions
} from '@universo/migrations-core'
import {
    assertCanonicalPlatformScopeKey,
    assertCanonicalSchemaName,
    resolveSystemAppDefinitionSystemTableCapabilities,
    sortPlatformMigrations,
    validateSystemAppDefinitions
} from '@universo/migrations-core'
import { createPlatformMigrationFromSqlDefinition } from './sqlAdapter'
import { optimizeRlsPoliciesMigration } from './rlsPolicyOptimization'

const { adminSystemAppDefinition } = require('@universo/admin-backend/platform-definition') as {
    adminSystemAppDefinition: SystemAppDefinition
}

const { profileSystemAppDefinition } = require('@universo/profile-backend/platform-definition') as {
    profileSystemAppDefinition: SystemAppDefinition
}

const { metahubsSystemAppDefinition } = require('@universo/metahubs-backend/platform-definition') as {
    metahubsSystemAppDefinition: SystemAppDefinition
}

const { applicationsSystemAppDefinition } = require('@universo/applications-backend/platform-definition') as {
    applicationsSystemAppDefinition: SystemAppDefinition
}

const { startSystemAppDefinition } = require('@universo/start-backend/platform-definition') as {
    startSystemAppDefinition: SystemAppDefinition
}

const uuidV7FunctionSql = `
    CREATE OR REPLACE FUNCTION public.uuid_generate_v7() RETURNS uuid AS $$
    DECLARE
        unix_ts_ms BIGINT;
        uuid_bytes BYTEA;
    BEGIN
        unix_ts_ms = FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
        uuid_bytes = gen_random_bytes(16);
        uuid_bytes = SET_BYTE(uuid_bytes, 0, GET_BYTE(INT8SEND(unix_ts_ms), 2));
        uuid_bytes = SET_BYTE(uuid_bytes, 1, GET_BYTE(INT8SEND(unix_ts_ms), 3));
        uuid_bytes = SET_BYTE(uuid_bytes, 2, GET_BYTE(INT8SEND(unix_ts_ms), 4));
        uuid_bytes = SET_BYTE(uuid_bytes, 3, GET_BYTE(INT8SEND(unix_ts_ms), 5));
        uuid_bytes = SET_BYTE(uuid_bytes, 4, GET_BYTE(INT8SEND(unix_ts_ms), 6));
        uuid_bytes = SET_BYTE(uuid_bytes, 5, GET_BYTE(INT8SEND(unix_ts_ms), 7));
        uuid_bytes = SET_BYTE(uuid_bytes, 6, (GET_BYTE(uuid_bytes, 6) & B'00001111'::INT) | B'01110000'::INT);
        uuid_bytes = SET_BYTE(uuid_bytes, 8, (GET_BYTE(uuid_bytes, 8) & B'00111111'::INT) | B'10000000'::INT);
        RETURN ENCODE(uuid_bytes, 'hex')::UUID;
    END;
    $$ LANGUAGE plpgsql VOLATILE;
`

const uuidV7FunctionCommentSql = `
    COMMENT ON FUNCTION public.uuid_generate_v7() IS
    'Generates RFC 9562 compliant UUID v7 (time-ordered). First 48 bits contain Unix timestamp in milliseconds for better index locality. Compatible with PostgreSQL 18+ native uuidv7() function. Performance: ~30-50% faster indexing vs UUID v4 due to sequential nature.';
`

const initializeUuidV7FunctionMigration: PlatformMigrationFile = {
    id: 'InitializeUuidV7Function1500000000000',
    version: '1500000000000',
    scope: {
        kind: 'platform_schema',
        key: 'public'
    },
    sourceKind: 'file',
    transactionMode: 'single',
    lockMode: 'transaction_advisory',
    summary: 'Initialize public.uuid_generate_v7() function',
    async up(ctx) {
        await ctx.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto')
        await ctx.raw(uuidV7FunctionSql)
        await ctx.raw(uuidV7FunctionCommentSql)
    },
    async down(ctx) {
        await ctx.raw('DROP FUNCTION IF EXISTS public.uuid_generate_v7()')
    }
}

const repairUuidV7PgcryptoDependencyMigration: PlatformMigrationFile = {
    id: 'RepairUuidV7PgcryptoDependency1500000000001',
    version: '1500000000001',
    scope: {
        kind: 'platform_schema',
        key: 'public'
    },
    sourceKind: 'file',
    transactionMode: 'single',
    lockMode: 'transaction_advisory',
    summary: 'Ensure pgcrypto exists and refresh public.uuid_generate_v7() for partially bootstrapped databases',
    async up(ctx) {
        await ctx.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto')
        await ctx.raw(uuidV7FunctionSql)
        await ctx.raw(uuidV7FunctionCommentSql)
    }
}

export const publicSystemAppDefinition: SystemAppDefinition = {
    manifestVersion: 1,
    key: 'public',
    displayName: 'Public',
    ownerPackage: '@universo/migrations-platform',
    engineVersion: '0.1.0',
    structureVersion: '0.1.0',
    configurationVersion: '0.1.0',
    schemaTarget: {
        kind: 'fixed',
        schemaName: 'public'
    },
    runtimeCapabilities: {
        supportsPublicationSync: false,
        supportsTemplateVersions: false,
        usesCurrentUiShell: 'universo-template-mui'
    },
    currentStorageModel: 'legacy_fixed',
    targetStorageModel: 'legacy_fixed',
    currentStructureCapabilities: {
        appCoreTables: false,
        objectTables: false,
        documentTables: false,
        relationTables: false,
        settingsTables: false,
        layoutTables: false,
        widgetTables: false,
       componentValueTables: false
    },
    targetStructureCapabilities: {
        appCoreTables: false,
        objectTables: false,
        documentTables: false,
        relationTables: false,
        settingsTables: false,
        layoutTables: false,
        widgetTables: false,
       componentValueTables: false
    },
    currentBusinessTables: [],
    targetBusinessTables: [],
    summary: 'Fixed-schema platform definition for public bootstrap helpers',
    migrations: [
        {
            kind: 'file',
            migration: initializeUuidV7FunctionMigration
        },
        {
            kind: 'file',
            migration: repairUuidV7PgcryptoDependencyMigration
        },
        {
            kind: 'file',
            migration: optimizeRlsPoliciesMigration,
            bootstrapPhase: 'post_schema_generation'
        }
    ],
    repeatableSeeds: []
}

export const systemAppDefinitions: SystemAppDefinition[] = [
    publicSystemAppDefinition,
    adminSystemAppDefinition,
    profileSystemAppDefinition,
    metahubsSystemAppDefinition,
    applicationsSystemAppDefinition,
    startSystemAppDefinition
]

export const validateRegisteredSystemAppDefinitions = (definitions: readonly SystemAppDefinition[] = systemAppDefinitions) =>
    validateSystemAppDefinitions(definitions)

export const resolveSystemAppSystemTableCapabilities = (definition: SystemAppDefinition, stage: 'current' | 'target' = 'target') =>
    resolveSystemAppDefinitionSystemTableCapabilities(definition, stage)

export interface SystemAppSchemaGenerationPlan {
    definitionKey: string
    displayName: string
    schemaName: string
    stage: 'current' | 'target'
    storageModel: SystemAppDefinition['currentStorageModel'] | SystemAppDefinition['targetStorageModel']
    structureVersion: string
    configurationVersion: string
    structureCapabilities: SystemAppDefinition['currentStructureCapabilities'] | SystemAppDefinition['targetStructureCapabilities']
    systemTableCapabilities: Required<SystemTableCapabilityOptions>
    businessTables: readonly SystemAppBusinessTableDefinition[]
}

export type SystemAppMigrationBootstrapPhase = 'standalone' | 'pre_schema_generation' | 'post_schema_generation'

const resolveFixedSchemaTarget = (definition: SystemAppDefinition): string => {
    if (definition.schemaTarget.kind !== 'fixed') {
        throw new Error(`System app schema generation plans currently support only fixed schema targets: ${definition.key}`)
    }

    return definition.schemaTarget.schemaName
}

export const buildSystemAppSchemaGenerationPlan = (
    definition: SystemAppDefinition,
    stage: 'current' | 'target' = 'target'
): SystemAppSchemaGenerationPlan => ({
    definitionKey: definition.key,
    displayName: definition.displayName,
    schemaName: resolveFixedSchemaTarget(definition),
    stage,
    storageModel: stage === 'current' ? definition.currentStorageModel : definition.targetStorageModel,
    structureVersion: definition.structureVersion,
    configurationVersion: definition.configurationVersion,
    structureCapabilities: stage === 'current' ? definition.currentStructureCapabilities : definition.targetStructureCapabilities,
    systemTableCapabilities: resolveSystemAppSystemTableCapabilities(definition, stage),
    businessTables: stage === 'current' ? definition.currentBusinessTables : definition.targetBusinessTables
})

export const findRegisteredSystemAppDefinition = (key: string): SystemAppDefinition | null =>
    systemAppDefinitions.find((definition) => definition.key === key) ?? null

export const resolveRegisteredSystemAppSystemTableCapabilities = (key: string, stage: 'current' | 'target' = 'target') => {
    const definition = findRegisteredSystemAppDefinition(key)
    if (!definition) {
        throw new Error(`Unknown registered system app definition key: ${key}`)
    }

    return resolveSystemAppSystemTableCapabilities(definition, stage)
}

export const buildRegisteredSystemAppSchemaGenerationPlan = (key: string, stage: 'current' | 'target' = 'target') => {
    const definition = findRegisteredSystemAppDefinition(key)
    if (!definition) {
        throw new Error(`Unknown registered system app definition key: ${key}`)
    }

    return buildSystemAppSchemaGenerationPlan(definition, stage)
}

export interface RegisteredSystemAppSchemaGenerationPlanValidationResult {
    ok: boolean
    issues: string[]
    plans: SystemAppSchemaGenerationPlan[]
}

export const validateRegisteredSystemAppSchemaGenerationPlans = (
    definitions: readonly SystemAppDefinition[] = systemAppDefinitions,
    stage: 'current' | 'target' = 'target'
): RegisteredSystemAppSchemaGenerationPlanValidationResult => {
    const issues: string[] = []
    const plans: SystemAppSchemaGenerationPlan[] = []

    for (const definition of definitions) {
        try {
            plans.push(buildSystemAppSchemaGenerationPlan(definition, stage))
        } catch (error) {
            issues.push(`${definition.key}: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    return {
        ok: issues.length === 0,
        issues,
        plans
    }
}

export const exportRegisteredSystemAppSchemaGenerationPlans = (stage: 'current' | 'target' = 'target'): SystemAppSchemaGenerationPlan[] =>
    validateRegisteredSystemAppSchemaGenerationPlans(systemAppDefinitions, stage).plans

const assertUniqueSystemAppKeys = (definitions: readonly SystemAppDefinition[]): void => {
    const seen = new Set<string>()

    for (const definition of definitions) {
        if (seen.has(definition.key)) {
            throw new Error(`Duplicate system app definition key: ${definition.key}`)
        }

        seen.add(definition.key)
    }
}

const resolveSystemAppScopeKey = (definition: SystemAppDefinition): string => {
    if (definition.schemaTarget.kind !== 'fixed') {
        throw new Error(`Unsupported schema target for system app ${definition.key}`)
    }

    assertCanonicalSchemaName(definition.schemaTarget.schemaName)
    assertCanonicalPlatformScopeKey(definition.schemaTarget.schemaName)
    return definition.schemaTarget.schemaName
}

const createPlatformMigrationFromEntry = (definition: SystemAppDefinition, entry: SystemAppMigrationEntry): PlatformMigrationFile => {
    const scopeKey = resolveSystemAppScopeKey(definition)

    if (entry.kind === 'file') {
        return entry.migration
    }

    return createPlatformMigrationFromSqlDefinition(entry.definition, scopeKey)
}

const resolveSystemAppMigrationBootstrapPhase = (entry: SystemAppMigrationEntry): SystemAppMigrationBootstrapPhase =>
    entry.bootstrapPhase ?? 'standalone'

export const loadPlatformMigrationsFromSystemApps = (
    definitions: readonly SystemAppDefinition[] = systemAppDefinitions,
    phases?: readonly SystemAppMigrationBootstrapPhase[]
): PlatformMigrationFile[] => {
    assertUniqueSystemAppKeys(definitions)

    const validation = validateRegisteredSystemAppDefinitions(definitions)
    if (!validation.ok) {
        throw new Error(validation.issues.map((issue) => `${issue.definitionKey}: ${issue.message}`).join('; '))
    }

    return sortPlatformMigrations(
        definitions.flatMap((definition) =>
            definition.migrations
                .filter((entry) => !phases || phases.includes(resolveSystemAppMigrationBootstrapPhase(entry)))
                .map((entry) => createPlatformMigrationFromEntry(definition, entry))
        )
    )
}
