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
    ConfirmDialog,
    useConfirm,
    LocalizedInlineField,
    useCodenameAutoFill,
    useCodenameVlcSync
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreateSet, useCreateSetAtMetahub, useUpdateSet, useUpdateSetAtMetahub, useDeleteSet, useCopySet } from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as setsApi from '../api'
import type { SetWithHubs } from '../api'
import * as hubsApi from '../../hubs'
import { invalidateSetsQueries, metahubsQueryKeys } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { MetahubSetDisplay, SetLocalizedPayload, Hub, PaginatedResponse, getVLCString, toSetDisplay } from '../../../types'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { SetDeleteDialog, CodenameField, HubSelectionPanel, ExistingCodenamesProvider } from '../../../components'
import setActions, { SetDisplayWithHub } from './SetActions'

/**
 * Hub info for display in the table column (global view)
 */
interface HubDisplayInfo {
    id: string
    name: string
    codename: string
}

/**
 * Extended SetDisplay that includes hub info for the all-sets view.
 * For N:M relationship, we use the primary hub (first in list) for navigation.
 */
interface SetWithHubsDisplay extends MetahubSetDisplay {
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

type SetFormValues = {
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

type SetPendingData = SetLocalizedPayload & { expectedVersion?: number }

type SetMenuBaseContext = {
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
 * Convert SetWithHubs to display format with hub info (for global view)
 */
const toSetWithHubsDisplay = (set: SetWithHubs, locale: string): SetWithHubsDisplay => {
    const base = toSetDisplay(set, locale)
    const hubs = set.hubs || []
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

const SetList = () => {
    const navigate = useNavigate()
    const codenameConfig = useCodenameConfig()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    // hubId is optional - when present, we're in hub-scoped mode; otherwise global mode
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId?: string }>()
    const { t, i18n } = useTranslation('metahubs')
    const { t: tc } = useCommonTranslations()

    /**
     * isHubScoped determines the component behavior:
     * - true: Hub-scoped view (inside a specific hub) - uses setsList API
     * - false: Global view (all sets in metahub) - uses allSetsList API
     */
    const isHubScoped = Boolean(hubId)

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    // Use different storage keys for different views
    const [view, setView] = useViewPreference(isHubScoped ? STORAGE_KEYS.SET_DISPLAY_STYLE : STORAGE_KEYS.ALL_SETS_DISPLAY_STYLE)

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
        enabled: !!metahubId,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: false,
        staleTime: 5 * 60 * 1000,
        retry: false
    })
    const hubs = useMemo(() => hubsData?.items ?? [], [hubsData?.items])

    // Use paginated hook for sets list - conditional API based on isHubScoped
    const paginationResult = usePaginated<SetWithHubs, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? isHubScoped
                ? (params) => metahubsQueryKeys.setsList(metahubId, hubId!, params)
                : (params) => metahubsQueryKeys.allSetsList(metahubId, params)
            : () => ['empty'],
        queryFn: metahubId
            ? isHubScoped
                ? (params) => setsApi.listSets(metahubId, hubId!, params)
                : (params) => setsApi.listAllSets(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId && (isHubScoped ? !!hubId : true)
    })

    const { data: sets, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    // Instant search for better UX
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for simple confirmation delete flow (unlink or other non-blocking cases)
    const [confirmDeleteDialogState, setConfirmDeleteDialogState] = useState<{
        open: boolean
        set: SetWithHubs | null
    }>({ open: false, set: null })

    // State for blocking-entities delete flow (actual set deletion)
    const [blockingDeleteDialogState, setBlockingDeleteDialogState] = useState<{
        open: boolean
        set: SetWithHubs | null
    }>({ open: false, set: null })

    // State for ConflictResolutionDialog
    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingData: SetPendingData | null
        setId: string | null
    }>({ open: false, conflict: null, pendingData: null, setId: null })

    const { confirm } = useConfirm()

    // Filter entity actions based on settings (allowCopy / allowDelete)
    const { allowCopy, allowDelete } = useEntityPermissions('sets')
    const filteredSetActions = useMemo(
        () =>
            setActions.filter((a) => {
                if (a.id === 'copy' && !allowCopy) return false
                if (a.id === 'delete' && !allowDelete) return false
                return true
            }),
        [allowCopy, allowDelete]
    )

    const createSetMutation = useCreateSet()
    const createSetAtMetahubMutation = useCreateSetAtMetahub()
    const updateSetMutation = useUpdateSet()
    const deleteSetMutation = useDeleteSet()
    const updateSetAtMetahubMutation = useUpdateSetAtMetahub()
    const copySetMutation = useCopySet()

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sets)) {
            sets.forEach((set) => {
                if (set?.id) {
                    imagesMap[set.id] = []
                }
            })
        }
        return imagesMap
    }, [sets])

    const setMap = useMemo(() => {
        if (!Array.isArray(sets)) return new Map<string, SetWithHubs>()
        return new Map(sets.map((set) => [set.id, set]))
    }, [sets])

    // Form defaults with current hub auto-selected in hub-scoped mode (N:M relationship)
    const localizedFormDefaults = useMemo<SetFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codenameVlc: null,
            codename: '',
            codenameTouched: false,
            hubIds: hubId ? [hubId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false // Default: set can exist without hubs
        }),
        [hubId]
    )

    const validateSetForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const hubIds = Array.isArray(values.hubIds) ? values.hubIds : []
            const isRequiredHub = Boolean(values.isRequiredHub)
            // Hub validation only if isRequiredHub is true
            if (isRequiredHub && hubIds.length === 0) {
                errors.hubIds = t('sets.validation.hubRequired', 'At least one hub is required')
            }
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!normalizedCodename) {
                errors.codename = t('sets.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('sets.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveSetForm = useCallback(
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
                    label: t('sets.tabs.general', 'Основное'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            errors={errors}
                            uiLocale={preferredVlcLocale}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('sets.codename', 'Codename')}
                            codenameHelper={t('sets.codenameHelper', 'Unique identifier')}
                        />
                    )
                },
                {
                    id: 'hubs',
                    label: t('sets.tabs.hubs', 'Хабы'),
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
                        />
                    )
                }
            ]
        },
        [hubs, preferredVlcLocale, t, tc]
    )

    const setColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'sortOrder',
                label: t('sets.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: SetWithHubsDisplay) => row.sortOrder ?? 0,
                render: (row: SetWithHubsDisplay) => (
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
                sortAccessor: (row: SetWithHubsDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: SetWithHubsDisplay) => (
                    <Link
                        to={
                            isHubScoped
                                ? `/metahub/${metahubId}/hub/${hubId}/set/${row.id}/constants`
                                : `/metahub/${metahubId}/set/${row.id}/constants`
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
                sortAccessor: (row: SetWithHubsDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: SetWithHubsDisplay) => (
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
                label: t('sets.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: SetWithHubsDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: SetWithHubsDisplay) => (
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
            render: (row: SetWithHubsDisplay) => (
                <Stack direction='column' spacing={0.5}>
                    {row.allHubs.map((hub) => (
                        <Link
                            key={hub.id}
                            to={`/metahub/${metahubId}/hub/${hub.id}/sets`}
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
                id: 'constantsCount',
                label: t('sets.constantsHeader', 'Constants'),
                width: '10%',
                align: 'center' as const,
                render: (row: SetWithHubsDisplay) =>
                    typeof row.constantsCount === 'number' ? (
                        <Link
                            to={
                                isHubScoped
                                    ? `/metahub/${metahubId}/hub/${hubId}/set/${row.id}/constants`
                                    : `/metahub/${metahubId}/set/${row.id}/constants`
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
                                {row.constantsCount}
                            </Typography>
                        </Link>
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
    }, [t, tc, metahubId, hubId, isHubScoped])

    const createSetContext = useCallback(
        (baseContext: SetMenuBaseContext) => ({
            ...baseContext,
            setMap,
            uiLocale: preferredVlcLocale,
            hubs, // Pass hubs for hub selector in edit dialog (N:M)
            api: {
                updateEntity: async (id: string, patch: SetLocalizedPayload & { expectedVersion?: number }) => {
                    if (!metahubId) return
                    const set = setMap.get(id)
                    const normalizedCodename = normalizeCodenameForStyle(patch.codename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('sets.validation.codenameRequired', 'Codename is required'))
                    }
                    // Include expectedVersion for optimistic locking if set has version
                    const expectedVersion = set?.version
                    const dataWithVersion = { ...patch, codename: normalizedCodename, expectedVersion }

                    try {
                        // In hub-scoped mode, use hubId from URL; in global mode, check if set has hubs
                        const targetHubId = isHubScoped ? hubId! : set?.hubs?.[0]?.id
                        if (targetHubId) {
                            // Use hub-scoped endpoint
                            await updateSetMutation.mutateAsync({
                                metahubId,
                                hubId: targetHubId,
                                setId: id,
                                data: dataWithVersion
                            })
                        } else {
                            // Use metahub-level endpoint for sets without hubs
                            await updateSetAtMetahubMutation.mutateAsync({
                                metahubId,
                                setId: id,
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
                                    setId: id
                                })
                                return // Don't rethrow - dialog will handle
                            }
                        }
                        throw error
                    }
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId) return
                    const set = setMap.get(id)

                    if (isHubScoped && hubId) {
                        // Hub-scoped mode: use hubId from URL
                        await deleteSetMutation.mutateAsync({
                            metahubId,
                            hubId,
                            setId: id,
                            force: false
                        })
                    } else {
                        // Global mode: check if set has hubs
                        const targetHubId = set?.hubs?.[0]?.id
                        await deleteSetMutation.mutateAsync({
                            metahubId,
                            hubId: targetHubId, // undefined for sets without hubs
                            setId: id,
                            force: Boolean(targetHubId) // force=true if has multiple hubs
                        })
                    }
                },
                copyEntity: async (id: string, payload: SetLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId) return
                    await copySetMutation.mutateAsync({
                        metahubId,
                        setId: id,
                        data: payload
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId) {
                        if (isHubScoped && hubId) {
                            await invalidateSetsQueries.all(queryClient, metahubId, hubId)
                        } else {
                            // In global mode, invalidate all sets cache
                            await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(metahubId) })
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
                openDeleteDialog: (entity: SetDisplayWithHub | MetahubSetDisplay) => {
                    const set = setMap.get(entity.id)
                    if (!set) return
                    const hubsCount = Array.isArray(set.hubs) ? set.hubs.length : 0
                    const willDeleteSet = !isHubScoped || (!set.isRequiredHub && hubsCount === 1)

                    if (willDeleteSet) {
                        setBlockingDeleteDialogState({ open: true, set })
                        return
                    }

                    setConfirmDeleteDialogState({ open: true, set })
                }
            }
        }),
        [
            confirm,
            copySetMutation,
            codenameConfig.alphabet,
            codenameConfig.style,
            deleteSetMutation,
            enqueueSnackbar,
            setMap,
            hubs,
            hubId,
            isHubScoped,
            metahubId,
            preferredVlcLocale,
            queryClient,
            t,
            updateSetMutation,
            updateSetAtMetahubMutation
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

    const handleCreateSet = async (data: GenericFormValues) => {
        setDialogError(null)
        setCreating(true)
        try {
            const hubIds = Array.isArray(data.hubIds) ? data.hubIds : []
            const isRequiredHub = Boolean(data.isRequiredHub)

            // Only require hubs if isRequiredHub is true
            if (isRequiredHub && hubIds.length === 0) {
                setDialogError(t('sets.validation.hubRequired', 'At least one hub is required'))
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
                setDialogError(t('sets.validation.codenameRequired', 'Codename is required'))
                return
            }
            if (!isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)) {
                setDialogError(t('sets.validation.codenameInvalid', 'Codename contains invalid characters'))
                return
            }

            const isSingleHub = Boolean(data.isSingleHub)

            // Choose API endpoint based on whether we have hubs
            if (hubIds.length > 0) {
                // Use hub-scoped endpoint with first hub
                const primaryHubId = hubIds[0]
                await createSetMutation.mutateAsync({
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

                // Handle navigation after creation
                if (isHubScoped) {
                    // In hub-scoped mode: if primary hub differs from current, redirect
                    if (primaryHubId !== hubId) {
                        navigate(`/metahub/${metahubId}/hub/${primaryHubId}/sets`)
                    }
                }
            } else {
                // No hubs selected - use metahub-level endpoint
                await createSetAtMetahubMutation.mutateAsync({
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
            const responseMessage = extractResponseMessage(e)
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('sets.createError')
            setDialogError(message)
            console.error('Failed to create set', e)
        } finally {
            setCreating(false)
        }
    }

    const goToSet = (set: SetWithHubs) => {
        // Navigate based on mode: hub-scoped or set-centric
        if (isHubScoped) {
            navigate(`/metahub/${metahubId}/hub/${hubId}/set/${set.id}/constants`)
        } else {
            navigate(`/metahub/${metahubId}/set/${set.id}/constants`)
        }
    }

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const handleHubTabChange = (_event: unknown, tabValue: 'sets' | 'enumerations') => {
        if (!metahubId || !hubId) return
        if (tabValue === 'enumerations') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/enumerations`)
            return
        }
        navigate(`/metahub/${metahubId}/hub/${hubId}/sets`)
    }

    // Transform Set data for display - use hub-aware version for global mode
    const getSetCardData = (set: SetWithHubs): SetWithHubsDisplay => toSetWithHubsDisplay(set, i18n.language)

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <ExistingCodenamesProvider entities={sets ?? []}>
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
                            searchPlaceholder={t('sets.searchPlaceholder')}
                            onSearchChange={handleSearchChange}
                            title={isHubScoped ? t('sets.title') : t('sets.allTitle')}
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
                            />
                        </ViewHeader>

                        {isHubScoped && (
                            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                <Tabs
                                    value='sets'
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
                                    <Tab value='sets' label={t('sets.title')} />
                                    <Tab value='enumerations' label={t('enumerations.title')} />
                                </Tabs>
                            </Box>
                        )}

                        {isLoading && sets.length === 0 ? (
                            view === 'card' ? (
                                <SkeletonGrid />
                            ) : (
                                <Skeleton variant='rectangular' height={120} />
                            )
                        ) : !isLoading && sets.length === 0 ? (
                            <EmptyListState
                                image={APIEmptySVG}
                                imageAlt='No sets'
                                title={searchValue ? t('sets.noSearchResults') : t('sets.empty')}
                                description={searchValue ? t('sets.noSearchResultsHint') : t('sets.emptyDescription')}
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
                                        {sets.map((set: SetWithHubs) => {
                                            const descriptors = [...filteredSetActions]
                                            const displayData = getSetCardData(set)

                                            return (
                                                <ItemCard
                                                    key={set.id}
                                                    data={displayData}
                                                    images={images[set.id] || []}
                                                    onClick={() => goToSet(set)}
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
                                                            {typeof set.constantsCount === 'number' && (
                                                                <Typography variant='caption' color='text.secondary'>
                                                                    {t('sets.constantsCount', { count: set.constantsCount })}
                                                                </Typography>
                                                            )}
                                                        </Stack>
                                                    }
                                                    headerAction={
                                                        descriptors.length > 0 ? (
                                                            <Box onClick={(e) => e.stopPropagation()}>
                                                                <BaseEntityMenu<SetDisplayWithHub, SetLocalizedPayload>
                                                                    entity={displayData}
                                                                    entityKind='set'
                                                                    descriptors={descriptors}
                                                                    namespace='metahubs'
                                                                    i18nInstance={i18n}
                                                                    createContext={createSetContext}
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
                                            data={sets.map(getSetCardData)}
                                            images={images}
                                            isLoading={isLoading}
                                            getRowLink={(row: SetWithHubsDisplay) =>
                                                row?.id
                                                    ? isHubScoped
                                                        ? `/metahub/${metahubId}/hub/${hubId}/set/${row.id}/constants`
                                                        : `/metahub/${metahubId}/set/${row.id}/constants`
                                                    : undefined
                                            }
                                            customColumns={setColumns}
                                            i18nNamespace='flowList'
                                            renderActions={(row: SetWithHubsDisplay) => {
                                                const originalSet = sets.find((c) => c.id === row.id)
                                                if (!originalSet) return null

                                                const descriptors = [...filteredSetActions]
                                                if (!descriptors.length) return null

                                                return (
                                                    <BaseEntityMenu<SetDisplayWithHub, SetLocalizedPayload>
                                                        entity={getSetCardData(originalSet)}
                                                        entityKind='set'
                                                        descriptors={descriptors}
                                                        namespace='metahubs'
                                                        menuButtonLabelKey='flowList:menu.button'
                                                        i18nInstance={i18n}
                                                        createContext={createSetContext}
                                                    />
                                                )
                                            }}
                                        />
                                    </Box>
                                )}
                            </>
                        )}

                        {/* Table Pagination at bottom */}
                        {!isLoading && sets.length > 0 && (
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
                    title={t('sets.createDialog.title', 'Create Set')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={isCreating}
                    error={dialogError || undefined}
                    onClose={handleDialogClose}
                    onSave={handleCreateSet}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateSetForm}
                    canSave={canSaveSetForm}
                />

                {/* Independent ConfirmDeleteDialog */}
                <ConfirmDeleteDialog
                    open={confirmDeleteDialogState.open}
                    title={t('sets.deleteDialog.title')}
                    description={t('sets.deleteDialog.message')}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => setConfirmDeleteDialogState({ open: false, set: null })}
                    onConfirm={async () => {
                        if (confirmDeleteDialogState.set && metahubId) {
                            try {
                                const deletingSetId = confirmDeleteDialogState.set.id
                                // In hub-scoped mode, use hubId from URL; in global mode, use primary hub
                                const targetHubId = isHubScoped ? hubId! : confirmDeleteDialogState.set.hubs?.[0]?.id || ''
                                await deleteSetMutation.mutateAsync({
                                    metahubId,
                                    hubId: targetHubId,
                                    setId: deletingSetId,
                                    force: !isHubScoped // Force delete in global mode
                                })
                                setConfirmDeleteDialogState({ open: false, set: null })
                                queryClient.removeQueries({
                                    queryKey: metahubsQueryKeys.blockingSetReferences(metahubId, deletingSetId)
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
                                        : t('sets.deleteError')
                                enqueueSnackbar(message, { variant: 'error' })
                                setConfirmDeleteDialogState({ open: false, set: null })
                            }
                        }
                    }}
                />

                <SetDeleteDialog
                    open={blockingDeleteDialogState.open}
                    set={blockingDeleteDialogState.set}
                    metahubId={metahubId}
                    onClose={() => setBlockingDeleteDialogState({ open: false, set: null })}
                    onConfirm={async (set) => {
                        try {
                            const targetHubId = isHubScoped ? hubId : set.hubs?.[0]?.id
                            await deleteSetMutation.mutateAsync({
                                metahubId,
                                hubId: targetHubId,
                                setId: set.id,
                                force: !isHubScoped
                            })
                            setBlockingDeleteDialogState({ open: false, set: null })
                            queryClient.removeQueries({ queryKey: metahubsQueryKeys.blockingSetReferences(metahubId, set.id) })
                        } catch (err: unknown) {
                            const responseMessage = extractResponseMessage(err)
                            const message =
                                typeof responseMessage === 'string'
                                    ? responseMessage
                                    : err instanceof Error
                                    ? err.message
                                    : typeof err === 'string'
                                    ? err
                                    : t('sets.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setBlockingDeleteDialogState({ open: false, set: null })
                        }
                    }}
                    isDeleting={deleteSetMutation.isPending}
                    uiLocale={i18n.language}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={conflictState.open}
                    conflict={conflictState.conflict}
                    onOverwrite={async () => {
                        if (!metahubId || !conflictState.setId || !conflictState.pendingData) return
                        try {
                            const set = setMap.get(conflictState.setId)
                            const targetHubId = isHubScoped ? hubId! : set?.hubs?.[0]?.id
                            // Retry without expectedVersion to force overwrite
                            if (targetHubId) {
                                await updateSetMutation.mutateAsync({
                                    metahubId,
                                    hubId: targetHubId,
                                    setId: conflictState.setId,
                                    data: conflictState.pendingData as SetLocalizedPayload
                                })
                            } else {
                                await updateSetAtMetahubMutation.mutateAsync({
                                    metahubId,
                                    setId: conflictState.setId,
                                    data: conflictState.pendingData as SetLocalizedPayload
                                })
                            }
                            setConflictState({ open: false, conflict: null, pendingData: null, setId: null })
                            enqueueSnackbar(t('sets.updateSuccess', 'Set updated'), { variant: 'success' })
                        } catch (e) {
                            console.error('Failed to overwrite set', e)
                            enqueueSnackbar(t('sets.updateError', 'Failed to update set'), { variant: 'error' })
                        }
                    }}
                    onReload={async () => {
                        // Reload the list to get latest data
                        if (metahubId) {
                            if (isHubScoped && hubId) {
                                await invalidateSetsQueries.all(queryClient, metahubId, hubId)
                            } else {
                                await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(metahubId) })
                            }
                        }
                        setConflictState({ open: false, conflict: null, pendingData: null, setId: null })
                    }}
                    onCancel={() => {
                        setConflictState({ open: false, conflict: null, pendingData: null, setId: null })
                    }}
                />

                <ConfirmDialog />
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

export default SetList
