import * as React from 'react'
import { styled } from '@mui/material/styles'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import MuiToolbar from '@mui/material/Toolbar'
import { tabsClasses } from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import WidgetsRoundedIcon from '@mui/icons-material/WidgetsRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import SideMenuMobile from './SideMenuMobile'
import SideMenuMobileRight from './SideMenuMobileRight'
import MenuButton from './MenuButton'
import ColorModeIconDropdown from '../../shared-theme/ColorModeIconDropdown'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import type { DashboardMenuSlot, DashboardMenusMap, ZoneWidgetItem } from '../Dashboard'

const Toolbar = styled(MuiToolbar)({
    width: '100%',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'start',
    justifyContent: 'center',
    gap: '12px',
    flexShrink: 0,
    [`& ${tabsClasses.flexContainer}`]: {
        gap: '8px',
        p: '8px',
        pb: 0
    }
})

interface AppNavbarProps {
    menu?: DashboardMenuSlot
    menus?: DashboardMenusMap
    rightWidgets?: ZoneWidgetItem[]
}

export default function AppNavbar({ menu, menus, rightWidgets = [] }: AppNavbarProps) {
    const [leftOpen, setLeftOpen] = React.useState(false)
    const [rightOpen, setRightOpen] = React.useState(false)

    const toggleLeftDrawer = (newOpen: boolean) => () => {
        setLeftOpen(newOpen)
        if (newOpen) setRightOpen(false)
    }

    const toggleRightDrawer = (newOpen: boolean) => () => {
        setRightOpen(newOpen)
        if (newOpen) setLeftOpen(false)
    }

    const title = menu?.showTitle && menu?.title ? menu.title : 'Dashboard'
    const hasRightWidgets = rightWidgets.length > 0

    return (
        <AppBar
            position='fixed'
            sx={{
                display: { xs: 'auto', md: 'none' },
                boxShadow: 0,
                bgcolor: 'background.paper',
                backgroundImage: 'none',
                borderBottom: '1px solid',
                borderColor: 'divider',
                top: 'var(--template-frame-height, 0px)'
            }}
        >
            <Toolbar variant='regular'>
                <Stack
                    direction='row'
                    sx={{
                        alignItems: 'center',
                        flexGrow: 1,
                        width: '100%',
                        gap: 1
                    }}
                >
                    <Stack direction='row' spacing={1} sx={{ justifyContent: 'center', mr: 'auto' }}>
                        <CustomIcon />
                        <Typography variant='h4' component='h1' sx={{ color: 'text.primary' }}>
                            {title}
                        </Typography>
                    </Stack>
                    <LanguageSwitcher />
                    <ColorModeIconDropdown />
                    {hasRightWidgets && (
                        <MenuButton aria-label='context panel' onClick={toggleRightDrawer(true)}>
                            <WidgetsRoundedIcon />
                        </MenuButton>
                    )}
                    <MenuButton aria-label='menu' onClick={toggleLeftDrawer(true)}>
                        <MenuRoundedIcon />
                    </MenuButton>
                    <SideMenuMobile open={leftOpen} toggleDrawer={toggleLeftDrawer} menu={menu} menus={menus} />
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

export function CustomIcon() {
    return (
        <Box
            sx={{
                width: '1.5rem',
                height: '1.5rem',
                bgcolor: 'black',
                borderRadius: '999px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                alignSelf: 'center',
                backgroundImage: 'linear-gradient(135deg, hsl(210, 98%, 60%) 0%, hsl(210, 100%, 35%) 100%)',
                color: 'hsla(210, 100%, 95%, 0.9)',
                border: '1px solid',
                borderColor: 'hsl(210, 100%, 55%)',
                boxShadow: 'inset 0 2px 5px rgba(255, 255, 255, 0.3)'
            }}
        >
            <DashboardRoundedIcon color='inherit' sx={{ fontSize: '1rem' }} />
        </Box>
    )
}
