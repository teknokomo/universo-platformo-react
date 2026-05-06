import { qSchemaTable } from '@universo/database'
import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { queryMany } from '@universo/utils/database'
import { isEnabledComponentConfig } from '@universo/types'

import type { EntityTypeService } from '../services/EntityTypeService'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { createEntityMetadataKindSet, resolveEntityMetadataKinds } from '../../shared/entityMetadataKinds'

export type BlockingTreeDependency = {
    id: string
    kind: string
    name: unknown
    codename: unknown
    typeName?: unknown
    typeNameKey?: string
}

export type TreeEntityContext = {
    hubKinds: string[]
    hubKindSet: Set<string>
    linkedCollectionKinds: string[]
    linkedCollectionKindSet: Set<string>
    valueGroupKinds: string[]
    valueGroupKindSet: Set<string>
    optionListKinds: string[]
    optionListKindSet: Set<string>
    hubAssignableKinds: string[]
    hubAssignableKindSet: Set<string>
    hubAssignableTypeByKind: Map<string, { name?: unknown; nameKey?: string }>
    relatedKinds: string[]
}

export const loadTreeEntityContext = async (
    entityTypeService: Pick<EntityTypeService, 'listEditableTypes'>,
    metahubId: string,
    userId?: string
): Promise<TreeEntityContext> => {
    const [hubKinds, linkedCollectionKinds, valueGroupKinds, optionListKinds, editableTypes] = await Promise.all([
        resolveEntityMetadataKinds(entityTypeService, metahubId, 'hub', userId),
        resolveEntityMetadataKinds(entityTypeService, metahubId, 'catalog', userId),
        resolveEntityMetadataKinds(entityTypeService, metahubId, 'set', userId),
        resolveEntityMetadataKinds(entityTypeService, metahubId, 'enumeration', userId),
        entityTypeService.listEditableTypes(metahubId, userId)
    ])
    const hubKindSet = createEntityMetadataKindSet(hubKinds)
    const hubAssignableTypes = editableTypes.filter(
        (type) => !hubKindSet.has(type.kindKey) && isEnabledComponentConfig(type.components.treeAssignment)
    )
    const hubAssignableKinds = [...new Set(hubAssignableTypes.map((type) => type.kindKey))]
    const hubAssignableTypeByKind = new Map<string, { name?: unknown; nameKey?: string }>()

    for (const type of editableTypes) {
        hubAssignableTypeByKind.set(type.kindKey, {
            name: type.presentation?.name ?? type.codename,
            nameKey: type.ui?.nameKey
        })
    }

    return {
        hubKinds,
        hubKindSet,
        linkedCollectionKinds,
        linkedCollectionKindSet: createEntityMetadataKindSet(linkedCollectionKinds),
        valueGroupKinds,
        valueGroupKindSet: createEntityMetadataKindSet(valueGroupKinds),
        optionListKinds,
        optionListKindSet: createEntityMetadataKindSet(optionListKinds),
        hubAssignableKinds,
        hubAssignableKindSet: createEntityMetadataKindSet(hubAssignableKinds),
        hubAssignableTypeByKind,
        relatedKinds: hubAssignableKinds
    }
}

export const findBlockingTreeDependencies = async ({
    metahubId,
    treeEntityId,
    schemaService,
    userId,
    db,
    compatibility
}: {
    metahubId: string
    treeEntityId: string
    schemaService: MetahubSchemaService
    userId: string | undefined
    db: SqlQueryable
    compatibility: TreeEntityContext
}) => {
    const schemaName = await schemaService.ensureSchema(metahubId, userId)
    const objQt = qSchemaTable(schemaName, '_mhb_objects')

    const objects = compatibility.relatedKinds.length
        ? await queryMany<{
              id: string
              kind: string
              codename: unknown
              presentation?: { name?: unknown }
          }>(
              db,
              `SELECT id, kind, codename, presentation FROM ${objQt}
               WHERE kind = ANY($1::text[])
                 AND config->'hubs' @> $2::jsonb
                 AND jsonb_typeof(config->'hubs') = 'array'
                 AND COALESCE((config->>'isRequiredHub')::boolean, false) = true
                 AND jsonb_array_length(config->'hubs') = 1`,
              [compatibility.relatedKinds, JSON.stringify([treeEntityId])]
          )
        : []

    const blockingChildTreeEntities: BlockingTreeDependency[] = []
    const blockingRelatedObjects: BlockingTreeDependency[] = []

    for (const objectRow of objects) {
        blockingRelatedObjects.push({
            id: objectRow.id,
            kind: objectRow.kind,
            name: objectRow.presentation?.name,
            codename: objectRow.codename,
            typeName: compatibility.hubAssignableTypeByKind.get(objectRow.kind)?.name,
            typeNameKey: compatibility.hubAssignableTypeByKind.get(objectRow.kind)?.nameKey
        })
    }

    const childHubs = await queryMany<{
        id: string
        codename: unknown
        presentation?: { name?: unknown }
    }>(
        db,
        `SELECT id, codename, presentation FROM ${objQt}
         WHERE kind = ANY($1::text[]) AND _upl_deleted = false AND _mhb_deleted = false
           AND config->>'parentTreeEntityId' = $2`,
        [compatibility.hubKinds, treeEntityId]
    )

    for (const childHub of childHubs) {
        blockingChildTreeEntities.push({
            id: childHub.id,
            kind: compatibility.hubKinds[0] ?? 'hub',
            name: childHub.presentation?.name,
            codename: childHub.codename,
            typeNameKey: 'metahubs:hubs.title'
        })
    }

    return {
        blockingChildTreeEntities,
        blockingRelatedObjects
    }
}

export const removeHubFromObjectAssociations = async ({
    metahubId,
    treeEntityId,
    schemaService,
    userId,
    hubExec,
    compatibility
}: {
    metahubId: string
    treeEntityId: string
    schemaService: MetahubSchemaService
    userId: string | undefined
    hubExec: DbExecutor
    compatibility: TreeEntityContext
}) => {
    const schemaName = await schemaService.ensureSchema(metahubId, userId)
    const objQt = qSchemaTable(schemaName, '_mhb_objects')

    await hubExec.transaction(async (trx: SqlQueryable) => {
        if (compatibility.relatedKinds.length === 0) {
            return
        }

        const linkedObjects = await queryMany<{ id: string; config?: Record<string, unknown> }>(
            trx,
            `SELECT id, config FROM ${objQt}
             WHERE kind = ANY($1::text[])
               AND _upl_deleted = false AND _mhb_deleted = false
               AND config->'hubs' @> $2::jsonb
             FOR UPDATE`,
            [compatibility.relatedKinds, JSON.stringify([treeEntityId])]
        )

        if (linkedObjects.length === 0) {
            return
        }

        const now = new Date()
        for (const objectRow of linkedObjects) {
            const currentConfig =
                objectRow.config && typeof objectRow.config === 'object' ? { ...(objectRow.config as Record<string, unknown>) } : {}

            const currentHubs = Array.isArray(currentConfig.hubs) ? (currentConfig.hubs as unknown[]) : []
            const filteredTreeEntityIds = currentHubs.filter(
                (value): value is string => typeof value === 'string' && value !== treeEntityId
            )

            if (filteredTreeEntityIds.length === currentHubs.length) {
                continue
            }

            currentConfig.hubs = filteredTreeEntityIds

            await trx.query(
                `UPDATE ${objQt}
                 SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                 WHERE id = $4`,
                [JSON.stringify(currentConfig), now, userId ?? null, objectRow.id]
            )
        }
    })
}
