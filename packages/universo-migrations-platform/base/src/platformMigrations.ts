import type { MigrationExecutionContext, PlatformMigrationFile } from '@universo/migrations-core'
import { runPlatformMigrations, validatePlatformMigrations, type MigrationLogger } from '@universo/migrations-core'
import type { DefinitionArtifact } from '@universo/migrations-catalog'
import { PlatformMigrationCatalog, createDefinitionArtifact, exportDefinitions, getActiveRevision, listDefinitions, recordDefinitionExport } from '@universo/migrations-catalog'
import type { Knex } from 'knex'
import { createPlatformMigrationFromSqlDefinition } from './sqlAdapter'
import { optimizeRlsPoliciesMigration } from './rlsPolicyOptimization'

const { createAdminSchemaMigrationDefinition, addCodenameAutoConvertMixedSettingMigrationDefinition, addAdminSoftDeleteColumnsMigrationDefinition } = require('@universo/admin-backend') as {
    createAdminSchemaMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
    addCodenameAutoConvertMixedSettingMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
    addAdminSoftDeleteColumnsMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
}
const {
    addProfileMigrationDefinition,
    addOnboardingCompletedMigrationDefinition,
    addConsentFieldsMigrationDefinition,
    updateProfileTriggerMigrationDefinition
} = require('@universo/profile-backend') as {
    addProfileMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
    addOnboardingCompletedMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
    addConsentFieldsMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
    updateProfileTriggerMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
}
const { createMetahubsSchemaMigrationDefinition, addTemplateDefinitionTypeMigrationDefinition } = require('@universo/metahubs-backend') as {
    createMetahubsSchemaMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
    addTemplateDefinitionTypeMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
}
const { createApplicationsSchemaMigrationDefinition } = require('@universo/applications-backend') as {
    createApplicationsSchemaMigrationDefinition: import('./sqlAdapter').SqlPlatformMigrationDefinition
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
    async up(ctx: MigrationExecutionContext) {
        await ctx.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto')
        await ctx.raw(uuidV7FunctionSql)
        await ctx.raw(uuidV7FunctionCommentSql)
    },
    async down(ctx: MigrationExecutionContext) {
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
    async up(ctx: MigrationExecutionContext) {
        await ctx.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto')
        await ctx.raw(uuidV7FunctionSql)
        await ctx.raw(uuidV7FunctionCommentSql)
    }
}

export const platformMigrations: PlatformMigrationFile[] = [
    initializeUuidV7FunctionMigration,
    repairUuidV7PgcryptoDependencyMigration,
    createPlatformMigrationFromSqlDefinition(createAdminSchemaMigrationDefinition, 'admin'),
    createPlatformMigrationFromSqlDefinition(addCodenameAutoConvertMixedSettingMigrationDefinition, 'admin'),
    createPlatformMigrationFromSqlDefinition(addProfileMigrationDefinition, 'profile'),
    createPlatformMigrationFromSqlDefinition(addOnboardingCompletedMigrationDefinition, 'profile'),
    createPlatformMigrationFromSqlDefinition(addConsentFieldsMigrationDefinition, 'profile'),
    createPlatformMigrationFromSqlDefinition(updateProfileTriggerMigrationDefinition, 'profile'),
    createPlatformMigrationFromSqlDefinition(createMetahubsSchemaMigrationDefinition, 'metahubs'),
    createPlatformMigrationFromSqlDefinition(addTemplateDefinitionTypeMigrationDefinition, 'metahubs'),
    createPlatformMigrationFromSqlDefinition(createApplicationsSchemaMigrationDefinition, 'applications'),
    createPlatformMigrationFromSqlDefinition(addAdminSoftDeleteColumnsMigrationDefinition, 'admin'),
    optimizeRlsPoliciesMigration
]

export const validateRegisteredPlatformMigrations = () => validatePlatformMigrations(platformMigrations)

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
        checksumSource: migration.checksumSource ?? null
    })

const buildRegisteredDefinitionArtifact = (migration: PlatformMigrationFile): DefinitionArtifact =>
    createDefinitionArtifact({
        kind: 'custom',
        name: migration.id,
        schemaQualifiedName: `platform_migration.${migration.scope.kind}.${migration.scope.key}.${migration.id}`,
        sql: buildRegisteredDefinitionPayload(migration),
        dependencies: []
    })

export const exportRegisteredPlatformDefinitions = (): DefinitionArtifact[] =>
    platformMigrations.map((migration) => buildRegisteredDefinitionArtifact(migration))

export interface RegisteredPlatformDefinitionDiffEntry {
    logicalKey: string
    status: 'match' | 'missing_in_catalog' | 'checksum_mismatch' | 'catalog_only'
    desiredChecksum: string | null
    actualChecksum: string | null
}

export const diffRegisteredPlatformDefinitions = async (knex: Knex): Promise<RegisteredPlatformDefinitionDiffEntry[]> => {
    const desiredArtifacts = exportRegisteredPlatformDefinitions()
    const desiredByKey = new Map(desiredArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact]))
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
    const catalogByKey = new Map(catalogArtifacts.map((artifact) => [`${artifact.schemaQualifiedName}::${artifact.kind}`, artifact]))
    const keys = Array.from(new Set([...desiredByKey.keys(), ...catalogByKey.keys()])).sort((left, right) => left.localeCompare(right))

    return keys.map((logicalKey) => {
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

export const exportCatalogPlatformDefinitions = async (
    knex: Knex,
    exportTarget = 'stdout'
): Promise<DefinitionArtifact[]> => {
    const catalog = new PlatformMigrationCatalog(knex)

    if (!(await catalog.isStorageReady())) {
        return []
    }

    const artifacts = await exportDefinitions(knex, { logicalKeyPrefix: 'platform_migration.' })
    const { records } = await listDefinitions(knex, {
        logicalKeyPrefix: 'platform_migration.',
        limit: Math.max(artifacts.length, 1)
    })

    for (const record of records) {
        const revision = await getActiveRevision(knex, record.id)
        await recordDefinitionExport(knex, {
            registryId: record.id,
            revisionId: revision?.id ?? null,
            exportTarget,
            fileChecksum: revision?.checksum ?? null,
            meta: {
                exportedAt: new Date().toISOString()
            }
        })
    }

    return artifacts
}

export const runRegisteredPlatformMigrations = async (knex: Knex, logger?: MigrationLogger) => {
    const catalog = new PlatformMigrationCatalog(knex)
    return runPlatformMigrations({
        knex,
        migrations: platformMigrations,
        catalog,
        logger
    })
}

export const planRegisteredPlatformMigrations = async (knex: Knex, logger?: MigrationLogger) => {
    const catalog = new PlatformMigrationCatalog(knex)
    return runPlatformMigrations({
        knex,
        migrations: platformMigrations,
        catalog,
        logger,
        dryRun: true
    })
}
