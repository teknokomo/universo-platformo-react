import type { Knex } from 'knex'
import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { incrementVersion, updateWithVersionCheck } from '../../../utils/optimisticLock'

interface EnumerationValueCreateInput {
    enumerationId: string
    codename: string
    name: unknown
    description?: unknown
    sortOrder?: number
    isDefault?: boolean
    createdBy?: string | null
}

interface EnumerationValueUpdateInput {
    codename?: string
    name?: unknown
    description?: unknown
    sortOrder?: number
    isDefault?: boolean
    expectedVersion?: number
    updatedBy?: string | null
}

const defaultConstraintCache = new Set<string>()

/**
 * Service for enumeration values stored in `_mhb_values`.
 */
export class MetahubEnumerationValuesService {
    constructor(private readonly schemaService: MetahubSchemaService) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    async findAll(metahubId: string, enumerationId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.knex.transaction(async (trx) => {
            await this.ensureSequentialSortOrderInTransaction(schemaName, enumerationId, trx)
            const rows = await trx
                .withSchema(schemaName)
                .from('_mhb_values')
                .where({ object_id: enumerationId })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .orderBy('sort_order', 'asc')
                .orderBy('_upl_created_at', 'asc')
            return rows.map(this.mapRow)
        })
    }

    async countByObjectId(metahubId: string, enumerationId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const result = await this.knex
            .withSchema(schemaName)
            .from('_mhb_values')
            .where({ object_id: enumerationId })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .count('* as count')
            .first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    async countByObjectIds(metahubId: string, enumerationIds: string[], userId?: string): Promise<Map<string, number>> {
        if (enumerationIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_values')
            .whereIn('object_id', enumerationIds)
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .select('object_id')
            .count('* as count')
            .groupBy('object_id')

        const map = new Map<string, number>()
        rows.forEach((row: any) => {
            map.set(row.object_id, parseInt(row.count as string, 10))
        })
        return map
    }

    async findById(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex.withSchema(schemaName).from('_mhb_values').where({ id }).first()
        return row ? this.mapRow(row) : null
    }

    async findByCodename(metahubId: string, enumerationId: string, codename: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_values')
            .where({ object_id: enumerationId, codename })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .first()
        return row ? this.mapRow(row) : null
    }

    async create(metahubId: string, data: EnumerationValueCreateInput, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            await this.ensureDefaultConstraint(schemaName, trx)
            await this.ensureSequentialSortOrderInTransaction(schemaName, data.enumerationId, trx)

            if (data.isDefault) {
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_values')
                    .where({ object_id: data.enumerationId })
                    .andWhere('_upl_deleted', false)
                    .andWhere('_mhb_deleted', false)
                    .update({
                        is_default: false,
                        _upl_updated_at: new Date(),
                        _upl_updated_by: data.createdBy ?? null
                    })
            }

            const nextSortOrder =
                typeof data.sortOrder === 'number' ? data.sortOrder : await this.getNextSortOrder(schemaName, data.enumerationId, trx)

            const [created] = await trx
                .withSchema(schemaName)
                .into('_mhb_values')
                .insert({
                    object_id: data.enumerationId,
                    codename: data.codename,
                    presentation: {
                        name: data.name,
                        description: data.description
                    },
                    sort_order: nextSortOrder,
                    is_default: data.isDefault ?? false,
                    _upl_created_at: new Date(),
                    _upl_created_by: data.createdBy ?? null,
                    _upl_updated_at: new Date(),
                    _upl_updated_by: data.createdBy ?? null
                })
                .returning('*')

            return this.mapRow(created)
        })
    }

    async update(metahubId: string, id: string, data: EnumerationValueUpdateInput, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            await this.ensureDefaultConstraint(schemaName, trx)

            const current = await trx.withSchema(schemaName).from('_mhb_values').where({ id }).first()
            if (!current) throw new Error('Enumeration value not found')

            const updateData: Record<string, unknown> = {
                _upl_updated_at: new Date(),
                _upl_updated_by: data.updatedBy ?? null
            }

            if (data.codename !== undefined) updateData.codename = data.codename
            if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

            if (data.name !== undefined || data.description !== undefined) {
                updateData.presentation = {
                    ...(current.presentation ?? {}),
                    ...(data.name !== undefined ? { name: data.name } : {}),
                    ...(data.description !== undefined ? { description: data.description } : {})
                }
            }

            if (data.isDefault === true) {
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_values')
                    .where({ object_id: current.object_id })
                    .andWhere('_upl_deleted', false)
                    .andWhere('_mhb_deleted', false)
                    .update({
                        is_default: false,
                        _upl_updated_at: new Date(),
                        _upl_updated_by: data.updatedBy ?? null
                    })
                updateData.is_default = true
            } else if (data.isDefault === false) {
                updateData.is_default = false
            }

            if (data.expectedVersion !== undefined) {
                const updated = await updateWithVersionCheck({
                    knex: trx as any,
                    schemaName,
                    tableName: '_mhb_values',
                    entityId: id,
                    entityType: 'enumeration_value',
                    expectedVersion: data.expectedVersion,
                    updateData
                })
                if (data.sortOrder !== undefined) {
                    await this.ensureSequentialSortOrderInTransaction(schemaName, current.object_id, trx)
                }
                return this.mapRow(updated as any)
            }

            const updated = await incrementVersion(trx as any, schemaName, '_mhb_values', id, updateData)
            if (data.sortOrder !== undefined) {
                await this.ensureSequentialSortOrderInTransaction(schemaName, current.object_id, trx)
            }
            return this.mapRow(updated as any)
        })
    }

    async delete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex.transaction(async (trx) => {
            const row = await trx.withSchema(schemaName).from('_mhb_values').where({ id }).first()
            if (!row) return
            await trx.withSchema(schemaName).from('_mhb_values').where({ id }).delete()
            await this.ensureSequentialSortOrderInTransaction(schemaName, row.object_id, trx)
        })
    }

    async moveValue(metahubId: string, enumerationId: string, valueId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            await this.ensureSequentialSortOrderInTransaction(schemaName, enumerationId, trx)

            const ordered = await trx
                .withSchema(schemaName)
                .from('_mhb_values')
                .where({ object_id: enumerationId })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .orderBy('sort_order', 'asc')
                .orderBy('_upl_created_at', 'asc')
                .orderBy('id', 'asc')

            const currentIndex = ordered.findIndex((item) => item.id === valueId)
            if (currentIndex === -1) {
                throw new Error('Enumeration value not found')
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
                if (row.sort_order !== nextSortOrder) {
                    await trx
                        .withSchema(schemaName)
                        .from('_mhb_values')
                        .where({ id: row.id })
                        .update({
                            sort_order: nextSortOrder,
                            _upl_updated_at: now,
                            _upl_updated_by: userId ?? null
                        })
                }
            }

            const updated = await trx.withSchema(schemaName).from('_mhb_values').where({ id: valueId }).first()
            if (!updated) {
                throw new Error('Enumeration value not found')
            }
            return this.mapRow(updated)
        })
    }

    async getDefaultValue(metahubId: string, enumerationId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_values')
            .where({ object_id: enumerationId, is_default: true })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .first()
        return row ? this.mapRow(row) : null
    }

    private mapRow(row: any) {
        return {
            id: row.id,
            objectId: row.object_id,
            codename: row.codename,
            name: row.presentation?.name ?? {},
            description: row.presentation?.description ?? {},
            sortOrder: row.sort_order ?? 0,
            isDefault: row.is_default ?? false,
            createdAt: row._upl_created_at,
            updatedAt: row._upl_updated_at,
            version: row._upl_version ?? 1
        }
    }

    private async ensureSequentialSortOrderInTransaction(
        schemaName: string,
        enumerationId: string,
        trx: Knex | Knex.Transaction
    ): Promise<void> {
        const rows = await trx
            .withSchema(schemaName)
            .from('_mhb_values')
            .where({ object_id: enumerationId })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')
            .orderBy('id', 'asc')

        let hasGaps = false
        for (let index = 0; index < rows.length; index += 1) {
            if ((rows[index].sort_order ?? 0) !== index + 1) {
                hasGaps = true
                break
            }
        }
        if (!hasGaps) return

        const now = new Date()
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index]
            const nextSortOrder = index + 1
            if ((row.sort_order ?? 0) !== nextSortOrder) {
                await trx.withSchema(schemaName).from('_mhb_values').where({ id: row.id }).update({
                    sort_order: nextSortOrder,
                    _upl_updated_at: now
                })
            }
        }
    }

    private async getNextSortOrder(schemaName: string, enumerationId: string, knex: Knex | Knex.Transaction): Promise<number> {
        const result = await knex
            .withSchema(schemaName)
            .from('_mhb_values')
            .where({ object_id: enumerationId })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .max('sort_order as max')
            .first()

        const max = result?.max
        if (typeof max === 'number') return max + 1
        const parsed = max !== undefined && max !== null ? Number(max) : 0
        return Number.isFinite(parsed) ? parsed + 1 : 1
    }

    private async ensureDefaultConstraint(schemaName: string, knex: Knex | Knex.Transaction): Promise<void> {
        if (defaultConstraintCache.has(schemaName)) return

        await knex.raw(
            `
                WITH ranked AS (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY object_id
                            ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
                        ) AS row_number
                    FROM "${schemaName}"._mhb_values
                    WHERE is_default = true
                      AND _upl_deleted = false
                      AND _mhb_deleted = false
                )
                UPDATE "${schemaName}"._mhb_values AS ev
                SET is_default = false,
                    _upl_updated_at = NOW()
                FROM ranked
                WHERE ev.id = ranked.id
                  AND ranked.row_number > 1
            `
        )

        await knex.raw(
            `
                CREATE UNIQUE INDEX IF NOT EXISTS uidx_mhb_values_default_active
                ON "${schemaName}"._mhb_values (object_id)
                WHERE is_default = true AND _upl_deleted = false AND _mhb_deleted = false
            `
        )

        defaultConstraintCache.add(schemaName)
    }
}
