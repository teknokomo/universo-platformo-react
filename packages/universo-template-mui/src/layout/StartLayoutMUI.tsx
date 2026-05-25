import * as React from 'react'
import { Outlet } from 'react-router-dom'
import CssBaseline from '@mui/material/CssBaseline'
import Box from '@mui/material/Box'
import { useAuth } from '@universo/auth-frontend'
import AppTheme from '../components/shared/AppTheme'
import AppAppBar from '../views/start-page/components/AppAppBar'
import { CookieConsentBanner } from '@universo/start-frontend/components'

interface StartLayoutMUIProps {
    disableCustomTheme?: boolean
    children?: React.ReactNode
}

/**
 * Minimal layout for start/landing pages
 * Contains only AppAppBar (top navigation) without sidebar
 * Used for both guest and authenticated start pages
 */
export default function StartLayoutMUI({ disableCustomTheme, children }: StartLayoutMUIProps) {
    const { isAuthenticated, loading } = useAuth()
    const shouldRenderToolbarOffset = !loading && isAuthenticated

    return (
        <AppTheme disableCustomTheme={disableCustomTheme}>
            <CssBaseline enableColorScheme />
            <AppAppBar />
            {shouldRenderToolbarOffset ? (
                <Box
                    sx={(theme) => ({
                        ...theme.mixins.toolbar,
                        mt: 'calc(var(--template-frame-height, 0px) + 28px)',
                        flexShrink: 0
                    })}
                />
            ) : null}
            {children || <Outlet />}
            <CookieConsentBanner />
        </AppTheme>
    )
}
