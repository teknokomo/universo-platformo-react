import {
    DASHBOARD_SIDE_MENU_MODES,
    defaultDashboardSideMenuConfig,
    type DashboardSideMenuConfig,
    type DashboardSideMenuMode
} from '@universo-react/types'

export const EDITABLE_SIDE_MENU_MODES: DashboardSideMenuMode[] = [...DASHBOARD_SIDE_MENU_MODES]

export const SIDE_MENU_MODE_LABEL_FALLBACKS: Record<DashboardSideMenuMode, string> = {
    wide: 'wide',
    compact: 'compact',
    overlay: 'overlay'
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export const normalizeSideMenuConfig = (value: unknown): DashboardSideMenuConfig => {
    const source = isRecord(value) ? value : undefined
    const availableModes = Array.isArray(source?.availableModes)
        ? source.availableModes
              .filter((mode): mode is DashboardSideMenuMode => EDITABLE_SIDE_MENU_MODES.includes(mode as DashboardSideMenuMode))
              .filter((mode, index, modes) => modes.indexOf(mode) === index)
        : []
    const nextAvailableModes = availableModes.length > 0 ? availableModes : [...defaultDashboardSideMenuConfig.availableModes]
    const requestedPrimaryMode = source?.primaryMode
    const primaryMode =
        typeof requestedPrimaryMode === 'string' && nextAvailableModes.includes(requestedPrimaryMode as DashboardSideMenuMode)
            ? (requestedPrimaryMode as DashboardSideMenuMode)
            : defaultDashboardSideMenuConfig.primaryMode
    return {
        availableModes: nextAvailableModes,
        primaryMode: nextAvailableModes.includes(primaryMode) ? primaryMode : nextAvailableModes[0],
        rememberUserChoice:
            typeof source?.rememberUserChoice === 'boolean' ? source.rememberUserChoice : defaultDashboardSideMenuConfig.rememberUserChoice
    }
}

export const applySideMenuPatch = (
    current: DashboardSideMenuConfig | null | undefined,
    patch: Partial<DashboardSideMenuConfig>
): DashboardSideMenuConfig => normalizeSideMenuConfig({ ...normalizeSideMenuConfig(current), ...patch })
