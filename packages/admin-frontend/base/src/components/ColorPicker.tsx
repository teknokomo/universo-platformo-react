import React, { useCallback } from 'react'
import { Box, TextField, InputAdornment } from '@mui/material'

interface ColorPickerProps {
    value: string
    onChange: (color: string) => void
    label?: string
    disabled?: boolean
    error?: boolean
    helperText?: string
}

/**
 * Simple color picker component with hex input and native color palette
 */
export function ColorPicker({ value, onChange, label = 'Color', disabled = false, error = false, helperText }: ColorPickerProps) {
    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.target.value
            if (newValue === '' || /^#[0-9A-Fa-f]{0,6}$/.test(newValue)) {
                onChange(newValue)
            }
        },
        [onChange]
    )

    const handleNativeColorChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.value)
        },
        [onChange]
    )

    return (
        <TextField
            fullWidth
            label={label}
            value={value}
            onChange={handleInputChange}
            disabled={disabled}
            error={error}
            helperText={helperText}
            InputProps={{
                endAdornment: (
                    <InputAdornment position='end'>
                        <Box
                            component='input'
                            type='color'
                            value={value || '#9e9e9e'}
                            onChange={handleNativeColorChange}
                            disabled={disabled}
                            sx={{
                                width: 24,
                                height: 24,
                                padding: 0,
                                border: 'none',
                                cursor: disabled ? 'default' : 'pointer',
                                '&::-webkit-color-swatch-wrapper': {
                                    padding: 0
                                },
                                '&::-webkit-color-swatch': {
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1
                                }
                            }}
                        />
                    </InputAdornment>
                )
            }}
        />
    )
}

export default ColorPicker
