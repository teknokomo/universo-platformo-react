// Universo Platformo | Async Status Bar Component
// Reusable status indicator for async operations (saving, loading, etc.)

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'

export type AsyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'success' | 'error'

export interface AsyncStatusBarProps {
    /** Current status */
    status: AsyncStatus
    /** Custom messages for each status */
    messages?: Partial<Record<AsyncStatus, string>>
    /** Error message (used when status is 'error') */
    errorMessage?: string
    /** Whether to show as inline (compact) or full-width alert */
    variant?: 'inline' | 'alert'
    /** Size of the status indicator */
    size?: 'small' | 'medium'
    /** Optional aria-label */
    ariaLabel?: string
}

/**
 * AsyncStatusBar - Reusable status indicator for async operations
 *
 * Features:
 * - Multiple status states (idle, loading, saving, saved, success, error)
 * - Customizable messages
 * - Inline or alert variants
 * - Accessible with aria-live regions
 */
export const AsyncStatusBar: React.FC<AsyncStatusBarProps> = React.memo(
    ({ status, messages, errorMessage, variant = 'inline', size = 'small', ariaLabel }) => {
        const { t } = useTranslation('publish')

        const defaultMessages: Record<AsyncStatus, string> = {
            idle: '',
            // Explicit namespace to avoid relying on 'publish' bound t for common keys
            loading: t('common:loading', 'Loading...'),
            saving: t('common:saving', 'Saving...'),
            saved: t('common:saved', 'Saved'),
            success: t('common:success', 'Success'),
            error: errorMessage || t('common:error', 'Error')
        }

        const effectiveMessages = { ...defaultMessages, ...messages }
        const message = effectiveMessages[status]

        // Don't render anything for idle status
        if (status === 'idle' || !message) {
            return null
        }

        const iconSize = size === 'small' ? 16 : 20

        // Alert variant for errors
        if (variant === 'alert' && status === 'error') {
            return (
                <Alert severity='error' sx={{ mb: 2 }} role='alert' aria-live='assertive'>
                    {message}
                </Alert>
            )
        }

        // Inline variant
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.5
                }}
                role='status'
                aria-live='polite'
                aria-label={ariaLabel || message}
            >
                {(status === 'loading' || status === 'saving') && <CircularProgress size={iconSize} />}
                {(status === 'saved' || status === 'success') && <CheckCircleIcon sx={{ fontSize: iconSize, color: 'success.main' }} />}
                {status === 'error' && <ErrorIcon sx={{ fontSize: iconSize, color: 'error.main' }} />}
                <Typography
                    variant='body2'
                    color={status === 'error' ? 'error' : status === 'saved' || status === 'success' ? 'success.main' : 'text.secondary'}
                    sx={{ fontSize: size === 'small' ? '0.75rem' : '0.875rem' }}
                >
                    {message}
                </Typography>
            </Box>
        )
    }
)

AsyncStatusBar.displayName = 'AsyncStatusBar'
