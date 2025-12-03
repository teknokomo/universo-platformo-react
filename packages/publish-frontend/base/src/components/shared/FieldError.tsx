// Universo Platformo | Field Error Component
// Reusable error message component for form fields

import React from 'react'
import { FormHelperText, Box } from '@mui/material'
import ErrorIcon from '@mui/icons-material/Error'

export interface FieldErrorProps {
    /** Error message to display */
    error?: string | null
    /** Whether to show error icon */
    showIcon?: boolean
    /** Additional sx props */
    sx?: any
}

/**
 * FieldError - Reusable error message component for form fields
 *
 * Features:
 * - Consistent error styling
 * - Optional error icon
 * - Accessible with proper ARIA attributes
 * - Compact display
 */
export const FieldError: React.FC<FieldErrorProps> = React.memo(({ error, showIcon = true, sx }) => {
    if (!error) {
        return null
    }

    return (
        <FormHelperText error sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, ...sx }} role='alert'>
            {showIcon && <ErrorIcon sx={{ fontSize: 16 }} />}
            <Box component='span'>{error}</Box>
        </FormHelperText>
    )
})

FieldError.displayName = 'FieldError'
