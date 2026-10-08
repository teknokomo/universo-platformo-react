import {
    dashboardLayoutConfigSchema,
    dashboardSideMenuConfigSchema,
    defaultDashboardLayoutConfig,
    type DashboardSideMenuConfig,
    type DashboardLayoutConfig,
    type ResolvedDashboardLayoutConfig
} from '@universo-react/types'

export const normalizeDashboardSideMenuConfig = (value: unknown): DashboardSideMenuConfig => {
    const parsed = dashboardSideMenuConfigSchema.parse(value ?? {})
    const availableModes = parsed.availableModes.filter((mode, index, modes) => modes.indexOf(mode) === index)
    const primaryMode = availableModes.includes(parsed.primaryMode) ? parsed.primaryMode : availableModes[0]

    return {
        availableModes,
        primaryMode,
        rememberUserChoice: parsed.rememberUserChoice
    }
}

export function normalizeDashboardLayoutConfig(
    config: DashboardLayoutConfig | Record<string, unknown> | undefined
): ResolvedDashboardLayoutConfig {
    const parsed = dashboardLayoutConfigSchema.parse(config ?? {}) ?? {}
    return {
        sideMenu: parsed.sideMenu ?? defaultDashboardLayoutConfig.sideMenu
    }
}
