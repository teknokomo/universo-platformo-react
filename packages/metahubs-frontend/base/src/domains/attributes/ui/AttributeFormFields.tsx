import { useState, useMemo, useCallback, useEffect } from 'react'
import {
    Box,
    Stack,
    Typography,
    Alert,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    TextField,
    Collapse,
    FormHelperText
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { useTranslation } from 'react-i18next'
import { LocalizedInlineField, useCodenameAutoFill } from '@universo/template-mui'
import type { VersionedLocalizedContent, AttributeDataType, MetaEntityKind } from '@universo/types'
import type { AttributeValidationRules } from '../../../types'
import { getDefaultValidationRules, getPhysicalDataType, formatPhysicalType, getVLCString } from '../../../types'
import { sanitizeCodename } from '../../../utils/codename'
import { normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField, TargetEntitySelector } from '../../../components'

export type AttributeFormFieldsProps = {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors?: Record<string, string>
    uiLocale: string
    nameLabel: string
    codenameLabel: string
    codenameHelper: string
    dataTypeLabel: string
    requiredLabel: string
    displayAttributeLabel: string
    displayAttributeHelper?: string
    displayAttributeLocked?: boolean
    dataTypeOptions: Array<{ value: AttributeDataType; label: string }>
    // Type settings labels
    typeSettingsLabel: string
    stringMaxLengthLabel: string
    stringMinLengthLabel: string
    stringVersionedLabel: string
    stringLocalizedLabel: string
    numberPrecisionLabel: string
    numberScaleLabel: string
    numberMinLabel: string
    numberMaxLabel: string
    numberNonNegativeLabel: string
    dateCompositionLabel: string
    dateCompositionOptions: Array<{ value: string; label: string }>
    // Physical type info
    physicalTypeLabel: string
    // REF type settings
    metahubId: string
    currentCatalogId?: string
    // Edit-mode controls
    dataTypeDisabled?: boolean
    dataTypeHelperText?: string
    disableVlcToggles?: boolean
}

const AttributeFormFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    codenameLabel,
    codenameHelper,
    dataTypeLabel,
    requiredLabel,
    displayAttributeLabel,
    displayAttributeHelper,
    displayAttributeLocked = false,
    dataTypeOptions,
    typeSettingsLabel,
    stringMaxLengthLabel,
    stringMinLengthLabel,
    stringVersionedLabel,
    stringLocalizedLabel,
    numberPrecisionLabel,
    numberScaleLabel,
    numberMinLabel,
    numberMaxLabel,
    numberNonNegativeLabel,
    dateCompositionLabel,
    dateCompositionOptions,
    physicalTypeLabel,
    metahubId,
    currentCatalogId,
    dataTypeDisabled = false,
    dataTypeHelperText,
    disableVlcToggles = false
}: AttributeFormFieldsProps) => {
    const { t } = useTranslation('metahubs')
    const [showTypeSettings, setShowTypeSettings] = useState(false)
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const dataType = (values.dataType as AttributeDataType | undefined) ?? 'STRING'
    const isRequired = Boolean(values.isRequired)
    const isDisplayAttribute = Boolean(values.isDisplayAttribute)
    const validationRules = (values.validationRules as AttributeValidationRules | undefined) ?? getDefaultValidationRules(dataType)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodename(nameValue)
    const fieldErrors = errors ?? {}

    // Compute physical PostgreSQL type info
    const physicalTypeInfo = useMemo(() => {
        const physicalInfo = getPhysicalDataType(dataType, validationRules)
        const physicalTypeStr = formatPhysicalType(physicalInfo)
        return { physicalInfo, physicalTypeStr }
    }, [dataType, validationRules])

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
    })

    // Helper to update nested validationRules
    const updateValidationRule = useCallback((key: string, value: any) => {
        setValue('validationRules', { ...validationRules, [key]: value })
    }, [setValue, validationRules])

    useEffect(() => {
        if (displayAttributeLocked && !isDisplayAttribute) {
            setValue('isDisplayAttribute', true)
        }
    }, [displayAttributeLocked, isDisplayAttribute, setValue])

    // Render type-specific settings
    const renderTypeSettings = () => {
        switch (dataType) {
            case 'STRING':
                return (
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label={stringMinLengthLabel}
                                type="number"
                                size="small"
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.minLength ?? ''}
                                onChange={(e) => updateValidationRule('minLength', e.target.value ? parseInt(e.target.value, 10) : null)}
                                inputProps={{ min: 0 }}
                            />
                            <TextField
                                label={stringMaxLengthLabel}
                                type="number"
                                size="small"
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.maxLength ?? ''}
                                onChange={(e) => updateValidationRule('maxLength', e.target.value ? parseInt(e.target.value, 10) : null)}
                                inputProps={{ min: 1 }}
                                helperText={
                                    validationRules.versioned || validationRules.localized
                                        ? t('attributes.typeSettings.string.backendType.jsonbVlc')
                                        : !validationRules.maxLength
                                        ? t('attributes.typeSettings.string.backendType.textUnlimited')
                                        : t('attributes.typeSettings.string.backendType.varchar', { maxLength: validationRules.maxLength })
                                }
                            />
                        </Stack>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(validationRules.versioned)}
                                    onChange={(e) => updateValidationRule('versioned', e.target.checked)}
                                    disabled={isLoading || disableVlcToggles}
                                />
                            }
                            label={stringVersionedLabel}
                            disabled={isLoading || disableVlcToggles}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(validationRules.localized)}
                                    onChange={(e) => updateValidationRule('localized', e.target.checked)}
                                    disabled={isLoading || disableVlcToggles}
                                />
                            }
                            label={stringLocalizedLabel}
                            disabled={isLoading || disableVlcToggles}
                        />
                    </Stack>
                )
            case 'NUMBER':
                return (
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label={numberPrecisionLabel}
                                type="number"
                                size="small"
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.precision ?? 10}
                                onChange={(e) => updateValidationRule('precision', e.target.value ? parseInt(e.target.value, 10) : 10)}
                                inputProps={{ min: 1, max: 15 }}
                                helperText="1-15"
                            />
                            <TextField
                                label={numberScaleLabel}
                                type="number"
                                size="small"
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.scale ?? 0}
                                onChange={(e) => updateValidationRule('scale', e.target.value ? parseInt(e.target.value, 10) : 0)}
                                inputProps={{ min: 0, max: Math.max(0, (validationRules.precision ?? 10) - 1) }}
                                helperText={`0-${Math.max(0, (validationRules.precision ?? 10) - 1)}`}
                            />
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label={numberMinLabel}
                                type="number"
                                size="small"
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.min ?? ''}
                                onChange={(e) => updateValidationRule('min', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                            <TextField
                                label={numberMaxLabel}
                                type="number"
                                size="small"
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.max ?? ''}
                                onChange={(e) => updateValidationRule('max', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                        </Stack>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(validationRules.nonNegative)}
                                    onChange={(e) => updateValidationRule('nonNegative', e.target.checked)}
                                />
                            }
                            label={numberNonNegativeLabel}
                            disabled={isLoading}
                        />
                    </Stack>
                )
            case 'DATE':
                return (
                    <FormControl fullWidth size="small" disabled={isLoading}>
                        <InputLabel id="date-composition-label">{dateCompositionLabel}</InputLabel>
                        <Select
                            labelId="date-composition-label"
                            label={dateCompositionLabel}
                            value={validationRules.dateComposition ?? 'datetime'}
                            onChange={(e) => updateValidationRule('dateComposition', e.target.value)}
                        >
                            {dateCompositionOptions.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )
            case 'REF':
                return (
                    <TargetEntitySelector
                        metahubId={metahubId}
                        targetEntityKind={values.targetEntityKind as MetaEntityKind | null | undefined}
                        targetEntityId={values.targetEntityId as string | null | undefined}
                        onEntityKindChange={(kind) => setValue('targetEntityKind', kind)}
                        onEntityIdChange={(id) => setValue('targetEntityId', id)}
                        excludeCatalogId={currentCatalogId}
                        disabled={isLoading}
                        uiLocale={uiLocale}
                    />
                )
            default:
                return null
        }
    }

    const hasTypeSettings = ['STRING', 'NUMBER', 'DATE', 'REF'].includes(dataType)

    return (
        <>
            <LocalizedInlineField
                mode='localized'
                label={nameLabel}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next) => setValue('nameVlc', next)}
                error={fieldErrors.nameVlc || null}
                helperText={fieldErrors.nameVlc}
                uiLocale={uiLocale}
            />
            <FormControl fullWidth disabled={isLoading || dataTypeDisabled}>
                <InputLabel id='attribute-data-type-label'>{dataTypeLabel}</InputLabel>
                <Select
                    labelId='attribute-data-type-label'
                    label={dataTypeLabel}
                    value={dataType}
                    onChange={(event) => {
                        const newType = event.target.value as AttributeDataType
                        setValue('dataType', newType)
                        // Reset validationRules to defaults for new type
                        setValue('validationRules', getDefaultValidationRules(newType))
                    }}
                >
                    {dataTypeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))}
                </Select>
                {dataTypeHelperText && <FormHelperText>{dataTypeHelperText}</FormHelperText>}
            </FormControl>
            {hasTypeSettings && (
                <Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            py: 1,
                            '&:hover': { color: 'primary.main' }
                        }}
                        onClick={() => setShowTypeSettings(!showTypeSettings)}
                    >
                        {showTypeSettings ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        <Typography variant="body2" sx={{ ml: 0.5 }}>
                            {typeSettingsLabel}
                        </Typography>
                    </Box>
                    <Collapse in={showTypeSettings}>
                        <Box sx={{ pl: 2, pt: 1 }}>
                            {renderTypeSettings()}
                        </Box>
                    </Collapse>
                </Box>
            )}
            {/* Physical PostgreSQL type info */}
            <Alert severity="info" sx={{ py: 0.5 }}>
                {physicalTypeLabel}: <strong>{physicalTypeInfo.physicalTypeStr}</strong>
                {physicalTypeInfo.physicalInfo.isVLC && ' (VLC)'}
            </Alert>
            <FormControlLabel
                control={<Switch checked={isRequired} onChange={(event) => setValue('isRequired', event.target.checked)} />}
                label={requiredLabel}
                disabled={isLoading}
            />
            <Box>
                <FormControlLabel
                    control={<Switch checked={isDisplayAttribute} onChange={(event) => setValue('isDisplayAttribute', event.target.checked)} />}
                    label={displayAttributeLabel}
                    disabled={isLoading || displayAttributeLocked}
                />
                {displayAttributeHelper && (
                    <FormHelperText sx={{ mt: -0.5, ml: 7 }}>{displayAttributeHelper}</FormHelperText>
                )}
            </Box>
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched) => setValue('codenameTouched', touched)}
                label={codenameLabel}
                helperText={codenameHelper}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
            />
        </>
    )
}

export default AttributeFormFields
