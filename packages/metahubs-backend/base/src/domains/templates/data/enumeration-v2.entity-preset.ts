import type { EntityTypePresetManifest } from '@universo/types'
import { ENUMERATION_TYPE } from '@universo/types'
import { vlc } from './basic.template'

const enumerationV2Name = vlc('Enumerations V2', 'Перечисления V2')
const enumerationV2Description = vlc(
    'Enumeration-compatible custom entity preset that keeps the shared values workflow and adds design-time automation.',
    'Пресет пользовательской сущности в стиле перечисления, сохраняющий общий workflow значений и добавляющий design-time автоматизацию.'
)

export const enumerationV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'enumeration-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: enumerationV2Name,
    description: enumerationV2Description,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'enumeration'],
        icon: ENUMERATION_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.enumeration-v2',
        codename: vlc('EnumerationV2', 'EnumerationV2'),
        components: {
            ...ENUMERATION_TYPE.components,
            actions: { enabled: true },
            events: { enabled: true }
        },
        ui: {
            ...ENUMERATION_TYPE.ui,
            sidebarOrder: 40,
            nameKey: 'Enumerations V2',
            descriptionKey: 'Enumeration-compatible custom entity with shared values authoring, scripting, and design-time automation.'
        },
        presentation: {
            name: enumerationV2Name,
            description: enumerationV2Description
        },
        config: {
            compatibility: {
                legacyObjectKind: 'enumeration'
            }
        }
    }
}