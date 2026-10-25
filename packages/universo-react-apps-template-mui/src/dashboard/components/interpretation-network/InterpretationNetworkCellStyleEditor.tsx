import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type { TFunction } from 'i18next'
import {
    calculateInterpretationNetworkContrastRatio,
    normalizeInterpretationNetworkCellStylePolicy,
    parseInterpretationNetworkHexColor,
    resolveInterpretationNetworkMaximumContrastForeground
} from '@universo-react/types'
import type { InterpretationNetworkCellStylePolicy } from '@universo-react/types'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'
import { HexColorField } from '../../../components/forms/HexColorField'

const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const
const PRESET_COLOR_KEYS: Record<string, string> = {
    '#000000': 'black',
    '#FFFFFF': 'white',
    '#E53935': 'red',
    '#FB8C00': 'orange',
    '#FDD835': 'yellow',
    '#43A047': 'green',
    '#00897B': 'teal',
    '#1E88E5': 'blue',
    '#3949AB': 'indigo',
    '#8E24AA': 'purple'
}
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
    policy: policyInput,
    resetKey = 0,
    validationErrors = {},
    themePaper = '#FFFFFF',
    onChange
}: {
    t: TFunction<'interpretationNetwork'>
    fields: FieldConfig[]
    draft: Record<string, unknown>
    disabled: boolean
    policy?: InterpretationNetworkCellStylePolicy
    resetKey?: string | number
    validationErrors?: Record<string, string>
    themePaper?: string
    onChange: (field: FieldConfig, value: unknown) => void
}) {
    const policy = normalizeInterpretationNetworkCellStylePolicy(policyInput)
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
        // The editor mode is initialized when a dialog draft is opened or reset.
        // Do not derive it from every draft update: an intentional per-side edit
        // must stay visible even after the sides become equal.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey])

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
        if (!policy.allowCustomColors && !policy.allowedColors.includes(color)) {
            setColorErrors((current) => ({
                ...current,
                [field.id]: t('cellStyle.colorNotAllowed', 'Choose one of the allowed colors.')
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

    const renderColorControl = (
        label: string,
        field: FieldConfig | undefined,
        targets: FieldConfig[] = [],
        category: keyof InterpretationNetworkCellStylePolicy['editable']
    ) => {
        if (!field) return null
        const current = parseInterpretationNetworkHexColor(fieldValue(draft, field))
        const colorError = colorErrors[field.id] || validationErrors[field.id]
        const fieldDisabled = disabled || !policy.editable[category]
        return (
            <Stack spacing={0.75} key={field.id}>
                <Typography component='label' htmlFor={`${field.id}-hex`} variant='subtitle2'>
                    {label}
                </Typography>
                <Stack direction='row' spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    {policy.allowCustomColors ? (
                        <HexColorField
                            id={`${field.id}-hex`}
                            label={t('cellStyle.hexColorField', {
                                defaultValue: '{{label}} Hex color',
                                label
                            })}
                            pickerLabel={t('cellStyle.colorPicker', { defaultValue: '{{label}} color picker', label })}
                            value={typeof fieldValue(draft, field) === 'string' ? String(fieldValue(draft, field)) : ''}
                            disabled={fieldDisabled}
                            error={Boolean(colorError)}
                            helperText={colorError}
                            onChange={(value) => updateColor(field, value, targets)}
                        />
                    ) : null}
                    <Button
                        type='button'
                        size='small'
                        color='inherit'
                        disabled={fieldDisabled}
                        onClick={() => updateColor(field, null, targets)}
                    >
                        {t('cellStyle.clear', 'Clear')}
                    </Button>
                </Stack>
                {policy.allowedColors.length > 0 ? (
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
                        {policy.allowedColors.map((color) => (
                            <ToggleButton
                                key={color}
                                value={color}
                                aria-label={
                                    PRESET_COLOR_KEYS[color]
                                        ? t(`cellStyle.colors.${PRESET_COLOR_KEYS[color]}`, PRESET_COLOR_KEYS[color])
                                        : t('cellStyle.allowedColor', { defaultValue: '{{color}}', color })
                                }
                                disabled={fieldDisabled}
                            >
                                <Box
                                    aria-hidden
                                    sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: color, border: 1, borderColor: 'divider' }}
                                />
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                ) : (
                    <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                        {t('cellStyle.noAllowedColors', 'No preset colors are available.')}
                    </Typography>
                )}
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
                {renderColorControl(label, colorField, allOtherColorFields, 'borderColor')}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <FormControl size='small' fullWidth>
                        <InputLabel id={`${fieldId(colorField)}-${side ?? 'all'}-width-label`}>{t('cellStyle.width', 'Width')}</InputLabel>
                        <Select
                            labelId={`${fieldId(colorField)}-${side ?? 'all'}-width-label`}
                            label={t('cellStyle.width', 'Width')}
                            value={isValidBorderWidth(width) ? width : '1px'}
                            disabled={disabled || !policy.editable.borderWidth}
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
                            disabled={disabled || !policy.editable.borderStyle}
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
            {renderColorControl(t('cellStyle.fill', 'Fill'), fieldMap.fill, [], 'fillColor')}
            {renderColorControl(t('cellStyle.textColor', 'Text color'), fieldMap.text, [], 'textColor')}
            {contrastError && styleErrors.length === 0 ? (
                <Typography
                    role='status'
                    variant='body2'
                    sx={{
                        color: 'warning.main'
                    }}
                >
                    {t('cellStyle.contrastWarning', 'This text and fill combination may be difficult to read. You can still save it.')}
                </Typography>
            ) : null}
            {!contrastError && styleErrors.length > 0 ? (
                <Typography
                    role='alert'
                    variant='body2'
                    sx={{
                        color: 'error.main'
                    }}
                >
                    {styleErrors[0]}
                </Typography>
            ) : null}
            {hasBorderFields ? (
                <>
                    <Divider />
                    <Stack direction='row' spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
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
