import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import Popover from '@mui/material/Popover'
import TextField from '@mui/material/TextField'
import { parseInterpretationNetworkHexColor } from '@universo-react/types'

export interface HexColorFieldProps {
    id: string
    label: string
    pickerLabel: string
    value: string
    disabled?: boolean
    error?: boolean
    helperText?: string
    testId?: string
    onChange: (value: string) => void
}

/** A visible HEX field with an accessible HEX-only picker in a MUI popover. */
export function HexColorField({
    id,
    label,
    pickerLabel,
    value,
    disabled = false,
    error = false,
    helperText,
    testId,
    onChange
}: HexColorFieldProps) {
    const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null)
    const normalizedColor = parseInterpretationNetworkHexColor(value)?.toUpperCase() ?? ''
    const pickerColor = normalizedColor || '#000000'
    const helperTextId = helperText ? `${id}-helper-text` : undefined

    const updateColor = (nextColor: string) => {
        const normalized = parseInterpretationNetworkHexColor(nextColor)
        if (normalized) onChange(normalized.toUpperCase())
    }

    return (
        <>
            <TextField
                id={id}
                label={label}
                value={value}
                disabled={disabled}
                error={error}
                helperText={helperText}
                fullWidth
                onChange={(event) => onChange(event.target.value.toUpperCase())}
                sx={{
                    flex: '1 1 180px',
                    minWidth: 0,
                    '& .MuiOutlinedInput-root': { height: 40, alignItems: 'center' },
                    '& .MuiInputAdornment-positionEnd': {
                        height: 32,
                        maxHeight: 32,
                        alignItems: 'center',
                        alignSelf: 'center',
                        marginRight: 0
                    },
                    '& .MuiIconButton-root': { width: 32, minWidth: 32, height: 32, margin: 0, p: 0, flex: '0 0 32px' }
                }}
                slotProps={{
                    htmlInput: {
                        maxLength: 7,
                        spellCheck: false,
                        'aria-describedby': helperText ? helperTextId : undefined,
                        'data-testid': testId
                    },
                    formHelperText: { id: helperTextId, role: error ? 'alert' : undefined },
                    input: {
                        endAdornment: (
                            <InputAdornment position='end'>
                                <IconButton
                                    type='button'
                                    size='small'
                                    aria-label={pickerLabel}
                                    aria-haspopup='dialog'
                                    aria-expanded={Boolean(pickerAnchor)}
                                    disabled={disabled}
                                    onClick={(event) => setPickerAnchor(event.currentTarget)}
                                >
                                    <Box
                                        aria-hidden='true'
                                        sx={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: 0.75,
                                            bgcolor: pickerColor,
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
                open={Boolean(pickerAnchor)}
                anchorEl={pickerAnchor}
                onClose={() => setPickerAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Paper role='dialog' aria-label={pickerLabel} elevation={8} sx={{ p: 1.5, maxWidth: 'calc(100vw - 32px)' }}>
                    <HexColorPicker
                        color={pickerColor}
                        onChange={updateColor}
                        aria-label={pickerLabel}
                        style={{ width: 240, height: 160, maxWidth: '100%' }}
                    />
                </Paper>
            </Popover>
        </>
    )
}
