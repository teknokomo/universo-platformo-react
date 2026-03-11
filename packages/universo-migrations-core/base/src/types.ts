import type { Knex } from 'knex'

export type MigrationTransactionMode = 'single' | 'per_migration' | 'none'
export type MigrationLockMode = 'transaction_advisory' | 'session_advisory' | 'none'
export type MigrationRunStatus = 'planned' | 'applied' | 'skipped' | 'blocked' | 'drifted' | 'failed' | 'rolled_forward'
export type MigrationScopeKind = 'platform_schema' | 'runtime_schema' | 'template' | 'publication' | 'application_sync' | 'metahub_sync'

export type MigrationSourceKind = 'file' | 'declarative' | 'system_sync' | 'template_seed' | 'publication_snapshot'

export interface MigrationScope {
    kind: MigrationScopeKind
    key: string
}

export interface MigrationLogger {
    info(message: string, meta?: Record<string, unknown>): void
    warn(message: string, meta?: Record<string, unknown>): void
    error(message: string, meta?: Record<string, unknown>): void
}

export interface MigrationExecutionContext {
    knex: Knex | Knex.Transaction
    logger: MigrationLogger
    scope: MigrationScope
    runId: string
    raw(sql: string, bindings?: readonly unknown[]): Promise<unknown>
}

export interface PlatformMigrationFile {
    id: string
    version: string
    scope: MigrationScope
    sourceKind?: MigrationSourceKind
    checksumSource?: string
    transactionMode?: MigrationTransactionMode
    lockMode?: MigrationLockMode
    summary?: string
    isDestructive?: boolean
    requiresReview?: boolean
    up(ctx: MigrationExecutionContext): Promise<void>
    down?: (ctx: MigrationExecutionContext) => Promise<void>
}

export interface MigrationCatalogRecord {
    id: string
    scopeKind: MigrationScopeKind
    scopeKey: string
    sourceKind: MigrationSourceKind
    migrationName: string
    migrationVersion: string
    checksum: string
    transactionMode: MigrationTransactionMode
    lockMode: MigrationLockMode
    status: MigrationRunStatus
    summary: string | null
    meta: Record<string, unknown> | null
    snapshotBefore: Record<string, unknown> | null
    snapshotAfter: Record<string, unknown> | null
    plan: Record<string, unknown> | null
    error: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
}

export interface MigrationCatalogRepository {
    ensureStorage(): Promise<void>
    isStorageReady?(): Promise<boolean>
    findLatest(scope: MigrationScope, migration: PlatformMigrationFile): Promise<MigrationCatalogRecord | null>
    beginRun(input: {
        migration: PlatformMigrationFile
        checksum: string
        summary?: string | null
        meta?: Record<string, unknown> | null
        status?: MigrationRunStatus
    }): Promise<MigrationCatalogRecord>
    completeRun(
        runId: string,
        patch: {
            status: MigrationRunStatus
            error?: Record<string, unknown> | null
            meta?: Record<string, unknown> | null
            snapshotBefore?: Record<string, unknown> | null
            snapshotAfter?: Record<string, unknown> | null
            plan?: Record<string, unknown> | null
        }
    ): Promise<void>
}

export interface MigrationValidationIssue {
    level: 'error' | 'warning'
    migrationId: string
    message: string
}

export interface MigrationValidationResult {
    ok: boolean
    issues: MigrationValidationIssue[]
}

export interface RunPlatformMigrationsOptions {
    knex: Knex
    migrations: PlatformMigrationFile[]
    catalog: MigrationCatalogRepository
    logger?: MigrationLogger
    allowDestructive?: boolean
    allowReviewRequired?: boolean
    dryRun?: boolean
    prepareCatalogStorage?: boolean
}

export type PlannedPlatformMigrationAction = 'apply' | 'skip' | 'drift' | 'blocked'

export interface PlannedPlatformMigration {
    id: string
    version: string
    scopeKind: MigrationScopeKind
    scopeKey: string
    checksum: string
    summary: string | null
    action: PlannedPlatformMigrationAction
    reason: string | null
    existingRunId: string | null
    existingStatus: MigrationRunStatus | null
    existingChecksum: string | null
}

export interface RunPlatformMigrationsResult {
    dryRun: boolean
    applied: string[]
    skipped: string[]
    drifted: string[]
    blocked: string[]
    planned: PlannedPlatformMigration[]
}

// ═══════════════════════════════════════════════════════════════════════
// Runtime migration history — shared contract for local per-schema tables
// (_mhb_migrations, _app_migrations, etc.)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Common shape of a runtime migration history record stored in a
 * per-schema local history table (_mhb_migrations / _app_migrations).
 *
 * Domain-specific columns (from_version, publication_snapshot, …)
 * are NOT part of this interface — they live in the domain packages.
 */
export interface RuntimeMigrationHistoryRecord {
    id: string
    name: string
    appliedAt: Date
    meta: Record<string, unknown>
}

/**
 * Input for the `mirrorToGlobalCatalog()` helper that records a runtime
 * migration event in the central `upl_migrations` catalog.
 */
export interface MirrorToGlobalCatalogInput {
    knex: Knex | Knex.Transaction
    scopeKind: MigrationScopeKind
    scopeKey: string
    sourceKind: MigrationSourceKind
    migrationName: string
    migrationVersion: string
    localHistoryTable: string
    summary?: string | null
    transactionMode?: MigrationTransactionMode
    lockMode?: MigrationLockMode
    checksumPayload?: unknown
    meta?: Record<string, unknown> | null
    snapshotBefore?: Record<string, unknown> | null
    snapshotAfter?: Record<string, unknown> | null
    plan?: Record<string, unknown> | null
}
