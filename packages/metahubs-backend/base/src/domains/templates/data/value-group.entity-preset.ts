import type { EntityTypePresetManifest } from '@universo/types'
import {
    SET_DEFAULT_INSTANCES,
    SET_TYPE_COMPONENTS,
    SET_TYPE_UI,
    STANDARD_SET_DESCRIPTION,
    STANDARD_SET_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const setEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'set',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_SET_NAME,
    description: STANDARD_SET_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'set'],
        icon: SET_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'set',
        codename: vlc('Set', 'Set'),
        components: SET_TYPE_COMPONENTS,
        ui: SET_TYPE_UI,
        presentation: {
            name: STANDARD_SET_NAME,
            description: STANDARD_SET_DESCRIPTION,
            dialogTitles: {
                create: vlc('Create Set', 'Создать набор'),
                edit: vlc('Edit Set', 'Редактировать набор'),
                copy: vlc('Copy Set', 'Копирование набора'),
                delete: vlc('Delete Set', 'Удалить набор')
            }
        },
        config: {}
    },
    defaultInstances: SET_DEFAULT_INSTANCES
}
