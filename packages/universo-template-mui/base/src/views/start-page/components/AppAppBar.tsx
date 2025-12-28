import * as React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { styled, alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Drawer from '@mui/material/Drawer'
import MenuIcon from '@mui/icons-material/Menu'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useAuth } from '@universo/auth-frontend'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../../components/shared/LanguageSwitcher'
import Sitemark from './SitemarkIcon'
import appbarEn from '../../../i18n/locales/en/appbar.json'
import appbarRu from '../../../i18n/locales/ru/appbar.json'

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
  borderRadius: `calc(${theme.shape.borderRadius}px + 8px)`,
  backdropFilter: 'blur(24px)',
  border: '1px solid',
  borderColor: theme.palette.divider,
  backgroundColor: alpha(theme.palette.background.default, 0.4),
  boxShadow: theme.shadows[1],
  padding: '8px 12px',
}))

export default function AppAppBar() {
  const [open, setOpen] = React.useState(false);
  const { isAuthenticated, logout, loading } = useAuth();
  const { t, i18n } = useTranslation('appbar');

  // Register appbar i18n resources on mount
  React.useEffect(() => {
    if (!i18n.hasResourceBundle('en', 'appbar')) {
      i18n.addResourceBundle('en', 'appbar', appbarEn, true, true)
    }
    if (!i18n.hasResourceBundle('ru', 'appbar')) {
      i18n.addResourceBundle('ru', 'appbar', appbarRu, true, true)
    }
  }, [i18n])

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  return (
    <AppBar
      position="fixed"
      enableColorOnDark
      sx={{
        boxShadow: 0,
        bgcolor: 'transparent',
        backgroundImage: 'none',
        mt: 'calc(var(--template-frame-height, 0px) + 28px)',
      }}
    >
      <Container maxWidth="lg">
        <StyledToolbar variant="dense" disableGutters>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', px: 0 }}>
            <Sitemark />
            {/* MVP: Navigation buttons temporarily commented out */}
            {/* <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
              <Button variant="text" color="info" size="small">
                Features
              </Button>
              <Button variant="text" color="info" size="small">
                Testimonials
              </Button>
              <Button variant="text" color="info" size="small">
                Highlights
              </Button>
              <Button variant="text" color="info" size="small">
                Pricing
              </Button>
              <Button variant="text" color="info" size="small" sx={{ minWidth: 0 }}>
                FAQ
              </Button>
              <Button variant="text" color="info" size="small" sx={{ minWidth: 0 }}>
                Blog
              </Button>
            </Box> */}
          </Box>
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              gap: 1,
              alignItems: 'center',
            }}
          >
            <LanguageSwitcher />
            {/* MVP: Sign in text button temporarily commented out
            <Button color="primary" variant="text" size="small">
              Sign in
            </Button>
            */}
            {!loading &&
              (isAuthenticated ? (
                <Button onClick={() => logout()} color="primary" variant="contained" size="small">
                  {t('logout')}
                </Button>
              ) : (
                <Button component={RouterLink} to="/auth" color="primary" variant="contained" size="small">
                  {t('login')}
                </Button>
              ))}
            {/* MVP: Theme toggle temporarily commented out
            <ColorModeIconDropdown />
            */}
          </Box>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, alignItems: 'center' }}>
            <LanguageSwitcher />
            {/* MVP: Mobile theme toggle temporarily commented out
            <ColorModeIconDropdown size="medium" />
            */}
            <IconButton aria-label="Menu button" onClick={toggleDrawer(true)}>
              <MenuIcon />
            </IconButton>
            <Drawer
              anchor="top"
              open={open}
              onClose={toggleDrawer(false)}
              PaperProps={{
                sx: {
                  top: 'var(--template-frame-height, 0px)',
                },
              }}
            >
              <Box sx={{ p: 2, backgroundColor: 'background.default' }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <IconButton onClick={toggleDrawer(false)}>
                    <CloseRoundedIcon />
                  </IconButton>
                </Box>

                {/* MVP: Mobile menu items temporarily commented out */}
                {/* <MenuItem>Features</MenuItem>
                <MenuItem>Testimonials</MenuItem>
                <MenuItem>Highlights</MenuItem>
                <MenuItem>Pricing</MenuItem>
                <MenuItem>FAQ</MenuItem>
                <MenuItem>Blog</MenuItem> */}
                <Divider sx={{ my: 3 }} />
                {!loading && (
                  <MenuItem>
                    {isAuthenticated ? (
                      <Button
                        onClick={() => {
                          toggleDrawer(false)();
                          logout();
                        }}
                        color="primary"
                        variant="contained"
                        fullWidth
                      >
                        {t('logout')}
                      </Button>
                    ) : (
                      <Button component={RouterLink} to="/auth" color="primary" variant="contained" fullWidth>
                        {t('login')}
                      </Button>
                    )}
                  </MenuItem>
                )}
                {/* MVP: Sign in outlined button temporarily commented out
                <MenuItem>
                  <Button color="primary" variant="outlined" fullWidth>
                    Sign in
                  </Button>
                </MenuItem>
                */}
              </Box>
            </Drawer>
          </Box>
        </StyledToolbar>
      </Container>
    </AppBar>
  )
}
