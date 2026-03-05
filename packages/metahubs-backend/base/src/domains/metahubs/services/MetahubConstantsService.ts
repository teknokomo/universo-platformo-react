import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { buildCodenameAttempt, CODENAME_RETRY_MAX_ATTEMPTS } from '../../shared/codenameStyleHelper'
import { toJsonbValue } from '../../shared/jsonb'
import type { Knex } from 'knex'
import type { ConstantDataType } from '@universo/types'

const ALLOWED_CONSTANT_TYPES: ConstantDataType[] = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE']

export class MetahubConstantsService {
    constructor(private schemaService: MetahubSchemaService) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    private getRunner(trx?: Knex.Transaction) {
        return trx ?? this.knex
    }

    private withActiveConstants<TQuery extends Knex.QueryBuilder>(query: TQuery): TQuery {
        return query.andWhere('_upl_deleted', false).andWhere('_mhb_deleted', false) as TQuery
    }

    private async getNextSortOrder(schemaName: string, objectId: string, trx?: Knex.Transaction): Promise<number> {
        const runner = this.getRunner(trx)
        const result = await runner
            .withSchema(schemaName)
            .from('_mhb_constants')
            .where({ object_id: objectId })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .max('sort_order as max')
            .first()

        const max = result?.max
        if (typeof max === 'number') return max + 1
        const parsed = max !== undefined && max !== null ? Number(max) : 0
        return Number.isFinite(parsed) ? parsed + 1 : 1
    }

    async countByObjectId(metahubId: string, objectId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const result = await this.knex
            .withSchema(schemaName)
            .from('_mhb_constants')
            .where({ object_id: objectId })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .count('* as count')
            .first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    async countByObjectIds(metahubId: string, objectIds: string[], userId?: string): Promise<Map<string, number>> {
        if (objectIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_constants')
            .whereIn('object_id', objectIds)
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .select('object_id')
            .count('* as count')
            .groupBy('object_id')

        const result = new Map<string, number>()
        for (const row of rows as Array<{ object_id: string; count: string | number }>) {
            result.set(row.object_id, parseInt(String(row.count), 10))
        }
        return result
    }

    async findAll(metahubId: string, setId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_constants')
            .where({ object_id: setId })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

        return rows.map((row) => this.mapRowToConstant(row))
    }

    async findById(metahubId: string, id: string, userId?: string, trx?: Knex.Transaction, options?: { includeDeleted?: boolean }) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = this.getRunner(trx)
        let query = runner.withSchema(schemaName).from('_mhb_constants').where({ id })
        if (!options?.includeDeleted) {
            query = this.withActiveConstants(query)
        }
        const row = await query.first()
        return row ? this.mapRowToConstant(row) : null
    }

    async findByCodename(metahubId: string, setId: string, codename: string, userId?: string, trx?: Knex.Transaction) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = this.getRunner(trx)
        const row = await runner
            .withSchema(schemaName)
            .from('_mhb_constants')
            .where({ object_id: setId, codename })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .first()

        return row ? this.mapRowToConstant(row) : null
    }

    async create(
        metahubId: string,
        data: {
            setId: string
            codename: string
            dataType: ConstantDataType
            name: unknown
            codenameLocalized?: unknown
            validationRules?: Record<string, unknown>
            uiConfig?: Record<string, unknown>
            value?: unknown
            sortOrder?: number
            createdBy?: string | null
        },
        userId?: string,
        trx?: Knex.Transaction
    ) {
        if (!ALLOWED_CONSTANT_TYPES.includes(data.dataType)) {
            throw new Error(`Unsupported constant data type: ${data.dataType}`)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = this.getRunner(trx)
        const sortOrder = data.sortOrder ?? (await this.getNextSortOrder(schemaName, data.setId, trx))

        const [created] = await runner
            .withSchema(schemaName)
            .into('_mhb_constants')
            .insert({
                object_id: data.setId,
                codename: data.codename,
                data_type: data.dataType,
                presentation: {
                    codename: data.codenameLocalized ?? null,
                    name: data.name
                },
                validation_rules: data.validationRules ?? {},
                ui_config: data.uiConfig ?? {},
                value_json: toJsonbValue(data.value),
                sort_order: sortOrder,
                _upl_created_at: new Date(),
                _upl_created_by: data.createdBy ?? null,
                _upl_updated_at: new Date(),
                _upl_updated_by: data.createdBy ?? null
            })
            .returning('*')

        return this.mapRowToConstant(created)
    }

    async update(
        metahubId: string,
        id: string,
        data: {
            codename?: string
            dataType?: ConstantDataType
            name?: unknown
            codenameLocalized?: unknown
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

        if (data.dataType && !ALLOWED_CONSTANT_TYPES.includes(data.dataType)) {
            throw new Error(`Unsupported constant data type: ${data.dataType}`)
        }

        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: data.updatedBy ?? null
        }

        if (data.codename !== undefined) updateData.codename = data.codename
        if (data.dataType !== undefined) updateData.data_type = data.dataType
        if (data.validationRules !== undefined) updateData.validation_rules = data.validationRules
        if (data.uiConfig !== undefined) updateData.ui_config = data.uiConfig
        if (data.value !== undefined) updateData.value_json = toJsonbValue(data.value)
        if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

        if (data.name !== undefined || data.codenameLocalized !== undefined) {
            const current = await this.knex.withSchema(schemaName).from('_mhb_constants').where({ id }).first()
            updateData.presentation = {
                ...(current?.presentation ?? {}),
                ...(data.codenameLocalized !== undefined ? { codename: data.codenameLocalized } : {}),
                ...(data.name !== undefined ? { name: data.name } : {})
            }
        }

        if (data.expectedVersion !== undefined) {
            const updated = await updateWithVersionCheck({
                knex: this.knex,
                schemaName,
                tableName: '_mhb_constants',
                entityId: id,
                entityType: 'constant',
                expectedVersion: data.expectedVersion,
                updateData
            })
            return this.mapRowToConstant(updated)
        }

        const updated = await incrementVersion(this.knex, schemaName, '_mhb_constants', id, updateData)
        return updated ? this.mapRowToConstant(updated) : null
    }

    async delete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex.transaction(async (trx) => {
            const existing = await this.withActiveConstants(trx.withSchema(schemaName).from('_mhb_constants').where({ id })).first()
            if (!existing) return

            await trx
                .withSchema(schemaName)
                .from('_mhb_constants')
                .where({ id })
                .update({
                    _mhb_deleted: true,
                    _mhb_deleted_at: new Date(),
                    _mhb_deleted_by: userId ?? null,
                    _upl_updated_at: new Date(),
                    _upl_updated_by: userId ?? null
                })
            await this.ensureSequentialSortOrder(schemaName, existing.object_id, trx)
        })
    }

    async moveConstant(metahubId: string, objectId: string, constantId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            await this.ensureSequentialSortOrder(schemaName, objectId, trx)

            const current = await this.withActiveConstants(
                trx.withSchema(schemaName).from('_mhb_constants').where({ id: constantId })
            ).first()
            if (!current) throw new Error('Constant not found')
            const currentOrder = current.sort_order

            let neighborQuery = this.withActiveConstants(trx.withSchema(schemaName).from('_mhb_constants').where({ object_id: objectId }))
            if (direction === 'up') {
                neighborQuery = neighborQuery.where('sort_order', '<', currentOrder).orderBy('sort_order', 'desc')
            } else {
                neighborQuery = neighborQuery.where('sort_order', '>', currentOrder).orderBy('sort_order', 'asc')
            }

            const neighbor = await neighborQuery.first()
            if (!neighbor) {
                return this.mapRowToConstant(current)
            }

            await trx.withSchema(schemaName).from('_mhb_constants').where({ id: constantId }).update({ sort_order: neighbor.sort_order })
            await trx.withSchema(schemaName).from('_mhb_constants').where({ id: neighbor.id }).update({ sort_order: currentOrder })

            const updated = await this.withActiveConstants(
                trx.withSchema(schemaName).from('_mhb_constants').where({ id: constantId })
            ).first()
            return this.mapRowToConstant(updated)
        })
    }

    async reorderConstant(metahubId: string, objectId: string, constantId: string, newSortOrder: number, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        return this.knex.transaction(async (trx) => {
            await this.ensureSequentialSortOrder(schemaName, objectId, trx)

            const constants = await trx
                .withSchema(schemaName)
                .from('_mhb_constants')
                .where({ object_id: objectId })
                .andWhere('_upl_deleted', false)
                .andWhere('_mhb_deleted', false)
                .orderBy('sort_order', 'asc')
            const currentIndex = constants.findIndex((item) => item.id === constantId)
            if (currentIndex === -1) throw new Error('Constant not found')

            const [moved] = constants.splice(currentIndex, 1)
            const targetIndex = Math.max(0, Math.min(constants.length, newSortOrder - 1))
            constants.splice(targetIndex, 0, moved)

            for (let index = 0; index < constants.length; index += 1) {
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_constants')
                    .where({ id: constants[index].id })
                    .update({ sort_order: index + 1 })
            }

            const updated = await this.withActiveConstants(
                trx.withSchema(schemaName).from('_mhb_constants').where({ id: constantId })
            ).first()
            return this.mapRowToConstant(updated)
        })
    }

    async ensureUniqueCodenameWithRetries(options: {
        metahubId: string
        setId: string
        desiredCodename: string
        codenameStyle: 'kebab-case' | 'pascal-case'
        userId?: string
        trx?: Knex.Transaction
    }): Promise<string> {
        const { metahubId, setId, desiredCodename, codenameStyle, userId, trx } = options

        for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS; attempt += 1) {
            const candidate = buildCodenameAttempt(desiredCodename, attempt, codenameStyle)
            const exists = await this.findByCodename(metahubId, setId, candidate, userId, trx)
            if (!exists) return candidate
        }

        throw new Error('Could not generate unique constant codename')
    }

    async findSetReferenceBlockers(metahubId: string, targetSetId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes as attr')
            .leftJoin('_mhb_objects as obj', 'obj.id', 'attr.object_id')
            .where('attr.data_type', 'REF')
            .andWhere('attr.target_object_id', targetSetId)
            .andWhere('attr.target_object_kind', 'set')
            .andWhere('attr._upl_deleted', false)
            .andWhere('attr._mhb_deleted', false)
            .andWhere('obj._upl_deleted', false)
            .andWhere('obj._mhb_deleted', false)
            .select(
                'attr.id as attribute_id',
                'attr.codename as attribute_codename',
                'attr.presentation as attribute_presentation',
                'attr.object_id as source_catalog_id',
                'obj.codename as source_catalog_codename',
                'obj.presentation as source_catalog_presentation'
            )
            .orderBy('obj.codename', 'asc')
            .orderBy('attr.sort_order', 'asc')

        return rows.map((row: any) => ({
            attributeId: row.attribute_id,
            attributeCodename: row.attribute_codename,
            attributeName: row.attribute_presentation?.name ?? null,
            sourceCatalogId: row.source_catalog_id,
            sourceCatalogCodename: row.source_catalog_codename,
            sourceCatalogName: row.source_catalog_presentation?.name ?? null
        }))
    }

    async findAttributeReferenceBlockersByConstant(metahubId: string, targetSetId: string, targetConstantId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes as attr')
            .where('attr.data_type', 'REF')
            .andWhere('attr.target_object_kind', 'set')
            .andWhere('attr.target_object_id', targetSetId)
            .andWhere('attr.target_constant_id', targetConstantId)
            .andWhere('attr._upl_deleted', false)
            .andWhere('attr._mhb_deleted', false)
            .select('attr.id')
            .limit(1)

        return rows.length > 0
    }

    async belongsToSet(metahubId: string, setId: string, constantId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_constants')
            .where({ id: constantId, object_id: setId })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .first()

        return Boolean(row)
    }

    private async ensureSequentialSortOrder(schemaName: string, objectId: string, trx: Knex.Transaction): Promise<void> {
        const constants = await trx
            .withSchema(schemaName)
            .from('_mhb_constants')
            .where({ object_id: objectId })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .orderBy('sort_order', 'asc')
            .orderBy('_upl_created_at', 'asc')

        for (let i = 0; i < constants.length; i += 1) {
            if (constants[i].sort_order !== i + 1) {
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_constants')
                    .where({ id: constants[i].id })
                    .update({ sort_order: i + 1 })
            }
        }
    }

    private mapRowToConstant(row: any) {
        return {
            id: row.id,
            setId: row.object_id,
            codename: row.codename,
            codenameLocalized: row.presentation?.codename ?? null,
            dataType: row.data_type,
            sortOrder: row.sort_order,
            value: row.value_json ?? null,
            name: row.presentation?.name,
            description: row.presentation?.description,
            validationRules: row.validation_rules,
            uiConfig: row.ui_config,
            version: row._upl_version || 1,
            createdAt: row._upl_created_at,
            updatedAt: row._upl_updated_at
        }
    }
}
