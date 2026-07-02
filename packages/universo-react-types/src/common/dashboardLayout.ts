import { z } from 'zod'

export const DASHBOARD_VIEW_MODES = ['table', 'card'] as const
export type DashboardViewMode = (typeof DASHBOARD_VIEW_MODES)[number]

export const DASHBOARD_SIDE_MENU_MODES = ['wide', 'compact', 'overlay'] as const
export type DashboardSideMenuMode = (typeof DASHBOARD_SIDE_MENU_MODES)[number]

export type DashboardLayoutRowHeight = number | 'auto'

export interface DashboardSideMenuConfig {
    availableModes: DashboardSideMenuMode[]
    primaryMode: DashboardSideMenuMode
    rememberUserChoice?: boolean
}

export const defaultDashboardSideMenuConfig: DashboardSideMenuConfig = {
    availableModes: ['wide', 'compact', 'overlay'],
    primaryMode: 'wide',
    rememberUserChoice: true
}

export const dashboardSideMenuConfigSchema = z
    .object({
        availableModes: z.array(z.enum(DASHBOARD_SIDE_MENU_MODES)).min(1).optional(),
        primaryMode: z.enum(DASHBOARD_SIDE_MENU_MODES).optional(),
        rememberUserChoice: z.boolean().optional()
    })
    .superRefine((value, context) => {
        if (!value.primaryMode || !value.availableModes) return
        if (!value.availableModes.includes(value.primaryMode)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['primaryMode'],
                message: 'Primary side menu mode must be included in available modes'
            })
        }
    })
    .transform((value): DashboardSideMenuConfig => {
        const availableModes = value.availableModes ?? [...defaultDashboardSideMenuConfig.availableModes]
        const requestedPrimaryMode = value.primaryMode ?? defaultDashboardSideMenuConfig.primaryMode
        return {
            availableModes,
            primaryMode: availableModes.includes(requestedPrimaryMode) ? requestedPrimaryMode : availableModes[0],
            rememberUserChoice: value.rememberUserChoice ?? defaultDashboardSideMenuConfig.rememberUserChoice
        }
    })

const dashboardLayoutConfigObjectSchema = z.object({
    showSideMenu: z.boolean().optional(),
    sideMenu: dashboardSideMenuConfigSchema.optional(),
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
    sideMenu: DashboardSideMenuConfig
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
    sideMenu: defaultDashboardSideMenuConfig,
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
