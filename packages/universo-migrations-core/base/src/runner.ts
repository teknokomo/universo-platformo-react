import type { Knex } from 'knex'
import { calculateMigrationChecksum } from './checksum'
import { consoleMigrationLogger } from './logger'
import { sortPlatformMigrations, validatePlatformMigrations } from './validate'
import type {
    DdlExecutionBudget,
    MigrationCatalogRecord,
    MigrationExecutionContext,
    MigrationDeliveryStage,
    PlatformMigrationFile,
    PlannedPlatformMigration,
    RunPlatformMigrationsOptions,
    RunPlatformMigrationsResult
} from './types'

const advisoryLockKeySql = `
    ('x' || substr(md5(?), 1, 16))::bit(64)::bigint
`
const advisoryLockAcquireTimeoutMs = 30_000
const advisoryLockPollIntervalMs = 150
const maxExecutionBudgetTimeoutMs = 300_000

const createExecutionContext = (
    knexLike: Knex | Knex.Transaction,
    migration: PlatformMigrationFile,
    runId: string,
    logger = consoleMigrationLogger
): MigrationExecutionContext => ({
    knex: knexLike,
    logger,
    scope: migration.scope,
    runId,
    raw: async (sql, bindings) => (bindings && bindings.length > 0 ? knexLike.raw(sql, bindings as readonly never[]) : knexLike.raw(sql))
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

const wait = async (timeoutMs: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, timeoutMs)
    })

const runConnectionBoundQuery = async <T = unknown>(
    knex: Knex,
    connection: unknown,
    sql: string,
    bindings?: readonly unknown[]
): Promise<T> => {
    const query = bindings && bindings.length > 0 ? knex.raw<T>(sql, bindings as readonly never[]) : knex.raw<T>(sql)

    return (await query.connection(connection)) as T
}

const getBooleanField = (result: unknown, fieldName: string): boolean => {
    if (!result || typeof result !== 'object') return false
    const rows = (result as { rows?: Array<Record<string, unknown>> }).rows
    if (!Array.isArray(rows) || rows.length === 0) return false

    return rows[0]?.[fieldName] === true
}

const formatExecutionBudgetTimeoutLiteral = (timeoutMs: number, fieldName: keyof DdlExecutionBudget): string => {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > maxExecutionBudgetTimeoutMs) {
        throw new Error(`Invalid ${fieldName}: must be a positive integer <= ${maxExecutionBudgetTimeoutMs}ms`)
    }

    return `${timeoutMs}ms`
}

const applyExecutionBudget = async (trx: Knex.Transaction, budget: DdlExecutionBudget): Promise<void> => {
    await trx.raw(`SET LOCAL lock_timeout TO '${formatExecutionBudgetTimeoutLiteral(budget.lockTimeoutMs, 'lockTimeoutMs')}'`)
    await trx.raw(
        `SET LOCAL statement_timeout TO '${formatExecutionBudgetTimeoutLiteral(budget.statementTimeoutMs, 'statementTimeoutMs')}'`
    )
}

const withTransactionLock = async <T>(trx: Knex.Transaction, lockKey: string, task: () => Promise<T>): Promise<T> => {
    await trx.raw(`SELECT pg_advisory_xact_lock(${advisoryLockKeySql})`, [lockKey])
    return task()
}

const withSessionLock = async <T>(knex: Knex, lockKey: string, task: () => Promise<T>): Promise<T> => {
    let connection: unknown | null = null

    try {
        connection = await knex.client.acquireConnection()

        // Begin transaction to hold the xact lock
        await runConnectionBoundQuery(knex, connection, 'BEGIN')

        const startedAt = Date.now()

        while (Date.now() - startedAt < advisoryLockAcquireTimeoutMs) {
            const result = await runConnectionBoundQuery<{ rows: Array<Record<string, unknown>> }>(
                knex,
                connection,
                `SELECT pg_try_advisory_xact_lock(${advisoryLockKeySql}) AS acquired`,
                [lockKey]
            )

            if (getBooleanField(result, 'acquired')) {
                const taskResult = await task()
                // COMMIT releases the transaction-level advisory lock automatically
                await runConnectionBoundQuery(knex, connection, 'COMMIT')
                return taskResult
            }

            await wait(advisoryLockPollIntervalMs)
        }

        // Timeout — rollback and throw
        await runConnectionBoundQuery(knex, connection, 'ROLLBACK')
        throw new Error(`Timed out waiting for advisory lock ${lockKey}`)
    } catch (err) {
        // Ensure rollback on any error
        if (connection) {
            try {
                await runConnectionBoundQuery(knex, connection, 'ROLLBACK')
            } catch {
                /* best-effort rollback */
            }
        }
        throw err
    } finally {
        if (connection) {
            await knex.client.releaseConnection(connection)
        }
    }
}

const executeMigration = async (
    knex: Knex,
    migration: PlatformMigrationFile,
    runId: string,
    logger = consoleMigrationLogger
): Promise<void> => {
    const transactionMode = migration.transactionMode ?? 'single'
    const lockMode = migration.lockMode ?? 'transaction_advisory'
    const lockKey = `${migration.scope.kind}:${migration.scope.key}:${migration.id}`
    const executeWithoutTransaction = async () => {
        const context = createExecutionContext(knex, migration, runId, logger)
        await migration.up(context)
    }
    const executeInTransaction = async () => {
        await knex.transaction(async (trx) => {
            const executeInside = async () => {
                if (migration.executionBudget) {
                    await applyExecutionBudget(trx, migration.executionBudget)
                }
                const context = createExecutionContext(trx, migration, runId, logger)
                await migration.up(context)
            }

            if (lockMode === 'transaction_advisory') {
                await withTransactionLock(trx, lockKey, executeInside)
                return
            }

            await executeInside()
        })
    }

    if (lockMode === 'session_advisory') {
        await withSessionLock(knex, lockKey, async () => {
            if (transactionMode === 'none') {
                await executeWithoutTransaction()
                return
            }

            await executeInTransaction()
        })
        return
    }

    if (transactionMode === 'none') {
        await executeWithoutTransaction()
        return
    }

    await executeInTransaction()
}

const analyzeExistingMigration = (
    migration: PlatformMigrationFile,
    existing: MigrationCatalogRecord | null,
    checksum: string
): PlannedPlatformMigration['action'] => {
    if (!existing || existing.status !== 'applied') return 'apply'
    if (existing.checksum !== checksum) return 'drift'
    return 'skip'
}

const createPlanEntry = (
    migration: PlatformMigrationFile,
    checksum: string,
    action: PlannedPlatformMigration['action'],
    existing: MigrationCatalogRecord | null,
    reason: string | null = null
): PlannedPlatformMigration => ({
    id: migration.id,
    version: migration.version,
    scopeKind: migration.scope.kind,
    scopeKey: migration.scope.key,
    checksum,
    summary: migration.summary ?? null,
    action,
    reason,
    existingRunId: existing?.id ?? null,
    existingStatus: existing?.status ?? null,
    existingChecksum: existing?.checksum ?? null,
    deliveryStage: (migration.deliveryStage ?? 'one_shot') as MigrationDeliveryStage,
    executionBudget: (migration.executionBudget ?? null) as DdlExecutionBudget | null
})

export const runPlatformMigrations = async (options: RunPlatformMigrationsOptions): Promise<RunPlatformMigrationsResult> => {
    const logger = options.logger ?? consoleMigrationLogger
    const isDryRun = options.dryRun === true
    const prepareCatalogStorage = options.prepareCatalogStorage ?? !isDryRun
    const validation = validatePlatformMigrations(options.migrations)
    if (!validation.ok) {
        const issue = validation.issues.find((entry) => entry.level === 'error')
        throw new Error(issue?.message ?? 'Migration validation failed')
    }

    let catalogStorageReady = true
    if (prepareCatalogStorage) {
        await options.catalog.ensureStorage()
    } else if (options.catalog.isStorageReady) {
        catalogStorageReady = await options.catalog.isStorageReady()
    }

    const result: RunPlatformMigrationsResult = {
        dryRun: isDryRun,
        applied: [],
        skipped: [],
        drifted: [],
        blocked: [],
        planned: []
    }

    for (const migration of sortPlatformMigrations(options.migrations)) {
        if (migration.isDestructive && !options.allowDestructive) {
            if (isDryRun) {
                result.blocked.push(migration.id)
                result.planned.push(
                    createPlanEntry(
                        migration,
                        calculateMigrationChecksum(migration),
                        'blocked',
                        null,
                        'Migration is destructive and allowDestructive=false'
                    )
                )
                continue
            }
            throw new Error(`Migration ${migration.id} is destructive and allowDestructive=false`)
        }
        if (migration.requiresReview && !options.allowReviewRequired) {
            if (isDryRun) {
                result.blocked.push(migration.id)
                result.planned.push(
                    createPlanEntry(migration, calculateMigrationChecksum(migration), 'blocked', null, 'Migration requires explicit review')
                )
                continue
            }
            throw new Error(`Migration ${migration.id} requires explicit review`)
        }

        const checksum = calculateMigrationChecksum(migration)

        if (isDryRun) {
            const existing = catalogStorageReady ? await options.catalog.findLatest(migration.scope, migration) : null
            const action = analyzeExistingMigration(migration, existing, checksum)
            const reason =
                !catalogStorageReady && !prepareCatalogStorage
                    ? 'Catalog storage is not bootstrapped yet; plan assumes no prior applied runs'
                    : action === 'drift'
                    ? 'Applied checksum differs from the registered migration definition'
                    : null

            result.planned.push(createPlanEntry(migration, checksum, action, existing, reason))

            if (action === 'skip') {
                result.skipped.push(migration.id)
            }

            if (action === 'drift') {
                result.drifted.push(migration.id)
            }

            continue
        }

        await withSessionLock(options.knex, `runner:${migration.scope.kind}:${migration.scope.key}:${migration.id}`, async () => {
            const existing = await options.catalog.findLatest(migration.scope, migration)
            const action = analyzeExistingMigration(migration, existing, checksum)

            if (action === 'drift') {
                result.drifted.push(migration.id)
                result.planned.push(
                    createPlanEntry(
                        migration,
                        checksum,
                        action,
                        existing,
                        'Applied checksum differs from the registered migration definition'
                    )
                )
                throw new Error(`Migration drift detected for ${migration.id}: checksum mismatch`)
            }

            if (action === 'skip') {
                result.skipped.push(migration.id)
                result.planned.push(createPlanEntry(migration, checksum, action, existing))
                return
            }

            result.planned.push(createPlanEntry(migration, checksum, action, existing))

            const run = await options.catalog.beginRun({
                migration,
                checksum,
                summary: migration.summary ?? null,
                meta: {
                    executionMode: 'apply'
                }
            })

            logger.info('[migrations] Applying platform migration', {
                runId: run.id,
                migrationId: migration.id,
                scopeKind: migration.scope.kind,
                scopeKey: migration.scope.key
            })

            try {
                await executeMigration(options.knex, migration, run.id, logger)
                await options.catalog.completeRun(run.id, {
                    status: 'applied'
                })
                result.applied.push(migration.id)
            } catch (error) {
                await options.catalog.completeRun(run.id, {
                    status: 'failed',
                    error: serializeError(error)
                })
                logger.error('[migrations] Platform migration failed', {
                    runId: run.id,
                    migrationId: migration.id,
                    error: serializeError(error)
                })
                throw error
            }
        })
    }

    return result
}
