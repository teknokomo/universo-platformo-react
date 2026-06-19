import type { MetahubTemplateManifest } from '@universo-react/types'
import { buildBasicMinimalSeedZoneWidgets, vlc } from './basic.template'

// Per-kind settings for the non-object-like `project` type. It has no
// components (no dataSchema/records/physicalTable capability), so only the
// copy/delete toggles apply — component-level settings would be dead config.
const buildProjectEntitySettings = (kind: string) => [
    { key: `entity.${kind}.allowCopy`, value: { _value: true } },
    { key: `entity.${kind}.allowDelete`, value: { _value: true } }
]

/**
 * "PlayCanvas" template — bootstraps a metahub with the Projects entity type
 * (bound to PlayCanvas Editor projects) plus the base entity types reused by
 * PlayCanvas/MMOOMM configurations. Package attachment (PlayCanvas Editor,
 * Colyseus) stays a runtime step in the metahub — the template manifest does
 * not declare package attachments.
 */
export const playcanvasTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'playcanvas',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('PlayCanvas', 'PlayCanvas'),
    description: vlc(
        'Template for PlayCanvas-based configurations. Adds a Projects entity type bound to PlayCanvas Editor projects on top of the base entity types.',
        'Шаблон для конфигураций на основе PlayCanvas. Добавляет тип сущности «Проекты», связанный с проектами PlayCanvas Editor, поверх базовых типов сущностей.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['playcanvas', 'projects', '3d', 'mmoomm'],
        icon: 'IconBox'
    },
    presets: [
        { presetCodename: 'project', includedByDefault: true },
        { presetCodename: 'hub', includedByDefault: true },
        { presetCodename: 'page', includedByDefault: true },
        { presetCodename: 'object', includedByDefault: true },
        { presetCodename: 'set', includedByDefault: true },
        { presetCodename: 'enumeration', includedByDefault: true }
    ],
    seed: {
        layouts: [
            {
                codename: 'main',
                templateKey: 'dashboard',
                name: vlc('Main', 'Основной'),
                description: vlc(
                    'Main layout for PlayCanvas published applications.',
                    'Основной макет для опубликованных приложений PlayCanvas.'
                ),
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
            { key: 'general.codenameRequireReformat', value: { _value: true } },
            ...buildProjectEntitySettings('project'),
            { key: 'entity.object.allowComponentCopy', value: { _value: true } },
            { key: 'entity.object.allowComponentDelete', value: { _value: true } },
            { key: 'entity.object.allowDeleteLastDisplayComponent', value: { _value: true } }
        ]
    }
}
