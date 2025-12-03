// Universo Platformo | Network Status Banner Component
// Displays network connectivity status and offline warnings

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Slide, Box } from '@mui/material'
import { isOnline, setupOnlineListeners } from '../../utils/notifications'

export interface NetworkStatusBannerProps {
    /** Position of the banner */
    position?: 'top' | 'bottom'
    /** Whether to show the banner */
    show?: boolean
}

/**
 * NetworkStatusBanner - Displays network connectivity status
 *
 * Features:
 * - Automatically detects online/offline status
 * - Shows warning when offline
 * - Dismisses when connection is restored
 * - Accessible with aria-live region
 */
export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({ position = 'top', show = true }) => {
    const { t } = useTranslation('publish')
    const [online, setOnline] = useState(isOnline())

    useEffect(() => {
        if (!show) return

        // Set up listeners for online/offline events
        const cleanup = setupOnlineListeners(
            () => setOnline(true),
            () => setOnline(false)
        )

        return cleanup
    }, [show])

    if (!show || online) {
        return null
    }

    return (
        <Slide direction={position === 'top' ? 'down' : 'up'} in={!online} mountOnEnter unmountOnExit>
            <Box
                sx={{
                    position: 'fixed',
                    [position]: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    px: 2,
                    py: 1
                }}
            >
                <Alert severity='warning' sx={{ width: '100%' }} role='alert' aria-live='assertive' aria-atomic='true'>
                    {t('errors.offline', 'No internet connection. Some features may be unavailable.')}
                </Alert>
            </Box>
        </Slide>
    )
}

NetworkStatusBanner.displayName = 'NetworkStatusBanner'
