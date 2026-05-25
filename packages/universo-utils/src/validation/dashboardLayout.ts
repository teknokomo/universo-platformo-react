import {
    defaultDashboardLayoutConfig,
    type DashboardLayoutConfig,
    type DashboardLayoutRowHeight,
    type DashboardViewMode,
    type ResolvedDashboardLayoutConfig
} from '@universo/types'

const isViewMode = (value: unknown): value is DashboardViewMode => value === 'table' || value === 'card'

const isRowHeight = (value: unknown): value is DashboardLayoutRowHeight =>
    value === 'auto' || (Number.isInteger(value) && Number(value) >= 36 && Number(value) <= 200)

const isCardColumns = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 2 && Number(value) <= 4

const resolveBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

export function normalizeDashboardLayoutConfig(
    config: DashboardLayoutConfig | Record<string, unknown> | undefined
): ResolvedDashboardLayoutConfig {
    const source = (config ?? {}) as Record<string, unknown>

    return {
        showSideMenu: resolveBoolean(source.showSideMenu, defaultDashboardLayoutConfig.showSideMenu),
        showRightSideMenu: resolveBoolean(source.showRightSideMenu, defaultDashboardLayoutConfig.showRightSideMenu),
        showAppNavbar: resolveBoolean(source.showAppNavbar, defaultDashboardLayoutConfig.showAppNavbar),
        showHeader: resolveBoolean(source.showHeader, defaultDashboardLayoutConfig.showHeader),
        showBreadcrumbs: resolveBoolean(source.showBreadcrumbs, defaultDashboardLayoutConfig.showBreadcrumbs),
        showSearch: resolveBoolean(source.showSearch, defaultDashboardLayoutConfig.showSearch),
        showDatePicker: resolveBoolean(source.showDatePicker, defaultDashboardLayoutConfig.showDatePicker),
        showOptionsMenu: resolveBoolean(source.showOptionsMenu, defaultDashboardLayoutConfig.showOptionsMenu),
        showLanguageSwitcher: resolveBoolean(source.showLanguageSwitcher, defaultDashboardLayoutConfig.showLanguageSwitcher),
        showOverviewTitle: resolveBoolean(source.showOverviewTitle, defaultDashboardLayoutConfig.showOverviewTitle),
        showOverviewCards: resolveBoolean(source.showOverviewCards, defaultDashboardLayoutConfig.showOverviewCards),
        showSessionsChart: resolveBoolean(source.showSessionsChart, defaultDashboardLayoutConfig.showSessionsChart),
        showPageViewsChart: resolveBoolean(source.showPageViewsChart, defaultDashboardLayoutConfig.showPageViewsChart),
        showDetailsTitle: resolveBoolean(source.showDetailsTitle, defaultDashboardLayoutConfig.showDetailsTitle),
        showDetailsTable: resolveBoolean(source.showDetailsTable, defaultDashboardLayoutConfig.showDetailsTable),
        showColumnsContainer: resolveBoolean(source.showColumnsContainer, defaultDashboardLayoutConfig.showColumnsContainer),
        showProductTree: resolveBoolean(source.showProductTree, defaultDashboardLayoutConfig.showProductTree),
        showUsersByCountryChart: resolveBoolean(source.showUsersByCountryChart, defaultDashboardLayoutConfig.showUsersByCountryChart),
        showFooter: resolveBoolean(source.showFooter, defaultDashboardLayoutConfig.showFooter),
        showViewToggle: resolveBoolean(source.showViewToggle, defaultDashboardLayoutConfig.showViewToggle),
        defaultViewMode: isViewMode(source.defaultViewMode) ? source.defaultViewMode : defaultDashboardLayoutConfig.defaultViewMode,
        showFilterBar: resolveBoolean(source.showFilterBar, defaultDashboardLayoutConfig.showFilterBar),
        enableRowReordering: resolveBoolean(source.enableRowReordering, defaultDashboardLayoutConfig.enableRowReordering),
        cardColumns: isCardColumns(source.cardColumns) ? source.cardColumns : defaultDashboardLayoutConfig.cardColumns,
        rowHeight: isRowHeight(source.rowHeight) ? source.rowHeight : defaultDashboardLayoutConfig.rowHeight
    }
}
