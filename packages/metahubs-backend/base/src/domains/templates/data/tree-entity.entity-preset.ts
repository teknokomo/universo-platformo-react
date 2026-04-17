import type { EntityTypePresetManifest } from '@universo/types'
import {
    TREE_ENTITY_DEFAULT_INSTANCES,
    TREE_ENTITY_TYPE_COMPONENTS,
    TREE_ENTITY_TYPE_UI,
    STANDARD_TREE_ENTITY_DESCRIPTION,
    STANDARD_TREE_ENTITY_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const hubEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'hub',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_TREE_ENTITY_NAME,
    description: STANDARD_TREE_ENTITY_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'hub'],
        icon: TREE_ENTITY_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'hub',
        codename: vlc('Hub', 'Hub'),
        components: TREE_ENTITY_TYPE_COMPONENTS,
        ui: TREE_ENTITY_TYPE_UI,
        presentation: {
            name: STANDARD_TREE_ENTITY_NAME,
            description: STANDARD_TREE_ENTITY_DESCRIPTION
        },
        config: {}
    },
    defaultInstances: TREE_ENTITY_DEFAULT_INSTANCES
}
