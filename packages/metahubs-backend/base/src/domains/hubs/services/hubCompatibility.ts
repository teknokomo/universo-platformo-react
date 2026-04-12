import { qSchemaTable } from '@universo/database'
import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { queryMany } from '@universo/utils/database'

import type { EntityTypeService } from '../../entities/services/EntityTypeService'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { createLegacyCompatibleKindSet, resolveLegacyCompatibleKinds } from '../../shared/legacyCompatibility'

export type BlockingHubObject = {
    id: string
    name: unknown
    codename: string
}

export type HubCompatibilityContext = {
    hubKinds: string[]
    hubKindSet: Set<string>
    catalogKinds: string[]
    catalogKindSet: Set<string>
    setKinds: string[]
    setKindSet: Set<string>
    enumerationKinds: string[]
    enumerationKindSet: Set<string>
    relatedKinds: string[]
}

export const loadHubCompatibilityContext = async (
    entityTypeService: Pick<EntityTypeService, 'listCustomTypes'>,
    metahubId: string,
    userId?: string
): Promise<HubCompatibilityContext> => {
    const [hubKinds, catalogKinds, setKinds, enumerationKinds] = await Promise.all([
        resolveLegacyCompatibleKinds(entityTypeService, metahubId, 'hub', userId),
        resolveLegacyCompatibleKinds(entityTypeService, metahubId, 'catalog', userId),
        resolveLegacyCompatibleKinds(entityTypeService, metahubId, 'set', userId),
        resolveLegacyCompatibleKinds(entityTypeService, metahubId, 'enumeration', userId)
    ])

    return {
        hubKinds,
        hubKindSet: createLegacyCompatibleKindSet(hubKinds),
        catalogKinds,
        catalogKindSet: createLegacyCompatibleKindSet(catalogKinds),
        setKinds,
        setKindSet: createLegacyCompatibleKindSet(setKinds),
        enumerationKinds,
        enumerationKindSet: createLegacyCompatibleKindSet(enumerationKinds),
        relatedKinds: [...new Set([...catalogKinds, ...setKinds, ...enumerationKinds])]
    }
}

export const findBlockingHubObjects = async ({
    metahubId,
    hubId,
    schemaService,
    userId,
    db,
    compatibility
}: {
    metahubId: string
    hubId: string
    schemaService: MetahubSchemaService
    userId: string | undefined
    db: SqlQueryable
    compatibility: HubCompatibilityContext
}) => {
    const schemaName = await schemaService.ensureSchema(metahubId, userId)
    const objQt = qSchemaTable(schemaName, '_mhb_objects')

    const objects = compatibility.relatedKinds.length
        ? await queryMany<{
              id: string
              kind: string
              codename: string
              presentation?: { name?: unknown }
          }>(
              db,
              `SELECT id, kind, codename, presentation FROM ${objQt}
               WHERE kind = ANY($1::text[])
                 AND config->'hubs' @> $2::jsonb
                 AND jsonb_typeof(config->'hubs') = 'array'
                 AND COALESCE((config->>'isRequiredHub')::boolean, false) = true
                 AND jsonb_array_length(config->'hubs') = 1`,
              [compatibility.relatedKinds, JSON.stringify([hubId])]
          )
        : []

    const blockingCatalogs: BlockingHubObject[] = []
    const blockingSets: BlockingHubObject[] = []
    const blockingEnumerations: BlockingHubObject[] = []
    const blockingChildHubs: BlockingHubObject[] = []

    for (const objectRow of objects) {
        const mapped: BlockingHubObject = {
            id: objectRow.id,
            name: objectRow.presentation?.name,
            codename: objectRow.codename
        }

        if (compatibility.catalogKindSet.has(objectRow.kind)) {
            blockingCatalogs.push(mapped)
            continue
        }

        if (compatibility.setKindSet.has(objectRow.kind)) {
            blockingSets.push(mapped)
            continue
        }

        if (compatibility.enumerationKindSet.has(objectRow.kind)) {
            blockingEnumerations.push(mapped)
        }
    }

    const childHubs = await queryMany<{
        id: string
        codename: string
        presentation?: { name?: unknown }
    }>(
        db,
        `SELECT id, codename, presentation FROM ${objQt}
         WHERE kind = ANY($1::text[]) AND _upl_deleted = false AND _mhb_deleted = false
           AND config->>'parentHubId' = $2`,
        [compatibility.hubKinds, hubId]
    )

    for (const childHub of childHubs) {
        blockingChildHubs.push({
            id: childHub.id,
            name: childHub.presentation?.name,
            codename: childHub.codename
        })
    }

    return {
        blockingCatalogs,
        blockingSets,
        blockingEnumerations,
        blockingChildHubs
    }
}

export const removeHubFromObjectAssociations = async ({
    metahubId,
    hubId,
    schemaService,
    userId,
    hubExec,
    compatibility
}: {
    metahubId: string
    hubId: string
    schemaService: MetahubSchemaService
    userId: string | undefined
    hubExec: DbExecutor
    compatibility: HubCompatibilityContext
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
            [compatibility.relatedKinds, JSON.stringify([hubId])]
        )

        if (linkedObjects.length === 0) {
            return
        }

        const now = new Date()
        for (const objectRow of linkedObjects) {
            const currentConfig =
                objectRow.config && typeof objectRow.config === 'object' ? { ...(objectRow.config as Record<string, unknown>) } : {}

            const currentHubs = Array.isArray(currentConfig.hubs) ? (currentConfig.hubs as unknown[]) : []
            const filteredHubIds = currentHubs.filter((value): value is string => typeof value === 'string' && value !== hubId)

            if (filteredHubIds.length === currentHubs.length) {
                continue
            }

            currentConfig.hubs = filteredHubIds

            await trx.query(
                `UPDATE ${objQt}
                 SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                 WHERE id = $4`,
                [JSON.stringify(currentConfig), now, userId ?? null, objectRow.id]
            )
        }
    })
}