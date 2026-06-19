import type { EntityTypePresetManifest } from '@universo-react/types'
import {
    PROJECT_DEFAULT_INSTANCES,
    PROJECT_TYPE_CAPABILITIES,
    PROJECT_TYPE_UI,
    STANDARD_PROJECT_DESCRIPTION,
    STANDARD_PROJECT_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const projectEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'project',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: STANDARD_PROJECT_NAME,
    description: STANDARD_PROJECT_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'project', 'project-binding'],
        icon: PROJECT_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'project',
        codename: vlc('Project', 'Project'),
        capabilities: PROJECT_TYPE_CAPABILITIES,
        ui: PROJECT_TYPE_UI,
        presentation: {
            name: STANDARD_PROJECT_NAME,
            description: STANDARD_PROJECT_DESCRIPTION,
            dialogTitles: {
                create: vlc('Create Project', 'Создать проект'),
                edit: vlc('Edit Project', 'Редактировать проект'),
                copy: vlc('Copy Project', 'Копирование проекта'),
                delete: vlc('Delete Project', 'Удалить проект')
            }
        },
        config: {}
    },
    defaultInstances: PROJECT_DEFAULT_INSTANCES
}
