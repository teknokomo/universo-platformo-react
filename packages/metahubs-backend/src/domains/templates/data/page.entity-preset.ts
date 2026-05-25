import type { EntityTypePresetManifest } from '@universo/types'
import {
    PAGE_DEFAULT_INSTANCES,
    PAGE_TYPE_CAPABILITIES,
    PAGE_TYPE_UI,
    STANDARD_PAGE_DESCRIPTION,
    STANDARD_PAGE_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const pageEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'page',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_PAGE_NAME,
    description: STANDARD_PAGE_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'page', 'content'],
        icon: PAGE_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'page',
        codename: vlc('Page', 'Page'),
        capabilities: PAGE_TYPE_CAPABILITIES,
        ui: PAGE_TYPE_UI,
        presentation: {
            name: STANDARD_PAGE_NAME,
            description: STANDARD_PAGE_DESCRIPTION,
            dialogTitles: {
                create: vlc('Create Page', 'Создать страницу'),
                edit: vlc('Edit Page', 'Редактировать страницу'),
                copy: vlc('Copy Page', 'Копирование страницы'),
                delete: vlc('Delete Page', 'Удалить страницу')
            }
        },
        config: {}
    },
    defaultInstances: PAGE_DEFAULT_INSTANCES
}
