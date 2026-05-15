import type { EntityTypePresetManifest } from '@universo/types'
import { SET_TYPE_CAPABILITIES, SET_TYPE_UI } from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const fixedValuesLibraryEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'fixed-values-library',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Constants Library', 'Библиотека констант'),
    description: vlc(
        'Set-style preset for typed constants and lightweight automation without runtime publication widgets.',
        'Пресет в стиле набора для типизированных констант и лёгкой автоматизации без runtime publication widgets.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'set'],
        icon: SET_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'fixed-values-library',
        codename: vlc('ConstantsLibrary', 'ConstantsLibrary'),
        capabilities: SET_TYPE_CAPABILITIES,
        ui: {
            ...SET_TYPE_UI,
            nameKey: 'Constants Library',
            descriptionKey: 'Set-style custom entity for typed constants, scripts, and lightweight design-time automation.'
        },
        presentation: {},
        config: {}
    }
}
