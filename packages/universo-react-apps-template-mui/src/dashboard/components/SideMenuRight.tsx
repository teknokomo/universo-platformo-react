import { styled } from '@mui/material/styles'
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import { renderWidget } from './widgetRenderer'
import type { ZoneWidgetItem, DashboardMenusMap, DashboardMenuSlot } from '../Dashboard'

const RIGHT_DRAWER_WIDTH = 280

const Drawer = styled(MuiDrawer)({
    width: RIGHT_DRAWER_WIDTH,
    flexShrink: 0,
    boxSizing: 'border-box',
    [`& .${drawerClasses.paper}`]: {
        width: RIGHT_DRAWER_WIDTH,
        boxSizing: 'border-box'
    }
})

interface SideMenuRightProps {
    widgets: ZoneWidgetItem[]
    /** @deprecated Use `menus` map instead. */
    menu?: DashboardMenuSlot
    menus?: DashboardMenusMap
}

export default function SideMenuRight({ widgets, menu, menus }: SideMenuRightProps) {
    if (widgets.length === 0) return null

    return (
        <Drawer
            variant='permanent'
            anchor='right'
            sx={{
                display: { xs: 'none', md: 'block' },
                [`& .${drawerClasses.paper}`]: {
                    backgroundColor: 'background.paper'
                }
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    mt: 'calc(var(--template-frame-height, 0px) + 4px)',
                    overflow: 'auto'
                }}
            >
                {widgets.map((widget) => renderWidget(widget, menus, menu))}
            </Box>
        </Drawer>
    )
}
