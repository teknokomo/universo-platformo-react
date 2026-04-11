import { qSchemaTable } from '@universo/database'
import { isEnabledComponentConfig, type ScriptModuleRole } from '@universo/types'
import { queryMany, queryOne, queryOneOrThrow, type DbExecutor, type SqlQueryable } from '@universo/utils/database'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { codenamePrimaryTextSql, ensureCodenameValue, getCodenameText } from '../../shared/codename'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { EntityTypeService } from './EntityTypeService'

const TABLE = '_mhb_actions'
const OBJECTS_TABLE = '_mhb_objects'
const SCRIPTS_TABLE = '_mhb_scripts'
const ACTIVE_CLAUSE = '_upl_deleted = false AND _mhb_deleted = false'

type JsonRecord = Record<string, unknown>
type EntityActionType = 'script' | 'builtin'

interface StoredEntityActionRow {
    id: string
    object_id: string
    codename: unknown
    presentation: unknown
    action_type: EntityActionType
    script_id: string | null
    config: unknown
    sort_order: number
    _upl_version?: number
    _upl_updated_at?: string | Date | null
}

interface StoredObjectKindRow {
    id: string
    kind: string
}

export interface MetahubEntityAction {
    id: string
    objectId: string
    codename: JsonRecord
    presentation: JsonRecord
    actionType: EntityActionType
    scriptId: string | null
    config: JsonRecord
    sortOrder: number
    version: number
    updatedAt: string | null
}

export interface CreateEntityActionInput {
    objectId: string
    codename: unknown
    presentation?: JsonRecord
    actionType: EntityActionType
    scriptId?: string | null
    config?: JsonRecord
    sortOrder?: number
    createdBy?: string | null
}

export interface UpdateEntityActionInput {
    codename?: unknown
    presentation?: JsonRecord
    actionType?: EntityActionType
    scriptId?: string | null
    config?: JsonRecord
    sortOrder?: number
    updatedBy?: string | null
    expectedVersion?: number
}

const ensureJsonRecord = (value: unknown): JsonRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as JsonRecord
}

const normalizeActionType = (value: unknown): EntityActionType => {
    if (value === 'script' || value === 'builtin') {
        return value
    }

    throw new MetahubValidationError('Entity action type must be either script or builtin')
}

const normalizeSortOrder = (value: unknown): number | undefined => {
    if (value === undefined || value === null) return undefined
    const numeric = Number(value)
    if (!Number.isInteger(numeric) || numeric < 0) {
        throw new MetahubValidationError('Entity action sortOrder must be a non-negative integer')
    }
    return numeric
}

export class ActionService {
    constructor(
        private readonly exec: DbExecutor,
        private readonly schemaService: MetahubSchemaService,
        private readonly entityTypeService: EntityTypeService
    ) {}

    private normalizeRow(row: StoredEntityActionRow): MetahubEntityAction {
        return {
            id: row.id,
            objectId: row.object_id,
            codename: ensureCodenameValue(row.codename),
            presentation: ensureJsonRecord(row.presentation),
            actionType: row.action_type,
            scriptId: row.script_id,
            config: ensureJsonRecord(row.config),
            sortOrder: Number(row.sort_order ?? 0),
            version: Number(row._upl_version ?? 1),
            updatedAt:
                row._upl_updated_at instanceof Date
                    ? row._upl_updated_at.toISOString()
                    : typeof row._upl_updated_at === 'string'
                    ? row._upl_updated_at
                    : null
        }
    }

    private async findRowById(schemaName: string, actionId: string, db: SqlQueryable = this.exec): Promise<StoredEntityActionRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<StoredEntityActionRow>(db, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`, [actionId])
    }

    async getById(metahubId: string, actionId: string, userId?: string): Promise<MetahubEntityAction | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.findByIdInSchema(schemaName, actionId)
    }

    async findByIdInSchema(schemaName: string, actionId: string, db: SqlQueryable = this.exec): Promise<MetahubEntityAction | null> {
        const row = await this.findRowById(schemaName, actionId, db)
        return row ? this.normalizeRow(row) : null
    }

    private async findRowByCodename(
        schemaName: string,
        objectId: string,
        codename: string,
        db: SqlQueryable = this.exec
    ): Promise<StoredEntityActionRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<StoredEntityActionRow>(
            db,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND ${codenamePrimaryTextSql('codename')} = $2 AND ${ACTIVE_CLAUSE}
             LIMIT 1`,
            [objectId, codename]
        )
    }

    private async findObject(schemaName: string, objectId: string, db: SqlQueryable = this.exec): Promise<StoredObjectKindRow | null> {
        const qt = qSchemaTable(schemaName, OBJECTS_TABLE)
        return queryOne<StoredObjectKindRow>(db, `SELECT id, kind FROM ${qt} WHERE id = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`, [objectId])
    }

    private async assertObjectSupportsActions(schemaName: string, objectId: string, db: SqlQueryable): Promise<void> {
        const objectRow = await this.findObject(schemaName, objectId, db)
        if (!objectRow) {
            throw new MetahubNotFoundError('Metahub object', objectId)
        }

        const typeDefinition = await this.entityTypeService.resolveTypeInSchema(schemaName, objectRow.kind, db)
        if (!typeDefinition || !isEnabledComponentConfig(typeDefinition.components.actions)) {
            throw new MetahubValidationError('The target object type does not enable actions', {
                objectId,
                kind: objectRow.kind
            })
        }
    }

    private async assertScriptExists(schemaName: string, scriptId: string, db: SqlQueryable): Promise<void> {
        const qt = qSchemaTable(schemaName, SCRIPTS_TABLE)
        const scriptRow = await queryOne<{ id: string; module_role: ScriptModuleRole }>(
            db,
            `SELECT id, module_role FROM ${qt} WHERE id = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`,
            [scriptId]
        )

        if (!scriptRow) {
            throw new MetahubNotFoundError('Script', scriptId)
        }
    }

    private async getNextSortOrder(schemaName: string, objectId: string, db: SqlQueryable): Promise<number> {
        const qt = qSchemaTable(schemaName, TABLE)
        const result = await queryOne<{ max_sort_order: number | string | null }>(
            db,
            `SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM ${qt} WHERE object_id = $1 AND ${ACTIVE_CLAUSE}`,
            [objectId]
        )

        return Number(result?.max_sort_order ?? 0) + 1
    }

    async listByObjectId(metahubId: string, objectId: string, userId?: string): Promise<MetahubEntityAction[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, TABLE)
        const rows = await queryMany<StoredEntityActionRow>(
            this.exec,
            `SELECT * FROM ${qt} WHERE object_id = $1 AND ${ACTIVE_CLAUSE} ORDER BY sort_order ASC, id ASC`,
            [objectId]
        )

        return rows.map((row) => this.normalizeRow(row))
    }

    async create(metahubId: string, input: CreateEntityActionInput, userId?: string): Promise<MetahubEntityAction> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const actionType = normalizeActionType(input.actionType)
        const codename = ensureCodenameValue(input.codename)
        const presentation = ensureJsonRecord(input.presentation)
        const config = ensureJsonRecord(input.config)
        const qt = qSchemaTable(schemaName, TABLE)

        return this.exec.transaction(async (tx) => {
            await this.assertObjectSupportsActions(schemaName, input.objectId, tx)

            const conflict = await this.findRowByCodename(schemaName, input.objectId, getCodenameText(codename), tx)
            if (conflict) {
                const existingId = conflict.id
                throw new MetahubConflictError('Entity action codename already exists for this object', {
                    objectId: input.objectId,
                    existingId
                })
            }

            const resolvedScriptId = actionType === 'script' ? input.scriptId ?? null : null
            if (actionType === 'script' && !resolvedScriptId) {
                throw new MetahubValidationError('Script actions require a scriptId')
            }
            if (actionType === 'builtin' && input.scriptId) {
                throw new MetahubValidationError('Builtin actions cannot reference a scriptId')
            }
            if (resolvedScriptId) {
                await this.assertScriptExists(schemaName, resolvedScriptId, tx)
            }

            const sortOrder = normalizeSortOrder(input.sortOrder) ?? (await this.getNextSortOrder(schemaName, input.objectId, tx))

            const created = await queryOneOrThrow<StoredEntityActionRow>(
                tx,
                `INSERT INTO ${qt} (
                    object_id,
                    codename,
                    presentation,
                    action_type,
                    script_id,
                    config,
                    sort_order,
                    _upl_created_at,
                    _upl_created_by,
                    _upl_updated_at,
                    _upl_updated_by,
                    _upl_version,
                    _upl_archived,
                    _upl_deleted,
                    _upl_locked,
                    _mhb_published,
                    _mhb_archived,
                    _mhb_deleted
                 ) VALUES (
                    $1, $2::jsonb, $3::jsonb, $4, $5, $6::jsonb, $7,
                    $8, $9, $8, $9, 1, false, false, false, true, false, false
                 )
                 RETURNING *`,
                [
                    input.objectId,
                    JSON.stringify(codename),
                    JSON.stringify(presentation),
                    actionType,
                    resolvedScriptId,
                    JSON.stringify(config),
                    sortOrder,
                    new Date(),
                    input.createdBy ?? userId ?? null
                ]
            )

            return this.normalizeRow(created)
        })
    }

    async update(metahubId: string, actionId: string, input: UpdateEntityActionInput, userId?: string): Promise<MetahubEntityAction> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findRowById(schemaName, actionId)
        if (!existing) {
            throw new MetahubNotFoundError('Entity action', actionId)
        }

        return this.exec.transaction(async (tx) => {
            await this.assertObjectSupportsActions(schemaName, existing.object_id, tx)

            const nextCodename = input.codename !== undefined ? ensureCodenameValue(input.codename) : ensureCodenameValue(existing.codename)
            const nextCodenameText = getCodenameText(nextCodename)
            const conflict = await this.findRowByCodename(schemaName, existing.object_id, nextCodenameText, tx)
            if (conflict && conflict.id !== existing.id) {
                throw new MetahubConflictError('Entity action codename already exists for this object', {
                    objectId: existing.object_id,
                    existingId: conflict.id
                })
            }

            const nextActionType = input.actionType !== undefined ? normalizeActionType(input.actionType) : existing.action_type
            const nextScriptId =
                nextActionType === 'script' ? (input.scriptId !== undefined ? input.scriptId : existing.script_id) ?? null : null

            if (nextActionType === 'script' && !nextScriptId) {
                throw new MetahubValidationError('Script actions require a scriptId')
            }
            if (nextScriptId) {
                await this.assertScriptExists(schemaName, nextScriptId, tx)
            }

            const updateData = {
                codename: JSON.stringify(nextCodename),
                presentation: JSON.stringify(
                    input.presentation !== undefined ? ensureJsonRecord(input.presentation) : ensureJsonRecord(existing.presentation)
                ),
                action_type: nextActionType,
                script_id: nextScriptId,
                config: JSON.stringify(input.config !== undefined ? ensureJsonRecord(input.config) : ensureJsonRecord(existing.config)),
                sort_order: normalizeSortOrder(input.sortOrder) ?? existing.sort_order,
                _upl_updated_at: new Date(),
                _upl_updated_by: input.updatedBy ?? userId ?? null
            }

            const updated =
                input.expectedVersion !== undefined
                    ? await updateWithVersionCheck({
                          executor: tx,
                          schemaName,
                          tableName: TABLE,
                          entityId: actionId,
                          entityType: 'action',
                          expectedVersion: input.expectedVersion,
                          updateData
                      })
                    : await incrementVersion(tx, schemaName, TABLE, actionId, updateData)

            return this.normalizeRow(updated as unknown as StoredEntityActionRow)
        })
    }

    async delete(metahubId: string, actionId: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findRowById(schemaName, actionId)
        if (!existing) {
            throw new MetahubNotFoundError('Entity action', actionId)
        }

        await incrementVersion(this.exec, schemaName, TABLE, actionId, {
            _mhb_deleted: true,
            _mhb_deleted_at: new Date(),
            _mhb_deleted_by: userId ?? null,
            _upl_updated_at: new Date(),
            _upl_updated_by: userId ?? null
        })
    }
}
