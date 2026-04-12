import type { EntityTypePresetManifest } from '@universo/types'
import { CATALOG_TYPE } from '@universo/types'
import { vlc } from './basic.template'

const catalogV2Name = vlc('Catalogs V2', 'Каталоги V2')
const catalogV2Description = vlc(
    'Catalog-compatible custom entity preset with schema, hierarchy, references, scripts, and runtime layout support.',
    'Пресет пользовательской сущности в стиле каталога со схемой, иерархией, связями, скриптами и поддержкой runtime layout.'
)

export const catalogV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'catalog-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: catalogV2Name,
    description: catalogV2Description,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'catalog'],
        icon: CATALOG_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.catalog-v2',
        codename: vlc('CatalogV2', 'CatalogV2'),
        components: {
            ...CATALOG_TYPE.components,
            physicalTable: { enabled: true, prefix: 'catx' }
        },
        ui: {
            ...CATALOG_TYPE.ui,
            sidebarOrder: 20,
            nameKey: 'Catalogs V2',
            descriptionKey:
                'Catalog-compatible custom entity with hubs, hierarchy, references, scripts, and publication-ready layout support.'
        },
        presentation: {
            name: catalogV2Name,
            description: catalogV2Description
        },
        config: {
            compatibility: {
                legacyObjectKind: 'catalog'
            }
        }
    }
}
