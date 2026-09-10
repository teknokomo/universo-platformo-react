import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { styled } from '@mui/material/styles'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import MuiToolbar from '@mui/material/Toolbar'
import { tabsClasses } from '@mui/material/Tabs'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import WidgetsRoundedIcon from '@mui/icons-material/WidgetsRounded'
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded'
import SideMenuMobile from './SideMenuMobile'
import SideMenuMobileRight from './SideMenuMobileRight'
import MenuButton from './MenuButton'
import ColorModeIconDropdown from '../../shared-theme/ColorModeIconDropdown'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import i18n from '@universo-react/i18n'
import type { DashboardSideMenuMode } from '@universo-react/types'
import type { DashboardMenuSlot, DashboardMenusMap, ZoneWidgetItem, ZoneWidgets } from '../Dashboard'

const drawerWidth = 240
const compactDrawerWidth = 72

const Toolbar = styled(MuiToolbar)(({ theme }) => ({
    width: '100%',
    minHeight: 56,
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    flexShrink: 0,
    [`& .${tabsClasses.list}`]: {
        gap: '8px',
        p: '8px',
        pb: 0
    },
    [theme.breakpoints.down('sm')]: {
        padding: '12px 16px'
    }
}))

interface AppNavbarProps {
    menu?: DashboardMenuSlot
    menus?: DashboardMenusMap
    rightWidgets?: ZoneWidgetItem[]
    zoneWidgets?: ZoneWidgets
    sideMenuMode?: DashboardSideMenuMode
    availableSideMenuModes?: DashboardSideMenuMode[]
    reserveDockedSideMenuWidth?: boolean
    showLanguageSwitcher?: boolean
    showLanguageSwitcherOnDesktop?: boolean
    showColorModeOnDesktop?: boolean
    onToggleDockedSideMenuMode?: () => void
    onOpenSideMenu?: () => void
}

export default function AppNavbar({
    menu,
    menus,
    rightWidgets = [],
    zoneWidgets,
    sideMenuMode = 'wide',
    availableSideMenuModes = ['wide'],
    reserveDockedSideMenuWidth = true,
    showLanguageSwitcher = true,
    showLanguageSwitcherOnDesktop = true,
    showColorModeOnDesktop = true,
    onToggleDockedSideMenuMode,
    onOpenSideMenu
}: AppNavbarProps) {
    const [leftOpen, setLeftOpen] = React.useState(false)
    const [rightOpen, setRightOpen] = React.useState(false)
    const leftMenuTriggerRef = React.useRef<HTMLButtonElement | null>(null)
    const leftMenuWasOpenRef = React.useRef(false)
    const mobileMenuInstanceId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '')
    const leftDrawerId = `runtime-mobile-navigation-drawer-${mobileMenuInstanceId}`
    const { t } = useTranslation('apps', { i18n })

    const restoreLeftMenuFocus = React.useCallback(() => {
        const trigger = leftMenuTriggerRef.current
        if (trigger?.isConnected && !trigger.disabled) trigger.focus()
    }, [])

    React.useEffect(() => {
        if (leftMenuWasOpenRef.current && !leftOpen) restoreLeftMenuFocus()
        leftMenuWasOpenRef.current = leftOpen
    }, [leftOpen, restoreLeftMenuFocus])

    React.useEffect(() => {
        if (!leftOpen || typeof window === 'undefined') return undefined

        const closeOnNavigation = () => setLeftOpen(false)
        window.addEventListener('popstate', closeOnNavigation)
        window.addEventListener('hashchange', closeOnNavigation)

        return () => {
            window.removeEventListener('popstate', closeOnNavigation)
            window.removeEventListener('hashchange', closeOnNavigation)
        }
    }, [leftOpen])

    const toggleLeftDrawer = React.useCallback(
        (newOpen: boolean) => () => {
            setLeftOpen(newOpen)
            if (newOpen) setRightOpen(false)
        },
        []
    )

    const toggleRightDrawer = (newOpen: boolean) => () => {
        setRightOpen(newOpen)
        if (newOpen) setLeftOpen(false)
    }

    const hasRightWidgets = rightWidgets.length > 0
    const canToggleDockedMode =
        availableSideMenuModes.includes('wide') &&
        availableSideMenuModes.includes('compact') &&
        typeof onToggleDockedSideMenuMode === 'function'
    const showModeSwitcher = canToggleDockedMode
    const dockedModeToggleLabel =
        sideMenuMode === 'compact'
            ? t('runtime.menu.enableWideMenu', 'Enable wide menu')
            : t('runtime.menu.enableCompactMenu', 'Enable compact menu')
    const canOpenOverlayMenu = availableSideMenuModes.includes('overlay') && typeof onOpenSideMenu === 'function'
    const usesExternalOverlayMenu = sideMenuMode === 'overlay' && canOpenOverlayMenu
    const leftMenuAriaProps = usesExternalOverlayMenu
        ? { 'aria-haspopup': 'dialog' as const }
        : { 'aria-expanded': leftOpen, 'aria-controls': leftDrawerId }
    const appBarLeft = reserveDockedSideMenuWidth
        ? sideMenuMode === 'compact'
            ? compactDrawerWidth
            : sideMenuMode === 'wide'
            ? drawerWidth
            : 0
        : 0
    const handleOpenLeftMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        leftMenuTriggerRef.current = event.currentTarget
        if (usesExternalOverlayMenu) {
            onOpenSideMenu?.()
            return
        }
        toggleLeftDrawer(true)()
    }

    return (
        <AppBar
            position='fixed'
            sx={{
                display: { xs: 'block', md: sideMenuMode === 'overlay' || showModeSwitcher ? 'block' : 'none' },
                right: 0,
                left: { xs: 0, md: appBarLeft },
                boxShadow: 0,
                bgcolor: 'transparent',
                backgroundImage: 'none',
                borderBottom: 0,
                pointerEvents: 'none',
                top: 'var(--template-frame-height, 0px)',
                width: 'auto'
            }}
        >
            {sideMenuMode === 'overlay' && canOpenOverlayMenu ? (
                <Box
                    data-testid='runtime-overlay-menu-edge-control'
                    sx={{
                        position: 'fixed',
                        top: 'calc(var(--template-frame-height, 0px) + 12px)',
                        left: { xs: '16px', sm: '24px' },
                        pointerEvents: 'auto'
                    }}
                >
                    <MenuButton aria-label={t('runtime.menu.open', 'Open menu')} {...leftMenuAriaProps} onClick={handleOpenLeftMenu}>
                        <MenuRoundedIcon />
                    </MenuButton>
                </Box>
            ) : null}
            <Toolbar
                variant='regular'
                data-testid='runtime-app-toolbar'
                sx={{
                    maxWidth: '100%',
                    mx: 'auto'
                }}
            >
                <Stack
                    direction='row'
                    sx={{
                        alignItems: 'center',
                        flexGrow: 1,
                        width: '100%',
                        gap: 1,
                        justifyContent: 'flex-end'
                    }}
                >
                    <Stack
                        direction='row'
                        spacing={1}
                        useFlexGap
                        data-testid='runtime-app-toolbar-actions'
                        sx={{ alignItems: 'center', pointerEvents: 'auto' }}
                    >
                        {showLanguageSwitcher && (
                            <Box sx={{ display: showLanguageSwitcherOnDesktop ? undefined : { xs: 'inline-flex', md: 'none' } }}>
                                <LanguageSwitcher />
                            </Box>
                        )}
                        <ColorModeIconDropdown
                            data-testid='runtime-color-mode-button'
                            aria-label={t('colorMode.label', 'Color mode')}
                            sx={showColorModeOnDesktop ? undefined : { display: { xs: 'inline-flex', md: 'none' } }}
                        />
                        {showModeSwitcher && sideMenuMode !== 'overlay' && (
                            <Box sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
                                <MenuButton
                                    aria-label={dockedModeToggleLabel}
                                    title={dockedModeToggleLabel}
                                    onClick={onToggleDockedSideMenuMode}
                                >
                                    <ViewSidebarRoundedIcon />
                                </MenuButton>
                            </Box>
                        )}
                        {hasRightWidgets && (
                            <MenuButton aria-label={t('runtime.menu.contextPanel', 'Context panel')} onClick={toggleRightDrawer(true)}>
                                <WidgetsRoundedIcon />
                            </MenuButton>
                        )}
                        <Box
                            sx={{
                                display: {
                                    xs: sideMenuMode === 'overlay' && canOpenOverlayMenu ? 'none' : 'inline-flex',
                                    md: 'none'
                                }
                            }}
                        >
                            <MenuButton
                                aria-label={t('runtime.menu.open', 'Open menu')}
                                {...leftMenuAriaProps}
                                onClick={handleOpenLeftMenu}
                            >
                                <MenuRoundedIcon />
                            </MenuButton>
                        </Box>
                    </Stack>
                    {!usesExternalOverlayMenu && (
                        <SideMenuMobile
                            open={leftOpen}
                            drawerId={leftDrawerId}
                            restoreFocusRef={leftMenuTriggerRef}
                            toggleDrawer={toggleLeftDrawer}
                            menu={menu}
                            menus={menus}
                            zoneWidgets={zoneWidgets}
                        />
                    )}
                    {hasRightWidgets && (
                        <SideMenuMobileRight
                            open={rightOpen}
                            onClose={toggleRightDrawer(false)}
                            widgets={rightWidgets}
                            menu={menu}
                            menus={menus}
                        />
                    )}
                </Stack>
            </Toolbar>
        </AppBar>
    )
}
