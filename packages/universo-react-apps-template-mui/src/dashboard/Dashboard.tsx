import type { GridColDef, GridFilterModel, GridPaginationModel, GridLocaleText, GridSortModel } from '@mui/x-data-grid'
import type {} from '@mui/material/themeCssVarsAugmentation'
import { alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    defaultDashboardLayoutConfig,
    type CreateTargetDefault,
    type DashboardSideMenuMode,
    type DashboardLayoutConfig,
    type RuntimePageBlock
} from '@universo-react/types'
import { normalizeDashboardLayoutConfig } from '@universo-react/utils'
import AppNavbar from './components/AppNavbar'
import Header from './components/Header'
import MainGrid from './components/MainGrid'
import SideMenu from './components/SideMenu'
import SideMenuRight from './components/SideMenuRight'
import { DashboardDetailsProvider } from './DashboardDetailsContext'
import type { AppDataResponse } from '../api/api'
import type { ResourceSourceTypeOption } from '../components/dialogs/FormDialog'

export type { DashboardLayoutConfig } from '@universo-react/types'

export interface DashboardDetailsSlot {
    title: string
    applicationId?: string
    sectionId?: string | null
    sectionCodename?: string | null
    objectCollectionId?: string | null
    objectCollectionCodename?: string | null
    sections?: Array<{ id: string; codename: string }>
    objectCollections?: Array<{ id: string; codename: string }>
    apiBaseUrl?: string
    locale?: string
    currentWorkspaceId?: string | null
    runtimeAccessMode?: 'member' | 'public'
    runtimeQueryKeyPrefix?: readonly unknown[]
    workspacesEnabled?: boolean
    permissions?: AppDataResponse['permissions']
    banner?: React.ReactNode
    content?: React.ReactNode
    rows: Array<Record<string, unknown> & { id: string }>
    columns: GridColDef[]
    runtimeColumns?: AppDataResponse['columns']
    loading?: boolean
    rowCount?: number
    paginationModel?: GridPaginationModel
    onPaginationModelChange?: (model: GridPaginationModel) => void
    sortModel?: GridSortModel
    onSortModelChange?: (model: GridSortModel) => void
    filterModel?: GridFilterModel
    onFilterModelChange?: (model: GridFilterModel) => void
    searchValue?: string
    onSearchValueChange?: (value: string) => void
    pageSizeOptions?: number[]
    /** Optional toolbar actions (e.g. Create button) rendered next to the title. */
    actions?: React.ReactNode
    /** Optional host-provided SPA navigation handler for runtime widgets. */
    navigate?: (href: string) => void
    /** MUI DataGrid locale text overrides (e.g. from @mui/x-data-grid/locales) */
    localeText?: Partial<GridLocaleText>
    /** Search scope contract for the current object runtime. */
    searchMode?: 'server' | 'page-local'
    /** Optional persisted row-reorder contract for the current object runtime. */
    rowReorder?: {
        onReorder: (orderedRowIds: string[]) => Promise<void>
        isPending?: boolean
    }
    /** Structured Page metadata blocks, compatible with the Editor.js block shape. */
    pageBlocks?: RuntimePageBlock[]
    /** Runtime learner page/player display settings. */
    pagePlayer?: {
        showOutline?: boolean
        showProgressHeader?: boolean
        completeButtonMode?: 'manual' | 'autoAfterOpen' | 'hidden'
        progressStorageKey?: string
        onProgressChange?: (payload: { action: 'view' | 'complete' }) => Promise<void> | void
    }
    /** Generic table defaults supplied by the host application settings. */
    tableDefaults?: {
        defaultViewMode?: 'table' | 'card'
        columnPreset?: {
            columns: Array<{
                field: string
                visible?: boolean
                width?: number
                flex?: number
                sort?: 'asc' | 'desc'
            }>
        }
    }
    /** Generic resource-source type policy supplied by the host application settings. */
    resourceSourceTypes?: ResourceSourceTypeOption[]
    /** Generic create target handler used by metadata-driven datasource widgets. */
    onOpenCreateTarget?: (target: DashboardCreateTarget) => void
    /** Generic row action menu handler used by metadata-driven datasource widgets. */
    onOpenRowMenu?: (event: React.MouseEvent<HTMLElement>, rowId: string) => void
    /** Generic source-row action handler used by metadata-driven datasource widgets. */
    onOpenRowTarget?: (target: DashboardRowTarget, action: DashboardRowTargetAction) => void
}

export interface DashboardCreateTarget {
    id: string
    label: unknown
    sectionId?: string | null
    sectionCodename?: string | null
    objectCollectionId?: string | null
    objectCollectionCodename?: string | null
    icon?: string | null
    surface?: 'dialog' | 'page'
    disabled?: boolean
    disabledReason?: unknown
    createDefaults?: readonly CreateTargetDefault[]
}

export type DashboardRowTargetAction = 'edit' | 'copy' | 'delete'

export interface DashboardRowTarget {
    rowId: string
    sectionId?: string | null
    sectionCodename?: string | null
    objectCollectionId?: string | null
    objectCollectionCodename?: string | null
}

export interface DashboardMenuItem {
    id: string
    label: string
    icon?: string | null
    kind: 'section' | 'hub' | 'link'
    sectionId?: string | null
    objectCollectionId?: string | null
    hubId?: string | null
    treeEntityId?: string | null
    href?: string | null
    selected?: boolean
}

export interface DashboardMenuSlot {
    title?: string | null
    showTitle?: boolean
    items: DashboardMenuItem[]
    overflowItems?: DashboardMenuItem[]
    overflowLabel?: string | null
    activeSectionId?: string | null
    onSelectSection?: (sectionId: string) => void
    activeObjectCollectionId?: string | null
    onSelectObjectCollection?: (objectCollectionId: string) => void
}

/** Map of menus keyed by widget ID. Each menuWidget resolves its menu via widget.id lookup. */
export type DashboardMenusMap = { [widgetId: string]: DashboardMenuSlot }

export interface ZoneWidgetItem {
    id: string
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
    isActive?: boolean
}

export interface ZoneWidgets {
    left: ZoneWidgetItem[]
    right?: ZoneWidgetItem[]
    center?: ZoneWidgetItem[]
}

export interface DashboardProps {
    layoutConfig?: DashboardLayoutConfig
    zoneWidgets?: ZoneWidgets
    details?: DashboardDetailsSlot
    /** @deprecated Use `menus` map instead. Kept for backward compatibility. */
    menu?: DashboardMenuSlot
    /** Map of menus by widget ID. Each menuWidget resolves its menu via widget.id. */
    menus?: DashboardMenusMap
}

const DEFAULT_LAYOUT: DashboardLayoutConfig = defaultDashboardLayoutConfig
const DEFAULT_SIDE_MENU_CONFIG = {
    availableModes: ['wide', 'compact', 'overlay'] as DashboardSideMenuMode[],
    primaryMode: 'wide' as DashboardSideMenuMode,
    rememberUserChoice: true
}
const SIDE_MENU_MODE_SET = new Set<DashboardSideMenuMode>(['wide', 'compact', 'overlay'])

const isSideMenuMode = (value: unknown): value is DashboardSideMenuMode =>
    typeof value === 'string' && SIDE_MENU_MODE_SET.has(value as DashboardSideMenuMode)

const readSideMenuConfig = (config: DashboardLayoutConfig | undefined) => {
    const source =
        config?.sideMenu && typeof config.sideMenu === 'object' && !Array.isArray(config.sideMenu)
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

const EMPTY_RIGHT_WIDGETS: ZoneWidgetItem[] = []
const EMPTY_CENTER_WIDGETS: ZoneWidgetItem[] = []
const WORKSPACE_SWITCHER_WIDGET_ID = 'runtime-workspace-switcher-widget'
const WORKSPACE_SWITCHER_DIVIDER_WIDGET_ID = 'runtime-workspace-switcher-divider-widget'
const FALLBACK_MENU_WIDGET_ID = 'runtime-workspace-menu-widget'
const SIDE_MENU_MODE_STORAGE_PREFIX = 'universo:apps-template:side-menu-mode'

const withRuntimeWorkspaceSwitcher = (zoneWidgets: ZoneWidgets | undefined, workspacesEnabled?: boolean): ZoneWidgets | undefined => {
    if (!workspacesEnabled) return zoneWidgets

    const baseLeft = zoneWidgets?.left ?? []
    const hasWorkspaceSwitcher = baseLeft.some((widget) => widget.widgetKey === 'workspaceSwitcher')
    const nextLeft = hasWorkspaceSwitcher
        ? baseLeft
        : [
              {
                  id: WORKSPACE_SWITCHER_WIDGET_ID,
                  widgetKey: 'workspaceSwitcher',
                  sortOrder: -1000,
                  config: {}
              },
              {
                  id: WORKSPACE_SWITCHER_DIVIDER_WIDGET_ID,
                  widgetKey: 'divider',
                  sortOrder: -999,
                  config: {}
              },
              ...(baseLeft.length > 0
                  ? baseLeft
                  : [
                        {
                            id: FALLBACK_MENU_WIDGET_ID,
                            widgetKey: 'menuWidget',
                            sortOrder: 0,
                            config: {}
                        }
                    ])
          ]

    return {
        ...(zoneWidgets ?? {}),
        left: nextLeft,
        right: zoneWidgets?.right,
        center: zoneWidgets?.center
    }
}

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
    const layout = useMemo(() => {
        const normalized = normalizeDashboardLayoutConfig(props.layoutConfig ?? DEFAULT_LAYOUT)
        return {
            ...normalized,
            sideMenu: normalized.sideMenu ?? readSideMenuConfig(props.layoutConfig)
        }
    }, [props.layoutConfig])
    const zoneWidgets = useMemo(
        () => withRuntimeWorkspaceSwitcher(props.zoneWidgets, props.details?.workspacesEnabled),
        [props.details?.workspacesEnabled, props.zoneWidgets]
    )
    const rightWidgets = zoneWidgets?.right ?? EMPTY_RIGHT_WIDGETS
    const centerWidgets = zoneWidgets?.center ?? EMPTY_CENTER_WIDGETS
    const showRightSideMenu = (layout.showRightSideMenu ?? true) && rightWidgets.length > 0
    const hasViewportBoundedCanvas = hasFitViewportPlayCanvasWidget(centerWidgets)
    const sideMenuStorageKey = `${SIDE_MENU_MODE_STORAGE_PREFIX}:${props.details?.applicationId ?? 'standalone'}`
    const availableSideMenuModes = layout.sideMenu.availableModes
    const primarySideMenuMode = layout.sideMenu.primaryMode
    const rememberSideMenuChoice = layout.sideMenu.rememberUserChoice === true
    const [storedSideMenuMode, setStoredSideMenuMode] = useState<DashboardSideMenuMode | null>(() =>
        readStoredSideMenuMode(sideMenuStorageKey, availableSideMenuModes, rememberSideMenuChoice)
    )
    const [overlayOpen, setOverlayOpen] = useState(false)
    const sideMenuEnabled = layout.showSideMenu
    const sideMenuMode =
        storedSideMenuMode && availableSideMenuModes.includes(storedSideMenuMode) ? storedSideMenuMode : primarySideMenuMode
    const showDesktopNavbar = sideMenuEnabled && (availableSideMenuModes.length > 1 || sideMenuMode === 'overlay')
    const showAppNavbar = layout.showAppNavbar || showDesktopNavbar
    const dockedSideMenuModes = availableSideMenuModes.filter((mode): mode is 'wide' | 'compact' => mode === 'wide' || mode === 'compact')
    const lastDockedSideMenuModeRef = useRef<DashboardSideMenuMode>(
        primarySideMenuMode === 'overlay' ? dockedSideMenuModes[0] ?? 'wide' : primarySideMenuMode
    )
    const canToggleDockedSideMenuMode = sideMenuEnabled && dockedSideMenuModes.length > 1
    const canOpenOverlaySideMenu = sideMenuEnabled && availableSideMenuModes.includes('overlay')
    const canToggleOverlaySideMenuMode = canOpenOverlaySideMenu && dockedSideMenuModes.length > 0

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
                        menu={props.menu}
                        menus={props.menus}
                        zoneWidgets={zoneWidgets}
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
                        menu={props.menu}
                        menus={props.menus}
                        zoneWidgets={zoneWidgets}
                        mode='overlay'
                        availableModes={availableSideMenuModes}
                        onToggleOverlayMode={canToggleOverlaySideMenuMode ? toggleOverlaySideMenuMode : undefined}
                        open={overlayOpen}
                        onClose={() => setOverlayOpen(false)}
                    />
                )}
                {showAppNavbar && (
                    <AppNavbar
                        menu={props.menu}
                        menus={props.menus}
                        rightWidgets={rightWidgets}
                        zoneWidgets={zoneWidgets}
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
                        spacing={2}
                        sx={{
                            alignItems: 'center',
                            minWidth: 0,
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            px: { xs: 2, sm: 3 },
                            pb: hasViewportBoundedCanvas ? { xs: 2, sm: 3 } : 5,
                            mt: { xs: showAppNavbar ? 8 : 0, md: showDesktopNavbar ? 8 : 0 }
                        }}
                    >
                        {layout.showHeader && <Header layoutConfig={layout} />}
                        <MainGrid
                            layoutConfig={layout}
                            centerWidgets={centerWidgets}
                            fullWidth={sideMenuMode === 'overlay' || sideMenuMode === 'compact'}
                        />
                    </Stack>
                </Box>
                {showRightSideMenu && <SideMenuRight widgets={rightWidgets} menu={props.menu} menus={props.menus} />}
            </Box>
        </DashboardDetailsProvider>
    )
}
