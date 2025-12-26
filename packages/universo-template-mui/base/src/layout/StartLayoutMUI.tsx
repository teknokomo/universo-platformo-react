import * as React from 'react'
import { Outlet } from 'react-router-dom'
import CssBaseline from '@mui/material/CssBaseline'
import AppTheme from '../components/shared/AppTheme'
import AppAppBar from '../views/start-page/components/AppAppBar'

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
    return (
        <AppTheme disableCustomTheme={disableCustomTheme}>
            <CssBaseline enableColorScheme />
            <AppAppBar />
            {children || <Outlet />}
        </AppTheme>
    )
}
