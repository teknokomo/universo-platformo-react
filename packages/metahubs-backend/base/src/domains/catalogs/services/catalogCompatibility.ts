import { MetaEntityKind, isLegacyCompatibleObjectKind, type ResolvedEntityType } from '@universo/types'
import type { EntityTypeService } from '../../entities/services/EntityTypeService'
import type { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'

const CATALOG_V2_COMPATIBLE_KIND_KEY = 'custom.catalog-v2'

type CatalogCompatibleTypeLike = Pick<ResolvedEntityType, 'kindKey'> & {
    config?: Record<string, unknown> | null
}

export const isCatalogCompatibleEntityType = (row: CatalogCompatibleTypeLike): boolean =>
    row.kindKey === CATALOG_V2_COMPATIBLE_KIND_KEY || isLegacyCompatibleObjectKind(row.config, MetaEntityKind.CATALOG)

export const isCatalogCompatibleResolvedType = (row: CatalogCompatibleTypeLike | null | undefined): boolean =>
    Boolean(row && isCatalogCompatibleEntityType(row))

export const createCatalogCompatibleKindSet = (kinds: readonly string[]): Set<string> => new Set(kinds)

export const resolveCatalogCompatibleKinds = async (
    entityTypeService: Pick<EntityTypeService, 'listCustomTypes'>,
    metahubId: string,
    userId?: string
): Promise<string[]> => {
    const customTypes = await entityTypeService.listCustomTypes(metahubId, userId)
    return [MetaEntityKind.CATALOG, ...customTypes.filter(isCatalogCompatibleEntityType).map((entityType) => entityType.kindKey)]
}

export const findBlockingCatalogReferences = async (
    metahubId: string,
    catalogId: string,
    attributesService: Pick<MetahubAttributesService, 'findCatalogReferenceBlockers'>,
    userId?: string
) => attributesService.findCatalogReferenceBlockers(metahubId, catalogId, userId)
