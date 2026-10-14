import { useRef } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { NUMBER_DEFAULTS, validateNumber, toNumberRules } from '@universo-react/utils'
import type { DynamicFieldValidationRules } from '@universo-react/template-mui'

/**
 * Full-featured NUMBER cell for inline table rows.
 * Replicates the standalone NUMBER field behavior:
 * - Formatted display with locale-aware decimal separator (comma for 'ru')
 * - Zone-based selection (integer vs decimal part) on focus/click
 * - ArrowUp/ArrowDown zone-aware stepping
 * - Stepper buttons (▲▼)
 * - Blocks "-" for nonNegative, protects decimal separator
 * - Digit replacement in decimal zone
 */
interface NumberTableCellProps {
    value: unknown
    onChange: (value: unknown) => void
    rules: DynamicFieldValidationRules | undefined
    locale: string
    disabled: boolean
}

export default function NumberTableCell({ value, onChange, rules, locale, disabled }: NumberTableCellProps) {
    const precision = typeof rules?.precision === 'number' ? rules.precision : NUMBER_DEFAULTS.precision
    const scale = typeof rules?.scale === 'number' ? rules.scale : NUMBER_DEFAULTS.scale
    const maxIntegerDigits = precision - scale
    const allowNegative = !rules?.nonNegative
    const lang = locale.split(/[-_]/)[0].toLowerCase()
    const decimalSeparator = scale > 0 ? (lang === 'ru' ? ',' : '.') : ''

    const inputRef = useRef<HTMLInputElement>(null)
    const cursorZoneRef = useRef<'integer' | 'decimal'>('integer')

    const formatValue = (val: unknown): string => {
        if (val == null || val === '' || (typeof val === 'number' && Number.isNaN(val))) {
            return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
        }
        if (typeof val === 'number') {
            return scale > 0 ? val.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(val))
        }
        const parsed = parseFloat(String(val))
        if (Number.isNaN(parsed)) {
            return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
        }
        return scale > 0 ? parsed.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(parsed))
    }

    const selectNumberPart = (target: HTMLInputElement) => {
        if (!target || target.value == null) return
        if (scale <= 0) {
            target.setSelectionRange(0, target.value.length)
            cursorZoneRef.current = 'integer'
            return
        }
        const text = target.value
        const signOffset = text.startsWith('-') ? 1 : 0
        const sepIdx = text.indexOf(decimalSeparator)
        if (sepIdx === -1) {
            target.setSelectionRange(signOffset, text.length)
            cursorZoneRef.current = 'integer'
            return
        }
        const cursor = target.selectionStart ?? 0
        if (cursor <= sepIdx) {
            target.setSelectionRange(signOffset, sepIdx)
            cursorZoneRef.current = 'integer'
        } else {
            target.setSelectionRange(sepIdx + 1, text.length)
            cursorZoneRef.current = 'decimal'
        }
    }

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        window.requestAnimationFrame(() => selectNumberPart(event.target))
    }

    const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
        const target = event.target as HTMLInputElement
        window.requestAnimationFrame(() => selectNumberPart(target))
    }

    // Zone-aware stepper
    const numberRules = toNumberRules(rules)
    const doStep = (direction: 1 | -1, zone?: 'integer' | 'decimal') => {
        const effectiveZone = zone ?? cursorZoneRef.current
        const step = scale > 0 && effectiveZone === 'decimal' ? Math.pow(10, -scale) : 1
        const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
        let next = Number((current + direction * step).toFixed(scale))
        if (rules?.nonNegative && next < 0) next = 0
        if (typeof numberRules.min === 'number' && next < numberRules.min) next = numberRules.min
        if (typeof numberRules.max === 'number' && next > numberRules.max) next = numberRules.max
        if (!validateNumber(next, numberRules).valid) return
        onChange(next)
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value

        if (raw === '' || raw === '-') {
            if (raw === '-' && !allowNegative) return
            onChange(null)
            return
        }

        const normalized = raw.replace(/,/g, '.')
        const pattern = allowNegative ? (scale > 0 ? /^-?\d*\.?\d*$/ : /^-?\d*$/) : scale > 0 ? /^\d*\.?\d*$/ : /^\d*$/

        if (!pattern.test(normalized)) return

        const isNeg = normalized.startsWith('-')
        const abs = isNeg ? normalized.slice(1) : normalized
        const [intPart = '', decPart = ''] = abs.split('.')

        if (intPart.length > maxIntegerDigits) return
        if (decPart.length > scale) return

        const parsed = parseFloat(normalized)
        if (Number.isFinite(parsed)) {
            onChange(parsed)
        }
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const key = event.key
        const target = event.target as HTMLInputElement
        const currentValue = target.value
        const selectionStart = target.selectionStart ?? 0
        const selectionEnd = target.selectionEnd ?? selectionStart
        const hasSelection = selectionEnd > selectionStart
        const separatorIndex = scale > 0 ? currentValue.indexOf(decimalSeparator) : -1

        // Protect decimal separator from deletion
        if ((key === 'Backspace' || key === 'Delete') && scale > 0 && separatorIndex !== -1) {
            const crossesSep = selectionStart <= separatorIndex && selectionEnd > separatorIndex
            const bsOnSep = key === 'Backspace' && selectionStart === separatorIndex + 1 && !hasSelection
            const delOnSep = key === 'Delete' && selectionStart === separatorIndex && !hasSelection
            if (crossesSep || bsOnSep || delOnSep) {
                event.preventDefault()
                return
            }
        }

        // Zone-aware ArrowUp/ArrowDown
        if (key === 'ArrowUp') {
            event.preventDefault()
            const zone: 'integer' | 'decimal' =
                scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
            cursorZoneRef.current = zone
            doStep(1, zone)
            return
        }
        if (key === 'ArrowDown') {
            event.preventDefault()
            const zone: 'integer' | 'decimal' =
                scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
            cursorZoneRef.current = zone
            doStep(-1, zone)
            return
        }

        // Navigation keys
        if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return

        // Ctrl/Cmd
        if (event.ctrlKey || event.metaKey) return

        // Minus
        if (key === '-') {
            if (!allowNegative) {
                event.preventDefault()
                return
            }
            if (selectionStart !== 0 || currentValue.includes('-')) event.preventDefault()
            return
        }

        // Decimal separator
        if (key === '.' || key === ',') {
            event.preventDefault()
            if (scale === 0) return
            if (separatorIndex !== -1) {
                const decStart = separatorIndex + 1
                window.requestAnimationFrame(() => target.setSelectionRange(decStart, currentValue.length))
                cursorZoneRef.current = 'decimal'
            }
            return
        }

        // Digits
        if (/^\d$/.test(key)) {
            // Decimal zone: replace digit in-place
            if (scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex) {
                event.preventDefault()
                const decStart = separatorIndex + 1
                const localIdx = Math.min(selectionStart, currentValue.length) - decStart
                const decChars = currentValue.slice(decStart).split('')
                if (localIdx >= 0 && localIdx < decChars.length) {
                    decChars[localIdx] = key
                    const nextText = `${currentValue.slice(0, decStart)}${decChars.join('')}`
                    const parsed = parseFloat(nextText.replace(/,/g, '.'))
                    if (Number.isFinite(parsed)) {
                        onChange(parsed)
                    }
                    const nextCaret = Math.min(decStart + localIdx + 1, decStart + scale)
                    window.requestAnimationFrame(() => target.setSelectionRange(nextCaret, nextCaret))
                }
                return
            }

            // Integer zone: check digit limit
            const normVal = currentValue.replace(/,/g, '.')
            const isNeg = normVal.startsWith('-')
            const absVal = isNeg ? normVal.slice(1) : normVal
            const decIdx = absVal.indexOf('.')

            if (decIdx === -1) {
                if (absVal.length >= maxIntegerDigits && selectionStart >= (isNeg ? 1 : 0) && !hasSelection) {
                    event.preventDefault()
                }
            } else {
                const adjPos = isNeg ? selectionStart - 1 : selectionStart
                if (adjPos <= decIdx) {
                    if (absVal.slice(0, decIdx).length >= maxIntegerDigits && !hasSelection) {
                        event.preventDefault()
                    }
                }
            }
            return
        }

        event.preventDefault()
    }

    return (
        <TextField
            inputRef={inputRef}
            size='small'
            variant='standard'
            type='text'
            slotProps={{
                htmlInput: {
                    inputMode: scale > 0 ? 'decimal' : 'numeric',
                    style: { textAlign: 'right' }
                },
                input: {
                    sx: { fontSize: 13 },
                    disableUnderline: true,
                    endAdornment: !disabled ? (
                        <InputAdornment position='end' sx={{ ml: 0 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <IconButton size='small' tabIndex={-1} onClick={() => doStep(1)} sx={{ width: 16, height: 12, p: 0 }}>
                                    <ArrowDropUpIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                                <IconButton size='small' tabIndex={-1} onClick={() => doStep(-1)} sx={{ width: 16, height: 12, p: 0 }}>
                                    <ArrowDropDownIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                            </Box>
                        </InputAdornment>
                    ) : undefined
                }
            }}
            value={formatValue(value)}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onClick={handleClick}
            disabled={disabled}
            fullWidth
        />
    )
}
