import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Drawer, { drawerClasses } from '@mui/material/Drawer'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import MenuButton from './MenuButton'
import MenuContent from './MenuContent'
import CardAlert from './CardAlert'
import type { DashboardMenuSlot, DashboardMenusMap } from '../Dashboard'

interface SideMenuMobileProps {
    open: boolean | undefined
    toggleDrawer: (newOpen: boolean) => () => void
    /** @deprecated Use `menus` map instead. */
    menu?: DashboardMenuSlot
    menus?: DashboardMenusMap
}

export default function SideMenuMobile({ open, toggleDrawer, menu, menus }: SideMenuMobileProps) {
    // Resolve effective menu for mobile: first from menus map (sorted by widget ID for stability), or fallback to legacy menu prop
    const firstEntry = menus ? Object.values(menus)[0] : undefined
    const effectiveMenu = firstEntry ?? menu
    return (
        <Drawer
            anchor='right'
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
                    height: '100%'
                }}
            >
                <Stack direction='row' sx={{ p: 2, pb: 0, gap: 1 }}>
                    <Stack direction='row' sx={{ gap: 1, alignItems: 'center', flexGrow: 1, p: 1 }}>
                        <Avatar sizes='small' alt='Riley Carter' src='/static/images/avatar/7.jpg' sx={{ width: 24, height: 24 }} />
                        <Typography component='p' variant='h6'>
                            Riley Carter
                        </Typography>
                    </Stack>
                    <MenuButton showBadge>
                        <NotificationsRoundedIcon />
                    </MenuButton>
                </Stack>
                <Divider />
                <Stack sx={{ flexGrow: 1 }}>
                    <MenuContent menu={effectiveMenu} />
                    <Divider />
                </Stack>
                <CardAlert />
                <Stack sx={{ p: 2 }}>
                    <Button variant='outlined' fullWidth startIcon={<LogoutRoundedIcon />}>
                        Logout
                    </Button>
                </Stack>
            </Stack>
        </Drawer>
    )
}
