import { qSchemaTable } from '@universo/database'
import { type SharedObjectKind, SHARED_OBJECT_KINDS, SHARED_POOL_TO_ENTITY_KIND, SHARED_POOL_TO_TARGET_KIND } from '@universo/types'
import { createCodenameVLC, createLocalizedContent } from '@universo/utils'
import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

type SharedContainerRow = {
    id: string
    kind: SharedObjectKind
}

export type SharedContainerDescriptor = {
    codename: string
    title: string
    description: string
}

export const SHARED_CONTAINER_DESCRIPTORS: Record<SharedObjectKind, SharedContainerDescriptor> = {
    [SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL]: {
        codename: 'shared_attributes',
        title: 'Shared Attributes',
        description: 'Virtual container for metahub-wide shared attributes'
    },
    [SHARED_OBJECT_KINDS.SHARED_SET_POOL]: {
        codename: 'shared_constants',
        title: 'Shared Constants',
        description: 'Virtual container for metahub-wide shared constants'
    },
    [SHARED_OBJECT_KINDS.SHARED_ENUM_POOL]: {
        codename: 'shared_values',
        title: 'Shared Values',
        description: 'Virtual container for metahub-wide shared enumeration values'
    }
}

export class SharedContainerService {
    constructor(private readonly exec: DbExecutor, private readonly schemaService: MetahubSchemaService) {}

    private buildLockKey(schemaName: string, sharedKind: SharedObjectKind): string {
        return `shared-container:${schemaName}:${sharedKind}`
    }

    private async acquireContainerLock(db: SqlQueryable, schemaName: string, sharedKind: SharedObjectKind): Promise<void> {
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [this.buildLockKey(schemaName, sharedKind)])
    }

    private async findExistingContainerId(schemaName: string, sharedKind: SharedObjectKind, db: SqlQueryable): Promise<string | null> {
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const existing = await queryOne<SharedContainerRow>(
            db,
            `SELECT id, kind
             FROM ${qt}
             WHERE kind = $1 AND ${ACTIVE}
             LIMIT 1`,
            [sharedKind]
        )

        return existing?.id ?? null
    }

    private async createContainer(schemaName: string, sharedKind: SharedObjectKind, db: SqlQueryable, userId?: string): Promise<string> {
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const descriptor = SHARED_CONTAINER_DESCRIPTORS[sharedKind]
        const now = new Date()

        const created = await queryOneOrThrow<{ id: string }>(
            db,
            `INSERT INTO ${qt}
                (kind, codename, table_name, presentation, config,
                 _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
             VALUES ($1, $2::jsonb, NULL, $3::jsonb, $4::jsonb, $5, $6, $5, $6)
             RETURNING id`,
            [
                sharedKind,
                JSON.stringify(createCodenameVLC('en', descriptor.codename)),
                JSON.stringify({
                    name: createLocalizedContent('en', descriptor.title),
                    description: createLocalizedContent('en', descriptor.description)
                }),
                JSON.stringify({
                    isVirtualContainer: true,
                    sortOrder: 0,
                    sharedEntityKind: SHARED_POOL_TO_ENTITY_KIND[sharedKind],
                    targetObjectKind: SHARED_POOL_TO_TARGET_KIND[sharedKind]
                }),
                now,
                userId ?? null
            ],
            undefined,
            `Failed to create shared container for ${sharedKind}`
        )

        return created.id
    }

    private async resolveContainerObjectIdInRunner(
        schemaName: string,
        sharedKind: SharedObjectKind,
        db: SqlQueryable,
        userId?: string
    ): Promise<string> {
        const existingBeforeLock = await this.findExistingContainerId(schemaName, sharedKind, db)
        if (existingBeforeLock) {
            return existingBeforeLock
        }

        await this.acquireContainerLock(db, schemaName, sharedKind)

        const existingAfterLock = await this.findExistingContainerId(schemaName, sharedKind, db)
        if (existingAfterLock) {
            return existingAfterLock
        }

        return this.createContainer(schemaName, sharedKind, db, userId)
    }

    async resolveContainerObjectId(metahubId: string, sharedKind: SharedObjectKind, db?: SqlQueryable, userId?: string): Promise<string> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        if (db) {
            return this.resolveContainerObjectIdInRunner(schemaName, sharedKind, db, userId)
        }

        return this.exec.transaction(async (tx: SqlQueryable) => this.resolveContainerObjectIdInRunner(schemaName, sharedKind, tx, userId))
    }

    async findContainerObjectId(
        metahubId: string,
        sharedKind: SharedObjectKind,
        userId?: string,
        db?: SqlQueryable
    ): Promise<string | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.findExistingContainerId(schemaName, sharedKind, db ?? this.exec)
    }

    async findAllContainerObjectIds(
        metahubId: string,
        userId?: string,
        db?: SqlQueryable
    ): Promise<Partial<Record<SharedObjectKind, string>>> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const runner = db ?? this.exec
        const rows = await queryMany<SharedContainerRow>(
            runner,
            `SELECT id, kind
             FROM ${qt}
             WHERE kind = ANY($1::text[])
               AND ${ACTIVE}
             ORDER BY kind ASC`,
            [Object.values(SHARED_OBJECT_KINDS)]
        )

        return rows.reduce<Partial<Record<SharedObjectKind, string>>>((acc, row) => {
            acc[row.kind] = row.id
            return acc
        }, {})
    }

    async getContainerObjectIds(metahubId: string, userId?: string, db?: SqlQueryable): Promise<string[]> {
        const items = await this.findAllContainerObjectIds(metahubId, userId, db)
        return Object.values(items)
    }

    async resolveAllContainerObjectIds(metahubId: string, userId?: string, db?: SqlQueryable): Promise<Record<SharedObjectKind, string>> {
        const kinds = Object.values(SHARED_OBJECT_KINDS)
        const entries = await Promise.all(
            kinds.map(async (sharedKind) => [sharedKind, await this.resolveContainerObjectId(metahubId, sharedKind, db, userId)] as const)
        )

        return Object.fromEntries(entries) as Record<SharedObjectKind, string>
    }
}
