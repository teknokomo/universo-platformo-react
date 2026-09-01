import * as React from 'react'
import { alpha, styled } from '@mui/material/styles'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import MenuList from '@mui/material/MenuList'
import Toolbar from '@mui/material/Toolbar'
import MenuIcon from '@mui/icons-material/Menu'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useTranslation } from 'react-i18next'

import type { MarketingActionHandler, MarketingAction, MarketingMedia, MarketingNavigationItem } from '../types'
import {
    MarketingActionButton,
    MarketingColorModeControl,
    MarketingMediaView,
    invokeMarketingAction,
    resolveMarketingAction,
    sortVisibleMarketingItems
} from './MarketingPrimitives'
import Sitemark from './SitemarkIcon'

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderRadius: `calc(${theme.shape.borderRadius}px + 8px)`,
    backdropFilter: 'blur(24px)',
    border: '1px solid',
    borderColor: (theme.vars || theme).palette.divider,
    backgroundColor: theme.vars
        ? `rgba(${theme.vars.palette.background.defaultChannel} / 0.4)`
        : alpha(theme.palette.background.default, 0.4),
    boxShadow: (theme.vars || theme).shadows[1],
    padding: '8px 12px'
}))

export interface AppAppBarProps {
    brand: {
        name: string
        logo?: MarketingMedia
        homeAction?: MarketingAction
    }
    navigation: MarketingNavigationItem[]
    auth?: {
        signIn?: MarketingAction
        signUp?: MarketingAction
    }
    onAction?: MarketingActionHandler
}

function Brand({ brand, onAction }: { brand: AppAppBarProps['brand']; onAction?: MarketingActionHandler }) {
    const content = brand.logo ? (
        <MarketingMediaView
            media={brand.logo}
            loading='eager'
            sx={{ display: 'block', maxWidth: 100, maxHeight: 24, width: 'auto', height: 'auto', objectFit: 'contain' }}
        />
    ) : (
        <>
            <Sitemark />
            <Box
                component='span'
                sx={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: 0,
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                    whiteSpace: 'nowrap',
                    border: 0
                }}
            >
                {brand.name}
            </Box>
        </>
    )

    const resolved = resolveMarketingAction(brand.homeAction)
    if (!resolved) {
        return (
            <Box
                component='span'
                aria-label={brand.name}
                role='img'
                sx={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}
            >
                {content}
            </Box>
        )
    }

    return (
        <Box
            component='a'
            href={resolved.href}
            target={resolved.target}
            rel={resolved.rel}
            aria-label={brand.name}
            onClick={(event) => invokeMarketingAction(event, brand.homeAction as MarketingAction, onAction)}
            sx={{ display: 'inline-flex', alignItems: 'center', position: 'relative', textDecoration: 'none' }}
        >
            {content}
        </Box>
    )
}

function NavigationActions({ items, onAction }: { items: MarketingNavigationItem[]; onAction?: MarketingActionHandler }) {
    return (
        <>
            {sortVisibleMarketingItems(items).map((item) => (
                <MarketingActionButton key={item.semanticKey} action={item} onAction={onAction} variant='text' color='info' size='small'>
                    {item.label}
                </MarketingActionButton>
            ))}
        </>
    )
}

function MobileNavigation({
    items,
    auth,
    onAction,
    onClose
}: {
    items: MarketingNavigationItem[]
    auth?: AppAppBarProps['auth']
    onAction?: MarketingActionHandler
    onClose: () => void
}) {
    const actions = sortVisibleMarketingItems(items)

    return (
        <Box sx={{ p: 2, backgroundColor: 'background.default' }}>
            <MenuList disablePadding>
                {actions.map((action) => {
                    const resolved = resolveMarketingAction(action)
                    if (!resolved) return null
                    return (
                        <MenuItem key={action.semanticKey} onClick={onClose} sx={{ px: 0 }}>
                            <Box
                                component='a'
                                href={resolved.href}
                                target={resolved.target}
                                rel={resolved.rel}
                                onClick={(event) => invokeMarketingAction(event, action, onAction)}
                                sx={{ width: '100%', color: 'inherit', textDecoration: 'none', py: 1 }}
                            >
                                {action.label}
                            </Box>
                        </MenuItem>
                    )
                })}
            </MenuList>
            <Divider sx={{ my: 2 }} />
            <MenuList disablePadding>
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <MarketingActionButton
                        action={auth?.signUp}
                        onAction={(action) => {
                            onAction?.(action)
                            onClose()
                        }}
                        color='primary'
                        variant='contained'
                        fullWidth
                    >
                        {auth?.signUp?.label}
                    </MarketingActionButton>
                    <MarketingActionButton
                        action={auth?.signIn}
                        onAction={(action) => {
                            onAction?.(action)
                            onClose()
                        }}
                        color='primary'
                        variant='outlined'
                        fullWidth
                    >
                        {auth?.signIn?.label}
                    </MarketingActionButton>
                </Box>
            </MenuList>
        </Box>
    )
}

export default function AppAppBar({ brand, navigation, auth, onAction }: AppAppBarProps) {
    const [open, setOpen] = React.useState(false)
    const { t } = useTranslation('apps')

    const toggleDrawer = (newOpen: boolean) => () => setOpen(newOpen)

    return (
        <AppBar
            position='fixed'
            enableColorOnDark
            sx={{
                boxShadow: 0,
                bgcolor: 'transparent',
                backgroundImage: 'none',
                mt: 'calc(var(--template-frame-height, 0px) + 28px)'
            }}
        >
            <Container maxWidth='lg'>
                <StyledToolbar variant='dense' disableGutters>
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', px: 0, minWidth: 0 }}>
                        <Brand brand={brand} onAction={onAction} />
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, minWidth: 0 }}>
                            <NavigationActions items={navigation} onAction={onAction} />
                        </Box>
                    </Box>
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center' }}>
                        <MarketingActionButton action={auth?.signIn} onAction={onAction} color='primary' variant='text' size='small'>
                            {auth?.signIn?.label}
                        </MarketingActionButton>
                        <MarketingActionButton action={auth?.signUp} onAction={onAction} color='primary' variant='contained' size='small'>
                            {auth?.signUp?.label}
                        </MarketingActionButton>
                        <MarketingColorModeControl />
                    </Box>
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, alignItems: 'center' }}>
                        <MarketingColorModeControl size='medium' />
                        <IconButton aria-label={t('marketingPage.navigation.openMenu')} onClick={toggleDrawer(true)}>
                            <MenuIcon />
                        </IconButton>
                        <Drawer
                            anchor='top'
                            open={open}
                            onClose={toggleDrawer(false)}
                            slotProps={{ paper: { sx: { top: 'var(--template-frame-height, 0px)' } } }}
                        >
                            <Box sx={{ backgroundColor: 'background.default' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                                    <IconButton aria-label={t('marketingPage.navigation.closeMenu')} onClick={toggleDrawer(false)}>
                                        <CloseRoundedIcon />
                                    </IconButton>
                                </Box>
                                <MobileNavigation items={navigation} auth={auth} onAction={onAction} onClose={toggleDrawer(false)} />
                            </Box>
                        </Drawer>
                    </Box>
                </StyledToolbar>
            </Container>
        </AppBar>
    )
}
