import { styled } from '@mui/material/styles'
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import MenuContent from './MenuContent'
import { renderWidget } from './widgetRenderer'
import type { DashboardMenuSlot, DashboardMenusMap, ZoneWidgets } from '../Dashboard'

const drawerWidth = 240

const Drawer = styled(MuiDrawer)({
    width: drawerWidth,
    flexShrink: 0,
    boxSizing: 'border-box',
    mt: 10,
    [`& .${drawerClasses.paper}`]: {
        width: drawerWidth,
        boxSizing: 'border-box'
    }
})

interface SideMenuProps {
    /** @deprecated Use `menus` map instead. */
    menu?: DashboardMenuSlot
    menus?: DashboardMenusMap
    zoneWidgets?: ZoneWidgets
}

export default function SideMenu({ menu, menus, zoneWidgets }: SideMenuProps) {
    const leftWidgets = zoneWidgets?.left
    const hasWidgets = Array.isArray(leftWidgets) && leftWidgets.length > 0

    return (
        <Drawer
            variant='permanent'
            sx={{
                display: { xs: 'none', md: 'block' },
                [`& .${drawerClasses.paper}`]: {
                    backgroundColor: 'background.paper'
                }
            }}
        >
            {hasWidgets ? (
                // Widget-based rendering: each widget is rendered in order from zone config
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', mt: 'calc(var(--template-frame-height, 0px) + 4px)' }}>
                    {leftWidgets.map((widget) => renderWidget(widget, menus, menu))}
                </Box>
            ) : (
                // Legacy monolithic layout (backward compatibility)
                <Box
                    sx={{
                        overflow: 'auto',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        mt: 'calc(var(--template-frame-height, 0px) + 4px)'
                    }}
                >
                    <MenuContent menu={menu} />
                </Box>
            )}
        </Drawer>
    )
}
