import { ENTITY_SURFACE_LABELS, resolveEntitySurfaceKey, type BuiltinEntityKind } from '@universo/types'

import { generateTableName } from '../../ddl'
import { resolveEntityMetadataKinds, resolveEntityMetadataSettingKey } from '../../shared/entityMetadataKinds'
import { findBlockingLinkedCollectionReferences, isLinkedCollectionCompatibleResolvedType } from '../children/linkedCollectionContext'
import { findBlockingTreeDependencies, loadTreeEntityContext, removeHubFromObjectAssociations } from '../children/treeEntityContext'
import type { EntityBehaviorBlockingState, EntityBehaviorDeleteContext, EntityBehaviorDeletePlan } from './EntityBehaviorService'

const getSurfaceLabels = (kindKey: BuiltinEntityKind) => {
    const surfaceKey = resolveEntitySurfaceKey(kindKey)
    return surfaceKey ? ENTITY_SURFACE_LABELS[surfaceKey] : { singular: 'Entity', plural: 'Entities' }
}

export const resolveBuiltinGeneratedTableName = (kindKey: BuiltinEntityKind, objectId: string): string | null =>
    resolveEntitySurfaceKey(kindKey) === 'linkedCollection' ? generateTableName(objectId, kindKey) : null

export const buildBuiltinKindBlockingState = async (
    kindKey: BuiltinEntityKind,
    {
        resolvedType,
        fieldDefinitionsService,
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

    if (surfaceKey === 'linkedCollection') {
        if (!isLinkedCollectionCompatibleResolvedType(resolvedType)) {
            return {
                status: 200,
                body: {
                    linkedCollectionId: entityId,
                    blockingReferences: [],
                    canDelete: true
                }
            }
        }

        const blockingReferences = await findBlockingLinkedCollectionReferences(metahubId, entityId, fieldDefinitionsService, userId)
        return {
            status: 200,
            body: {
                linkedCollectionId: entityId,
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
        const blockingReferences = await fieldDefinitionsService.findReferenceBlockersByTarget(
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

    const compatibility = await loadTreeEntityContext(entityTypeService, metahubId, userId)
    const { blockingLinkedCollections, blockingValueGroups, blockingOptionLists, blockingChildTreeEntities } =
        await findBlockingTreeDependencies({
            metahubId,
            treeEntityId: entityId,
            schemaService,
            userId,
            db: exec,
            compatibility
        })
    const totalBlocking =
        blockingLinkedCollections.length + blockingValueGroups.length + blockingOptionLists.length + blockingChildTreeEntities.length

    return {
        status: 200,
        body: {
            treeEntityId: entityId,
            blockingLinkedCollections,
            blockingValueGroups,
            blockingOptionLists,
            blockingChildTreeEntities,
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
        fieldDefinitionsService,
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

    if (surfaceKey === 'linkedCollection' && isLinkedCollectionCompatibleResolvedType(resolvedType)) {
        const blockingReferences = await findBlockingLinkedCollectionReferences(metahubId, entityId, fieldDefinitionsService, userId)
        if (blockingReferences.length > 0) {
            return {
                policyOutcome: {
                    status: 409,
                    body: {
                        error: 'Cannot delete linked collection: it is referenced by field definitions in other linked collections',
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
                        error: 'Cannot delete value group because there are blocking references',
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
        const blockingReferences = await fieldDefinitionsService.findReferenceBlockersByTarget(
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
                        error: 'Cannot delete option list: it is referenced by field definitions',
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
        fieldDefinitionsService,
        fixedValuesService,
        entityTypeService,
        metahubId,
        entityId,
        userId,
        exec,
        schemaService
    })
    const { blockingLinkedCollections, blockingValueGroups, blockingOptionLists, blockingChildTreeEntities, totalBlocking } =
        blockingState.body as {
            blockingLinkedCollections: unknown[]
            blockingValueGroups: unknown[]
            blockingOptionLists: unknown[]
            blockingChildTreeEntities: unknown[]
            totalBlocking: number
        }

    if (totalBlocking > 0) {
        return {
            policyOutcome: {
                status: 409,
                body: {
                    error: 'Cannot delete tree entity: required objects would become orphaned',
                    blockingLinkedCollections,
                    blockingValueGroups,
                    blockingOptionLists,
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
