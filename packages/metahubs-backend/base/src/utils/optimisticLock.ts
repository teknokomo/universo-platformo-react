import type { SqlQueryable, DbExecutor } from '@universo/utils/database'
import { queryOneOrThrow } from '@universo/utils/database'
import { qColumn, qSchemaTable } from '@universo/database'
import { OptimisticLockError, type ConflictInfo } from '@universo/utils'

export type EntityType = ConflictInfo['entityType']

export interface VersionedUpdateOptions {
    executor: DbExecutor
    schemaName: string
    tableName: string
    entityId: string
    entityType: EntityType
    expectedVersion: number
    updateData: Record<string, unknown>
}

function buildUpdateAssignments(updateData: Record<string, unknown>): {
    setClauses: string[]
    params: unknown[]
} {
    const setClauses: string[] = []
    const params: unknown[] = []

    for (const [key, value] of Object.entries(updateData)) {
        setClauses.push(`${qColumn(key)} = $${params.length + 1}`)
        params.push(value)
    }

    return { setClauses, params }
}

/**
 * Performs a version-checked update with optimistic locking.
 *
 * 1. Acquires row-level lock (FOR UPDATE)
 * 2. Checks version matches expected
 * 3. Increments version and applies update
 * 4. Returns updated row or throws OptimisticLockError
 *
 * @throws OptimisticLockError if version mismatch detected
 * @throws Error if entity not found
 */
export async function updateWithVersionCheck(options: VersionedUpdateOptions): Promise<Record<string, unknown>> {
    const { executor, schemaName, tableName, entityId, entityType, expectedVersion, updateData } = options
    const qt = qSchemaTable(schemaName, tableName)

    return executor.transaction(async (tx) => {
        // 1. Lock row and fetch current state
        const current = await queryOneOrThrow<Record<string, unknown>>(
            tx,
            `SELECT * FROM ${qt} WHERE id = $1 FOR UPDATE`,
            [entityId],
            undefined,
            `${entityType} not found`
        )

        const actualVersion = current._upl_version as number

        // 2. Check version
        if (actualVersion !== expectedVersion) {
            const conflict: ConflictInfo = {
                entityId,
                entityType,
                expectedVersion,
                actualVersion,
                updatedAt: new Date(current._upl_updated_at as string),
                updatedBy: current._upl_updated_by as string
            }
            throw new OptimisticLockError(conflict)
        }

        // 3. Apply update with version increment
        const assignments = buildUpdateAssignments(updateData)
        const setClauses: string[] = ['_upl_version = _upl_version + 1', ...assignments.setClauses]
        const params: unknown[] = [...assignments.params]
        const paramIdx = params.length + 1

        params.push(entityId)
        const updated = await queryOneOrThrow<Record<string, unknown>>(
            tx,
            `UPDATE ${qt} SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
            params,
            undefined,
            `${entityType} not found after update`
        )

        return updated
    })
}

/**
 * Increments version without checking (for internal operations or backwards compatibility).
 * Use this when expectedVersion is not provided by the client.
 */
export async function incrementVersion(
    db: SqlQueryable,
    schemaName: string,
    tableName: string,
    entityId: string,
    updateData: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const qt = qSchemaTable(schemaName, tableName)
    const assignments = buildUpdateAssignments(updateData)
    const setClauses: string[] = ['_upl_version = _upl_version + 1', ...assignments.setClauses]
    const params: unknown[] = [...assignments.params]
    const paramIdx = params.length + 1

    params.push(entityId)
    const updated = await queryOneOrThrow<Record<string, unknown>>(
        db,
        `UPDATE ${qt} SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        params,
        undefined,
        'Entity not found'
    )

    return updated
}
