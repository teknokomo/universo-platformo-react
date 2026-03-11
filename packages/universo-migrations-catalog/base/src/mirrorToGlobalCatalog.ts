import type { MirrorToGlobalCatalogInput } from '@universo/migrations-core'
import { recordAppliedMigrationRun } from './PlatformMigrationCatalog'

/**
 * Mirror a runtime migration event to the global `upl_migrations` catalog.
 *
 * This is the single normalised entry point that both metahub and application
 * runtime flows should use instead of calling `recordAppliedMigrationRun()`
 * directly.  It enforces the convention of merging `localHistoryTable` into the
 * catalog `meta` field so every recorded run can be traced back to its
 * per-schema history table.
 *
 * @returns The global catalog run ID (UUID v7).
 */
export async function mirrorToGlobalCatalog(input: MirrorToGlobalCatalogInput): Promise<string> {
    return recordAppliedMigrationRun({
        knex: input.knex,
        scopeKind: input.scopeKind,
        scopeKey: input.scopeKey,
        sourceKind: input.sourceKind,
        migrationName: input.migrationName,
        migrationVersion: input.migrationVersion,
        summary: input.summary,
        transactionMode: input.transactionMode ?? 'single',
        lockMode: input.lockMode ?? 'session_advisory',
        checksumPayload: input.checksumPayload,
        meta: {
            localHistoryTable: input.localHistoryTable,
            ...(input.meta ?? {})
        },
        snapshotBefore: input.snapshotBefore ?? null,
        snapshotAfter: input.snapshotAfter ?? null,
        plan: input.plan ?? null
    })
}
