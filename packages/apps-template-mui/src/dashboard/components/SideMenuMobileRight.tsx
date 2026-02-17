import Drawer, { drawerClasses } from '@mui/material/Drawer'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import { renderWidget } from './widgetRenderer'
import type { ZoneWidgetItem, DashboardMenusMap, DashboardMenuSlot } from '../Dashboard'

interface SideMenuMobileRightProps {
    open: boolean
    onClose: () => void
    widgets: ZoneWidgetItem[]
    /** @deprecated Use `menus` map instead. */
    menu?: DashboardMenuSlot
    menus?: DashboardMenusMap
}

export default function SideMenuMobileRight({ open, onClose, widgets, menu, menus }: SideMenuMobileRightProps) {
    if (widgets.length === 0) return null

    return (
        <Drawer
            anchor='right'
            open={open}
            onClose={onClose}
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                [`& .${drawerClasses.paper}`]: {
                    backgroundImage: 'none',
                    backgroundColor: 'background.paper'
                }
            }}
        >
            <Stack sx={{ maxWidth: '70dvw', height: '100%' }}>
                <Box sx={{ flexGrow: 1, overflow: 'auto', pt: 2 }}>
                    {widgets.map((widget) => renderWidget(widget, menus, menu))}
                </Box>
            </Stack>
        </Drawer>
    )
}
