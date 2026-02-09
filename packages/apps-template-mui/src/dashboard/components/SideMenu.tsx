import { styled } from '@mui/material/styles'
import Avatar from '@mui/material/Avatar'
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import SelectContent from './SelectContent'
import MenuContent from './MenuContent'
import CardAlert from './CardAlert'
import OptionsMenu from './OptionsMenu'
import type { DashboardMenuSlot, DashboardMenusMap, ZoneWidgetItem, ZoneWidgets } from '../Dashboard'

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

/**
 * Resolve the correct menu for a menuWidget using a 2-level fallback:
 * 1. widget.id → menus map lookup (direct widget ID match)
 * 2. Legacy single `menu` prop
 */
function resolveMenuForWidget(
    widget: ZoneWidgetItem,
    menus?: DashboardMenusMap,
    fallbackMenu?: DashboardMenuSlot
): DashboardMenuSlot | undefined {
    if (menus?.[widget.id]) {
        return menus[widget.id]
    }
    // Fallback: try first entry in menus map
    if (menus) {
        const firstKey = Object.keys(menus)[0]
        if (firstKey) return menus[firstKey]
    }
    return fallbackMenu
}

function renderWidget(widget: ZoneWidgetItem, menus?: DashboardMenusMap, fallbackMenu?: DashboardMenuSlot) {
    switch (widget.widgetKey) {
        case 'brandSelector':
            return (
                <Box key={widget.id} sx={{ display: 'flex', p: 1.5 }}>
                    <SelectContent />
                </Box>
            )
        case 'divider':
            return <Divider key={widget.id} />
        case 'menuWidget': {
            const resolved = resolveMenuForWidget(widget, menus, fallbackMenu)
            return <MenuContent key={widget.id} menu={resolved} />
        }
        case 'spacer':
            return <Box key={widget.id} sx={{ flexGrow: 1 }} />
        case 'infoCard':
            return <CardAlert key={widget.id} />
        case 'userProfile':
            return (
                <Stack
                    key={widget.id}
                    direction='row'
                    sx={{
                        p: 2,
                        gap: 1,
                        alignItems: 'center',
                        borderTop: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Avatar sizes='small' alt='Riley Carter' src='/static/images/avatar/7.jpg' sx={{ width: 36, height: 36 }} />
                    <Box sx={{ mr: 'auto' }}>
                        <Typography variant='body2' sx={{ fontWeight: 500, lineHeight: '16px' }}>
                            Riley Carter
                        </Typography>
                        <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                            riley@email.com
                        </Typography>
                    </Box>
                    <OptionsMenu />
                </Stack>
            )
        default:
            return null
    }
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
                <>
                    <Box
                        sx={{
                            display: 'flex',
                            mt: 'calc(var(--template-frame-height, 0px) + 4px)',
                            p: 1.5
                        }}
                    >
                        <SelectContent />
                    </Box>
                    <Divider />
                    <Box
                        sx={{
                            overflow: 'auto',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <MenuContent menu={menu} />
                        <CardAlert />
                    </Box>
                    <Stack
                        direction='row'
                        sx={{
                            p: 2,
                            gap: 1,
                            alignItems: 'center',
                            borderTop: '1px solid',
                            borderColor: 'divider'
                        }}
                    >
                        <Avatar sizes='small' alt='Riley Carter' src='/static/images/avatar/7.jpg' sx={{ width: 36, height: 36 }} />
                        <Box sx={{ mr: 'auto' }}>
                            <Typography variant='body2' sx={{ fontWeight: 500, lineHeight: '16px' }}>
                                Riley Carter
                            </Typography>
                            <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                riley@email.com
                            </Typography>
                        </Box>
                        <OptionsMenu />
                    </Stack>
                </>
            )}
        </Drawer>
    )
}
