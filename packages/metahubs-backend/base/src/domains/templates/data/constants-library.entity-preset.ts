import type { EntityTypePresetManifest } from '@universo/types'
import { SET_TYPE } from '@universo/types'
import { vlc } from './basic.template'

export const constantsLibraryEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'constants-library',
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
        icon: SET_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.constants-library',
        codename: vlc('ConstantsLibrary', 'ConstantsLibrary'),
        components: SET_TYPE.components,
        ui: {
            ...SET_TYPE.ui,
            nameKey: 'Constants Library',
            descriptionKey: 'Set-style custom entity for typed constants, scripts, and lightweight design-time automation.'
        },
        presentation: {},
        config: {}
    }
}
