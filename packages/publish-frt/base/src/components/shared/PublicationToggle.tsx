// Universo Platformo | Publication Toggle Component
// Reusable toggle component for public/private publication state

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, FormControl, FormControlLabel, Switch, Typography, CircularProgress } from '@mui/material'

export interface PublicationToggleProps {
    /** Current public state */
    checked: boolean
    /** Handler for toggle change */
    onChange: (checked: boolean) => void | Promise<void>
    /** Whether the toggle is disabled */
    disabled?: boolean
    /** Whether an async operation is in progress */
    isLoading?: boolean
    /** Optional custom label */
    label?: string
    /** Optional description text */
    description?: string
    /** Optional aria-label for accessibility */
    ariaLabel?: string
}

/**
 * PublicationToggle - Reusable component for toggling publication state
 *
 * Features:
 * - Accessible with proper ARIA attributes
 * - Loading state indicator
 * - Customizable labels and descriptions
 * - Consistent styling across publishers
 */
export const PublicationToggle: React.FC<PublicationToggleProps> = React.memo(
    ({ checked, onChange, disabled = false, isLoading = false, label, description, ariaLabel }) => {
        const { t } = useTranslation('publish')

        const handleChange = React.useCallback(
            (event: React.ChangeEvent<HTMLInputElement>) => {
                onChange(event.target.checked)
            },
            [onChange]
        )

        const effectiveLabel = label ?? t('configuration.makePublic')
        const effectiveDescription = description ?? t('configuration.description')
        const effectiveAriaLabel = ariaLabel ?? effectiveLabel

        return (
            <Box sx={{ my: 3, width: '100%' }}>
                <FormControl fullWidth variant='outlined'>
                    <FormControlLabel
                        control={
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    width: '100%',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <Switch
                                    checked={checked}
                                    onChange={handleChange}
                                    disabled={disabled || isLoading}
                                    color='primary'
                                    inputProps={{
                                        'aria-label': effectiveAriaLabel,
                                        'aria-pressed': checked,
                                        role: 'switch'
                                    }}
                                />
                                {isLoading && <CircularProgress size={20} sx={{ ml: 2 }} />}
                            </Box>
                        }
                        label={effectiveLabel}
                        sx={{
                            width: '100%',
                            margin: 0,
                            '& .MuiFormControlLabel-label': {
                                width: '100%',
                                flexGrow: 1
                            }
                        }}
                        labelPlacement='start'
                    />
                </FormControl>
                {effectiveDescription && (
                    <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                        {effectiveDescription}
                    </Typography>
                )}
            </Box>
        )
    }
)

PublicationToggle.displayName = 'PublicationToggle'
