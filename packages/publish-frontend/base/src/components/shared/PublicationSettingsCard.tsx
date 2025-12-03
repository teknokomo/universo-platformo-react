// Universo Platformo | Publication Settings Card Component
// Reusable card container for publication settings with loading and error states

import React from 'react'
import { Card, CardContent, Box, CircularProgress, Typography, Alert, Button } from '@mui/material'

export interface PublicationSettingsCardProps {
    /** Card title */
    title?: string
    /** Card description */
    description?: string
    /** Whether settings are loading */
    isLoading?: boolean
    /** Loading message */
    loadingMessage?: string
    /** Error message to display */
    error?: string | null
    /** Retry handler for errors */
    onRetry?: () => void
    /** Retry button label */
    retryLabel?: string
    /** Card content */
    children: React.ReactNode
    /** Optional actions slot (rendered at top-right) */
    actions?: React.ReactNode
    /** Optional status indicator slot */
    status?: React.ReactNode
    /** Card variant */
    variant?: 'outlined' | 'elevation'
    /** Additional sx props */
    sx?: any
}

/**
 * PublicationSettingsCard - Reusable container for publication settings
 *
 * Features:
 * - Consistent loading states with skeleton
 * - Error display with retry functionality
 * - Flexible content slots (actions, status)
 * - Accessible structure
 */
export const PublicationSettingsCard: React.FC<PublicationSettingsCardProps> = React.memo(
    ({
        title,
        description,
        isLoading = false,
        loadingMessage = 'Loading settings...',
        error,
        onRetry,
        retryLabel = 'Retry',
        children,
        actions,
        status,
        variant = 'outlined',
        sx
    }) => {
        return (
            <Card variant={variant} sx={{ mb: 3, ...sx }}>
                <CardContent>
                    {/* Header with title and actions */}
                    {(title || actions) && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            {title && (
                                <Typography variant='h6' component='h2'>
                                    {title}
                                </Typography>
                            )}
                            {actions && <Box>{actions}</Box>}
                        </Box>
                    )}

                    {/* Description */}
                    {description && (
                        <Typography variant='body2' color='text.secondary' paragraph>
                            {description}
                        </Typography>
                    )}

                    {/* Status indicator */}
                    {status && <Box sx={{ mb: 2 }}>{status}</Box>}

                    {/* Error state */}
                    {error && (
                        <Alert
                            severity='error'
                            sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}
                            role='alert'
                            aria-live='assertive'
                            aria-atomic='true'
                        >
                            <Box component='span' sx={{ flexGrow: 1 }}>
                                {error}
                            </Box>
                            {onRetry && (
                                <Button variant='outlined' color='inherit' size='small' onClick={onRetry} aria-label={retryLabel}>
                                    {retryLabel}
                                </Button>
                            )}
                        </Alert>
                    )}

                    {/* Loading state */}
                    {isLoading && (
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                minHeight: '200px',
                                flexDirection: 'column',
                                gap: 2
                            }}
                            role='status'
                            aria-live='polite'
                            aria-label={loadingMessage}
                        >
                            <CircularProgress />
                            <Typography variant='body2' color='text.secondary'>
                                {loadingMessage}
                            </Typography>
                        </Box>
                    )}

                    {/* Main content */}
                    {!isLoading && <Box sx={{ position: 'relative' }}>{children}</Box>}
                </CardContent>
            </Card>
        )
    }
)

PublicationSettingsCard.displayName = 'PublicationSettingsCard'
