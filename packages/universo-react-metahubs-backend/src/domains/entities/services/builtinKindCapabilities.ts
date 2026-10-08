import { ENTITY_SURFACE_LABELS, resolveEntitySurfaceKey, type BuiltinEntityKind } from '@universo-react/types'
import { generateTableName } from '../../ddl'
import { resolveEntityMetadataKinds, resolveEntityMetadataSettingKeys } from '../../shared/entityMetadataKinds'
import { findBlockingObjectCollectionReferences, isObjectCollectionCompatibleResolvedType } from '../children/objectCollectionContext'
import { findBlockingTreeDependencies, loadTreeEntityContext, removeHubFromObjectAssociations } from '../children/treeEntityContext'
import type { EntityBehaviorBlockingState, EntityBehaviorDeleteContext, EntityBehaviorDeletePlan } from './EntityBehaviorService'

const getSurfaceLabels = (kindKey: BuiltinEntityKind) => {
    const surfaceKey = resolveEntitySurfaceKey(kindKey)
    return surfaceKey ? ENTITY_SURFACE_LABELS[surfaceKey] : { singular: 'Entity', plural: 'Entities' }
}

export const resolveBuiltinGeneratedTableName = (kindKey: BuiltinEntityKind, objectId: string): string | null =>
    resolveEntitySurfaceKey(kindKey) === 'objectCollection' ? generateTableName(objectId, kindKey) : null

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
        return {
            status: 200,
            body: {
                pageId: entityId,
                blockingReferences: [],
                canDelete: true
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
    const allowDeleteSettingKeys = resolveEntityMetadataSettingKeys(resolvedType, 'allowDelete')
    if (allowDeleteSettingKeys.length === 0) {
        return { policyOutcome: null }
    }

    const allowDeleteRows = await Promise.all(allowDeleteSettingKeys.map((key) => settingsService.findByKey(metahubId, key, userId)))
    const allowDeleteRow = allowDeleteRows.find((row) => row?.value?._value === false)
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
