import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, Chip, Divider, Tabs, Tab } from '@mui/material'
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
    ConfirmContextProvider,
    ConfirmDialog,
    useConfirm,
    LocalizedInlineField,
    useCodenameAutoFill,
    useCodenameVlcSync,
    EntitySelectionPanel
} from '@universo/template-mui'
import type { DragEndEvent } from '@universo/template-mui'
import type { EntitySelectionLabels } from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import {
    useCreateCatalog,
    useCreateCatalogAtMetahub,
    useUpdateCatalog,
    useUpdateCatalogAtMetahub,
    useDeleteCatalog,
    useCopyCatalog,
    useReorderCatalog
} from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as catalogsApi from '../api'
import type { CatalogWithHubs } from '../api'
import * as hubsApi from '../../hubs'
import { fetchAllPaginatedItems, invalidateCatalogsQueries, metahubsQueryKeys } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { CatalogDisplay, CatalogLocalizedPayload, Hub, PaginatedResponse, getVLCString, toCatalogDisplay } from '../../../types'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { CatalogDeleteDialog, CodenameField, HubSelectionPanel, ExistingCodenamesProvider } from '../../../components'
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
    codenameVlc?: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
    /** For N:M relationship - array of hub IDs */
    hubIds: string[]
    /** Single hub mode flag */
    isSingleHub: boolean
    /** Hub requirement flag */
    isRequiredHub?: boolean
}

type GenericFormValues = Record<string, unknown>

type CatalogPendingData = CatalogLocalizedPayload & { expectedVersion?: number }

type CatalogMenuBaseContext = {
    t: (key: string, options?: unknown) => string
} & Record<string, unknown>

type ConfirmSpec = {
    titleKey?: string
    descriptionKey?: string
    confirmKey?: string
    cancelKey?: string
    interpolate?: Record<string, unknown>
    title?: string
    description?: string
    confirmButtonName?: string
    cancelButtonName?: string
}

const DIALOG_SAVE_CANCEL = { __dialogCancelled: true } as const

const extractResponseStatus = (error: unknown): number | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const status = (response as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
}

const extractResponseMessage = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object') return undefined
    const message = (data as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
}

type GeneralTabFieldsProps = {
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
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
    const codenameConfig = useCodenameConfig()
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codenameVlc = (values.codenameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodenameForStyle(
        nameValue,
        codenameConfig.style,
        codenameConfig.alphabet,
        codenameConfig.allowMixed,
        codenameConfig.autoConvertMixedAlphabets
    )

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
    })

    useCodenameVlcSync({
        localizedEnabled: codenameConfig.localizedEnabled,
        codename,
        codenameTouched,
        codenameVlc,
        nameVlc,
        deriveCodename: (nameContent) =>
            sanitizeCodenameForStyle(
                nameContent,
                codenameConfig.style,
                codenameConfig.alphabet,
                codenameConfig.allowMixed,
                codenameConfig.autoConvertMixedAlphabets
            ),
        setValue
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
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                localizedEnabled={codenameConfig.localizedEnabled}
                localizedValue={codenameVlc ?? null}
                onLocalizedChange={(next) => setValue('codenameVlc', next)}
                uiLocale={uiLocale}
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

const CatalogListContent = () => {
    const navigate = useNavigate()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
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
    const { allowCopy, allowDelete, allowAttachExistingEntities } = useEntityPermissions('catalogs')

    // Fetch hubs for the create dialog (N:M relationship)
    const { data: hubsData } = useQuery<PaginatedResponse<Hub>>({
        queryKey: metahubId ? metahubsQueryKeys.hubsList(metahubId, { limit: 100 }) : ['metahubs', 'hubs', 'list', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return hubsApi.listHubs(metahubId, { limit: 100 })
        },
        enabled: !!metahubId,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        staleTime: 5 * 60 * 1000,
        retry: false
    })
    const hubs = useMemo(() => hubsData?.items ?? [], [hubsData?.items])

    const { data: allCatalogsResponse } = useQuery<PaginatedResponse<CatalogWithHubs>>({
        queryKey: metahubId
            ? metahubsQueryKeys.allCatalogsList(metahubId, { limit: 1000, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' })
            : ['metahubs', 'catalogs', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems((params) => catalogsApi.listAllCatalogs(metahubId, params), {
                limit: 1000,
                sortBy: 'sortOrder',
                sortOrder: 'asc'
            })
        },
        enabled: Boolean(metahubId),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        staleTime: 5 * 60 * 1000,
        retry: false
    })

    // Use paginated hook for catalogs list - conditional API based on isHubScoped
    const paginationResult = usePaginated<CatalogWithHubs, 'codename' | 'created' | 'updated' | 'sortOrder'>({
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
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!hubId : true)
    })

    const { data: catalogs, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    // Instant search for better UX
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for simple confirmation delete flow (unlink or other non-blocking cases)
    const [confirmDeleteDialogState, setConfirmDeleteDialogState] = useState<{
        open: boolean
        catalog: CatalogWithHubs | null
    }>({ open: false, catalog: null })

    // State for blocking-entities delete flow (actual catalog deletion)
    const [blockingDeleteDialogState, setBlockingDeleteDialogState] = useState<{
        open: boolean
        catalog: CatalogWithHubs | null
    }>({ open: false, catalog: null })

    // State for ConflictResolutionDialog
    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingData: CatalogPendingData | null
        catalogId: string | null
    }>({ open: false, conflict: null, pendingData: null, catalogId: null })
    const [isAttachDialogOpen, setAttachDialogOpen] = useState(false)
    const [isAttachingExisting, setAttachingExisting] = useState(false)
    const [attachDialogError, setAttachDialogError] = useState<string | null>(null)

    const { confirm } = useConfirm()

    // Filter entity actions based on settings (allowCopy / allowDelete)
    const filteredCatalogActions = useMemo(
        () =>
            catalogActions.filter((a) => {
                if (a.id === 'copy' && !allowCopy) return false
                if (a.id === 'delete' && !allowDelete) return false
                return true
            }),
        [allowCopy, allowDelete]
    )

    const createCatalogMutation = useCreateCatalog()
    const createCatalogAtMetahubMutation = useCreateCatalogAtMetahub()
    const updateCatalogMutation = useUpdateCatalog()
    const deleteCatalogMutation = useDeleteCatalog()
    const updateCatalogAtMetahubMutation = useUpdateCatalogAtMetahub()
    const copyCatalogMutation = useCopyCatalog()
    const reorderCatalogMutation = useReorderCatalog()

    const sortedCatalogs = useMemo(
        () =>
            [...catalogs].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [catalogs]
    )

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedCatalogs)) {
            sortedCatalogs.forEach((catalog) => {
                if (catalog?.id) {
                    imagesMap[catalog.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedCatalogs])

    const catalogMap = useMemo(() => {
        if (!Array.isArray(sortedCatalogs)) return new Map<string, CatalogWithHubs>()
        return new Map(sortedCatalogs.map((catalog) => [catalog.id, catalog]))
    }, [sortedCatalogs])

    const allCatalogsById = useMemo(() => {
        const map = new Map<string, CatalogWithHubs>()
        const items = allCatalogsResponse?.items ?? []
        items.forEach((catalog) => map.set(catalog.id, catalog))
        return map
    }, [allCatalogsResponse?.items])

    const existingCatalogCodenames = useMemo(() => allCatalogsResponse?.items ?? catalogs ?? [], [allCatalogsResponse?.items, catalogs])

    const attachableExistingCatalogs = useMemo(() => {
        if (!isHubScoped || !hubId) return []
        return (allCatalogsResponse?.items ?? []).filter((catalog) => {
            const linkedHubIds = Array.isArray(catalog.hubs) ? catalog.hubs.map((hub) => hub.id) : []
            if (linkedHubIds.includes(hubId)) return false
            if (catalog.isSingleHub && linkedHubIds.length > 0) return false
            return true
        })
    }, [allCatalogsResponse?.items, hubId, isHubScoped])

    const attachExistingCatalogSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('catalogs.attachExisting.selectionTitle', 'Catalogs'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('catalogs.attachExisting.selectDialogTitle', 'Select catalogs'),
            emptyMessage: t('catalogs.attachExisting.emptySelection', 'No catalogs selected'),
            noAvailableMessage: t('catalogs.attachExisting.noAvailable', 'No catalogs available to add'),
            searchPlaceholder: t('common:search', 'Search...'),
            cancelButton: t('common:actions.cancel', 'Cancel'),
            confirmButton: t('common:actions.add', 'Add'),
            removeTitle: t('common:actions.remove', 'Remove'),
            nameHeader: t('table.name', 'Name'),
            codenameHeader: t('common:fields.codename', 'Codename')
        }),
        [t]
    )

    // Form defaults with current hub auto-selected in hub-scoped mode (N:M relationship)
    const localizedFormDefaults = useMemo<CatalogFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codenameVlc: null,
            codename: '',
            codenameTouched: false,
            hubIds: hubId ? [hubId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false // Default: catalog can exist without hubs
        }),
        [hubId]
    )

    const validateCatalogForm = useCallback(
        (values: GenericFormValues) => {
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
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!normalizedCodename) {
                errors.codename = t('catalogs.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('catalogs.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveCatalogForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // Hub requirement only if isRequiredHub is true
            const hubsValid = !isRequiredHub || hubIds.length > 0
            return (
                !values._hasCodenameDuplicate &&
                hubsValid &&
                hasPrimaryContent(nameVlc) &&
                Boolean(normalizedCodename) &&
                isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            )
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style]
    )

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
            values: GenericFormValues
            setValue: (name: string, value: unknown) => void
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
                            uiLocale={preferredVlcLocale}
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
                            uiLocale={preferredVlcLocale}
                            currentHubId={hubId ?? null}
                        />
                    )
                }
            ]
        },
        [hubs, preferredVlcLocale, t, tc, hubId]
    )

    const catalogColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'sortOrder',
                label: t('attributes.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: CatalogWithHubsDisplay) => row.sortOrder ?? 0,
                render: (row: CatalogWithHubsDisplay) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        {typeof row.sortOrder === 'number' ? row.sortOrder : '—'}
                    </Typography>
                )
            },
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
                id: 'elementsCount',
                label: t('catalogs.elementsHeader', 'Elements'),
                width: '10%',
                align: 'center' as const,
                render: (row: CatalogWithHubsDisplay) => (typeof row.elementsCount === 'number' ? row.elementsCount : '—')
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
        (baseContext: CatalogMenuBaseContext) => ({
            ...baseContext,
            catalogMap,
            uiLocale: preferredVlcLocale,
            hubs, // Pass hubs for hub selector in edit dialog (N:M)
            currentHubId: isHubScoped ? hubId ?? null : null,
            api: {
                updateEntity: async (id: string, patch: CatalogLocalizedPayload & { expectedVersion?: number }) => {
                    if (!metahubId) return
                    const catalog = catalogMap.get(id)
                    const normalizedCodename = normalizeCodenameForStyle(patch.codename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('catalogs.validation.codenameRequired', 'Codename is required'))
                    }
                    // Include expectedVersion for optimistic locking if catalog has version
                    const expectedVersion = catalog?.version
                    const dataWithVersion = { ...patch, codename: normalizedCodename, expectedVersion }

                    try {
                        // In hub-scoped mode, use hubId from URL; in global mode, check if catalog has hubs
                        const targetHubId = isHubScoped ? hubId! : catalog?.hubs?.[0]?.id
                        if (targetHubId) {
                            // Use hub-scoped endpoint
                            await updateCatalogMutation.mutateAsync({
                                metahubId,
                                hubId: targetHubId,
                                catalogId: id,
                                data: dataWithVersion
                            })
                        } else {
                            // Use metahub-level endpoint for catalogs without hubs
                            await updateCatalogAtMetahubMutation.mutateAsync({
                                metahubId,
                                catalogId: id,
                                data: dataWithVersion
                            })
                        }
                    } catch (error: unknown) {
                        // Check for optimistic lock conflict
                        if (isOptimisticLockConflict(error)) {
                            const conflict = extractConflictInfo(error)
                            if (conflict) {
                                setConflictState({
                                    open: true,
                                    conflict,
                                    pendingData: { ...patch, codename: normalizedCodename },
                                    catalogId: id
                                })
                                return // Don't rethrow - dialog will handle
                            }
                        }
                        throw error
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
                },
                copyEntity: async (id: string, payload: CatalogLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId) return
                    await copyCatalogMutation.mutateAsync({
                        metahubId,
                        catalogId: id,
                        data: payload
                    })
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
                confirm: async (spec: ConfirmSpec) => {
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
                    const hubsCount = Array.isArray(catalog.hubs) ? catalog.hubs.length : 0
                    const willDeleteCatalog = !isHubScoped || (!catalog.isRequiredHub && hubsCount === 1)

                    if (willDeleteCatalog) {
                        setBlockingDeleteDialogState({ open: true, catalog })
                        return
                    }

                    setConfirmDeleteDialogState({ open: true, catalog })
                }
            }
        }),
        [
            confirm,
            copyCatalogMutation,
            codenameConfig.alphabet,
            codenameConfig.style,
            deleteCatalogMutation,
            enqueueSnackbar,
            catalogMap,
            hubs,
            hubId,
            isHubScoped,
            metahubId,
            preferredVlcLocale,
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

    const handleOpenAttachExistingDialog = () => {
        setAttachDialogError(null)
        setAttachDialogOpen(true)
    }

    const handleCloseAttachExistingDialog = () => {
        if (isAttachingExisting) return
        setAttachDialogError(null)
        setAttachDialogOpen(false)
    }

    const handleAttachExistingCatalogs = async (data: GenericFormValues) => {
        if (!metahubId || !hubId) return

        const selectedCatalogIds = Array.isArray(data.selectedCatalogIds)
            ? data.selectedCatalogIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedCatalogIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedCatalogs = selectedCatalogIds
                .map((catalogId) => allCatalogsById.get(catalogId))
                .filter((catalog): catalog is CatalogWithHubs => Boolean(catalog))
            const failed: string[] = []

            for (const catalog of selectedCatalogs) {
                try {
                    const currentHubIds = Array.isArray(catalog.hubs) ? catalog.hubs.map((hub) => hub.id) : []
                    const nextHubIds = Array.from(new Set([...currentHubIds, hubId]))
                    await catalogsApi.updateCatalogAtMetahub(metahubId, catalog.id, {
                        hubIds: nextHubIds,
                        expectedVersion: catalog.version
                    })
                } catch (error) {
                    failed.push(getVLCString(catalog.name, preferredVlcLocale) || getVLCString(catalog.name, 'en') || catalog.codename)
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing catalog to current hub', error)
                }
            }

            await Promise.all([
                invalidateCatalogsQueries.all(queryClient, metahubId, hubId),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId) })
            ])

            if (failed.length === 0) {
                enqueueSnackbar(
                    t('catalogs.attachExisting.success', { count: selectedCatalogs.length, defaultValue: 'Added {{count}} catalog(s).' }),
                    { variant: 'success' }
                )
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedCatalogs.length - failed.length
            if (successCount > 0) {
                enqueueSnackbar(
                    t('catalogs.attachExisting.partialSuccess', {
                        successCount,
                        failCount: failed.length,
                        defaultValue: 'Added {{successCount}} catalog(s). {{failCount}} catalog(s) could not be linked.'
                    }),
                    { variant: 'warning' }
                )
                setAttachDialogOpen(false)
                return
            }

            setAttachDialogError(
                t('catalogs.attachExisting.failedAll', {
                    defaultValue: 'Selected catalogs could not be linked to this hub. Please review restrictions and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateCatalog = async (data: GenericFormValues) => {
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
            const codenameVlc = data.codenameVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setDialogError(tc('crud.nameRequired', 'Name is required'))
                return
            }
            const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
            const { input: codenameInput, primaryLocale: codenamePrimaryLocale } = extractLocalizedInput(codenameVlc)
            const normalizedCodename = normalizeCodenameForStyle(String(data.codename || ''), codenameConfig.style, codenameConfig.alphabet)
            if (!normalizedCodename) {
                setDialogError(t('catalogs.validation.codenameRequired', 'Codename is required'))
                return
            }
            if (!isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)) {
                setDialogError(t('catalogs.validation.codenameInvalid', 'Codename contains invalid characters'))
                return
            }

            const isSingleHub = Boolean(data.isSingleHub)

            if (isHubScoped && hubId && !hubIds.includes(hubId)) {
                const confirmed = await confirm({
                    title: t('catalogs.detachedConfirm.title', 'Create catalog without current hub?'),
                    description: t(
                        'catalogs.detachedConfirm.description',
                        'This catalog is not linked to the current hub and will not appear in this hub after creation.'
                    ),
                    confirmButtonName: t('common:actions.create', 'Create'),
                    cancelButtonName: t('common:actions.cancel', 'Cancel')
                })
                if (!confirmed) {
                    throw DIALOG_SAVE_CANCEL
                }
            }

            // Choose API endpoint based on whether we have hubs
            if (hubIds.length > 0) {
                // Use hub-scoped endpoint with first hub
                const primaryHubId = hubIds[0]
                await createCatalogMutation.mutateAsync({
                    metahubId: metahubId!,
                    hubId: primaryHubId,
                    data: {
                        codename: normalizedCodename,
                        codenameInput,
                        codenamePrimaryLocale,
                        name: nameInput,
                        description: descriptionInput,
                        namePrimaryLocale,
                        descriptionPrimaryLocale,
                        hubIds, // Pass all hubIds for N:M association
                        isSingleHub,
                        isRequiredHub
                    }
                })
            } else {
                // No hubs selected - use metahub-level endpoint
                await createCatalogAtMetahubMutation.mutateAsync({
                    metahubId: metahubId!,
                    data: {
                        codename: normalizedCodename,
                        codenameInput,
                        codenamePrimaryLocale,
                        name: nameInput,
                        description: descriptionInput,
                        namePrimaryLocale,
                        descriptionPrimaryLocale,
                        hubIds: [], // Empty array
                        isSingleHub,
                        isRequiredHub
                    }
                })
            }
            handleDialogSave()
        } catch (e: unknown) {
            if (
                e &&
                typeof e === 'object' &&
                '__dialogCancelled' in e &&
                (e as { __dialogCancelled?: unknown }).__dialogCancelled === true
            ) {
                throw e
            }
            const responseMessage = extractResponseMessage(e)
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

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const handleHubTabChange = (_event: unknown, tabValue: 'hubs' | 'catalogs' | 'sets' | 'enumerations') => {
        if (!metahubId || !hubId) return
        if (tabValue === 'hubs') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/hubs`)
            return
        }
        if (tabValue === 'sets') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/sets`)
            return
        }
        if (tabValue === 'enumerations') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/enumerations`)
            return
        }
        navigate(`/metahub/${metahubId}/hub/${hubId}/catalogs`)
    }

    // Transform Catalog data for display - use hub-aware version for global mode
    const getCatalogCardData = (catalog: CatalogWithHubs): CatalogWithHubsDisplay => toCatalogWithHubsDisplay(catalog, i18n.language)
    const showAttachExistingAction = isHubScoped && allowAttachExistingEntities
    const hasAttachableExistingCatalogs = attachableExistingCatalogs.length > 0

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overCatalog = sortedCatalogs.find((catalog) => catalog.id === String(over.id))
        if (!overCatalog) return

        try {
            await reorderCatalogMutation.mutateAsync({
                metahubId,
                hubId,
                catalogId: String(active.id),
                newSortOrder: overCatalog.sortOrder ?? 1
            })
            enqueueSnackbar(t('catalogs.reorderSuccess', 'Catalog order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('catalogs.reorderError', 'Failed to reorder catalog')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const catalog = catalogMap.get(activeId)
        if (!catalog) return null
        const display = getCatalogCardData(catalog)
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
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{display.name || display.codename || catalog.id}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{display.codename || '—'}</Typography>
                </Stack>
            </Box>
        )
    }

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <ExistingCodenamesProvider entities={existingCatalogCodenames}>
                {error ? (
                    <EmptyListState
                        image={APIEmptySVG}
                        imageAlt='Connection error'
                        title={t('errors.connectionFailed')}
                        description={!extractResponseStatus(error) ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
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
                                    label: tc('create'),
                                    onClick: handleAddNew,
                                    startIcon: <AddRoundedIcon />
                                }}
                                primaryActionMenuItems={
                                    showAttachExistingAction && hasAttachableExistingCatalogs
                                        ? [
                                              {
                                                  label: t('common:actions.add', 'Add'),
                                                  onClick: handleOpenAttachExistingDialog
                                              }
                                          ]
                                        : undefined
                                }
                            />
                        </ViewHeader>

                        {isHubScoped && (
                            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                <Tabs
                                    value='catalogs'
                                    onChange={handleHubTabChange}
                                    aria-label={t('hubs.title', 'Hubs')}
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
                                    <Tab value='hubs' label={t('hubs.title')} />
                                    <Tab value='catalogs' label={t('catalogs.title')} />
                                    <Tab value='sets' label={t('sets.title')} />
                                    <Tab value='enumerations' label={t('enumerations.title')} />
                                </Tabs>
                            </Box>
                        )}

                        <Box sx={{ mt: isHubScoped ? 2 : 0 }}>
                            {isLoading && sortedCatalogs.length === 0 ? (
                                view === 'card' ? (
                                    <SkeletonGrid />
                                ) : (
                                    <Skeleton variant='rectangular' height={120} />
                                )
                            ) : !isLoading && sortedCatalogs.length === 0 ? (
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
                                            {sortedCatalogs.map((catalog: CatalogWithHubs) => {
                                                const descriptors = [...filteredCatalogActions]
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
                                                data={sortedCatalogs.map(getCatalogCardData)}
                                                images={images}
                                                isLoading={isLoading}
                                                sortableRows
                                                sortableItemIds={sortedCatalogs.map((catalog) => catalog.id)}
                                                dragHandleAriaLabel={t('catalogs.dnd.dragHandle', 'Drag to reorder')}
                                                dragDisabled={reorderCatalogMutation.isPending || isLoading}
                                                onSortableDragEnd={handleSortableDragEnd}
                                                renderDragOverlay={renderDragOverlay}
                                                getRowLink={(row: CatalogWithHubsDisplay) =>
                                                    row?.id
                                                        ? isHubScoped
                                                            ? `/metahub/${metahubId}/hub/${hubId}/catalog/${row.id}/attributes`
                                                            : `/metahub/${metahubId}/catalog/${row.id}/attributes`
                                                        : undefined
                                                }
                                                customColumns={catalogColumns}
                                                i18nNamespace='flowList'
                                                renderActions={(row: CatalogWithHubsDisplay) => {
                                                    const originalCatalog = catalogMap.get(row.id)
                                                    if (!originalCatalog) return null

                                                    const descriptors = [...filteredCatalogActions]
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
                        </Box>

                        {/* Table Pagination at bottom */}
                        {!isLoading && sortedCatalogs.length > 0 && (
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
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
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

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('catalogs.attachExisting.dialogTitle', 'Add Existing Catalogs')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingCatalogs}
                    hideDefaultFields
                    initialExtraValues={{ selectedCatalogIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedCatalogIds = Array.isArray(values.selectedCatalogIds)
                            ? values.selectedCatalogIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'catalogs',
                                label: t('catalogs.title', 'Catalogs'),
                                content: (
                                    <EntitySelectionPanel<CatalogWithHubs>
                                        availableEntities={attachableExistingCatalogs}
                                        selectedIds={selectedCatalogIds}
                                        onSelectionChange={(ids) => setValue('selectedCatalogIds', ids)}
                                        getDisplayName={(catalog) =>
                                            getVLCString(catalog.name, preferredVlcLocale) ||
                                            getVLCString(catalog.name, 'en') ||
                                            catalog.codename ||
                                            '—'
                                        }
                                        getCodename={(catalog) => catalog.codename}
                                        labels={attachExistingCatalogSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedCatalogIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedCatalogIds = Array.isArray(values.selectedCatalogIds)
                            ? values.selectedCatalogIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedCatalogIds.length > 0) return null
                        return {
                            selectedCatalogIds: t('catalogs.attachExisting.requiredSelection', 'Select at least one catalog to add.')
                        }
                    }}
                    canSave={(values) => {
                        const selectedCatalogIds = Array.isArray(values.selectedCatalogIds)
                            ? values.selectedCatalogIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedCatalogIds.length > 0
                    }}
                />

                {/* Independent ConfirmDeleteDialog */}
                <ConfirmDeleteDialog
                    open={confirmDeleteDialogState.open}
                    title={t('catalogs.deleteDialog.title')}
                    description={t('catalogs.deleteDialog.message')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => setConfirmDeleteDialogState({ open: false, catalog: null })}
                    onConfirm={async () => {
                        if (confirmDeleteDialogState.catalog && metahubId) {
                            try {
                                const deletingCatalogId = confirmDeleteDialogState.catalog.id
                                // In hub-scoped mode, use hubId from URL; in global mode, use primary hub
                                const targetHubId = isHubScoped ? hubId! : confirmDeleteDialogState.catalog.hubs?.[0]?.id || ''
                                await deleteCatalogMutation.mutateAsync({
                                    metahubId,
                                    hubId: targetHubId,
                                    catalogId: deletingCatalogId,
                                    force: !isHubScoped // Force delete in global mode
                                })
                                setConfirmDeleteDialogState({ open: false, catalog: null })
                                queryClient.removeQueries({
                                    queryKey: metahubsQueryKeys.blockingCatalogReferences(metahubId, deletingCatalogId)
                                })
                            } catch (err: unknown) {
                                const responseMessage = extractResponseMessage(err)
                                const message =
                                    typeof responseMessage === 'string'
                                        ? responseMessage
                                        : err instanceof Error
                                        ? err.message
                                        : typeof err === 'string'
                                        ? err
                                        : t('catalogs.deleteError')
                                enqueueSnackbar(message, { variant: 'error' })
                                setConfirmDeleteDialogState({ open: false, catalog: null })
                            }
                        }
                    }}
                />

                <CatalogDeleteDialog
                    open={blockingDeleteDialogState.open}
                    catalog={blockingDeleteDialogState.catalog}
                    metahubId={metahubId}
                    onClose={() => setBlockingDeleteDialogState({ open: false, catalog: null })}
                    onConfirm={async (catalog) => {
                        try {
                            const targetHubId = isHubScoped ? hubId : catalog.hubs?.[0]?.id
                            await deleteCatalogMutation.mutateAsync({
                                metahubId,
                                hubId: targetHubId,
                                catalogId: catalog.id,
                                force: !isHubScoped
                            })
                            setBlockingDeleteDialogState({ open: false, catalog: null })
                            queryClient.removeQueries({ queryKey: metahubsQueryKeys.blockingCatalogReferences(metahubId, catalog.id) })
                        } catch (err: unknown) {
                            const responseMessage = extractResponseMessage(err)
                            const message =
                                typeof responseMessage === 'string'
                                    ? responseMessage
                                    : err instanceof Error
                                    ? err.message
                                    : typeof err === 'string'
                                    ? err
                                    : t('catalogs.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setBlockingDeleteDialogState({ open: false, catalog: null })
                        }
                    }}
                    isDeleting={deleteCatalogMutation.isPending}
                    uiLocale={i18n.language}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={conflictState.open}
                    conflict={conflictState.conflict}
                    onOverwrite={async () => {
                        if (!metahubId || !conflictState.catalogId || !conflictState.pendingData) return
                        try {
                            const catalog = catalogMap.get(conflictState.catalogId)
                            const targetHubId = isHubScoped ? hubId! : catalog?.hubs?.[0]?.id
                            // Retry without expectedVersion to force overwrite
                            if (targetHubId) {
                                await updateCatalogMutation.mutateAsync({
                                    metahubId,
                                    hubId: targetHubId,
                                    catalogId: conflictState.catalogId,
                                    data: conflictState.pendingData as CatalogLocalizedPayload
                                })
                            } else {
                                await updateCatalogAtMetahubMutation.mutateAsync({
                                    metahubId,
                                    catalogId: conflictState.catalogId,
                                    data: conflictState.pendingData as CatalogLocalizedPayload
                                })
                            }
                            setConflictState({ open: false, conflict: null, pendingData: null, catalogId: null })
                            enqueueSnackbar(t('catalogs.updateSuccess', 'Catalog updated'), { variant: 'success' })
                        } catch (e) {
                            console.error('Failed to overwrite catalog', e)
                            enqueueSnackbar(t('catalogs.updateError', 'Failed to update catalog'), { variant: 'error' })
                        }
                    }}
                    onReload={async () => {
                        // Reload the list to get latest data
                        if (metahubId) {
                            if (isHubScoped && hubId) {
                                await invalidateCatalogsQueries.all(queryClient, metahubId, hubId)
                            } else {
                                await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId) })
                            }
                        }
                        setConflictState({ open: false, conflict: null, pendingData: null, catalogId: null })
                    }}
                    onCancel={() => {
                        setConflictState({ open: false, conflict: null, pendingData: null, catalogId: null })
                    }}
                />

                <ConfirmDialog />
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

const CatalogList = () => {
    return (
        <ConfirmContextProvider>
            <CatalogListContent />
        </ConfirmContextProvider>
    )
}

export default CatalogList
