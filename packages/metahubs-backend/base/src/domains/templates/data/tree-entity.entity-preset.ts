import type { EntityTypePresetManifest } from '@universo/types'
import {
    HUB_DEFAULT_INSTANCES,
    HUB_TYPE_COMPONENTS,
    HUB_TYPE_UI,
    STANDARD_HUB_DESCRIPTION,
    STANDARD_HUB_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const hubEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'hub',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_HUB_NAME,
    description: STANDARD_HUB_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'hub'],
        icon: HUB_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'hub',
        codename: vlc('Hub', 'Hub'),
        components: HUB_TYPE_COMPONENTS,
        ui: HUB_TYPE_UI,
        presentation: {
            name: STANDARD_HUB_NAME,
            description: STANDARD_HUB_DESCRIPTION
        },
        config: {}
    },
    defaultInstances: HUB_DEFAULT_INSTANCES
}
