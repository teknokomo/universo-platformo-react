import { MetaEntityKind, type ResolvedEntityType } from '@universo/types'

import type { EntityTypeService } from '../services/EntityTypeService'
import type { MetahubComponentsService } from '../../metahubs/services/MetahubComponentsService'
import {
    createEntityMetadataKindSet,
    isEntityMetadataEntityType,
    isEntityMetadataResolvedType,
    resolveEntityMetadataKinds
} from '../../shared/entityMetadataKinds'

type ObjectCompatibleTypeLike = Pick<ResolvedEntityType, 'kindKey'> & {
    config?: Record<string, unknown> | null
}

export const isObjectCollectionCompatibleEntityType = (row: ObjectCompatibleTypeLike): boolean =>
    isEntityMetadataEntityType(row, MetaEntityKind.OBJECT)

export const isObjectCollectionCompatibleResolvedType = (row: ObjectCompatibleTypeLike | null | undefined): boolean =>
    isEntityMetadataResolvedType(row, MetaEntityKind.OBJECT)

export const createObjectCollectionCompatibleKindSet = createEntityMetadataKindSet

export const resolveObjectCollectionCompatibleKinds = async (
    entityTypeService: Pick<EntityTypeService, 'listEditableTypes'>,
    metahubId: string,
    userId?: string
): Promise<string[]> => resolveEntityMetadataKinds(entityTypeService, metahubId, MetaEntityKind.OBJECT, userId)

export const findBlockingObjectCollectionReferences = async (
    metahubId: string,
    objectCollectionId: string,
    componentsService: Pick<MetahubComponentsService, 'findObjectReferenceBlockers'>,
    userId?: string
) => componentsService.findObjectReferenceBlockers(metahubId, objectCollectionId, userId)
