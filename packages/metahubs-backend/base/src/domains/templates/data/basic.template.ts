import type { MetahubTemplateManifest, VersionedLocalizedContent, TemplateSeedZoneWidget } from '@universo/types'

/** ISO timestamp for seed data (epoch zero — marks as factory default). */
const T0 = '1970-01-01T00:00:00.000Z'

/** Shorthand for building VLC objects in seed templates. */
const vlc = (en: string, ru: string): VersionedLocalizedContent<string> => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true, createdAt: T0, updatedAt: T0 },
        ru: { content: ru, version: 1, isActive: true, createdAt: T0, updatedAt: T0 }
    }
})

/**
 * Deep-clone config and add VLC createdAt/updatedAt to locale entries
 * that are missing them (factory-default seed data).
 */
export function enrichConfigWithVlcTimestamps(config: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(config), (_key, value) => {
        // Detect VLC locale entry: object with `content` and `version` but no `createdAt`
        if (
            value &&
            typeof value === 'object' &&
            'content' in value &&
            'version' in value &&
            'isActive' in value &&
            !('createdAt' in value)
        ) {
            return { ...value, createdAt: T0, updatedAt: T0 }
        }
        return value
    })
}

/** Shared vlc helper re-exported for basic-demo template. */
export { vlc }

/** Shared T0 re-exported for basic-demo template. */
export { T0 }

/**
 * Build minimal seed zone widgets for the basic template.
 * Only essential widgets: menuWidget (left), appNavbar + header (top), detailsTitle + detailsTable (center).
 */
function buildBasicMinimalSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return [
        {
            zone: 'left',
            widgetKey: 'menuWidget',
            sortOrder: 3,
            config: enrichConfigWithVlcTimestamps({
                showTitle: true,
                title: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Main', version: 1, isActive: true },
                        ru: { content: 'Основное', version: 1, isActive: true }
                    }
                },
                autoShowAllCatalogs: true,
                bindToHub: false,
                boundHubId: null,
                items: []
            })
        },
        { zone: 'top', widgetKey: 'appNavbar', sortOrder: 1 },
        { zone: 'top', widgetKey: 'header', sortOrder: 2 },
        { zone: 'center', widgetKey: 'detailsTitle', sortOrder: 5 },
        { zone: 'center', widgetKey: 'detailsTable', sortOrder: 6 }
    ]
}

/**
 * "Basic" minimal starter template — essential widgets only.
 * Default entities (hub, catalog, set, enumeration) can be toggled via createOptions.
 */
export const basicTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'basic',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('Basic', 'Базовый'),
    description: vlc(
        'Minimal template with essential widgets and default entities',
        'Минимальный шаблон с основными виджетами и стандартными сущностями'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['starter', 'minimal'],
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
                description: vlc('Main catalog for storing records', 'Основной каталог для хранения записей')
            },
            {
                codename: 'MainSet',
                kind: 'set',
                name: vlc('Main', 'Основной'),
                description: vlc(
                    'Main set for storing constants and typed values',
                    'Основной набор для хранения констант и типизированных значений'
                )
            },
            {
                codename: 'MainEnumeration',
                kind: 'enumeration',
                name: vlc('Main', 'Основное'),
                description: vlc('Main enumeration for fixed values', 'Основное перечисление для фиксированных значений')
            }
        ]
    }
}
