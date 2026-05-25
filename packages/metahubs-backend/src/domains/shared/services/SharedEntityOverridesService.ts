import { qSchemaTable } from '@universo/database'
import {
    resolveSharedBehavior,
    type SharedBehavior,
    type SharedEntityKind,
    SHARED_ENTITY_KIND_TO_POOL_KIND,
    SHARED_POOL_TO_TARGET_KIND
} from '@universo/types'
import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { mhbSoftDelete } from '../../../persistence/metahubsQueryHelpers'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubNotFoundError, MetahubValidationError } from '../domainErrors'

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
const ACTIVE_ENTITY = 'entity._upl_deleted = false AND entity._mhb_deleted = false'
const ACTIVE_CONTAINER = 'container._upl_deleted = false AND container._mhb_deleted = false'

type SharedEntityMetadataRow = {
    id: string
    object_id: string
    shared_behavior: SharedBehavior | null
}

type SharedEntityDefinition = {
    tableName: '_mhb_components' | '_mhb_constants' | '_mhb_values'
    sharedBehaviorSql: string
}

export interface SharedEntityOverrideRow {
    id: string
    entityKind: SharedEntityKind
    sharedEntityId: string
    targetObjectId: string
    isExcluded: boolean
    isActive: boolean | null
    sortOrder: number | null
    version: number
}

const SHARED_ENTITY_DEFINITIONS: Record<SharedEntityKind, SharedEntityDefinition> = {
    component: {
        tableName: '_mhb_components',
        sharedBehaviorSql: "COALESCE(ui_config->'sharedBehavior', '{}'::jsonb)"
    },
    constant: {
        tableName: '_mhb_constants',
        sharedBehaviorSql: "COALESCE(ui_config->'sharedBehavior', '{}'::jsonb)"
    },
    value: {
        tableName: '_mhb_values',
        sharedBehaviorSql: "COALESCE(presentation->'sharedBehavior', '{}'::jsonb)"
    }
}

const toNullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) {
        return null
    }

    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

const toBoolean = (value: unknown): boolean => value === true || value === 'true'

export class SharedEntityOverridesService {
    constructor(private readonly exec: DbExecutor, private readonly schemaService: MetahubSchemaService) {}

    private mapOverrideRow(row: Record<string, unknown>): SharedEntityOverrideRow {
        return {
            id: String(row.id),
            entityKind: row.entity_kind as SharedEntityKind,
            sharedEntityId: String(row.shared_entity_id),
            targetObjectId: String(row.target_object_id),
            isExcluded: toBoolean(row.is_excluded),
            isActive: row.is_active === null || row.is_active === undefined ? null : toBoolean(row.is_active),
            sortOrder: toNullableNumber(row.sort_order),
            version: Number(row._upl_version ?? 1)
        }
    }

    private async ensureSharedEntity(
        schemaName: string,
        entityKind: SharedEntityKind,
        sharedEntityId: string,
        db: SqlQueryable
    ): Promise<Required<SharedBehavior>> {
        const entityDef = SHARED_ENTITY_DEFINITIONS[entityKind]
        const entityTable = qSchemaTable(schemaName, entityDef.tableName)
        const objectsTable = qSchemaTable(schemaName, '_mhb_objects')
        const sharedPoolKind = SHARED_ENTITY_KIND_TO_POOL_KIND[entityKind]

        const row = await queryOne<SharedEntityMetadataRow>(
            db,
            `SELECT entity.id,
                    entity.object_id,
                    ${entityDef.sharedBehaviorSql} AS shared_behavior
             FROM ${entityTable} entity
             JOIN ${objectsTable} container ON container.id = entity.object_id
             WHERE entity.id = $1
               AND container.kind = $2
                             AND ${ACTIVE_ENTITY}
                             AND ${ACTIVE_CONTAINER}
             LIMIT 1`,
            [sharedEntityId, sharedPoolKind]
        )

        if (!row) {
            throw new MetahubNotFoundError(`Shared ${entityKind}`, sharedEntityId)
        }

        return resolveSharedBehavior((row.shared_behavior ?? undefined) as SharedBehavior | undefined)
    }

    private async ensureTargetObject(
        schemaName: string,
        entityKind: SharedEntityKind,
        targetObjectId: string,
        db: SqlQueryable
    ): Promise<void> {
        const objectsTable = qSchemaTable(schemaName, '_mhb_objects')
        const sharedPoolKind = SHARED_ENTITY_KIND_TO_POOL_KIND[entityKind]
        const targetKind = SHARED_POOL_TO_TARGET_KIND[sharedPoolKind]
        const row = await queryOne<{ id: string }>(
            db,
            `SELECT id
             FROM ${objectsTable}
             WHERE id = $1
               AND kind = $2
               AND ${ACTIVE}
             LIMIT 1`,
            [targetObjectId, targetKind]
        )

        if (!row) {
            throw new MetahubNotFoundError(targetKind, targetObjectId)
        }
    }

    private async getOverrideRow(
        schemaName: string,
        entityKind: SharedEntityKind,
        sharedEntityId: string,
        targetObjectId: string,
        db: SqlQueryable
    ): Promise<SharedEntityOverrideRow | null> {
        const qt = qSchemaTable(schemaName, '_mhb_shared_entity_overrides')
        const row = await queryOne<Record<string, unknown>>(
            db,
            `SELECT *
             FROM ${qt}
             WHERE entity_kind = $1
               AND shared_entity_id = $2
               AND target_object_id = $3
               AND ${ACTIVE}
             LIMIT 1`,
            [entityKind, sharedEntityId, targetObjectId]
        )

        return row ? this.mapOverrideRow(row) : null
    }

    private assertOverrideMutationAllowed(
        sharedBehavior: Required<SharedBehavior>,
        params: {
            isExcluded?: boolean
            isActive?: boolean | null
            sortOrder?: number | null
        }
    ): void {
        if (params.isExcluded === true && !sharedBehavior.canExclude) {
            throw new MetahubValidationError('This shared entity cannot be excluded from target objects', {
                field: 'isExcluded'
            })
        }

        if (params.isActive === false && !sharedBehavior.canDeactivate) {
            throw new MetahubValidationError('This shared entity cannot be deactivated in target objects', {
                field: 'isActive'
            })
        }

        if (params.sortOrder !== undefined && sharedBehavior.positionLocked) {
            throw new MetahubValidationError('This shared entity has a locked position and cannot be reordered', {
                field: 'sortOrder'
            })
        }
    }

    async findBySharedEntity(
        metahubId: string,
        entityKind: SharedEntityKind,
        sharedEntityId: string,
        userId?: string,
        db?: SqlQueryable
    ): Promise<SharedEntityOverrideRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_shared_entity_overrides')
        const runner = db ?? this.exec
        const rows = await queryMany<Record<string, unknown>>(
            runner,
            `SELECT *
             FROM ${qt}
             WHERE entity_kind = $1
               AND shared_entity_id = $2
               AND ${ACTIVE}
             ORDER BY COALESCE(sort_order, 2147483647) ASC, target_object_id ASC`,
            [entityKind, sharedEntityId]
        )

        return rows.map((row) => this.mapOverrideRow(row))
    }

    async findAll(metahubId: string, userId?: string, db?: SqlQueryable): Promise<SharedEntityOverrideRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_shared_entity_overrides')
        const runner = db ?? this.exec
        const rows = await queryMany<Record<string, unknown>>(
            runner,
            `SELECT *
             FROM ${qt}
             WHERE ${ACTIVE}
             ORDER BY entity_kind ASC, target_object_id ASC, COALESCE(sort_order, 2147483647) ASC, shared_entity_id ASC`,
            []
        )

        return rows.map((row) => this.mapOverrideRow(row))
    }

    async findByTargetObject(
        metahubId: string,
        entityKind: SharedEntityKind,
        targetObjectId: string,
        userId?: string,
        db?: SqlQueryable
    ): Promise<SharedEntityOverrideRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_shared_entity_overrides')
        const runner = db ?? this.exec
        const rows = await queryMany<Record<string, unknown>>(
            runner,
            `SELECT *
             FROM ${qt}
             WHERE entity_kind = $1
               AND target_object_id = $2
               AND ${ACTIVE}
             ORDER BY COALESCE(sort_order, 2147483647) ASC, shared_entity_id ASC`,
            [entityKind, targetObjectId]
        )

        return rows.map((row) => this.mapOverrideRow(row))
    }

    async upsertOverride(params: {
        metahubId: string
        entityKind: SharedEntityKind
        sharedEntityId: string
        targetObjectId: string
        isExcluded?: boolean
        isActive?: boolean | null
        sortOrder?: number | null
        userId?: string
        db?: SqlQueryable
    }): Promise<SharedEntityOverrideRow | null> {
        const schemaName = await this.schemaService.ensureSchema(params.metahubId, params.userId)
        const qt = qSchemaTable(schemaName, '_mhb_shared_entity_overrides')

        const runUpsert = async (runner: SqlQueryable) => {
            const sharedBehavior = await this.ensureSharedEntity(schemaName, params.entityKind, params.sharedEntityId, runner)
            await this.ensureTargetObject(schemaName, params.entityKind, params.targetObjectId, runner)
            this.assertOverrideMutationAllowed(sharedBehavior, {
                isExcluded: params.isExcluded,
                isActive: params.isActive,
                sortOrder: params.sortOrder
            })

            const existing = await this.getOverrideRow(schemaName, params.entityKind, params.sharedEntityId, params.targetObjectId, runner)
            const nextState = {
                isExcluded: params.isExcluded ?? existing?.isExcluded ?? false,
                isActive: params.isActive !== undefined ? params.isActive : existing?.isActive ?? null,
                sortOrder: params.sortOrder !== undefined ? params.sortOrder : existing?.sortOrder ?? null
            }

            const isDefaultState = nextState.isExcluded === false && nextState.isActive === null && nextState.sortOrder === null
            if (isDefaultState) {
                if (existing) {
                    await mhbSoftDelete(runner, schemaName, '_mhb_shared_entity_overrides', existing.id, params.userId ?? null)
                }
                return null
            }

            const now = new Date()
            const row = await queryOneOrThrow<Record<string, unknown>>(
                runner,
                `INSERT INTO ${qt}
                    (entity_kind, shared_entity_id, target_object_id, is_excluded, is_active, sort_order,
                     _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $8)
                 ON CONFLICT (entity_kind, shared_entity_id, target_object_id)
                 WHERE _upl_deleted = false AND _mhb_deleted = false
                 DO UPDATE SET is_excluded = EXCLUDED.is_excluded,
                               is_active = EXCLUDED.is_active,
                               sort_order = EXCLUDED.sort_order,
                               _upl_updated_at = EXCLUDED._upl_updated_at,
                               _upl_updated_by = EXCLUDED._upl_updated_by,
                               _upl_version = ${qt}._upl_version + 1
                 RETURNING *`,
                [
                    params.entityKind,
                    params.sharedEntityId,
                    params.targetObjectId,
                    nextState.isExcluded,
                    nextState.isActive,
                    nextState.sortOrder,
                    now,
                    params.userId ?? null
                ],
                undefined,
                'Failed to upsert shared entity override'
            )

            return this.mapOverrideRow(row)
        }

        if (params.db) {
            return runUpsert(params.db)
        }

        return this.exec.transaction(async (tx: SqlQueryable) => runUpsert(tx))
    }

    async clearOverride(
        metahubId: string,
        entityKind: SharedEntityKind,
        sharedEntityId: string,
        targetObjectId: string,
        userId?: string,
        db?: SqlQueryable
    ): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const runner = db ?? this.exec
        const existing = await this.getOverrideRow(schemaName, entityKind, sharedEntityId, targetObjectId, runner)
        if (!existing) {
            return
        }

        await mhbSoftDelete(runner, schemaName, '_mhb_shared_entity_overrides', existing.id, userId ?? null)
    }

    async cleanupForDeletedEntity(
        metahubId: string,
        entityKind: SharedEntityKind,
        sharedEntityId: string,
        userId?: string,
        db?: SqlQueryable
    ): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_shared_entity_overrides')
        const runner = db ?? this.exec
        const rows = await runner.query<{ id: string }>(
            `UPDATE ${qt}
             SET _upl_deleted = true,
                 _upl_deleted_at = $3,
                 _upl_deleted_by = $4,
                 _mhb_deleted = true,
                 _mhb_deleted_at = $3,
                 _mhb_deleted_by = $4,
                 _upl_updated_at = $3,
                 _upl_updated_by = $4,
                 _upl_version = _upl_version + 1
             WHERE entity_kind = $1
               AND shared_entity_id = $2
               AND ${ACTIVE}
             RETURNING id`,
            [entityKind, sharedEntityId, new Date(), userId ?? null]
        )

        return rows.length
    }

    async cleanupForDeletedTargetObject(metahubId: string, targetObjectId: string, userId?: string, db?: SqlQueryable): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_shared_entity_overrides')
        const runner = db ?? this.exec
        const rows = await runner.query<{ id: string }>(
            `UPDATE ${qt}
             SET _upl_deleted = true,
                 _upl_deleted_at = $2,
                 _upl_deleted_by = $3,
                 _mhb_deleted = true,
                 _mhb_deleted_at = $2,
                 _mhb_deleted_by = $3,
                 _upl_updated_at = $2,
                 _upl_updated_by = $3,
                 _upl_version = _upl_version + 1
             WHERE target_object_id = $1
               AND ${ACTIVE}
             RETURNING id`,
            [targetObjectId, new Date(), userId ?? null]
        )

        return rows.length
    }

    async purgeDeletedEntityOverrides(
        metahubId: string,
        entityKind: SharedEntityKind,
        sharedEntityId: string,
        userId?: string,
        db?: SqlQueryable
    ): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_shared_entity_overrides')
        const runner = db ?? this.exec
        const rows = await runner.query<{ id: string }>(
            `DELETE FROM ${qt}
             WHERE entity_kind = $1
               AND shared_entity_id = $2
             RETURNING id`,
            [entityKind, sharedEntityId]
        )

        return rows.length
    }

    async purgeDeletedTargetOverrides(metahubId: string, targetObjectId: string, userId?: string, db?: SqlQueryable): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_shared_entity_overrides')
        const runner = db ?? this.exec
        const rows = await runner.query<{ id: string }>(
            `DELETE FROM ${qt}
             WHERE target_object_id = $1
             RETURNING id`,
            [targetObjectId]
        )

        return rows.length
    }
}
