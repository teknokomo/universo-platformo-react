import React, { useCallback, useState } from 'react'
import { Box, TextField, InputAdornment, Popover } from '@mui/material'

/**
 * Default colors for quick selection
 */
const DEFAULT_COLORS = [
    '#f44336', // red
    '#e91e63', // pink
    '#9c27b0', // purple
    '#673ab7', // deep purple
    '#3f51b5', // indigo
    '#2196f3', // blue
    '#03a9f4', // light blue
    '#00bcd4', // cyan
    '#009688', // teal
    '#4caf50', // green
    '#8bc34a', // light green
    '#cddc39', // lime
    '#ffeb3b', // yellow
    '#ffc107', // amber
    '#ff9800', // orange
    '#ff5722', // deep orange
    '#795548', // brown
    '#9e9e9e', // grey
    '#607d8b' // blue grey
]

interface ColorPickerProps {
    value: string
    onChange: (color: string) => void
    label?: string
    disabled?: boolean
    error?: boolean
    helperText?: string
}

/**
 * Simple color picker component with preset colors and custom input
 */
export function ColorPicker({ value, onChange, label = 'Color', disabled = false, error = false, helperText }: ColorPickerProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            if (!disabled) {
                setAnchorEl(event.currentTarget)
            }
        },
        [disabled]
    )

    const handleClose = useCallback(() => {
        setAnchorEl(null)
    }, [])

    const handleColorSelect = useCallback(
        (color: string) => {
            onChange(color)
            handleClose()
        },
        [onChange, handleClose]
    )

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.target.value
            // Allow typing incomplete hex values
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

    const open = Boolean(anchorEl)

    return (
        <>
            <TextField
                fullWidth
                label={label}
                value={value}
                onChange={handleInputChange}
                disabled={disabled}
                error={error}
                helperText={helperText}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position='start'>
                            <Box
                                onClick={handleClick}
                                sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 1,
                                    backgroundColor: value || '#9e9e9e',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    cursor: disabled ? 'default' : 'pointer',
                                    '&:hover': {
                                        opacity: disabled ? 1 : 0.8
                                    }
                                }}
                            />
                        </InputAdornment>
                    ),
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
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left'
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left'
                }}
            >
                <Box
                    sx={{
                        p: 1.5,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 0.5,
                        maxWidth: 180
                    }}
                >
                    {DEFAULT_COLORS.map((color) => (
                        <Box
                            key={color}
                            onClick={() => handleColorSelect(color)}
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: 1,
                                backgroundColor: color,
                                cursor: 'pointer',
                                border: color === value ? '2px solid' : '1px solid',
                                borderColor: color === value ? 'primary.main' : 'divider',
                                transition: 'transform 0.1s',
                                '&:hover': {
                                    transform: 'scale(1.1)'
                                }
                            }}
                        />
                    ))}
                </Box>
            </Popover>
        </>
    )
}

export default ColorPicker
