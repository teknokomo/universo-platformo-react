import type { EntityTypePresetManifest } from '@universo/types'
import {
    LINKED_COLLECTION_DEFAULT_INSTANCES,
    LINKED_COLLECTION_TYPE_COMPONENTS,
    LINKED_COLLECTION_TYPE_UI,
    STANDARD_LINKED_COLLECTION_DESCRIPTION,
    STANDARD_LINKED_COLLECTION_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const catalogEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'catalog',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_LINKED_COLLECTION_NAME,
    description: STANDARD_LINKED_COLLECTION_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'catalog'],
        icon: LINKED_COLLECTION_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'catalog',
        codename: vlc('Catalog', 'Catalog'),
        components: LINKED_COLLECTION_TYPE_COMPONENTS,
        ui: LINKED_COLLECTION_TYPE_UI,
        presentation: {
            name: STANDARD_LINKED_COLLECTION_NAME,
            description: STANDARD_LINKED_COLLECTION_DESCRIPTION
        },
        config: {}
    },
    defaultInstances: LINKED_COLLECTION_DEFAULT_INSTANCES
}
