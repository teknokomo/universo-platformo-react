import Drawer, { drawerClasses } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import MenuContent from './MenuContent'
import { renderWidget } from './widgetRenderer'
import type { DashboardMenuSlot, DashboardMenusMap, ZoneWidgets } from '../Dashboard'

interface SideMenuMobileProps {
    open: boolean | undefined
    toggleDrawer: (newOpen: boolean) => () => void
    /** @deprecated Use `menus` map instead. */
    menu?: DashboardMenuSlot
    menus?: DashboardMenusMap
    zoneWidgets?: ZoneWidgets
}

export default function SideMenuMobile({ open, toggleDrawer, menu, menus, zoneWidgets }: SideMenuMobileProps) {
    // Resolve effective menu for mobile: first from menus map (sorted by widget ID for stability), or fallback to legacy menu prop
    const firstEntry = menus ? Object.values(menus).find((slot) => (slot?.items ?? []).length > 0) : undefined
    const effectiveMenu = firstEntry ?? menu
    const leftWidgets = zoneWidgets?.left ?? []
    const hasMenuWidget = leftWidgets.some((widget) => widget.widgetKey === 'menuWidget')
    return (
        <Drawer
            // Intentionally anchored to 'left' — the right side is now served by SideMenuMobileRight.
            // Before the right drawer was introduced, this was anchored to 'right'.
            anchor='left'
            open={open}
            onClose={toggleDrawer(false)}
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                [`& .${drawerClasses.paper}`]: {
                    backgroundImage: 'none',
                    backgroundColor: 'background.paper'
                }
            }}
        >
            <Stack
                sx={{
                    maxWidth: '70dvw',
                    minWidth: 240,
                    height: '100%'
                }}
            >
                <Stack sx={{ flexGrow: 1 }}>
                    {hasMenuWidget ? null : <MenuContent menu={effectiveMenu} />}
                    {leftWidgets.length > 0 ? (
                        <Box sx={{ flexShrink: 0 }}>{leftWidgets.map((widget) => renderWidget(widget, menus, menu))}</Box>
                    ) : null}
                </Stack>
            </Stack>
        </Drawer>
    )
}
