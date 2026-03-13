import type { Knex } from 'knex'
import type {
    MigrationCatalogRecord,
    MigrationCatalogRepository,
    MigrationLockMode,
    MigrationRunStatus,
    MigrationScopeKind,
    MigrationSourceKind,
    MigrationTransactionMode,
    MigrationExecutionContext,
    MigrationScope,
    PlatformMigrationFile
} from '@universo/migrations-core'
import { calculateMigrationChecksum, createMigrationRunId as createRunId } from '@universo/migrations-core'
import stableStringify from 'json-stable-stringify'
import { catalogBootstrapMigrations } from './catalogBootstrapMigrations'

type MigrationRunRow = {
    id: string
    scope_kind: MigrationCatalogRecord['scopeKind']
    scope_key: string
    source_kind: MigrationCatalogRecord['sourceKind']
    migration_name: string
    migration_version: string
    checksum: string
    transaction_mode: string
    lock_mode: string
    status: MigrationRunStatus
    summary: string | null
    meta: Record<string, unknown> | null
    snapshot_before: Record<string, unknown> | null
    snapshot_after: Record<string, unknown> | null
    plan: Record<string, unknown> | null
    error: Record<string, unknown> | null
    _upl_created_at: string
    _upl_updated_at: string
}

const mapRow = (row: MigrationRunRow): MigrationCatalogRecord => ({
    id: row.id,
    scopeKind: row.scope_kind,
    scopeKey: row.scope_key,
    sourceKind: row.source_kind,
    migrationName: row.migration_name,
    migrationVersion: row.migration_version,
    checksum: row.checksum,
    transactionMode: row.transaction_mode as MigrationCatalogRecord['transactionMode'],
    lockMode: row.lock_mode as MigrationCatalogRecord['lockMode'],
    status: row.status,
    summary: row.summary,
    meta: row.meta,
    snapshotBefore: row.snapshot_before,
    snapshotAfter: row.snapshot_after,
    plan: row.plan,
    error: row.error,
    createdAt: row._upl_created_at,
    updatedAt: row._upl_updated_at
})

const advisoryLockKeySql = `
    ('x' || substr(md5(?), 1, 16))::bit(64)::bigint
`
const catalogBootstrapLockKey = 'upl_migrations:bootstrap'

const createExecutionContext = (
    knexLike: Knex | Knex.Transaction,
    migration: PlatformMigrationFile,
    runId: string
): MigrationExecutionContext => ({
    knex: knexLike,
    logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined
    },
    scope: migration.scope,
    runId,
    raw: async (sql: string, bindings?: readonly unknown[]) =>
        bindings && bindings.length > 0 ? knexLike.raw(sql, bindings as readonly never[]) : knexLike.raw(sql)
})

const serializeError = (error: unknown): Record<string, unknown> => {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack ?? null,
            name: error.name
        }
    }

    return {
        message: String(error)
    }
}

const isTransaction = (knexLike: Knex | Knex.Transaction): knexLike is Knex.Transaction =>
    (knexLike as Knex.Transaction & { isTransaction?: boolean }).isTransaction === true

const migrationRunsTableExists = async (knexLike: Knex | Knex.Transaction): Promise<boolean> => {
    const result = await knexLike.raw<{ rows?: Array<{ exists?: boolean }> }>(
        `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'upl_migrations'
                  AND table_name = 'migration_runs'
            ) AS exists
        `
    )

    return result.rows?.[0]?.exists === true
}

export class PlatformMigrationCatalog implements MigrationCatalogRepository {
    constructor(protected readonly knex: Knex | Knex.Transaction) {}

    async isStorageReady(): Promise<boolean> {
        return migrationRunsTableExists(this.knex)
    }

    async ensureStorage(): Promise<void> {
        const ensureWithin = async (trx: Knex.Transaction): Promise<void> => {
            await trx.raw(`SELECT pg_advisory_xact_lock(${advisoryLockKeySql})`, [catalogBootstrapLockKey])

            const transactionCatalog = new PlatformMigrationCatalog(trx)
            let hasMigrationRuns = await migrationRunsTableExists(trx)

            for (const migration of catalogBootstrapMigrations) {
                const checksum = calculateMigrationChecksum(migration)
                let alreadyExecuted = false

                if (!hasMigrationRuns && migration.id === catalogBootstrapMigrations[0]?.id) {
                    await migration.up(createExecutionContext(trx, migration, 'catalog-bootstrap-preflight'))
                    hasMigrationRuns = true
                    alreadyExecuted = true
                }

                const existing = hasMigrationRuns ? await transactionCatalog.findLatest(migration.scope, migration) : null

                if (existing?.status === 'applied') {
                    if (existing.checksum !== checksum) {
                        throw new Error(`Migration drift detected for ${migration.id}: checksum mismatch`)
                    }
                    continue
                }

                const run = await transactionCatalog.beginRun({
                    migration,
                    checksum,
                    summary: migration.summary ?? null,
                    meta: {
                        bootstrap: true
                    }
                })

                try {
                    if (!alreadyExecuted) {
                        await migration.up(createExecutionContext(trx, migration, run.id))
                    }

                    await transactionCatalog.completeRun(run.id, {
                        status: 'applied',
                        meta: {
                            bootstrap: true
                        }
                    })
                } catch (error) {
                    await transactionCatalog.completeRun(run.id, {
                        status: 'failed',
                        error: serializeError(error),
                        meta: {
                            bootstrap: true
                        }
                    })
                    throw error
                }
            }
        }

        if (isTransaction(this.knex)) {
            await ensureWithin(this.knex)
            return
        }

        await this.knex.transaction(async (trx) => {
            await ensureWithin(trx)
        })
    }

    async findLatest(scope: MigrationScope, migration: PlatformMigrationFile): Promise<MigrationCatalogRecord | null> {
        const row = await this.knex<MigrationRunRow>('upl_migrations.migration_runs')
            .where({
                scope_kind: scope.kind,
                scope_key: scope.key,
                migration_name: migration.id,
                migration_version: migration.version
            })
            .orderBy('_upl_created_at', 'desc')
            .first()

        return row ? mapRow(row) : null
    }

    async beginRun(input: {
        migration: PlatformMigrationFile
        checksum: string
        summary?: string | null
        meta?: Record<string, unknown> | null
        status?: MigrationRunStatus
    }): Promise<MigrationCatalogRecord> {
        const id = createRunId()
        const now = new Date().toISOString()
        const status = input.status ?? 'planned'
        const row: MigrationRunRow = {
            id,
            scope_kind: input.migration.scope.kind,
            scope_key: input.migration.scope.key,
            source_kind: input.migration.sourceKind ?? 'file',
            migration_name: input.migration.id,
            migration_version: input.migration.version,
            checksum: input.checksum,
            transaction_mode: input.migration.transactionMode ?? 'single',
            lock_mode: input.migration.lockMode ?? 'transaction_advisory',
            status,
            summary: input.summary ?? null,
            meta: input.meta ?? null,
            snapshot_before: null,
            snapshot_after: null,
            plan: null,
            error: null,
            _upl_created_at: now,
            _upl_updated_at: now
        }

        await this.knex('upl_migrations.migration_runs').insert(row)
        return mapRow(row)
    }

    async completeRun(
        runId: string,
        patch: {
            status: MigrationRunStatus
            error?: Record<string, unknown> | null
            meta?: Record<string, unknown> | null
            snapshotBefore?: Record<string, unknown> | null
            snapshotAfter?: Record<string, unknown> | null
            plan?: Record<string, unknown> | null
        }
    ): Promise<void> {
        const current = await this.knex<MigrationRunRow>('upl_migrations.migration_runs').where({ id: runId }).first()
        if (!current) {
            throw new Error(`Migration run ${runId} not found`)
        }

        await this.knex('upl_migrations.migration_runs')
            .where({ id: runId })
            .update({
                status: patch.status,
                error: patch.error ?? null,
                meta: patch.meta ?? current.meta,
                snapshot_before: patch.snapshotBefore ?? current.snapshot_before,
                snapshot_after: patch.snapshotAfter ?? current.snapshot_after,
                plan: patch.plan ?? current.plan,
                _upl_updated_at: new Date().toISOString()
            })
    }
}

export class PlatformMigrationKernelCatalog extends PlatformMigrationCatalog {
    async ensureStorage(): Promise<void> {
        const kernelBootstrapMigration = catalogBootstrapMigrations[0]
        if (!kernelBootstrapMigration) {
            throw new Error('Missing upl_migrations migration kernel bootstrap migration')
        }

        const ensureWithin = async (trx: Knex.Transaction): Promise<void> => {
            await trx.raw(`SELECT pg_advisory_xact_lock(${advisoryLockKeySql})`, [catalogBootstrapLockKey])

            const hasMigrationRuns = await migrationRunsTableExists(trx)
            if (hasMigrationRuns) {
                return
            }

            await kernelBootstrapMigration.up(createExecutionContext(trx, kernelBootstrapMigration, 'catalog-kernel-bootstrap'))
        }

        if (isTransaction(this.knex)) {
            await ensureWithin(this.knex)
            return
        }

        await this.knex.transaction(async (trx) => {
            await ensureWithin(trx)
        })
    }
}

export interface RecordAppliedMigrationRunInput {
    knex: Knex | Knex.Transaction
    scopeKind: MigrationScopeKind
    scopeKey: string
    sourceKind: MigrationSourceKind
    migrationName: string
    migrationVersion: string
    summary?: string | null
    transactionMode?: MigrationTransactionMode
    lockMode?: MigrationLockMode
    checksumPayload?: unknown
    checksumSource?: string
    meta?: Record<string, unknown> | null
    snapshotBefore?: Record<string, unknown> | null
    snapshotAfter?: Record<string, unknown> | null
    plan?: Record<string, unknown> | null
}

const buildRuntimeChecksumSource = (input: RecordAppliedMigrationRunInput): string => {
    if (input.checksumSource) {
        return input.checksumSource
    }

    return (
        stableStringify({
            scopeKind: input.scopeKind,
            scopeKey: input.scopeKey,
            sourceKind: input.sourceKind,
            migrationName: input.migrationName,
            migrationVersion: input.migrationVersion,
            checksumPayload: input.checksumPayload ?? null,
            meta: input.meta ?? null,
            snapshotBefore: input.snapshotBefore ?? null,
            snapshotAfter: input.snapshotAfter ?? null,
            plan: input.plan ?? null
        }) ?? ''
    )
}

export const recordAppliedMigrationRun = async (input: RecordAppliedMigrationRunInput): Promise<string> => {
    const catalog = new PlatformMigrationCatalog(input.knex)
    await catalog.ensureStorage()

    const migration: PlatformMigrationFile = {
        id: input.migrationName,
        version: input.migrationVersion,
        scope: {
            kind: input.scopeKind,
            key: input.scopeKey
        },
        sourceKind: input.sourceKind,
        transactionMode: input.transactionMode ?? 'single',
        lockMode: input.lockMode ?? 'session_advisory',
        summary: input.summary ?? undefined,
        checksumSource: buildRuntimeChecksumSource(input),
        async up() {
            return Promise.resolve()
        }
    }

    const run = await catalog.beginRun({
        migration,
        checksum: calculateMigrationChecksum(migration),
        summary: input.summary ?? null,
        meta: input.meta ?? null
    })

    await catalog.completeRun(run.id, {
        status: 'applied',
        meta: input.meta ?? null,
        snapshotBefore: input.snapshotBefore ?? null,
        snapshotAfter: input.snapshotAfter ?? null,
        plan: input.plan ?? null
    })

    return run.id
}
