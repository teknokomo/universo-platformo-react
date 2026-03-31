import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable, qSchema } from '@universo/database'
import { MetahubSchemaService } from './MetahubSchemaService'
import { incrementVersion, updateWithVersionCheck } from '../../../utils/optimisticLock'
import { codenamePrimaryTextSql, ensureCodenameValue } from '../../shared/codename'
import { MetahubNotFoundError } from '../../shared/domainErrors'

interface EnumerationValueCreateInput {
    enumerationId: string
    codename: unknown
    name: unknown
    description?: unknown
    sortOrder?: number
    isDefault?: boolean
    createdBy?: string | null
}

interface EnumerationValueUpdateInput {
    codename?: unknown
    name?: unknown
    description?: unknown
    sortOrder?: number
    isDefault?: boolean
    expectedVersion?: number
    updatedBy?: string | null
}

const defaultConstraintCache = new Set<string>()
const ACTIVE = `_upl_deleted = false AND _mhb_deleted = false`

/**
 * Service for enumeration values stored in `_mhb_values`.
 */
export class MetahubEnumerationValuesService {
    constructor(private readonly exec: DbExecutor, private readonly schemaService: MetahubSchemaService) {}

    async findAll(metahubId: string, enumerationId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureSequentialSortOrderInTransaction(schemaName, enumerationId, tx)
            const rows = await queryMany<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt}
                 WHERE object_id = $1 AND ${ACTIVE}
                 ORDER BY sort_order ASC, _upl_created_at ASC`,
                [enumerationId]
            )
            return rows.map(this.mapRow)
        })
    }

    async countByObjectId(metahubId: string, enumerationId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')
        const rows = await this.exec.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM ${qt}
             WHERE object_id = $1 AND ${ACTIVE}`,
            [enumerationId]
        )
        return parseInt(rows[0]?.count ?? '0', 10)
    }

    async countByObjectIds(metahubId: string, enumerationIds: string[], userId?: string): Promise<Map<string, number>> {
        if (enumerationIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')
        const placeholders = enumerationIds.map((_, i) => `$${i + 1}`).join(', ')
        const rows = await this.exec.query<{ object_id: string; count: string }>(
            `SELECT object_id, COUNT(*)::text AS count FROM ${qt}
             WHERE object_id IN (${placeholders}) AND ${ACTIVE}
             GROUP BY object_id`,
            enumerationIds
        )

        const map = new Map<string, number>()
        for (const row of rows) {
            map.set(row.object_id, parseInt(row.count, 10))
        }
        return map
    }

    async findById(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')
        const row = await queryOne<Record<string, unknown>>(this.exec, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} LIMIT 1`, [id])
        return row ? this.mapRow(row) : null
    }

    async findByCodename(metahubId: string, enumerationId: string, codename: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')
        const row = await queryOne<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND ${codenamePrimaryTextSql('codename')} = $2 AND ${ACTIVE}
             LIMIT 1`,
            [enumerationId, codename]
        )
        return row ? this.mapRow(row) : null
    }

    async create(metahubId: string, data: EnumerationValueCreateInput, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureDefaultConstraint(schemaName, tx)
            await this.ensureSequentialSortOrderInTransaction(schemaName, data.enumerationId, tx)

            if (data.isDefault) {
                await tx.query(
                    `UPDATE ${qt}
                     SET is_default = false, _upl_updated_at = $1, _upl_updated_by = $2
                     WHERE object_id = $3 AND ${ACTIVE}
                     RETURNING id`,
                    [new Date(), data.createdBy ?? null, data.enumerationId]
                )
            }

            const nextSortOrder =
                typeof data.sortOrder === 'number' ? data.sortOrder : await this.getNextSortOrder(schemaName, data.enumerationId, tx)
            const codename = ensureCodenameValue(data.codename)

            const created = await queryOneOrThrow<Record<string, unknown>>(
                tx,
                `INSERT INTO ${qt}
                    (object_id, codename, presentation, sort_order, is_default,
                     _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7)
                 RETURNING *`,
                [
                    data.enumerationId,
                    JSON.stringify(codename),
                    JSON.stringify({ name: data.name, description: data.description }),
                    nextSortOrder,
                    data.isDefault ?? false,
                    new Date(),
                    data.createdBy ?? null
                ],
                undefined,
                'Failed to insert enumeration value'
            )

            return this.mapRow(created)
        })
    }

    async update(metahubId: string, id: string, data: EnumerationValueUpdateInput, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureDefaultConstraint(schemaName, tx)

            const current = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} LIMIT 1`, [id])
            if (!current) throw new MetahubNotFoundError('Enumeration value', id)

            const updateData: Record<string, unknown> = {
                _upl_updated_at: new Date(),
                _upl_updated_by: data.updatedBy ?? null
            }

            if (data.codename !== undefined) {
                updateData.codename = ensureCodenameValue(data.codename ?? current.codename)
            }
            if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

            if (data.name !== undefined || data.description !== undefined) {
                const currentPresentation = (current.presentation as Record<string, unknown>) ?? {}
                updateData.presentation = JSON.stringify({
                    ...currentPresentation,
                    ...(data.name !== undefined ? { name: data.name } : {}),
                    ...(data.description !== undefined ? { description: data.description } : {})
                })
            }

            if (data.isDefault === true) {
                await tx.query(
                    `UPDATE ${qt}
                     SET is_default = false, _upl_updated_at = $1, _upl_updated_by = $2
                     WHERE object_id = $3 AND ${ACTIVE}
                     RETURNING id`,
                    [new Date(), data.updatedBy ?? null, current.object_id]
                )
                updateData.is_default = true
            } else if (data.isDefault === false) {
                updateData.is_default = false
            }

            let result: Record<string, unknown>
            if (data.expectedVersion !== undefined) {
                result = await updateWithVersionCheck({
                    executor: tx as DbExecutor,
                    schemaName,
                    tableName: '_mhb_values',
                    entityId: id,
                    entityType: 'enumeration_value',
                    expectedVersion: data.expectedVersion,
                    updateData
                })
            } else {
                result = await incrementVersion(tx, schemaName, '_mhb_values', id, updateData)
            }

            if (data.sortOrder !== undefined) {
                await this.ensureSequentialSortOrderInTransaction(schemaName, current.object_id as string, tx)
            }
            return this.mapRow(result)
        })
    }

    async delete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')

        await this.exec.transaction(async (tx: SqlQueryable) => {
            const row = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} LIMIT 1`, [id])
            if (!row) return

            await tx.query(
                `UPDATE ${qt}
                 SET _mhb_deleted = true,
                     _mhb_deleted_at = $1,
                     _mhb_deleted_by = $2,
                     _upl_updated_at = $1,
                     _upl_updated_by = $2
                 WHERE id = $3 AND ${ACTIVE}
                 RETURNING id`,
                [new Date(), userId ?? null, id]
            )
            await this.ensureSequentialSortOrderInTransaction(schemaName, row.object_id as string, tx)
        })
    }

    async moveValue(metahubId: string, enumerationId: string, valueId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureSequentialSortOrderInTransaction(schemaName, enumerationId, tx)

            const ordered = await queryMany<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt}
                 WHERE object_id = $1 AND ${ACTIVE}
                 ORDER BY sort_order ASC, _upl_created_at ASC, id ASC`,
                [enumerationId]
            )

            const currentIndex = ordered.findIndex((item) => item.id === valueId)
            if (currentIndex === -1) {
                throw new MetahubNotFoundError('Enumeration value', valueId)
            }

            const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
            if (targetIndex < 0 || targetIndex >= ordered.length) {
                return this.mapRow(ordered[currentIndex])
            }

            const reordered = [...ordered]
            const [moved] = reordered.splice(currentIndex, 1)
            reordered.splice(targetIndex, 0, moved)

            const now = new Date()
            for (let index = 0; index < reordered.length; index += 1) {
                const row = reordered[index]
                const nextSortOrder = index + 1
                if ((row.sort_order as number) !== nextSortOrder) {
                    await tx.query(
                        `UPDATE ${qt}
                         SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                         WHERE id = $4
                         RETURNING id`,
                        [nextSortOrder, now, userId ?? null, row.id]
                    )
                }
            }

            const updated = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1 LIMIT 1`, [valueId])
            if (!updated) {
                throw new MetahubNotFoundError('Enumeration value', valueId)
            }
            return this.mapRow(updated)
        })
    }

    async reorderValue(metahubId: string, enumerationId: string, valueId: string, newSortOrder: number, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureSequentialSortOrderInTransaction(schemaName, enumerationId, tx)

            const current = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt}
                 WHERE id = $1 AND object_id = $2 AND ${ACTIVE}
                 LIMIT 1`,
                [valueId, enumerationId]
            )
            if (!current) throw new MetahubNotFoundError('Enumeration value', valueId)

            const oldOrder = current.sort_order as number
            const clampedNew = Math.max(1, newSortOrder)

            if (oldOrder !== clampedNew) {
                const now = new Date()

                if (clampedNew < oldOrder) {
                    await tx.query(
                        `UPDATE ${qt}
                         SET sort_order = sort_order + 1, _upl_updated_at = $1, _upl_updated_by = $2
                         WHERE object_id = $3 AND ${ACTIVE}
                           AND sort_order >= $4 AND sort_order < $5
                           AND id <> $6
                         RETURNING id`,
                        [now, userId ?? null, enumerationId, clampedNew, oldOrder, valueId]
                    )
                } else {
                    await tx.query(
                        `UPDATE ${qt}
                         SET sort_order = sort_order - 1, _upl_updated_at = $1, _upl_updated_by = $2
                         WHERE object_id = $3 AND ${ACTIVE}
                           AND sort_order > $4 AND sort_order <= $5
                           AND id <> $6
                         RETURNING id`,
                        [now, userId ?? null, enumerationId, oldOrder, clampedNew, valueId]
                    )
                }

                await tx.query(
                    `UPDATE ${qt}
                     SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3
                     WHERE id = $4
                     RETURNING id`,
                    [clampedNew, now, userId ?? null, valueId]
                )
            }

            await this.ensureSequentialSortOrderInTransaction(schemaName, enumerationId, tx)

            const updated = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt}
                 WHERE id = $1 AND object_id = $2 AND ${ACTIVE}
                 LIMIT 1`,
                [valueId, enumerationId]
            )
            if (!updated) throw new MetahubNotFoundError('Enumeration value', valueId)
            return this.mapRow(updated)
        })
    }

    async getDefaultValue(metahubId: string, enumerationId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_values')
        const row = await queryOne<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND is_default = true AND ${ACTIVE}
             LIMIT 1`,
            [enumerationId]
        )
        return row ? this.mapRow(row) : null
    }

    private mapRow(row: Record<string, unknown>) {
        const presentation = row.presentation as Record<string, unknown> | null
        return {
            id: row.id,
            objectId: row.object_id,
            codename: ensureCodenameValue(row.codename),
            name: presentation?.name ?? {},
            description: presentation?.description ?? {},
            sortOrder: (row.sort_order as number) ?? 0,
            isDefault: (row.is_default as boolean) ?? false,
            createdAt: row._upl_created_at,
            updatedAt: row._upl_updated_at,
            version: (row._upl_version as number) ?? 1
        }
    }

    private async ensureSequentialSortOrderInTransaction(schemaName: string, enumerationId: string, db: SqlQueryable): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_values')
        const rows = await queryMany<Record<string, unknown>>(
            db,
            `SELECT id, sort_order FROM ${qt}
             WHERE object_id = $1 AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC, id ASC`,
            [enumerationId]
        )

        let hasGaps = false
        for (let index = 0; index < rows.length; index += 1) {
            if (((rows[index].sort_order as number) ?? 0) !== index + 1) {
                hasGaps = true
                break
            }
        }
        if (!hasGaps) return

        const now = new Date()
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index]
            const nextSortOrder = index + 1
            if (((row.sort_order as number) ?? 0) !== nextSortOrder) {
                await db.query(
                    `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2
                     WHERE id = $3 RETURNING id`,
                    [nextSortOrder, now, row.id]
                )
            }
        }
    }

    private async getNextSortOrder(schemaName: string, enumerationId: string, db: SqlQueryable): Promise<number> {
        const qt = qSchemaTable(schemaName, '_mhb_values')
        const rows = await db.query<{ max: string | null }>(
            `SELECT MAX(sort_order)::text AS max FROM ${qt}
             WHERE object_id = $1 AND ${ACTIVE}`,
            [enumerationId]
        )
        const max = rows[0]?.max
        if (typeof max === 'string' && max !== '') {
            const parsed = Number(max)
            return Number.isFinite(parsed) ? parsed + 1 : 1
        }
        return 1
    }

    private async ensureDefaultConstraint(schemaName: string, db: SqlQueryable): Promise<void> {
        if (defaultConstraintCache.has(schemaName)) return

        const qs = qSchema(schemaName)
        await db.query(
            `WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY object_id
                        ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
                    ) AS row_number
                FROM ${qs}._mhb_values
                WHERE is_default = true
                  AND _upl_deleted = false
                  AND _mhb_deleted = false
            )
            UPDATE ${qs}._mhb_values AS ev
            SET is_default = false,
                _upl_updated_at = NOW()
            FROM ranked
            WHERE ev.id = ranked.id
              AND ranked.row_number > 1
            RETURNING ev.id`
        )

        await db.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS uidx_mhb_values_default_active
             ON ${qs}._mhb_values (object_id)
             WHERE is_default = true AND _upl_deleted = false AND _mhb_deleted = false`
        )

        defaultConstraintCache.add(schemaName)
    }
}
