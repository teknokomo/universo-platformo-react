import type { Knex } from 'knex'
import { OptimisticLockError, type ConflictInfo } from '@universo/utils'

export type EntityType = ConflictInfo['entityType']

export interface VersionedUpdateOptions {
    knex: Knex
    schemaName: string
    tableName: string
    entityId: string
    entityType: EntityType
    expectedVersion: number
    updateData: Record<string, unknown>
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
    const { knex, schemaName, tableName, entityId, entityType, expectedVersion, updateData } = options

    return knex.transaction(async (trx) => {
        // 1. Lock row and fetch current state
        const current = await trx.withSchema(schemaName).from(tableName).where({ id: entityId }).forUpdate().first()

        if (!current) {
            throw new Error(`${entityType} not found`)
        }

        const actualVersion = current._upl_version as number

        // 2. Check version
        if (actualVersion !== expectedVersion) {
            const conflict: ConflictInfo = {
                entityId,
                entityType,
                expectedVersion,
                actualVersion,
                updatedAt: current._upl_updated_at,
                updatedBy: current._upl_updated_by
            }
            throw new OptimisticLockError(conflict)
        }

        // 3. Apply update with version increment
        const [updated] = await trx
            .withSchema(schemaName)
            .from(tableName)
            .where({ id: entityId })
            .update({
                ...updateData,
                _upl_version: actualVersion + 1
            })
            .returning('*')

        return updated
    })
}

/**
 * Increments version without checking (for internal operations or backwards compatibility).
 * Use this when expectedVersion is not provided by the client.
 */
export async function incrementVersion(
    knex: Knex,
    schemaName: string,
    tableName: string,
    entityId: string,
    updateData: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const [updated] = await knex
        .withSchema(schemaName)
        .from(tableName)
        .where({ id: entityId })
        .update({
            ...updateData,
            _upl_version: knex.raw('_upl_version + 1')
        })
        .returning('*')

    return updated
}
