import type { EntityTypePresetManifest } from '@universo/types'
import {
    ENUMERATION_DEFAULT_INSTANCES,
    ENUMERATION_TYPE_COMPONENTS,
    ENUMERATION_TYPE_UI,
    STANDARD_ENUMERATION_DESCRIPTION,
    STANDARD_ENUMERATION_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const enumerationEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'enumeration',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_ENUMERATION_NAME,
    description: STANDARD_ENUMERATION_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'enumeration'],
        icon: ENUMERATION_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'enumeration',
        codename: vlc('Enumeration', 'Enumeration'),
        components: ENUMERATION_TYPE_COMPONENTS,
        ui: ENUMERATION_TYPE_UI,
        presentation: {
            name: STANDARD_ENUMERATION_NAME,
            description: STANDARD_ENUMERATION_DESCRIPTION,
            dialogTitles: {
                create: vlc('Create Enumeration', 'Создать перечисление'),
                edit: vlc('Edit Enumeration', 'Редактировать перечисление'),
                copy: vlc('Copy Enumeration', 'Копирование перечисления'),
                delete: vlc('Delete Enumeration', 'Удалить перечисление')
            }
        },
        config: {}
    },
    defaultInstances: ENUMERATION_DEFAULT_INSTANCES
}
