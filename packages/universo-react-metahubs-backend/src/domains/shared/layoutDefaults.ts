import type { DashboardLayoutZone, DashboardLayoutWidgetKey } from '@universo-react/types'

/**
 * Describes a default widget placed into a dashboard layout zone.
 */
export type DefaultZoneWidget = {
    zone: DashboardLayoutZone
    widgetKey: DashboardLayoutWidgetKey
    sortOrder: number
    config?: Record<string, unknown>
    /** When omitted, defaults to true at seed time (new metahubs only). */
    isActive?: boolean
}

/**
 * The canonical set of dashboard zone widgets created for every new layout.
 * Used by both MetahubLayoutsService (layout CRUD) and MetahubSchemaService (schema initialization path).
 */
export const DEFAULT_DASHBOARD_ZONE_WIDGETS: DefaultZoneWidget[] = [
    // Left zone — decomposed sidebar widgets
    { zone: 'left', widgetKey: 'workspaceSwitcher', sortOrder: 1, config: { variant: 'compact' }, isActive: false },
    { zone: 'left', widgetKey: 'divider', sortOrder: 2, isActive: false },
    { zone: 'left', widgetKey: 'menuWidget', sortOrder: 3, config: { variant: 'generated' } },
    { zone: 'left', widgetKey: 'spacer', sortOrder: 4, isActive: false },
    { zone: 'left', widgetKey: 'infoCard', sortOrder: 5, isActive: false },
    { zone: 'left', widgetKey: 'userProfile', sortOrder: 6, isActive: false },
    // Top zone
    { zone: 'top', widgetKey: 'appNavbar', sortOrder: 1, isActive: false },
    { zone: 'top', widgetKey: 'header', sortOrder: 2 },
    { zone: 'top', widgetKey: 'breadcrumbs', sortOrder: 3, isActive: false },
    { zone: 'top', widgetKey: 'search', sortOrder: 4, isActive: false },
    { zone: 'top', widgetKey: 'datePicker', sortOrder: 5, isActive: false },
    { zone: 'top', widgetKey: 'optionsMenu', sortOrder: 6, isActive: false },
    { zone: 'top', widgetKey: 'languageSwitcher', sortOrder: 7, isActive: false },
    // Center zone
    { zone: 'center', widgetKey: 'overviewTitle', sortOrder: 1, isActive: false },
    { zone: 'center', widgetKey: 'overviewCards', sortOrder: 2, isActive: false },
    { zone: 'center', widgetKey: 'sessionsChart', sortOrder: 3, isActive: false },
    { zone: 'center', widgetKey: 'pageViewsChart', sortOrder: 4, isActive: false },
    { zone: 'center', widgetKey: 'detailsTitle', sortOrder: 5 },
    { zone: 'center', widgetKey: 'detailsTable', sortOrder: 6 },
    {
        zone: 'center',
        widgetKey: 'columnsContainer',
        sortOrder: 7,
        isActive: false,
        config: { columns: [{ slotKey: 'column:main', width: 12 }] }
    },
    {
        zone: 'center',
        widgetKey: 'detailsTabs',
        sortOrder: 8,
        isActive: false,
        config: { tabs: [{ slotKey: 'tab:main', label: 'Overview', isDefault: true }] }
    },
    // Right / Bottom
    { zone: 'right', widgetKey: 'resourcePreview', sortOrder: 1, isActive: false },
    { zone: 'bottom', widgetKey: 'footer', sortOrder: 1, isActive: false }
]
