import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton, Chip, Divider } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient, useQuery } from '@tanstack/react-query'

// project imports
import {
    TemplateMainCard as MainCard,
    ItemCard,
    ToolbarControls,
    EmptyListState,
    SkeletonGrid,
    APIEmptySVG,
    usePaginated,
    useDebouncedSearch,
    PaginationControls,
    FlowListTable,
    gridSpacing,
    ConfirmDialog,
    useConfirm,
    LocalizedInlineField,
    useCodenameAutoFill
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import {
    useCreateCatalog,
    useCreateCatalogAtMetahub,
    useUpdateCatalog,
    useUpdateCatalogAtMetahub,
    useDeleteCatalog
} from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as catalogsApi from '../api'
import type { CatalogWithHubs } from '../api'
import * as hubsApi from '../../hubs'
import { metahubsQueryKeys, invalidateCatalogsQueries } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { CatalogDisplay, CatalogLocalizedPayload, Hub, PaginatedResponse, getVLCString, toCatalogDisplay } from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField, HubSelectionPanel } from '../../../components'
import catalogActions, { CatalogDisplayWithHub } from './CatalogActions'

/**
 * Hub info for display in the table column (global view)
 */
interface HubDisplayInfo {
    id: string
    name: string
    codename: string
}

/**
 * Extended CatalogDisplay that includes hub info for the all-catalogs view.
 * For N:M relationship, we use the primary hub (first in list) for navigation.
 */
interface CatalogWithHubsDisplay extends CatalogDisplay {
    /** Primary hub ID for navigation (first hub in list) */
    hubId: string
    /** Primary hub name for display */
    hubName: string
    /** Primary hub codename */
    hubCodename: string
    /** All associated hubs count */
    hubsCount: number
    /** All hubs with display info for table column */
    allHubs: HubDisplayInfo[]
}

type CatalogFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
    /** For N:M relationship - array of hub IDs */
    hubIds: string[]
    /** Single hub mode flag */
    isSingleHub: boolean
}

type GeneralTabFieldsProps = {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors: Record<string, string>
    uiLocale: string
    nameLabel: string
    descriptionLabel: string
    codenameLabel: string
    codenameHelper: string
}

/**
 * General tab content component with name, description, codename fields
 */
const GeneralTabFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel,
    codenameLabel,
    codenameHelper
}: GeneralTabFieldsProps) => {
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodename(nameValue)

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
    })

    return (
        <Stack spacing={2}>
            <LocalizedInlineField
                mode='localized'
                label={nameLabel}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('nameVlc', next)}
                error={errors.nameVlc || null}
                helperText={errors.nameVlc}
                uiLocale={uiLocale}
            />

            <LocalizedInlineField
                mode='localized'
                label={descriptionLabel}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
            />

            <Divider />

            <CodenameField
                value={codename}
                onChange={(value: string) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched: boolean) => setValue('codenameTouched', touched)}
                label={codenameLabel}
                helperText={codenameHelper}
                error={errors.codename}
                disabled={isLoading}
                required
            />
        </Stack>
    )
}

/**
 * Convert CatalogWithHubs to display format with hub info (for global view)
 */
const toCatalogWithHubsDisplay = (catalog: CatalogWithHubs, locale: string): CatalogWithHubsDisplay => {
    const base = toCatalogDisplay(catalog, locale)
    const hubs = catalog.hubs || []
    const primaryHub = hubs[0]
    const hubName = primaryHub
        ? getVLCString(primaryHub.name, locale) || getVLCString(primaryHub.name, 'en') || primaryHub.codename || '—'
        : '—'

    // Prepare all hubs with display info for table column
    const allHubs: HubDisplayInfo[] = hubs.map((hub) => ({
        id: hub.id,
        name: getVLCString(hub.name, locale) || getVLCString(hub.name, 'en') || hub.codename || '—',
        codename: hub.codename || ''
    }))

    return {
        ...base,
        hubId: primaryHub?.id || '',
        hubName,
        hubCodename: primaryHub?.codename || '',
        hubsCount: hubs.length,
        allHubs
    }
}

const CatalogList = () => {
    const navigate = useNavigate()
    // hubId is optional - when present, we're in hub-scoped mode; otherwise global mode
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId?: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    /**
     * isHubScoped determines the component behavior:
     * - true: Hub-scoped view (inside a specific hub) - uses catalogsList API
     * - false: Global view (all catalogs in metahub) - uses allCatalogsList API
     */
    const isHubScoped = Boolean(hubId)

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    // Use different storage keys for different views
    const [view, setView] = useViewPreference(isHubScoped ? STORAGE_KEYS.CATALOG_DISPLAY_STYLE : STORAGE_KEYS.ALL_CATALOGS_DISPLAY_STYLE)

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Fetch hubs for the create dialog (N:M relationship)
    const { data: hubsData } = useQuery<PaginatedResponse<Hub>>({
        queryKey: metahubId ? metahubsQueryKeys.hubsList(metahubId, { limit: 100 }) : ['metahubs', 'hubs', 'list', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return hubsApi.listHubs(metahubId, { limit: 100 })
        },
        enabled: !!metahubId
    })
    const hubs = hubsData?.items ?? []

    // Use paginated hook for catalogs list - conditional API based on isHubScoped
    const paginationResult = usePaginated<CatalogWithHubs, 'codename' | 'created' | 'updated'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.catalogsList(metahubId, hubId!, params)
                : (params) => metahubsQueryKeys.allCatalogsList(metahubId, params)
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => catalogsApi.listCatalogs(metahubId, hubId!, params)
                : (params) => catalogsApi.listAllCatalogs(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!metahubId && (isHubScoped ? !!hubId : true)
    })

    const { data: catalogs, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    // Instant search for better UX
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        catalog: CatalogWithHubs | null
    }>({ open: false, catalog: null })

    const { confirm } = useConfirm()

    const createCatalogMutation = useCreateCatalog()
    const createCatalogAtMetahubMutation = useCreateCatalogAtMetahub()
    const updateCatalogMutation = useUpdateCatalog()
    const deleteCatalogMutation = useDeleteCatalog()
    const updateCatalogAtMetahubMutation = useUpdateCatalogAtMetahub()

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(catalogs)) {
            catalogs.forEach((catalog) => {
                if (catalog?.id) {
                    imagesMap[catalog.id] = []
                }
            })
        }
        return imagesMap
    }, [catalogs])

    const catalogMap = useMemo(() => {
        if (!Array.isArray(catalogs)) return new Map<string, CatalogWithHubs>()
        return new Map(catalogs.map((catalog) => [catalog.id, catalog]))
    }, [catalogs])

    // Form defaults with current hub auto-selected in hub-scoped mode (N:M relationship)
    const localizedFormDefaults = useMemo<CatalogFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: '',
            codenameTouched: false,
            hubIds: hubId ? [hubId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false // Default: catalog can exist without hubs
        }),
        [hubId]
    )

    const validateCatalogForm = useCallback(
        (values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // Hub validation only if isRequiredHub is true
            if (isRequiredHub && hubIds.length === 0) {
                errors.hubIds = t('catalogs.validation.hubRequired', 'At least one hub is required')
            }
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = sanitizeCodename(rawCodename)
            if (!normalizedCodename) {
                errors.codename = t('catalogs.validation.codenameRequired', 'Codename is required')
            } else if (!isValidCodename(normalizedCodename)) {
                errors.codename = t('catalogs.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [t, tc]
    )

    const canSaveCatalogForm = useCallback((values: Record<string, any>) => {
        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = typeof values.codename === 'string' ? values.codename : ''
        const normalizedCodename = sanitizeCodename(rawCodename)
        const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
        const isRequiredHub = Boolean(values.isRequiredHub)
        // Hub requirement only if isRequiredHub is true
        const hubsValid = !isRequiredHub || hubIds.length > 0
        return hubsValid && hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
    }, [])

    /**
     * Build tabs for the EntityFormDialog (N:M relationship)
     * Tab 1: General (name, description, codename)
     * Tab 2: Hubs (hub selection panel with isSingleHub toggle, current hub pre-selected)
     */
    const buildFormTabs = useCallback(
        ({
            values,
            setValue,
            isLoading: isFormLoading,
            errors
        }: {
            values: Record<string, any>
            setValue: (name: string, value: any) => void
            isLoading: boolean
            errors: Record<string, string>
        }): TabConfig[] => {
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isSingleHub = Boolean(values.isSingleHub)
            const isRequiredHub = Boolean(values.isRequiredHub)

            return [
                {
                    id: 'general',
                    label: t('catalogs.tabs.general', 'Основное'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            errors={errors}
                            uiLocale={i18n.language}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('catalogs.codename', 'Codename')}
                            codenameHelper={t('catalogs.codenameHelper', 'Unique identifier')}
                        />
                    )
                },
                {
                    id: 'hubs',
                    label: t('catalogs.tabs.hubs', 'Хабы'),
                    content: (
                        <HubSelectionPanel
                            availableHubs={hubs}
                            selectedHubIds={hubIds}
                            onSelectionChange={(newHubIds) => setValue('hubIds', newHubIds)}
                            isRequiredHub={isRequiredHub}
                            onRequiredHubChange={(value) => setValue('isRequiredHub', value)}
                            isSingleHub={isSingleHub}
                            onSingleHubChange={(value) => setValue('isSingleHub', value)}
                            disabled={isFormLoading}
                            error={errors.hubIds}
                            uiLocale={i18n.language}
                        />
                    )
                }
            ]
        },
        [hubs, i18n.language, t, tc]
    )

    const catalogColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: isHubScoped ? '25%' : '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: CatalogWithHubsDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: CatalogWithHubsDisplay) => (
                    <Link
                        to={
                            isHubScoped
                                ? `/metahub/${metahubId}/hub/${hubId}/catalog/${row.id}/attributes`
                                : `/metahub/${metahubId}/catalog/${row.id}/attributes`
                        }
                        style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                        <Typography
                            sx={{
                                fontSize: 14,
                                fontWeight: 500,
                                wordBreak: 'break-word',
                                '&:hover': {
                                    textDecoration: 'underline',
                                    color: 'primary.main'
                                }
                            }}
                        >
                            {row.name || '—'}
                        </Typography>
                    </Link>
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: isHubScoped ? '30%' : '25%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: CatalogWithHubsDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: CatalogWithHubsDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.description || '—'}
                    </Typography>
                )
            },
            {
                id: 'codename',
                label: t('catalogs.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: CatalogWithHubsDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: CatalogWithHubsDisplay) => (
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
            }
        ]

        // Hub column only for global mode
        const hubColumn = {
            id: 'hub',
            label: t('hubs.title', 'Hub'),
            width: '15%',
            align: 'left' as const,
            render: (row: CatalogWithHubsDisplay) => (
                <Stack direction='column' spacing={0.5}>
                    {row.allHubs.map((hub) => (
                        <Link
                            key={hub.id}
                            to={`/metahub/${metahubId}/hub/${hub.id}/catalogs`}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            <Chip
                                label={hub.name}
                                size='small'
                                variant='outlined'
                                sx={{
                                    maxWidth: '100%',
                                    '&:hover': {
                                        backgroundColor: 'action.hover'
                                    }
                                }}
                            />
                        </Link>
                    ))}
                    {row.allHubs.length === 0 && (
                        <Typography variant='body2' color='text.secondary'>
                            —
                        </Typography>
                    )}
                </Stack>
            )
        }

        // Count columns
        const countColumns = [
            {
                id: 'attributesCount',
                label: t('catalogs.attributesHeader', 'Attributes'),
                width: '10%',
                align: 'center' as const,
                render: (row: CatalogWithHubsDisplay) =>
                    typeof row.attributesCount === 'number' ? (
                        <Link
                            to={
                                isHubScoped
                                    ? `/metahub/${metahubId}/hub/${hubId}/catalog/${row.id}/attributes`
                                    : `/metahub/${metahubId}/catalog/${row.id}/attributes`
                            }
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    '&:hover': {
                                        textDecoration: 'underline',
                                        color: 'primary.main'
                                    }
                                }}
                            >
                                {row.attributesCount}
                            </Typography>
                        </Link>
                    ) : (
                        '—'
                    )
            },
            {
                id: 'recordsCount',
                label: t('catalogs.recordsHeader', 'Records'),
                width: '10%',
                align: 'center' as const,
                render: (row: CatalogWithHubsDisplay) => (typeof row.recordsCount === 'number' ? row.recordsCount : '—')
            }
        ]

        // Combine columns based on mode
        if (isHubScoped) {
            return [...baseColumns, ...countColumns]
        } else {
            return [...baseColumns, hubColumn, ...countColumns]
        }
    }, [t, tc, metahubId, hubId, isHubScoped])

    const createCatalogContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            catalogMap,
            uiLocale: i18n.language,
            hubs, // Pass hubs for hub selector in edit dialog (N:M)
            api: {
                updateEntity: async (id: string, patch: CatalogLocalizedPayload) => {
                    if (!metahubId) return
                    const catalog = catalogMap.get(id)
                    const normalizedCodename = sanitizeCodename(patch.codename)
                    if (!normalizedCodename) {
                        throw new Error(t('catalogs.validation.codenameRequired', 'Codename is required'))
                    }
                    // In hub-scoped mode, use hubId from URL; in global mode, check if catalog has hubs
                    const targetHubId = isHubScoped ? hubId! : catalog?.hubs?.[0]?.id
                    if (targetHubId) {
                        // Use hub-scoped endpoint
                        await updateCatalogMutation.mutateAsync({
                            metahubId,
                            hubId: targetHubId,
                            catalogId: id,
                            data: { ...patch, codename: normalizedCodename }
                        })
                    } else {
                        // Use metahub-level endpoint for catalogs without hubs
                        await updateCatalogAtMetahubMutation.mutateAsync({
                            metahubId,
                            catalogId: id,
                            data: { ...patch, codename: normalizedCodename }
                        })
                    }
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId) return
                    const catalog = catalogMap.get(id)

                    if (isHubScoped && hubId) {
                        // Hub-scoped mode: use hubId from URL
                        await deleteCatalogMutation.mutateAsync({
                            metahubId,
                            hubId,
                            catalogId: id,
                            force: false
                        })
                    } else {
                        // Global mode: check if catalog has hubs
                        const targetHubId = catalog?.hubs?.[0]?.id
                        await deleteCatalogMutation.mutateAsync({
                            metahubId,
                            hubId: targetHubId, // undefined for catalogs without hubs
                            catalogId: id,
                            force: Boolean(targetHubId) // force=true if has multiple hubs
                        })
                    }
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId) {
                        if (isHubScoped && hubId) {
                            await invalidateCatalogsQueries.all(queryClient, metahubId, hubId)
                        } else {
                            // In global mode, invalidate all catalogs cache
                            await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId) })
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
                openDeleteDialog: (entity: CatalogDisplayWithHub | CatalogDisplay) => {
                    const catalog = catalogMap.get(entity.id)
                    if (!catalog) return
                    setDeleteDialogState({ open: true, catalog })
                }
            }
        }),
        [
            confirm,
            deleteCatalogMutation,
            enqueueSnackbar,
            catalogMap,
            hubs,
            hubId,
            i18n.language,
            isHubScoped,
            metahubId,
            queryClient,
            t,
            updateCatalogMutation,
            updateCatalogAtMetahubMutation
        ]
    )

    // Validate metahubId from URL AFTER all hooks
    // In hub-scoped mode, also validate hubId
    if (!metahubId || (isHubScoped && !hubId)) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt={isHubScoped ? 'Invalid hub' : 'Invalid metahub'}
                title={isHubScoped ? t('metahubs:errors.invalidHub') : t('metahubs:errors.invalidMetahub')}
                description={isHubScoped ? t('metahubs:errors.pleaseSelectHub') : t('metahubs:errors.pleaseSelectMetahub')}
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

    const handleCreateCatalog = async (data: Record<string, any>) => {
        setDialogError(null)
        setCreating(true)
        try {
            const hubIds = Array.isArray(data.hubIds) ? data.hubIds : []
            const isRequiredHub = Boolean(data.isRequiredHub)

            // Only require hubs if isRequiredHub is true
            if (isRequiredHub && hubIds.length === 0) {
                setDialogError(t('catalogs.validation.hubRequired', 'At least one hub is required'))
                return
            }

            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setDialogError(tc('crud.nameRequired', 'Name is required'))
                return
            }
            const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
            const normalizedCodename = sanitizeCodename(String(data.codename || ''))
            if (!normalizedCodename) {
                setDialogError(t('catalogs.validation.codenameRequired', 'Codename is required'))
                return
            }

            const isSingleHub = Boolean(data.isSingleHub)

            // Choose API endpoint based on whether we have hubs
            if (hubIds.length > 0) {
                // Use hub-scoped endpoint with first hub
                const primaryHubId = hubIds[0]
                await createCatalogMutation.mutateAsync({
                    metahubId: metahubId!,
                    hubId: primaryHubId,
                    data: {
                        codename: normalizedCodename,
                        name: nameInput,
                        description: descriptionInput,
                        namePrimaryLocale,
                        descriptionPrimaryLocale,
                        hubIds, // Pass all hubIds for N:M association
                        isSingleHub,
                        isRequiredHub
                    }
                })

                // Handle navigation after creation
                if (isHubScoped) {
                    // In hub-scoped mode: if primary hub differs from current, redirect
                    if (primaryHubId !== hubId) {
                        navigate(`/metahub/${metahubId}/hub/${primaryHubId}/catalogs`)
                    } else {
                        await invalidateCatalogsQueries.all(queryClient, metahubId!, hubId!)
                    }
                } else {
                    // In global mode: just invalidate the all catalogs cache
                    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId!) })
                }
            } else {
                // No hubs selected - use metahub-level endpoint
                await createCatalogAtMetahubMutation.mutateAsync({
                    metahubId: metahubId!,
                    data: {
                        codename: normalizedCodename,
                        name: nameInput,
                        description: descriptionInput,
                        namePrimaryLocale,
                        descriptionPrimaryLocale,
                        hubIds: [], // Empty array
                        isSingleHub,
                        isRequiredHub
                    }
                })
                // Just invalidate all catalogs cache
                await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId!) })
            }
            handleDialogSave()
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('catalogs.createError')
            setDialogError(message)
            console.error('Failed to create catalog', e)
        } finally {
            setCreating(false)
        }
    }

    const goToCatalog = (catalog: CatalogWithHubs) => {
        // Navigate based on mode: hub-scoped or catalog-centric
        if (isHubScoped) {
            navigate(`/metahub/${metahubId}/hub/${hubId}/catalog/${catalog.id}/attributes`)
        } else {
            navigate(`/metahub/${metahubId}/catalog/${catalog.id}/attributes`)
        }
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    // Transform Catalog data for display - use hub-aware version for global mode
    const getCatalogCardData = (catalog: CatalogWithHubs): CatalogWithHubsDisplay => toCatalogWithHubsDisplay(catalog, i18n.language)

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
                        searchPlaceholder={t('catalogs.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={isHubScoped ? t('catalogs.title') : t('catalogs.allTitle')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode: string) => handleChange(null, mode)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={{
                                label: tc('addNew'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {isLoading && catalogs.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && catalogs.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No catalogs'
                            title={searchValue ? t('catalogs.noSearchResults') : t('catalogs.empty')}
                            description={searchValue ? t('catalogs.noSearchResultsHint') : t('catalogs.emptyDescription')}
                        />
                    ) : (
                        <>
                            {view === 'card' ? (
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gap: gridSpacing,
                                        mx: { xs: -1.5, md: -2 },
                                        gridTemplateColumns: {
                                            xs: '1fr',
                                            sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                                            lg: 'repeat(auto-fill, minmax(260px, 1fr))'
                                        },
                                        justifyContent: 'start',
                                        alignContent: 'start'
                                    }}
                                >
                                    {catalogs.map((catalog: CatalogWithHubs) => {
                                        const descriptors = [...catalogActions]
                                        const displayData = getCatalogCardData(catalog)

                                        return (
                                            <ItemCard
                                                key={catalog.id}
                                                data={displayData}
                                                images={images[catalog.id] || []}
                                                onClick={() => goToCatalog(catalog)}
                                                footerEndContent={
                                                    <Stack direction='row' spacing={1} alignItems='center'>
                                                        {/* Show hub chip only in global mode */}
                                                        {!isHubScoped && displayData.hubName && (
                                                            <>
                                                                <Chip label={displayData.hubName} size='small' variant='outlined' />
                                                                {displayData.hubsCount > 1 && (
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        +{displayData.hubsCount - 1}
                                                                    </Typography>
                                                                )}
                                                            </>
                                                        )}
                                                        {typeof catalog.attributesCount === 'number' && (
                                                            <Typography variant='caption' color='text.secondary'>
                                                                {t('catalogs.attributesCount', { count: catalog.attributesCount })}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<CatalogDisplayWithHub, CatalogLocalizedPayload>
                                                                entity={displayData}
                                                                entityKind='catalog'
                                                                descriptors={descriptors}
                                                                namespace='metahubs'
                                                                i18nInstance={i18n}
                                                                createContext={createCatalogContext}
                                                                renderTrigger={(props: TriggerProps) => (
                                                                    <IconButton
                                                                        size='small'
                                                                        sx={{ color: 'text.secondary', width: 28, height: 28, p: 0.25 }}
                                                                        {...props}
                                                                    >
                                                                        <MoreVertRoundedIcon fontSize='small' />
                                                                    </IconButton>
                                                                )}
                                                            />
                                                        </Box>
                                                    ) : null
                                                }
                                            />
                                        )
                                    })}
                                </Box>
                            ) : (
                                <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                    <FlowListTable
                                        data={catalogs.map(getCatalogCardData)}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: any) =>
                                            row?.id
                                                ? isHubScoped
                                                    ? `/metahub/${metahubId}/hub/${hubId}/catalog/${row.id}/attributes`
                                                    : `/metahub/${metahubId}/catalog/${row.id}/attributes`
                                                : undefined
                                        }
                                        customColumns={catalogColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: any) => {
                                            const originalCatalog = catalogs.find((c) => c.id === row.id)
                                            if (!originalCatalog) return null

                                            const descriptors = [...catalogActions]
                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<CatalogDisplayWithHub, CatalogLocalizedPayload>
                                                    entity={getCatalogCardData(originalCatalog)}
                                                    entityKind='catalog'
                                                    descriptors={descriptors}
                                                    namespace='metahubs'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createCatalogContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom */}
                    {!isLoading && catalogs.length > 0 && (
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
                title={t('catalogs.createDialog.title', 'Create Catalog')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateCatalog}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                tabs={buildFormTabs}
                validate={validateCatalogForm}
                canSave={canSaveCatalogForm}
            />

            {/* Independent ConfirmDeleteDialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('catalogs.deleteDialog.title')}
                description={t('catalogs.deleteDialog.message')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, catalog: null })}
                onConfirm={async () => {
                    if (deleteDialogState.catalog && metahubId) {
                        try {
                            // In hub-scoped mode, use hubId from URL; in global mode, use primary hub
                            const targetHubId = isHubScoped ? hubId! : deleteDialogState.catalog.hubs?.[0]?.id || ''
                            await deleteCatalogMutation.mutateAsync({
                                metahubId,
                                hubId: targetHubId,
                                catalogId: deleteDialogState.catalog.id,
                                force: !isHubScoped // Force delete in global mode
                            })
                            // Invalidate appropriate cache
                            if (isHubScoped && hubId) {
                                await invalidateCatalogsQueries.all(queryClient, metahubId, hubId)
                            } else {
                                await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId) })
                            }
                            setDeleteDialogState({ open: false, catalog: null })
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
                                    : t('catalogs.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, catalog: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default CatalogList
