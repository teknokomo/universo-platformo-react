import type { DbExecutor } from './manager'
import { buildSetLocalStatementTimeoutSql } from './statementTimeout'

/**
 * Run work inside a transaction with optional execution budget.
 * Replaces direct knex.transaction() calls in domain code.
 */
export async function withTransaction<T>(
    executor: DbExecutor,
    work: (tx: DbExecutor) => Promise<T>,
    options?: { statementTimeoutMs?: number }
): Promise<T> {
    return executor.transaction(async (tx) => {
        if (options?.statementTimeoutMs) {
            await tx.query(buildSetLocalStatementTimeoutSql(options.statementTimeoutMs))
        }
        return work(tx)
    })
}
