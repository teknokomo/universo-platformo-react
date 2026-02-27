import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import type { VersionedLocalizedContent, AttributeDataType, MetaEntityKind, EnumPresentationMode } from '@universo/types'
import type { AttributeValidationRules } from '../../../types'
import { getDefaultValidationRules, getPhysicalDataType, formatPhysicalType, getVLCString } from '../../../types'
import { sanitizeCodename } from '../../../utils/codename'
import { normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField, TargetEntitySelector } from '../../../components'
import { listEnumerationValues } from '../../enumerations/api'
import { metahubsQueryKeys } from '../../shared'

const STRING_DEFAULT_MAX_LENGTH = 10

const getCatalogAttributeDefaultValidationRules = (dataType: AttributeDataType): Partial<AttributeValidationRules> => {
    const defaults = getDefaultValidationRules(dataType)
    if (dataType !== 'STRING') return defaults
    return {
        ...defaults,
        maxLength:
            typeof (defaults as AttributeValidationRules).maxLength === 'number' && (defaults as AttributeValidationRules).maxLength > 0
                ? (defaults as AttributeValidationRules).maxLength
                : STRING_DEFAULT_MAX_LENGTH
    }
}

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
    /** When true, hides the display attribute switch (moved to Presentation tab) */
    hideDisplayAttribute?: boolean
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
    disableVlcToggles = false,
    hideDisplayAttribute = false
}: AttributeFormFieldsProps) => {
    const { t } = useTranslation('metahubs')
    const [showTypeSettings, setShowTypeSettings] = useState(false)
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const dataType = (values.dataType as AttributeDataType | undefined) ?? 'STRING'
    const isRequired = Boolean(values.isRequired)
    const isDisplayAttribute = Boolean(values.isDisplayAttribute)
    const validationRules =
        (values.validationRules as AttributeValidationRules | undefined) ?? getCatalogAttributeDefaultValidationRules(dataType)
    const uiConfig = (values.uiConfig ?? {}) as Record<string, unknown>
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
    const updateValidationRule = useCallback(
        (key: string, value: any) => {
            setValue('validationRules', { ...validationRules, [key]: value })
        },
        [setValue, validationRules]
    )

    useEffect(() => {
        if (displayAttributeLocked && !isDisplayAttribute) {
            setValue('isDisplayAttribute', true)
        }
    }, [displayAttributeLocked, isDisplayAttribute, setValue])

    useEffect(() => {
        if (!isDisplayAttribute || isRequired) return
        setValue('isRequired', true)
    }, [isDisplayAttribute, isRequired, setValue])

    // Render type-specific settings
    const renderTypeSettings = () => {
        switch (dataType) {
            case 'STRING':
                return (
                    <Stack spacing={2}>
                        <Stack direction='row' spacing={2}>
                            <TextField
                                label={stringMinLengthLabel}
                                type='number'
                                size='small'
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.minLength ?? ''}
                                onChange={(e) => updateValidationRule('minLength', e.target.value ? parseInt(e.target.value, 10) : null)}
                                inputProps={{ min: 0 }}
                            />
                            <TextField
                                label={stringMaxLengthLabel}
                                type='number'
                                size='small'
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
                        <Stack direction='row' spacing={2}>
                            <TextField
                                label={numberPrecisionLabel}
                                type='number'
                                size='small'
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.precision ?? 10}
                                onChange={(e) => updateValidationRule('precision', e.target.value ? parseInt(e.target.value, 10) : 10)}
                                inputProps={{ min: 1, max: 15 }}
                                helperText='1-15'
                            />
                            <TextField
                                label={numberScaleLabel}
                                type='number'
                                size='small'
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.scale ?? 0}
                                onChange={(e) => updateValidationRule('scale', e.target.value ? parseInt(e.target.value, 10) : 0)}
                                inputProps={{ min: 0, max: Math.max(0, (validationRules.precision ?? 10) - 1) }}
                                helperText={`0-${Math.max(0, (validationRules.precision ?? 10) - 1)}`}
                            />
                        </Stack>
                        <Stack direction='row' spacing={2}>
                            <TextField
                                label={numberMinLabel}
                                type='number'
                                size='small'
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.min ?? ''}
                                onChange={(e) => updateValidationRule('min', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                            <TextField
                                label={numberMaxLabel}
                                type='number'
                                size='small'
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
                    <FormControl fullWidth size='small' disabled={isLoading}>
                        <InputLabel id='date-composition-label'>{dateCompositionLabel}</InputLabel>
                        <Select
                            labelId='date-composition-label'
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
                        error={fieldErrors.targetEntityKind || fieldErrors.targetEntityId || null}
                        uiLocale={uiLocale}
                    />
                )
            case 'TABLE':
                return (
                    <Stack spacing={2}>
                        <Stack direction='row' spacing={2}>
                            <TextField
                                label={t('attributes.typeSettings.table.minRows', 'Min rows')}
                                type='number'
                                size='small'
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.minRows ?? ''}
                                onChange={(e) => updateValidationRule('minRows', e.target.value ? parseInt(e.target.value, 10) : null)}
                                inputProps={{ min: 0 }}
                                helperText={t('attributes.typeSettings.table.minRowsHelper', 'Leave empty for no limit')}
                            />
                            <TextField
                                label={t('attributes.typeSettings.table.maxRows', 'Max rows')}
                                type='number'
                                size='small'
                                fullWidth
                                disabled={isLoading}
                                value={validationRules.maxRows ?? ''}
                                onChange={(e) => updateValidationRule('maxRows', e.target.value ? parseInt(e.target.value, 10) : null)}
                                inputProps={{ min: 1 }}
                                helperText={t('attributes.typeSettings.table.maxRowsHelper', 'Leave empty for no limit')}
                            />
                        </Stack>
                    </Stack>
                )
            default:
                return null
        }
    }

    const hasTypeSettings = ['STRING', 'NUMBER', 'DATE', 'REF', 'TABLE'].includes(dataType)

    return (
        <Stack spacing={2}>
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
                        setValue('validationRules', getCatalogAttributeDefaultValidationRules(newType))
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
                        {showTypeSettings ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
                        <Typography variant='body2' sx={{ ml: 0.5 }}>
                            {typeSettingsLabel}
                        </Typography>
                    </Box>
                    <Collapse in={showTypeSettings}>
                        <Box sx={{ pl: 2, pt: 1 }}>{renderTypeSettings()}</Box>
                    </Collapse>
                </Box>
            )}
            {/* Physical PostgreSQL type info */}
            <Alert severity='info' sx={{ py: 0.5 }}>
                {physicalTypeLabel}:{' '}
                <strong>
                    {dataType === 'TABLE'
                        ? t('attributes.physicalType.childTable', 'Child table (tabular part)')
                        : physicalTypeInfo.physicalTypeStr}
                </strong>
                {physicalTypeInfo.physicalInfo.isVLC && ' (VLC)'}
            </Alert>
            {/* Required toggle (all attribute types including TABLE) */}
            <FormControlLabel
                control={<Switch checked={isRequired} onChange={(event) => setValue('isRequired', event.target.checked)} />}
                label={requiredLabel}
                disabled={isLoading || isDisplayAttribute}
            />
            {/* Display attribute toggle (hidden when Presentation tab handles it) */}
            {!hideDisplayAttribute && (
                <Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={isDisplayAttribute}
                                onChange={(event) => setValue('isDisplayAttribute', event.target.checked)}
                            />
                        }
                        label={displayAttributeLabel}
                        disabled={isLoading || displayAttributeLocked}
                    />
                    {displayAttributeHelper && <FormHelperText sx={{ mt: -0.5, ml: 7 }}>{displayAttributeHelper}</FormHelperText>}
                </Box>
            )}
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
        </Stack>
    )
}

export default AttributeFormFields

// ============ PRESENTATION TAB FIELDS ============

export type PresentationTabFieldsProps = {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    metahubId?: string
    displayAttributeLabel: string
    displayAttributeHelper: string
    displayAttributeLocked: boolean
    headerAsCheckboxLabel: string
    headerAsCheckboxHelper: string
    dataType: string
    targetEntityKind?: MetaEntityKind | null
    targetEntityId?: string | null
    isRequired?: boolean
    forceDisplayAttributeWhenLocked?: boolean
}

export const PresentationTabFields = ({
    values,
    setValue,
    isLoading,
    metahubId,
    displayAttributeLabel,
    displayAttributeHelper,
    displayAttributeLocked,
    headerAsCheckboxLabel,
    headerAsCheckboxHelper,
    dataType,
    targetEntityKind,
    targetEntityId,
    isRequired,
    forceDisplayAttributeWhenLocked = true
}: PresentationTabFieldsProps) => {
    const { t, i18n } = useTranslation('metahubs')
    const isDisplayAttribute = Boolean(values.isDisplayAttribute)
    const uiConfig = useMemo(() => (values.uiConfig ?? {}) as Record<string, unknown>, [values.uiConfig])
    const isEnumRef = dataType === 'REF' && targetEntityKind === 'enumeration'

    const enumPresentationMode: EnumPresentationMode =
        uiConfig.enumPresentationMode === 'radio' || uiConfig.enumPresentationMode === 'label' ? uiConfig.enumPresentationMode : 'select'
    const defaultEnumValueId = typeof uiConfig.defaultEnumValueId === 'string' ? uiConfig.defaultEnumValueId : null
    const enumAllowEmpty = uiConfig.enumAllowEmpty !== false
    const hasDefaultEnumValue = Boolean(defaultEnumValueId)
    const effectiveAllowEmpty = !isRequired && !hasDefaultEnumValue && enumAllowEmpty
    const enumLabelEmptyDisplay = uiConfig.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'

    const { data: enumerationValuesResponse, isLoading: isLoadingEnumValues } = useQuery({
        queryKey:
            metahubId && targetEntityId
                ? metahubsQueryKeys.enumerationValuesList(metahubId, targetEntityId)
                : ['metahubs', 'enumerations', 'values', 'empty'],
        queryFn: async () => {
            if (!metahubId || !targetEntityId) {
                return { items: [], total: 0 }
            }
            return listEnumerationValues(metahubId, targetEntityId)
        },
        enabled: Boolean(metahubId && targetEntityId && isEnumRef),
        staleTime: 30_000
    })

    const enumerationValues = useMemo(
        () => [...(enumerationValuesResponse?.items ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        [enumerationValuesResponse?.items]
    )

    const updateUiConfig = useCallback(
        (patch: Record<string, unknown>) => {
            setValue('uiConfig', { ...uiConfig, ...patch })
        },
        [setValue, uiConfig]
    )

    useEffect(() => {
        if (!displayAttributeLocked || !forceDisplayAttributeWhenLocked || isDisplayAttribute) return
        setValue('isDisplayAttribute', true)
    }, [displayAttributeLocked, forceDisplayAttributeWhenLocked, isDisplayAttribute, setValue])

    useEffect(() => {
        if (!isDisplayAttribute || isRequired) return
        setValue('isRequired', true)
    }, [isDisplayAttribute, isRequired, setValue])

    useEffect(() => {
        if (!isEnumRef || !isRequired) return
        if (uiConfig.enumAllowEmpty !== false) {
            updateUiConfig({ enumAllowEmpty: false })
        }
    }, [isEnumRef, isRequired, uiConfig.enumAllowEmpty, updateUiConfig])

    return (
        <Stack spacing={2}>
            <Box>
                <FormControlLabel
                    control={
                        <Switch
                            checked={isDisplayAttribute}
                            onChange={(_, checked) => setValue('isDisplayAttribute', checked)}
                            disabled={isLoading || displayAttributeLocked}
                        />
                    }
                    label={displayAttributeLabel}
                />
                {displayAttributeHelper && <FormHelperText sx={{ mt: -0.5, ml: 7 }}>{displayAttributeHelper}</FormHelperText>}
            </Box>
            {dataType === 'TABLE' && (
                <>
                    <Divider />
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={(uiConfig.showTitle as boolean) ?? true}
                                    onChange={(_, checked) => {
                                        updateUiConfig({ showTitle: checked })
                                    }}
                                    disabled={isLoading}
                                />
                            }
                            label={t('attributes.typeSettings.table.showTitle', 'Show table title')}
                        />
                    </Box>
                </>
            )}
            {dataType === 'BOOLEAN' && (
                <>
                    <Divider />
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(uiConfig.headerAsCheckbox)}
                                    onChange={(_, checked) => {
                                        setValue('uiConfig', { ...uiConfig, headerAsCheckbox: checked })
                                    }}
                                    disabled={isLoading}
                                />
                            }
                            label={headerAsCheckboxLabel}
                        />
                        <FormHelperText sx={{ mt: -0.5, ml: 7 }}>{headerAsCheckboxHelper}</FormHelperText>
                    </Box>
                </>
            )}

            {isEnumRef && (
                <>
                    <Divider />
                    {!targetEntityId && (
                        <Alert severity='info'>
                            {t(
                                'attributes.presentation.enumTargetRequired',
                                'Select a target enumeration on the General tab to configure presentation settings.'
                            )}
                        </Alert>
                    )}
                    <FormControl fullWidth disabled={isLoading || !targetEntityId}>
                        <InputLabel id='enum-presentation-mode-label'>
                            {t('attributes.presentation.enumMode', 'Enumeration view mode')}
                        </InputLabel>
                        <Select
                            size='medium'
                            labelId='enum-presentation-mode-label'
                            label={t('attributes.presentation.enumMode', 'Enumeration view mode')}
                            value={enumPresentationMode}
                            onChange={(event) => {
                                updateUiConfig({
                                    enumPresentationMode: event.target.value as EnumPresentationMode
                                })
                            }}
                        >
                            <MenuItem value='select'>{t('attributes.presentation.enumModeOptions.select', 'Input field')}</MenuItem>
                            <MenuItem value='radio'>{t('attributes.presentation.enumModeOptions.radio', 'Radio field')}</MenuItem>
                            <MenuItem value='label'>{t('attributes.presentation.enumModeOptions.label', 'Label field')}</MenuItem>
                        </Select>
                        <FormHelperText>
                            {t(
                                'attributes.presentation.enumModeHelper',
                                'Applies to references that point to an enumeration in runtime forms.'
                            )}
                        </FormHelperText>
                    </FormControl>

                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={effectiveAllowEmpty}
                                    onChange={(_, checked) => {
                                        const patch: Record<string, unknown> = { enumAllowEmpty: checked }
                                        if (checked) {
                                            patch.defaultEnumValueId = null
                                        }
                                        updateUiConfig(patch)
                                    }}
                                    disabled={isLoading || !targetEntityId || isLoadingEnumValues || isRequired}
                                />
                            }
                            label={t('attributes.presentation.allowEmpty', 'Can be empty')}
                        />
                        <FormHelperText sx={{ mt: -0.5, ml: 7 }}>
                            {t(
                                'attributes.presentation.allowEmptyHelper',
                                'Controls whether an empty option is available for default value selection.'
                            )}
                        </FormHelperText>
                    </Box>

                    <FormControl fullWidth disabled={isLoading || !targetEntityId || isLoadingEnumValues}>
                        <InputLabel id='enum-default-value-label'>
                            {t('attributes.presentation.defaultEnumValue', 'Default value')}
                        </InputLabel>
                        <Select
                            size='medium'
                            labelId='enum-default-value-label'
                            label={t('attributes.presentation.defaultEnumValue', 'Default value')}
                            value={defaultEnumValueId ?? ''}
                            renderValue={(selected) => {
                                if (!selected || typeof selected !== 'string') {
                                    return <Box component='span' sx={{ display: 'inline-block', minHeight: '1em' }} />
                                }
                                const selectedValue = enumerationValues.find((value) => value.id === selected)
                                return (
                                    getVLCString(selectedValue?.name, i18n.language) ||
                                    getVLCString(selectedValue?.name, 'en') ||
                                    selectedValue?.codename ||
                                    ''
                                )
                            }}
                            onChange={(event) => {
                                const next =
                                    typeof event.target.value === 'string' && event.target.value.length > 0 ? event.target.value : null
                                updateUiConfig({
                                    defaultEnumValueId: next,
                                    enumAllowEmpty: next ? false : isRequired ? false : enumAllowEmpty
                                })
                            }}
                        >
                            {effectiveAllowEmpty && (
                                <MenuItem value=''>
                                    <Box component='span' sx={{ display: 'inline-block', width: '100%', minHeight: '1.25em' }} />
                                </MenuItem>
                            )}
                            {!effectiveAllowEmpty && <MenuItem value='' sx={{ display: 'none' }} />}
                            {enumerationValues.map((value) => (
                                <MenuItem key={value.id} value={value.id}>
                                    {getVLCString(value.name, i18n.language) || getVLCString(value.name, 'en') || value.codename}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {isLoadingEnumValues
                                ? t('common.loading', 'Loading...')
                                : t(
                                      'attributes.presentation.defaultEnumValueHelper',
                                      'When empty, runtime forms start with no selected value.'
                                  )}
                        </FormHelperText>
                    </FormControl>

                    {enumPresentationMode === 'label' && !defaultEnumValueId && (
                        <FormControl fullWidth disabled={isLoading || !targetEntityId}>
                            <InputLabel id='enum-label-empty-display-label'>
                                {t('attributes.presentation.labelEmptyDisplay', 'Empty value display')}
                            </InputLabel>
                            <Select
                                size='medium'
                                labelId='enum-label-empty-display-label'
                                label={t('attributes.presentation.labelEmptyDisplay', 'Empty value display')}
                                value={enumLabelEmptyDisplay}
                                onChange={(event) => {
                                    const next = event.target.value === 'empty' ? 'empty' : 'dash'
                                    updateUiConfig({ enumLabelEmptyDisplay: next })
                                }}
                            >
                                <MenuItem value='empty'>
                                    {t('attributes.presentation.labelEmptyDisplayOptions.empty', 'Empty value')}
                                </MenuItem>
                                <MenuItem value='dash'>{t('attributes.presentation.labelEmptyDisplayOptions.dash', 'Dash')}</MenuItem>
                            </Select>
                            <FormHelperText>
                                {t(
                                    'attributes.presentation.labelEmptyDisplayHelper',
                                    'Used in label mode when default value is not selected.'
                                )}
                            </FormHelperText>
                        </FormControl>
                    )}

                    {isRequired && !defaultEnumValueId && (
                        <Alert severity='info'>
                            {t(
                                'attributes.presentation.requiredWithoutDefault',
                                'This attribute is required. Users must select a value before saving if default is empty.'
                            )}
                        </Alert>
                    )}
                </>
            )}
        </Stack>
    )
}
