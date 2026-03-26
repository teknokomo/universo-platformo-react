import type { MetahubTemplateManifest, TemplateSeedZoneWidget } from '@universo/types'
import { DEFAULT_DASHBOARD_ZONE_WIDGETS } from '../../shared/layoutDefaults'
import { vlc, enrichConfigWithVlcTimestamps } from './basic.template'

/**
 * Convert DEFAULT_DASHBOARD_ZONE_WIDGETS into TemplateSeedZoneWidget[] for the demo template.
 * All widgets are active. Standalone detailsTable (center, sortOrder 6) is removed
 * in favor of columnsContainer (sortOrder 7) which includes detailsTable + productTree.
 */
function buildDemoSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return DEFAULT_DASHBOARD_ZONE_WIDGETS.filter((w) => !(w.widgetKey === 'detailsTable' && w.zone === 'center')).map((item) => {
        const widget: TemplateSeedZoneWidget = {
            zone: item.zone,
            widgetKey: item.widgetKey,
            sortOrder: item.sortOrder
            // All widgets active in demo — do NOT set isActive: false
        }

        if (item.config) {
            widget.config = enrichConfigWithVlcTimestamps(item.config)
        }

        return widget
    })
}

/**
 * "Basic Demo" template — full dashboard with ALL widgets active,
 * sample entities with attributes, constants and enumeration values.
 */
export const basicDemoTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'basic-demo',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('Basic Demo', 'Базовый-демо'),
    description: vlc(
        'Full demo template with all widgets active and sample entities',
        'Демо-шаблон со всеми виджетами и примерами сущностей'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['demo', 'dashboard', 'full'],
        icon: 'Dashboard'
    },
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
            main: buildDemoSeedZoneWidgets()
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
            { key: 'catalogs.allowAttributeCopy', value: { _value: true } },
            { key: 'catalogs.allowAttributeDelete', value: { _value: true } },
            { key: 'catalogs.allowDeleteLastDisplayAttribute', value: { _value: true } }
        ],
        entities: [
            {
                codename: 'MainHub',
                kind: 'hub',
                name: vlc('Main', 'Основной'),
                description: vlc('Main hub for organizing metahub content', 'Основной хаб для организации контента метахаба')
            },
            {
                codename: 'MainCatalog',
                kind: 'catalog',
                name: vlc('Main', 'Основной'),
                description: vlc('Main catalog for storing records', 'Основной каталог для хранения записей'),
                attributes: [
                    {
                        codename: 'Title',
                        dataType: 'STRING',
                        name: vlc('Title', 'Название'),
                        sortOrder: 1,
                        validationRules: { maxLength: 255 },
                        uiConfig: { isDisplay: true }
                    },
                    {
                        codename: 'Description',
                        dataType: 'STRING',
                        name: vlc('Description', 'Описание'),
                        sortOrder: 2
                    }
                ]
            },
            {
                codename: 'MainSet',
                kind: 'set',
                name: vlc('Main', 'Основной'),
                description: vlc(
                    'Main set for storing constants and typed values',
                    'Основной набор для хранения констант и типизированных значений'
                ),
                constants: [
                    {
                        codename: 'AppName',
                        dataType: 'STRING',
                        name: vlc('Application Name', 'Название приложения'),
                        sortOrder: 1,
                        value: 'My Application'
                    }
                ]
            },
            {
                codename: 'MainEnumeration',
                kind: 'enumeration',
                name: vlc('Main', 'Основное'),
                description: vlc('Main enumeration for fixed values', 'Основное перечисление для фиксированных значений')
            }
        ],
        enumerationValues: {
            MainEnumeration: [
                {
                    codename: 'Active',
                    name: vlc('Active', 'Активный'),
                    sortOrder: 1,
                    isDefault: true
                },
                {
                    codename: 'Inactive',
                    name: vlc('Inactive', 'Неактивный'),
                    sortOrder: 2
                }
            ]
        }
    }
}
