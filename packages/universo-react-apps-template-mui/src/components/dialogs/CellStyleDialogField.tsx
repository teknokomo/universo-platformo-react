// Interpretation Network Interpretation Matrix cell style picker widget.
//
// Used as a `uiConfig.widget === 'cellStylePicker'` extension of the standard
// FormDialog field. Renders a 4-row grid (one row per cell side: top, right,
// bottom, left) plus a fill row. Each row carries the control that matches the
// bound scalar field: color, width, or line style. A live preview box at the
// top of the widget shows the current value applied to a single cell.
//
// The widget is configuration-agnostic: it does not import anything from the
// `interpretation-network` template and it has no coupling to the `MetahubComponentsService`.
// It is wired into the interpretation-network runtime through the `uiConfig.widget` hook on
// each cell-style field of the `InterpretationMatrix` TABLE child components.

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import type { FieldConfig } from './FormDialog'
import {
    INTERPRETATION_NETWORK_CELL_COLOR_PRESET_CODENAMES,
    INTERPRETATION_NETWORK_CELL_STYLE_SIDES,
    INTERPRETATION_NETWORK_CELL_STYLE_STYLES,
    INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS,
    type InterpretationNetworkCellColorPresetCodename,
    type InterpretationNetworkCellStyleBorder,
    type InterpretationNetworkCellStyleSide,
    type InterpretationNetworkCellStyleState
} from '@universo-react/types'

export const CELL_STYLE_PICKER_WIDGET = 'cellStylePicker' as const

/**
 * Returns true when the given field is configured to render as a cell style picker.
 * The widget replaces the default field renderer. The field is expected to live
 * inside a Interpretation Network Interpretation Matrix TABLE. The widget is auto-activated when
 * the field codename matches a known Interpretation Network cell-style attribute, or when the
 * field explicitly opts in via `uiConfig.widget === 'cellStylePicker'`.
 */
export const isCellStylePickerField = (field: FieldConfig): boolean => {
    const uiConfig = field.uiConfig ?? {}
    if (uiConfig.widget === CELL_STYLE_PICKER_WIDGET) return true
    return INTERPRETATION_NETWORK_CELL_STYLE_FIELD_CODENAMES.has(field.id ?? field.codename ?? '')
}

/**
 * Field codenames that the `cellStylePicker` widget auto-detects inside
 * a Interpretation Network Interpretation Matrix row. The mapping from codename to side
 * is encoded in `codenameToCellStyleFor`.
 */
export const INTERPRETATION_NETWORK_CELL_STYLE_FIELD_CODENAMES: ReadonlySet<string> = new Set([
    'CellFillColor',
    'CellFillColorId',
    'BorderTopColor',
    'BorderRightColor',
    'BorderBottomColor',
    'BorderLeftColor',
    'BorderTopWidth',
    'BorderRightWidth',
    'BorderBottomWidth',
    'BorderLeftWidth',
    'BorderTopStyle',
    'BorderRightStyle',
    'BorderBottomStyle',
    'BorderLeftStyle'
])

/**
 * Maps a Interpretation Network cell-style field codename to the side of the cell it
 * represents. Used by the `cellStylePicker` widget to decide whether the
 * current field controls the fill, a border side, or none of the above.
 */
export const codenameToCellStyleFor: Record<string, 'fill' | 'top' | 'right' | 'bottom' | 'left'> = {
    CellFillColor: 'fill',
    CellFillColorId: 'fill',
    BorderTopColor: 'top',
    BorderRightColor: 'right',
    BorderBottomColor: 'bottom',
    BorderLeftColor: 'left',
    BorderTopWidth: 'top',
    BorderRightWidth: 'right',
    BorderBottomWidth: 'bottom',
    BorderLeftWidth: 'left',
    BorderTopStyle: 'top',
    BorderRightStyle: 'right',
    BorderBottomStyle: 'bottom',
    BorderLeftStyle: 'left'
}

const FILL_SIDE: 'fill' = 'fill'
type InterpretationNetworkCellStyleTarget = typeof FILL_SIDE | InterpretationNetworkCellStyleSide
type InterpretationNetworkCellStyleValueKind = 'color' | 'width' | 'lineStyle'

const readCellStyleTarget = (field: FieldConfig): InterpretationNetworkCellStyleTarget => {
    const uiConfig = field.uiConfig ?? {}
    // First check explicit `uiConfig.cellStyleFor` (back-compat for callers
    // that pass it directly).
    const raw = typeof uiConfig.cellStyleFor === 'string' ? (uiConfig.cellStyleFor as string).trim().toLowerCase() : ''
    if (raw === FILL_SIDE) return FILL_SIDE
    if (INTERPRETATION_NETWORK_CELL_STYLE_SIDES.some((side) => side === raw)) return raw as InterpretationNetworkCellStyleSide
    // Then autodetect from the field codename.
    const codename = field.id ?? field.codename ?? ''
    const mapped = codenameToCellStyleFor[codename]
    if (mapped) return mapped
    return FILL_SIDE
}

const readCellStyleValueKind = (field: FieldConfig): InterpretationNetworkCellStyleValueKind => {
    const uiConfig = field.uiConfig ?? {}
    const explicit = typeof uiConfig.cellStyleValue === 'string' ? uiConfig.cellStyleValue.trim() : ''
    if (explicit === 'color' || explicit === 'width' || explicit === 'lineStyle') {
        return explicit
    }

    const codename = field.id ?? field.codename ?? ''
    if (codename.endsWith('Width')) return 'width'
    if (codename.endsWith('Style')) return 'lineStyle'
    return 'color'
}

const DEFAULT_CELL_COLOR_LABELS: Record<InterpretationNetworkCellColorPresetCodename, string> = {
    none: 'None',
    gray: 'Gray',
    red: 'Red',
    orange: 'Orange',
    yellow: 'Yellow',
    green: 'Green',
    teal: 'Teal',
    blue: 'Blue',
    indigo: 'Indigo',
    purple: 'Purple',
    pink: 'Pink',
    black: 'Black'
}

const interpretationNetworkColorToHex = (color: InterpretationNetworkCellColorPresetCodename): string | null => {
    switch (color) {
        case 'none':
            return null
        case 'gray':
            return '#9e9e9e'
        case 'red':
            return '#e53935'
        case 'orange':
            return '#fb8c00'
        case 'yellow':
            return '#fdd835'
        case 'green':
            return '#43a047'
        case 'teal':
            return '#00897b'
        case 'blue':
            return '#1e88e5'
        case 'indigo':
            return '#3949ab'
        case 'purple':
            return '#8e24aa'
        case 'pink':
            return '#d81b60'
        case 'black':
            return '#212121'
        default:
            return null
    }
}

const interpretationNetworkWidthToCss = (width: InterpretationNetworkCellStyleBorder['width']): string => {
    if (width === '0') return '0'
    return width
}

const emptyBorder = (): InterpretationNetworkCellStyleBorder => ({
    color: 'none',
    width: '0',
    style: 'none'
})

const defaultCellStyleState = (): InterpretationNetworkCellStyleState => ({
    fill: 'none',
    borders: {
        top: emptyBorder(),
        right: emptyBorder(),
        bottom: emptyBorder(),
        left: emptyBorder()
    }
})

const readCellStyleState = (
    value: unknown,
    target: InterpretationNetworkCellStyleTarget,
    valueKind: InterpretationNetworkCellStyleValueKind
): InterpretationNetworkCellStyleState => {
    // Accept either a flat codename string (one component per side) or a full
    // `InterpretationNetworkCellStyleState` object (a single field bound to the row's full state).
    // For a flat string, the value is applied to the bound field's own target
    // and kind. Preserving width/style values matters because re-rendering the widget
    // for an existing row must not silently overwrite previously saved styling.
    if (typeof value === 'string') {
        if (valueKind === 'color' && isColor(value)) {
            if (target === FILL_SIDE) {
                return {
                    fill: value,
                    borders: { top: emptyBorder(), right: emptyBorder(), bottom: emptyBorder(), left: emptyBorder() }
                }
            }
            return {
                fill: 'none',
                borders: {
                    top: target === 'top' ? { ...emptyBorder(), color: value } : emptyBorder(),
                    right: target === 'right' ? { ...emptyBorder(), color: value } : emptyBorder(),
                    bottom: target === 'bottom' ? { ...emptyBorder(), color: value } : emptyBorder(),
                    left: target === 'left' ? { ...emptyBorder(), color: value } : emptyBorder()
                }
            }
        }
        if (valueKind === 'width' && (INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS as readonly string[]).includes(value)) {
            return {
                fill: 'none',
                borders: {
                    top:
                        target === 'top'
                            ? { ...emptyBorder(), width: value as InterpretationNetworkCellStyleBorder['width'] }
                            : emptyBorder(),
                    right:
                        target === 'right'
                            ? { ...emptyBorder(), width: value as InterpretationNetworkCellStyleBorder['width'] }
                            : emptyBorder(),
                    bottom:
                        target === 'bottom'
                            ? { ...emptyBorder(), width: value as InterpretationNetworkCellStyleBorder['width'] }
                            : emptyBorder(),
                    left:
                        target === 'left'
                            ? { ...emptyBorder(), width: value as InterpretationNetworkCellStyleBorder['width'] }
                            : emptyBorder()
                }
            }
        }
        if (valueKind === 'lineStyle' && (INTERPRETATION_NETWORK_CELL_STYLE_STYLES as readonly string[]).includes(value)) {
            return {
                fill: 'none',
                borders: {
                    top:
                        target === 'top'
                            ? { ...emptyBorder(), style: value as InterpretationNetworkCellStyleBorder['style'] }
                            : emptyBorder(),
                    right:
                        target === 'right'
                            ? { ...emptyBorder(), style: value as InterpretationNetworkCellStyleBorder['style'] }
                            : emptyBorder(),
                    bottom:
                        target === 'bottom'
                            ? { ...emptyBorder(), style: value as InterpretationNetworkCellStyleBorder['style'] }
                            : emptyBorder(),
                    left:
                        target === 'left'
                            ? { ...emptyBorder(), style: value as InterpretationNetworkCellStyleBorder['style'] }
                            : emptyBorder()
                }
            }
        }
        return defaultCellStyleState()
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultCellStyleState()
    const raw = value as Record<string, unknown>
    const fill = typeof raw.fill === 'string' && isColor(raw.fill) ? (raw.fill as InterpretationNetworkCellColorPresetCodename) : 'none'
    const borders = INTERPRETATION_NETWORK_CELL_STYLE_SIDES.reduce<InterpretationNetworkCellStyleState['borders']>(
        (acc, side) => {
            const rawSide = (raw.borders as Record<string, unknown> | undefined)?.[side]
            if (!rawSide || typeof rawSide !== 'object' || Array.isArray(rawSide)) {
                acc[side] = emptyBorder()
                return acc
            }
            const sideObj = rawSide as Record<string, unknown>
            acc[side] = {
                color:
                    typeof sideObj.color === 'string' && isColor(sideObj.color)
                        ? (sideObj.color as InterpretationNetworkCellColorPresetCodename)
                        : 'none',
                width:
                    typeof sideObj.width === 'string' && INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS.some((w) => w === sideObj.width)
                        ? (sideObj.width as InterpretationNetworkCellStyleBorder['width'])
                        : '0',
                style:
                    typeof sideObj.style === 'string' && INTERPRETATION_NETWORK_CELL_STYLE_STYLES.some((s) => s === sideObj.style)
                        ? (sideObj.style as InterpretationNetworkCellStyleBorder['style'])
                        : 'none'
            }
            return acc
        },
        { top: emptyBorder(), right: emptyBorder(), bottom: emptyBorder(), left: emptyBorder() }
    )
    return { fill, borders }
}

const isColor = (value: string): value is InterpretationNetworkCellColorPresetCodename =>
    INTERPRETATION_NETWORK_CELL_COLOR_PRESET_CODENAMES.some((c) => c === value)

const resolveColorCodename = (value: unknown, field: FieldConfig): InterpretationNetworkCellColorPresetCodename | unknown => {
    if (typeof value !== 'string') return value
    if (isColor(value)) return value
    const option = (field.refOptions ?? field.enumOptions ?? []).find((candidate) => candidate.id === value)
    return option?.codename && isColor(option.codename) ? option.codename : value
}

const encodeColorValue = (color: InterpretationNetworkCellColorPresetCodename, field: FieldConfig): string => {
    if (field.type !== 'REF') return color
    const option = (field.refOptions ?? field.enumOptions ?? []).find((candidate) => candidate.codename === color)
    return option?.id ?? color
}

const isColorChipActive = (
    target: InterpretationNetworkCellStyleTarget,
    state: InterpretationNetworkCellStyleState,
    color: InterpretationNetworkCellColorPresetCodename
): boolean => {
    if (target === FILL_SIDE) return state.fill === color
    return state.borders[target].color === color
}

const updateCellStyleValue = (
    state: InterpretationNetworkCellStyleState,
    target: InterpretationNetworkCellStyleTarget,
    color: InterpretationNetworkCellColorPresetCodename
): InterpretationNetworkCellStyleState => {
    if (target === FILL_SIDE) return { ...state, fill: color }
    return {
        ...state,
        borders: {
            ...state.borders,
            [target]: { ...state.borders[target], color }
        }
    }
}

const updateCellStyleWidth = (
    state: InterpretationNetworkCellStyleState,
    target: InterpretationNetworkCellStyleTarget,
    width: InterpretationNetworkCellStyleBorder['width']
): InterpretationNetworkCellStyleState => {
    if (target === FILL_SIDE) return state
    return {
        ...state,
        borders: {
            ...state.borders,
            [target]: { ...state.borders[target], width }
        }
    }
}

const updateCellStyleLine = (
    state: InterpretationNetworkCellStyleState,
    target: InterpretationNetworkCellStyleTarget,
    style: InterpretationNetworkCellStyleBorder['style']
): InterpretationNetworkCellStyleState => {
    if (target === FILL_SIDE) return state
    return {
        ...state,
        borders: {
            ...state.borders,
            [target]: { ...state.borders[target], style }
        }
    }
}

const buildPreviewSx = (state: InterpretationNetworkCellStyleState) => {
    const fillColor = interpretationNetworkColorToHex(state.fill)
    const top = state.borders.top
    const right = state.borders.right
    const bottom = state.borders.bottom
    const left = state.borders.left
    return {
        width: 200,
        height: 60,
        borderRadius: 1,
        backgroundColor: fillColor ?? 'transparent',
        borderTop: `${interpretationNetworkWidthToCss(top.width)} ${top.style} ${
            interpretationNetworkColorToHex(top.color) ?? 'transparent'
        }`,
        borderRight: `${interpretationNetworkWidthToCss(right.width)} ${right.style} ${
            interpretationNetworkColorToHex(right.color) ?? 'transparent'
        }`,
        borderBottom: `${interpretationNetworkWidthToCss(bottom.width)} ${bottom.style} ${
            interpretationNetworkColorToHex(bottom.color) ?? 'transparent'
        }`,
        borderLeft: `${interpretationNetworkWidthToCss(left.width)} ${left.style} ${
            interpretationNetworkColorToHex(left.color) ?? 'transparent'
        }`
    } as const
}

export interface CellStylePickerFieldLabels {
    preview: string
    helper: string
    color: string
    width: string
    style: string
    fill: string
    borders: Record<InterpretationNetworkCellStyleSide, string>
    colorLabels: Record<InterpretationNetworkCellColorPresetCodename, string>
    lineStyleLabels: Record<InterpretationNetworkCellStyleBorder['style'], string>
}

export const DEFAULT_CELL_STYLE_PICKER_LABELS: CellStylePickerFieldLabels = {
    preview: 'Current field preview',
    helper: 'These settings are saved with the row.',
    color: 'Color',
    width: 'Width',
    style: 'Style',
    fill: 'Fill',
    borders: {
        top: 'Top',
        right: 'Right',
        bottom: 'Bottom',
        left: 'Left'
    },
    colorLabels: DEFAULT_CELL_COLOR_LABELS,
    lineStyleLabels: {
        solid: 'Solid',
        dashed: 'Dashed',
        dotted: 'Dotted',
        double: 'Double',
        none: 'None'
    }
}

export interface CellStyleDialogFieldProps {
    /** The field configuration that this widget renders for. */
    field: FieldConfig
    /** Current field value. Usually a scalar color, width, or line-style codename. */
    value: unknown
    /** Called when the user picks a color / width / style. Receives the new value for this field. */
    onChange: (nextValue: string) => void
    /** Optional error message from the parent form. */
    error?: string | null
    /** Optional helper text from the parent form. */
    helperText?: string | null
    /** BCP-47 locale. */
    locale?: string
    /** Localization bundle. Defaults to the bundled English labels. */
    labels?: Partial<CellStylePickerFieldLabels>
    /** Disables the picker. */
    disabled?: boolean
}

/**
 * Renders the cell style picker. The widget is read from the parent
 * FormDialog (or a row editor) and is wired through the standard
 * `onChange`/`error`/`helperText` contract.
 */
export function CellStyleDialogField({ field, value, onChange, error, helperText, labels, disabled }: CellStyleDialogFieldProps) {
    const { t: tInterpretationNetwork } = useTranslation('interpretationNetwork')
    // Pull localized labels from the `interpretationNetwork` namespace first, then allow
    // explicit `labels` props to override, then fall back to the bundled
    // English defaults. This keeps the widget localized in en + ru without
    // requiring every caller to pass a label bundle.
    const resolvedLabels = useMemo<CellStylePickerFieldLabels>(
        () => ({
            ...DEFAULT_CELL_STYLE_PICKER_LABELS,
            preview: tInterpretationNetwork('cellStyle.preview', DEFAULT_CELL_STYLE_PICKER_LABELS.preview),
            helper: tInterpretationNetwork('cellStyle.helper', DEFAULT_CELL_STYLE_PICKER_LABELS.helper),
            color: tInterpretationNetwork('cellStyle.color', DEFAULT_CELL_STYLE_PICKER_LABELS.color),
            width: tInterpretationNetwork('cellStyle.width', DEFAULT_CELL_STYLE_PICKER_LABELS.width),
            style: tInterpretationNetwork('cellStyle.style', DEFAULT_CELL_STYLE_PICKER_LABELS.style),
            fill: tInterpretationNetwork('cellStyle.fill', DEFAULT_CELL_STYLE_PICKER_LABELS.fill),
            ...labels,
            borders: {
                top: tInterpretationNetwork('cellStyle.borderTop', DEFAULT_CELL_STYLE_PICKER_LABELS.borders.top),
                right: tInterpretationNetwork('cellStyle.borderRight', DEFAULT_CELL_STYLE_PICKER_LABELS.borders.right),
                bottom: tInterpretationNetwork('cellStyle.borderBottom', DEFAULT_CELL_STYLE_PICKER_LABELS.borders.bottom),
                left: tInterpretationNetwork('cellStyle.borderLeft', DEFAULT_CELL_STYLE_PICKER_LABELS.borders.left),
                ...labels?.borders
            },
            colorLabels: {
                ...Object.fromEntries(
                    INTERPRETATION_NETWORK_CELL_COLOR_PRESET_CODENAMES.map((color) => [
                        color,
                        tInterpretationNetwork(`cellStyle.colors.${color}`, DEFAULT_CELL_STYLE_PICKER_LABELS.colorLabels[color])
                    ])
                ),
                ...labels?.colorLabels
            } as Record<InterpretationNetworkCellColorPresetCodename, string>,
            lineStyleLabels: {
                solid: tInterpretationNetwork('cellStyle.lineStyles.solid', DEFAULT_CELL_STYLE_PICKER_LABELS.lineStyleLabels.solid),
                dashed: tInterpretationNetwork('cellStyle.lineStyles.dashed', DEFAULT_CELL_STYLE_PICKER_LABELS.lineStyleLabels.dashed),
                dotted: tInterpretationNetwork('cellStyle.lineStyles.dotted', DEFAULT_CELL_STYLE_PICKER_LABELS.lineStyleLabels.dotted),
                double: tInterpretationNetwork('cellStyle.lineStyles.double', DEFAULT_CELL_STYLE_PICKER_LABELS.lineStyleLabels.double),
                none: tInterpretationNetwork('cellStyle.lineStyles.none', DEFAULT_CELL_STYLE_PICKER_LABELS.lineStyleLabels.none),
                ...labels?.lineStyleLabels
            }
        }),
        [labels, tInterpretationNetwork]
    )
    const target = useMemo(() => readCellStyleTarget(field), [field])
    const valueKind = useMemo(() => readCellStyleValueKind(field), [field])
    const stateValue = useMemo(() => (valueKind === 'color' ? resolveColorCodename(value, field) : value), [field, value, valueKind])
    const state = useMemo(() => readCellStyleState(stateValue, target, valueKind), [stateValue, target, valueKind])
    const border = target === FILL_SIDE ? null : state.borders[target]
    const showColorPicker = valueKind === 'color'
    const showWidthPicker = valueKind === 'width' && Boolean(border)
    const showStylePicker = valueKind === 'lineStyle' && Boolean(border)

    const handleColorClick = (color: InterpretationNetworkCellColorPresetCodename) => {
        if (disabled || !showColorPicker) return
        const next = updateCellStyleValue(state, target, color)
        if (target === FILL_SIDE) {
            onChange(encodeColorValue(next.fill, field))
            return
        }
        const sideBorder = next.borders[target]
        onChange(encodeColorValue(sideBorder.color, field))
    }

    const handleWidthChange = (event: SelectChangeEvent<string>) => {
        if (disabled || !border || !showWidthPicker) return
        const width = event.target.value as InterpretationNetworkCellStyleBorder['width']
        const next = updateCellStyleWidth(state, target, width)
        if (target === FILL_SIDE) return
        const sideBorder = next.borders[target]
        onChange(sideBorder.width)
    }

    const handleStyleChange = (event: SelectChangeEvent<string>) => {
        if (disabled || !border || !showStylePicker) return
        const style = event.target.value as InterpretationNetworkCellStyleBorder['style']
        const next = updateCellStyleLine(state, target, style)
        if (target === FILL_SIDE) return
        const sideBorder = next.borders[target]
        onChange(sideBorder.style)
    }

    const colorLabel = (color: InterpretationNetworkCellColorPresetCodename) => resolvedLabels.colorLabels[color] ?? color

    const targetLabel = target === FILL_SIDE ? resolvedLabels.fill : resolvedLabels.borders[target]

    return (
        <Stack spacing={1.5} data-testid={`cell-style-picker-${field.id}`}>
            <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap'>
                <Typography variant='body2' color='text.secondary' sx={{ minWidth: 64 }}>
                    {resolvedLabels.preview}
                </Typography>
                <Box sx={buildPreviewSx(state)} data-testid={`cell-style-picker-${field.id}-preview`} data-cell-style-target={target} />
            </Stack>

            {showColorPicker ? (
                <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                    <Typography variant='body2' sx={{ minWidth: 80 }}>
                        {targetLabel} · {resolvedLabels.color}
                    </Typography>
                    {INTERPRETATION_NETWORK_CELL_COLOR_PRESET_CODENAMES.map((color) => {
                        const hex = interpretationNetworkColorToHex(color)
                        const active = isColorChipActive(target, state, color)
                        return (
                            <Box
                                key={color}
                                role='button'
                                tabIndex={disabled ? -1 : 0}
                                aria-label={`${targetLabel} ${colorLabel(color)}`}
                                aria-pressed={active}
                                data-color={color}
                                onClick={() => handleColorClick(color)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        handleColorClick(color)
                                    }
                                }}
                                sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    bgcolor: hex ?? 'background.paper',
                                    border: '2px solid',
                                    borderColor: active ? 'primary.main' : 'divider',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    opacity: disabled ? 0.5 : 1,
                                    position: 'relative',
                                    '&:focus-visible': {
                                        outline: '2px solid',
                                        outlineColor: 'primary.main',
                                        outlineOffset: 2
                                    }
                                }}
                            />
                        )
                    })}
                </Stack>
            ) : null}

            {showWidthPicker && border ? (
                <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap'>
                    <FormControl size='small' sx={{ minWidth: 120 }} disabled={disabled}>
                        <InputLabel id={`${field.id}-width-label`}>{`${targetLabel} · ${resolvedLabels.width}`}</InputLabel>
                        <Select<string>
                            labelId={`${field.id}-width-label`}
                            value={border.width}
                            label={`${targetLabel} · ${resolvedLabels.width}`}
                            onChange={handleWidthChange}
                            inputProps={{ 'data-testid': `cell-style-picker-${field.id}-width` }}
                        >
                            {INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS.map((width) => (
                                <MenuItem key={width} value={width}>
                                    {width}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            ) : null}

            {showStylePicker && border ? (
                <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap'>
                    <FormControl size='small' sx={{ minWidth: 120 }} disabled={disabled}>
                        <InputLabel id={`${field.id}-style-label`}>{`${targetLabel} · ${resolvedLabels.style}`}</InputLabel>
                        <Select<string>
                            labelId={`${field.id}-style-label`}
                            value={border.style}
                            label={`${targetLabel} · ${resolvedLabels.style}`}
                            onChange={handleStyleChange}
                            inputProps={{ 'data-testid': `cell-style-picker-${field.id}-style` }}
                        >
                            {INTERPRETATION_NETWORK_CELL_STYLE_STYLES.map((style) => (
                                <MenuItem key={style} value={style}>
                                    {resolvedLabels.lineStyleLabels[style]}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            ) : null}

            <FormHelperText error={Boolean(error)}>{error ?? helperText ?? resolvedLabels.helper}</FormHelperText>
        </Stack>
    )
}
