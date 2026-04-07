import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Box,
    Skeleton,
    Stack,
    Typography,
    Tabs,
    Tab,
    TextField,
    CircularProgress,
    Popper,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Radio,
    RadioGroup
} from '@mui/material'
import Autocomplete, { autocompleteClasses } from '@mui/material/Autocomplete'
import { styled } from '@mui/material/styles'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient, useQuery } from '@tanstack/react-query'

// project imports
import {
    TemplateMainCard as MainCard,
    ToolbarControls,
    EmptyListState,
    APIEmptySVG,
    PaginationControls,
    FlowListTable,
    useConfirm,
    revealPendingEntityFeedback,
    ViewHeaderMUI as ViewHeader,
    BaseEntityMenu,
    type ActionContext,
    useListDialogs
} from '@universo/template-mui'
import type { DragEndEvent } from '@universo/template-mui'
import {
    ConfirmDeleteDialog,
    DynamicEntityFormDialog,
    ConflictResolutionDialog,
    EntityFormDialog
} from '@universo/template-mui/components/dialogs'

import { useCreateElement, useUpdateElement, useDeleteElement, useMoveElement, useReorderElement } from '../hooks/mutations'
import { useElementListData } from '../hooks/useElementListData'
import * as elementsApi from '../api'
import * as attributesApi from '../../attributes'
import { listEnumerationValues } from '../../enumerations/api'
import { metahubsQueryKeys, invalidateElementsQueries } from '../../shared'
import {
    Constant,
    Hub,
    Catalog,
    CatalogLocalizedPayload,
    HubElement,
    HubElementDisplay,
    getVLCString,
    toHubElementDisplay,
    type VersionedLocalizedContent
} from '../../../types'
import { hasAxiosResponse, isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import elementActions from './ElementActions'
import InlineTableEditor from './InlineTableEditor'
import type { DynamicFieldConfig, DynamicFieldValidationRules } from '@universo/template-mui/components/dialogs'
import {
    buildInitialValues as buildCatalogInitialValues,
    buildFormTabs as buildCatalogFormTabs,
    validateCatalogForm,
    canSaveCatalogForm,
    toPayload as catalogToPayload
} from '../../catalogs/ui/CatalogActions'
import type { CatalogDisplayWithHub } from '../../catalogs/ui/CatalogActions'
import { useUpdateCatalogAtMetahub } from '../../catalogs/hooks/mutations'
import {
    type ElementMenuContext,
    type ElementConfirmSpec,
    isVersionedLocalizedContent,
    extractResponseMessage,
    resolveSetConstantLabel,
    resolveRefId,
    applyCopySuffixToFirstStringAttribute
} from './elementListUtils'

const StyledPopper = styled(Popper)(({ theme }) => ({
    boxShadow: theme.shadows[4],
    borderRadius: 10,
    [`& .${autocompleteClasses.paper}`]: {
        borderRadius: 10,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper
    },
    [`& .${autocompleteClasses.listbox}`]: {
        boxSizing: 'border-box',
        padding: 6
    }
}))

type ReferenceFieldAutocompleteProps = {
    metahubId: string
    targetCatalogId: string
    value: string | null | undefined
    onChange: (value: string | null) => void
    label: string
    placeholder?: string
    disabled?: boolean
    error?: boolean
    helperText?: string
    locale: string
}

const ReferenceFieldAutocomplete = ({
    metahubId,
    targetCatalogId,
    value,
    onChange,
    label,
    placeholder,
    disabled = false,
    error = false,
    helperText,
    locale
}: ReferenceFieldAutocompleteProps) => {
    const { t } = useTranslation('metahubs')

    const { data: targetAttributesData, isLoading: isLoadingAttributes } = useQuery({
        queryKey: metahubsQueryKeys.attributesListDirect(metahubId, targetCatalogId, { limit: 100, locale }),
        queryFn: () => attributesApi.listAttributesDirect(metahubId, targetCatalogId, { limit: 100, locale }),
        enabled: Boolean(metahubId && targetCatalogId)
    })

    const targetAttributes = useMemo(() => targetAttributesData?.items ?? [], [targetAttributesData])

    const { data: targetElementsData, isLoading: isLoadingElements } = useQuery({
        queryKey: metahubsQueryKeys.elementsListDirect(metahubId, targetCatalogId, { limit: 200, sortBy: 'updated', sortOrder: 'desc' }),
        queryFn: () =>
            elementsApi.listElementsDirect(metahubId, targetCatalogId, {
                limit: 200,
                sortBy: 'updated',
                sortOrder: 'desc'
            }),
        enabled: Boolean(metahubId && targetCatalogId)
    })

    const elementOptions = useMemo<ElementOption[]>(() => {
        const elements = targetElementsData?.items ?? []
        return elements.map((element) => {
            const display = toHubElementDisplay(element, targetAttributes, locale)
            return { id: element.id, name: display.name || element.id }
        })
    }, [targetElementsData, targetAttributes, locale])

    const selectedOption = useMemo<ElementOption | null>(() => {
        if (!value) return null
        const found = elementOptions.find((option) => option.id === value)
        if (found) return found
        const fallbackLabel = t('ref.unknownElement', 'Element {{id}}', { id: value.slice(0, 8) })
        return { id: value, name: fallbackLabel }
    }, [elementOptions, t, value])

    const optionsWithFallback = useMemo(() => {
        if (!selectedOption) return elementOptions
        if (elementOptions.some((option) => option.id === selectedOption.id)) return elementOptions
        return [selectedOption, ...elementOptions]
    }, [elementOptions, selectedOption])

    return (
        <Autocomplete
            fullWidth
            disabled={disabled}
            disableClearable
            options={optionsWithFallback}
            value={selectedOption}
            onChange={(_event, newValue) => onChange(newValue?.id ?? null)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, optionValue) => option.id === optionValue.id}
            popupIcon={<UnfoldMoreRoundedIcon fontSize='small' />}
            PopperComponent={StyledPopper}
            slotProps={{
                popupIndicator: {
                    disableRipple: true,
                    sx: {
                        backgroundColor: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        padding: 0.5,
                        '&:hover': { backgroundColor: 'transparent' }
                    }
                }
            }}
            loading={isLoadingElements || isLoadingAttributes}
            loadingText={t('ref.loadingElements', 'Loading elements...')}
            noOptionsText={t('ref.noElementsAvailable', 'No elements available')}
            sx={{
                '& .MuiAutocomplete-endAdornment': {
                    top: '50%',
                    transform: 'translateY(-50%)'
                },
                '& .MuiAutocomplete-popupIndicator': {
                    backgroundColor: 'transparent',
                    border: 'none',
                    boxShadow: 'none'
                }
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    fullWidth
                    label={label}
                    placeholder={placeholder}
                    error={Boolean(error)}
                    helperText={helperText}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {isLoadingElements || isLoadingAttributes ? <CircularProgress color='inherit' size={16} /> : null}
                                {params.InputProps.endAdornment}
                            </>
                        )
                    }}
                />
            )}
        />
    )
}

type EnumerationValueOption = {
    id: string
    label: string
    isDefault: boolean
}

type EnumerationFieldAutocompleteProps = {
    metahubId: string
    enumerationId: string
    value: string | null | undefined
    onChange: (value: string | null) => void
    label: string
    placeholder?: string
    disabled?: boolean
    error?: boolean
    helperText?: string
    locale: string
    mode?: 'select' | 'radio' | 'label'
    required?: boolean
    defaultValueId?: string | null
    allowEmpty?: boolean
    emptyDisplay?: 'empty' | 'dash'
}

const EnumerationFieldAutocomplete = ({
    metahubId,
    enumerationId,
    value,
    onChange,
    label,
    placeholder,
    disabled = false,
    error = false,
    helperText,
    locale,
    mode = 'select',
    required = false,
    defaultValueId = null,
    allowEmpty = true,
    emptyDisplay = 'dash'
}: EnumerationFieldAutocompleteProps) => {
    const { t } = useTranslation('metahubs')

    const { data: valuesData, isLoading } = useQuery({
        queryKey: metahubsQueryKeys.enumerationValuesList(metahubId, enumerationId),
        queryFn: () => listEnumerationValues(metahubId, enumerationId),
        enabled: Boolean(metahubId && enumerationId)
    })

    const options = useMemo<EnumerationValueOption[]>(() => {
        const items = valuesData?.items ?? []
        return items
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((item) => ({
                id: item.id,
                label: getVLCString(item.name, locale) || getVLCString(item.name, 'en') || item.codename || item.id,
                isDefault: Boolean(item.isDefault)
            }))
    }, [locale, valuesData?.items])

    const selectedOption = useMemo<EnumerationValueOption | null>(() => {
        if (!value) return null
        const found = options.find((option) => option.id === value)
        if (found) return found
        return {
            id: value,
            label: t('ref.unknownEnumerationValue', 'Value {{id}}', { id: value.slice(0, 8) }),
            isDefault: false
        }
    }, [options, t, value])

    const optionsWithFallback = useMemo(() => {
        if (!selectedOption) return options
        if (options.some((option) => option.id === selectedOption.id)) return options
        return [selectedOption, ...options]
    }, [options, selectedOption])

    const fallbackDefaultValueId = defaultValueId ?? optionsWithFallback.find((option) => option.isDefault)?.id ?? null
    const explicitValue = typeof value === 'string' && value.length > 0 ? value : null

    const isEmptySelectable = allowEmpty && !required
    const optionsWithEmpty = useMemo<EnumerationValueOption[]>(() => {
        if (!isEmptySelectable) return optionsWithFallback
        if (optionsWithFallback.some((option) => option.id === '')) return optionsWithFallback
        return [{ id: '', label: '', isDefault: false }, ...optionsWithFallback]
    }, [isEmptySelectable, optionsWithFallback])

    const effectiveValueForLabel = explicitValue ?? fallbackDefaultValueId
    const effectiveOptionForLabel = effectiveValueForLabel
        ? optionsWithFallback.find((option) => option.id === effectiveValueForLabel) ?? null
        : null

    const effectiveValueForRadio = explicitValue ?? fallbackDefaultValueId ?? ''

    const effectiveValueForSelect = explicitValue ?? fallbackDefaultValueId ?? (isEmptySelectable ? '' : null)
    const effectiveOptionForSelect =
        effectiveValueForSelect !== null ? optionsWithEmpty.find((option) => option.id === effectiveValueForSelect) ?? null : null

    if (mode === 'label') {
        // While loading, show a non-breaking space to preserve layout height without garbage IDs
        const labelText =
            isLoading && options.length === 0 ? '\u00A0' : effectiveOptionForLabel?.label ?? (emptyDisplay === 'empty' ? '' : '—')
        return (
            <FormControl fullWidth error={Boolean(error)}>
                <Typography variant='caption' color='text.secondary'>
                    {label}
                </Typography>
                <Typography variant='body1'>{labelText}</Typography>
                {helperText && <FormHelperText>{helperText}</FormHelperText>}
            </FormControl>
        )
    }

    if (mode === 'radio') {
        return (
            <FormControl fullWidth error={Boolean(error)} disabled={disabled}>
                <Typography variant='caption' color='text.secondary' sx={{ mb: 0.5 }}>
                    {label}
                </Typography>
                <RadioGroup value={effectiveValueForRadio} onChange={(event) => onChange(event.target.value || null)}>
                    {options.map((option) => (
                        <FormControlLabel
                            key={option.id}
                            value={option.id}
                            control={<Radio size='small' />}
                            label={option.label}
                            sx={{
                                '& .MuiFormControlLabel-label': {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.75
                                }
                            }}
                        />
                    ))}
                </RadioGroup>
                {helperText && <FormHelperText>{helperText}</FormHelperText>}
            </FormControl>
        )
    }

    return (
        <Autocomplete
            fullWidth
            disabled={disabled}
            disableClearable
            options={optionsWithEmpty}
            value={effectiveOptionForSelect}
            onChange={(_event, newValue) => onChange(newValue?.id ? newValue.id : null)}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, optionValue) => option.id === optionValue.id}
            popupIcon={<UnfoldMoreRoundedIcon fontSize='small' />}
            PopperComponent={StyledPopper}
            slotProps={{
                popupIndicator: {
                    disableRipple: true,
                    sx: {
                        backgroundColor: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        padding: 0.5,
                        '&:hover': { backgroundColor: 'transparent' }
                    }
                }
            }}
            loading={isLoading}
            loadingText={t('common.loading', 'Loading...')}
            noOptionsText={t('ref.noEnumerationValuesAvailable', 'No values available')}
            renderOption={(props, option) => (
                <li {...props} key={option.id} style={option.id === '' ? { minHeight: 36 } : undefined}>
                    {option.label || '\u00A0'}
                </li>
            )}
            sx={{
                '& .MuiAutocomplete-endAdornment': {
                    top: '50%',
                    transform: 'translateY(-50%)'
                },
                '& .MuiAutocomplete-popupIndicator': {
                    backgroundColor: 'transparent',
                    border: 'none',
                    boxShadow: 'none'
                }
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    fullWidth
                    label={label}
                    placeholder={placeholder}
                    error={Boolean(error)}
                    helperText={helperText}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {isLoading ? <CircularProgress color='inherit' size={16} /> : null}
                                {params.InputProps.endAdornment}
                            </>
                        )
                    }}
                />
            )}
        />
    )
}

const ElementList = () => {
    const navigate = useNavigate()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const preferredVlcLocale = useMetahubPrimaryLocale()

    // ── Data from hook ──
    const {
        metahubId,
        hubIdParam,
        catalogId,
        effectiveHubId,
        hubs,
        catalogForHubResolution,
        isCatalogResolutionLoading,
        catalogResolutionError,
        attributes,
        orderedAttributes,
        childAttributesMap,
        childEnumValuesMap,
        setConstantsMap,
        allowElementCopy,
        allowElementDelete,
        paginationResult,
        isLoading,
        error,
        handleSearchChange,
        sortedElements,
        images,
        elementMap,
        elementOrderMap,
        visibleAttributesForColumns,
        refTargetByAttribute,
        refDisplayMap,
        isFetchingRefDisplayMap
    } = useElementListData()

    // ── Local state ──
    const { dialogs, openCreate, openEdit, openCopy, openDelete, openConflict, close } = useListDialogs<HubElement>()
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const updateCatalogMutation = useUpdateCatalogAtMetahub()

    // State management for dialog
    const [isSubmitting, setSubmitting] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [copyDialogError, setCopyDialogError] = useState<string | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    // Filter element actions based on settings
    const filteredElementActions = useMemo(
        () =>
            elementActions.filter((a) => {
                if (a.id === 'copy' && allowElementCopy === false) return false
                if (a.id === 'delete' && allowElementDelete === false) return false
                return true
            }),
        [allowElementCopy, allowElementDelete]
    )

    const buildStringLengthHelperText = useCallback(
        (rules?: { minLength?: number | null; maxLength?: number | null }) => {
            const minLength = typeof rules?.minLength === 'number' ? rules.minLength : null
            const maxLength = typeof rules?.maxLength === 'number' ? rules.maxLength : null

            if (minLength === null && maxLength === null) return undefined
            if (minLength !== null && maxLength !== null) {
                return t('attributes.validation.stringLengthRange', 'Length: {{min}}–{{max}}', { min: minLength, max: maxLength })
            }
            if (minLength !== null) {
                return t('attributes.validation.stringMinLength', 'Min length: {{min}}', { min: minLength })
            }
            return t('attributes.validation.stringMaxLength', 'Max length: {{max}}', { max: maxLength })
        },
        [t]
    )

    const buildNumberRangeHelperText = useCallback(
        (rules?: { min?: number | null; max?: number | null; nonNegative?: boolean }) => {
            const minValue = typeof rules?.min === 'number' ? rules.min : null
            const maxValue = typeof rules?.max === 'number' ? rules.max : null
            const isNonNegative = Boolean(rules?.nonNegative)

            if (minValue !== null && maxValue !== null) {
                return t('attributes.validation.numberRange', 'Range: {{min}}–{{max}}', { min: minValue, max: maxValue })
            }
            if (minValue !== null) {
                return t('attributes.validation.numberMin', 'Min value: {{min}}', { min: minValue })
            }
            if (maxValue !== null) {
                return t('attributes.validation.numberMax', 'Max value: {{max}}', { max: maxValue })
            }
            if (isNonNegative) {
                return t('attributes.validation.numberNonNegative', 'Non-negative value')
            }
            return undefined
        },
        [t]
    )

    const elementFields = useMemo<DynamicFieldConfig[]>(
        () =>
            orderedAttributes.map((attribute) => {
                const resolvedTargetEntityId = attribute.targetEntityId ?? null
                const resolvedTargetEntityKind = attribute.targetEntityKind ?? null
                const resolvedTargetConstantId = resolvedTargetEntityKind === 'set' ? attribute.targetConstantId ?? null : null
                const resolvedSetConstant =
                    resolvedTargetEntityKind === 'set' && resolvedTargetEntityId && resolvedTargetConstantId
                        ? (setConstantsMap?.[resolvedTargetEntityId] ?? []).find((constant) => constant.id === resolvedTargetConstantId) ??
                          null
                        : null
                const uiConfig = (attribute.uiConfig ?? {}) as Record<string, unknown>
                const enumPresentationMode =
                    uiConfig.enumPresentationMode === 'radio' || uiConfig.enumPresentationMode === 'label'
                        ? uiConfig.enumPresentationMode
                        : 'select'
                const defaultEnumValueId = typeof uiConfig.defaultEnumValueId === 'string' ? uiConfig.defaultEnumValueId : null
                const enumAllowEmpty = uiConfig.enumAllowEmpty !== false
                const enumLabelEmptyDisplay = uiConfig.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'

                // Build childFields for TABLE attributes
                let childFields: DynamicFieldConfig[] | undefined
                if (attribute.dataType === 'TABLE' && childAttributesMap?.[attribute.id]) {
                    const children = childAttributesMap[attribute.id]
                    childFields = children
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                        .map((child) => {
                            const childTargetId = child.targetEntityId ?? null
                            const childTargetKind = child.targetEntityKind ?? null
                            const childTargetConstantId = childTargetKind === 'set' ? child.targetConstantId ?? null : null
                            const childSetConstant =
                                childTargetKind === 'set' && childTargetId && childTargetConstantId
                                    ? (setConstantsMap?.[childTargetId] ?? []).find((constant) => constant.id === childTargetConstantId) ??
                                      null
                                    : null
                            const childUiConfig = (child.uiConfig ?? {}) as Record<string, unknown>
                            const childEnumPresentationMode =
                                childUiConfig.enumPresentationMode === 'radio' || childUiConfig.enumPresentationMode === 'label'
                                    ? childUiConfig.enumPresentationMode
                                    : 'select'
                            const childDefaultEnumValueId =
                                typeof childUiConfig.defaultEnumValueId === 'string' ? childUiConfig.defaultEnumValueId : null
                            const childEnumAllowEmpty = childUiConfig.enumAllowEmpty !== false
                            const childEnumLabelEmptyDisplay = childUiConfig.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'

                            // Resolve enum options for REF→enumeration children
                            let enumOptions: DynamicFieldConfig['enumOptions']
                            if (child.dataType === 'REF' && childTargetKind === 'enumeration' && childTargetId) {
                                enumOptions = childEnumValuesMap?.[childTargetId] ?? []
                            } else if (child.dataType === 'REF' && childTargetKind === 'set' && childTargetConstantId) {
                                enumOptions = [
                                    {
                                        id: childTargetConstantId,
                                        label: childSetConstant
                                            ? resolveSetConstantLabel(childSetConstant, i18n.language)
                                            : t('ref.unknownEnumerationValue', 'Value {{id}}', {
                                                  id: childTargetConstantId.slice(0, 8)
                                              })
                                    }
                                ]
                            }

                            const effectiveChildEnumPresentationMode =
                                childTargetKind === 'set'
                                    ? 'label'
                                    : (childEnumPresentationMode as DynamicFieldConfig['enumPresentationMode'])
                            const effectiveChildDefaultEnumValueId =
                                childTargetKind === 'set' ? childTargetConstantId : childDefaultEnumValueId
                            const effectiveChildEnumAllowEmpty = childTargetKind === 'set' ? false : childEnumAllowEmpty

                            return {
                                id: child.codename,
                                label: getVLCString(child.name, i18n.language) || child.codename,
                                type: child.dataType as DynamicFieldConfig['type'],
                                required: child.isRequired,
                                validationRules: child.validationRules as DynamicFieldValidationRules | undefined,
                                refTargetEntityId: childTargetId,
                                refTargetEntityKind: childTargetKind,
                                refTargetConstantId: childTargetConstantId,
                                refSetConstantLabel:
                                    childTargetKind === 'set' && childSetConstant
                                        ? resolveSetConstantLabel(childSetConstant, i18n.language)
                                        : null,
                                refSetConstantDataType: childTargetKind === 'set' && childSetConstant ? childSetConstant.dataType : null,
                                enumOptions,
                                enumPresentationMode: effectiveChildEnumPresentationMode,
                                defaultEnumValueId: effectiveChildDefaultEnumValueId,
                                enumAllowEmpty: effectiveChildEnumAllowEmpty,
                                enumLabelEmptyDisplay: childEnumLabelEmptyDisplay as DynamicFieldConfig['enumLabelEmptyDisplay']
                            }
                        })
                }

                const topLevelEnumOptions =
                    resolvedTargetEntityKind === 'set' && resolvedTargetConstantId
                        ? [
                              {
                                  id: resolvedTargetConstantId,
                                  label: resolvedSetConstant
                                      ? resolveSetConstantLabel(resolvedSetConstant, i18n.language)
                                      : t('ref.unknownEnumerationValue', 'Value {{id}}', {
                                            id: resolvedTargetConstantId.slice(0, 8)
                                        })
                              }
                          ]
                        : undefined

                return {
                    id: attribute.codename,
                    label: getVLCString(attribute.name, i18n.language) || attribute.codename,
                    type: attribute.dataType as DynamicFieldConfig['type'],
                    required: attribute.isRequired,
                    helperText:
                        attribute.dataType === 'STRING'
                            ? buildStringLengthHelperText(attribute.validationRules)
                            : attribute.dataType === 'NUMBER'
                            ? buildNumberRangeHelperText(attribute.validationRules)
                            : undefined,
                    validationRules: attribute.validationRules as DynamicFieldValidationRules | undefined,
                    refTargetEntityId: resolvedTargetEntityId,
                    refTargetEntityKind: resolvedTargetEntityKind,
                    refTargetConstantId: resolvedTargetConstantId,
                    refSetConstantLabel: resolvedSetConstant ? resolveSetConstantLabel(resolvedSetConstant, i18n.language) : null,
                    refSetConstantDataType: resolvedSetConstant?.dataType ?? null,
                    enumOptions: topLevelEnumOptions,
                    enumPresentationMode:
                        resolvedTargetEntityKind === 'set' ? ('label' as DynamicFieldConfig['enumPresentationMode']) : enumPresentationMode,
                    defaultEnumValueId: resolvedTargetEntityKind === 'set' ? resolvedTargetConstantId : defaultEnumValueId,
                    enumAllowEmpty: resolvedTargetEntityKind === 'set' ? false : enumAllowEmpty,
                    enumLabelEmptyDisplay,
                    childFields,
                    tableShowTitle: attribute.dataType === 'TABLE' ? uiConfig.showTitle !== false : undefined
                }
            }),
        [
            orderedAttributes,
            i18n.language,
            buildStringLengthHelperText,
            buildNumberRangeHelperText,
            childAttributesMap,
            childEnumValuesMap,
            setConstantsMap,
            t
        ]
    )

    const renderElementField = useCallback(
        (params: {
            field: DynamicFieldConfig
            value: unknown
            onChange: (value: unknown) => void
            disabled: boolean
            error: string | null
            helperText?: string
            locale: string
        }) => {
            const { field, value, onChange, disabled, error, helperText, locale } = params

            // Handle TABLE type with inline table editor
            if (field.type === 'TABLE' && field.childFields && field.childFields.length > 0) {
                const tableRows = Array.isArray(value) ? (value as Record<string, unknown>[]) : []
                return (
                    <InlineTableEditor
                        label={field.label}
                        value={tableRows}
                        onChange={(rows) => onChange(rows)}
                        childFields={field.childFields}
                        disabled={disabled}
                        locale={locale}
                        showTitle={field.tableShowTitle}
                        minRows={field.validationRules?.minRows as number | undefined}
                        maxRows={field.validationRules?.maxRows as number | undefined}
                        required={field.required}
                    />
                )
            }

            if (field.type !== 'REF') return undefined

            if (!metahubId) {
                return (
                    <TextField
                        fullWidth
                        size='small'
                        label={field.label}
                        disabled
                        error={Boolean(error)}
                        helperText={error ?? t('ref.targetEntityMissing', 'Target entity is not configured for this reference.')}
                    />
                )
            }

            const targetKind = field.refTargetEntityKind
            const targetId = field.refTargetEntityId

            if (!targetKind || !targetId) {
                return (
                    <TextField
                        fullWidth
                        size='small'
                        label={field.label}
                        disabled
                        error={Boolean(error)}
                        helperText={error ?? t('ref.targetEntityMissing', 'Target entity is not configured for this reference.')}
                    />
                )
            }

            if (targetKind === 'catalog') {
                return (
                    <ReferenceFieldAutocomplete
                        metahubId={metahubId}
                        targetCatalogId={targetId}
                        value={typeof value === 'string' ? value : null}
                        onChange={(nextValue) => onChange(nextValue)}
                        label={field.label}
                        placeholder={t('ref.selectElement', 'Select element...')}
                        disabled={disabled}
                        error={Boolean(error)}
                        helperText={helperText}
                        locale={locale}
                    />
                )
            }

            if (targetKind === 'enumeration') {
                const enumMode =
                    field.enumPresentationMode === 'radio' || field.enumPresentationMode === 'label' ? field.enumPresentationMode : 'select'
                return (
                    <EnumerationFieldAutocomplete
                        metahubId={metahubId}
                        enumerationId={targetId}
                        value={typeof value === 'string' ? value : null}
                        onChange={(nextValue) => onChange(nextValue)}
                        label={field.label}
                        placeholder={t('ref.selectEnumerationValue', 'Select value...')}
                        disabled={disabled || enumMode === 'label'}
                        error={Boolean(error)}
                        helperText={helperText}
                        locale={locale}
                        mode={enumMode}
                        required={Boolean(field.required)}
                        defaultValueId={field.defaultEnumValueId ?? null}
                        allowEmpty={field.enumAllowEmpty !== false}
                        emptyDisplay={field.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'}
                    />
                )
            }

            if (targetKind === 'set') {
                const targetConstantId = field.refTargetConstantId ?? null
                const displayValue =
                    typeof field.refSetConstantLabel === 'string' && field.refSetConstantLabel.length > 0 ? field.refSetConstantLabel : '—'
                const resolvedCurrentValue = resolveRefId(value)
                const hasMismatch = Boolean(targetConstantId && resolvedCurrentValue && resolvedCurrentValue !== targetConstantId)
                const mismatchMessage =
                    targetConstantId && resolvedCurrentValue
                        ? t('ref.unknownEnumerationValue', 'Value {{id}}', { id: resolvedCurrentValue.slice(0, 8) })
                        : t('ref.targetConstantHint', 'Select constant from the selected set')

                return (
                    <TextField
                        fullWidth
                        size='small'
                        label={field.label}
                        value={displayValue}
                        disabled
                        error={Boolean(error) || hasMismatch}
                        helperText={error ?? (hasMismatch ? mismatchMessage : helperText)}
                    />
                )
            }

            return (
                <TextField
                    fullWidth
                    size='small'
                    label={field.label}
                    disabled
                    error={Boolean(error)}
                    helperText={error ?? t('ref.entityKindNotSupported', 'This entity type is not yet supported for references.')}
                />
            )
        },
        [metahubId, t]
    )

    const { confirm } = useConfirm()

    const createElementMutation = useCreateElement()
    const updateElementMutation = useUpdateElement()
    const deleteElementMutation = useDeleteElement()
    const moveElementMutation = useMoveElement()
    const reorderElementMutation = useReorderElement()

    const handlePendingElementInteraction = useCallback(
        (elementId: string) => {
            if (!metahubId || !catalogId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: effectiveHubId
                    ? metahubsQueryKeys.elements(metahubId, effectiveHubId, catalogId)
                    : metahubsQueryKeys.elementsDirect(metahubId, catalogId),
                entityId: elementId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [catalogId, effectiveHubId, enqueueSnackbar, metahubId, pendingInteractionMessage, queryClient]
    )

    // Build dynamic columns based on attributes
    const elementColumns = useMemo(() => {
        const cols: Array<{
            id: string
            label: string
            width: string
            align: 'left' | 'center' | 'right'
            render: (row: HubElementDisplay) => React.ReactNode
        }> = []

        cols.push({
            id: 'sortOrder',
            label: t('elements.table.order', '#'),
            width: '5%',
            align: 'center',
            render: (row: HubElementDisplay) => (
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{typeof row.sortOrder === 'number' ? row.sortOrder : '—'}</Typography>
            )
        })

        // Add columns for first 4 attributes
        const visibleAttrs = visibleAttributesForColumns
        visibleAttrs.forEach((attr) => {
            cols.push({
                id: attr.codename,
                label: getVLCString(attr.name, i18n.language) || attr.codename,
                width: `${80 / Math.max(visibleAttrs.length, 1)}%`,
                align: 'left',
                render: (row: HubElementDisplay) => {
                    const value = row.data?.[attr.codename]
                    if (value === undefined || value === null) return '—'

                    switch (attr.dataType) {
                        case 'STRING': {
                            const localizedValue = isVersionedLocalizedContent(value) ? getVLCString(value, i18n.language) : String(value)
                            return (
                                <Typography sx={{ fontSize: 14 }} noWrap>
                                    {localizedValue || '—'}
                                </Typography>
                            )
                        }
                        case 'REF': {
                            const target = refTargetByAttribute[attr.codename]
                            if (target?.kind === 'set') {
                                return (
                                    <Typography sx={{ fontSize: 14 }} noWrap>
                                        {target.setConstantLabel || '—'}
                                    </Typography>
                                )
                            }
                            const targetKey = target ? `${target.kind}:${target.targetId}` : null
                            const resolvedRefValue = resolveRefId(value)
                            const displayName = targetKey && resolvedRefValue ? refDisplayMap?.[targetKey]?.[resolvedRefValue] : undefined
                            const isMappingLoading = Boolean(targetKey) && isFetchingRefDisplayMap
                            return (
                                <Typography sx={{ fontSize: 14 }} noWrap>
                                    {displayName || (isMappingLoading ? '...' : '—')}
                                </Typography>
                            )
                        }
                        case 'BOOLEAN':
                            return value ? '✓' : '✗'
                        case 'TABLE': {
                            const rowCount = Array.isArray(value) ? value.length : 0
                            return (
                                <Typography sx={{ fontSize: 13, color: 'text.secondary' }} noWrap>
                                    {rowCount > 0 ? t('elements.table.rowCount', '{{count}} rows', { count: rowCount }) : '—'}
                                </Typography>
                            )
                        }
                        case 'JSON':
                            return (
                                <Typography sx={{ fontFamily: 'monospace', fontSize: 12 }} noWrap>
                                    {JSON.stringify(value)}
                                </Typography>
                            )
                        default:
                            return (
                                <Typography sx={{ fontSize: 14 }} noWrap>
                                    {String(value)}
                                </Typography>
                            )
                    }
                }
            })
        })

        // Add updated column
        cols.push({
            id: 'updatedAt',
            label: t('elements.table.updated', 'Updated'),
            width: '15%',
            align: 'left',
            render: (row: HubElementDisplay) => (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
                </Typography>
            )
        })

        return cols
    }, [i18n.language, visibleAttributesForColumns, refDisplayMap, refTargetByAttribute, isFetchingRefDisplayMap, t])

    const handleMoveElement = useCallback(
        async (elementId: string, direction: 'up' | 'down') => {
            if (!metahubId || !catalogId) return

            try {
                await moveElementMutation.mutateAsync({
                    metahubId,
                    hubId: effectiveHubId,
                    catalogId,
                    elementId,
                    direction
                })
                enqueueSnackbar(t('elements.moveSuccess', 'Element order updated'), { variant: 'success' })
            } catch (error: unknown) {
                const message =
                    typeof error === 'object' &&
                    error !== null &&
                    'message' in error &&
                    typeof (error as { message?: unknown }).message === 'string'
                        ? (error as { message: string }).message
                        : t('elements.moveError', 'Failed to update element order')
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [catalogId, effectiveHubId, enqueueSnackbar, metahubId, moveElementMutation, t]
    )

    const createElementContext = useCallback(
        (
            baseContext: Partial<ElementMenuContext>
        ): ElementMenuContext & {
            orderMap: Map<string, number>
            totalCount: number
            moveElement: (elementId: string, direction: 'up' | 'down') => Promise<void>
        } => ({
            ...baseContext,
            orderMap: elementOrderMap,
            totalCount: sortedElements.length,
            moveElement: handleMoveElement,
            api: {
                updateEntity: async (id: string, patch: { data: ElementUpdatePatch }) => {
                    if (!metahubId || !catalogId) return
                    const element = elementMap.get(id)
                    const expectedVersion = element?.version
                    try {
                        await updateElementMutation.mutateAsync({
                            metahubId,
                            hubId: effectiveHubId,
                            catalogId,
                            elementId: id,
                            data: { data: patch, expectedVersion }
                        })
                    } catch (error: unknown) {
                        if (isOptimisticLockConflict(error)) {
                            const conflict = extractConflictInfo(error)
                            if (conflict) {
                                openConflict({ conflict, pendingUpdate: { id, patch: { data: patch } } })
                            }
                        }
                        throw error
                    }
                },
                deleteEntity: (id: string) => {
                    if (!metahubId || !catalogId) return
                    return deleteElementMutation.mutateAsync({ metahubId, hubId: effectiveHubId, catalogId, elementId: id })
                }
            },
            helpers: {
                refreshList: () => {
                    if (metahubId && catalogId) {
                        if (effectiveHubId) {
                            void invalidateElementsQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                        }
                        // Also invalidate catalog-level queries
                        void queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(metahubId, catalogId) })
                        void queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsDirect(metahubId, catalogId) })
                    }
                },
                confirm: async (spec: ElementConfirmSpec) => {
                    const confirmed = await confirm({
                        title: spec.titleKey ? baseContext.t(spec.titleKey, spec.interpolate) : spec.title,
                        description: spec.descriptionKey ? baseContext.t(spec.descriptionKey, spec.interpolate) : spec.description,
                        confirmButtonName: spec.confirmKey
                            ? baseContext.t(spec.confirmKey)
                            : spec.confirmButtonName || baseContext.t('confirm.delete.confirm'),
                        cancelButtonName: spec.cancelKey
                            ? baseContext.t(spec.cancelKey)
                            : spec.cancelButtonName || baseContext.t('confirm.delete.cancel')
                    })
                    return confirmed
                },
                enqueueSnackbar: (payload: {
                    message: string
                    options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                }) => {
                    if (payload?.message) {
                        enqueueSnackbar(payload.message, payload.options)
                    }
                },
                openDeleteDialog: (element: HubElementDisplay) => {
                    const fullElement = elementMap.get(element.id) ?? (element as unknown as HubElement)
                    openDelete(fullElement)
                },
                openEditDialog: async (element: HubElement | HubElementDisplay) => {
                    if (!metahubId || !catalogId) return
                    const hasData = typeof (element as HubElement).data === 'object'
                    let fullRecord: HubElement | null = null
                    if (hasData && (element as HubElement).data) {
                        fullRecord = element as HubElement
                    } else {
                        fullRecord = elementMap.get(element.id) || null
                        if (!fullRecord) {
                            try {
                                if (effectiveHubId) {
                                    fullRecord = (await elementsApi.getElement(metahubId, effectiveHubId, catalogId, element.id)).data
                                } else {
                                    fullRecord = (await elementsApi.getElementDirect(metahubId, catalogId, element.id)).data
                                }
                            } catch {
                                fullRecord = null
                            }
                        }
                    }
                    if (fullRecord) {
                        openEdit(fullRecord)
                    } else {
                        enqueueSnackbar(t('elements.updateError', 'Failed to update element'), { variant: 'error' })
                    }
                },
                openCopyDialog: async (element: HubElement | HubElementDisplay) => {
                    const fullRecord =
                        typeof (element as HubElement).data === 'object' ? (element as HubElement) : elementMap.get(element.id) || null
                    if (!fullRecord) {
                        enqueueSnackbar(t('elements.copyError', 'Failed to copy element'), { variant: 'error' })
                        return
                    }
                    setCopyDialogError(null)
                    openCopy(fullRecord)
                }
            }
        }),
        [
            catalogId,
            confirm,
            deleteElementMutation,
            elementOrderMap,
            effectiveHubId,
            enqueueSnackbar,
            handleMoveElement,
            metahubId,
            queryClient,
            elementMap,
            sortedElements.length,
            t,
            updateElementMutation
        ]
    )

    const copyInitialData = useMemo(() => {
        if (!dialogs.copy.item?.data || typeof dialogs.copy.item.data !== 'object') return undefined
        return applyCopySuffixToFirstStringAttribute({
            sourceData: dialogs.copy.item.data as Record<string, unknown>,
            attributes: orderedAttributes,
            locale: i18n.language
        })
    }, [dialogs.copy.item?.data, i18n.language, orderedAttributes])

    const applySetReferenceDefaultsToPayload = useCallback(
        (inputData: Record<string, unknown>): Record<string, unknown> => {
            const nextData: Record<string, unknown> = { ...inputData }

            orderedAttributes.forEach((attribute) => {
                if (attribute.dataType === 'REF' && attribute.targetEntityKind === 'set' && attribute.targetConstantId) {
                    const currentValue = resolveRefId(nextData[attribute.codename])
                    if (!currentValue || currentValue !== attribute.targetConstantId) {
                        nextData[attribute.codename] = attribute.targetConstantId
                    }
                    return
                }

                if (attribute.dataType !== 'TABLE') return
                const childAttributes = childAttributesMap?.[attribute.id] ?? []
                if (childAttributes.length === 0) return
                const rawRows = nextData[attribute.codename]
                if (!Array.isArray(rawRows)) return

                nextData[attribute.codename] = rawRows.map((rawRow) => {
                    if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) return rawRow
                    const row = { ...(rawRow as Record<string, unknown>) }
                    childAttributes.forEach((child) => {
                        if (child.dataType !== 'REF' || child.targetEntityKind !== 'set' || !child.targetConstantId) return
                        const currentValue = resolveRefId(row[child.codename])
                        if (!currentValue || currentValue !== child.targetConstantId) {
                            row[child.codename] = child.targetConstantId
                        }
                    })
                    return row
                })
            })

            return nextData
        },
        [childAttributesMap, orderedAttributes]
    )

    // Validate metahubId and catalogId from URL AFTER all hooks
    if (!metahubId || !catalogId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid catalog'
                title={t('errors.noCatalogId', 'No catalog ID provided')}
                description={t('errors.pleaseSelectCatalog', 'Please select a catalog')}
            />
        )
    }

    // Show loading state while resolving catalog (to check for hub association)
    if (!hubIdParam && isCatalogResolutionLoading) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Loading'
                title={tc('loading', 'Loading')}
                description={t('common:loading', 'Loading...')}
            />
        )
    }

    // Show error only if there was an actual error fetching catalog details
    if (!hubIdParam && catalogResolutionError) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Error loading catalog'
                title={t('errors.loadingError', 'Error loading catalog')}
                description={
                    catalogResolutionError instanceof Error ? catalogResolutionError.message : String(catalogResolutionError || '')
                }
            />
        )
    }

    const handleAddNew = () => {
        openCreate()
    }

    const handleDialogClose = () => {
        close('create')
    }

    const handleEditClose = () => {
        close('edit')
        setDialogError(null)
    }

    const handleCopyClose = () => {
        close('copy')
        setCopyDialogError(null)
    }

    const handleCatalogTabChange = (_event: unknown, nextTab: 'attributes' | 'system' | 'elements' | 'settings') => {
        if (!metahubId || !catalogId) return
        if (nextTab === 'elements') return
        if (nextTab === 'settings') {
            setEditDialogOpen(true)
            return
        }
        const nextSuffix = nextTab === 'system' ? 'system' : 'attributes'
        if (hubIdParam) {
            navigate(`/metahub/${metahubId}/hub/${hubIdParam}/catalog/${catalogId}/${nextSuffix}`)
            return
        }
        navigate(`/metahub/${metahubId}/catalog/${catalogId}/${nextSuffix}`)
    }

    const handleCreateElement = async (data: Record<string, unknown>) => {
        setDialogError(null)
        setSubmitting(true)
        try {
            const normalizedData = applySetReferenceDefaultsToPayload(data)
            await createElementMutation.mutateAsync({
                metahubId,
                hubId: effectiveHubId,
                catalogId,
                data: { data: normalizedData }
            })

            handleDialogClose()
        } catch (e: unknown) {
            const responseMessage = extractResponseMessage(e)
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('elements.createError')
            setDialogError(message)
            console.error('Failed to create element', e)
        } finally {
            setSubmitting(false)
        }
    }

    const handleUpdateElement = async (data: Record<string, unknown>) => {
        if (!dialogs.edit.item) return

        setDialogError(null)
        setSubmitting(true)
        try {
            const normalizedData = applySetReferenceDefaultsToPayload(data)
            updateElementMutation.mutate({
                metahubId,
                hubId: effectiveHubId,
                catalogId,
                elementId: dialogs.edit.item.id,
                data: { data: normalizedData }
            })

            // Invalidation handled by mutation hook
            handleEditClose()
        } catch (e: unknown) {
            const responseMessage = extractResponseMessage(e)
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('elements.updateError')
            setDialogError(message)
            console.error('Failed to update element', e)
        } finally {
            setSubmitting(false)
        }
    }

    const handleCopyElement = async (values: Record<string, unknown>) => {
        if (!dialogs.copy.item) return
        setCopyDialogError(null)
        setSubmitting(true)
        try {
            const normalizedData = applySetReferenceDefaultsToPayload(values)
            await createElementMutation.mutateAsync({
                metahubId,
                hubId: effectiveHubId,
                catalogId,
                data: { data: normalizedData }
            })
            handleCopyClose()
        } catch (e: unknown) {
            const responseMessage = extractResponseMessage(e)
            setCopyDialogError(
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : t('elements.copyError', 'Failed to copy element')
            )
        } finally {
            setSubmitting(false)
        }
    }

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId || !catalogId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overElement = sortedElements.find((element) => element.id === String(over.id))
        if (!overElement) return

        try {
            await reorderElementMutation.mutateAsync({
                metahubId,
                hubId: effectiveHubId,
                catalogId,
                elementId: String(active.id),
                newSortOrder: overElement.sortOrder ?? 1
            })
            enqueueSnackbar(t('elements.reorderSuccess', 'Element order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('elements.reorderError', 'Failed to reorder element')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const element = elementMap.get(activeId)
        if (!element) return null
        const display = toHubElementDisplay(element, attributes, i18n.language)
        return (
            <Box
                sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    boxShadow: 6,
                    bgcolor: 'background.paper',
                    minWidth: 260
                }}
            >
                <Stack spacing={0.25}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{display.name || element.id}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {typeof element.sortOrder === 'number' ? `#${element.sortOrder}` : ''}
                    </Typography>
                </Stack>
            </Box>
        )
    }

    // Transform Element data for FlowListTable
    const getElementTableData = (element: HubElement): HubElementDisplay => toHubElementDisplay(element, attributes, i18n.language)

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            {error ? (
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Connection error'
                    title={t('errors.connectionFailed')}
                    description={!hasAxiosResponse(error) ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
                    action={{
                        label: t('actions.retry'),
                        onClick: () => paginationResult.actions.goToPage(1)
                    }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('elements.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('elements.title')}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('create'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />,
                                disabled: attributes.length === 0
                            }}
                        />
                    </ViewHeader>

                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs
                            value='elements'
                            onChange={handleCatalogTabChange}
                            aria-label={t('catalogs.title', 'Catalogs')}
                            textColor='primary'
                            indicatorColor='primary'
                            sx={{
                                minHeight: 40,
                                '& .MuiTab-root': {
                                    minHeight: 40,
                                    textTransform: 'none'
                                }
                            }}
                        >
                            <Tab value='attributes' label={t('attributes.title')} />
                            <Tab value='system' label={t('attributes.tabs.system', 'System')} />
                            <Tab value='elements' label={t('elements.title')} />
                            <Tab value='settings' label={t('settings.title')} />
                        </Tabs>
                    </Box>

                    {isLoading && sortedElements.length === 0 ? (
                        <Skeleton variant='rectangular' height={120} />
                    ) : !isLoading && sortedElements.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No elements'
                            title={t('elements.empty')}
                            description={attributes.length === 0 ? t('elements.addAttributesFirst') : t('elements.emptyDescription')}
                        />
                    ) : (
                        <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                            <FlowListTable
                                data={sortedElements.map(getElementTableData)}
                                images={images}
                                isLoading={isLoading}
                                onPendingInteractionAttempt={(row: HubElementDisplay) => handlePendingElementInteraction(row.id)}
                                customColumns={elementColumns}
                                sortableRows
                                sortableItemIds={sortedElements.map((element) => element.id)}
                                dragHandleAriaLabel={t('elements.dnd.dragHandle', 'Drag to reorder')}
                                dragDisabled={reorderElementMutation.isPending || isLoading}
                                onSortableDragEnd={handleSortableDragEnd}
                                renderDragOverlay={renderDragOverlay}
                                i18nNamespace='flowList'
                                renderActions={(row: HubElementDisplay) => {
                                    const originalElement = elementMap.get(row.id)
                                    if (!originalElement) return null

                                    const descriptors = [...filteredElementActions]
                                    if (!descriptors.length) return null

                                    return (
                                        <BaseEntityMenu<HubElementDisplay, { data: Record<string, unknown> }>
                                            entity={toHubElementDisplay(originalElement, attributes, i18n.language)}
                                            entityKind='element'
                                            descriptors={descriptors}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createElementContext}
                                            contextExtras={{ rawElement: originalElement }}
                                        />
                                    )
                                }}
                            />
                        </Box>
                    )}

                    {/* Table Pagination at bottom */}
                    {!isLoading && sortedElements.length > 0 && (
                        <Box sx={{ mx: { xs: -1.5, md: -2 }, mt: 2 }}>
                            <PaginationControls
                                pagination={paginationResult.pagination}
                                actions={paginationResult.actions}
                                isLoading={paginationResult.isLoading}
                                rowsPerPageOptions={[10, 20, 50, 100]}
                                namespace='common'
                            />
                        </Box>
                    )}
                </Stack>
            )}

            {/* Create Element Dialog */}
            <DynamicEntityFormDialog
                open={dialogs.create.open}
                onClose={handleDialogClose}
                onSubmit={handleCreateElement}
                fields={elementFields}
                i18nNamespace='metahubs'
                isSubmitting={isSubmitting}
                error={dialogError}
                title={t('elements.createDialog.title', 'Add Element')}
                locale={i18n.language}
                requireAnyValue
                emptyStateText={t('elements.noAttributes')}
                saveButtonText={tc('actions.create', 'Create')}
                savingButtonText={tc('actions.creating', 'Creating...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                renderField={renderElementField}
            />

            {/* Edit Element Dialog */}
            <DynamicEntityFormDialog
                open={dialogs.edit.open}
                onClose={handleEditClose}
                onSubmit={handleUpdateElement}
                initialData={dialogs.edit.item?.data}
                i18nNamespace='metahubs'
                isSubmitting={isSubmitting}
                error={dialogError}
                title={t('elements.editDialog.title', 'Edit Element')}
                locale={i18n.language}
                fields={elementFields}
                requireAnyValue
                emptyStateText={t('elements.noAttributes')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                showDeleteButton
                deleteButtonText={tc('actions.delete', 'Delete')}
                onDelete={() => {
                    if (dialogs.edit.item) {
                        openDelete(dialogs.edit.item)
                    }
                }}
                renderField={renderElementField}
            />

            <DynamicEntityFormDialog
                open={dialogs.copy.open}
                onClose={handleCopyClose}
                onSubmit={handleCopyElement}
                initialData={copyInitialData}
                i18nNamespace='metahubs'
                isSubmitting={isSubmitting}
                error={copyDialogError}
                title={t('elements.copyTitle', 'Копирование элемента')}
                locale={i18n.language}
                fields={elementFields}
                requireAnyValue
                emptyStateText={t('elements.noAttributes')}
                saveButtonText={t('elements.copy.action', 'Copy')}
                savingButtonText={t('elements.copy.actionLoading', 'Copying...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                renderField={renderElementField}
            />

            {/* Independent ConfirmDeleteDialog */}
            <ConfirmDeleteDialog
                open={dialogs.delete.open}
                title={t('elements.deleteDialog.title')}
                description={t('elements.deleteDialog.message')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => close('delete')}
                onConfirm={() => {
                    if (!dialogs.delete.item) return

                    deleteElementMutation.mutate(
                        {
                            metahubId,
                            hubId: effectiveHubId,
                            catalogId,
                            elementId: dialogs.delete.item.id
                        },
                        {
                            onError: (err: unknown) => {
                                const responseMessage = extractResponseMessage(err)
                                const message =
                                    typeof responseMessage === 'string'
                                        ? responseMessage
                                        : err instanceof Error
                                        ? err.message
                                        : typeof err === 'string'
                                        ? err
                                        : t('elements.deleteError')
                                enqueueSnackbar(message, { variant: 'error' })
                            }
                        }
                    )
                }}
            />
            <ConflictResolutionDialog
                open={dialogs.conflict.open}
                conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                onCancel={() => {
                    close('conflict')
                    if (metahubId && catalogId) {
                        if (effectiveHubId) {
                            invalidateElementsQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                        }
                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsDirect(metahubId, catalogId) })
                    }
                }}
                onOverwrite={async () => {
                    const pendingUpdate = (
                        dialogs.conflict.data as { pendingUpdate?: { id: string; patch: { data: Record<string, unknown> } } }
                    )?.pendingUpdate
                    if (pendingUpdate && metahubId && catalogId) {
                        const { id, patch } = pendingUpdate
                        await updateElementMutation.mutateAsync({
                            metahubId,
                            hubId: effectiveHubId,
                            catalogId,
                            elementId: id,
                            data: patch
                        })
                        close('conflict')
                    }
                }}
                isLoading={updateElementMutation.isPending}
            />

            {catalogForHubResolution &&
                catalogId &&
                (() => {
                    const catalogDisplay: CatalogDisplayWithHub = {
                        id: catalogForHubResolution.id,
                        metahubId: catalogForHubResolution.metahubId,
                        codename: catalogForHubResolution.codename,
                        name: getVLCString(catalogForHubResolution.name, preferredVlcLocale) || catalogForHubResolution.codename,
                        description: getVLCString(catalogForHubResolution.description, preferredVlcLocale) || '',
                        isSingleHub: catalogForHubResolution.isSingleHub,
                        isRequiredHub: catalogForHubResolution.isRequiredHub,
                        sortOrder: catalogForHubResolution.sortOrder,
                        createdAt: catalogForHubResolution.createdAt,
                        updatedAt: catalogForHubResolution.updatedAt,
                        hubId: effectiveHubId || undefined,
                        hubs: catalogForHubResolution.hubs?.map((h) => ({
                            id: h.id,
                            name: typeof h.name === 'string' ? h.name : h.codename || '',
                            codename: h.codename || ''
                        }))
                    }
                    const catalogMap = new Map<string, Catalog>([[catalogForHubResolution.id, catalogForHubResolution]])
                    const settingsCtx = {
                        entity: catalogDisplay,
                        entityKind: 'catalog' as const,
                        t,
                        catalogMap,
                        metahubId,
                        currentHubId: effectiveHubId || null,
                        uiLocale: preferredVlcLocale,
                        api: {
                            updateEntity: (id: string, patch: CatalogLocalizedPayload) => {
                                if (!metahubId) return
                                updateCatalogMutation.mutate({
                                    metahubId,
                                    catalogId: id,
                                    data: { ...patch, expectedVersion: catalogForHubResolution.version }
                                })
                            }
                        },
                        helpers: {
                            refreshList: () => {
                                if (metahubId && catalogId) {
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.catalogDetail(metahubId, catalogId)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: metahubsQueryKeys.allCatalogs(metahubId)
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: ['breadcrumb', 'catalog-standalone', metahubId, catalogId]
                                    })
                                    void queryClient.invalidateQueries({
                                        queryKey: ['breadcrumb', 'catalog', metahubId]
                                    })
                                }
                            },
                            enqueueSnackbar: (payload: {
                                message: string
                                options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                            }) => {
                                if (payload?.message) enqueueSnackbar(payload.message, payload.options)
                            }
                        }
                    }
                    return (
                        <EntityFormDialog
                            open={editDialogOpen}
                            mode='edit'
                            title={t('catalogs.editTitle', 'Edit Catalog')}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            saveButtonText={tc('actions.save', 'Save')}
                            savingButtonText={tc('actions.saving', 'Saving...')}
                            cancelButtonText={tc('actions.cancel', 'Cancel')}
                            hideDefaultFields
                            initialExtraValues={buildCatalogInitialValues(settingsCtx)}
                            tabs={buildCatalogFormTabs(settingsCtx, hubs, catalogId)}
                            validate={(values) => validateCatalogForm(settingsCtx, values)}
                            canSave={canSaveCatalogForm}
                            onSave={(data) => {
                                const payload = catalogToPayload(data)
                                settingsCtx.api.updateEntity(catalogForHubResolution.id, payload)
                            }}
                            onClose={() => setEditDialogOpen(false)}
                        />
                    )
                })()}
        </MainCard>
    )
}

export default ElementList
