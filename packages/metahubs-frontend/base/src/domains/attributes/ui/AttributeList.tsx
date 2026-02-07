import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box,
    Skeleton,
    Stack,
    Typography,
    Chip,
    Divider,
    Alert,
    ToggleButtonGroup,
    ToggleButton,
    Tooltip
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ListAltIcon from '@mui/icons-material/ListAlt'
import TableRowsIcon from '@mui/icons-material/TableRows'
import InfoIcon from '@mui/icons-material/Info'
import StarIcon from '@mui/icons-material/Star'
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
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreateAttribute, useUpdateAttribute, useDeleteAttribute, useMoveAttribute, useToggleAttributeRequired, useSetDisplayAttribute, useClearDisplayAttribute } from '../hooks/mutations'
import * as attributesApi from '../api'
import { getCatalogById } from '../../catalogs'
import { metahubsQueryKeys, invalidateAttributesQueries } from '../../shared'
import type { VersionedLocalizedContent, MetaEntityKind } from '@universo/types'
import { 
    Attribute, 
    AttributeDisplay, 
    AttributeDataType, 
    AttributeLocalizedPayload, 
    toAttributeDisplay,
    AttributeValidationRules,
    getPhysicalDataType,
    formatPhysicalType
} from '../../../types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent } from '../../../utils/localizedInput'
import attributeActions from './AttributeActions'
import AttributeFormFields from './AttributeFormFields'

type AttributeFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
    dataType?: AttributeDataType
    isRequired?: boolean
    isDisplayAttribute?: boolean
    validationRules?: AttributeValidationRules
    targetEntityId?: string | null
    targetEntityKind?: MetaEntityKind | null
}

// Get color for data type chip
const getDataTypeColor = (dataType: AttributeDataType): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
    switch (dataType) {
        case 'STRING':
            return 'primary'
        case 'NUMBER':
            return 'secondary'
        case 'BOOLEAN':
            return 'success'
        case 'DATE':
            return 'warning'
        case 'REF':
            return 'info'
        case 'JSON':
            return 'default'
        default:
            return 'default'
    }
}

const AttributeList = () => {
    const navigate = useNavigate()
    const { metahubId, hubId: hubIdParam, catalogId } = useParams<{ metahubId: string; hubId?: string; catalogId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)

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
    // Note: empty string means no hub - catalog exists without hub association, which is valid
    const effectiveHubId = hubIdParam || catalogForHubResolution?.hubs?.[0]?.id

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Can load attributes when we have metahubId and catalogId
    // hubId is optional - attributes belong to catalog directly
    const canLoadAttributes = !!metahubId && !!catalogId && (!hubIdParam || !isCatalogResolutionLoading)

    const attributesLimit = 100

    // Use paginated hook for attributes list
    const paginationResult = usePaginated<Attribute, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? metahubsQueryKeys.attributesList(metahubId, effectiveHubId, catalogId, {
                                ...params,
                                locale: i18n.language
                            })
                          : metahubsQueryKeys.attributesListDirect(metahubId, catalogId, { ...params, locale: i18n.language })
                : () => ['empty'],
        queryFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? attributesApi.listAttributes(metahubId, effectiveHubId, catalogId, {
                                ...params,
                                locale: i18n.language
                            })
                          : attributesApi.listAttributesDirect(metahubId, catalogId, { ...params, locale: i18n.language })
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: canLoadAttributes
    })

    const { data: attributes, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    const attributesMeta = paginationResult.meta as { totalAll?: number; limit?: number; limitReached?: boolean } | undefined
    const limitValue = attributesMeta?.limit ?? attributesLimit
    const totalAttributes = attributesMeta?.totalAll ?? paginationResult.pagination.totalItems
    const limitReached = attributesMeta?.limitReached ?? totalAttributes >= limitValue

    // Instant search for better UX
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        attribute: Attribute | null
    }>({ open: false, attribute: null })

    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingUpdate: { id: string; patch: AttributeLocalizedPayload } | null
    }>({ open: false, conflict: null, pendingUpdate: null })

    const { confirm } = useConfirm()

    const createAttributeMutation = useCreateAttribute()
    const updateAttributeMutation = useUpdateAttribute()
    const deleteAttributeMutation = useDeleteAttribute()
    const moveAttributeMutation = useMoveAttribute()
    const toggleRequiredMutation = useToggleAttributeRequired()
    const setDisplayAttributeMutation = useSetDisplayAttribute()
    const clearDisplayAttributeMutation = useClearDisplayAttribute()

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(attributes)) {
            attributes.forEach((attr) => {
                if (attr?.id) {
                    imagesMap[attr.id] = []
                }
            })
        }
        return imagesMap
    }, [attributes])

    const attributeMap = useMemo(() => {
        if (!Array.isArray(attributes)) return new Map<string, Attribute>()
        return new Map(attributes.map((attr) => [attr.id, attr]))
    }, [attributes])

    const localizedFormDefaults = useMemo<AttributeFormValues>(() => {
        const hasNoAttributes = (attributes?.length ?? 0) === 0
        return {
            nameVlc: null,
            codename: '',
            codenameTouched: false,
            dataType: 'STRING',
            isRequired: false,
            isDisplayAttribute: hasNoAttributes,
            targetEntityId: null,
            targetEntityKind: null
        }
    }, [attributes?.length])

    const validateAttributeForm = useCallback(
        (values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = sanitizeCodename(rawCodename)
            if (!normalizedCodename) {
                errors.codename = t('attributes.validation.codenameRequired', 'Codename is required')
            } else if (!isValidCodename(normalizedCodename)) {
                errors.codename = t('attributes.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            // REF type requires target entity
            if (values.dataType === 'REF') {
                if (!values.targetEntityKind) {
                    errors.targetEntityKind = t('attributes.validation.targetEntityKindRequired', 'Target entity type is required for Reference type')
                }
                if (!values.targetEntityId) {
                    errors.targetEntityId = t('attributes.validation.targetEntityIdRequired', 'Target entity is required for Reference type')
                }
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [t, tc]
    )

    const canSaveAttributeForm = useCallback((values: Record<string, any>) => {
        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = typeof values.codename === 'string' ? values.codename : ''
        const normalizedCodename = sanitizeCodename(rawCodename)
        const hasBasicInfo = hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
        // REF type requires target entity
        if (values.dataType === 'REF') {
            return hasBasicInfo && Boolean(values.targetEntityKind) && Boolean(values.targetEntityId)
        }
        return hasBasicInfo
    }, [])

    const renderLocalizedFields = useCallback(
        ({
            values,
            setValue,
            isLoading,
            errors
        }: {
            values: Record<string, any>
            setValue: (name: string, value: any) => void
            isLoading: boolean
            errors?: Record<string, string>
        }) => {
            const fieldErrors = errors ?? {}
            return (
                <AttributeFormFields
                    values={values}
                    setValue={setValue}
                    isLoading={isLoading}
                    errors={fieldErrors}
                    uiLocale={i18n.language}
                    nameLabel={tc('fields.name', 'Name')}
                    codenameLabel={t('attributes.codename', 'Codename')}
                    codenameHelper={t('attributes.codenameHelper', 'Unique identifier')}
                    dataTypeLabel={t('attributes.dataType', 'Data Type')}
                    requiredLabel={t('attributes.isRequiredLabel', 'Required')}
                    displayAttributeLabel={t('attributes.isDisplayAttributeLabel', 'Display attribute')}
                    displayAttributeHelper={t('attributes.isDisplayAttributeHelper', 'Use as representation when referencing elements of this catalog')}
                    displayAttributeLocked={(attributes?.length ?? 0) === 0}
                    dataTypeOptions={[
                        { value: 'STRING', label: t('attributes.dataTypeOptions.string', 'String') },
                        { value: 'NUMBER', label: t('attributes.dataTypeOptions.number', 'Number') },
                        { value: 'BOOLEAN', label: t('attributes.dataTypeOptions.boolean', 'Boolean') },
                        { value: 'DATE', label: t('attributes.dataTypeOptions.date', 'Date') },
                        { value: 'REF', label: t('attributes.dataTypeOptions.ref', 'Reference') },
                        { value: 'JSON', label: t('attributes.dataTypeOptions.json', 'JSON') }
                    ]}
                    typeSettingsLabel={t('attributes.typeSettings.title', 'Type Settings')}
                    stringMaxLengthLabel={t('attributes.typeSettings.string.maxLength', 'Max Length')}
                    stringMinLengthLabel={t('attributes.typeSettings.string.minLength', 'Min Length')}
                    stringVersionedLabel={t('attributes.typeSettings.string.versioned', 'Versioned (VLC)')}
                    stringLocalizedLabel={t('attributes.typeSettings.string.localized', 'Localized (VLC)')}
                    numberPrecisionLabel={t('attributes.typeSettings.number.precision', 'Precision')}
                    numberScaleLabel={t('attributes.typeSettings.number.scale', 'Scale')}
                    numberMinLabel={t('attributes.typeSettings.number.min', 'Min Value')}
                    numberMaxLabel={t('attributes.typeSettings.number.max', 'Max Value')}
                    numberNonNegativeLabel={t('attributes.typeSettings.number.nonNegative', 'Non-negative only')}
                    dateCompositionLabel={t('attributes.typeSettings.date.composition', 'Date Composition')}
                    dateCompositionOptions={[
                        { value: 'date', label: t('attributes.typeSettings.date.compositionOptions.date', 'Date only') },
                        { value: 'time', label: t('attributes.typeSettings.date.compositionOptions.time', 'Time only') },
                        { value: 'datetime', label: t('attributes.typeSettings.date.compositionOptions.datetime', 'Date and Time') }
                    ]}
                    physicalTypeLabel={t('attributes.physicalType.label', 'PostgreSQL type')}
                    metahubId={metahubId!}
                    currentCatalogId={catalogId}
                />
            )
        },
        [i18n.language, t, tc, metahubId, catalogId, attributes?.length]
    )

    const attributeColumns = useMemo(
        () => [
            {
                id: 'sortOrder',
                label: t('attributes.table.order', '#'),
                width: '3%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: AttributeDisplay) => row.sortOrder ?? 0,
                render: (row: AttributeDisplay) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.sortOrder ? row.sortOrder : '—'}</Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '35%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: AttributeDisplay) => row.name || '',
                render: (row: AttributeDisplay) => {
                    const rawAttribute = attributeMap.get(row.id)
                    const isDisplayAttr = rawAttribute?.isDisplayAttribute ?? (row as any)?.isDisplayAttribute ?? false
                    return (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            {isDisplayAttr && (
                                <Tooltip title={t('attributes.isDisplayAttributeTooltip', 'This attribute is the display representation for this catalog')} arrow placement="top">
                                    <StarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                </Tooltip>
                            )}
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    wordBreak: 'break-word'
                                }}
                            >
                                {row.name || '—'}
                            </Typography>
                        </Stack>
                    )
                }
            },
            {
                id: 'codename',
                label: t('attributes.codename', 'Codename'),
                width: '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: AttributeDisplay) => row.codename || '',
                render: (row: AttributeDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.codename || '—'}
                    </Typography>
                )
            },
            {
                id: 'dataType',
                label: t('attributes.dataType', 'Type'),
                width: '17%',
                align: 'center' as const,
                render: (row: AttributeDisplay) => {
                    const rules = row.validationRules as AttributeValidationRules | undefined
                    const hasVersioned = rules?.versioned
                    const hasLocalized = rules?.localized
                    const physicalInfo = getPhysicalDataType(row.dataType, rules)
                    const physicalTypeStr = formatPhysicalType(physicalInfo)
                    const tooltipTitle = t('attributes.physicalType.tooltip', 'PostgreSQL: {{type}}', { type: physicalTypeStr })
                    return (
                        <Tooltip title={tooltipTitle} arrow placement="top">
                            <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ cursor: 'help' }}>
                                <Chip label={row.dataType} size='small' color={getDataTypeColor(row.dataType)} />
                                {hasVersioned && <Chip label="V" size='small' sx={{ minWidth: 24, height: 20, fontSize: 11 }} />}
                                {hasLocalized && <Chip label="L" size='small' sx={{ minWidth: 24, height: 20, fontSize: 11 }} />}
                            </Stack>
                        </Tooltip>
                    )
                }
            },
            {
                id: 'isRequired',
                label: t('attributes.required', 'Required'),
                width: '15%',
                align: 'center' as const,
                render: (row: AttributeDisplay) => (
                    <Chip
                        label={row.isRequired ? tc('yes', 'Yes') : tc('no', 'No')}
                        size='small'
                        variant='outlined'
                        color={row.isRequired ? 'error' : 'default'}
                    />
                )
            }
        ],
        [t, tc]
    )

    const createAttributeContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            attributeMap,
            uiLocale: i18n.language,
            metahubId,
            catalogId,
            api: {
                updateEntity: async (id: string, patch: AttributeLocalizedPayload) => {
                    if (!metahubId || !catalogId) return
                    const normalizedCodename = sanitizeCodename(patch.codename)
                    if (!normalizedCodename) {
                        throw new Error(t('attributes.validation.codenameRequired', 'Codename is required'))
                    }
                    const dataType = patch.dataType ?? 'STRING'
                    const attribute = attributeMap.get(id)
                    const expectedVersion = attribute?.version
                    try {
                        await updateAttributeMutation.mutateAsync({
                            metahubId,
                            hubId: effectiveHubId, // Optional - undefined for hub-less catalogs
                            catalogId,
                            attributeId: id,
                            data: { ...patch, codename: normalizedCodename, dataType, isRequired: patch.isRequired, expectedVersion }
                        })
                    } catch (error: unknown) {
                        if (isOptimisticLockConflict(error)) {
                            const conflict = extractConflictInfo(error)
                            if (conflict) {
                                setConflictState({ open: true, conflict, pendingUpdate: { id, patch: { ...patch, codename: normalizedCodename, dataType, isRequired: patch.isRequired } } })
                                return
                            }
                        }
                        throw error
                    }
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId || !catalogId) return
                    await deleteAttributeMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId, // Optional - undefined for hub-less catalogs
                        catalogId,
                        attributeId: id
                    })
                }
            },
            moveAttribute: async (id: string, direction: 'up' | 'down') => {
                if (!metahubId || !catalogId) return
                await moveAttributeMutation.mutateAsync({
                    metahubId,
                    hubId: effectiveHubId, // Optional - undefined for hub-less catalogs
                    catalogId,
                    attributeId: id,
                    direction
                })
                // Invalidate queries - effectiveHubId is optional for direct queries
                if (effectiveHubId) {
                    await invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                } else {
                    // Invalidate direct queries for hub-less catalogs
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                }
            },
            toggleRequired: async (id: string, isRequired: boolean) => {
                if (!metahubId || !catalogId) return
                await toggleRequiredMutation.mutateAsync({
                    metahubId,
                    hubId: effectiveHubId,
                    catalogId,
                    attributeId: id,
                    isRequired
                })
                if (effectiveHubId) {
                    await invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                } else {
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                }
            },
            toggleDisplayAttribute: async (id: string, isDisplayAttribute: boolean) => {
                if (!metahubId || !catalogId) return
                if (isDisplayAttribute) {
                    await setDisplayAttributeMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        catalogId,
                        attributeId: id
                    })
                } else {
                    await clearDisplayAttributeMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        catalogId,
                        attributeId: id
                    })
                }
                if (effectiveHubId) {
                    await invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                } else {
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId && catalogId) {
                        if (effectiveHubId) {
                            await invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                        } else {
                            // Invalidate direct queries for hub-less catalogs
                            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                        }
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
                openDeleteDialog: (attribute: Attribute) => {
                    const actualAttribute = attributeMap.get(attribute.id) ?? attribute
                    if (actualAttribute?.isDisplayAttribute) {
                        enqueueSnackbar(
                            t(
                                'attributes.deleteDisplayAttributeBlocked',
                                'Нельзя удалить атрибут-представление. Сначала назначьте представлением другой атрибут.'
                            ),
                            { variant: 'warning' }
                        )
                        return
                    }
                    setDeleteDialogState({ open: true, attribute })
                }
            }
        }),
        [
            attributeMap,
            catalogId,
            clearDisplayAttributeMutation,
            confirm,
            deleteAttributeMutation,
            enqueueSnackbar,
            effectiveHubId,
            i18n.language,
            metahubId,
            moveAttributeMutation,
            queryClient,
            setDisplayAttributeMutation,
            t,
            toggleRequiredMutation,
            updateAttributeMutation
        ]
    )

    // Validate metahubId and catalogId from URL AFTER all hooks
    if (!metahubId || !catalogId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid catalog'
                title={t('errors.noHubId', 'No hub ID provided')}
                description={t('errors.pleaseSelectHub', 'Please select a hub')}
            />
        )
    }

    // Show loading while resolving catalog (only when no hubId in URL)
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

    // Show error if catalog resolution failed
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

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateAttribute = async (data: Record<string, any>) => {
        setDialogError(null)
        setCreating(true)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setDialogError(tc('crud.nameRequired', 'Name is required'))
                return
            }
            const normalizedCodename = sanitizeCodename(String(data.codename || ''))
            if (!normalizedCodename) {
                setDialogError(t('attributes.validation.codenameRequired', 'Codename is required'))
                return
            }

            const dataType = (data.dataType as AttributeDataType | undefined) ?? 'STRING'
            const isRequired = Boolean(data.isRequired)
            const validationRules = data.validationRules as AttributeValidationRules | undefined
            const isDisplayAttribute = Boolean(data.isDisplayAttribute)

            // REF type: extract target entity info
            const targetEntityId = dataType === 'REF' ? (data.targetEntityId as string | null) : undefined
            const targetEntityKind = dataType === 'REF' ? (data.targetEntityKind as MetaEntityKind | null) : undefined

            await createAttributeMutation.mutateAsync({
                metahubId,
                hubId: effectiveHubId,
                catalogId,
                data: {
                    codename: normalizedCodename,
                    dataType,
                    isRequired,
                    name: nameInput,
                    namePrimaryLocale,
                    validationRules,
                    isDisplayAttribute,
                    targetEntityId,
                    targetEntityKind
                }
            })

            await invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
            handleDialogSave()
        } catch (e: unknown) {
            const responseData =
                e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data : undefined
            const responseMessage = responseData?.message
            const message =
                responseData?.code === 'ATTRIBUTE_LIMIT_REACHED'
                    ? t('attributes.limitReached', { limit: responseData?.limit ?? limitValue })
                    : typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('attributes.createError')
            setDialogError(message)
            console.error('Failed to create attribute', e)
        } finally {
            setCreating(false)
        }
    }

    // Transform Attribute data for FlowListTable (which expects string name)
    const getAttributeTableData = (attr: Attribute): AttributeDisplay => toAttributeDisplay(attr, i18n.language)

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
                    {/* Tab navigation between Attributes and Elements */}
                    <Box sx={{ mb: 1 }}>
                        <ToggleButtonGroup value='attributes' exclusive size='small' sx={{ mb: 1 }}>
                            <ToggleButton value='attributes' sx={{ px: 2, py: 0.5 }}>
                                <ListAltIcon sx={{ mr: 1, fontSize: 18 }} />
                                {t('attributes.title')}
                            </ToggleButton>
                            <ToggleButton
                                value='elements'
                                sx={{ px: 2, py: 0.5 }}
                                onClick={() => {
                                    if (hubIdParam) {
                                        navigate(`/metahub/${metahubId}/hub/${hubIdParam}/catalog/${catalogId}/elements`)
                                        return
                                    }
                                    navigate(`/metahub/${metahubId}/catalog/${catalogId}/elements`)
                                }}
                            >
                                <TableRowsIcon sx={{ mr: 1, fontSize: 18 }} />
                                {t('elements.title')}
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('attributes.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('attributes.title')}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('addNew'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />,
                                disabled: limitReached
                            }}
                        />
                    </ViewHeader>

                    {limitReached && (
                        <Alert
                            severity='info'
                            icon={<InfoIcon />}
                            sx={{
                                mx: { xs: -1.5, md: -2 },
                                mt: 0,
                                mb: 2
                            }}
                        >
                            {t('attributes.limitReached', { limit: limitValue })}
                        </Alert>
                    )}

                    {isLoading && attributes.length === 0 ? (
                        <Skeleton variant='rectangular' height={120} />
                    ) : !isLoading && attributes.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No attributes'
                            title={t('attributes.empty')}
                            description={t('attributes.emptyDescription')}
                        />
                    ) : (
                        <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                            <FlowListTable
                                data={attributes.map(getAttributeTableData)}
                                images={images}
                                isLoading={isLoading}
                                customColumns={attributeColumns}
                                i18nNamespace='flowList'
                                renderActions={(row: any) => {
                                    const originalAttribute = attributes.find((a) => a.id === row.id)
                                    if (!originalAttribute) return null

                                    const descriptors = [...attributeActions] as any[]
                                    if (!descriptors.length) return null

                                    return (
                                        <BaseEntityMenu<AttributeDisplay, AttributeLocalizedPayload>
                                            entity={toAttributeDisplay(originalAttribute, i18n.language)}
                                            entityKind='attribute'
                                            descriptors={descriptors}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createAttributeContext}
                                        />
                                    )
                                }}
                            />
                        </Box>
                    )}

                    {/* Table Pagination at bottom */}
                    {!isLoading && attributes.length > 0 && (
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

            <EntityFormDialog
                open={isDialogOpen}
                title={t('attributes.createDialog.title', 'Add Attribute')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateAttribute}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                extraFields={renderLocalizedFields}
                validate={validateAttributeForm}
                canSave={canSaveAttributeForm}
            />

            {/* Independent ConfirmDeleteDialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('attributes.deleteDialog.title')}
                description={t('attributes.deleteDialog.message')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, attribute: null })}
                onConfirm={async () => {
                    if (deleteDialogState.attribute) {
                        const actualAttribute = attributeMap.get(deleteDialogState.attribute.id) ?? deleteDialogState.attribute
                        if (actualAttribute?.isDisplayAttribute) {
                            enqueueSnackbar(
                                t(
                                    'attributes.deleteDisplayAttributeBlocked',
                                    'Нельзя удалить атрибут-представление. Сначала назначьте представлением другой атрибут.'
                                ),
                                { variant: 'warning' }
                            )
                            setDeleteDialogState({ open: false, attribute: null })
                            return
                        }
                        try {
                            await deleteAttributeMutation.mutateAsync({
                                metahubId,
                                hubId: effectiveHubId,
                                catalogId,
                                attributeId: deleteDialogState.attribute.id
                            })
                            setDeleteDialogState({ open: false, attribute: null })
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
                                    : t('attributes.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, attribute: null })
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
                            invalidateAttributesQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                        } else {
                            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(metahubId, catalogId) })
                        }
                    }
                }}
                onOverwrite={async () => {
                    if (conflictState.pendingUpdate && metahubId && catalogId) {
                        const { id, patch } = conflictState.pendingUpdate
                        await updateAttributeMutation.mutateAsync({
                            metahubId,
                            hubId: effectiveHubId,
                            catalogId,
                            attributeId: id,
                            data: patch
                        })
                        setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    }
                }}
                isLoading={updateAttributeMutation.isPending}
            />
        </MainCard>
    )
}

export default AttributeList
