import { useMemo } from 'react'
import { Box, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Select, Stack, Switch, TextField } from '@mui/material'
import { CollapsibleSection, LocalizedInlineField, useCodenameAutoFillVlc } from '@universo/template-mui'
import type { ConstantDataType, VersionedLocalizedContent } from '@universo/types'
import { NUMBER_DEFAULTS, toNumberRules, validateNumber } from '@universo/utils'
import { CodenameField } from '../../../components'
import { sanitizeCodenameForStyle } from '../../../utils/codename'
import { ensureLocalizedContent, normalizeLocale } from '../../../utils/localizedInput'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'

type GenericFormValues = Record<string, unknown>

const DEFAULT_STRING_MAX_LENGTH = 10

export const ensureConstantValidationRules = (
    dataType: ConstantDataType,
    rules: Record<string, unknown> | undefined
): Record<string, unknown> => {
    const base = { ...(rules ?? {}) }

    if (dataType === 'STRING') {
        if (typeof base.maxLength !== 'number' || base.maxLength <= 0) {
            base.maxLength = DEFAULT_STRING_MAX_LENGTH
        }
        if (typeof base.localized !== 'boolean') {
            base.localized = false
        }
        if (typeof base.versioned !== 'boolean') {
            base.versioned = false
        }
    }

    if (dataType === 'NUMBER') {
        if (typeof base.precision !== 'number' || base.precision <= 0) {
            base.precision = 10
        }
        if (typeof base.scale !== 'number' || base.scale < 0) {
            base.scale = 0
        }
        if (typeof base.nonNegative !== 'boolean') {
            base.nonNegative = false
        }
    }

    if (dataType === 'DATE' && typeof base.dateComposition !== 'string') {
        base.dateComposition = 'datetime'
    }

    return base
}

export type ConstantGeneralFieldsProps = {
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    errors: Record<string, string>
    uiLocale: string
    labels: {
        name: string
        codename: string
        codenameHelper: string
        dataType: string
        typeSettings: string
        dataTypeOptions: {
            string: string
            number: string
            boolean: string
            date: string
        }
        stringMinLength: string
        stringMaxLength: string
        stringLocalized: string
        stringVersioned: string
        numberPrecision: string
        numberScale: string
        numberMin: string
        numberMax: string
        numberNonNegative: string
        dateComposition: string
        dateCompositionOptions: {
            date: string
            time: string
            datetime: string
        }
    }
    dataTypeDisabled?: boolean
}

export const ConstantGeneralFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    labels,
    dataTypeDisabled = false
}: ConstantGeneralFieldsProps) => {
    const codenameConfig = useCodenameConfig()
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codenameTouched = Boolean(values.codenameTouched)
    const dataType = (values.dataType as ConstantDataType | undefined) ?? 'STRING'

    const validationRules = useMemo(
        () => ensureConstantValidationRules(dataType, values.validationRules as Record<string, unknown> | undefined),
        [dataType, values.validationRules]
    )

    useCodenameAutoFillVlc({
        codename,
        codenameTouched,
        nameVlc,
        deriveCodename: (nameContent) =>
            sanitizeCodenameForStyle(
                nameContent,
                codenameConfig.style,
                codenameConfig.alphabet,
                codenameConfig.allowMixed,
                codenameConfig.autoConvertMixedAlphabets
            ),
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: VersionedLocalizedContent<string> | null | boolean) => void
    })

    const updateValidationRule = (key: string, value: unknown): void => {
        setValue('validationRules', { ...validationRules, [key]: value })
    }

    return (
        <Stack spacing={2}>
            <LocalizedInlineField
                mode='localized'
                label={labels.name}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next) => setValue('nameVlc', next)}
                error={errors.nameVlc || null}
                helperText={errors.nameVlc}
                uiLocale={uiLocale}
            />

            <FormControl fullWidth disabled={isLoading || dataTypeDisabled}>
                <InputLabel id='constant-data-type-label'>{labels.dataType}</InputLabel>
                <Select
                    labelId='constant-data-type-label'
                    label={labels.dataType}
                    value={dataType}
                    onChange={(event) => {
                        const nextType = event.target.value as ConstantDataType
                        setValue('dataType', nextType)
                        setValue('validationRules', ensureConstantValidationRules(nextType, undefined))
                        setValue('value', null)
                    }}
                >
                    <MenuItem value='STRING'>{labels.dataTypeOptions.string}</MenuItem>
                    <MenuItem value='NUMBER'>{labels.dataTypeOptions.number}</MenuItem>
                    <MenuItem value='BOOLEAN'>{labels.dataTypeOptions.boolean}</MenuItem>
                    <MenuItem value='DATE'>{labels.dataTypeOptions.date}</MenuItem>
                </Select>
            </FormControl>

            {(dataType === 'STRING' || dataType === 'NUMBER' || dataType === 'DATE') && (
                <CollapsibleSection label={labels.typeSettings} defaultOpen={false}>
                    <Box sx={{ pl: 2 }}>
                        {dataType === 'STRING' && (
                            <Stack spacing={1.5}>
                                <Stack direction='row' spacing={1.5}>
                                    <TextField
                                        label={labels.stringMinLength}
                                        type='number'
                                        size='small'
                                        fullWidth
                                        value={typeof validationRules.minLength === 'number' ? validationRules.minLength : ''}
                                        onChange={(e) => updateValidationRule('minLength', e.target.value ? Number(e.target.value) : null)}
                                        inputProps={{ min: 0 }}
                                    />
                                    <TextField
                                        label={labels.stringMaxLength}
                                        type='number'
                                        size='small'
                                        fullWidth
                                        value={typeof validationRules.maxLength === 'number' ? validationRules.maxLength : ''}
                                        onChange={(e) => updateValidationRule('maxLength', e.target.value ? Number(e.target.value) : null)}
                                        inputProps={{ min: 1 }}
                                    />
                                </Stack>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={Boolean(validationRules.versioned)}
                                            onChange={(e) => updateValidationRule('versioned', e.target.checked)}
                                        />
                                    }
                                    label={labels.stringVersioned}
                                    disabled={isLoading}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={Boolean(validationRules.localized)}
                                            onChange={(e) => updateValidationRule('localized', e.target.checked)}
                                        />
                                    }
                                    label={labels.stringLocalized}
                                    disabled={isLoading}
                                />
                            </Stack>
                        )}

                        {dataType === 'NUMBER' && (
                            <Stack spacing={1.5}>
                                <Stack direction='row' spacing={1.5}>
                                    <TextField
                                        label={labels.numberPrecision}
                                        type='number'
                                        size='small'
                                        fullWidth
                                        value={typeof validationRules.precision === 'number' ? validationRules.precision : 10}
                                        onChange={(e) => updateValidationRule('precision', e.target.value ? Number(e.target.value) : 10)}
                                        inputProps={{ min: 1, max: 15 }}
                                    />
                                    <TextField
                                        label={labels.numberScale}
                                        type='number'
                                        size='small'
                                        fullWidth
                                        value={typeof validationRules.scale === 'number' ? validationRules.scale : 0}
                                        onChange={(e) => updateValidationRule('scale', e.target.value ? Number(e.target.value) : 0)}
                                        inputProps={{ min: 0, max: 14 }}
                                    />
                                </Stack>
                                <Stack direction='row' spacing={1.5}>
                                    <TextField
                                        label={labels.numberMin}
                                        type='number'
                                        size='small'
                                        fullWidth
                                        value={typeof validationRules.min === 'number' ? validationRules.min : ''}
                                        onChange={(e) => updateValidationRule('min', e.target.value ? Number(e.target.value) : null)}
                                    />
                                    <TextField
                                        label={labels.numberMax}
                                        type='number'
                                        size='small'
                                        fullWidth
                                        value={typeof validationRules.max === 'number' ? validationRules.max : ''}
                                        onChange={(e) => updateValidationRule('max', e.target.value ? Number(e.target.value) : null)}
                                    />
                                </Stack>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={Boolean(validationRules.nonNegative)}
                                            onChange={(e) => updateValidationRule('nonNegative', e.target.checked)}
                                        />
                                    }
                                    label={labels.numberNonNegative}
                                    disabled={isLoading}
                                />
                            </Stack>
                        )}

                        {dataType === 'DATE' && (
                            <FormControl fullWidth size='small' disabled={isLoading}>
                                <InputLabel id='constant-date-composition-label'>{labels.dateComposition}</InputLabel>
                                <Select
                                    labelId='constant-date-composition-label'
                                    label={labels.dateComposition}
                                    value={
                                        typeof validationRules.dateComposition === 'string' ? validationRules.dateComposition : 'datetime'
                                    }
                                    onChange={(event) => updateValidationRule('dateComposition', event.target.value)}
                                >
                                    <MenuItem value='date'>{labels.dateCompositionOptions.date}</MenuItem>
                                    <MenuItem value='time'>{labels.dateCompositionOptions.time}</MenuItem>
                                    <MenuItem value='datetime'>{labels.dateCompositionOptions.datetime}</MenuItem>
                                </Select>
                            </FormControl>
                        )}
                    </Box>
                </CollapsibleSection>
            )}

            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched) => setValue('codenameTouched', touched)}
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                uiLocale={uiLocale}
                label={labels.codename}
                helperText={labels.codenameHelper}
                error={errors.codename}
                disabled={isLoading}
                required
                editingEntityId={(values._editingEntityId as string | undefined) ?? null}
            />
        </Stack>
    )
}

export type ConstantValueFieldsProps = {
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    uiLocale: string
    error?: string | null
    helperText?: string
    labels: {
        value: string
        valueLocalized: string
        boolTrue: string
        boolFalse: string
    }
}

export const ConstantValueFields = ({ values, setValue, isLoading, uiLocale, error, helperText, labels }: ConstantValueFieldsProps) => {
    const dataType = (values.dataType as ConstantDataType | undefined) ?? 'STRING'
    const validationRules = ensureConstantValidationRules(dataType, values.validationRules as Record<string, unknown> | undefined)
    const localized = dataType === 'STRING' && validationRules.localized === true
    const value = values.value
    const maxStringLength = typeof validationRules.maxLength === 'number' ? validationRules.maxLength : undefined
    const minStringLength = typeof validationRules.minLength === 'number' ? validationRules.minLength : undefined

    if (dataType === 'STRING' && localized) {
        const localizedValue = ensureLocalizedContent(value as VersionedLocalizedContent<string> | string | null | undefined, uiLocale, '')
        return (
            <LocalizedInlineField
                mode='localized'
                label={labels.valueLocalized}
                disabled={isLoading}
                value={localizedValue}
                onChange={(next) => setValue('value', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
                error={error ?? null}
                helperText={error ?? helperText}
                maxLength={maxStringLength}
                minLength={minStringLength}
            />
        )
    }

    if (dataType === 'STRING') {
        return (
            <TextField
                label={labels.value}
                value={typeof value === 'string' ? value : ''}
                onChange={(event) => {
                    const nextValue = event.target.value
                    if (typeof maxStringLength === 'number' && nextValue.length > maxStringLength) return
                    setValue('value', nextValue)
                }}
                fullWidth
                multiline
                minRows={2}
                disabled={isLoading}
                error={Boolean(error)}
                helperText={error ?? helperText}
                inputProps={{
                    minLength: minStringLength ?? undefined,
                    maxLength: maxStringLength ?? undefined
                }}
            />
        )
    }

    if (dataType === 'NUMBER') {
        const numberRules = toNumberRules(validationRules)
        const precision = numberRules.precision ?? NUMBER_DEFAULTS.precision
        const scale = numberRules.scale ?? NUMBER_DEFAULTS.scale
        const maxIntegerDigits = Math.max(1, precision - scale)
        const allowNegative = !numberRules.nonNegative
        const decimalSeparator = normalizeLocale(uiLocale) === 'ru' ? ',' : '.'

        const formattedValue = (() => {
            if (typeof value === 'number' && Number.isFinite(value)) {
                if (scale > 0) return value.toFixed(scale).replace('.', decimalSeparator)
                return String(Math.trunc(value))
            }
            if (typeof value === 'string') return value
            return ''
        })()

        const constraints: string[] = []
        constraints.push(scale > 0 ? `${maxIntegerDigits},${scale}` : `${maxIntegerDigits}`)
        if (typeof numberRules.min === 'number' && typeof numberRules.max === 'number') {
            constraints.push(`${numberRules.min}–${numberRules.max}`)
        } else if (typeof numberRules.min === 'number') {
            constraints.push(`min ${numberRules.min}`)
        } else if (typeof numberRules.max === 'number') {
            constraints.push(`max ${numberRules.max}`)
        }
        if (numberRules.nonNegative) {
            constraints.push('>= 0')
        }

        return (
            <TextField
                label={labels.value}
                type='text'
                inputMode='decimal'
                value={formattedValue}
                onChange={(event) => {
                    const rawValue = event.target.value
                    if (rawValue === '' || rawValue === '-') {
                        setValue('value', null)
                        return
                    }

                    const normalizedValue = rawValue.replace(/,/g, '.')
                    const validPattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/
                    if (!validPattern.test(normalizedValue)) return

                    const isNegative = normalizedValue.startsWith('-')
                    const absValue = isNegative ? normalizedValue.slice(1) : normalizedValue
                    const [integerPart = '', decimalPart = ''] = absValue.split('.')
                    if (integerPart.length > maxIntegerDigits) return
                    if (decimalPart.length > scale) return

                    const parsed = Number.parseFloat(normalizedValue)
                    if (!Number.isFinite(parsed)) return

                    const result = validateNumber(parsed, numberRules)
                    if (!result.valid && result.errorKey !== 'belowMinimum' && result.errorKey !== 'aboveMaximum') return

                    setValue('value', parsed)
                }}
                onBlur={() => {
                    if (typeof value !== 'number' || !Number.isFinite(value)) return
                    let normalizedValue = Number(value)
                    if (scale >= 0) {
                        normalizedValue = Number(normalizedValue.toFixed(scale))
                    }
                    if (numberRules.nonNegative && normalizedValue < 0) {
                        normalizedValue = 0
                    }
                    if (typeof numberRules.min === 'number' && normalizedValue < numberRules.min) {
                        normalizedValue = numberRules.min
                    }
                    if (typeof numberRules.max === 'number' && normalizedValue > numberRules.max) {
                        normalizedValue = numberRules.max
                    }
                    if (validateNumber(normalizedValue, numberRules).valid) {
                        setValue('value', normalizedValue)
                    }
                }}
                fullWidth
                disabled={isLoading}
                error={Boolean(error)}
                helperText={error ?? helperText ?? constraints.join(', ')}
                inputProps={{ style: { textAlign: 'right' } }}
            />
        )
    }

    if (dataType === 'BOOLEAN') {
        return (
            <Stack spacing={0.5}>
                <FormControlLabel
                    control={<Switch checked={Boolean(value)} onChange={(_event, checked) => setValue('value', checked)} />}
                    label={value ? labels.boolTrue : labels.boolFalse}
                    disabled={isLoading}
                />
                {(error || helperText) && <FormHelperText error={Boolean(error)}>{error ?? helperText}</FormHelperText>}
            </Stack>
        )
    }

    const composition = typeof validationRules.dateComposition === 'string' ? validationRules.dateComposition : 'datetime'
    const dateInputType = composition === 'date' ? 'date' : composition === 'time' ? 'time' : 'datetime-local'
    const maxDateValue = composition === 'date' ? '9999-12-31' : composition === 'time' ? undefined : '9999-12-31T23:59'
    let dateValue = ''
    if (typeof value === 'string' && value.length > 0) {
        if (dateInputType === 'date') {
            dateValue = value.slice(0, 10)
        } else if (dateInputType === 'time') {
            dateValue = value.slice(11, 16)
        } else {
            const parsed = new Date(value)
            if (!Number.isNaN(parsed.getTime())) {
                const pad = (num: number) => String(num).padStart(2, '0')
                dateValue = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(
                    parsed.getMinutes()
                )}`
            }
        }
    }

    return (
        <TextField
            label={labels.value}
            type={dateInputType}
            value={dateValue}
            onChange={(event) => {
                const next = event.target.value
                if (!next) {
                    setValue('value', null)
                    return
                }
                if (dateInputType === 'date') {
                    setValue('value', `${next}T00:00:00.000Z`)
                    return
                }
                if (dateInputType === 'time') {
                    setValue('value', `1970-01-01T${next}:00.000Z`)
                    return
                }
                setValue('value', new Date(next).toISOString())
            }}
            fullWidth
            disabled={isLoading}
            InputLabelProps={{ shrink: true }}
            error={Boolean(error)}
            helperText={error ?? helperText}
            inputProps={{ max: maxDateValue }}
        />
    )
}

const ConstantFormFields = ConstantGeneralFields

export default ConstantFormFields
