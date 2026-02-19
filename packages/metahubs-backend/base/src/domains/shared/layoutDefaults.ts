import type { DashboardLayoutZone, DashboardLayoutWidgetKey } from '@universo/types'

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
    { zone: 'left', widgetKey: 'brandSelector', sortOrder: 1, isActive: false },
    { zone: 'left', widgetKey: 'divider', sortOrder: 2, isActive: false },
    {
        zone: 'left',
        widgetKey: 'menuWidget',
        sortOrder: 3,
        config: {
            showTitle: true,
            title: {
                _schema: '1',
                _primary: 'en',
                locales: { en: { content: 'Main', version: 1, isActive: true }, ru: { content: 'Главное', version: 1, isActive: true } }
            },
            autoShowAllCatalogs: true,
            items: [
                {
                    id: 'default-catalogs-all',
                    kind: 'catalogs_all',
                    title: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Catalogs', version: 1, isActive: true },
                            ru: { content: 'Каталоги', version: 1, isActive: true }
                        }
                    },
                    icon: 'database',
                    sortOrder: 1,
                    isActive: true
                }
            ]
        }
    },
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
        config: {
            columns: [
                { id: 'seed-col-details-table', width: 9, widgets: [{ widgetKey: 'detailsTable' }] },
                { id: 'seed-col-sidebar', width: 3, widgets: [{ widgetKey: 'productTree' }] }
            ]
        }
    },
    // Right / Bottom
    { zone: 'right', widgetKey: 'productTree', sortOrder: 1, isActive: false },
    { zone: 'right', widgetKey: 'usersByCountryChart', sortOrder: 2, isActive: false },
    { zone: 'bottom', widgetKey: 'footer', sortOrder: 1, isActive: false }
]

/**
 * Builds a boolean config map from a list of active widgets.
 * Keys like `showSideMenu`, `showHeader`, etc. toggle dashboard sections.
 *
 * Zone-specific widgets (productTree, usersByCountryChart) only set their
 * boolean flag when placed in the center zone. Right-zone placement is
 * handled via zoneWidgets data, not layoutConfig booleans.
 */
export const buildDashboardLayoutConfig = (
    items: Array<{ widgetKey: DashboardLayoutWidgetKey; zone?: DashboardLayoutZone }>
): Record<string, boolean> => {
    const active = new Set(items.map((item) => item.widgetKey))
    const centerActive = new Set(items.filter((item) => item.zone === 'center').map((item) => item.widgetKey))
    const hasLeftWidget = items.some((item) => item.zone === 'left')
    const hasRightWidget = items.some((item) => item.zone === 'right')
    return {
        showSideMenu: hasLeftWidget,
        showRightSideMenu: hasRightWidget,
        showAppNavbar: active.has('appNavbar'),
        showHeader: active.has('header'),
        showBreadcrumbs: active.has('breadcrumbs'),
        showSearch: active.has('search'),
        showDatePicker: active.has('datePicker'),
        showOptionsMenu: active.has('optionsMenu'),
        showLanguageSwitcher: active.has('languageSwitcher'),
        showOverviewTitle: centerActive.has('overviewTitle'),
        showOverviewCards: centerActive.has('overviewCards'),
        showSessionsChart: centerActive.has('sessionsChart'),
        showPageViewsChart: centerActive.has('pageViewsChart'),
        showDetailsTitle: centerActive.has('detailsTitle'),
        showDetailsTable: centerActive.has('detailsTable'),
        showColumnsContainer: centerActive.has('columnsContainer'),
        showProductTree: centerActive.has('productTree'),
        showUsersByCountryChart: centerActive.has('usersByCountryChart'),
        showFooter: active.has('footer')
    }
}
