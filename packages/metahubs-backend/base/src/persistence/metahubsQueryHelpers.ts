import type { SqlQueryable } from './types'

/**
 * SQL-first soft delete helpers for metahubs-backend.
 *
 * Replaces the TypeORM-based queryHelpers.ts with neutral functions
 * that accept SqlQueryable and work with raw SQL.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Soft delete WHERE clause builders
// ═══════════════════════════════════════════════════════════════════════════════

export interface SoftDeleteFilterOptions {
    includeDeleted?: boolean
    onlyDeleted?: boolean
    /** Column prefix/alias (e.g. 'm' for 'm._upl_deleted'), defaults to no prefix */
    alias?: string
}

export function activeMetahubRowCondition(alias?: string): string {
    const prefix = alias ? `${alias}.` : ''
    return `${prefix}_upl_deleted = false AND ${prefix}_mhb_deleted = false`
}

export function deletedMetahubRowCondition(alias?: string): string {
    const prefix = alias ? `${alias}.` : ''
    return `${prefix}_upl_deleted = true AND ${prefix}_mhb_deleted = true`
}

/**
 * Returns a WHERE condition string for the metahub active-row contract.
 * Use in string interpolation within SQL queries.
 *
 * @example
 * const where = softDeleteCondition({ alias: 'm' })
 * // Returns: "m._upl_deleted = false AND m._mhb_deleted = false"
 *
 * const trashWhere = softDeleteCondition({ alias: 'm', onlyDeleted: true })
 * // Returns: "m._upl_deleted = true AND m._mhb_deleted = true"
 */
export function softDeleteCondition(options: SoftDeleteFilterOptions = {}): string {
    const { includeDeleted = false, onlyDeleted = false, alias } = options

    if (onlyDeleted) return deletedMetahubRowCondition(alias)
    if (!includeDeleted) return activeMetahubRowCondition(alias)
    return 'TRUE' // no filter
}

// ═══════════════════════════════════════════════════════════════════════════════
// Soft delete mutations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Soft delete a metahub-domain record by setting both _upl_deleted=true and
 * _mhb_deleted=true plus audit fields.
 *
 * @param exec - SQL executor (DbExecutor, EntityManager, etc.)
 * @param schema - Schema name (e.g. 'metahubs')
 * @param table - Table name (e.g. 'metahubs')
 * @param id - Record UUID
 * @param userId - User performing the deletion (optional)
 * @returns true if a row was updated
 */
export async function softDelete(exec: SqlQueryable, schema: string, table: string, id: string, userId?: string | null): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE "${schema}"."${table}"
         SET _upl_deleted = true,
             _upl_deleted_at = NOW(),
             _upl_deleted_by = $2,
                         _mhb_deleted = true,
                         _mhb_deleted_at = NOW(),
                         _mhb_deleted_by = $2,
             _upl_updated_at = NOW(),
             _upl_version = _upl_version + 1
         WHERE id = $1
                     AND _upl_deleted = false
                     AND _mhb_deleted = false
         RETURNING id`,
        [id, userId ?? null]
    )
    return rows.length > 0
}

/**
 * Restore a soft-deleted record.
 */
export async function restoreDeleted(exec: SqlQueryable, schema: string, table: string, id: string): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE "${schema}"."${table}"
         SET _upl_deleted = false,
             _upl_deleted_at = NULL,
             _upl_deleted_by = NULL,
                         _mhb_deleted = false,
                         _mhb_deleted_at = NULL,
                         _mhb_deleted_by = NULL,
             _upl_purge_after = NULL,
             _upl_updated_at = NOW(),
             _upl_version = _upl_version + 1
         WHERE id = $1
                     AND _upl_deleted = true
                     AND _mhb_deleted = true
         RETURNING id`,
        [id]
    )
    return rows.length > 0
}

/**
 * Permanently delete soft-deleted records older than N days.
 * Returns the number of purged rows.
 */
export async function purgeOldDeleted(exec: SqlQueryable, schema: string, table: string, olderThanDays: number): Promise<number> {
    const rows = await exec.query<{ id: string }>(
        `DELETE FROM "${schema}"."${table}"
         WHERE _upl_deleted = true
           AND _upl_deleted_at < NOW() - ($1 || ' days')::INTERVAL
         RETURNING id`,
        [olderThanDays]
    )
    return rows.length
}

/**
 * Count soft-deleted records (trash count).
 */
export async function countDeleted(
    exec: SqlQueryable,
    schema: string,
    table: string,
    filterColumn?: string,
    filterValue?: string
): Promise<number> {
    let sql = `SELECT COUNT(*)::text AS count FROM "${schema}"."${table}" WHERE _upl_deleted = true AND _mhb_deleted = true`
    const params: unknown[] = []

    if (filterColumn && filterValue) {
        params.push(filterValue)
        sql += ` AND "${filterColumn}" = $1`
    }

    const rows = await exec.query<{ count: string }>(sql, params)
    return parseInt(rows[0]?.count ?? '0', 10)
}

/**
 * Set a purge-after timestamp on a soft-deleted record.
 */
export async function setPurgeAfter(exec: SqlQueryable, schema: string, table: string, id: string, purgeAfter: Date): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE "${schema}"."${table}"
         SET _upl_purge_after = $2
         WHERE id = $1
                     AND _upl_deleted = true
                     AND _mhb_deleted = true
         RETURNING id`,
        [id, purgeAfter]
    )
    return rows.length > 0
}
