import type { Repository } from 'typeorm'
import { MetaEntityKind } from '@universo/types'
import type { EntityDefinition } from '../types'
import { Catalog } from '../../../database/entities/Catalog'
import { Attribute } from '../../../database/entities/Attribute'

export const buildCatalogDefinitions = async (
    catalogRepo: Repository<Catalog>,
    attributeRepo: Repository<Attribute>,
    metahubId: string
): Promise<EntityDefinition[]> => {
    const catalogs = await catalogRepo.find({
        where: { metahubId },
        order: { sortOrder: 'ASC' },
    })

    const definitions: EntityDefinition[] = []

    for (const catalog of catalogs) {
        const attributes = await attributeRepo.find({
            where: { catalogId: catalog.id },
            order: { sortOrder: 'ASC' },
        })

        definitions.push({
            id: catalog.id,
            kind: MetaEntityKind.CATALOG,
            codename: catalog.codename,
            fields: attributes.map((attr) => ({
                id: attr.id,
                codename: attr.codename,
                dataType: attr.dataType,
                isRequired: attr.isRequired,
                targetEntityId: attr.targetCatalogId ?? null,
            })),
        })
    }

    return definitions
}
