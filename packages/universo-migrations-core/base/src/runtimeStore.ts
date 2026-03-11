import type { Knex } from 'knex'
import type { RuntimeMigrationHistoryRecord } from './types'

/**
 * Check whether a runtime migration history table exists in the given schema.
 */
export async function hasRuntimeHistoryTable(
    knex: Knex | Knex.Transaction,
    schemaName: string,
    tableName: string
): Promise<boolean> {
    return knex.schema.withSchema(schemaName).hasTable(tableName)
}

/**
 * List runtime migration history records from a local per-schema history table.
 * Returns the common columns only (id, name, applied_at, meta).
 *
 * Domain-specific columns (from_version, publication_snapshot, etc.) must be
 * queried by the domain code if needed.
 */
export async function listRuntimeHistory(
    knex: Knex | Knex.Transaction,
    schemaName: string,
    tableName: string,
    options?: { limit?: number; offset?: number; columns?: string[] }
): Promise<{ records: RuntimeMigrationHistoryRecord[]; total: number }> {
    const exists = await hasRuntimeHistoryTable(knex, schemaName, tableName)
    if (!exists) {
        return { records: [], total: 0 }
    }

    const { limit = 50, offset = 0 } = options ?? {}

    const countRow = await knex
        .withSchema(schemaName)
        .from(tableName)
        .count<{ count: string }[]>('* as count')
        .first()
    const total = Number(countRow?.count ?? 0)

    const selectCols = options?.columns ?? ['id', 'name', 'applied_at', 'meta']
    const rows = await knex
        .withSchema(schemaName)
        .from(tableName)
        .select(...selectCols)
        .orderBy('applied_at', 'desc')
        .limit(limit)
        .offset(offset)

    return {
        total,
        records: rows.map((row) => ({
            id: row.id,
            name: row.name,
            appliedAt: new Date(row.applied_at),
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta ?? {})
        }))
    }
}

/**
 * Get the most recently applied migration from a local history table.
 */
export async function getLastApplied(
    knex: Knex | Knex.Transaction,
    schemaName: string,
    tableName: string
): Promise<RuntimeMigrationHistoryRecord | null> {
    const { records } = await listRuntimeHistory(knex, schemaName, tableName, { limit: 1 })
    return records[0] ?? null
}
