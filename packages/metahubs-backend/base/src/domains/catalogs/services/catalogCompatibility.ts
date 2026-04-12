import { MetaEntityKind, type ResolvedEntityType } from '@universo/types'

import type { EntityTypeService } from '../../entities/services/EntityTypeService'
import type { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import {
    createLegacyCompatibleKindSet,
    isLegacyCompatibleEntityType,
    isLegacyCompatibleResolvedType,
    resolveLegacyCompatibleKinds
} from '../../shared/legacyCompatibility'

type CatalogCompatibleTypeLike = Pick<ResolvedEntityType, 'kindKey'> & {
    config?: Record<string, unknown> | null
}

export const isCatalogCompatibleEntityType = (row: CatalogCompatibleTypeLike): boolean =>
    isLegacyCompatibleEntityType(row, MetaEntityKind.CATALOG)

export const isCatalogCompatibleResolvedType = (row: CatalogCompatibleTypeLike | null | undefined): boolean =>
    isLegacyCompatibleResolvedType(row, MetaEntityKind.CATALOG)

export const createCatalogCompatibleKindSet = createLegacyCompatibleKindSet

export const resolveCatalogCompatibleKinds = async (
    entityTypeService: Pick<EntityTypeService, 'listCustomTypes'>,
    metahubId: string,
    userId?: string
): Promise<string[]> => resolveLegacyCompatibleKinds(entityTypeService, metahubId, MetaEntityKind.CATALOG, userId)

export const findBlockingCatalogReferences = async (
    metahubId: string,
    catalogId: string,
    attributesService: Pick<MetahubAttributesService, 'findCatalogReferenceBlockers'>,
    userId?: string
) => attributesService.findCatalogReferenceBlockers(metahubId, catalogId, userId)
