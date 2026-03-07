import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Drawer, { drawerClasses } from '@mui/material/Drawer'
import Stack from '@mui/material/Stack'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@universo/auth-frontend'
import useConfirm from '../../hooks/useConfirm'
import MenuContent from './MenuContent'

interface SideMenuMobileProps {
    open: boolean | undefined
    toggleDrawer: (newOpen: boolean) => () => void
}

export default function SideMenuMobile({ open, toggleDrawer }: SideMenuMobileProps) {
    const { logout } = useAuth()
    const { t } = useTranslation()
    const { confirm } = useConfirm()

    const handleLogout = async () => {
        const confirmed = await confirm({
            title: t('common:logoutConfirmTitle'),
            description: t('common:logoutConfirmMessage'),
            confirmButtonName: t('common:logout')
        })
        if (confirmed) {
            await logout()
        }
    }

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
                    maxWidth: '90dvw',
                    height: '100%'
                }}
            >
                {/* TODO: Restore Avatar/Name/notification bell once real user data is wired */}
                <Divider />
                <Stack sx={{ flexGrow: 1 }}>
                    <MenuContent />
                    <Divider />
                </Stack>
                <Stack sx={{ p: 2 }}>
                    <Button variant='outlined' fullWidth startIcon={<LogoutRoundedIcon />} onClick={handleLogout}>
                        {t('common:logout')}
                    </Button>
                </Stack>
            </Stack>
        </Drawer>
    )
}
