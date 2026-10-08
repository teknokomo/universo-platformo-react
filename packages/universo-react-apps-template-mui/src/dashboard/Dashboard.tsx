import type {} from '@mui/material/themeCssVarsAugmentation'
import { alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type DashboardSideMenuMode, type DashboardLayoutConfig } from '@universo-react/types'
import AppNavbar from './components/AppNavbar'
import Header from './components/Header'
import MainGrid from './components/MainGrid'
import SideMenu from './components/SideMenu'
import SideMenuRight from './components/SideMenuRight'
import { renderWidget } from './components/widgetRenderer'
import { DashboardDetailsProvider } from './DashboardDetailsContext'
import { rootPlacements } from './runtime/widgetPlacementGraph'
import type { DashboardProps, ZoneWidgetItem } from './contracts'

export type {
    DashboardCreateTarget,
    DashboardDetailsSlot,
    DashboardLayoutConfig,
    DashboardProps,
    DashboardRowActionTarget,
    DashboardRowTarget,
    DashboardRowTargetAction,
    DashboardSideMenuMode,
    ZoneWidgetItem,
    ZoneWidgets
} from './contracts'

const DEFAULT_SIDE_MENU_CONFIG = {
    availableModes: ['wide', 'compact', 'overlay'] as DashboardSideMenuMode[],
    primaryMode: 'wide' as DashboardSideMenuMode,
    rememberUserChoice: true
}
const SIDE_MENU_MODE_SET = new Set<DashboardSideMenuMode>(['wide', 'compact', 'overlay'])

const isSideMenuMode = (value: unknown): value is DashboardSideMenuMode =>
    typeof value === 'string' && SIDE_MENU_MODE_SET.has(value as DashboardSideMenuMode)

const readSideMenuConfig = (config: Pick<DashboardLayoutConfig, 'sideMenu'> | undefined) => {
    const source =
        config?.sideMenu && typeof config?.sideMenu === 'object' && !Array.isArray(config?.sideMenu)
            ? (config.sideMenu as unknown as Record<string, unknown>)
            : {}
    const availableModes = Array.isArray(source.availableModes)
        ? source.availableModes.filter(isSideMenuMode).filter((mode, index, modes) => modes.indexOf(mode) === index)
        : []
    const nextAvailableModes = availableModes.length > 0 ? availableModes : DEFAULT_SIDE_MENU_CONFIG.availableModes
    const requestedPrimaryMode = isSideMenuMode(source.primaryMode) ? source.primaryMode : DEFAULT_SIDE_MENU_CONFIG.primaryMode
    const primaryMode = nextAvailableModes.includes(requestedPrimaryMode) ? requestedPrimaryMode : nextAvailableModes[0]

    return {
        availableModes: nextAvailableModes,
        primaryMode,
        rememberUserChoice:
            typeof source.rememberUserChoice === 'boolean' ? source.rememberUserChoice : DEFAULT_SIDE_MENU_CONFIG.rememberUserChoice
    }
}

const SIDE_MENU_MODE_STORAGE_PREFIX = 'universo:apps-template:side-menu-mode'
const SHELL_TOP_WIDGET_KEYS = new Set(['appNavbar', 'header'])
const HEADER_LEADING_WIDGET_KEYS = new Set(['breadcrumbs'])
const HEADER_ACTION_WIDGET_KEYS = new Set(['search', 'datePicker', 'optionsMenu', 'languageSwitcher', 'colorModeSwitcher'])

const hasFitViewportPlayCanvasWidget = (widgets: readonly ZoneWidgetItem[]) =>
    widgets.some((widget) => widget.widgetKey === 'playcanvasCanvas' && widget.config?.heightMode === 'fitViewport')

const readStoredSideMenuMode = (
    storageKey: string,
    availableModes: readonly DashboardSideMenuMode[],
    rememberUserChoice: boolean
): DashboardSideMenuMode | null => {
    if (!rememberUserChoice || typeof window === 'undefined') return null
    try {
        const stored = window.localStorage.getItem(storageKey)
        if (!stored) return null
        if (availableModes.includes(stored as DashboardSideMenuMode)) {
            return stored as DashboardSideMenuMode
        }
        window.localStorage.removeItem(storageKey)
    } catch {
        return null
    }
    return null
}

const writeStoredSideMenuMode = (storageKey: string, mode: DashboardSideMenuMode): void => {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(storageKey, mode)
    } catch {
        // Persistence is optional; the in-memory mode remains usable.
    }
}

const removeStoredSideMenuMode = (storageKey: string): void => {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(storageKey)
    } catch {
        // Persistence is optional; storage restrictions must not block rendering.
    }
}

export default function Dashboard(props: DashboardProps) {
    const layout = useMemo(() => ({ sideMenu: readSideMenuConfig(props.layoutConfig) }), [props.layoutConfig])
    const zoneWidgets = props.zoneWidgets
    const placements = useMemo(() => Object.values(zoneWidgets ?? {}).flatMap((widgets) => widgets ?? []), [zoneWidgets])
    const topWidgets = rootPlacements(placements, 'top')
    const leftWidgets = rootPlacements(placements, 'left')
    const rightWidgets = rootPlacements(placements, 'right')
    const centerWidgets = rootPlacements(placements, 'center')
    const bottomWidgets = rootPlacements(placements, 'bottom')
    const rootZoneWidgets = { left: leftWidgets, top: topWidgets, right: rightWidgets, center: centerWidgets, bottom: bottomWidgets }
    const showRightSideMenu = rightWidgets.length > 0
    const hasViewportBoundedCanvas = hasFitViewportPlayCanvasWidget(centerWidgets)
    const sideMenuStorageKey = `${SIDE_MENU_MODE_STORAGE_PREFIX}:${props.details?.applicationId ?? 'standalone'}`
    const availableSideMenuModes = layout.sideMenu.availableModes
    const primarySideMenuMode = layout.sideMenu.primaryMode
    const rememberSideMenuChoice = layout.sideMenu.rememberUserChoice === true
    const [storedSideMenuMode, setStoredSideMenuMode] = useState<DashboardSideMenuMode | null>(() =>
        readStoredSideMenuMode(sideMenuStorageKey, availableSideMenuModes, rememberSideMenuChoice)
    )
    const [overlayOpen, setOverlayOpen] = useState(false)
    const sideMenuEnabled = leftWidgets.length > 0
    const sideMenuMode =
        storedSideMenuMode && availableSideMenuModes.includes(storedSideMenuMode) ? storedSideMenuMode : primarySideMenuMode
    const activeTopWidgets = topWidgets
    const hasActiveTopWidget = (widgetKey: string) => activeTopWidgets.some((widget) => widget.widgetKey === widgetKey)
    const showAppNavbar = hasActiveTopWidget('appNavbar')
    const showHeader = hasActiveTopWidget('header')
    const dockedSideMenuModes = availableSideMenuModes.filter((mode): mode is 'wide' | 'compact' => mode === 'wide' || mode === 'compact')
    const canToggleDockedSideMenuMode = sideMenuEnabled && dockedSideMenuModes.length > 1
    const showAppNavbarOnDesktop = showAppNavbar && (sideMenuMode === 'overlay' || canToggleDockedSideMenuMode)
    const canOpenOverlaySideMenu = sideMenuEnabled && availableSideMenuModes.includes('overlay')
    const canToggleOverlaySideMenuMode = canOpenOverlaySideMenu && dockedSideMenuModes.length > 0
    const headerLeadingWidgets = showHeader ? activeTopWidgets.filter((widget) => HEADER_LEADING_WIDGET_KEYS.has(widget.widgetKey)) : []
    const headerActionWidgets = showHeader ? activeTopWidgets.filter((widget) => HEADER_ACTION_WIDGET_KEYS.has(widget.widgetKey)) : []
    const headerManagedWidgetIds = new Set([...headerLeadingWidgets, ...headerActionWidgets].map((widget) => widget.id))
    const visibleTopWidgets = activeTopWidgets.filter(
        (widget) => !SHELL_TOP_WIDGET_KEYS.has(widget.widgetKey) && !headerManagedWidgetIds.has(widget.id)
    )
    const lastDockedSideMenuModeRef = useRef<DashboardSideMenuMode>(
        primarySideMenuMode === 'overlay' ? dockedSideMenuModes[0] ?? 'wide' : primarySideMenuMode
    )

    useEffect(() => {
        if (!rememberSideMenuChoice) {
            removeStoredSideMenuMode(sideMenuStorageKey)
        }
        const nextStoredMode = readStoredSideMenuMode(sideMenuStorageKey, availableSideMenuModes, rememberSideMenuChoice)
        setStoredSideMenuMode((current) => {
            if (current === nextStoredMode) {
                return current
            }
            return nextStoredMode
        })
    }, [availableSideMenuModes, rememberSideMenuChoice, sideMenuStorageKey])

    useEffect(() => {
        if (!storedSideMenuMode || availableSideMenuModes.includes(storedSideMenuMode)) {
            return
        }
        setStoredSideMenuMode(null)
        removeStoredSideMenuMode(sideMenuStorageKey)
    }, [availableSideMenuModes, sideMenuStorageKey, storedSideMenuMode])

    useEffect(() => {
        if (sideMenuMode !== 'overlay') {
            setOverlayOpen(false)
            if (sideMenuMode === 'wide' || sideMenuMode === 'compact') {
                lastDockedSideMenuModeRef.current = sideMenuMode
            }
        }
    }, [sideMenuMode])

    const setSideMenuMode = useCallback(
        (mode: DashboardSideMenuMode) => {
            if (!availableSideMenuModes.includes(mode)) return
            setStoredSideMenuMode(mode)
            if (layout.sideMenu.rememberUserChoice) {
                writeStoredSideMenuMode(sideMenuStorageKey, mode)
            }
        },
        [availableSideMenuModes, layout.sideMenu.rememberUserChoice, sideMenuStorageKey]
    )

    const toggleDockedSideMenuMode = useCallback(() => {
        if (!canToggleDockedSideMenuMode) return
        const nextMode = sideMenuMode === 'wide' ? 'compact' : 'wide'
        setSideMenuMode(nextMode)
    }, [canToggleDockedSideMenuMode, setSideMenuMode, sideMenuMode])

    const openOverlaySideMenu = useCallback(() => {
        if (!canOpenOverlaySideMenu || sideMenuMode !== 'overlay') return
        setOverlayOpen(true)
    }, [canOpenOverlaySideMenu, sideMenuMode])

    const toggleOverlaySideMenuMode = useCallback(() => {
        if (!canToggleOverlaySideMenuMode) return

        if (sideMenuMode === 'overlay') {
            setOverlayOpen(false)
            const fallbackDockedMode =
                dockedSideMenuModes.find((mode) => mode === lastDockedSideMenuModeRef.current) ??
                dockedSideMenuModes.find((mode) => mode === 'wide') ??
                dockedSideMenuModes[0]
            if (fallbackDockedMode) {
                setSideMenuMode(fallbackDockedMode)
            }
            return
        }

        if (sideMenuMode === 'wide' || sideMenuMode === 'compact') {
            lastDockedSideMenuModeRef.current = sideMenuMode
        }
        setSideMenuMode('overlay')
        setOverlayOpen(true)
    }, [canToggleOverlaySideMenuMode, dockedSideMenuModes, setSideMenuMode, sideMenuMode])

    return (
        <DashboardDetailsProvider value={props.details}>
            <Box sx={{ display: 'flex', minWidth: 0, width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
                {sideMenuEnabled && sideMenuMode !== 'overlay' && (
                    <SideMenu
                        zoneWidgets={rootZoneWidgets}
                        placements={placements}
                        mode={sideMenuMode}
                        availableModes={availableSideMenuModes}
                        onToggleDockedMode={canToggleDockedSideMenuMode ? toggleDockedSideMenuMode : undefined}
                        onToggleOverlayMode={canToggleOverlaySideMenuMode ? toggleOverlaySideMenuMode : undefined}
                        open={overlayOpen}
                        onClose={() => setOverlayOpen(false)}
                    />
                )}
                {sideMenuEnabled && canOpenOverlaySideMenu && sideMenuMode === 'overlay' && (
                    <SideMenu
                        zoneWidgets={rootZoneWidgets}
                        placements={placements}
                        mode='overlay'
                        availableModes={availableSideMenuModes}
                        onToggleOverlayMode={canToggleOverlaySideMenuMode ? toggleOverlaySideMenuMode : undefined}
                        open={overlayOpen}
                        onClose={() => setOverlayOpen(false)}
                    />
                )}
                {showAppNavbar && (
                    <AppNavbar
                        rightWidgets={rightWidgets}
                        zoneWidgets={rootZoneWidgets}
                        placements={placements}
                        sideMenuMode={sideMenuMode}
                        availableSideMenuModes={availableSideMenuModes}
                        reserveDockedSideMenuWidth={sideMenuMode !== 'overlay'}
                        onToggleDockedSideMenuMode={canToggleDockedSideMenuMode ? toggleDockedSideMenuMode : undefined}
                        onOpenSideMenu={openOverlaySideMenu}
                    />
                )}
                {/* Main content */}
                <Box
                    component='main'
                    sx={(theme) => ({
                        flex: '1 1 0%',
                        minWidth: 0,
                        width: '100%',
                        maxWidth: '100%',
                        backgroundColor: theme.vars
                            ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
                            : alpha(theme.palette.background.default, 1),
                        overflowX: 'hidden',
                        overflowY: 'auto'
                    })}
                >
                    <Stack
                        data-testid='runtime-main-content'
                        spacing={1}
                        sx={{
                            alignItems: 'center',
                            minWidth: 0,
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            px: { xs: 2, sm: 3 },
                            pb: hasViewportBoundedCanvas ? { xs: 2, sm: 3 } : 5,
                            mt: {
                                xs: showAppNavbar ? 8 : 0,
                                md: showAppNavbarOnDesktop ? 8 : 0
                            }
                        }}
                    >
                        {visibleTopWidgets.map((widget) => (
                            <Box
                                key={widget.id}
                                data-testid={`top-zone-widget-${widget.widgetKey}`}
                                sx={{
                                    width: '100%',
                                    minWidth: 0
                                }}
                            >
                                {renderWidget(widget, { placements })}
                            </Box>
                        ))}
                        {showHeader && (
                            <Header
                                leading={headerLeadingWidgets.map((widget) => renderWidget(widget, { placements }))}
                                actions={headerActionWidgets.map((widget) => renderWidget(widget, { placements }))}
                            />
                        )}
                        <MainGrid placements={placements} fullWidth={sideMenuMode === 'overlay' || sideMenuMode === 'compact'} />
                    </Stack>
                </Box>
                {showRightSideMenu && <SideMenuRight widgets={rightWidgets} placements={placements} />}
            </Box>
        </DashboardDetailsProvider>
    )
}
