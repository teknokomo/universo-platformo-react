import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import Popover from '@mui/material/Popover'
import TextField from '@mui/material/TextField'
import type { SxProps, Theme } from '@mui/material/styles'
import { HexColorPicker } from 'react-colorful'
import { parseInterpretationNetworkHexColor } from '@universo-react/types'

export interface HexColorPickerPopoverProps {
    id: string
    label: string
    pickerLabel: string
    value: string
    disabled?: boolean
    error?: boolean
    helperText?: string
    size?: 'small' | 'medium'
    sx?: SxProps<Theme>
    testId?: string
    onChange: (value: string) => void
}

/** Text entry and picker both use HEX, so the browser never switches to RGB controls. */
export function HexColorPickerPopover({
    id,
    label,
    pickerLabel,
    value,
    disabled = false,
    error = false,
    helperText,
    size = 'small',
    sx,
    testId,
    onChange
}: HexColorPickerPopoverProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const normalizedColor = parseInterpretationNetworkHexColor(value)?.toUpperCase() ?? '#000000'
    const pickerButtonSize = 32

    return (
        <>
            <TextField
                id={id}
                label={label}
                value={value}
                disabled={disabled}
                error={error}
                helperText={helperText}
                size={size}
                fullWidth
                sx={sx}
                onChange={(event) => onChange(event.target.value.toUpperCase())}
                slotProps={{
                    htmlInput: {
                        maxLength: 7,
                        spellCheck: false,
                        'data-testid': testId
                    },
                    input: {
                        endAdornment: (
                            <InputAdornment
                                position='end'
                                sx={{
                                    height: pickerButtonSize,
                                    maxHeight: pickerButtonSize,
                                    alignItems: 'center',
                                    alignSelf: 'center',
                                    marginRight: 0
                                }}
                            >
                                <IconButton
                                    type='button'
                                    size='small'
                                    aria-label={pickerLabel}
                                    aria-haspopup='dialog'
                                    aria-expanded={Boolean(anchorEl)}
                                    disabled={disabled}
                                    sx={{
                                        width: pickerButtonSize,
                                        height: pickerButtonSize,
                                        minWidth: pickerButtonSize,
                                        p: 0,
                                        mr: 0,
                                        flex: `0 0 ${pickerButtonSize}px`,
                                        borderRadius: 1
                                    }}
                                    onClick={(event) => setAnchorEl(event.currentTarget)}
                                >
                                    <Box
                                        aria-hidden='true'
                                        sx={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: 0.75,
                                            bgcolor: normalizedColor,
                                            border: 1,
                                            borderColor: 'divider'
                                        }}
                                    />
                                </IconButton>
                            </InputAdornment>
                        )
                    }
                }}
            />
            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Paper role='dialog' aria-label={pickerLabel} elevation={8} sx={{ p: 1.5, maxWidth: 'calc(100vw - 32px)' }}>
                    <HexColorPicker
                        color={normalizedColor}
                        onChange={(nextColor) => onChange(nextColor.toUpperCase())}
                        aria-label={pickerLabel}
                        style={{ width: 240, height: 160, maxWidth: '100%' }}
                    />
                </Paper>
            </Popover>
        </>
    )
}
