import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
    useListDialogs
} from '@universo/template-mui'
import type { DragEndEvent } from '@universo/template-mui'
import {
    ConfirmDeleteDialog,
    DynamicEntityFormDialog,
    ConflictResolutionDialog,
    EntityFormDialog
} from '@universo/template-mui/components/dialogs'

import { useCreateRecord, useUpdateRecord, useDeleteRecord, useMoveRecord, useReorderRecord } from '../hooks/mutations'
import { useRecordListData } from '../hooks/useRecordListData'
import * as recordsApi from '../api'
import * as fieldDefinitionsApi from '../../fieldDefinition/api'
import { listOptionValues } from '../../../presets/api/optionLists'
import { listEntityInstances } from '../../../api/entityInstances'
import { metahubsQueryKeys, invalidateRecordsQueries } from '../../../../shared'
import {
    LinkedCollectionEntity,
    LinkedCollectionLocalizedPayload,
    RecordItem,
    RecordItemDisplay,
    getVLCString,
    toRecordItemDisplay
} from '../../../../../types'
import { hasAxiosResponse, isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { useMetahubPrimaryLocale } from '../../../../settings/hooks/useMetahubPrimaryLocale'
import recordActions from './RecordActions'
import InlineTableEditor from './InlineTableEditor'
import type { DynamicFieldConfig, DynamicFieldValidationRules } from '@universo/template-mui/components/dialogs'
import {
    buildInitialValues as buildCatalogInitialValues,
    buildFormTabs as buildLinkedCollectionFormTabs,
    validateLinkedCollectionForm,
    canSaveLinkedCollectionForm,
    toPayload as catalogToPayload
} from '../../../presets/ui/LinkedCollectionActions'
import type { LinkedCollectionDisplayWithContainer } from '../../../presets/ui/LinkedCollectionActions'
import { useUpdateLinkedCollectionAtMetahub } from '../../../presets/hooks/linkedCollectionMutations'
import {
    type ElementMenuContext,
    type ElementConfirmSpec,
    type ElementOption,
    type ElementUpdatePatch,
    isVersionedLocalizedContent,
    extractResponseMessage,
    resolveSetConstantLabel,
    resolveRefId,
    applyCopySuffixToFirstStringAttribute
} from './recordListUtils'
import { buildLinkedCollectionAuthoringPath } from '../../../../shared/entityMetadataRoutePaths'

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

const getLocalizedCodenameString = (codename: unknown, locale: string, fallback: string): string => {
    if (typeof codename === 'string' && codename.trim().length > 0) {
        return codename
    }

    if (codename && typeof codename === 'object') {
        const localized =
            getVLCString(codename as Record<string, unknown>, locale) || getVLCString(codename as Record<string, unknown>, 'en')

        if (localized && localized.trim().length > 0) {
            return localized
        }
    }

    return fallback
}

const getFieldDefinitionKey = (definition: { id: string; codename: unknown }, locale: string): string =>
    getLocalizedCodenameString(definition.codename, locale, definition.id)

type ReferenceFieldAutocompleteProps = {
    metahubId: string
    targetEntityId: string
    targetEntityKind: string
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
    targetEntityId,
    targetEntityKind,
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
    const isCatalogTarget = targetEntityKind === 'catalog'
    const fieldDefinitionListParams = useMemo(
        () => ({ limit: 100, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' as const, locale, includeShared: true }),
        [locale]
    )
    const recordListParams = useMemo(() => ({ limit: 200, offset: 0, sortBy: 'updated', sortOrder: 'desc' as const }), [])
    const entityListParams = useMemo(
        () => ({ kind: targetEntityKind, limit: 200, offset: 0, sortBy: 'updated', sortOrder: 'desc' as const, locale }),
        [locale, targetEntityKind]
    )

    const { data: targetAttributesData, isLoading: isLoadingAttributes } = useQuery({
        queryKey: metahubsQueryKeys.fieldDefinitionsListDirect(metahubId, targetEntityId, fieldDefinitionListParams),
        queryFn: () => fieldDefinitionsApi.listFieldDefinitionsDirect(metahubId, targetEntityId, fieldDefinitionListParams),
        enabled: Boolean(metahubId && targetEntityId && isCatalogTarget)
    })

    const targetAttributes = useMemo(() => targetAttributesData?.items ?? [], [targetAttributesData])

    const { data: targetElementsData, isLoading: isLoadingElements } = useQuery({
        queryKey: metahubsQueryKeys.recordsListDirect(metahubId, targetEntityId, recordListParams),
        queryFn: () => recordsApi.listRecordsDirect(metahubId, targetEntityId, recordListParams),
        enabled: Boolean(metahubId && targetEntityId && isCatalogTarget)
    })

    const { data: targetEntitiesData, isLoading: isLoadingEntities } = useQuery({
        queryKey: metahubId ? metahubsQueryKeys.entitiesList(metahubId, entityListParams) : ['empty'],
        queryFn: () => listEntityInstances(metahubId, entityListParams),
        enabled: Boolean(metahubId && targetEntityId && !isCatalogTarget)
    })

    const catalogElementOptions = useMemo<ElementOption[]>(() => {
        const records = targetElementsData?.items ?? []
        return records.map((element) => {
            const display = toRecordItemDisplay(element, targetAttributes, locale)
            return { id: element.id, name: display.name || element.id }
        })
    }, [targetElementsData, targetAttributes, locale])

    const genericEntityOptions = useMemo<ElementOption[]>(() => {
        const entities = targetEntitiesData?.items ?? []
        return entities.map((entity) => ({
            id: entity.id,
            name:
                getVLCString(entity.name, locale) ||
                getVLCString(entity.name, 'en') ||
                getVLCString(entity.codename, locale) ||
                getVLCString(entity.codename, 'en') ||
                entity.id
        }))
    }, [targetEntitiesData?.items, locale])

    const options = isCatalogTarget ? catalogElementOptions : genericEntityOptions

    const selectedOption = useMemo<ElementOption | null>(() => {
        if (!value) return null
        const found = options.find((option) => option.id === value)
        if (found) return found
        const fallbackLabel = isCatalogTarget
            ? t('ref.unknownElement', 'Element {{id}}', { id: value.slice(0, 8) })
            : t('ref.unknownEntity', 'Entity {{id}}', { id: value.slice(0, 8) })
        return { id: value, name: fallbackLabel }
    }, [isCatalogTarget, options, t, value])

    const optionsWithFallback = useMemo(() => {
        if (!selectedOption) return options
        if (options.some((option) => option.id === selectedOption.id)) return options
        return [selectedOption, ...options]
    }, [options, selectedOption])

    return (
        <Autocomplete
            fullWidth
            disabled={disabled}
            disableClearable
            options={optionsWithFallback}
            value={selectedOption ?? undefined}
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
            loading={isCatalogTarget ? isLoadingElements || isLoadingAttributes : isLoadingEntities}
            loadingText={isCatalogTarget ? t('ref.loadingElements', 'Loading records...') : t('ref.loadingEntities', 'Loading entities...')}
            noOptionsText={
                isCatalogTarget
                    ? t('ref.noElementsAvailable', 'No records available')
                    : t('ref.noEntitiesAvailable', 'No entities available')
            }
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
                                {isCatalogTarget ? (
                                    isLoadingElements || isLoadingAttributes
                                ) : isLoadingEntities ? (
                                    <CircularProgress color='inherit' size={16} />
                                ) : null}
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
    optionListId: string
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
    optionListId,
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
        queryKey: metahubsQueryKeys.optionValuesList(metahubId, optionListId, { includeShared: true }),
        queryFn: () => listOptionValues(metahubId, optionListId, { includeShared: true }),
        enabled: Boolean(metahubId && optionListId)
    })

    const options = useMemo<EnumerationValueOption[]>(() => {
        const items = valuesData?.items ?? []
        return items
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((item) => ({
                id: item.id,
                label:
                    getVLCString(item.name, locale) ||
                    getVLCString(item.name, 'en') ||
                    getLocalizedCodenameString(item.codename, locale, item.id),
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
        effectiveValueForSelect !== null ? optionsWithEmpty.find((option) => option.id === effectiveValueForSelect) : undefined

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
            noOptionsText={t('ref.noOptionValuesAvailable', 'No values available')}
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

const RecordList = () => {
    const navigate = useNavigate()
    const { kindKey } = useParams<{ kindKey?: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const preferredVlcLocale = useMetahubPrimaryLocale()

    // ── Data from hook ──
    const {
        metahubId,
        hubIdParam,
        linkedCollectionId,
        effectiveTreeEntityId,
        treeEntities,
        catalogForHubResolution,
        isCatalogResolutionLoading,
        catalogResolutionError,
        fieldDefinitions,
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
    } = useRecordListData()

    // ── Local state ──
    const { dialogs, openCreate, openEdit, openCopy, openDelete, openConflict, close } = useListDialogs<RecordItem>()
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const updateLinkedCollectionMutation = useUpdateLinkedCollectionAtMetahub()

    // State management for dialog
    const [isSubmitting, setSubmitting] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [copyDialogError, setCopyDialogError] = useState<string | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    // Filter element actions based on settings
    const filteredRecordActions = useMemo(
        () =>
            recordActions.filter((a) => {
                if (a.id === 'copy' && allowElementCopy === false) return false
                if (a.id === 'delete' && allowElementDelete === false) return false
                return true
            }),
        [allowElementCopy, allowElementDelete]
    )

    const resolveFieldKey = useCallback(
        (definition: { id: string; codename: unknown }) => getFieldDefinitionKey(definition, i18n.language),
        [i18n.language]
    )

    const buildStringLengthHelperText = useCallback(
        (rules?: { minLength?: number | null; maxLength?: number | null }) => {
            const minLength = typeof rules?.minLength === 'number' ? rules.minLength : null
            const maxLength = typeof rules?.maxLength === 'number' ? rules.maxLength : null

            if (minLength === null && maxLength === null) return undefined
            if (minLength !== null && maxLength !== null) {
                return t('fieldDefinitions.validation.stringLengthRange', 'Length: {{min}}–{{max}}', { min: minLength, max: maxLength })
            }
            if (minLength !== null) {
                return t('fieldDefinitions.validation.stringMinLength', 'Min length: {{min}}', { min: minLength })
            }
            return t('fieldDefinitions.validation.stringMaxLength', 'Max length: {{max}}', { max: maxLength })
        },
        [t]
    )

    const buildNumberRangeHelperText = useCallback(
        (rules?: { min?: number | null; max?: number | null; nonNegative?: boolean }) => {
            const minValue = typeof rules?.min === 'number' ? rules.min : null
            const maxValue = typeof rules?.max === 'number' ? rules.max : null
            const isNonNegative = Boolean(rules?.nonNegative)

            if (minValue !== null && maxValue !== null) {
                return t('fieldDefinitions.validation.numberRange', 'Range: {{min}}–{{max}}', { min: minValue, max: maxValue })
            }
            if (minValue !== null) {
                return t('fieldDefinitions.validation.numberMin', 'Min value: {{min}}', { min: minValue })
            }
            if (maxValue !== null) {
                return t('fieldDefinitions.validation.numberMax', 'Max value: {{max}}', { max: maxValue })
            }
            if (isNonNegative) {
                return t('fieldDefinitions.validation.numberNonNegative', 'Non-negative value')
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

                // Build childFields for TABLE fieldDefinitions
                let childFields: DynamicFieldConfig[] | undefined
                if (attribute.dataType === 'TABLE' && childAttributesMap?.[attribute.id]) {
                    const children = childAttributesMap[attribute.id]
                    childFields = children
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                        .map((child) => {
                            const childKey = resolveFieldKey(child)
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
                                id: childKey,
                                label: getVLCString(child.name, i18n.language) || childKey,
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
                const attributeKey = resolveFieldKey(attribute)
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
                    id: attributeKey,
                    label: getVLCString(attribute.name, i18n.language) || attributeKey,
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
            resolveFieldKey,
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

            if (targetKind === 'catalog' || (targetKind !== 'enumeration' && targetKind !== 'set')) {
                return (
                    <ReferenceFieldAutocomplete
                        metahubId={metahubId}
                        targetEntityId={targetId}
                        targetEntityKind={targetKind}
                        value={typeof value === 'string' ? value : null}
                        onChange={(nextValue) => onChange(nextValue)}
                        label={field.label}
                        placeholder={
                            targetKind === 'catalog'
                                ? t('ref.selectElement', 'Select element...')
                                : t('ref.selectEntity', 'Select entity...')
                        }
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
                        optionListId={targetId}
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

            return undefined
        },
        [metahubId, t]
    )

    const { confirm } = useConfirm()

    const createElementMutation = useCreateRecord()
    const updateElementMutation = useUpdateRecord()
    const deleteElementMutation = useDeleteRecord()
    const moveElementMutation = useMoveRecord()
    const reorderElementMutation = useReorderRecord()

    const handlePendingElementInteraction = useCallback(
        (recordId: string) => {
            if (!metahubId || !linkedCollectionId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: effectiveTreeEntityId
                    ? metahubsQueryKeys.records(metahubId, effectiveTreeEntityId, linkedCollectionId)
                    : metahubsQueryKeys.recordsDirect(metahubId, linkedCollectionId),
                entityId: recordId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [linkedCollectionId, effectiveTreeEntityId, enqueueSnackbar, metahubId, pendingInteractionMessage, queryClient]
    )

    // Build dynamic columns based on fieldDefinitions
    const elementColumns = useMemo(() => {
        const cols: Array<{
            id: string
            label: string
            width: string
            align: 'left' | 'center' | 'right'
            render: (row: RecordItemDisplay) => React.ReactNode
        }> = []

        cols.push({
            id: 'sortOrder',
            label: t('records.table.order', '#'),
            width: '5%',
            align: 'center',
            render: (row: RecordItemDisplay) => (
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{typeof row.sortOrder === 'number' ? row.sortOrder : '—'}</Typography>
            )
        })

        // Add columns for first 4 fieldDefinitions
        const visibleAttrs = visibleAttributesForColumns
        visibleAttrs.forEach((attr) => {
            const attributeKey = resolveFieldKey(attr)
            cols.push({
                id: attributeKey,
                label: getVLCString(attr.name, i18n.language) || attributeKey,
                width: `${80 / Math.max(visibleAttrs.length, 1)}%`,
                align: 'left',
                render: (row: RecordItemDisplay) => {
                    const value = row.data?.[attributeKey]
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
                            const target = refTargetByAttribute[attributeKey]
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
                                    {rowCount > 0 ? t('records.table.rowCount', '{{count}} rows', { count: rowCount }) : '—'}
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
            label: t('records.table.updated', 'Updated'),
            width: '15%',
            align: 'left',
            render: (row: RecordItemDisplay) => (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
                </Typography>
            )
        })

        return cols
    }, [i18n.language, visibleAttributesForColumns, refDisplayMap, refTargetByAttribute, isFetchingRefDisplayMap, resolveFieldKey, t])

    const handleMoveElement = useCallback(
        async (recordId: string, direction: 'up' | 'down') => {
            if (!metahubId || !linkedCollectionId) return

            try {
                await moveElementMutation.mutateAsync({
                    metahubId,
                    treeEntityId: effectiveTreeEntityId,
                    linkedCollectionId,
                    recordId,
                    direction
                })
                enqueueSnackbar(t('records.moveSuccess', 'Element order updated'), { variant: 'success' })
            } catch (error: unknown) {
                const message =
                    typeof error === 'object' &&
                    error !== null &&
                    'message' in error &&
                    typeof (error as { message?: unknown }).message === 'string'
                        ? (error as { message: string }).message
                        : t('records.moveError', 'Failed to update element order')
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [linkedCollectionId, effectiveTreeEntityId, enqueueSnackbar, metahubId, moveElementMutation, t]
    )

    const createElementContext = useCallback(
        (
            baseContext: Partial<ElementMenuContext>
        ): ElementMenuContext & {
            orderMap: Map<string, number>
            totalCount: number
            moveElement: (recordId: string, direction: 'up' | 'down') => Promise<void>
        } => ({
            ...(baseContext as ElementMenuContext),
            orderMap: elementOrderMap,
            totalCount: sortedElements.length,
            moveElement: handleMoveElement,
            api: {
                updateEntity: async (id: string, patch: { data: ElementUpdatePatch }) => {
                    if (!metahubId || !linkedCollectionId) return
                    const element = elementMap.get(id)
                    const expectedVersion = element?.version
                    try {
                        await updateElementMutation.mutateAsync({
                            metahubId,
                            treeEntityId: effectiveTreeEntityId,
                            linkedCollectionId,
                            recordId: id,
                            data: { ...patch, expectedVersion }
                        })
                    } catch (error: unknown) {
                        if (isOptimisticLockConflict(error)) {
                            const conflict = extractConflictInfo(error)
                            if (conflict) {
                                openConflict({ conflict, pendingUpdate: { id, patch } })
                            }
                        }
                        throw error
                    }
                },
                deleteEntity: (id: string) => {
                    if (!metahubId || !linkedCollectionId) return Promise.resolve()
                    return deleteElementMutation.mutateAsync({
                        metahubId,
                        treeEntityId: effectiveTreeEntityId,
                        linkedCollectionId,
                        recordId: id
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId && linkedCollectionId) {
                        const invalidations: Promise<unknown>[] = []
                        if (effectiveTreeEntityId) {
                            invalidations.push(
                                invalidateRecordsQueries.all(queryClient, metahubId, effectiveTreeEntityId, linkedCollectionId)
                            )
                        }
                        invalidations.push(
                            queryClient.invalidateQueries({
                                queryKey: metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId)
                            })
                        )
                        invalidations.push(
                            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.recordsDirect(metahubId, linkedCollectionId) })
                        )
                        await Promise.all(invalidations)
                    }
                },
                confirm: async (spec: ElementConfirmSpec) => {
                    const translate = baseContext.t ?? t
                    const confirmed = await confirm({
                        title: spec.titleKey ? translate(spec.titleKey, spec.interpolate) : spec.title || '',
                        description: spec.descriptionKey ? translate(spec.descriptionKey, spec.interpolate) : spec.description || '',
                        confirmButtonName: spec.confirmKey
                            ? translate(spec.confirmKey)
                            : spec.confirmButtonName || translate('confirm.delete.confirm'),
                        cancelButtonName: spec.cancelKey
                            ? translate(spec.cancelKey)
                            : spec.cancelButtonName || translate('confirm.delete.cancel')
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
                openDeleteDialog: (element: RecordItemDisplay) => {
                    const fullElement = elementMap.get(element.id) ?? (element as unknown as RecordItem)
                    openDelete(fullElement)
                },
                openEditDialog: async (element: RecordItem | RecordItemDisplay) => {
                    if (!metahubId || !linkedCollectionId) return
                    const hasData = typeof (element as RecordItem).data === 'object'
                    let fullRecord: RecordItem | null = null
                    if (hasData && (element as RecordItem).data) {
                        fullRecord = element as RecordItem
                    } else {
                        fullRecord = elementMap.get(element.id) || null
                        if (!fullRecord) {
                            try {
                                if (effectiveTreeEntityId) {
                                    fullRecord = (
                                        await recordsApi.getRecord(metahubId, effectiveTreeEntityId, linkedCollectionId, element.id)
                                    ).data
                                } else {
                                    fullRecord = (await recordsApi.getRecordDirect(metahubId, linkedCollectionId, element.id)).data
                                }
                            } catch {
                                fullRecord = null
                            }
                        }
                    }
                    if (fullRecord) {
                        openEdit(fullRecord)
                    } else {
                        enqueueSnackbar(t('records.updateError', 'Failed to update element'), { variant: 'error' })
                    }
                },
                openCopyDialog: async (element: RecordItem | RecordItemDisplay) => {
                    const fullRecord =
                        typeof (element as RecordItem).data === 'object' ? (element as RecordItem) : elementMap.get(element.id) || null
                    if (!fullRecord) {
                        enqueueSnackbar(t('records.copyError', 'Failed to copy element'), { variant: 'error' })
                        return
                    }
                    setCopyDialogError(null)
                    openCopy(fullRecord)
                }
            } as ElementMenuContext['helpers'] & {
                openEditDialog: (element: RecordItem | RecordItemDisplay) => Promise<void>
                openCopyDialog: (element: RecordItem | RecordItemDisplay) => Promise<void>
            }
        }),
        [
            linkedCollectionId,
            confirm,
            deleteElementMutation,
            elementOrderMap,
            effectiveTreeEntityId,
            enqueueSnackbar,
            handleMoveElement,
            metahubId,
            openConflict,
            openCopy,
            openDelete,
            openEdit,
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
            fieldDefinitions: orderedAttributes.map((attribute) => ({
                dataType: attribute.dataType,
                codename: resolveFieldKey(attribute)
            })),
            locale: i18n.language
        })
    }, [dialogs.copy.item?.data, i18n.language, orderedAttributes, resolveFieldKey])

    const applySetReferenceDefaultsToPayload = useCallback(
        (inputData: Record<string, unknown>): Record<string, unknown> => {
            const nextData: Record<string, unknown> = { ...inputData }

            orderedAttributes.forEach((attribute) => {
                const attributeKey = resolveFieldKey(attribute)
                if (attribute.dataType === 'REF' && attribute.targetEntityKind === 'set' && attribute.targetConstantId) {
                    const currentValue = resolveRefId(nextData[attributeKey])
                    if (!currentValue || currentValue !== attribute.targetConstantId) {
                        nextData[attributeKey] = attribute.targetConstantId
                    }
                    return
                }

                if (attribute.dataType !== 'TABLE') return
                const childAttributes = childAttributesMap?.[attribute.id] ?? []
                if (childAttributes.length === 0) return
                const rawRows = nextData[attributeKey]
                if (!Array.isArray(rawRows)) return

                nextData[attributeKey] = rawRows.map((rawRow) => {
                    if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) return rawRow
                    const row = { ...(rawRow as Record<string, unknown>) }
                    childAttributes.forEach((child) => {
                        const childKey = resolveFieldKey(child)
                        if (child.dataType !== 'REF' || child.targetEntityKind !== 'set' || !child.targetConstantId) return
                        const currentValue = resolveRefId(row[childKey])
                        if (!currentValue || currentValue !== child.targetConstantId) {
                            row[childKey] = child.targetConstantId
                        }
                    })
                    return row
                })
            })

            return nextData
        },
        [childAttributesMap, orderedAttributes, resolveFieldKey]
    )

    const buildCatalogTabPath = useCallback(
        (tab: 'fieldDefinitions' | 'system' | 'records') =>
            buildLinkedCollectionAuthoringPath({
                metahubId,
                treeEntityId: hubIdParam,
                kindKey,
                linkedCollectionId,
                tab
            }),
        [linkedCollectionId, hubIdParam, kindKey, metahubId]
    )

    // Validate required route params after all hooks are declared.
    if (!metahubId || !linkedCollectionId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt={t('records.parentCollectionMissingTitle', 'No linked collection selected')}
                title={t('records.parentCollectionMissingTitle', 'No linked collection selected')}
                description={t('records.parentCollectionMissingDescription', 'Select a linked collection to manage records.')}
            />
        )
    }

    // Show loading state while resolving the parent linked collection.
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

    // Show error only when parent linked-collection resolution fails.
    if (!hubIdParam && catalogResolutionError) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt={t('records.parentCollectionLoadError', 'Error loading linked collection')}
                title={t('records.parentCollectionLoadError', 'Error loading linked collection')}
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

    const handleCatalogTabChange = (_event: unknown, nextTab: 'fieldDefinitions' | 'system' | 'records' | 'settings') => {
        if (!metahubId || !linkedCollectionId) return
        if (nextTab === 'records') return
        if (nextTab === 'settings') {
            setEditDialogOpen(true)
            return
        }
        const nextPath = buildCatalogTabPath(nextTab === 'system' ? 'system' : 'fieldDefinitions')
        if (nextPath) {
            navigate(nextPath)
        }
    }

    const handleCreateElement = async (data: Record<string, unknown>) => {
        setDialogError(null)
        setSubmitting(true)
        try {
            const normalizedData = applySetReferenceDefaultsToPayload(data)
            await createElementMutation.mutateAsync({
                metahubId,
                treeEntityId: effectiveTreeEntityId,
                linkedCollectionId,
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
                    : t('records.createError')
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
                treeEntityId: effectiveTreeEntityId,
                linkedCollectionId,
                recordId: dialogs.edit.item.id,
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
                    : t('records.updateError')
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
                treeEntityId: effectiveTreeEntityId,
                linkedCollectionId,
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
                    : t('records.copyError', 'Failed to copy element')
            )
        } finally {
            setSubmitting(false)
        }
    }

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId || !linkedCollectionId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overElement = sortedElements.find((element) => element.id === String(over.id))
        if (!overElement) return

        try {
            await reorderElementMutation.mutateAsync({
                metahubId,
                treeEntityId: effectiveTreeEntityId,
                linkedCollectionId,
                recordId: String(active.id),
                newSortOrder: overElement.sortOrder ?? 1
            })
            enqueueSnackbar(t('records.reorderSuccess', 'Element order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('records.reorderError', 'Failed to reorder element')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const element = elementMap.get(activeId)
        if (!element) return null
        const display = toRecordItemDisplay(element, fieldDefinitions, i18n.language)
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
    const getElementTableData = (element: RecordItem): RecordItemDisplay => toRecordItemDisplay(element, fieldDefinitions, i18n.language)

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
                        searchPlaceholder={t('records.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('records.title')}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('create'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />,
                                disabled: fieldDefinitions.length === 0
                            }}
                        />
                    </ViewHeader>

                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs
                            value='records'
                            onChange={handleCatalogTabChange}
                            aria-label={t('records.parentCollectionTabsLabel', 'Linked collection tabs')}
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
                            <Tab value='fieldDefinitions' label={t('fieldDefinitions.title')} />
                            <Tab value='system' label={t('fieldDefinitions.tabs.system', 'System')} />
                            <Tab value='records' label={t('records.title')} />
                            <Tab value='settings' label={t('settings.title')} />
                        </Tabs>
                    </Box>

                    {isLoading && sortedElements.length === 0 ? (
                        <Skeleton variant='rectangular' height={120} />
                    ) : !isLoading && sortedElements.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No records'
                            title={t('records.empty')}
                            description={fieldDefinitions.length === 0 ? t('records.addAttributesFirst') : t('records.emptyDescription')}
                        />
                    ) : (
                        <Box>
                            <FlowListTable
                                data={sortedElements.map(getElementTableData)}
                                images={images}
                                isLoading={isLoading}
                                onPendingInteractionAttempt={(row: RecordItemDisplay) => handlePendingElementInteraction(row.id)}
                                customColumns={elementColumns}
                                sortableRows
                                sortableItemIds={sortedElements.map((element) => element.id)}
                                dragHandleAriaLabel={t('records.dnd.dragHandle', 'Drag to reorder')}
                                dragDisabled={reorderElementMutation.isPending || isLoading}
                                onSortableDragEnd={handleSortableDragEnd}
                                renderDragOverlay={renderDragOverlay}
                                i18nNamespace='flowList'
                                renderActions={(row: RecordItemDisplay) => {
                                    const originalElement = elementMap.get(row.id)
                                    if (!originalElement) return null

                                    const descriptors = [...filteredRecordActions]
                                    if (!descriptors.length) return null

                                    return (
                                        <BaseEntityMenu<RecordItemDisplay, { data: Record<string, unknown> }>
                                            entity={toRecordItemDisplay(originalElement, fieldDefinitions, i18n.language)}
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
                        <Box sx={{ mt: 2 }}>
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
                title={t('records.createDialog.title', 'Add Record')}
                locale={i18n.language}
                requireAnyValue
                emptyStateText={t('records.noAttributes')}
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
                title={t('records.editDialog.title', 'Edit Element')}
                locale={i18n.language}
                fields={elementFields}
                requireAnyValue
                emptyStateText={t('records.noAttributes')}
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
                title={t('records.copyTitle', 'Копирование элемента')}
                locale={i18n.language}
                fields={elementFields}
                requireAnyValue
                emptyStateText={t('records.noAttributes')}
                saveButtonText={t('records.copy.action', 'Copy')}
                savingButtonText={t('records.copy.actionLoading', 'Copying...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                renderField={renderElementField}
            />

            {/* Independent ConfirmDeleteDialog */}
            <ConfirmDeleteDialog
                open={dialogs.delete.open}
                title={t('records.deleteDialog.title', 'Delete Record')}
                description={t(
                    'records.deleteDialog.message',
                    'Are you sure you want to delete this record? This action cannot be undone.'
                )}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => close('delete')}
                onConfirm={() => {
                    if (!dialogs.delete.item) return

                    deleteElementMutation.mutate(
                        {
                            metahubId,
                            treeEntityId: effectiveTreeEntityId,
                            linkedCollectionId,
                            recordId: dialogs.delete.item.id
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
                                        : t('records.deleteError')
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
                    if (metahubId && linkedCollectionId) {
                        if (effectiveTreeEntityId) {
                            invalidateRecordsQueries.all(queryClient, metahubId, effectiveTreeEntityId, linkedCollectionId)
                        }
                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.recordsDirect(metahubId, linkedCollectionId) })
                    }
                }}
                onOverwrite={async () => {
                    const pendingUpdate = (dialogs.conflict.data as { pendingUpdate?: { id: string; patch: { data: ElementUpdatePatch } } })
                        ?.pendingUpdate
                    if (pendingUpdate && metahubId && linkedCollectionId) {
                        const { id, patch } = pendingUpdate
                        await updateElementMutation.mutateAsync({
                            metahubId,
                            treeEntityId: effectiveTreeEntityId,
                            linkedCollectionId,
                            recordId: id,
                            data: patch
                        })
                        close('conflict')
                    }
                }}
                isLoading={updateElementMutation.isPending}
            />

            {catalogForHubResolution &&
                linkedCollectionId &&
                (() => {
                    const catalogDisplay: LinkedCollectionDisplayWithContainer = {
                        id: catalogForHubResolution.id,
                        metahubId: catalogForHubResolution.metahubId,
                        codename: getLocalizedCodenameString(
                            catalogForHubResolution.codename,
                            preferredVlcLocale,
                            catalogForHubResolution.id
                        ),
                        name:
                            getVLCString(catalogForHubResolution.name, preferredVlcLocale) ||
                            getLocalizedCodenameString(catalogForHubResolution.codename, preferredVlcLocale, catalogForHubResolution.id),
                        description: getVLCString(catalogForHubResolution.description, preferredVlcLocale) || '',
                        isSingleHub: catalogForHubResolution.isSingleHub,
                        isRequiredHub: catalogForHubResolution.isRequiredHub,
                        sortOrder: catalogForHubResolution.sortOrder,
                        createdAt: catalogForHubResolution.createdAt,
                        updatedAt: catalogForHubResolution.updatedAt,
                        treeEntityId: effectiveTreeEntityId || undefined,
                        treeEntities: catalogForHubResolution.treeEntities?.map((h) => ({
                            id: h.id,
                            name:
                                (typeof h.name === 'string' && h.name) || getLocalizedCodenameString(h.codename, preferredVlcLocale, h.id),
                            codename: getLocalizedCodenameString(h.codename, preferredVlcLocale, h.id)
                        }))
                    }
                    const catalogMap = new Map<string, LinkedCollectionEntity>([[catalogForHubResolution.id, catalogForHubResolution]])
                    const settingsCtx = {
                        entity: catalogDisplay,
                        entityKind: 'catalog' as const,
                        t,
                        catalogMap,
                        metahubId,
                        currentTreeEntityId: effectiveTreeEntityId || null,
                        uiLocale: preferredVlcLocale,
                        api: {
                            updateEntity: async (id: string, patch: LinkedCollectionLocalizedPayload) => {
                                if (!metahubId) return
                                await updateLinkedCollectionMutation.mutateAsync({
                                    metahubId,
                                    linkedCollectionId: id,
                                    data: { ...patch, expectedVersion: catalogForHubResolution.version }
                                })
                            }
                        },
                        helpers: {
                            refreshList: async () => {
                                if (metahubId && linkedCollectionId) {
                                    await Promise.all([
                                        queryClient.invalidateQueries({
                                            queryKey: metahubsQueryKeys.linkedCollectionDetail(metahubId, linkedCollectionId)
                                        }),
                                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allLinkedCollections(metahubId) }),
                                        queryClient.invalidateQueries({
                                            queryKey: ['breadcrumb', 'catalog-standalone', metahubId, linkedCollectionId]
                                        }),
                                        queryClient.invalidateQueries({ queryKey: ['breadcrumb', 'catalog', metahubId] })
                                    ])
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
                            title={t('records.parentCollectionEditTitle', 'Edit linked collection')}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            saveButtonText={tc('actions.save', 'Save')}
                            savingButtonText={tc('actions.saving', 'Saving...')}
                            cancelButtonText={tc('actions.cancel', 'Cancel')}
                            hideDefaultFields
                            initialExtraValues={buildCatalogInitialValues(settingsCtx)}
                            tabs={buildLinkedCollectionFormTabs(settingsCtx, treeEntities, linkedCollectionId)}
                            validate={(values) => validateLinkedCollectionForm(settingsCtx, values)}
                            canSave={canSaveLinkedCollectionForm}
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

export default RecordList
