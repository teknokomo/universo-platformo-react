import type { MetahubTemplateManifest, VersionedLocalizedContent, TemplateSeedZoneWidget } from '@universo/types'
import { DEFAULT_DASHBOARD_ZONE_WIDGETS } from '../../shared/layoutDefaults'

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
 * Convert DEFAULT_DASHBOARD_ZONE_WIDGETS into TemplateSeedZoneWidget[],
 * enriching menuWidget config with VLC timestamps for seed data consistency.
 */
function buildSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return DEFAULT_DASHBOARD_ZONE_WIDGETS.map((item) => {
        const widget: TemplateSeedZoneWidget = {
            zone: item.zone,
            widgetKey: item.widgetKey,
            sortOrder: item.sortOrder
        }
        if (item.config) {
            widget.config = enrichConfigWithVlcTimestamps(item.config)
        }
        return widget
    })
}

/**
 * Deep-clone config and add VLC createdAt/updatedAt to locale entries
 * that are missing them (factory-default seed data).
 */
function enrichConfigWithVlcTimestamps(config: Record<string, unknown>): Record<string, unknown> {
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

/**
 * "Basic" starter template — default dashboard layout with standard widgets,
 * starter catalog entity with attributes, and predefined settings.
 */
export const basicTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'basic',
    version: '1.1.0',
    minStructureVersion: 2,
    name: vlc('Basic', 'Базовый'),
    description: vlc(
        'Default template with dashboard layout and standard widgets',
        'Шаблон по умолчанию с макетом дашборда и стандартными виджетами'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['starter', 'dashboard'],
        icon: 'Dashboard'
    },
    seed: {
        layouts: [
            {
                codename: 'dashboard',
                templateKey: 'dashboard',
                name: vlc('Dashboard', 'Дашборд'),
                description: vlc('Default layout for published applications', 'Макет по умолчанию для опубликованных приложений'),
                isDefault: true,
                isActive: true,
                sortOrder: 0
            }
        ],
        layoutZoneWidgets: {
            dashboard: buildSeedZoneWidgets()
        },
        settings: [
            { key: 'general.language', value: { _value: 'en' } },
            { key: 'general.timezone', value: { _value: 'UTC' } }
        ]
    }
}
