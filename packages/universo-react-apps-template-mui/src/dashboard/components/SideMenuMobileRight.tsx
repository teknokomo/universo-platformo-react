import Drawer, { drawerClasses } from '@mui/material/Drawer'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import { renderWidget } from './widgetRenderer'
import type { ZoneWidgetItem } from '../contracts'
import type { RuntimePlacement } from '../runtime/widgetPlacementGraph'

interface SideMenuMobileRightProps {
    open: boolean
    onClose: () => void
    widgets: ZoneWidgetItem[]
    placements?: readonly RuntimePlacement[]
}

export default function SideMenuMobileRight({ open, onClose, widgets, placements = [] }: SideMenuMobileRightProps) {
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
                <Box sx={{ flexGrow: 1, overflow: 'auto', pt: 2 }}>{widgets.map((widget) => renderWidget(widget, { placements }))}</Box>
            </Stack>
        </Drawer>
    )
}
