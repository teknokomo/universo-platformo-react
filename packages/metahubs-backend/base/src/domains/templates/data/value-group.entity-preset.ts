import type { EntityTypePresetManifest } from '@universo/types'
import {
    VALUE_GROUP_DEFAULT_INSTANCES,
    VALUE_GROUP_TYPE_COMPONENTS,
    VALUE_GROUP_TYPE_UI,
    STANDARD_VALUE_GROUP_DESCRIPTION,
    STANDARD_VALUE_GROUP_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const setEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'set',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_VALUE_GROUP_NAME,
    description: STANDARD_VALUE_GROUP_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'set'],
        icon: VALUE_GROUP_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'set',
        codename: vlc('Set', 'Set'),
        components: VALUE_GROUP_TYPE_COMPONENTS,
        ui: VALUE_GROUP_TYPE_UI,
        presentation: {
            name: STANDARD_VALUE_GROUP_NAME,
            description: STANDARD_VALUE_GROUP_DESCRIPTION
        },
        config: {}
    },
    defaultInstances: VALUE_GROUP_DEFAULT_INSTANCES
}
