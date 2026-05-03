import { z } from 'zod'

export const DASHBOARD_VIEW_MODES = ['table', 'card'] as const
export type DashboardViewMode = (typeof DASHBOARD_VIEW_MODES)[number]

export type DashboardLayoutRowHeight = number | 'auto'

const dashboardLayoutConfigObjectSchema = z.object({
    showSideMenu: z.boolean().optional(),
    showRightSideMenu: z.boolean().optional(),
    showAppNavbar: z.boolean().optional(),
    showHeader: z.boolean().optional(),
    showBreadcrumbs: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    showDatePicker: z.boolean().optional(),
    showOptionsMenu: z.boolean().optional(),
    showLanguageSwitcher: z.boolean().optional(),
    showOverviewTitle: z.boolean().optional(),
    showOverviewCards: z.boolean().optional(),
    showSessionsChart: z.boolean().optional(),
    showPageViewsChart: z.boolean().optional(),
    showDetailsTitle: z.boolean().optional(),
    showDetailsTable: z.boolean().optional(),
    showColumnsContainer: z.boolean().optional(),
    showProductTree: z.boolean().optional(),
    showUsersByCountryChart: z.boolean().optional(),
    showFooter: z.boolean().optional(),
    showViewToggle: z.boolean().optional(),
    defaultViewMode: z.enum(DASHBOARD_VIEW_MODES).optional(),
    showFilterBar: z.boolean().optional(),
    enableRowReordering: z.boolean().optional(),
    cardColumns: z.number().int().min(2).max(4).optional(),
    rowHeight: z.union([z.number().int().min(36).max(200), z.literal('auto')]).optional()
})

export const dashboardLayoutConfigSchema = dashboardLayoutConfigObjectSchema.optional()

export type DashboardLayoutConfig = z.infer<typeof dashboardLayoutConfigObjectSchema>

export interface ResolvedDashboardLayoutConfig {
    showSideMenu: boolean
    showRightSideMenu: boolean
    showAppNavbar: boolean
    showHeader: boolean
    showBreadcrumbs: boolean
    showSearch: boolean
    showDatePicker: boolean
    showOptionsMenu: boolean
    showLanguageSwitcher: boolean
    showOverviewTitle: boolean
    showOverviewCards: boolean
    showSessionsChart: boolean
    showPageViewsChart: boolean
    showDetailsTitle: boolean
    showDetailsTable: boolean
    showColumnsContainer: boolean
    showProductTree: boolean
    showUsersByCountryChart: boolean
    showFooter: boolean
    showViewToggle: boolean
    defaultViewMode: DashboardViewMode
    showFilterBar: boolean
    enableRowReordering: boolean
    cardColumns: number
    rowHeight?: DashboardLayoutRowHeight
}

export const defaultDashboardLayoutConfig: ResolvedDashboardLayoutConfig = {
    showSideMenu: true,
    showRightSideMenu: false,
    showAppNavbar: true,
    showHeader: true,
    showBreadcrumbs: true,
    showSearch: true,
    showDatePicker: true,
    showOptionsMenu: true,
    showLanguageSwitcher: true,
    showOverviewTitle: true,
    showOverviewCards: false,
    showSessionsChart: false,
    showPageViewsChart: false,
    showDetailsTitle: true,
    showDetailsTable: true,
    showColumnsContainer: false,
    showProductTree: false,
    showUsersByCountryChart: false,
    showFooter: true,
    showViewToggle: false,
    defaultViewMode: 'table',
    showFilterBar: false,
    enableRowReordering: false,
    cardColumns: 3
}
