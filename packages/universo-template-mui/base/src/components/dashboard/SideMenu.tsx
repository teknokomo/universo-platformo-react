import { styled } from '@mui/material/styles'
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@universo/auth-frontend'
import useConfirm from '../../hooks/useConfirm'
import MenuContent from './MenuContent'

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

export default function SideMenu() {
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
            variant='permanent'
            sx={{
                display: { xs: 'none', md: 'block' },
                [`& .${drawerClasses.paper}`]: {
                    backgroundColor: 'background.paper'
                }
            }}
        >
            {/* TODO: Restore product selector once real data is wired */}
            {/*
      <Box
        sx={{
          display: 'flex',
          mt: 'calc(var(--template-frame-height, 0px) + 4px)',
          p: 1.5,
        }}
      >
        <SelectContent />
      </Box>
      */}
            <Divider />
            <Box
                sx={{
                    overflow: 'auto',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <MenuContent />
                {/* <CardAlert /> */}
            </Box>
            {/* Logout button at the bottom of the drawer */}
            <Stack sx={{ p: 2 }}>
                <Button variant='outlined' fullWidth startIcon={<LogoutRoundedIcon />} onClick={handleLogout}>
                    {t('common:logout')}
                </Button>
            </Stack>
            {/*
      <Stack
        direction="row"
        sx={{
          p: 2,
          gap: 1,
          alignItems: 'center',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Avatar
          sizes="small"
          alt="Riley Carter"
          src="/static/images/avatar/7.jpg"
          sx={{ width: 36, height: 36 }}
        />
        <Box sx={{ mr: 'auto' }}>
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: '16px' }}>
            Riley Carter
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            riley@email.com
          </Typography>
        </Box>
        <OptionsMenu />
      </Stack>
      */}
        </Drawer>
    )
}
