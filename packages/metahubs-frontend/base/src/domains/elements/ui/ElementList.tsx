import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
    usePaginated,
    useDebouncedSearch,
    PaginationControls,
    FlowListTable,
    ConfirmDialog,
    useConfirm
} from '@universo/template-mui'
import { ConfirmDeleteDialog, DynamicEntityFormDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreateElement, useUpdateElement, useDeleteElement } from '../hooks/mutations'
import * as elementsApi from '../api'
import * as attributesApi from '../../attributes'
import { getCatalogById } from '../../catalogs'
import { listEnumerationValues } from '../../enumerations/api'
import { metahubsQueryKeys, invalidateElementsQueries } from '../../shared'
import { HubElement, HubElementDisplay, getVLCString, toHubElementDisplay } from '../../../types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import elementActions from './ElementActions'
import type { DynamicFieldConfig, DynamicFieldValidationRules } from '@universo/template-mui/components/dialogs'

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

type ElementOption = {
    id: string
    name: string
}

type RefTargetDescriptor = {
    kind: 'catalog' | 'enumeration'
    targetId: string
}

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

    const targetAttributes = targetAttributesData?.items ?? []

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
            label: t('ref.unknownEnumerationValue', 'Value {{id}}', { id: value.slice(0, 8) })
        }
    }, [options, t, value])

    const optionsWithFallback = useMemo(() => {
        if (!selectedOption) return options
        if (options.some((option) => option.id === selectedOption.id)) return options
        return [selectedOption, ...options]
    }, [options, selectedOption])

    const fallbackDefaultValueId = defaultValueId ?? optionsWithFallback.find((option) => option.isDefault)?.id ?? null
    const effectiveValue = typeof value === 'string' && value.length > 0 ? value : fallbackDefaultValueId
    const effectiveOption = effectiveValue ? optionsWithFallback.find((option) => option.id === effectiveValue) ?? null : null

    if (mode === 'label') {
        return (
            <FormControl fullWidth error={Boolean(error)}>
                <Typography variant='caption' color='text.secondary'>
                    {label}
                </Typography>
                <Typography variant='body1'>{effectiveOption?.label ?? (emptyDisplay === 'empty' ? '' : '—')}</Typography>
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
                <RadioGroup value={effectiveValue ?? ''} onChange={(event) => onChange(event.target.value || null)}>
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
            disableClearable={required || !allowEmpty}
            options={optionsWithFallback}
            value={effectiveOption}
            onChange={(_event, newValue) => onChange(newValue?.id ?? null)}
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
    const { metahubId, hubId: hubIdParam, catalogId } = useParams<{ metahubId: string; hubId?: string; catalogId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [editingElement, setEditingElement] = useState<HubElement | null>(null)

    // When accessed via catalog-centric routes (/metahub/:id/catalogs/:catalogId/*), hubId is not in the URL.
    // Resolve a stable hubId from the catalog's hub associations.
    const {
        data: catalogForHubResolution,
        isLoading: isCatalogResolutionLoading,
        error: catalogResolutionError
    } = useQuery({
        queryKey:
            metahubId && catalogId ? metahubsQueryKeys.catalogDetail(metahubId, catalogId) : ['metahubs', 'catalogs', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !catalogId) {
                throw new Error('metahubId and catalogId are required')
            }
            return getCatalogById(metahubId, catalogId)
        },
        enabled: !!metahubId && !!catalogId && !hubIdParam
    })

    // Hub ID from URL param, or resolved from catalog (for hub-scoped views)
    // Note: undefined means no hub - catalog exists without hub association, which is valid
    const effectiveHubId = hubIdParam || catalogForHubResolution?.hubs?.[0]?.id

    // State management for dialog
    const [isSubmitting, setSubmitting] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Can load data when we have metahubId and catalogId
    // hubId is optional - elements/attributes belong to catalog directly
    const canLoadData = !!metahubId && !!catalogId && (!hubIdParam || !isCatalogResolutionLoading)

    // Fetch attributes for this catalog to build dynamic columns and forms
    const { data: attributesData } = useQuery({
        queryKey:
            metahubId && catalogId
                ? effectiveHubId
                    ? metahubsQueryKeys.attributesList(metahubId, effectiveHubId, catalogId, { limit: 100, locale: i18n.language })
                    : metahubsQueryKeys.attributesListDirect(metahubId, catalogId, { limit: 100, locale: i18n.language })
                : ['empty'],
        queryFn:
            metahubId && catalogId
                ? () =>
                      effectiveHubId
                          ? attributesApi.listAttributes(metahubId, effectiveHubId, catalogId, { limit: 100, locale: i18n.language })
                          : attributesApi.listAttributesDirect(metahubId, catalogId, { limit: 100, locale: i18n.language })
                : async () => ({ items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } }),
        enabled: canLoadData
    })

    const attributes = attributesData?.items ?? []

    const orderedAttributes = useMemo(
        () =>
            attributes
                .map((attr, index) => ({ attr, index }))
                .sort((a, b) => {
                    const orderA = a.attr.sortOrder ?? 0
                    const orderB = b.attr.sortOrder ?? 0
                    return orderA - orderB || a.index - b.index
                })
                .map((item) => item.attr),
        [attributes]
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
                const resolvedTargetEntityId = attribute.targetEntityId ?? attribute.targetCatalogId ?? null
                const resolvedTargetEntityKind = attribute.targetEntityKind ?? (attribute.targetCatalogId ? 'catalog' : null)
                const uiConfig = (attribute.uiConfig ?? {}) as Record<string, unknown>
                const enumPresentationMode =
                    uiConfig.enumPresentationMode === 'radio' || uiConfig.enumPresentationMode === 'label'
                        ? uiConfig.enumPresentationMode
                        : 'select'
                const defaultEnumValueId = typeof uiConfig.defaultEnumValueId === 'string' ? uiConfig.defaultEnumValueId : null
                const enumAllowEmpty = uiConfig.enumAllowEmpty !== false
                const enumLabelEmptyDisplay = uiConfig.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'

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
                    enumPresentationMode,
                    defaultEnumValueId,
                    enumAllowEmpty,
                    enumLabelEmptyDisplay
                }
            }),
        [orderedAttributes, i18n.language, buildStringLengthHelperText, buildNumberRangeHelperText]
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

    // Use paginated hook for elements list
    const paginationResult = usePaginated<HubElement, 'created' | 'updated'>({
        queryKeyFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? metahubsQueryKeys.elementsList(metahubId, effectiveHubId, catalogId, params)
                          : metahubsQueryKeys.elementsListDirect(metahubId, catalogId, params)
                : () => ['empty'],
        queryFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? elementsApi.listElements(metahubId, effectiveHubId, catalogId, params)
                          : elementsApi.listElementsDirect(metahubId, catalogId, params)
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: canLoadData
    })

    const { data: elements, isLoading, error } = paginationResult
    // usePaginated already returns the items array as `data`, here aliased to `elements`

    // Instant search for better UX
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        element: HubElement | null
    }>({ open: false, element: null })

    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingUpdate: { id: string; patch: { data: Record<string, unknown> } } | null
    }>({ open: false, conflict: null, pendingUpdate: null })

    const { confirm } = useConfirm()

    const createElementMutation = useCreateElement()
    const updateElementMutation = useUpdateElement()
    const deleteElementMutation = useDeleteElement()

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(elements)) {
            elements.forEach((element) => {
                if (element?.id) {
                    imagesMap[element.id] = []
                }
            })
        }
        return imagesMap
    }, [elements])

    const elementMap = useMemo(() => {
        if (!Array.isArray(elements)) return new Map<string, HubElement>()
        return new Map(elements.map((element) => [element.id, element]))
    }, [elements])

    const orderedAttributesForColumns = orderedAttributes
    const visibleAttributesForColumns = useMemo(() => orderedAttributesForColumns.slice(0, 4), [orderedAttributesForColumns])

    const refAttributesForColumns = useMemo(() => {
        return visibleAttributesForColumns.filter((attr) => {
            const targetKind = attr.targetEntityKind ?? (attr.targetCatalogId ? 'catalog' : null)
            const targetId = attr.targetEntityId ?? attr.targetCatalogId ?? null
            return attr.dataType === 'REF' && (targetKind === 'catalog' || targetKind === 'enumeration') && Boolean(targetId)
        })
    }, [visibleAttributesForColumns])

    const refTargetByAttribute = useMemo(() => {
        const map: Record<string, RefTargetDescriptor> = {}
        refAttributesForColumns.forEach((attr) => {
            const targetKind = attr.targetEntityKind ?? (attr.targetCatalogId ? 'catalog' : null)
            const targetId = attr.targetEntityId ?? attr.targetCatalogId ?? null
            if (!targetId || (targetKind !== 'catalog' && targetKind !== 'enumeration')) return
            map[attr.codename] = { kind: targetKind, targetId }
        })
        return map
    }, [refAttributesForColumns])

    const refIdsByTarget = useMemo(() => {
        const map: Record<string, Set<string>> = {}
        if (!Array.isArray(elements) || refAttributesForColumns.length === 0) return map

        refAttributesForColumns.forEach((attr) => {
            const targetKind = attr.targetEntityKind ?? (attr.targetCatalogId ? 'catalog' : null)
            const targetId = attr.targetEntityId ?? attr.targetCatalogId ?? null
            if (!targetId || (targetKind !== 'catalog' && targetKind !== 'enumeration')) return

            const mapKey = `${targetKind}:${targetId}`
            if (!map[mapKey]) map[mapKey] = new Set()
            elements.forEach((element) => {
                const rawValue = element.data?.[attr.codename]
                if (typeof rawValue === 'string' && rawValue) {
                    map[mapKey].add(rawValue)
                }
            })
        })

        return map
    }, [elements, refAttributesForColumns])

    const refIdsKey = useMemo(() => {
        return Object.entries(refIdsByTarget)
            .map(([targetKey, idsSet]) => ({
                targetKey,
                ids: Array.from(idsSet).sort()
            }))
            .sort((a, b) => a.targetKey.localeCompare(b.targetKey))
    }, [refIdsByTarget])

    const { data: refDisplayMap, isFetching: isFetchingRefDisplayMap } = useQuery({
        queryKey: ['metahubs', 'ref-display', metahubId, refIdsKey, i18n.language],
        enabled: Boolean(metahubId && refIdsKey.length > 0),
        staleTime: 30000,
        queryFn: async () => {
            if (!metahubId) return {}
            const result: Record<string, Record<string, string>> = {}

            for (const entry of refIdsKey) {
                if (!entry.ids.length) continue
                const [targetKind, targetId] = entry.targetKey.split(':')
                if (!targetId || (targetKind !== 'catalog' && targetKind !== 'enumeration')) continue

                if (targetKind === 'catalog') {
                    const attributesResponse = await attributesApi.listAttributesDirect(metahubId, targetId, {
                        limit: 100,
                        locale: i18n.language
                    })
                    const targetAttributes = attributesResponse?.items ?? []

                    const elementsResponse = await Promise.all(
                        entry.ids.map(async (id) => {
                            try {
                                const response = await elementsApi.getElementDirect(metahubId, targetId, id)
                                return response.data
                            } catch {
                                return null
                            }
                        })
                    )

                    const displayMap: Record<string, string> = {}
                    elementsResponse.filter(Boolean).forEach((element) => {
                        const display = toHubElementDisplay(element as HubElement, targetAttributes, i18n.language)
                        displayMap[(element as HubElement).id] = display.name || (element as HubElement).id
                    })

                    result[entry.targetKey] = displayMap
                    continue
                }

                const valuesResponse = await listEnumerationValues(metahubId, targetId)
                const valuesDisplayMap: Record<string, string> = {}
                valuesResponse.items.forEach((item) => {
                    valuesDisplayMap[item.id] = getVLCString(item.name, i18n.language) || getVLCString(item.name, 'en') || item.codename
                })
                result[entry.targetKey] = valuesDisplayMap
            }

            return result
        }
    })

    // Build dynamic columns based on attributes
    const elementColumns = useMemo(() => {
        const cols: Array<{
            id: string
            label: string
            width: string
            align: 'left' | 'center' | 'right'
            render: (row: HubElementDisplay) => React.ReactNode
        }> = []

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
                            const localizedValue =
                                value && typeof value === 'object' && 'locales' in (value as any)
                                    ? getVLCString(value as VersionedLocalizedContent<string>, i18n.language)
                                    : String(value)
                            return (
                                <Typography sx={{ fontSize: 14 }} noWrap>
                                    {localizedValue || '—'}
                                </Typography>
                            )
                        }
                        case 'REF': {
                            const target = refTargetByAttribute[attr.codename]
                            const targetKey = target ? `${target.kind}:${target.targetId}` : null
                            const displayName = targetKey && typeof value === 'string' ? refDisplayMap?.[targetKey]?.[value] : undefined
                            const isMappingLoading = Boolean(targetKey) && isFetchingRefDisplayMap
                            return (
                                <Typography sx={{ fontSize: 14 }} noWrap>
                                    {displayName || (isMappingLoading ? '...' : '—')}
                                </Typography>
                            )
                        }
                        case 'BOOLEAN':
                            return value ? '✓' : '✗'
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

    const createElementContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
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
                                setConflictState({ open: true, conflict, pendingUpdate: { id, patch: { data: patch } } })
                                return
                            }
                        }
                        throw error
                    }
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId || !catalogId) return
                    await deleteElementMutation.mutateAsync({ metahubId, hubId: effectiveHubId, catalogId, elementId: id })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId && catalogId) {
                        if (effectiveHubId) {
                            await invalidateElementsQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                        }
                        // Also invalidate catalog-level queries
                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(metahubId, catalogId) })
                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsDirect(metahubId, catalogId) })
                    }
                },
                confirm: async (spec: any) => {
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
                    setDeleteDialogState({ open: true, element: fullElement })
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
                        setEditingElement(fullRecord)
                    } else {
                        enqueueSnackbar(t('elements.updateError', 'Failed to update element'), { variant: 'error' })
                    }
                }
            }
        }),
        [
            catalogId,
            confirm,
            deleteElementMutation,
            effectiveHubId,
            enqueueSnackbar,
            metahubId,
            queryClient,
            elementMap,
            t,
            updateElementMutation
        ]
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
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleEditClose = () => {
        setEditingElement(null)
        setDialogError(null)
    }

    const handleCatalogTabChange = (_event: unknown, nextTab: 'attributes' | 'elements') => {
        if (!metahubId || !catalogId || nextTab === 'elements') return
        if (hubIdParam) {
            navigate(`/metahub/${metahubId}/hub/${hubIdParam}/catalog/${catalogId}/attributes`)
            return
        }
        navigate(`/metahub/${metahubId}/catalog/${catalogId}/attributes`)
    }

    const handleCreateElement = async (data: Record<string, unknown>) => {
        setDialogError(null)
        setSubmitting(true)
        try {
            await createElementMutation.mutateAsync({
                metahubId,
                hubId: effectiveHubId,
                catalogId,
                data: { data }
            })

            // Invalidation handled by mutation hook
            handleDialogClose()
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
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
        if (!editingElement) return

        setDialogError(null)
        setSubmitting(true)
        try {
            await updateElementMutation.mutateAsync({
                metahubId,
                hubId: effectiveHubId,
                catalogId,
                elementId: editingElement.id,
                data: { data }
            })

            // Invalidation handled by mutation hook
            handleEditClose()
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
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
                    description={!(error as any)?.response?.status ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
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

                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
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
                            <Tab value='elements' label={t('elements.title')} />
                        </Tabs>
                    </Box>

                    {isLoading && elements.length === 0 ? (
                        <Skeleton variant='rectangular' height={120} />
                    ) : !isLoading && elements.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No elements'
                            title={t('elements.empty')}
                            description={attributes.length === 0 ? t('elements.addAttributesFirst') : t('elements.emptyDescription')}
                        />
                    ) : (
                        <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                            <FlowListTable
                                data={elements.map(getElementTableData)}
                                images={images}
                                isLoading={isLoading}
                                customColumns={elementColumns}
                                i18nNamespace='flowList'
                                renderActions={(row: any) => {
                                    const originalElement = elements.find((element) => element.id === row.id)
                                    if (!originalElement) return null

                                    const descriptors = [...elementActions]
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
                    {!isLoading && elements.length > 0 && (
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
                open={isDialogOpen}
                onClose={handleDialogClose}
                onSubmit={handleCreateElement}
                fields={elementFields}
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
                open={!!editingElement}
                onClose={handleEditClose}
                onSubmit={handleUpdateElement}
                initialData={editingElement?.data}
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
                    if (editingElement) {
                        setDeleteDialogState({ open: true, element: editingElement })
                    }
                }}
                renderField={renderElementField}
            />

            {/* Independent ConfirmDeleteDialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('elements.deleteDialog.title')}
                description={t('elements.deleteDialog.message')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, element: null })}
                onConfirm={async () => {
                    if (deleteDialogState.element) {
                        try {
                            await deleteElementMutation.mutateAsync({
                                metahubId,
                                hubId: effectiveHubId,
                                catalogId,
                                elementId: deleteDialogState.element.id
                            })
                            setDeleteDialogState({ open: false, element: null })
                        } catch (err: unknown) {
                            const responseMessage =
                                err && typeof err === 'object' && 'response' in err ? (err as any)?.response?.data?.message : undefined
                            const message =
                                typeof responseMessage === 'string'
                                    ? responseMessage
                                    : err instanceof Error
                                    ? err.message
                                    : typeof err === 'string'
                                    ? err
                                    : t('elements.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, element: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />

            <ConflictResolutionDialog
                open={conflictState.open}
                conflict={conflictState.conflict}
                onCancel={() => {
                    setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    if (metahubId && catalogId) {
                        if (effectiveHubId) {
                            invalidateElementsQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                        }
                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsDirect(metahubId, catalogId) })
                    }
                }}
                onOverwrite={async () => {
                    if (conflictState.pendingUpdate && metahubId && catalogId) {
                        const { id, patch } = conflictState.pendingUpdate
                        await updateElementMutation.mutateAsync({
                            metahubId,
                            hubId: effectiveHubId,
                            catalogId,
                            elementId: id,
                            data: patch
                        })
                        setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    }
                }}
                isLoading={updateElementMutation.isPending}
            />
        </MainCard>
    )
}

export default ElementList
