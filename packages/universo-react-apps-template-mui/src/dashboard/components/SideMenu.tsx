import { styled } from '@mui/material/styles'
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded'
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded'
import { useTranslation } from 'react-i18next'
import i18n from '@universo-react/i18n'
import MenuButton from './MenuButton'
import { renderWidget } from './widgetRenderer'
import type { ZoneWidgets } from '../contracts'
import type { RuntimePlacement } from '../runtime/widgetPlacementGraph'
import type { DashboardSideMenuMode } from '@universo-react/types'

const drawerWidth = 240
const compactDrawerWidth = 72

const Drawer = styled(MuiDrawer, {
    shouldForwardProp: (prop) => prop !== 'menuMode'
})<{ menuMode: 'wide' | 'compact' | 'overlay' }>(({ menuMode }) => ({
    width: menuMode === 'overlay' ? undefined : menuMode === 'compact' ? compactDrawerWidth : drawerWidth,
    flexShrink: 0,
    boxSizing: 'border-box',
    mt: 10,
    [`& .${drawerClasses.paper}`]: {
        width: menuMode === 'compact' ? compactDrawerWidth : drawerWidth,
        boxSizing: 'border-box'
    }
}))

interface SideMenuProps {
    zoneWidgets?: ZoneWidgets
    placements?: readonly RuntimePlacement[]
    mode?: DashboardSideMenuMode
    availableModes?: DashboardSideMenuMode[]
    onToggleDockedMode?: () => void
    onToggleOverlayMode?: () => void
    open?: boolean
    onClose?: () => void
}

export default function SideMenu({
    zoneWidgets,
    placements = [],
    mode = 'wide',
    availableModes = ['wide'],
    onToggleDockedMode,
    onToggleOverlayMode,
    open = false,
    onClose
}: SideMenuProps) {
    const { t } = useTranslation('apps', { i18n })
    const leftWidgets = zoneWidgets?.left
    const isOverlay = mode === 'overlay'
    const menuVariant = mode === 'compact' ? 'compact' : 'wide'
    const canSwitchMode =
        !isOverlay && availableModes.includes('wide') && availableModes.includes('compact') && typeof onToggleDockedMode === 'function'
    const canToggleOverlayMode = availableModes.includes('overlay') && typeof onToggleOverlayMode === 'function'
    const sideMenuTestId = isOverlay ? 'runtime-side-menu-overlay' : 'runtime-side-menu-docked'
    const controlsDirection = mode === 'compact' ? 'column' : 'row'
    const controlsPlacement = mode === 'compact' ? 'right' : 'top'
    const controlsJustify = mode === 'compact' ? 'center' : 'flex-start'
    const dockedModeToggleLabel =
        mode === 'compact'
            ? t('runtime.menu.enableWideMenu', 'Enable wide menu')
            : t('runtime.menu.enableCompactMenu', 'Enable compact menu')
    const controlsLabel = isOverlay
        ? t('runtime.menu.useDockedMenu', 'Use docked menu')
        : t('runtime.menu.useOverlayMenu', 'Use overlay menu')
    const renderControls = () => {
        if (!canSwitchMode && !canToggleOverlayMode) return null

        return (
            <Box sx={{ flexShrink: 0, p: 1 }}>
                <Divider sx={{ mb: 1 }} />
                <Box
                    data-testid='runtime-side-menu-controls'
                    sx={{
                        display: 'flex',
                        flexDirection: controlsDirection,
                        alignItems: 'center',
                        justifyContent: controlsJustify,
                        gap: 1
                    }}
                >
                    {canSwitchMode ? (
                        <Tooltip title={dockedModeToggleLabel} placement={controlsPlacement}>
                            <MenuButton aria-label={dockedModeToggleLabel} onClick={onToggleDockedMode}>
                                <ViewSidebarRoundedIcon />
                            </MenuButton>
                        </Tooltip>
                    ) : null}
                    {canToggleOverlayMode ? (
                        <Tooltip title={controlsLabel} placement={controlsPlacement}>
                            <MenuButton aria-label={controlsLabel} onClick={onToggleOverlayMode}>
                                <MenuOpenRoundedIcon />
                            </MenuButton>
                        </Tooltip>
                    ) : null}
                </Box>
            </Box>
        )
    }
    const drawerContent = (
        <Box
            data-testid={sideMenuTestId}
            sx={{ display: 'flex', flexDirection: 'column', height: '100%', mt: 'calc(var(--template-frame-height, 0px) + 4px)' }}
        >
            <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
                {leftWidgets?.map((widget) => renderWidget(widget, { menuVariant, placements }))}
            </Box>
            {renderControls()}
        </Box>
    )

    return (
        <Drawer
            menuMode={mode}
            variant={isOverlay ? 'temporary' : 'permanent'}
            open={isOverlay ? open : true}
            onClose={onClose}
            ModalProps={isOverlay ? { keepMounted: true, disableScrollLock: true } : undefined}
            sx={{
                display: { xs: isOverlay ? 'block' : 'none', md: 'block' },
                [`& .${drawerClasses.paper}`]: {
                    backgroundColor: 'background.paper'
                }
            }}
        >
            {drawerContent}
        </Drawer>
    )
}
