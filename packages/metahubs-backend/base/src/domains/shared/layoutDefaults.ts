import type { DashboardLayoutZone, DashboardLayoutWidgetKey } from '@universo/types'

/**
 * Describes a default widget placed into a dashboard layout zone.
 */
export type DefaultZoneWidget = {
    zone: DashboardLayoutZone
    widgetKey: DashboardLayoutWidgetKey
    sortOrder: number
    config?: Record<string, unknown>
}

/**
 * The canonical set of dashboard zone widgets created for every new layout.
 * Used by both MetahubLayoutsService (layout CRUD) and MetahubSchemaService (legacy schema path).
 */
export const DEFAULT_DASHBOARD_ZONE_WIDGETS: DefaultZoneWidget[] = [
    // Left zone — decomposed sidebar widgets
    { zone: 'left', widgetKey: 'brandSelector', sortOrder: 1 },
    { zone: 'left', widgetKey: 'divider', sortOrder: 2 },
    { zone: 'left', widgetKey: 'menuWidget', sortOrder: 3, config: {
        showTitle: true,
        title: { _schema: '1', _primary: 'en', locales: { en: { content: 'Main', version: 1, isActive: true }, ru: { content: 'Главное', version: 1, isActive: true } } },
        autoShowAllCatalogs: true,
        items: [
            { id: 'default-catalogs-all', kind: 'catalogs_all', title: { _schema: '1', _primary: 'en', locales: { en: { content: 'Catalogs', version: 1, isActive: true }, ru: { content: 'Каталоги', version: 1, isActive: true } } }, icon: 'database', sortOrder: 1, isActive: true }
        ]
    } },
    { zone: 'left', widgetKey: 'spacer', sortOrder: 4 },
    { zone: 'left', widgetKey: 'divider', sortOrder: 5 },
    { zone: 'left', widgetKey: 'infoCard', sortOrder: 6 },
    { zone: 'left', widgetKey: 'userProfile', sortOrder: 7 },
    // Top zone
    { zone: 'top', widgetKey: 'appNavbar', sortOrder: 1 },
    { zone: 'top', widgetKey: 'header', sortOrder: 2 },
    { zone: 'top', widgetKey: 'breadcrumbs', sortOrder: 3 },
    { zone: 'top', widgetKey: 'search', sortOrder: 4 },
    { zone: 'top', widgetKey: 'datePicker', sortOrder: 5 },
    { zone: 'top', widgetKey: 'optionsMenu', sortOrder: 6 },
    // Center zone
    { zone: 'center', widgetKey: 'overviewTitle', sortOrder: 1 },
    { zone: 'center', widgetKey: 'overviewCards', sortOrder: 2 },
    { zone: 'center', widgetKey: 'sessionsChart', sortOrder: 3 },
    { zone: 'center', widgetKey: 'pageViewsChart', sortOrder: 4 },
    { zone: 'center', widgetKey: 'detailsTitle', sortOrder: 5 },
    { zone: 'center', widgetKey: 'detailsTable', sortOrder: 6 },
    // Right / Bottom
    { zone: 'right', widgetKey: 'detailsSidePanel', sortOrder: 1 },
    { zone: 'bottom', widgetKey: 'footer', sortOrder: 1 }
]

/**
 * Builds a boolean config map from a list of active widgets.
 * Keys like `showSideMenu`, `showHeader`, etc. toggle dashboard sections.
 */
export const buildDashboardLayoutConfig = (items: Array<{ widgetKey: DashboardLayoutWidgetKey; zone?: DashboardLayoutZone }>): Record<string, boolean> => {
    const active = new Set(items.map((item) => item.widgetKey))
    const hasLeftWidget = items.some((item) => item.zone === 'left')
    return {
        showSideMenu: hasLeftWidget,
        showAppNavbar: active.has('appNavbar'),
        showHeader: active.has('header'),
        showBreadcrumbs: active.has('breadcrumbs'),
        showSearch: active.has('search'),
        showDatePicker: active.has('datePicker'),
        showOptionsMenu: active.has('optionsMenu'),
        showOverviewTitle: active.has('overviewTitle'),
        showOverviewCards: active.has('overviewCards'),
        showSessionsChart: active.has('sessionsChart'),
        showPageViewsChart: active.has('pageViewsChart'),
        showDetailsTitle: active.has('detailsTitle'),
        showDetailsTable: active.has('detailsTable'),
        showDetailsSidePanel: active.has('detailsSidePanel'),
        showFooter: active.has('footer')
    }
}
