import { DEFAULT_OBJECT_RECORD_BEHAVIOR, type EntityTypePresetManifest } from '@universo/types'
import {
    OBJECT_DEFAULT_INSTANCES,
    OBJECT_TYPE_CAPABILITIES,
    OBJECT_TYPE_UI,
    STANDARD_OBJECT_DESCRIPTION,
    STANDARD_OBJECT_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const objectEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'object',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_OBJECT_NAME,
    description: STANDARD_OBJECT_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'object'],
        icon: OBJECT_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'object',
        codename: vlc('Object', 'Object'),
        capabilities: OBJECT_TYPE_CAPABILITIES,
        ui: OBJECT_TYPE_UI,
        presentation: {
            name: STANDARD_OBJECT_NAME,
            description: STANDARD_OBJECT_DESCRIPTION,
            dialogTitles: {
                create: vlc('Create Object', 'Создать объект'),
                edit: vlc('Edit Object', 'Редактировать объект'),
                copy: vlc('Copy Object', 'Копирование объекта'),
                delete: vlc('Delete Object', 'Удалить объект')
            }
        },
        config: {
            recordBehavior: DEFAULT_OBJECT_RECORD_BEHAVIOR
        }
    },
    defaultInstances: OBJECT_DEFAULT_INSTANCES
}
