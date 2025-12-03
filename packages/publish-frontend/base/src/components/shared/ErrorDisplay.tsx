// Universo Platformo | Error Display Component
// Reusable component for displaying errors with retry functionality

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Box, Typography } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'

export interface ErrorDisplayProps {
    /** Error message to display */
    error: string | Error | null
    /** Retry handler */
    onRetry?: () => void
    /** Retry button label */
    retryLabel?: string
    /** Error severity */
    severity?: 'error' | 'warning'
    /** Whether to show the error */
    show?: boolean
    /** Additional context or help text */
    helpText?: string
    /** Custom icon */
    icon?: React.ReactNode
}

/**
 * ErrorDisplay - Reusable component for displaying errors
 *
 * Features:
 * - Displays error messages with proper formatting
 * - Optional retry button
 * - Accessible with proper ARIA attributes
 * - Supports both string and Error objects
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
    error,
    onRetry,
    retryLabel,
    severity = 'error',
    show = true,
    helpText,
    icon
}) => {
    const { t } = useTranslation('publish')

    if (!show || !error) {
        return null
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    const effectiveRetryLabel = retryLabel ?? t('common.retry', 'Retry')

    return (
        <Alert
            severity={severity}
            icon={icon}
            sx={{ mb: 2 }}
            role='alert'
            aria-live='assertive'
            aria-atomic='true'
            action={
                onRetry && (
                    <Button color='inherit' size='small' onClick={onRetry} startIcon={<RefreshIcon />} aria-label={effectiveRetryLabel}>
                        {effectiveRetryLabel}
                    </Button>
                )
            }
        >
            <Box>
                <Typography variant='body2' component='div'>
                    {errorMessage}
                </Typography>
                {helpText && (
                    <Typography variant='caption' component='div' sx={{ mt: 1, opacity: 0.8 }}>
                        {helpText}
                    </Typography>
                )}
            </Box>
        </Alert>
    )
}

ErrorDisplay.displayName = 'ErrorDisplay'
