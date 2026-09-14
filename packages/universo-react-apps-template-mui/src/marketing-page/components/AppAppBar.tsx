import * as React from 'react'
import { alpha, styled } from '@mui/material/styles'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import MenuIcon from '@mui/icons-material/Menu'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import Toolbar from '@mui/material/Toolbar'
import { useTranslation } from 'react-i18next'
import { getLayoutWidgetDefinition } from '@universo-react/types'

import LanguageSwitcher from '../../components/LanguageSwitcher'
import {
    MarketingActionButton,
    MarketingColorModeControl,
    MarketingMediaView,
    invokeMarketingAction,
    resolveMarketingAction,
    sortVisibleMarketingItems
} from './MarketingPrimitives'
import Sitemark from './SitemarkIcon'
import {
    calculateMarketingHeaderGeometry,
    MARKETING_HEADER_VISUAL_OFFSET_PX,
    readMarketingFrameOffsetPx,
    type MarketingHeaderGeometry,
    type MarketingHeaderPosition,
    type MarketingHeaderProjection
} from '../marketingHeaderRuntime'
import type { MarketingActionHandler, MarketingBrandData, MarketingNavigationItem } from '../types'

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

const MARKETING_HEADER_DRAWER_ID = 'marketing-header-drawer'

const usesDrawerProjection = (projection: MarketingHeaderProjection): boolean =>
    getLayoutWidgetDefinition(projection.widgetKey)?.mobileProjection === 'drawer'

export interface MarketingHeaderShellProps {
    widgets: readonly MarketingHeaderProjection[]
    position?: MarketingHeaderPosition
    frameOffsetPx?: number
    onAction?: MarketingActionHandler
}

const Brand = ({ brand, onAction }: { brand: MarketingBrandData; onAction?: MarketingActionHandler }) => {
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

    if (!resolved || !brand.homeAction) {
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
            onClick={(event) => invokeMarketingAction(event, brand.homeAction!, onAction)}
            sx={{ display: 'inline-flex', alignItems: 'center', position: 'relative', textDecoration: 'none' }}
        >
            {content}
        </Box>
    )
}

const NavigationLandmark = ({
    navigation,
    label,
    onAction,
    mobile = false,
    onClose
}: {
    navigation: MarketingNavigationItem[]
    label: string
    onAction?: MarketingActionHandler
    mobile?: boolean
    onClose?: () => void
}) => {
    const actions = sortVisibleMarketingItems(navigation)

    if (mobile) {
        return (
            <Box component='nav' aria-label={label} data-testid='marketing-header-drawer-navigation'>
                <List disablePadding>
                    {actions.map((item) => {
                        const resolved = resolveMarketingAction(item)
                        if (!resolved) return null
                        return (
                            <ListItem key={item.semanticKey} disablePadding>
                                <ListItemButton
                                    component='a'
                                    href={resolved.href}
                                    target={resolved.target}
                                    rel={resolved.rel}
                                    onClick={(event) => {
                                        invokeMarketingAction(event, item, onAction)
                                        onClose?.()
                                    }}
                                >
                                    {item.label}
                                </ListItemButton>
                            </ListItem>
                        )
                    })}
                </List>
            </Box>
        )
    }

    return (
        <Box
            component='nav'
            aria-label={label}
            data-testid='marketing-header-navigation'
            sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
        >
            {actions.map((item) => (
                <MarketingActionButton key={item.semanticKey} action={item} onAction={onAction} variant='text' color='info' size='small'>
                    {item.label}
                </MarketingActionButton>
            ))}
        </Box>
    )
}

type AuthContent = Extract<MarketingHeaderProjection, { widgetKey: 'marketing.auth' }>['content']

const AuthProjection = ({
    auth,
    onAction,
    mobile = false,
    onClose
}: {
    auth: AuthContent
    onAction?: MarketingActionHandler
    mobile?: boolean
    onClose?: () => void
}) => (
    <Box
        data-testid={mobile ? 'marketing-header-drawer-auth' : 'marketing-header-auth'}
        sx={{ display: 'flex', gap: 1, alignItems: 'center', flexDirection: mobile ? 'column' : 'row', width: mobile ? '100%' : 'auto' }}
    >
        <MarketingActionButton
            action={auth.signIn}
            onAction={(action) => {
                onAction?.(action)
                onClose?.()
            }}
            color='primary'
            variant={mobile ? 'outlined' : 'text'}
            size='small'
            fullWidth={mobile}
        >
            {auth.signIn?.label}
        </MarketingActionButton>
        <MarketingActionButton
            action={auth.signUp}
            onAction={(action) => {
                onAction?.(action)
                onClose?.()
            }}
            color='primary'
            variant='contained'
            size='small'
            fullWidth={mobile}
        >
            {auth.signUp?.label}
        </MarketingActionButton>
    </Box>
)

const projectionKey = (projection: MarketingHeaderProjection): string => `${projection.widgetKey}-${projection.instanceKey}`

const navigationLabel = (brandName: string, index: number, t: ReturnType<typeof useTranslation>['t']): string =>
    t('marketingPage.navigation.landmark', {
        brand: brandName,
        index: String(index + 1),
        defaultValue: `${brandName} navigation ${index + 1}`
    })

const useHeaderGeometry = (
    headerRef: React.RefObject<HTMLElement | null>,
    position: MarketingHeaderPosition,
    frameOffsetPx?: number
): MarketingHeaderGeometry => {
    const geometryForPosition = React.useCallback(
        (headerHeight: number, frameOffset: number): MarketingHeaderGeometry => {
            const measured = calculateMarketingHeaderGeometry(headerHeight, frameOffset)
            if (position === 'fixed') return measured
            return { ...measured, topOffsetPx: 0, occlusionPx: 0 }
        },
        [position]
    )
    const [geometry, setGeometry] = React.useState<MarketingHeaderGeometry>(() => geometryForPosition(0, frameOffsetPx ?? 0))
    const geometryRef = React.useRef(geometry)

    React.useLayoutEffect(() => {
        const update = () => {
            const measuredHeight = position === 'fixed' ? headerRef.current?.getBoundingClientRect().height ?? 0 : 0
            const measuredFrameOffset = frameOffsetPx ?? readMarketingFrameOffsetPx()
            const next = geometryForPosition(measuredHeight, measuredFrameOffset)
            const current = geometryRef.current
            if (
                current.headerHeightPx === next.headerHeightPx &&
                current.frameOffsetPx === next.frameOffsetPx &&
                current.occlusionPx === next.occlusionPx
            ) {
                return
            }
            geometryRef.current = next
            setGeometry(next)
        }

        update()
        if (position !== 'fixed') return undefined

        const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
        if (resizeObserver && headerRef.current) resizeObserver.observe(headerRef.current)
        window.addEventListener('resize', update)
        const mutationObserver = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(update)
        mutationObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
        mutationObserver?.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] })

        return () => {
            resizeObserver?.disconnect()
            mutationObserver?.disconnect()
            window.removeEventListener('resize', update)
        }
    }, [frameOffsetPx, geometryForPosition, headerRef, position])

    return geometry
}

const HeaderDrawer = ({
    open,
    projections,
    brandName,
    onClose,
    onAction,
    t
}: {
    open: boolean
    projections: readonly MarketingHeaderProjection[]
    brandName: string
    onClose: () => void
    onAction?: MarketingActionHandler
    t: ReturnType<typeof useTranslation>['t']
}) => {
    const navigationProjections = projections.filter(
        (projection): projection is Extract<MarketingHeaderProjection, { widgetKey: 'marketing.navigation' }> =>
            projection.widgetKey === 'marketing.navigation'
    )
    const authProjection = projections.find(
        (projection): projection is Extract<MarketingHeaderProjection, { widgetKey: 'marketing.auth' }> =>
            projection.widgetKey === 'marketing.auth'
    )

    return (
        <Drawer
            id={MARKETING_HEADER_DRAWER_ID}
            data-testid='marketing-header-drawer'
            anchor='top'
            open={open}
            onClose={onClose}
            ModalProps={{ keepMounted: true }}
            slotProps={{ paper: { sx: { top: 'var(--template-frame-height, 0px)' } } }}
        >
            <Box sx={{ backgroundColor: 'background.default', p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton aria-label={t('marketingPage.navigation.closeMenu', { defaultValue: 'Close menu' })} onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Box>
                {navigationProjections.map((projection, index) => (
                    <React.Fragment key={projectionKey(projection)}>
                        {index > 0 ? <Divider sx={{ my: 2 }} /> : null}
                        <NavigationLandmark
                            navigation={projection.content.navigation}
                            label={navigationLabel(brandName, index, t)}
                            onAction={onAction}
                            mobile
                            onClose={onClose}
                        />
                    </React.Fragment>
                ))}
                {authProjection ? (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <AuthProjection auth={authProjection.content} onAction={onAction} mobile onClose={onClose} />
                    </>
                ) : null}
                {navigationProjections.length === 0 && !authProjection ? <Box component='span' sx={{ display: 'none' }} /> : null}
            </Box>
        </Drawer>
    )
}

export function MarketingHeaderShell({ widgets, position = 'fixed', frameOffsetPx, onAction }: MarketingHeaderShellProps) {
    const headerRef = React.useRef<HTMLElement | null>(null)
    const menuButtonRef = React.useRef<HTMLButtonElement | null>(null)
    const wasOpen = React.useRef(false)
    const [open, setOpen] = React.useState(false)
    const { t } = useTranslation('apps')
    const geometry = useHeaderGeometry(headerRef, position, frameOffsetPx)
    const brandProjection = widgets.find(
        (projection): projection is Extract<MarketingHeaderProjection, { widgetKey: 'marketing.brand' }> =>
            projection.widgetKey === 'marketing.brand'
    )
    const brandName = brandProjection?.content.name || t('marketingPage.navigation.landmarkFallback', { defaultValue: 'Marketing' })
    const navigationProjections = widgets.filter((projection) => projection.widgetKey === 'marketing.navigation')
    const hasDrawerContent = widgets.some(usesDrawerProjection)
    const desktopNavigationIndex = new Map(navigationProjections.map((projection, index) => [projectionKey(projection), index]))
    const firstEndIndex = widgets.findIndex((projection) => projection.placement === 'end')

    React.useEffect(() => {
        if (!open && wasOpen.current) menuButtonRef.current?.focus()
        wasOpen.current = open
    }, [open])

    React.useEffect(() => {
        if (position !== 'fixed' || typeof document === 'undefined') return undefined
        const root = document.documentElement
        const previousOcclusion = root.style.getPropertyValue('--marketing-header-occlusion')
        const previousScrollPadding = root.style.getPropertyValue('scroll-padding-block-start')
        const previousOcclusionPriority = root.style.getPropertyPriority('--marketing-header-occlusion')
        const previousScrollPaddingPriority = root.style.getPropertyPriority('scroll-padding-block-start')
        const value = `${geometry.occlusionPx}px`
        root.style.setProperty('--marketing-header-occlusion', value)
        root.style.setProperty('scroll-padding-block-start', value)
        return () => {
            if (previousOcclusion) root.style.setProperty('--marketing-header-occlusion', previousOcclusion, previousOcclusionPriority)
            else root.style.removeProperty('--marketing-header-occlusion')
            if (previousScrollPadding)
                root.style.setProperty('scroll-padding-block-start', previousScrollPadding, previousScrollPaddingPriority)
            else root.style.removeProperty('scroll-padding-block-start')
        }
    }, [geometry.occlusionPx, position])

    const renderProjection = (projection: MarketingHeaderProjection): React.ReactNode => {
        switch (projection.widgetKey) {
            case 'marketing.brand':
                return <Brand brand={projection.content} onAction={onAction} />
            case 'marketing.navigation': {
                const index = desktopNavigationIndex.get(projectionKey(projection)) ?? 0
                return (
                    <NavigationLandmark
                        navigation={projection.content.navigation}
                        label={navigationLabel(brandName, index, t)}
                        onAction={onAction}
                    />
                )
            }
            case 'marketing.auth':
                return <AuthProjection auth={projection.content} onAction={onAction} />
            case 'languageSwitcher':
                return <LanguageSwitcher />
            case 'colorModeSwitcher':
                return <MarketingColorModeControl size='small' />
        }
    }

    return (
        <>
            <AppBar
                ref={headerRef}
                component='header'
                role='banner'
                position={position === 'fixed' ? 'fixed' : 'static'}
                enableColorOnDark
                data-testid='marketing-header-shell'
                data-marketing-header-position={position}
                data-marketing-header-height={geometry.headerHeightPx}
                data-marketing-header-frame-offset={geometry.frameOffsetPx}
                data-marketing-header-visual-offset={geometry.visualOffsetPx}
                data-marketing-header-top-offset={geometry.topOffsetPx}
                data-marketing-header-occlusion={geometry.occlusionPx}
                sx={{
                    boxShadow: 0,
                    bgcolor: 'transparent',
                    backgroundImage: 'none',
                    width: '100%',
                    ...(position === 'fixed'
                        ? { mt: `calc(var(--template-frame-height, 0px) + ${MARKETING_HEADER_VISUAL_OFFSET_PX}px)` }
                        : {})
                }}
            >
                <Container maxWidth='lg'>
                    <StyledToolbar variant='dense' disableGutters>
                        <Box
                            data-testid='marketing-header-projections'
                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1, minWidth: 0 }}
                        >
                            {widgets.map((projection, index) => {
                                const drawerOnly = usesDrawerProjection(projection)
                                return (
                                    <Box
                                        key={projectionKey(projection)}
                                        sx={{
                                            display: drawerOnly ? { xs: 'none', md: 'flex' } : 'flex',
                                            alignItems: 'center',
                                            minWidth: 0,
                                            ...(index === firstEndIndex ? { marginLeft: 'auto' } : {})
                                        }}
                                    >
                                        {renderProjection(projection)}
                                    </Box>
                                )
                            })}
                        </Box>
                        <Box data-testid='marketing-header-mobile-menu' sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
                            {hasDrawerContent ? (
                                <IconButton
                                    ref={menuButtonRef}
                                    aria-label={t('marketingPage.navigation.openMenu', { defaultValue: 'Open menu' })}
                                    aria-expanded={open}
                                    aria-controls={MARKETING_HEADER_DRAWER_ID}
                                    onClick={() => setOpen(true)}
                                >
                                    <MenuIcon />
                                </IconButton>
                            ) : null}
                        </Box>
                    </StyledToolbar>
                </Container>
            </AppBar>
            {hasDrawerContent ? (
                <HeaderDrawer
                    open={open}
                    projections={widgets}
                    brandName={brandName}
                    onClose={() => setOpen(false)}
                    onAction={onAction}
                    t={t}
                />
            ) : null}
        </>
    )
}

export { calculateMarketingHeaderGeometry }
export type { MarketingHeaderGeometry, MarketingHeaderPosition, MarketingHeaderProjection }

export default MarketingHeaderShell
