import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import { MetahubSchemaService } from './MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { buildCodenameAttempt, CODENAME_RETRY_MAX_ATTEMPTS } from '../../shared/codenameStyleHelper'
import { toJsonbValue } from '../../shared/jsonb'
import type { ConstantDataType } from '@universo/types'
import { codenamePrimaryTextSql, ensureCodenameValue, getCodenameText } from '../../shared/codename'

const ALLOWED_CONSTANT_TYPES: ConstantDataType[] = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE']
const ACTIVE = `_upl_deleted = false AND _mhb_deleted = false`

export class MetahubConstantsService {
    constructor(private exec: DbExecutor, private schemaService: MetahubSchemaService) {}

    private async getNextSortOrder(schemaName: string, objectId: string, db?: SqlQueryable): Promise<number> {
        const qt = qSchemaTable(schemaName, '_mhb_constants')
        const rows = await (db ?? this.exec).query<{ max: string | null }>(
            `SELECT MAX(sort_order)::text AS max FROM ${qt}
             WHERE object_id = $1 AND ${ACTIVE}`,
            [objectId]
        )
        const max = rows[0]?.max
        const parsed = max !== null && max !== undefined ? Number(max) : 0
        return Number.isFinite(parsed) ? parsed + 1 : 1
    }

    async countByObjectId(metahubId: string, objectId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')
        const rows = await this.exec.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM ${qt}
             WHERE object_id = $1 AND ${ACTIVE}`,
            [objectId]
        )
        return parseInt(rows[0]?.count ?? '0', 10)
    }

    async countByObjectIds(metahubId: string, objectIds: string[], userId?: string): Promise<Map<string, number>> {
        if (objectIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')
        const placeholders = objectIds.map((_, i) => `$${i + 1}`).join(', ')
        const rows = await this.exec.query<{ object_id: string; count: string }>(
            `SELECT object_id, COUNT(*)::text AS count FROM ${qt}
             WHERE object_id IN (${placeholders}) AND ${ACTIVE}
             GROUP BY object_id`,
            objectIds
        )

        const result = new Map<string, number>()
        for (const row of rows) {
            result.set(row.object_id, parseInt(row.count, 10))
        }
        return result
    }

    async findAll(metahubId: string, setId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')
        const rows = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [setId]
        )
        return rows.map((row) => this.mapRowToConstant(row))
    }

    async findById(metahubId: string, id: string, userId?: string, db?: SqlQueryable, options?: { includeDeleted?: boolean }) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')
        const activeFilter = options?.includeDeleted ? '' : `AND ${ACTIVE}`
        const row = await queryOne<Record<string, unknown>>(db ?? this.exec, `SELECT * FROM ${qt} WHERE id = $1 ${activeFilter} LIMIT 1`, [
            id
        ])
        return row ? this.mapRowToConstant(row) : null
    }

    async findByCodename(metahubId: string, setId: string, codename: string, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')
        const row = await queryOne<Record<string, unknown>>(
            db ?? this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND ${codenamePrimaryTextSql('codename')} = $2 AND ${ACTIVE}
             LIMIT 1`,
            [setId, codename]
        )
        return row ? this.mapRowToConstant(row) : null
    }

    async create(
        metahubId: string,
        data: {
            setId: string
            codename: unknown
            dataType: ConstantDataType
            name: unknown
            validationRules?: Record<string, unknown>
            uiConfig?: Record<string, unknown>
            value?: unknown
            sortOrder?: number
            createdBy?: string | null
        },
        userId?: string,
        db?: SqlQueryable
    ) {
        if (!ALLOWED_CONSTANT_TYPES.includes(data.dataType)) {
            throw new Error(`Unsupported constant data type: ${data.dataType}`)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = db ?? this.exec
        const sortOrder = data.sortOrder ?? (await this.getNextSortOrder(schemaName, data.setId, runner))
        const qt = qSchemaTable(schemaName, '_mhb_constants')
        const now = new Date()

        const codename = ensureCodenameValue(data.codename)
        const row = await queryOneOrThrow<Record<string, unknown>>(
            runner,
            `INSERT INTO ${qt}
                (object_id, codename, data_type, presentation, validation_rules, ui_config,
                 value_json, sort_order, _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
             VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $9, $10)
             RETURNING *`,
            [
                data.setId,
                JSON.stringify(codename),
                data.dataType,
                JSON.stringify({ name: data.name }),
                JSON.stringify(data.validationRules ?? {}),
                JSON.stringify(data.uiConfig ?? {}),
                toJsonbValue(data.value),
                sortOrder,
                now,
                data.createdBy ?? null
            ],
            undefined,
            'Failed to insert constant'
        )

        return this.mapRowToConstant(row)
    }

    async update(
        metahubId: string,
        id: string,
        data: {
            codename?: unknown
            dataType?: ConstantDataType
            name?: unknown
            validationRules?: Record<string, unknown>
            uiConfig?: Record<string, unknown>
            value?: unknown
            sortOrder?: number
            expectedVersion?: number
            updatedBy?: string | null
        },
        userId?: string
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')

        if (data.dataType && !ALLOWED_CONSTANT_TYPES.includes(data.dataType)) {
            throw new Error(`Unsupported constant data type: ${data.dataType}`)
        }

        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: data.updatedBy ?? null
        }

        if (data.codename !== undefined) {
            const current = await queryOne<Record<string, unknown>>(this.exec, `SELECT codename FROM ${qt} WHERE id = $1 LIMIT 1`, [id])
            updateData.codename = ensureCodenameValue(data.codename ?? current?.codename)
        }
        if (data.dataType !== undefined) updateData.data_type = data.dataType
        if (data.validationRules !== undefined) updateData.validation_rules = JSON.stringify(data.validationRules)
        if (data.uiConfig !== undefined) updateData.ui_config = JSON.stringify(data.uiConfig)
        if (data.value !== undefined) updateData.value_json = toJsonbValue(data.value)
        if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

        if (data.name !== undefined) {
            const current = await queryOne<Record<string, unknown>>(this.exec, `SELECT presentation FROM ${qt} WHERE id = $1 LIMIT 1`, [id])
            const currentPresentation = (current?.presentation as Record<string, unknown>) ?? {}
            updateData.presentation = JSON.stringify({
                ...currentPresentation,
                ...(data.name !== undefined ? { name: data.name } : {})
            })
        }

        if (data.expectedVersion !== undefined) {
            const updated = await updateWithVersionCheck({
                executor: this.exec,
                schemaName,
                tableName: '_mhb_constants',
                entityId: id,
                entityType: 'constant',
                expectedVersion: data.expectedVersion,
                updateData
            })
            return this.mapRowToConstant(updated)
        }

        const updated = await incrementVersion(this.exec, schemaName, '_mhb_constants', id, updateData)
        return updated ? this.mapRowToConstant(updated) : null
    }

    async delete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')

        await this.exec.transaction(async (tx: SqlQueryable) => {
            const existing = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} LIMIT 1`, [id])
            if (!existing) return

            await tx.query(
                `UPDATE ${qt}
                 SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                     _upl_updated_at = $1, _upl_updated_by = $2
                 WHERE id = $3
                 RETURNING id`,
                [new Date(), userId ?? null, id]
            )
            await this.ensureSequentialSortOrder(schemaName, existing.object_id as string, tx)
        })
    }

    async moveConstant(metahubId: string, objectId: string, constantId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureSequentialSortOrder(schemaName, objectId, tx)

            const current = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt}
                 WHERE id = $1 AND object_id = $2 AND ${ACTIVE}
                 LIMIT 1`,
                [constantId, objectId]
            )
            if (!current) throw new Error('Constant not found')
            const currentOrder = current.sort_order as number

            const neighborSql =
                direction === 'up'
                    ? `SELECT * FROM ${qt}
                       WHERE object_id = $1 AND ${ACTIVE} AND sort_order < $2
                       ORDER BY sort_order DESC LIMIT 1`
                    : `SELECT * FROM ${qt}
                       WHERE object_id = $1 AND ${ACTIVE} AND sort_order > $2
                       ORDER BY sort_order ASC LIMIT 1`
            const neighbor = await queryOne<Record<string, unknown>>(tx, neighborSql, [objectId, currentOrder])
            if (!neighbor) {
                return this.mapRowToConstant(current)
            }

            await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2 RETURNING id`, [neighbor.sort_order, constantId])
            await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2 RETURNING id`, [currentOrder, neighbor.id])

            const updated = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} LIMIT 1`, [
                constantId
            ])
            return this.mapRowToConstant(updated!)
        })
    }

    async reorderConstant(metahubId: string, objectId: string, constantId: string, newSortOrder: number, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.ensureSequentialSortOrder(schemaName, objectId, tx)

            const constants = await queryMany<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt}
                 WHERE object_id = $1 AND ${ACTIVE}
                 ORDER BY sort_order ASC`,
                [objectId]
            )
            const currentIndex = constants.findIndex((item) => item.id === constantId)
            if (currentIndex === -1) throw new Error('Constant not found')

            const [moved] = constants.splice(currentIndex, 1)
            const targetIndex = Math.max(0, Math.min(constants.length, newSortOrder - 1))
            constants.splice(targetIndex, 0, moved)

            for (let index = 0; index < constants.length; index += 1) {
                await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2 RETURNING id`, [index + 1, constants[index].id])
            }

            const updated = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} LIMIT 1`, [
                constantId
            ])
            return this.mapRowToConstant(updated!)
        })
    }

    async ensureUniqueCodenameWithRetries(options: {
        metahubId: string
        setId: string
        desiredCodename: string
        codenameStyle: 'kebab-case' | 'pascal-case'
        userId?: string
        db?: SqlQueryable
    }): Promise<string> {
        const { metahubId, setId, desiredCodename, codenameStyle, userId, db } = options

        for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS; attempt += 1) {
            const candidate = buildCodenameAttempt(desiredCodename, attempt, codenameStyle)
            const exists = await this.findByCodename(metahubId, setId, candidate, userId, db)
            if (!exists) return candidate
        }

        throw new Error('Could not generate unique constant codename')
    }

    async findSetReferenceBlockers(metahubId: string, targetSetId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const attrQt = qSchemaTable(schemaName, '_mhb_attributes')
        const objQt = qSchemaTable(schemaName, '_mhb_objects')
        const rows = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT attr.id AS attribute_id,
                    attr.codename AS attribute_codename,
                    attr.presentation AS attribute_presentation,
                    attr.object_id AS source_catalog_id,
                    obj.codename AS source_catalog_codename,
                    obj.presentation AS source_catalog_presentation
             FROM ${attrQt} AS attr
             LEFT JOIN ${objQt} AS obj ON obj.id = attr.object_id
             WHERE attr.data_type = 'REF'
               AND attr.target_object_id = $1
               AND attr.target_object_kind = 'set'
               AND attr._upl_deleted = false AND attr._mhb_deleted = false
               AND obj._upl_deleted = false AND obj._mhb_deleted = false
             ORDER BY ${codenamePrimaryTextSql('obj.codename')} ASC, attr.sort_order ASC`,
            [targetSetId]
        )

        return rows.map((row) => ({
            attributeId: row.attribute_id,
            attributeCodename: row.attribute_codename,
            attributeName: (row.attribute_presentation as Record<string, unknown>)?.name ?? null,
            sourceCatalogId: row.source_catalog_id,
            sourceCatalogCodename: getCodenameText(row.source_catalog_codename),
            sourceCatalogName: (row.source_catalog_presentation as Record<string, unknown>)?.name ?? null
        }))
    }

    async findAttributeReferenceBlockersByConstant(metahubId: string, targetSetId: string, targetConstantId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const rows = await this.exec.query<{ id: string }>(
            `SELECT id FROM ${qt}
             WHERE data_type = 'REF'
               AND target_object_kind = 'set'
               AND target_object_id = $1
               AND target_constant_id = $2
               AND ${ACTIVE}
             LIMIT 1`,
            [targetSetId, targetConstantId]
        )
        return rows.length > 0
    }

    async belongsToSet(metahubId: string, setId: string, constantId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_constants')
        const row = await queryOne(
            this.exec,
            `SELECT id FROM ${qt}
             WHERE id = $1 AND object_id = $2 AND ${ACTIVE}
             LIMIT 1`,
            [constantId, setId]
        )
        return Boolean(row)
    }

    private async ensureSequentialSortOrder(schemaName: string, objectId: string, db: SqlQueryable): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_constants')
        const constants = await queryMany<Record<string, unknown>>(
            db,
            `SELECT id, sort_order FROM ${qt}
             WHERE object_id = $1 AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [objectId]
        )

        for (let i = 0; i < constants.length; i += 1) {
            if ((constants[i].sort_order as number) !== i + 1) {
                await db.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2 RETURNING id`, [i + 1, constants[i].id])
            }
        }
    }

    private mapRowToConstant(row: Record<string, unknown>) {
        const presentation = row.presentation as Record<string, unknown> | null
        return {
            id: row.id,
            setId: row.object_id,
            codename: ensureCodenameValue(row.codename),
            dataType: row.data_type,
            sortOrder: row.sort_order,
            value: row.value_json ?? null,
            name: presentation?.name,
            description: presentation?.description,
            validationRules: row.validation_rules,
            uiConfig: row.ui_config,
            version: (row._upl_version as number) || 1,
            createdAt: row._upl_created_at,
            updatedAt: row._upl_updated_at
        }
    }
}
