import {
    DASHBOARD_SIDE_MENU_MODES,
    defaultDashboardSideMenuConfig,
    type DashboardSideMenuMode,
    type MenuWidgetConfig
} from '@universo-react/types'

export const EDITABLE_SIDE_MENU_MODES: DashboardSideMenuMode[] = [...DASHBOARD_SIDE_MENU_MODES]

export const SIDE_MENU_MODE_LABEL_FALLBACKS: Record<DashboardSideMenuMode, string> = {
    wide: 'wide',
    compact: 'compact',
    overlay: 'overlay'
}

export const normalizeSideMenuConfig = (
    value: MenuWidgetConfig['sideMenu'] | null | undefined
): NonNullable<MenuWidgetConfig['sideMenu']> => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : undefined
    const availableModes = Array.isArray(source?.availableModes)
        ? source.availableModes
              .filter((mode): mode is DashboardSideMenuMode => EDITABLE_SIDE_MENU_MODES.includes(mode as DashboardSideMenuMode))
              .filter((mode, index, modes) => modes.indexOf(mode) === index)
        : []
    const nextAvailableModes = availableModes.length > 0 ? availableModes : [...defaultDashboardSideMenuConfig.availableModes]
    const requestedPrimaryMode = source?.primaryMode
    const primaryMode =
        requestedPrimaryMode && nextAvailableModes.includes(requestedPrimaryMode)
            ? requestedPrimaryMode
            : defaultDashboardSideMenuConfig.primaryMode
    return {
        availableModes: nextAvailableModes,
        primaryMode: nextAvailableModes.includes(primaryMode) ? primaryMode : nextAvailableModes[0],
        rememberUserChoice:
            typeof source?.rememberUserChoice === 'boolean' ? source.rememberUserChoice : defaultDashboardSideMenuConfig.rememberUserChoice
    }
}

export const applySideMenuPatch = (
    current: MenuWidgetConfig['sideMenu'] | null | undefined,
    patch: Partial<NonNullable<MenuWidgetConfig['sideMenu']>>
): NonNullable<MenuWidgetConfig['sideMenu']> => normalizeSideMenuConfig({ ...normalizeSideMenuConfig(current), ...patch })
