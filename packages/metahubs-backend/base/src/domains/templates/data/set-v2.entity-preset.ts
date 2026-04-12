import type { EntityTypePresetManifest } from '@universo/types'
import { SET_TYPE } from '@universo/types'
import { vlc } from './basic.template'

const setV2Name = vlc('Sets V2', 'Наборы V2')
const setV2Description = vlc(
    'Set-compatible custom entity preset that keeps the shared constants workflow and legacy set authoring behavior.',
    'Пресет пользовательской сущности в стиле набора, сохраняющий общий workflow констант и legacy-поведение редактирования наборов.'
)

export const setV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'set-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: setV2Name,
    description: setV2Description,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'set'],
        icon: SET_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.set-v2',
        codename: vlc('SetV2', 'SetV2'),
        components: SET_TYPE.components,
        ui: {
            ...SET_TYPE.ui,
            sidebarOrder: 30,
            nameKey: 'Sets V2',
            descriptionKey: 'Set-compatible custom entity with shared constants authoring and legacy set lifecycle behavior.'
        },
        presentation: {
            name: setV2Name,
            description: setV2Description
        },
        config: {
            compatibility: {
                legacyObjectKind: 'set'
            }
        }
    }
}