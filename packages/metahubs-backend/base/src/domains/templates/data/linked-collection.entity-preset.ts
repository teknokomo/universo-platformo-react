import { DEFAULT_CATALOG_RECORD_BEHAVIOR, type EntityTypePresetManifest } from '@universo/types'
import {
    CATALOG_DEFAULT_INSTANCES,
    CATALOG_TYPE_COMPONENTS,
    CATALOG_TYPE_UI,
    STANDARD_CATALOG_DESCRIPTION,
    STANDARD_CATALOG_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const catalogEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'catalog',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_CATALOG_NAME,
    description: STANDARD_CATALOG_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'catalog'],
        icon: CATALOG_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'catalog',
        codename: vlc('Catalog', 'Catalog'),
        components: CATALOG_TYPE_COMPONENTS,
        ui: CATALOG_TYPE_UI,
        presentation: {
            name: STANDARD_CATALOG_NAME,
            description: STANDARD_CATALOG_DESCRIPTION,
            dialogTitles: {
                create: vlc('Create Catalog', 'Создать каталог'),
                edit: vlc('Edit Catalog', 'Редактировать каталог'),
                copy: vlc('Copy Catalog', 'Копирование каталога'),
                delete: vlc('Delete Catalog', 'Удалить каталог')
            }
        },
        config: {
            recordBehavior: DEFAULT_CATALOG_RECORD_BEHAVIOR
        }
    },
    defaultInstances: CATALOG_DEFAULT_INSTANCES
}
