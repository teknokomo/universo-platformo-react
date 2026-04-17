import type { EntityTypePresetManifest } from '@universo/types'
import {
    OPTION_LIST_DEFAULT_INSTANCES,
    OPTION_LIST_TYPE_COMPONENTS,
    OPTION_LIST_TYPE_UI,
    STANDARD_OPTION_LIST_DESCRIPTION,
    STANDARD_OPTION_LIST_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const enumerationEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'enumeration',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_OPTION_LIST_NAME,
    description: STANDARD_OPTION_LIST_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'enumeration'],
        icon: OPTION_LIST_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'enumeration',
        codename: vlc('Enumeration', 'Enumeration'),
        components: OPTION_LIST_TYPE_COMPONENTS,
        ui: OPTION_LIST_TYPE_UI,
        presentation: {
            name: STANDARD_OPTION_LIST_NAME,
            description: STANDARD_OPTION_LIST_DESCRIPTION
        },
        config: {}
    },
    defaultInstances: OPTION_LIST_DEFAULT_INSTANCES
}
