import { MetaEntityKind, type ResolvedEntityType } from '@universo/types'

import type { EntityTypeService } from '../services/EntityTypeService'
import type { MetahubFieldDefinitionsService } from '../../metahubs/services/MetahubFieldDefinitionsService'
import {
    createEntityMetadataKindSet,
    isEntityMetadataEntityType,
    isEntityMetadataResolvedType,
    resolveEntityMetadataKinds
} from '../../shared/entityMetadataKinds'

type CatalogCompatibleTypeLike = Pick<ResolvedEntityType, 'kindKey'> & {
    config?: Record<string, unknown> | null
}

export const isLinkedCollectionCompatibleEntityType = (row: CatalogCompatibleTypeLike): boolean =>
    isEntityMetadataEntityType(row, MetaEntityKind.CATALOG)

export const isLinkedCollectionCompatibleResolvedType = (row: CatalogCompatibleTypeLike | null | undefined): boolean =>
    isEntityMetadataResolvedType(row, MetaEntityKind.CATALOG)

export const createLinkedCollectionCompatibleKindSet = createEntityMetadataKindSet

export const resolveLinkedCollectionCompatibleKinds = async (
    entityTypeService: Pick<EntityTypeService, 'listEditableTypes'>,
    metahubId: string,
    userId?: string
): Promise<string[]> => resolveEntityMetadataKinds(entityTypeService, metahubId, MetaEntityKind.CATALOG, userId)

export const findBlockingLinkedCollectionReferences = async (
    metahubId: string,
    linkedCollectionId: string,
    fieldDefinitionsService: Pick<MetahubFieldDefinitionsService, 'findCatalogReferenceBlockers'>,
    userId?: string
) => fieldDefinitionsService.findCatalogReferenceBlockers(metahubId, linkedCollectionId, userId)
