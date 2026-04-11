import { qSchemaTable } from '@universo/database'
import { SCRIPT_LIFECYCLE_EVENTS, isEnabledComponentConfig } from '@universo/types'
import { queryMany, queryOne, queryOneOrThrow, type DbExecutor, type SqlQueryable } from '@universo/utils/database'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { EntityTypeService } from './EntityTypeService'

const TABLE = '_mhb_event_bindings'
const OBJECTS_TABLE = '_mhb_objects'
const ACTIONS_TABLE = '_mhb_actions'
const ACTIVE_CLAUSE = '_upl_deleted = false AND _mhb_deleted = false'
const ENTITY_EVENT_NAMES = [...SCRIPT_LIFECYCLE_EVENTS, 'onValidate', 'beforeWrite', 'afterWrite'] as const

type JsonRecord = Record<string, unknown>
type EntityEventName = (typeof ENTITY_EVENT_NAMES)[number] | (string & {})

interface StoredEventBindingRow {
    id: string
    object_id: string
    event_name: string
    action_id: string
    priority: number
    is_active: boolean
    config: unknown
    _upl_version?: number
    _upl_updated_at?: string | Date | null
}

interface StoredObjectKindRow {
    id: string
    kind: string
}

interface StoredActionScopeRow {
    id: string
    object_id: string
}

export interface MetahubEventBinding {
    id: string
    objectId: string
    eventName: EntityEventName
    actionId: string
    priority: number
    isActive: boolean
    config: JsonRecord
    version: number
    updatedAt: string | null
}

export interface CreateEventBindingInput {
    objectId: string
    eventName: EntityEventName
    actionId: string
    priority?: number
    isActive?: boolean
    config?: JsonRecord
    createdBy?: string | null
}

export interface UpdateEventBindingInput {
    eventName?: EntityEventName
    actionId?: string
    priority?: number
    isActive?: boolean
    config?: JsonRecord
    updatedBy?: string | null
    expectedVersion?: number
}

const ensureJsonRecord = (value: unknown): JsonRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as JsonRecord
}

const normalizePriority = (value: unknown): number => {
    if (value === undefined || value === null) return 0
    const numeric = Number(value)
    if (!Number.isInteger(numeric)) {
        throw new MetahubValidationError('Event binding priority must be an integer')
    }
    return numeric
}

const normalizeEventName = (value: EntityEventName): EntityEventName => {
    const normalized = String(value).trim()
    if (!ENTITY_EVENT_NAMES.includes(normalized as (typeof ENTITY_EVENT_NAMES)[number])) {
        throw new MetahubValidationError('Unsupported entity event name', {
            eventName: normalized,
            allowedEventNames: [...ENTITY_EVENT_NAMES]
        })
    }
    return normalized as EntityEventName
}

export class EventBindingService {
    constructor(
        private readonly exec: DbExecutor,
        private readonly schemaService: MetahubSchemaService,
        private readonly entityTypeService: EntityTypeService
    ) {}

    private normalizeRow(row: StoredEventBindingRow): MetahubEventBinding {
        return {
            id: row.id,
            objectId: row.object_id,
            eventName: row.event_name as EntityEventName,
            actionId: row.action_id,
            priority: Number(row.priority ?? 0),
            isActive: row.is_active !== false,
            config: ensureJsonRecord(row.config),
            version: Number(row._upl_version ?? 1),
            updatedAt:
                row._upl_updated_at instanceof Date
                    ? row._upl_updated_at.toISOString()
                    : typeof row._upl_updated_at === 'string'
                    ? row._upl_updated_at
                    : null
        }
    }

    private async findRowById(schemaName: string, bindingId: string, db: SqlQueryable = this.exec): Promise<StoredEventBindingRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<StoredEventBindingRow>(db, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`, [bindingId])
    }

    async getById(metahubId: string, bindingId: string, userId?: string): Promise<MetahubEventBinding | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.findRowById(schemaName, bindingId)
        return row ? this.normalizeRow(row) : null
    }

    async listActiveBindingsInSchema(
        schemaName: string,
        objectId: string,
        eventName: EntityEventName,
        db: SqlQueryable = this.exec
    ): Promise<MetahubEventBinding[]> {
        const qt = qSchemaTable(schemaName, TABLE)
        const rows = await queryMany<StoredEventBindingRow>(
            db,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND event_name = $2 AND is_active = true AND ${ACTIVE_CLAUSE}
             ORDER BY priority ASC, id ASC`,
            [objectId, eventName]
        )

        return rows.map((row) => this.normalizeRow(row))
    }

    private async findObject(schemaName: string, objectId: string, db: SqlQueryable = this.exec): Promise<StoredObjectKindRow | null> {
        const qt = qSchemaTable(schemaName, OBJECTS_TABLE)
        return queryOne<StoredObjectKindRow>(db, `SELECT id, kind FROM ${qt} WHERE id = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`, [objectId])
    }

    private async assertObjectSupportsEvents(schemaName: string, objectId: string, db: SqlQueryable): Promise<void> {
        const objectRow = await this.findObject(schemaName, objectId, db)
        if (!objectRow) {
            throw new MetahubNotFoundError('Metahub object', objectId)
        }

        const typeDefinition = await this.entityTypeService.resolveTypeInSchema(schemaName, objectRow.kind, db)
        if (!typeDefinition || !isEnabledComponentConfig(typeDefinition.components.events)) {
            throw new MetahubValidationError('The target object type does not enable events', {
                objectId,
                kind: objectRow.kind
            })
        }
    }

    private async findAction(schemaName: string, actionId: string, db: SqlQueryable): Promise<StoredActionScopeRow | null> {
        const qt = qSchemaTable(schemaName, ACTIONS_TABLE)
        return queryOne<StoredActionScopeRow>(db, `SELECT id, object_id FROM ${qt} WHERE id = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`, [actionId])
    }

    private async assertActionOwnership(schemaName: string, objectId: string, actionId: string, db: SqlQueryable): Promise<void> {
        const actionRow = await this.findAction(schemaName, actionId, db)
        if (!actionRow) {
            throw new MetahubNotFoundError('Entity action', actionId)
        }
        if (actionRow.object_id !== objectId) {
            throw new MetahubValidationError('Event bindings can only reference actions owned by the same object', {
                objectId,
                actionId,
                actionObjectId: actionRow.object_id
            })
        }
    }

    private async findConflict(
        schemaName: string,
        objectId: string,
        eventName: EntityEventName,
        actionId: string,
        db: SqlQueryable = this.exec
    ): Promise<StoredEventBindingRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<StoredEventBindingRow>(
            db,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND event_name = $2 AND action_id = $3 AND ${ACTIVE_CLAUSE}
             LIMIT 1`,
            [objectId, eventName, actionId]
        )
    }

    async listByObjectId(metahubId: string, objectId: string, userId?: string): Promise<MetahubEventBinding[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, TABLE)
        const rows = await queryMany<StoredEventBindingRow>(
            this.exec,
            `SELECT * FROM ${qt} WHERE object_id = $1 AND ${ACTIVE_CLAUSE} ORDER BY event_name ASC, priority ASC, id ASC`,
            [objectId]
        )
        return rows.map((row) => this.normalizeRow(row))
    }

    async create(metahubId: string, input: CreateEventBindingInput, userId?: string): Promise<MetahubEventBinding> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const eventName = normalizeEventName(input.eventName)
        const qt = qSchemaTable(schemaName, TABLE)

        return this.exec.transaction(async (tx) => {
            await this.assertObjectSupportsEvents(schemaName, input.objectId, tx)
            await this.assertActionOwnership(schemaName, input.objectId, input.actionId, tx)

            const conflict = await this.findConflict(schemaName, input.objectId, eventName, input.actionId, tx)
            if (conflict) {
                throw new MetahubConflictError('Event binding already exists for the same object, event, and action', {
                    objectId: input.objectId,
                    eventName,
                    actionId: input.actionId,
                    existingId: conflict.id
                })
            }

            const created = await queryOneOrThrow<StoredEventBindingRow>(
                tx,
                `INSERT INTO ${qt} (
                    object_id,
                    event_name,
                    action_id,
                    priority,
                    is_active,
                    config,
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
                    $1, $2, $3, $4, $5, $6::jsonb,
                    $7, $8, $7, $8, 1, false, false, false, true, false, false
                 )
                 RETURNING *`,
                [
                    input.objectId,
                    eventName,
                    input.actionId,
                    normalizePriority(input.priority),
                    input.isActive !== false,
                    JSON.stringify(ensureJsonRecord(input.config)),
                    new Date(),
                    input.createdBy ?? userId ?? null
                ]
            )

            return this.normalizeRow(created)
        })
    }

    async update(metahubId: string, bindingId: string, input: UpdateEventBindingInput, userId?: string): Promise<MetahubEventBinding> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findRowById(schemaName, bindingId)
        if (!existing) {
            throw new MetahubNotFoundError('Event binding', bindingId)
        }

        return this.exec.transaction(async (tx) => {
            await this.assertObjectSupportsEvents(schemaName, existing.object_id, tx)

            const nextEventName =
                input.eventName !== undefined ? normalizeEventName(input.eventName) : (existing.event_name as EntityEventName)
            const nextActionId = input.actionId ?? existing.action_id
            await this.assertActionOwnership(schemaName, existing.object_id, nextActionId, tx)

            const conflict = await this.findConflict(schemaName, existing.object_id, nextEventName, nextActionId, tx)
            if (conflict && conflict.id !== existing.id) {
                throw new MetahubConflictError('Event binding already exists for the same object, event, and action', {
                    objectId: existing.object_id,
                    eventName: nextEventName,
                    actionId: nextActionId,
                    existingId: conflict.id
                })
            }

            const updateData = {
                event_name: nextEventName,
                action_id: nextActionId,
                priority: normalizePriority(input.priority ?? existing.priority),
                is_active: input.isActive ?? existing.is_active,
                config: JSON.stringify(input.config !== undefined ? ensureJsonRecord(input.config) : ensureJsonRecord(existing.config)),
                _upl_updated_at: new Date(),
                _upl_updated_by: input.updatedBy ?? userId ?? null
            }

            const updated =
                input.expectedVersion !== undefined
                    ? await updateWithVersionCheck({
                          executor: tx,
                          schemaName,
                          tableName: TABLE,
                          entityId: bindingId,
                          entityType: 'event_binding',
                          expectedVersion: input.expectedVersion,
                          updateData
                      })
                    : await incrementVersion(tx, schemaName, TABLE, bindingId, updateData)

            return this.normalizeRow(updated as unknown as StoredEventBindingRow)
        })
    }

    async delete(metahubId: string, bindingId: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findRowById(schemaName, bindingId)
        if (!existing) {
            throw new MetahubNotFoundError('Event binding', bindingId)
        }

        await incrementVersion(this.exec, schemaName, TABLE, bindingId, {
            _mhb_deleted: true,
            _mhb_deleted_at: new Date(),
            _mhb_deleted_by: userId ?? null,
            _upl_updated_at: new Date(),
            _upl_updated_by: userId ?? null
        })
    }
}
