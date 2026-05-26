import type { MetahubTemplateManifest } from '@universo-react/types'
import { buildBasicMinimalSeedZoneWidgets, vlc } from './basic.template'
import { oneCCompatibleAllPresets } from './one-c-compatible.entity-presets'

const COMMON_1C_COMPONENT_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE']

const oneCCompatibleTemplatePresetRefs = [
    { presetCodename: 'one-c-constant', includedByDefault: true },
    { presetCodename: 'enumeration', includedByDefault: true },
    ...oneCCompatibleAllPresets
        .filter((preset) => preset.codename !== 'one-c-constant')
        .map((preset) => ({ presetCodename: preset.codename, includedByDefault: true }))
]

const buildObjectLikeSettings = (kind: string, options: { includeElements?: boolean } = {}) => [
    { key: `entity.${kind}.allowCopy`, value: { _value: true } },
    { key: `entity.${kind}.allowDelete`, value: { _value: true } },
    { key: `entity.${kind}.componentCodenameScope`, value: { _value: 'per-level' } },
    {
        key: `entity.${kind}.allowedComponentTypes`,
        value: { _value: COMMON_1C_COMPONENT_TYPES }
    },
    { key: `entity.${kind}.allowComponentCopy`, value: { _value: true } },
    { key: `entity.${kind}.allowComponentDelete`, value: { _value: true } },
    { key: `entity.${kind}.allowDeleteLastDisplayComponent`, value: { _value: true } },
    { key: `entity.${kind}.allowComponentMoveBetweenRootAndChildren`, value: { _value: true } },
    { key: `entity.${kind}.allowComponentMoveBetweenChildLists`, value: { _value: true } },
    ...(options.includeElements
        ? [
              { key: `entity.${kind}.allowElementCopy`, value: { _value: true } },
              { key: `entity.${kind}.allowElementDelete`, value: { _value: true } }
          ]
        : [])
]

export const oneCCompatibleTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: '1c-compatible',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('1C-Compatible', '1С-Совместимый'),
    description: vlc(
        'Template using entity types compatible with 1C:Enterprise 8.x. It is not an official 1C product and is not certified by 1C.',
        'Шаблон с использованием типов сущностей, совместимых с 1С:Предприятие 8.х. Не является официальным продуктом 1С и не сертифицирован компанией 1С.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['1c-compatible', 'transactional-accounting', 'metadata'],
        icon: 'IconBuildingBank'
    },
    presets: oneCCompatibleTemplatePresetRefs,
    seed: {
        layouts: [
            {
                codename: 'main',
                templateKey: 'dashboard',
                name: vlc('Main', 'Основной'),
                description: vlc(
                    'Main layout for 1C-Compatible published applications.',
                    'Основной макет опубликованных приложений 1С-Совместимый.'
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
            { key: 'general.timezone', value: { _value: 'Europe/Moscow' } },
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'general.codenameAutoConvertMixedAlphabets', value: { _value: true } },
            { key: 'general.codenameAutoReformat', value: { _value: true } },
            { key: 'general.codenameRequireReformat', value: { _value: true } },
            ...buildObjectLikeSettings('constant'),
            ...buildObjectLikeSettings('catalog', { includeElements: true }),
            ...buildObjectLikeSettings('document', { includeElements: true }),
            ...buildObjectLikeSettings('document-journal', { includeElements: true }),
            ...buildObjectLikeSettings('information-register', { includeElements: true }),
            ...buildObjectLikeSettings('accumulation-register', { includeElements: true }),
            ...buildObjectLikeSettings('chart-of-accounts', { includeElements: true }),
            ...buildObjectLikeSettings('chart-of-characteristic-types', { includeElements: true }),
            ...buildObjectLikeSettings('accounting-register', { includeElements: true }),
            ...buildObjectLikeSettings('chart-of-calculation-types', { includeElements: true }),
            ...buildObjectLikeSettings('calculation-register', { includeElements: true })
        ]
    }
}
