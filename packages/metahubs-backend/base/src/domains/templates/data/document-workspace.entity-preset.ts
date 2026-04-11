import type { EntityTypePresetManifest } from '@universo/types'
import { DOCUMENT_TYPE } from '@universo/types'
import { vlc } from './basic.template'

export const documentWorkspaceEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'document-workspace',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Document Workspace', 'Рабочий документ'),
    description: vlc(
        'Document-style preset with nested collections, relations, scripts, and runtime layout support.',
        'Пресет в стиле документа с табличными частями, связями, скриптами и поддержкой runtime layout.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'document'],
        icon: DOCUMENT_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.document-workspace',
        codename: vlc('DocumentWorkspace', 'DocumentWorkspace'),
        components: {
            ...DOCUMENT_TYPE.components,
            physicalTable: { enabled: true, prefix: 'docx' }
        },
        ui: {
            ...DOCUMENT_TYPE.ui,
            nameKey: 'Document Workspace',
            descriptionKey: 'Document-style custom entity with schema, nested collections, relations, scripts, and runtime layout support.'
        },
        presentation: {},
        config: {}
    }
}
