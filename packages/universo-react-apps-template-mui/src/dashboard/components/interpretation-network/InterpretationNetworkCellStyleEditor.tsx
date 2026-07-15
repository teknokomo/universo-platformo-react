import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type { TFunction } from 'i18next'
import {
    calculateInterpretationNetworkContrastRatio,
    parseInterpretationNetworkHexColor,
    resolveInterpretationNetworkMaximumContrastForeground
} from '@universo-react/types'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'

const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const
const PRESET_COLORS = ['#000000', '#FFFFFF', '#E53935', '#FB8C00', '#FDD835', '#43A047', '#00897B', '#1E88E5', '#3949AB', '#8E24AA']
const PRESET_COLOR_KEYS = ['black', 'white', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple'] as const
const BORDER_WIDTHS = ['0', '1px', '2px', '3px', '4px']
const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double', 'none']

type StyleFieldMap = Partial<
    Record<
        | 'fill'
        | 'text'
        | 'topColor'
        | 'rightColor'
        | 'bottomColor'
        | 'leftColor'
        | 'topWidth'
        | 'rightWidth'
        | 'bottomWidth'
        | 'leftWidth'
        | 'topStyle'
        | 'rightStyle'
        | 'bottomStyle'
        | 'leftStyle',
        FieldConfig
    >
>

const keyFor = (side: (typeof SIDES)[number], suffix: 'Color' | 'Width' | 'Style') =>
    `${side.toLowerCase()}${suffix}` as keyof StyleFieldMap

const fieldValue = (draft: Record<string, unknown>, field: FieldConfig | undefined): unknown => (field ? draft[field.id] : undefined)

const isValidBorderWidth = (value: unknown): value is string => typeof value === 'string' && BORDER_WIDTHS.includes(value)
const isValidBorderStyle = (value: unknown): value is string => typeof value === 'string' && BORDER_STYLES.includes(value)

const colorFieldKey = (codename: string): keyof StyleFieldMap | null => {
    switch (codename) {
        case 'CellFillColor':
            return 'fill'
        case 'TextColor':
            return 'text'
        case 'BorderTopColor':
            return 'topColor'
        case 'BorderRightColor':
            return 'rightColor'
        case 'BorderBottomColor':
            return 'bottomColor'
        case 'BorderLeftColor':
            return 'leftColor'
        case 'BorderTopWidth':
            return 'topWidth'
        case 'BorderRightWidth':
            return 'rightWidth'
        case 'BorderBottomWidth':
            return 'bottomWidth'
        case 'BorderLeftWidth':
            return 'leftWidth'
        case 'BorderTopStyle':
            return 'topStyle'
        case 'BorderRightStyle':
            return 'rightStyle'
        case 'BorderBottomStyle':
            return 'bottomStyle'
        case 'BorderLeftStyle':
            return 'leftStyle'
        default:
            return null
    }
}

const toFieldMap = (fields: FieldConfig[]): StyleFieldMap =>
    fields.reduce<StyleFieldMap>((result, field) => {
        const key = colorFieldKey(field.codename ?? field.id)
        if (key) result[key] = field
        return result
    }, {})

const fieldId = (field: FieldConfig | undefined): string => field?.id ?? ''

export function InterpretationNetworkCellStyleEditor({
    t,
    fields,
    draft,
    disabled,
    resetKey = 0,
    validationErrors = {},
    themePaper = '#FFFFFF',
    onChange
}: {
    t: TFunction<'interpretationNetwork'>
    fields: FieldConfig[]
    draft: Record<string, unknown>
    disabled: boolean
    resetKey?: string | number
    validationErrors?: Record<string, string>
    themePaper?: string
    onChange: (field: FieldConfig, value: unknown) => void
}) {
    const fieldMap = useMemo(() => toFieldMap(fields), [fields])
    const hasBorderFields = SIDES.some(
        (side) => fieldMap[keyFor(side, 'Color')] || fieldMap[keyFor(side, 'Width')] || fieldMap[keyFor(side, 'Style')]
    )
    const firstSide = SIDES[0]
    const firstBorderValues = {
        color: fieldValue(draft, fieldMap[keyFor(firstSide, 'Color')]),
        width: fieldValue(draft, fieldMap[keyFor(firstSide, 'Width')]),
        style: fieldValue(draft, fieldMap[keyFor(firstSide, 'Style')])
    }
    const bordersDiffer = SIDES.slice(1).some(
        (side) =>
            fieldValue(draft, fieldMap[keyFor(side, 'Color')]) !== firstBorderValues.color ||
            fieldValue(draft, fieldMap[keyFor(side, 'Width')]) !== firstBorderValues.width ||
            fieldValue(draft, fieldMap[keyFor(side, 'Style')]) !== firstBorderValues.style
    )
    const [advanced, setAdvanced] = useState(false)
    const [colorErrors, setColorErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        setAdvanced(bordersDiffer)
        setColorErrors({})
    }, [bordersDiffer, resetKey])

    const updateColor = (field: FieldConfig | undefined, value: unknown, targets: FieldConfig[] = []) => {
        if (!field) return
        if (value === null || value === '') {
            onChange(field, null)
            targets.forEach((target) => onChange(target, null))
            setColorErrors((current) => {
                const next = { ...current }
                delete next[field.id]
                targets.forEach((target) => delete next[target.id])
                return next
            })
            return
        }
        const color = parseInterpretationNetworkHexColor(value)
        if (!color) {
            setColorErrors((current) => ({
                ...current,
                [field.id]: t('cellStyle.invalidColor', 'Enter a hexadecimal color such as #1E88E5.')
            }))
            return
        }
        onChange(field, color)
        targets.forEach((target) => onChange(target, color))
        setColorErrors((current) => {
            const next = { ...current }
            delete next[field.id]
            targets.forEach((target) => delete next[target.id])
            return next
        })
    }

    const updateBorderValue = (suffix: 'Width' | 'Style', value: string, side?: (typeof SIDES)[number]) => {
        const targetSides = side ? [side] : [...SIDES]
        targetSides.forEach((targetSide) => {
            const field = fieldMap[keyFor(targetSide, suffix)]
            if (field) onChange(field, value)
        })
    }

    const fill = parseInterpretationNetworkHexColor(fieldValue(draft, fieldMap.fill))
    const text = parseInterpretationNetworkHexColor(fieldValue(draft, fieldMap.text))
    const contrastBackground = fill ?? parseInterpretationNetworkHexColor(themePaper)
    const contrastForeground = text ?? (fill ? resolveInterpretationNetworkMaximumContrastForeground(fill) : null)
    const contrast =
        contrastBackground && contrastForeground
            ? calculateInterpretationNetworkContrastRatio(contrastForeground, contrastBackground)
            : null
    const contrastError = Boolean(text && contrast !== null && contrast < 4.5)
    const styleErrors = Object.values(validationErrors).filter(Boolean)

    const renderColorControl = (label: string, field: FieldConfig | undefined, targets: FieldConfig[] = []) => {
        if (!field) return null
        const current = parseInterpretationNetworkHexColor(fieldValue(draft, field))
        return (
            <Stack spacing={0.75} key={field.id}>
                <Typography component='label' htmlFor={`${field.id}-hex`} variant='subtitle2'>
                    {label}
                </Typography>
                <Stack direction='row' spacing={1} alignItems='center' useFlexGap flexWrap='wrap'>
                    <Box
                        component='input'
                        id={`${field.id}-picker`}
                        type='color'
                        aria-label={t('cellStyle.colorPicker', { defaultValue: '{{label}} color picker', label })}
                        value={current ?? '#000000'}
                        disabled={disabled}
                        onChange={(event) => updateColor(field, event.target.value, targets)}
                        sx={{ width: 36, height: 36, p: 0, border: 0, bgcolor: 'transparent', cursor: disabled ? 'default' : 'pointer' }}
                    />
                    <TextField
                        id={`${field.id}-hex`}
                        value={typeof fieldValue(draft, field) === 'string' ? fieldValue(draft, field) : ''}
                        label={t('cellStyle.hex', 'Hex color')}
                        inputProps={{
                            maxLength: 7,
                            spellCheck: false,
                            'aria-describedby': colorErrors[field.id] || validationErrors[field.id] ? `${field.id}-error` : undefined
                        }}
                        size='small'
                        disabled={disabled}
                        error={Boolean(colorErrors[field.id] || validationErrors[field.id])}
                        onChange={(event) => {
                            const value = event.target.value
                            onChange(field, value)
                            targets.forEach((target) => onChange(target, value))
                        }}
                        onBlur={(event) => updateColor(field, event.target.value, targets)}
                    />
                    <Button
                        type='button'
                        size='small'
                        color='inherit'
                        disabled={disabled}
                        onClick={() => updateColor(field, null, targets)}
                    >
                        {t('cellStyle.clear', 'Clear')}
                    </Button>
                </Stack>
                <ToggleButtonGroup
                    exclusive
                    size='small'
                    value={current ?? ''}
                    aria-label={t('cellStyle.presetColors', { defaultValue: '{{label}} preset colors', label })}
                    onChange={(_event, next: string | null) => {
                        if (next) updateColor(field, next, targets)
                    }}
                    sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { minWidth: 32, width: 32, height: 32, p: 0 } }}
                >
                    {PRESET_COLORS.map((color, index) => (
                        <ToggleButton
                            key={color}
                            value={color}
                            aria-label={t(`cellStyle.colors.${PRESET_COLOR_KEYS[index]}`, PRESET_COLOR_KEYS[index])}
                            disabled={disabled}
                        >
                            <Box
                                aria-hidden
                                sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: color, border: 1, borderColor: 'divider' }}
                            />
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
                {colorErrors[field.id] || validationErrors[field.id] ? (
                    <Typography id={`${field.id}-error`} role='alert' color='error.main' variant='caption'>
                        {colorErrors[field.id] ?? validationErrors[field.id]}
                    </Typography>
                ) : null}
            </Stack>
        )
    }

    const renderBorderControls = (label: string, side?: (typeof SIDES)[number]) => {
        const colorField = fieldMap[side ? keyFor(side, 'Color') : keyFor(firstSide, 'Color')]
        const allOtherColorFields = side
            ? []
            : SIDES.slice(1)
                  .map((targetSide) => fieldMap[keyFor(targetSide, 'Color')])
                  .filter((field): field is FieldConfig => Boolean(field))
        const width = fieldValue(draft, fieldMap[side ? keyFor(side, 'Width') : keyFor(firstSide, 'Width')])
        const style = fieldValue(draft, fieldMap[side ? keyFor(side, 'Style') : keyFor(firstSide, 'Style')])
        return (
            <Stack key={side ?? 'all'} spacing={1} sx={{ minWidth: 0 }}>
                {renderColorControl(label, colorField, allOtherColorFields)}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <FormControl size='small' fullWidth>
                        <InputLabel id={`${fieldId(colorField)}-${side ?? 'all'}-width-label`}>{t('cellStyle.width', 'Width')}</InputLabel>
                        <Select
                            labelId={`${fieldId(colorField)}-${side ?? 'all'}-width-label`}
                            label={t('cellStyle.width', 'Width')}
                            value={isValidBorderWidth(width) ? width : '1px'}
                            disabled={disabled}
                            onChange={(event) => updateBorderValue('Width', event.target.value, side)}
                        >
                            {BORDER_WIDTHS.map((value) => (
                                <MenuItem key={value} value={value}>
                                    {value}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size='small' fullWidth>
                        <InputLabel id={`${fieldId(colorField)}-${side ?? 'all'}-style-label`}>{t('cellStyle.style', 'Style')}</InputLabel>
                        <Select
                            labelId={`${fieldId(colorField)}-${side ?? 'all'}-style-label`}
                            label={t('cellStyle.style', 'Style')}
                            value={isValidBorderStyle(style) ? style : 'solid'}
                            disabled={disabled}
                            onChange={(event) => updateBorderValue('Style', event.target.value, side)}
                        >
                            {BORDER_STYLES.map((value) => (
                                <MenuItem key={value} value={value}>
                                    {t(`cellStyle.lineStyles.${value}`, value)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </Stack>
        )
    }

    return (
        <Stack spacing={2} data-testid='interpretation-network-cell-style-editor'>
            {renderColorControl(t('cellStyle.fill', 'Fill'), fieldMap.fill)}
            {renderColorControl(t('cellStyle.textColor', 'Text color'), fieldMap.text)}
            {contrastError && styleErrors.length === 0 ? (
                <Typography role='status' color='warning.main' variant='body2'>
                    {t('cellStyle.contrastWarning', 'This text and fill combination may be difficult to read. You can still save it.')}
                </Typography>
            ) : null}
            {!contrastError && styleErrors.length > 0 ? (
                <Typography role='alert' color='error.main' variant='body2'>
                    {styleErrors[0]}
                </Typography>
            ) : null}
            {hasBorderFields ? (
                <>
                    <Divider />
                    <Stack direction='row' alignItems='center' justifyContent='space-between' spacing={1}>
                        <Typography variant='subtitle1'>{t('cellStyle.border', 'Border')}</Typography>
                        <Button
                            type='button'
                            size='small'
                            color='inherit'
                            onClick={() => setAdvanced((value) => !value)}
                            disabled={disabled}
                        >
                            {advanced
                                ? t('cellStyle.editAllSides', 'Edit all sides together')
                                : t('cellStyle.editSidesSeparately', 'Edit sides separately')}
                        </Button>
                    </Stack>
                    {advanced ? (
                        <Stack spacing={2} divider={<Divider flexItem />}>
                            {SIDES.map((side) => renderBorderControls(t(`cellStyle.border${side}`, side), side))}
                        </Stack>
                    ) : (
                        renderBorderControls(t('cellStyle.allBorders', 'All borders'))
                    )}
                </>
            ) : null}
        </Stack>
    )
}
