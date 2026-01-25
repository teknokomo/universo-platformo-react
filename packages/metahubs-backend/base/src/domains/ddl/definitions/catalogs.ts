import { MetaEntityKind, AttributeDataType } from '@universo/types'
import type { EntityDefinition } from '@universo/schema-ddl'
import { localizedContent } from '@universo/utils'

export const buildCatalogDefinitions = (
    catalogs: any[],
    allAttributes: any[]
): EntityDefinition[] => {
    // Sort catalogs by sortOrder if present in config
    const sortedCatalogs = [...catalogs].sort((a, b) => {
        const orderA = a.config?.sortOrder ?? 0
        const orderB = b.config?.sortOrder ?? 0
        return orderA - orderB
    })

    const definitions: EntityDefinition[] = []

    for (const catalog of sortedCatalogs) {
        const catalogId = catalog.id
        // Filter attributes for this catalog
        const attributes = allAttributes.filter((attr) => (attr.catalogId || attr.object_id) === catalogId)

        definitions.push({
            id: catalogId,
            kind: MetaEntityKind.CATALOG,
            codename: catalog.codename,
            presentation: {
                name: (catalog.presentation?.name || localizedContent.buildLocalizedContent({ en: catalog.codename || 'Catalog' }, 'en')) as any,
                description: catalog.presentation?.description,
            },
            fields: [
                ...attributes.map((attr) => ({
                    id: attr.id,
                    codename: attr.codename,
                    dataType: attr.data_type || attr.dataType,
                    isRequired: attr.is_required || attr.isRequired || false,
                    targetEntityId: attr.target_object_id || attr.targetCatalogId || null,
                    presentation: {
                        name: (attr.presentation?.name || localizedContent.buildLocalizedContent({ en: (typeof attr.name === 'string' ? attr.name : attr.codename) || 'Attribute' }, 'en')) as any,
                    },
                    validationRules: (attr.validation_rules || attr.validationRules || {}) as Record<string, unknown>,
                    uiConfig: (attr.ui_config || attr.uiConfig || {}) as Record<string, unknown>,
                })),
                // System field: data (JSONB storage for element data)
                {
                    id: 'sys_data',
                    codename: 'data',
                    dataType: AttributeDataType.JSON,
                    isRequired: false,
                    presentation: { name: localizedContent.buildLocalizedContent({ en: 'Data' }, 'en') as any },
                    validationRules: {},
                    uiConfig: { hidden: true }
                }
            ]
        })
    }

    return definitions
}
