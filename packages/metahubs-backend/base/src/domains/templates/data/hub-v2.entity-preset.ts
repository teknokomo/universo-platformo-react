import type { EntityTypePresetManifest } from '@universo/types'
import { HUB_TYPE } from '@universo/types'
import { vlc } from './basic.template'

const hubV2Name = vlc('Hubs V2', 'Хабы V2')
const hubV2Description = vlc(
    'Hub-compatible custom entity preset with shared legacy hub navigation, scripting, and design-time automation.',
    'Пресет пользовательской сущности в стиле хаба с общей legacy-навигацией хабов, скриптами и design-time автоматизацией.'
)

export const hubV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'hub-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: hubV2Name,
    description: hubV2Description,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'hub'],
        icon: HUB_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.hub-v2',
        codename: vlc('HubV2', 'HubV2'),
        components: {
            ...HUB_TYPE.components,
            scripting: { enabled: true },
            actions: { enabled: true },
            events: { enabled: true }
        },
        ui: {
            ...HUB_TYPE.ui,
            sidebarOrder: 10,
            nameKey: 'Hubs V2',
            descriptionKey: 'Hub-compatible custom entity with shared legacy hub navigation, widget binding support, and design-time automation.'
        },
        presentation: {
            name: hubV2Name,
            description: hubV2Description
        },
        config: {
            compatibility: {
                legacyObjectKind: 'hub'
            }
        }
    }
}