import {
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type FocusEvent,
    type KeyboardEvent,
    type MouseEvent as ReactMouseEvent
} from 'react'
import type { GridColDef, GridRenderCellParams, GridRenderEditCellParams } from '@mui/x-data-grid'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import InputAdornment from '@mui/material/InputAdornment'
import FormHelperText from '@mui/material/FormHelperText'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import { NUMBER_DEFAULTS, validateNumber, toNumberRules, type NumberValidationResult } from '@universo-react/utils'
import {
    INTERPRETATION_NETWORK_CELL_STYLE_STYLES,
    INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS,
    calculateInterpretationNetworkContrastRatio,
    resolveInterpretationNetworkDisplayColor,
    resolveInterpretationNetworkMaximumContrastForeground,
    type InterpretationNetworkCellStyleLineStyle,
    type InterpretationNetworkCellStyleWidth,
    type MatrixColor
} from '@universo-react/types'
import type { FieldConfig } from '../components/dialogs/FormDialog'
import { AssessmentOptionsCell } from '../components/AssessmentOptionsCell'
import { getAssessmentOptionCount } from './assessmentOptions'
import { buildTabularReferenceColumn } from './tabularReferenceColumns'
import {
    getTabularStringDisplayValue,
    isLocalizedStringField,
    readTabularSiblingRowSelectConfig,
    updateLocalizedTabularStringValue,
    type TabularSiblingTableValues
} from './tabularCellValues'
import {
    formatRuntimeDateValue,
    formatRuntimeSafeValue,
    formatRuntimeValue,
    isRuntimeSensitiveFieldName,
    isRuntimeTechnicalFieldName
} from './displayValue'
import { isSemanticLongTextRuntimeField } from './fieldSemantics'

type CellStylePreviewConfig = {
    fillColorField?: string
    textColorField?: string
    borderTopColorField?: string
    borderRightColorField?: string
    borderBottomColorField?: string
    borderLeftColorField?: string
    borderTopWidthField?: string
    borderRightWidthField?: string
    borderBottomWidthField?: string
    borderLeftWidthField?: string
    borderTopStyleField?: string
    borderRightStyleField?: string
    borderBottomStyleField?: string
    borderLeftStyleField?: string
}

const isCellStyleWidth = (value: string): value is InterpretationNetworkCellStyleWidth =>
    INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS.some((width) => width === value)

const isCellStyleLineStyle = (value: string): value is InterpretationNetworkCellStyleLineStyle =>
    INTERPRETATION_NETWORK_CELL_STYLE_STYLES.some((style) => style === value)

const readStringConfigValue = (source: Record<string, unknown>, key: keyof CellStylePreviewConfig): string | undefined => {
    const value = source[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

const readCellStylePreviewConfig = (value: unknown): CellStylePreviewConfig | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const source = value as Record<string, unknown>
    const config: CellStylePreviewConfig = {
        fillColorField: readStringConfigValue(source, 'fillColorField'),
        textColorField: readStringConfigValue(source, 'textColorField'),
        borderTopColorField: readStringConfigValue(source, 'borderTopColorField'),
        borderRightColorField: readStringConfigValue(source, 'borderRightColorField'),
        borderBottomColorField: readStringConfigValue(source, 'borderBottomColorField'),
        borderLeftColorField: readStringConfigValue(source, 'borderLeftColorField'),
        borderTopWidthField: readStringConfigValue(source, 'borderTopWidthField'),
        borderRightWidthField: readStringConfigValue(source, 'borderRightWidthField'),
        borderBottomWidthField: readStringConfigValue(source, 'borderBottomWidthField'),
        borderLeftWidthField: readStringConfigValue(source, 'borderLeftWidthField'),
        borderTopStyleField: readStringConfigValue(source, 'borderTopStyleField'),
        borderRightStyleField: readStringConfigValue(source, 'borderRightStyleField'),
        borderBottomStyleField: readStringConfigValue(source, 'borderBottomStyleField'),
        borderLeftStyleField: readStringConfigValue(source, 'borderLeftStyleField')
    }
    return Object.values(config).some(Boolean) ? config : null
}

const resolveRowFieldValue = (row: unknown, fieldName: string | undefined): unknown => {
    if (!fieldName || !row || typeof row !== 'object' || Array.isArray(row)) return undefined
    const record = row as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(record, fieldName)) return record[fieldName]
    const data = record.data
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>)[fieldName] : undefined
}

const resolveStyleWidth = (value: unknown): InterpretationNetworkCellStyleWidth =>
    typeof value === 'string' && isCellStyleWidth(value) ? value : '0'

const resolveStyleLine = (value: unknown): InterpretationNetworkCellStyleLineStyle =>
    typeof value === 'string' && isCellStyleLineStyle(value) ? value : 'none'

const widthToCss = (width: InterpretationNetworkCellStyleWidth): string => (width === '0' ? '0' : width)

const cellStylePreviewBackground = '#FFFFFF' as MatrixColor

const resolveSafeCellTextColor = (fill: MatrixColor | null, text: MatrixColor | null): MatrixColor | undefined => {
    const background = fill ?? cellStylePreviewBackground
    if (!text) return fill ? resolveInterpretationNetworkMaximumContrastForeground(fill) : undefined
    return calculateInterpretationNetworkContrastRatio(text, background) >= 4.5
        ? text
        : resolveInterpretationNetworkMaximumContrastForeground(background)
}

export const isHiddenTabularField = (field: FieldConfig): boolean => {
    const uiConfig = field.uiConfig ?? {}
    const widget = uiConfig.widget
    const isStructuredValue = field.type === 'TABLE' || widget === 'resourceSource' || widget === 'editorjsBlockContent'
    const hasHumanReadableReferenceOptions =
        field.type === 'REF' &&
        (field.refOptions ?? field.enumOptions ?? []).some((option) => {
            const label = formatRuntimeSafeValue(option.label)
            return Boolean(label) && !isRuntimeTechnicalFieldName(label) && !/\b(?:rh1\.|usr_internal_)/i.test(label)
        })
    const hasHumanReadableSiblingOptions = readTabularSiblingRowSelectConfig(field) !== null
    const isTechnicalIdentity = isRuntimeTechnicalFieldName(field.id) || isRuntimeTechnicalFieldName(field.codename)
    const isTechnicalField =
        isRuntimeTechnicalFieldName(field.label) ||
        (isTechnicalIdentity && !hasHumanReadableReferenceOptions && !hasHumanReadableSiblingOptions)

    const isSensitive =
        uiConfig.sensitive === true ||
        uiConfig.private === true ||
        isRuntimeSensitiveFieldName(field.id) ||
        isRuntimeSensitiveFieldName(field.codename) ||
        isRuntimeSensitiveFieldName(field.label)

    return (
        uiConfig.hidden === true ||
        uiConfig.gridHidden === true ||
        uiConfig.formHidden === true ||
        uiConfig.serverOwned === true ||
        uiConfig.generateUuidV7 === true ||
        isTechnicalField ||
        isStructuredValue ||
        isSensitive
    )
}

export const buildCellStylePreviewSx = (
    row: unknown,
    config: CellStylePreviewConfig,
    fieldById: Map<string, FieldConfig>
): Record<string, unknown> => {
    const fieldByCodename = new Map([...fieldById.values()].map((field) => [field.codename ?? field.id, field]))
    const resolveField = (fieldName: string | undefined): FieldConfig | undefined =>
        fieldName ? fieldById.get(fieldName) ?? fieldByCodename.get(fieldName) : undefined
    const resolveValue = (fieldName: string | undefined): unknown => {
        const field = resolveField(fieldName)
        return resolveRowFieldValue(row, field?.id ?? fieldName)
    }
    const width = (fieldName: string | undefined) => resolveStyleWidth(resolveValue(fieldName))
    const line = (fieldName: string | undefined) => resolveStyleLine(resolveValue(fieldName))
    const fill = resolveInterpretationNetworkDisplayColor(resolveValue(config.fillColorField))
    const text = resolveInterpretationNetworkDisplayColor(resolveValue(config.textColorField))
    const topColor = resolveInterpretationNetworkDisplayColor(resolveValue(config.borderTopColorField)) ?? 'transparent'
    const rightColor = resolveInterpretationNetworkDisplayColor(resolveValue(config.borderRightColorField)) ?? 'transparent'
    const bottomColor = resolveInterpretationNetworkDisplayColor(resolveValue(config.borderBottomColorField)) ?? 'transparent'
    const leftColor = resolveInterpretationNetworkDisplayColor(resolveValue(config.borderLeftColorField)) ?? 'transparent'

    return {
        minHeight: 36,
        width: '100%',
        px: 1,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
        bgcolor: fill ?? 'transparent',
        color: resolveSafeCellTextColor(fill, text),
        borderTop: `${widthToCss(width(config.borderTopWidthField))} ${line(config.borderTopStyleField)} ${topColor}`,
        borderRight: `${widthToCss(width(config.borderRightWidthField))} ${line(config.borderRightStyleField)} ${rightColor}`,
        borderBottom: `${widthToCss(width(config.borderBottomWidthField))} ${line(config.borderBottomStyleField)} ${bottomColor}`,
        borderLeft: `${widthToCss(width(config.borderLeftWidthField))} ${line(config.borderLeftStyleField)} ${leftColor}`
    }
}

const renderCellStylePreview = (text: string, row: unknown, config: CellStylePreviewConfig, fieldById: Map<string, FieldConfig>) => (
    <Box data-testid='tabular-cell-style-preview' sx={buildCellStylePreviewSx(row, config, fieldById)}>
        <Typography component='span' sx={{ fontSize: 'inherit', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
            {text}
        </Typography>
    </Box>
)

/** Props for the inline NUMBER edit cell. */
interface NumberEditCellProps extends GridRenderEditCellParams {
    /** Localized field label for the textbox. */
    accessibleLabel: string
    nonNegative: boolean
    scale: number
    maxIntegerDigits: number
    /** BCP-47 locale for decimal separator (e.g. "ru" → comma, "en" → dot). */
    locale: string
    /** Validation rules for stepper boundary checks. */
    validationRules?: Record<string, unknown>
    /** Localized accessible label for the increment button. */
    incrementAriaLabel: string
    /** Localized accessible label for the decrement button. */
    decrementAriaLabel: string
    /** Localized validation helper text for the current edit value. */
    validationErrorMessage?: string
    /** MUI DataGrid edit error flag from preProcessEditCellProps. */
    error?: boolean
}

/** Determine locale-appropriate decimal separator. */
const getDecimalSeparator = (locale: string, scale: number) => {
    if (scale <= 0) return ''
    const lang = locale.split(/[-_]/)[0].toLowerCase()
    return lang === 'ru' ? ',' : '.'
}

/**
 * Custom DataGrid edit cell for NUMBER columns.
 *
 * Replicates the full NUMBER field behavior from FormDialog:
 * - formatted display with fixed decimal places and locale-aware separator
 * - zone-based selection (integer vs decimal part)
 * - ArrowUp/ArrowDown zone-aware stepping
 * - stepper buttons (▲▼)
 * - blocks "-" when nonNegative, prevents exceeding precision/scale
 */
function NumberEditCell({
    id,
    field,
    value,
    api,
    accessibleLabel,
    nonNegative,
    scale,
    maxIntegerDigits,
    locale,
    validationRules,
    incrementAriaLabel,
    decrementAriaLabel,
    validationErrorMessage,
    error
}: NumberEditCellProps) {
    const decimalSeparator = getDecimalSeparator(locale, scale)
    const allowNegative = !nonNegative
    const inputRef = useRef<HTMLInputElement>(null)
    const cursorZoneRef = useRef<'integer' | 'decimal'>('integer')
    const helperId = validationErrorMessage ? `${String(id)}-${field}-number-error` : undefined

    const formatValue = (val: unknown): string => {
        if (val == null || (typeof val === 'number' && Number.isNaN(val))) {
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

    const [inputValue, setInputValue] = useState<string>(() => formatValue(value))

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

    const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
        const target = event.target
        window.requestAnimationFrame(() => selectNumberPart(target))
    }

    const handleClick = (event: ReactMouseEvent<HTMLInputElement>) => {
        const target = event.target as HTMLInputElement
        window.requestAnimationFrame(() => selectNumberPart(target))
    }

    // Zone-aware stepper
    const numberRules = toNumberRules(validationRules)
    const doStep = (direction: 1 | -1, zone?: 'integer' | 'decimal') => {
        const effectiveZone = zone ?? cursorZoneRef.current
        const step = scale > 0 && effectiveZone === 'decimal' ? Math.pow(10, -scale) : 1
        const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
        let next = Number((current + direction * step).toFixed(scale))
        if (nonNegative && next < 0) next = 0
        if (typeof numberRules.min === 'number' && next < numberRules.min) next = numberRules.min
        if (typeof numberRules.max === 'number' && next > numberRules.max) next = numberRules.max
        if (!validateNumber(next, numberRules).valid) return
        setInputValue(formatValue(next))
        api.setEditCellValue({ id, field, value: next })
    }

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value

        if (raw === '') {
            setInputValue('')
            api.setEditCellValue({ id, field, value: null })
            return
        }

        if (raw === '-') {
            if (!allowNegative) return
            setInputValue('-')
            api.setEditCellValue({ id, field, value: null })
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

        setInputValue(raw)
        const parsed = parseFloat(normalized)
        if (Number.isFinite(parsed)) {
            api.setEditCellValue({ id, field, value: parsed })
        }
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
                        setInputValue(nextText)
                        api.setEditCellValue({ id, field, value: parsed })
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

    const handleBlur = () => {
        // Re-format on blur to fix display (e.g. after partial input)
        const parsed = typeof value === 'number' && Number.isFinite(value) ? value : null
        setInputValue(formatValue(parsed))
    }

    return (
        <Box sx={{ width: '100%' }}>
            <InputBase
                inputRef={inputRef}
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onClick={handleClick}
                onBlur={handleBlur}
                fullWidth
                sx={{ fontSize: 'inherit', '& input': { textAlign: 'right', px: 0.5, py: 0 } }}
                inputProps={{
                    inputMode: scale > 0 ? 'decimal' : 'numeric',
                    'aria-label': accessibleLabel,
                    'aria-invalid': error ? 'true' : undefined,
                    'aria-describedby': helperId
                }}
                endAdornment={
                    <InputAdornment position='end' sx={{ ml: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <IconButton
                                size='small'
                                tabIndex={-1}
                                aria-label={incrementAriaLabel}
                                onClick={() => doStep(1)}
                                sx={{ width: 18, height: 14, p: 0 }}
                            >
                                <ArrowDropUpIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                            <IconButton
                                size='small'
                                tabIndex={-1}
                                aria-label={decrementAriaLabel}
                                onClick={() => doStep(-1)}
                                sx={{ width: 18, height: 14, p: 0 }}
                            >
                                <ArrowDropDownIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Box>
                    </InputAdornment>
                }
            />
            {error && validationErrorMessage ? (
                <FormHelperText id={helperId} error role='alert' sx={{ m: 0, mt: 0.25, lineHeight: 1.2 }}>
                    {validationErrorMessage}
                </FormHelperText>
            ) : null}
        </Box>
    )
}

interface StringEditCellProps extends GridRenderEditCellParams {
    /** Localized field label for the textbox. */
    accessibleLabel: string
    locale: string
    localized: boolean
    multiline: boolean
}

function StringEditCell({ id, field, value, api, accessibleLabel, locale, localized, multiline }: StringEditCellProps) {
    const [inputValue, setInputValue] = useState<string>(() => getTabularStringDisplayValue(value, locale))
    const currentValueRef = useRef<unknown>(value)

    useEffect(() => {
        currentValueRef.current = value
        setInputValue(getTabularStringDisplayValue(value, locale))
    }, [value, locale])

    const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const nextText = event.target.value
        const nextValue = localized ? updateLocalizedTabularStringValue(currentValueRef.current, nextText, locale) : nextText
        currentValueRef.current = nextValue
        setInputValue(nextText)
        api.setEditCellValue({
            id,
            field,
            value: nextValue
        })
    }

    return (
        <InputBase
            value={inputValue}
            onChange={handleChange}
            fullWidth
            multiline={multiline}
            minRows={multiline ? 3 : undefined}
            inputProps={{ 'aria-label': accessibleLabel }}
            sx={{
                fontSize: 'inherit',
                alignItems: multiline ? 'flex-start' : 'center',
                '& input': { px: 0.5, py: 0 },
                '& textarea': { px: 0.5, py: 0.5, resize: 'vertical' }
            }}
        />
    )
}

const renderTabularLongTextCell = (params: GridRenderCellParams, locale: string) => (
    <Typography
        component='span'
        variant='body2'
        sx={{
            display: 'block',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: 1.35,
            py: 0.75
        }}
    >
        {getTabularStringDisplayValue(params.value, locale)}
    </Typography>
)

export interface BuildTabularColumnsOptions {
    /** Child components. */
    childFields: FieldConfig[]
    /** Map from row id → 1-based row number (for # column). */
    rowNumberById: Map<string, number>
    /** Called when the user requests to delete a row. */
    onDeleteRow: (rowId: string) => void
    /** Called when the row-actions "⋮" button is clicked. */
    onOpenRowMenu?: (event: ReactMouseEvent<HTMLElement>, rowId: string) => void
    /** Called when a non-editable select cell value changes (REF select mode). */
    onSelectChange?: (rowId: string, fieldId: string, value: unknown) => void
    /** Accessible label for the delete button. */
    deleteAriaLabel?: string
    /** Accessible label for the row actions button. */
    actionsAriaLabel?: string
    /** Current locale for number formatting (e.g. 'ru', 'en'). */
    locale?: string
    /** Localized accessible label for NUMBER increment controls. */
    numberIncrementAriaLabel?: string
    /** Localized accessible label for NUMBER decrement controls. */
    numberDecrementAriaLabel?: string
    /** Localized fallback message for invalid NUMBER input. */
    numberInvalidMessage?: string
    /** Maps NUMBER validation failures to localized user-facing helper text. */
    getNumberValidationMessage?: (field: FieldConfig, result: NumberValidationResult) => string
    /** Current rows from sibling TABLE fields, keyed by their metadata codenames. */
    siblingTableValues?: TabularSiblingTableValues
    /** Localized empty selection label for sibling TABLE selectors. */
    siblingSelectPlaceholderLabel?: string
    /** Localized label shown when a sibling TABLE has no selectable rows. */
    siblingNoOptionsLabel?: string
    /** Localized label shown when sibling rows exist but none has a safe selectable label. */
    siblingNoSelectableOptionsLabel?: string
    /** Localized label for a previously selected row that is no longer available. */
    siblingUnavailableLabel?: string
    /** Temporarily prevents edits while a related TABLE value is loading. */
    disabled?: boolean
}

/**
 * Build DataGrid column definitions for inline tabular editing.
 *
 * Shared between TabularPartEditor (CREATE mode, local state) and
 * RuntimeInlineTabularEditor (EDIT mode, API-backed).
 */
export function buildTabularColumns({
    childFields,
    rowNumberById,
    onDeleteRow,
    onOpenRowMenu,
    onSelectChange,
    deleteAriaLabel = 'Delete',
    actionsAriaLabel = 'Actions',
    locale = 'en',
    numberIncrementAriaLabel,
    numberDecrementAriaLabel,
    numberInvalidMessage,
    getNumberValidationMessage,
    siblingTableValues,
    siblingSelectPlaceholderLabel = 'Select an option',
    siblingNoOptionsLabel = 'No options available',
    siblingNoSelectableOptionsLabel = siblingNoOptionsLabel,
    siblingUnavailableLabel = 'Unavailable option',
    disabled = false
}: BuildTabularColumnsOptions): GridColDef[] {
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const incrementAriaLabel = numberIncrementAriaLabel ?? (normalizedLocale === 'ru' ? 'Увеличить' : 'Increase value')
    const decrementAriaLabel = numberDecrementAriaLabel ?? (normalizedLocale === 'ru' ? 'Уменьшить' : 'Decrease value')
    const invalidNumberMessage = numberInvalidMessage ?? (normalizedLocale === 'ru' ? 'Некорректное число' : 'Invalid number')
    const fieldById = new Map(childFields.map((field) => [field.id, field]))
    const visibleChildFields = childFields.filter((field) => !isHiddenTabularField(field))

    const fieldCols: GridColDef[] = [
        {
            field: '__rowNumber',
            headerName: '#',
            width: 44,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            editable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => rowNumberById.get(String(params.id)) ?? ''
        },
        ...visibleChildFields.map((field): GridColDef => {
            if (field.type === 'JSON' && field.uiConfig?.widget === 'assessmentOptions') {
                return {
                    field: field.id,
                    headerName: field.label,
                    flex: 1,
                    minWidth: 220,
                    editable: false,
                    renderCell: (params) => (
                        <AssessmentOptionsCell
                            value={params.value}
                            locale={locale}
                            minOptions={field.uiConfig?.minOptions}
                            maxOptions={field.uiConfig?.maxOptions}
                            tabIndex={params.tabIndex}
                            onSave={
                                !disabled && onSelectChange ? (options) => onSelectChange(String(params.id), field.id, options) : undefined
                            }
                        />
                    ),
                    valueFormatter: (value: unknown) => getAssessmentOptionCount(value)
                }
            }

            const referenceColumn = buildTabularReferenceColumn(field, {
                locale,
                disabled,
                siblingTableValues,
                onSelectChange,
                siblingSelectPlaceholderLabel,
                siblingNoOptionsLabel,
                siblingNoSelectableOptionsLabel,
                siblingUnavailableLabel
            })
            if (referenceColumn) return referenceColumn

            const colDef: GridColDef = {
                field: field.id,
                headerName: field.label,
                flex: 1,
                minWidth: 120,
                editable: !disabled,
                type: field.type === 'NUMBER' ? 'number' : field.type === 'BOOLEAN' ? 'boolean' : field.type === 'DATE' ? 'date' : 'string'
            }

            if (field.type === 'STRING') {
                const isLongText = isSemanticLongTextRuntimeField({
                    id: field.id,
                    codename: field.codename,
                    field: field.id,
                    label: field.label,
                    headerName: field.label,
                    uiConfig: field.uiConfig
                })
                const localized = isLocalizedStringField(field)
                const stylePreviewConfig = readCellStylePreviewConfig(field.uiConfig?.cellStylePreview)

                colDef.minWidth = isLongText ? 220 : colDef.minWidth
                if (stylePreviewConfig) {
                    colDef.renderCell = (params) =>
                        renderCellStylePreview(
                            getTabularStringDisplayValue(params.value, locale),
                            params.row,
                            stylePreviewConfig,
                            fieldById
                        )
                } else {
                    colDef.renderCell = isLongText
                        ? (params) => renderTabularLongTextCell(params, locale)
                        : (params) => getTabularStringDisplayValue(params.value, locale)
                }
                colDef.valueFormatter = (value: unknown) => getTabularStringDisplayValue(value, locale)

                if (localized || isLongText) {
                    colDef.renderEditCell = (params) => (
                        <StringEditCell
                            {...params}
                            accessibleLabel={field.label}
                            locale={locale}
                            localized={localized}
                            multiline={isLongText}
                        />
                    )
                }
            }

            if (field.type !== 'STRING' && field.type !== 'NUMBER' && field.type !== 'BOOLEAN') {
                if (field.type === 'DATE') {
                    const dateComposition = field.validationRules?.dateComposition
                    const composition =
                        dateComposition === 'date' || dateComposition === 'time' || dateComposition === 'datetime'
                            ? dateComposition
                            : 'datetime'
                    colDef.renderCell = (params) => formatRuntimeDateValue(params.value, locale, composition)
                    colDef.valueFormatter = (value: unknown) => formatRuntimeDateValue(value, locale, composition)
                } else {
                    colDef.renderCell = (params) => formatRuntimeValue(params.value, locale)
                    colDef.valueFormatter = (value: unknown) => formatRuntimeValue(value, locale)
                }
            }

            // Customize NUMBER columns: custom edit cell + validation + alignment
            if (field.type === 'NUMBER') {
                const rules = field.validationRules
                const precision = typeof rules?.precision === 'number' ? rules.precision : NUMBER_DEFAULTS.precision
                const sc = typeof rules?.scale === 'number' ? rules.scale : NUMBER_DEFAULTS.scale
                const maxInt = precision - sc
                const nonNeg = Boolean(rules?.nonNegative)

                colDef.align = 'right'
                colDef.headerAlign = 'right'
                colDef.renderEditCell = (params) => (
                    <NumberEditCell
                        {...params}
                        accessibleLabel={field.label}
                        nonNegative={nonNeg}
                        scale={sc}
                        maxIntegerDigits={maxInt}
                        locale={locale}
                        validationRules={rules}
                        incrementAriaLabel={incrementAriaLabel}
                        decrementAriaLabel={decrementAriaLabel}
                        validationErrorMessage={
                            ((params as { helperText?: string }).helperText as string | undefined) ?? invalidNumberMessage
                        }
                    />
                )
                // Display formatted value with locale-aware decimal separator
                const sep = getDecimalSeparator(locale, sc)
                colDef.renderCell = (params) => {
                    const v = params.value
                    if (v == null) return ''
                    const n = typeof v === 'number' ? v : parseFloat(String(v))
                    if (!Number.isFinite(n)) return ''
                    return sc > 0 ? n.toFixed(sc).replace('.', sep) : String(Math.trunc(n))
                }

                if (rules) {
                    colDef.preProcessEditCellProps = (params) => {
                        const cellValue = params.props.value as number | null | undefined
                        if (cellValue == null || typeof cellValue !== 'number' || Number.isNaN(cellValue)) {
                            return { ...params.props, error: false }
                        }
                        const result = validateNumber(cellValue, toNumberRules(rules))
                        if (result.valid) {
                            return { ...params.props, error: false, helperText: undefined }
                        }
                        return {
                            ...params.props,
                            error: true,
                            helperText: getNumberValidationMessage?.(field, result) ?? invalidNumberMessage
                        }
                    }
                }
            }

            return colDef
        })
    ]

    // Actions column (delete)
    fieldCols.push({
        field: '__actions',
        headerName: actionsAriaLabel,
        width: 48,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        hideable: false,
        align: 'center',
        headerAlign: 'center',
        renderHeader: () => <MoreVertRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', opacity: 0.6 }} />,
        renderCell: (params) => {
            const rowId = String(params.id)

            return (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%'
                    }}
                >
                    <IconButton
                        size='small'
                        disabled={disabled}
                        onClick={(e) => {
                            e.stopPropagation()
                            if (onOpenRowMenu) {
                                onOpenRowMenu(e, rowId)
                                return
                            }
                            onDeleteRow(rowId)
                        }}
                        aria-label={onOpenRowMenu ? actionsAriaLabel : deleteAriaLabel}
                        sx={{ width: 28, height: 28, p: 0.25 }}
                    >
                        <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            )
        }
    })

    return fieldCols
}
