import { ENTITY_SURFACE_LABELS, resolveEntitySurfaceKey, type BuiltinEntityKind } from '@universo/types'
import { qSchemaTable } from '@universo/database'
import { queryMany, queryOne } from '@universo/utils/database'

import { generateTableName } from '../../ddl'
import { codenamePrimaryTextSql } from '../../shared/codename'
import { resolveEntityMetadataKinds, resolveEntityMetadataSettingKey } from '../../shared/entityMetadataKinds'
import { findBlockingObjectCollectionReferences, isObjectCollectionCompatibleResolvedType } from '../children/objectCollectionContext'
import { findBlockingTreeDependencies, loadTreeEntityContext, removeHubFromObjectAssociations } from '../children/treeEntityContext'
import type { EntityBehaviorBlockingState, EntityBehaviorDeleteContext, EntityBehaviorDeletePlan } from './EntityBehaviorService'

const getSurfaceLabels = (kindKey: BuiltinEntityKind) => {
    const surfaceKey = resolveEntitySurfaceKey(kindKey)
    return surfaceKey ? ENTITY_SURFACE_LABELS[surfaceKey] : { singular: 'Entity', plural: 'Entities' }
}

export const resolveBuiltinGeneratedTableName = (kindKey: BuiltinEntityKind, objectId: string): string | null =>
    resolveEntitySurfaceKey(kindKey) === 'objectCollection' ? generateTableName(objectId, kindKey) : null

type PageLayoutReference = {
    source: 'layoutWidget' | 'layoutWidgetOverride'
    layoutId: string
    widgetId: string
    layoutName: unknown
    reference: string
}

const findBlockingPageLayoutReferences = async ({
    metahubId,
    entityId,
    userId,
    exec,
    schemaService
}: Pick<EntityBehaviorDeleteContext, 'metahubId' | 'entityId' | 'userId' | 'exec' | 'schemaService'>): Promise<PageLayoutReference[]> => {
    const schemaName = await schemaService.ensureSchema(metahubId, userId)
    const objectsQt = qSchemaTable(schemaName, '_mhb_objects')
    const layoutsQt = qSchemaTable(schemaName, '_mhb_layouts')
    const widgetsQt = qSchemaTable(schemaName, '_mhb_widgets')
    const overridesQt = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
    const codenameSql = codenamePrimaryTextSql('codename')

    const page = await queryOne<{ id: string; codename: string }>(
        exec,
        `SELECT id, ${codenameSql} AS codename
           FROM ${objectsQt}
          WHERE id = $1 AND kind = 'page' AND _upl_deleted = false AND _mhb_deleted = false
          LIMIT 1`,
        [entityId]
    )
    const identifiers = [page?.id, page?.codename].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    if (identifiers.length === 0) {
        return []
    }

    const widgetRows = await queryMany<PageLayoutReference>(
        exec,
        `SELECT 'layoutWidget'::text AS source,
                l.id AS "layoutId",
                w.id AS "widgetId",
                l.name AS "layoutName",
                COALESCE(w.config->>'startPage', item.value->>'sectionId') AS reference
           FROM ${widgetsQt} w
           JOIN ${layoutsQt} l ON l.id = w.layout_id AND l._upl_deleted = false AND l._mhb_deleted = false
      LEFT JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(w.config->'items') = 'array' THEN w.config->'items' ELSE '[]'::jsonb END
           ) item(value) ON item.value->>'kind' = 'page' AND item.value->>'sectionId' = ANY($1::text[])
          WHERE w.widget_key = 'menuWidget'
            AND w.is_active = true
            AND w._upl_deleted = false
            AND w._mhb_deleted = false
            AND (w.config->>'startPage' = ANY($1::text[]) OR item.value IS NOT NULL)`,
        [identifiers]
    )

    const overrideRows = await queryMany<PageLayoutReference>(
        exec,
        `SELECT 'layoutWidgetOverride'::text AS source,
                o.layout_id AS "layoutId",
                o.id AS "widgetId",
                l.name AS "layoutName",
                COALESCE(o.config->>'startPage', item.value->>'sectionId') AS reference
           FROM ${overridesQt} o
           JOIN ${layoutsQt} l ON l.id = o.layout_id AND l._upl_deleted = false AND l._mhb_deleted = false
      LEFT JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(o.config->'items') = 'array' THEN o.config->'items' ELSE '[]'::jsonb END
           ) item(value) ON item.value->>'kind' = 'page' AND item.value->>'sectionId' = ANY($1::text[])
          WHERE o.config IS NOT NULL
            AND COALESCE(o.is_deleted_override, false) = false
            AND o._upl_deleted = false
            AND o._mhb_deleted = false
            AND (o.config->>'startPage' = ANY($1::text[]) OR item.value IS NOT NULL)`,
        [identifiers]
    )

    return [...widgetRows, ...overrideRows]
}

export const buildBuiltinKindBlockingState = async (
    kindKey: BuiltinEntityKind,
    {
        resolvedType,
        componentsService,
        fixedValuesService,
        entityTypeService,
        metahubId,
        entityId,
        userId,
        exec,
        schemaService
    }: EntityBehaviorDeleteContext
): Promise<EntityBehaviorBlockingState> => {
    const surfaceKey = resolveEntitySurfaceKey(kindKey)

    if (surfaceKey === 'objectCollection') {
        if (!isObjectCollectionCompatibleResolvedType(resolvedType)) {
            return {
                status: 200,
                body: {
                    objectCollectionId: entityId,
                    blockingReferences: [],
                    canDelete: true
                }
            }
        }

        const blockingReferences = await findBlockingObjectCollectionReferences(metahubId, entityId, componentsService, userId)
        return {
            status: 200,
            body: {
                objectCollectionId: entityId,
                blockingReferences,
                canDelete: blockingReferences.length === 0
            }
        }
    }

    if (surfaceKey === 'valueGroup') {
        const compatibleSetKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'set', userId)
        const blockingReferences = await fixedValuesService.findSetReferenceBlockers(metahubId, entityId, userId, compatibleSetKinds)
        return {
            status: 200,
            body: {
                valueGroupId: entityId,
                blockingReferences,
                canDelete: blockingReferences.length === 0
            }
        }
    }

    if (surfaceKey === 'optionList') {
        const compatibleEnumerationKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'enumeration', userId)
        const blockingReferences = await componentsService.findReferenceBlockersByTarget(
            metahubId,
            entityId,
            compatibleEnumerationKinds,
            userId
        )
        return {
            status: 200,
            body: {
                optionListId: entityId,
                blockingReferences,
                canDelete: blockingReferences.length === 0
            }
        }
    }

    if (surfaceKey === 'page') {
        const blockingReferences = await findBlockingPageLayoutReferences({ metahubId, entityId, userId, exec, schemaService })
        return {
            status: 200,
            body: {
                pageId: entityId,
                blockingReferences,
                canDelete: blockingReferences.length === 0
            }
        }
    }

    const compatibility = await loadTreeEntityContext(entityTypeService, metahubId, userId)
    const { blockingRelatedObjects, blockingChildTreeEntities } = await findBlockingTreeDependencies({
        metahubId,
        treeEntityId: entityId,
        schemaService,
        userId,
        db: exec,
        compatibility
    })
    const totalBlocking = blockingRelatedObjects.length + blockingChildTreeEntities.length

    return {
        status: 200,
        body: {
            treeEntityId: entityId,
            blockingChildTreeEntities,
            blockingRelatedObjects,
            totalBlocking,
            canDelete: totalBlocking === 0
        }
    }
}

export const buildBuiltinKindDeletePlan = async (
    kindKey: BuiltinEntityKind,
    {
        resolvedType,
        settingsService,
        componentsService,
        fixedValuesService,
        entityTypeService,
        metahubId,
        entityId,
        userId,
        exec,
        schemaService
    }: EntityBehaviorDeleteContext
): Promise<EntityBehaviorDeletePlan> => {
    const allowDeleteSettingKey = resolveEntityMetadataSettingKey(resolvedType, 'allowDelete')
    if (!allowDeleteSettingKey) {
        return { policyOutcome: null }
    }

    const allowDeleteRow = await settingsService.findByKey(metahubId, allowDeleteSettingKey, userId)
    if (allowDeleteRow && allowDeleteRow.value?._value === false) {
        const surfaceLabels = getSurfaceLabels(kindKey)
        return {
            policyOutcome: {
                status: 403,
                body: {
                    error: `Deleting ${surfaceLabels.plural.toLowerCase()} is disabled in metahub settings`
                }
            }
        }
    }

    const surfaceKey = resolveEntitySurfaceKey(kindKey)

    if (surfaceKey === 'objectCollection' && isObjectCollectionCompatibleResolvedType(resolvedType)) {
        const blockingReferences = await findBlockingObjectCollectionReferences(metahubId, entityId, componentsService, userId)
        if (blockingReferences.length > 0) {
            return {
                policyOutcome: {
                    status: 409,
                    body: {
                        error: 'Cannot delete object: it is referenced by components in other objects',
                        blockingReferences
                    }
                }
            }
        }

        return { policyOutcome: null }
    }

    if (surfaceKey === 'valueGroup') {
        const compatibleSetKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'set', userId)
        const blockingReferences = await fixedValuesService.findSetReferenceBlockers(metahubId, entityId, userId, compatibleSetKinds)
        if (blockingReferences.length > 0) {
            return {
                policyOutcome: {
                    status: 409,
                    body: {
                        error: 'Cannot delete set because there are blocking references',
                        code: 'SET_DELETE_BLOCKED_BY_REFERENCES',
                        valueGroupId: entityId,
                        blockingReferences
                    }
                }
            }
        }

        return { policyOutcome: null }
    }

    if (surfaceKey === 'optionList') {
        const compatibleEnumerationKinds = await resolveEntityMetadataKinds(entityTypeService, metahubId, 'enumeration', userId)
        const blockingReferences = await componentsService.findReferenceBlockersByTarget(
            metahubId,
            entityId,
            compatibleEnumerationKinds,
            userId
        )
        if (blockingReferences.length > 0) {
            return {
                policyOutcome: {
                    status: 409,
                    body: {
                        error: 'Cannot delete enumeration: it is referenced by components',
                        blockingReferences
                    }
                }
            }
        }

        return { policyOutcome: null }
    }

    if (surfaceKey === 'page') {
        const blockingReferences = await findBlockingPageLayoutReferences({ metahubId, entityId, userId, exec, schemaService })
        if (blockingReferences.length > 0) {
            return {
                policyOutcome: {
                    status: 409,
                    body: {
                        error: 'Cannot delete page because it is referenced by runtime navigation',
                        code: 'PAGE_DELETE_BLOCKED_BY_LAYOUT_REFERENCES',
                        pageId: entityId,
                        blockingReferences
                    }
                }
            }
        }

        return { policyOutcome: null }
    }

    const blockingState = await buildBuiltinKindBlockingState(kindKey, {
        resolvedType,
        settingsService,
        componentsService,
        fixedValuesService,
        entityTypeService,
        metahubId,
        entityId,
        userId,
        exec,
        schemaService
    })
    const { blockingRelatedObjects, blockingChildTreeEntities, totalBlocking } = blockingState.body as {
        blockingRelatedObjects: unknown[]
        blockingChildTreeEntities: unknown[]
        totalBlocking: number
    }

    if (totalBlocking > 0) {
        return {
            policyOutcome: {
                status: 409,
                body: {
                    error: 'Cannot delete hub: required objects would become orphaned',
                    blockingRelatedObjects,
                    blockingChildTreeEntities,
                    totalBlocking
                }
            }
        }
    }

    const compatibility = await loadTreeEntityContext(entityTypeService, metahubId, userId)
    return {
        policyOutcome: null,
        beforeEntityDelete: async () => {
            await removeHubFromObjectAssociations({
                metahubId,
                treeEntityId: entityId,
                schemaService,
                userId,
                hubExec: exec,
                compatibility
            })
        }
    }
}
