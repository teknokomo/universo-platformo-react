import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Box, ButtonBase, Chip, Divider, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material'
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
    useConfirm,
    LocalizedInlineField,
    useCodenameAutoFillVlc,
    EntitySelectionPanel,
    revealPendingEntityFeedback
} from '@universo/template-mui'
import type { DragEndEvent } from '@universo/template-mui'
import type { EntitySelectionLabels } from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import {
    useCreateEnumeration,
    useCreateEnumerationAtMetahub,
    useUpdateEnumeration,
    useUpdateEnumerationAtMetahub,
    useDeleteEnumeration,
    useCopyEnumeration,
    useReorderEnumeration
} from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as enumerationsApi from '../api'
import type { EnumerationWithHubs } from '../api'
import * as hubsApi from '../../hubs'
import { fetchAllPaginatedItems, invalidateEnumerationsQueries, metahubsQueryKeys } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { EnumerationDisplay, EnumerationLocalizedPayload, Hub, PaginatedResponse, getVLCString, toEnumerationDisplay } from '../../../types'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { EnumerationDeleteDialog, CodenameField, HubSelectionPanel, ExistingCodenamesProvider } from '../../../components'
import enumerationActions, { EnumerationDisplayWithHub } from './EnumerationActions'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'

/**
 * Hub info for display in the table column (global view)
 */
interface HubDisplayInfo {
    id: string
    name: string
    codename: string
}

/**
 * Extended EnumerationDisplay that includes hub info for the all-enumerations view.
 * For N:M relationship, we use the primary hub (first in list) for navigation.
 */
interface EnumerationWithHubsDisplay extends EnumerationDisplay {
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

type EnumerationFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    /** For N:M relationship - array of hub IDs */
    hubIds: string[]
    /** Single hub mode flag */
    isSingleHub: boolean
    /** Require at least one hub association */
    isRequiredHub: boolean
}

type GenericFormValues = Record<string, unknown>

type EnumerationPendingData = EnumerationLocalizedPayload & { expectedVersion?: number }

type EnumerationMenuBaseContext = {
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
    const codename = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codenameTouched = Boolean(values.codenameTouched)
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
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched: boolean) => setValue('codenameTouched', touched)}
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
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
 * Convert EnumerationWithHubs to display format with hub info (for global view)
 */
const toEnumerationWithHubsDisplay = (enumeration: EnumerationWithHubs, locale: string): EnumerationWithHubsDisplay => {
    const base = toEnumerationDisplay(enumeration, locale)
    const hubs = enumeration.hubs || []
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

const EnumerationListContent = () => {
    const codenameConfig = useCodenameConfig()
    const navigate = useNavigate()
    // hubId is optional - when present, we're in hub-scoped mode; otherwise global mode
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId?: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const preferredVlcLocale = useMetahubPrimaryLocale()

    /**
     * isHubScoped determines the component behavior:
     * - true: Hub-scoped view (inside a specific hub) - uses enumerationsList API
     * - false: Global view (all enumerations in metahub) - uses allEnumerationsList API
     */
    const isHubScoped = Boolean(hubId)

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    // Use different storage keys for different views
    const [view, setView] = useViewPreference(
        isHubScoped ? STORAGE_KEYS.ENUMERATION_DISPLAY_STYLE : STORAGE_KEYS.ALL_ENUMERATIONS_DISPLAY_STYLE
    )

    const { allowCopy, allowDelete, allowAttachExistingEntities } = useEntityPermissions('enumerations')
    const hubsListParams = useMemo(() => ({ limit: 1000, offset: 0, sortBy: 'sortOrder' as const, sortOrder: 'asc' as const }), [])

    // Fetch hubs for the create dialog (N:M relationship)
    const { data: hubsData } = useQuery<PaginatedResponse<Hub>>({
        queryKey: metahubId ? metahubsQueryKeys.hubsList(metahubId, hubsListParams) : ['metahubs', 'hubs', 'list', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems((params) => hubsApi.listHubs(metahubId, params), {
                limit: hubsListParams.limit,
                sortBy: hubsListParams.sortBy,
                sortOrder: hubsListParams.sortOrder
            })
        },
        enabled: !!metahubId,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        staleTime: 5 * 60 * 1000,
        retry: false
    })
    const hubs = useMemo(() => hubsData?.items ?? [], [hubsData?.items])

    const { data: allEnumerationsResponse } = useQuery<PaginatedResponse<EnumerationWithHubs>>({
        queryKey: metahubId
            ? metahubsQueryKeys.allEnumerationsList(metahubId, { limit: 1000, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' })
            : ['metahubs', 'enumerations', 'all', 'empty'],
        queryFn: async () => {
            if (!metahubId) {
                return { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } }
            }
            return fetchAllPaginatedItems((params) => enumerationsApi.listAllEnumerations(metahubId, params), {
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

    // Use paginated hook for enumerations list - conditional API based on isHubScoped
    const paginationResult = usePaginated<EnumerationWithHubs, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.enumerationsList(metahubId, hubId!, params)
                : (params) => metahubsQueryKeys.allEnumerationsList(metahubId, params)
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => enumerationsApi.listEnumerations(metahubId, hubId!, params)
                : (params) => enumerationsApi.listAllEnumerations(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!hubId : true)
    })

    const { data: enumerations, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    // Instant search for better UX
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for simple confirmation delete flow (unlink or other non-blocking cases)
    const [confirmDeleteDialogState, setConfirmDeleteDialogState] = useState<{
        open: boolean
        enumeration: EnumerationWithHubs | null
    }>({ open: false, enumeration: null })

    // State for blocking-entities delete flow (actual enumeration deletion)
    const [blockingDeleteDialogState, setBlockingDeleteDialogState] = useState<{
        open: boolean
        enumeration: EnumerationWithHubs | null
    }>({ open: false, enumeration: null })

    // State for ConflictResolutionDialog
    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingData: EnumerationPendingData | null
        enumerationId: string | null
    }>({ open: false, conflict: null, pendingData: null, enumerationId: null })
    const [isAttachDialogOpen, setAttachDialogOpen] = useState(false)
    const [isAttachingExisting, setAttachingExisting] = useState(false)
    const [attachDialogError, setAttachDialogError] = useState<string | null>(null)
    const [pendingEnumerationNavigation, setPendingEnumerationNavigation] = useState<{ pendingId: string; codename: string } | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const { confirm } = useConfirm()

    // Filter entity actions based on settings (allowCopy / allowDelete)
    const filteredEnumerationActions = useMemo(
        () =>
            enumerationActions.filter((a) => {
                if (a.id === 'copy' && !allowCopy) return false
                if (a.id === 'delete' && !allowDelete) return false
                return true
            }),
        [allowCopy, allowDelete]
    )

    const createEnumerationMutation = useCreateEnumeration()
    const createEnumerationAtMetahubMutation = useCreateEnumerationAtMetahub()
    const updateEnumerationMutation = useUpdateEnumeration()
    const deleteEnumerationMutation = useDeleteEnumeration()
    const updateEnumerationAtMetahubMutation = useUpdateEnumerationAtMetahub()
    const copyEnumerationMutation = useCopyEnumeration()
    const reorderEnumerationMutation = useReorderEnumeration()

    const sortedEnumerations = useMemo(
        () =>
            [...enumerations].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [enumerations]
    )

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedEnumerations)) {
            sortedEnumerations.forEach((enumeration) => {
                if (enumeration?.id) {
                    imagesMap[enumeration.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedEnumerations])

    const enumerationMap = useMemo(() => {
        if (!Array.isArray(sortedEnumerations)) return new Map<string, EnumerationWithHubs>()
        return new Map(sortedEnumerations.map((enumeration) => [enumeration.id, enumeration]))
    }, [sortedEnumerations])

    useEffect(() => {
        if (!pendingEnumerationNavigation || !metahubId) return

        if (sortedEnumerations.some((enumeration) => enumeration.id === pendingEnumerationNavigation.pendingId)) {
            return
        }

        const resolvedEnumeration = sortedEnumerations.find(
            (enumeration) => !isPendingEntity(enumeration) && enumeration.codename === pendingEnumerationNavigation.codename
        )

        if (!resolvedEnumeration) return

        setPendingEnumerationNavigation(null)
        navigate(
            isHubScoped && hubId
                ? `/metahub/${metahubId}/hub/${hubId}/enumeration/${resolvedEnumeration.id}/values`
                : `/metahub/${metahubId}/enumeration/${resolvedEnumeration.id}/values`
        )
    }, [hubId, isHubScoped, metahubId, navigate, pendingEnumerationNavigation, sortedEnumerations])

    const handlePendingEnumerationInteraction = useCallback(
        (pendingEnumerationId: string) => {
            if (!metahubId) return
            const pendingEnumeration = enumerationMap.get(pendingEnumerationId)
            if (pendingEnumeration?.codename) {
                setPendingEnumerationNavigation({ pendingId: pendingEnumeration.id, codename: pendingEnumeration.codename })
            }
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix:
                    isHubScoped && hubId ? metahubsQueryKeys.enumerations(metahubId, hubId) : metahubsQueryKeys.allEnumerations(metahubId),
                entityId: pendingEnumerationId,
                extraQueryKeys: [
                    isHubScoped && hubId
                        ? metahubsQueryKeys.enumerationDetailInHub(metahubId, hubId, pendingEnumerationId)
                        : metahubsQueryKeys.enumerationDetail(metahubId, pendingEnumerationId)
                ]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, enumerationMap, hubId, isHubScoped, metahubId, pendingInteractionMessage, queryClient]
    )

    const allEnumerationsById = useMemo(() => {
        const map = new Map<string, EnumerationWithHubs>()
        const items = allEnumerationsResponse?.items ?? []
        items.forEach((enumeration) => map.set(enumeration.id, enumeration))
        return map
    }, [allEnumerationsResponse?.items])

    const existingEnumerationCodenames = useMemo(
        () => allEnumerationsResponse?.items ?? enumerations ?? [],
        [allEnumerationsResponse?.items, enumerations]
    )

    const attachableExistingEnumerations = useMemo(() => {
        if (!isHubScoped || !hubId) return []
        return (allEnumerationsResponse?.items ?? []).filter((enumeration) => {
            const linkedHubIds = Array.isArray(enumeration.hubs) ? enumeration.hubs.map((hub) => hub.id) : []
            if (linkedHubIds.includes(hubId)) return false
            if (enumeration.isSingleHub && linkedHubIds.length > 0) return false
            return true
        })
    }, [allEnumerationsResponse?.items, hubId, isHubScoped])

    const attachExistingEnumerationSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('enumerations.attachExisting.selectionTitle', 'Enumerations'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('enumerations.attachExisting.selectDialogTitle', 'Select enumerations'),
            emptyMessage: t('enumerations.attachExisting.emptySelection', 'No enumerations selected'),
            noAvailableMessage: t('enumerations.attachExisting.noAvailable', 'No enumerations available to add'),
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
    const localizedFormDefaults = useMemo<EnumerationFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            hubIds: hubId ? [hubId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false // Default: enumeration can exist without hubs
        }),
        [hubId]
    )

    const validateEnumerationForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // Hub validation only if isRequiredHub is true
            if (isRequiredHub && hubIds.length === 0) {
                errors.hubIds = t('enumerations.validation.hubRequired', 'At least one hub is required')
            }
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!normalizedCodename) {
                errors.codename = t('enumerations.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('enumerations.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveEnumerationForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
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
                    label: t('enumerations.tabs.general', 'Основное'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            errors={errors}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('enumerations.codename', 'Codename')}
                            codenameHelper={t('enumerations.codenameHelper', 'Unique identifier')}
                        />
                    )
                },
                {
                    id: 'hubs',
                    label: t('enumerations.tabs.hubs', 'Хабы'),
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

    const enumerationColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'sortOrder',
                label: t('attributes.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: EnumerationWithHubsDisplay) => row.sortOrder ?? 0,
                render: (row: EnumerationWithHubsDisplay) => (
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
                sortAccessor: (row: EnumerationWithHubsDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: EnumerationWithHubsDisplay) => {
                    const href = isHubScoped
                        ? `/metahub/${metahubId}/hub/${hubId}/enumeration/${row.id}/values`
                        : `/metahub/${metahubId}/enumeration/${row.id}/values`
                    return isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingEnumerationInteraction(row.id)}
                            sx={{ alignItems: 'flex-start', display: 'inline-flex', justifyContent: 'flex-start', textAlign: 'left' }}
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
                        </ButtonBase>
                    ) : (
                        <Link to={href} style={{ textDecoration: 'none', color: 'inherit' }}>
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
                }
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: isHubScoped ? '30%' : '25%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: EnumerationWithHubsDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: EnumerationWithHubsDisplay) => (
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
                label: t('enumerations.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: EnumerationWithHubsDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: EnumerationWithHubsDisplay) => (
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
            render: (row: EnumerationWithHubsDisplay) => (
                <Stack direction='column' spacing={0.5}>
                    {row.allHubs.map((hub) =>
                        isPendingEntity(row) ? (
                            <Chip
                                key={hub.id}
                                label={hub.name}
                                size='small'
                                variant='outlined'
                                clickable
                                onClick={() => handlePendingEnumerationInteraction(row.id)}
                                sx={{
                                    maxWidth: '100%',
                                    '&:hover': {
                                        backgroundColor: 'action.hover'
                                    }
                                }}
                            />
                        ) : (
                            <Link
                                key={hub.id}
                                to={`/metahub/${metahubId}/hub/${hub.id}/enumerations`}
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
                        )
                    )}
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
                id: 'valuesCount',
                label: t('enumerations.valuesHeader', 'Values'),
                width: '15%',
                align: 'center' as const,
                render: (row: EnumerationWithHubsDisplay) =>
                    typeof row.valuesCount === 'number' ? (
                        isPendingEntity(row) ? (
                            <ButtonBase onClick={() => handlePendingEnumerationInteraction(row.id)}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        '&:hover': {
                                            textDecoration: 'underline',
                                            color: 'primary.main'
                                        }
                                    }}
                                >
                                    {row.valuesCount}
                                </Typography>
                            </ButtonBase>
                        ) : (
                            <Link
                                to={
                                    isHubScoped
                                        ? `/metahub/${metahubId}/hub/${hubId}/enumeration/${row.id}/values`
                                        : `/metahub/${metahubId}/enumeration/${row.id}/values`
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
                                    {row.valuesCount}
                                </Typography>
                            </Link>
                        )
                    ) : (
                        '—'
                    )
            }
        ]

        // Combine columns based on mode
        if (isHubScoped) {
            return [...baseColumns, ...countColumns]
        } else {
            return [...baseColumns, hubColumn, ...countColumns]
        }
    }, [handlePendingEnumerationInteraction, hubId, isHubScoped, metahubId, t, tc])

    const createEnumerationContext = useCallback(
        (baseContext: EnumerationMenuBaseContext) => ({
            ...baseContext,
            enumerationMap,
            uiLocale: preferredVlcLocale,
            hubs, // Pass hubs for hub selector in edit dialog (N:M)
            currentHubId: isHubScoped ? hubId ?? null : null,
            api: {
                updateEntity: (id: string, patch: EnumerationLocalizedPayload & { expectedVersion?: number }) => {
                    if (!metahubId) return Promise.resolve()
                    const enumeration = enumerationMap.get(id)
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('enumerations.validation.codenameRequired', 'Codename is required'))
                    }
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    // Include expectedVersion for optimistic locking if enumeration has version
                    const expectedVersion = enumeration?.version
                    const dataWithVersion = { ...patch, codename: codenamePayload, expectedVersion }

                    const targetHubId = isHubScoped ? hubId! : enumeration?.hubs?.[0]?.id
                    const mutationOptions = {
                        onError: (error: unknown) => {
                            if (!isOptimisticLockConflict(error)) return
                            const conflict = extractConflictInfo(error)
                            if (!conflict) return
                            setConflictState({
                                open: true,
                                conflict,
                                pendingData: { ...patch, codename: codenamePayload },
                                enumerationId: id
                            })
                        }
                    }

                    if (targetHubId) {
                        updateEnumerationMutation.mutate(
                            {
                                metahubId,
                                hubId: targetHubId,
                                enumerationId: id,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    } else {
                        updateEnumerationAtMetahubMutation.mutate(
                            {
                                metahubId,
                                enumerationId: id,
                                data: dataWithVersion
                            },
                            { onError: mutationOptions.onError }
                        )
                    }

                    return Promise.resolve()
                },
                deleteEntity: (id: string) => {
                    if (!metahubId) return
                    const enumeration = enumerationMap.get(id)

                    if (isHubScoped && hubId) {
                        // Hub-scoped mode: use hubId from URL
                        return deleteEnumerationMutation.mutateAsync({
                            metahubId,
                            hubId,
                            enumerationId: id,
                            force: false
                        })
                    } else {
                        // Global mode: check if enumeration has hubs
                        const targetHubId = enumeration?.hubs?.[0]?.id
                        return deleteEnumerationMutation.mutateAsync({
                            metahubId,
                            hubId: targetHubId, // undefined for enumerations without hubs
                            enumerationId: id,
                            force: Boolean(targetHubId) // force=true if has multiple hubs
                        })
                    }
                },
                copyEntity: (id: string, payload: EnumerationLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId) return Promise.resolve()
                    copyEnumerationMutation.mutate({
                        metahubId,
                        enumerationId: id,
                        data: payload
                    })

                    return Promise.resolve()
                }
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        if (isHubScoped && hubId) {
                            void invalidateEnumerationsQueries.all(queryClient, metahubId, hubId)
                        } else {
                            // In global mode, invalidate all enumerations cache
                            void queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(metahubId) })
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
                openDeleteDialog: (entity: EnumerationDisplayWithHub | EnumerationDisplay) => {
                    const enumeration = enumerationMap.get(entity.id)
                    if (!enumeration) return
                    const hubsCount = Array.isArray(enumeration.hubs) ? enumeration.hubs.length : 0
                    const willDeleteEnumeration = !isHubScoped || (!enumeration.isRequiredHub && hubsCount === 1)

                    if (willDeleteEnumeration) {
                        setBlockingDeleteDialogState({ open: true, enumeration })
                        return
                    }

                    setConfirmDeleteDialogState({ open: true, enumeration })
                }
            }
        }),
        [
            codenameConfig.alphabet,
            codenameConfig.style,
            confirm,
            copyEnumerationMutation,
            deleteEnumerationMutation,
            enqueueSnackbar,
            enumerationMap,
            hubs,
            hubId,
            isHubScoped,
            metahubId,
            preferredVlcLocale,
            queryClient,
            t,
            updateEnumerationMutation,
            updateEnumerationAtMetahubMutation
        ]
    )

    // Validate metahubId from URL AFTER all hooks
    // In hub-scoped mode, also validate hubId
    if (!metahubId || (isHubScoped && !hubId)) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt={isHubScoped ? 'Invalid hub' : 'Invalid metahub'}
                title={t('metahubs:errors.invalidMetahub')}
                description={t('metahubs:errors.pleaseSelectMetahub')}
            />
        )
    }

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
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

    const handleAttachExistingEnumerations = async (data: GenericFormValues) => {
        if (!metahubId || !hubId) return

        const selectedEnumerationIds = Array.isArray(data.selectedEnumerationIds)
            ? data.selectedEnumerationIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedEnumerationIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedEnumerations = selectedEnumerationIds
                .map((enumerationId) => allEnumerationsById.get(enumerationId))
                .filter((enumeration): enumeration is EnumerationWithHubs => Boolean(enumeration))
            const failed: string[] = []

            for (const enumeration of selectedEnumerations) {
                try {
                    const currentHubIds = Array.isArray(enumeration.hubs) ? enumeration.hubs.map((hub) => hub.id) : []
                    const nextHubIds = Array.from(new Set([...currentHubIds, hubId]))
                    await enumerationsApi.updateEnumerationAtMetahub(metahubId, enumeration.id, {
                        hubIds: nextHubIds,
                        expectedVersion: enumeration.version
                    })
                } catch (error) {
                    failed.push(
                        getVLCString(enumeration.name, preferredVlcLocale) || getVLCString(enumeration.name, 'en') || enumeration.codename
                    )
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing enumeration to current hub', error)
                }
            }

            await Promise.all([
                invalidateEnumerationsQueries.all(queryClient, metahubId, hubId),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(metahubId) })
            ])

            if (failed.length === 0) {
                enqueueSnackbar(
                    t('enumerations.attachExisting.success', {
                        count: selectedEnumerations.length,
                        defaultValue: 'Added {{count}} enumeration(s).'
                    }),
                    { variant: 'success' }
                )
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedEnumerations.length - failed.length
            if (successCount > 0) {
                enqueueSnackbar(
                    t('enumerations.attachExisting.partialSuccess', {
                        successCount,
                        failCount: failed.length,
                        defaultValue: 'Added {{successCount}} enumeration(s). {{failCount}} enumeration(s) could not be linked.'
                    }),
                    { variant: 'warning' }
                )
                setAttachDialogOpen(false)
                return
            }

            setAttachDialogError(
                t('enumerations.attachExisting.failedAll', {
                    defaultValue: 'Selected enumerations could not be linked to this hub. Please review restrictions and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateEnumeration = async (data: GenericFormValues) => {
        // Validation is handled by EntityFormDialog's validate/canSave props.
        const hubIds = Array.isArray(data.hubIds) ? data.hubIds : []
        const isRequiredHub = Boolean(data.isRequiredHub)

        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
    const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        const isSingleHub = Boolean(data.isSingleHub)
    const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, normalizedCodename || '')

        // Confirm dialog for detached enumeration (async — throws DIALOG_SAVE_CANCEL if cancelled)
        if (isHubScoped && hubId && !hubIds.includes(hubId)) {
            const confirmed = await confirm({
                title: t('enumerations.detachedConfirm.title', 'Create enumeration without current hub?'),
                description: t(
                    'enumerations.detachedConfirm.description',
                    'This enumeration is not linked to the current hub and will not appear in this hub after creation.'
                ),
                confirmButtonName: t('common:actions.create', 'Create'),
                cancelButtonName: t('common:actions.cancel', 'Cancel')
            })
            if (!confirmed) {
                throw DIALOG_SAVE_CANCEL
            }
        }

        // Fire-and-forget: optimistic card via onMutate, errors via onError snackbar,
        // cache invalidation via onSettled. Dialog closes immediately.
        const enumerationPayload = {
            codename: codenamePayload,
            name: nameInput ?? {},
            description: descriptionInput,
            namePrimaryLocale: namePrimaryLocale ?? '',
            descriptionPrimaryLocale,
            hubIds,
            isSingleHub,
            isRequiredHub
        }

        if (hubIds.length > 0) {
            const primaryHubId = hubIds[0]
            createEnumerationMutation.mutate({
                metahubId: metahubId!,
                hubId: primaryHubId,
                data: enumerationPayload
            })
        } else {
            createEnumerationAtMetahubMutation.mutate({
                metahubId: metahubId!,
                data: enumerationPayload
            })
        }
    }

    const goToEnumeration = (enumeration: EnumerationWithHubs) => {
        // Navigate based on mode: hub-scoped or enumeration-centric
        if (isHubScoped) {
            navigate(`/metahub/${metahubId}/hub/${hubId}/enumeration/${enumeration.id}/values`)
        } else {
            navigate(`/metahub/${metahubId}/enumeration/${enumeration.id}/values`)
        }
    }

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const handleHubTabChange = (_event: unknown, tabValue: 'hubs' | 'catalogs' | 'sets' | 'enumerations' | 'settings') => {
        if (!metahubId || !hubId) return
        if (tabValue === 'hubs') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/hubs`)
            return
        }
        if (tabValue === 'settings') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/hubs`, { state: { openHubSettings: true } })
            return
        }
        if (tabValue === 'catalogs') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/catalogs`)
            return
        }
        if (tabValue === 'sets') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/sets`)
            return
        }
        navigate(`/metahub/${metahubId}/hub/${hubId}/enumerations`)
    }

    // Transform Enumeration data for display - use hub-aware version for global mode
    const getEnumerationCardData = (enumeration: EnumerationWithHubs): EnumerationWithHubsDisplay =>
        toEnumerationWithHubsDisplay(enumeration, i18n.language)

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overEnumeration = sortedEnumerations.find((enumeration) => enumeration.id === String(over.id))
        if (!overEnumeration) return

        try {
            await reorderEnumerationMutation.mutateAsync({
                metahubId,
                hubId,
                enumerationId: String(active.id),
                newSortOrder: overEnumeration.sortOrder ?? 1
            })
            enqueueSnackbar(t('enumerations.reorderSuccess', 'Enumeration order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('enumerations.reorderError', 'Failed to reorder enumeration')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const enumeration = enumerationMap.get(activeId)
        if (!enumeration) return null
        const display = getEnumerationCardData(enumeration)
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
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{display.name || display.codename || enumeration.id}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{display.codename || '—'}</Typography>
                </Stack>
            </Box>
        )
    }

    const showAttachExistingAction = isHubScoped && allowAttachExistingEntities
    const hasAttachableExistingEnumerations = attachableExistingEnumerations.length > 0

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <ExistingCodenamesProvider entities={existingEnumerationCodenames}>
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
                            searchPlaceholder={t('enumerations.searchPlaceholder')}
                            onSearchChange={handleSearchChange}
                            title={isHubScoped ? t('enumerations.title') : t('enumerations.allTitle')}
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
                                    showAttachExistingAction && hasAttachableExistingEnumerations
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
                                    value='enumerations'
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
                                    <Tab value='settings' label={t('settings.title')} />
                                </Tabs>
                            </Box>
                        )}

                        <Box sx={{ mt: isHubScoped ? 2 : 0 }}>
                            {isLoading && sortedEnumerations.length === 0 ? (
                                view === 'card' ? (
                                    <SkeletonGrid />
                                ) : (
                                    <Skeleton variant='rectangular' height={120} />
                                )
                            ) : !isLoading && sortedEnumerations.length === 0 ? (
                                <EmptyListState
                                    image={APIEmptySVG}
                                    imageAlt='No enumerations'
                                    title={searchValue ? t('enumerations.noSearchResults') : t('enumerations.empty')}
                                    description={searchValue ? t('enumerations.noSearchResultsHint') : t('enumerations.emptyDescription')}
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
                                            {sortedEnumerations.map((enumeration: EnumerationWithHubs) => {
                                                const descriptors = [...filteredEnumerationActions]
                                                const displayData = getEnumerationCardData(enumeration)

                                                return (
                                                    <ItemCard
                                                        key={enumeration.id}
                                                        data={displayData}
                                                        images={images[enumeration.id] || []}
                                                        onClick={() => goToEnumeration(enumeration)}
                                                        pending={isPendingEntity(enumeration)}
                                                        pendingAction={getPendingAction(enumeration)}
                                                        onPendingInteractionAttempt={() =>
                                                            handlePendingEnumerationInteraction(enumeration.id)
                                                        }
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
                                                                {typeof enumeration.valuesCount === 'number' && (
                                                                    <Typography variant='caption' color='text.secondary'>
                                                                        {t('enumerations.valuesCount', { count: enumeration.valuesCount })}
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                        }
                                                        headerAction={
                                                            descriptors.length > 0 ? (
                                                                <Box onClick={(e) => e.stopPropagation()}>
                                                                    <BaseEntityMenu<EnumerationDisplayWithHub, EnumerationLocalizedPayload>
                                                                        entity={displayData}
                                                                        entityKind='enumeration'
                                                                        descriptors={descriptors}
                                                                        namespace='metahubs'
                                                                        i18nInstance={i18n}
                                                                        createContext={createEnumerationContext}
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
                                                data={sortedEnumerations.map(getEnumerationCardData)}
                                                images={images}
                                                isLoading={isLoading}
                                                sortableRows
                                                sortableItemIds={sortedEnumerations.map((enumeration) => enumeration.id)}
                                                dragHandleAriaLabel={t('enumerations.dnd.dragHandle', 'Drag to reorder')}
                                                dragDisabled={reorderEnumerationMutation.isPending || isLoading}
                                                onSortableDragEnd={handleSortableDragEnd}
                                                renderDragOverlay={renderDragOverlay}
                                                getRowLink={(row: EnumerationWithHubsDisplay) =>
                                                    row?.id
                                                        ? isHubScoped
                                                            ? `/metahub/${metahubId}/hub/${hubId}/enumeration/${row.id}/values`
                                                            : `/metahub/${metahubId}/enumeration/${row.id}/values`
                                                        : undefined
                                                }
                                                onPendingInteractionAttempt={(row: EnumerationWithHubsDisplay) =>
                                                    handlePendingEnumerationInteraction(row.id)
                                                }
                                                customColumns={enumerationColumns}
                                                i18nNamespace='flowList'
                                                renderActions={(row: EnumerationWithHubsDisplay) => {
                                                    const originalEnumeration = enumerationMap.get(row.id)
                                                    if (!originalEnumeration) return null

                                                    const descriptors = [...filteredEnumerationActions]
                                                    if (!descriptors.length) return null

                                                    return (
                                                        <BaseEntityMenu<EnumerationDisplayWithHub, EnumerationLocalizedPayload>
                                                            entity={getEnumerationCardData(originalEnumeration)}
                                                            entityKind='enumeration'
                                                            descriptors={descriptors}
                                                            namespace='metahubs'
                                                            menuButtonLabelKey='flowList:menu.button'
                                                            i18nInstance={i18n}
                                                            createContext={createEnumerationContext}
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
                        {!isLoading && sortedEnumerations.length > 0 && (
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
                    title={t('enumerations.createDialog.title', 'Create Enumeration')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateEnumeration}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateEnumerationForm}
                    canSave={canSaveEnumerationForm}
                />

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('enumerations.attachExisting.dialogTitle', 'Add Existing Enumerations')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingEnumerations}
                    hideDefaultFields
                    initialExtraValues={{ selectedEnumerationIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedEnumerationIds = Array.isArray(values.selectedEnumerationIds)
                            ? values.selectedEnumerationIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'enumerations',
                                label: t('enumerations.title', 'Enumerations'),
                                content: (
                                    <EntitySelectionPanel<EnumerationWithHubs>
                                        availableEntities={attachableExistingEnumerations}
                                        selectedIds={selectedEnumerationIds}
                                        onSelectionChange={(ids) => setValue('selectedEnumerationIds', ids)}
                                        getDisplayName={(enumeration) =>
                                            getVLCString(enumeration.name, preferredVlcLocale) ||
                                            getVLCString(enumeration.name, 'en') ||
                                            enumeration.codename ||
                                            '—'
                                        }
                                        getCodename={(enumeration) => enumeration.codename}
                                        labels={attachExistingEnumerationSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedEnumerationIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedEnumerationIds = Array.isArray(values.selectedEnumerationIds)
                            ? values.selectedEnumerationIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedEnumerationIds.length > 0) return null
                        return {
                            selectedEnumerationIds: t(
                                'enumerations.attachExisting.requiredSelection',
                                'Select at least one enumeration to add.'
                            )
                        }
                    }}
                    canSave={(values) => {
                        const selectedEnumerationIds = Array.isArray(values.selectedEnumerationIds)
                            ? values.selectedEnumerationIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedEnumerationIds.length > 0
                    }}
                />

                {/* Independent ConfirmDeleteDialog */}
                <ConfirmDeleteDialog
                    open={confirmDeleteDialogState.open}
                    title={t('enumerations.deleteDialog.title')}
                    description={t('enumerations.deleteDialog.message')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => setConfirmDeleteDialogState({ open: false, enumeration: null })}
                    onConfirm={() => {
                        if (!confirmDeleteDialogState.enumeration || !metahubId) return

                        const deletingEnumerationId = confirmDeleteDialogState.enumeration.id
                        const targetHubId = isHubScoped ? hubId! : confirmDeleteDialogState.enumeration.hubs?.[0]?.id || ''
                        deleteEnumerationMutation.mutate(
                            {
                                metahubId,
                                hubId: targetHubId,
                                enumerationId: deletingEnumerationId,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingEnumerationReferences(metahubId, deletingEnumerationId)
                                    })
                                },
                                onError: (err: unknown) => {
                                    const responseMessage = extractResponseMessage(err)
                                    const message =
                                        typeof responseMessage === 'string'
                                            ? responseMessage
                                            : err instanceof Error
                                            ? err.message
                                            : typeof err === 'string'
                                            ? err
                                            : t('enumerations.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                />

                <EnumerationDeleteDialog
                    open={blockingDeleteDialogState.open}
                    enumeration={blockingDeleteDialogState.enumeration}
                    metahubId={metahubId}
                    onClose={() => setBlockingDeleteDialogState({ open: false, enumeration: null })}
                    onConfirm={(enumeration) => {
                        const targetHubId = isHubScoped ? hubId : enumeration.hubs?.[0]?.id
                        deleteEnumerationMutation.mutate(
                            {
                                metahubId,
                                hubId: targetHubId,
                                enumerationId: enumeration.id,
                                force: !isHubScoped
                            },
                            {
                                onSuccess: () => {
                                    queryClient.removeQueries({
                                        queryKey: metahubsQueryKeys.blockingEnumerationReferences(metahubId, enumeration.id)
                                    })
                                },
                                onError: (err: unknown) => {
                                    const responseMessage = extractResponseMessage(err)
                                    const message =
                                        typeof responseMessage === 'string'
                                            ? responseMessage
                                            : err instanceof Error
                                            ? err.message
                                            : typeof err === 'string'
                                            ? err
                                            : t('enumerations.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                    isDeleting={deleteEnumerationMutation.isPending}
                    uiLocale={i18n.language}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={conflictState.open}
                    conflict={conflictState.conflict}
                    onOverwrite={async () => {
                        if (!metahubId || !conflictState.enumerationId || !conflictState.pendingData) return
                        try {
                            const enumeration = enumerationMap.get(conflictState.enumerationId)
                            const targetHubId = isHubScoped ? hubId! : enumeration?.hubs?.[0]?.id
                            // Retry without expectedVersion to force overwrite
                            if (targetHubId) {
                                await updateEnumerationMutation.mutateAsync({
                                    metahubId,
                                    hubId: targetHubId,
                                    enumerationId: conflictState.enumerationId,
                                    data: conflictState.pendingData as EnumerationLocalizedPayload
                                })
                            } else {
                                await updateEnumerationAtMetahubMutation.mutateAsync({
                                    metahubId,
                                    enumerationId: conflictState.enumerationId,
                                    data: conflictState.pendingData as EnumerationLocalizedPayload
                                })
                            }
                            setConflictState({ open: false, conflict: null, pendingData: null, enumerationId: null })
                            enqueueSnackbar(t('enumerations.updateSuccess', 'Enumeration updated'), { variant: 'success' })
                        } catch (e) {
                            console.error('Failed to overwrite enumeration', e)
                            enqueueSnackbar(t('enumerations.updateError', 'Failed to update enumeration'), { variant: 'error' })
                        }
                    }}
                    onReload={async () => {
                        // Reload the list to get latest data
                        if (metahubId) {
                            if (isHubScoped && hubId) {
                                await invalidateEnumerationsQueries.all(queryClient, metahubId, hubId)
                            } else {
                                await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(metahubId) })
                            }
                        }
                        setConflictState({ open: false, conflict: null, pendingData: null, enumerationId: null })
                    }}
                    onCancel={() => {
                        setConflictState({ open: false, conflict: null, pendingData: null, enumerationId: null })
                    }}
                />
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

const EnumerationList = () => <EnumerationListContent />

export default EnumerationList
