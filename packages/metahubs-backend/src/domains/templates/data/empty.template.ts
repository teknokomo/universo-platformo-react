import type { MetahubTemplateManifest } from '@universo/types'
import { buildBasicMinimalSeedZoneWidgets, vlc } from './basic.template'

export const emptyTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'empty',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('Empty', 'Пустой'),
    description: vlc(
        'Blank metahub template without predefined metadata entity types',
        'Пустой шаблон метахаба без заранее созданных типов метаданных'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['starter', 'blank'],
        icon: 'Dashboard'
    },
    presets: [],
    seed: {
        layouts: [
            {
                codename: 'main',
                templateKey: 'dashboard',
                name: vlc('Main', 'Основной'),
                description: vlc('Main layout for published applications', 'Основной макет для опубликованных приложений'),
                isDefault: true,
                isActive: true,
                sortOrder: 0
            }
        ],
        layoutZoneWidgets: {
            main: buildBasicMinimalSeedZoneWidgets()
        },
        settings: [
            { key: 'general.language', value: { _value: 'system' } },
            { key: 'general.timezone', value: { _value: 'UTC' } },
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'general.codenameAutoConvertMixedAlphabets', value: { _value: true } },
            { key: 'general.codenameAutoReformat', value: { _value: true } },
            { key: 'general.codenameRequireReformat', value: { _value: true } }
        ]
    }
}
