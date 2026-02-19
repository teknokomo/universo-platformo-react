import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton, Chip, Divider, Tabs, Tab } from '@mui/material'
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
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import {
    useCreateEnumeration,
    useCreateEnumerationAtMetahub,
    useUpdateEnumeration,
    useUpdateEnumerationAtMetahub,
    useDeleteEnumeration
} from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as enumerationsApi from '../api'
import type { EnumerationWithHubs } from '../api'
import * as hubsApi from '../../hubs'
import { invalidateEnumerationsQueries, metahubsQueryKeys } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { EnumerationDisplay, EnumerationLocalizedPayload, Hub, PaginatedResponse, getVLCString, toEnumerationDisplay } from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { EnumerationDeleteDialog, CodenameField, HubSelectionPanel } from '../../../components'
import enumerationActions, { EnumerationDisplayWithHub } from './EnumerationActions'

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
    codename: string
    codenameTouched?: boolean
    /** For N:M relationship - array of hub IDs */
    hubIds: string[]
    /** Single hub mode flag */
    isSingleHub: boolean
    /** Require at least one hub association */
    isRequiredHub: boolean
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

const EnumerationList = () => {
    const navigate = useNavigate()
    // hubId is optional - when present, we're in hub-scoped mode; otherwise global mode
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId?: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

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

    // Use paginated hook for enumerations list - conditional API based on isHubScoped
    const paginationResult = usePaginated<EnumerationWithHubs, 'codename' | 'created' | 'updated'>({
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
        sortBy: 'updated',
        sortOrder: 'desc',
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
        pendingData: Record<string, any> | null
        enumerationId: string | null
    }>({ open: false, conflict: null, pendingData: null, enumerationId: null })

    const { confirm } = useConfirm()

    const createEnumerationMutation = useCreateEnumeration()
    const createEnumerationAtMetahubMutation = useCreateEnumerationAtMetahub()
    const updateEnumerationMutation = useUpdateEnumeration()
    const deleteEnumerationMutation = useDeleteEnumeration()
    const updateEnumerationAtMetahubMutation = useUpdateEnumerationAtMetahub()

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(enumerations)) {
            enumerations.forEach((enumeration) => {
                if (enumeration?.id) {
                    imagesMap[enumeration.id] = []
                }
            })
        }
        return imagesMap
    }, [enumerations])

    const enumerationMap = useMemo(() => {
        if (!Array.isArray(enumerations)) return new Map<string, EnumerationWithHubs>()
        return new Map(enumerations.map((enumeration) => [enumeration.id, enumeration]))
    }, [enumerations])

    // Form defaults with current hub auto-selected in hub-scoped mode (N:M relationship)
    const localizedFormDefaults = useMemo<EnumerationFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: '',
            codenameTouched: false,
            hubIds: hubId ? [hubId] : [], // Auto-select current hub
            isSingleHub: false,
            isRequiredHub: false // Default: enumeration can exist without hubs
        }),
        [hubId]
    )

    const validateEnumerationForm = useCallback(
        (values: Record<string, any>) => {
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
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = sanitizeCodename(rawCodename)
            if (!normalizedCodename) {
                errors.codename = t('enumerations.validation.codenameRequired', 'Codename is required')
            } else if (!isValidCodename(normalizedCodename)) {
                errors.codename = t('enumerations.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [t, tc]
    )

    const canSaveEnumerationForm = useCallback((values: Record<string, any>) => {
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
                    label: t('enumerations.tabs.general', 'Основное'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            errors={errors}
                            uiLocale={i18n.language}
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
                            uiLocale={i18n.language}
                        />
                    )
                }
            ]
        },
        [hubs, i18n.language, t, tc]
    )

    const enumerationColumns = useMemo(() => {
        // Base columns for both modes
        const baseColumns = [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: isHubScoped ? '25%' : '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: EnumerationWithHubsDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: EnumerationWithHubsDisplay) => (
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
                    {row.allHubs.map((hub) => (
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
                id: 'valuesCount',
                label: t('enumerations.valuesHeader', 'Values'),
                width: '15%',
                align: 'center' as const,
                render: (row: EnumerationWithHubsDisplay) =>
                    typeof row.valuesCount === 'number' ? (
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

    const createEnumerationContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            enumerationMap,
            uiLocale: i18n.language,
            hubs, // Pass hubs for hub selector in edit dialog (N:M)
            api: {
                updateEntity: async (id: string, patch: EnumerationLocalizedPayload & { expectedVersion?: number }) => {
                    if (!metahubId) return
                    const enumeration = enumerationMap.get(id)
                    const normalizedCodename = sanitizeCodename(patch.codename)
                    if (!normalizedCodename) {
                        throw new Error(t('enumerations.validation.codenameRequired', 'Codename is required'))
                    }
                    // Include expectedVersion for optimistic locking if enumeration has version
                    const expectedVersion = enumeration?.version
                    const dataWithVersion = { ...patch, codename: normalizedCodename, expectedVersion }

                    try {
                        // In hub-scoped mode, use hubId from URL; in global mode, check if enumeration has hubs
                        const targetHubId = isHubScoped ? hubId! : enumeration?.hubs?.[0]?.id
                        if (targetHubId) {
                            // Use hub-scoped endpoint
                            await updateEnumerationMutation.mutateAsync({
                                metahubId,
                                hubId: targetHubId,
                                enumerationId: id,
                                data: dataWithVersion
                            })
                        } else {
                            // Use metahub-level endpoint for enumerations without hubs
                            await updateEnumerationAtMetahubMutation.mutateAsync({
                                metahubId,
                                enumerationId: id,
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
                                    enumerationId: id
                                })
                                return // Don't rethrow - dialog will handle
                            }
                        }
                        throw error
                    }
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId) return
                    const enumeration = enumerationMap.get(id)

                    if (isHubScoped && hubId) {
                        // Hub-scoped mode: use hubId from URL
                        await deleteEnumerationMutation.mutateAsync({
                            metahubId,
                            hubId,
                            enumerationId: id,
                            force: false
                        })
                    } else {
                        // Global mode: check if enumeration has hubs
                        const targetHubId = enumeration?.hubs?.[0]?.id
                        await deleteEnumerationMutation.mutateAsync({
                            metahubId,
                            hubId: targetHubId, // undefined for enumerations without hubs
                            enumerationId: id,
                            force: Boolean(targetHubId) // force=true if has multiple hubs
                        })
                    }
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId) {
                        if (isHubScoped && hubId) {
                            await invalidateEnumerationsQueries.all(queryClient, metahubId, hubId)
                        } else {
                            // In global mode, invalidate all enumerations cache
                            await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(metahubId) })
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
            confirm,
            deleteEnumerationMutation,
            enqueueSnackbar,
            enumerationMap,
            hubs,
            hubId,
            i18n.language,
            isHubScoped,
            metahubId,
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

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateEnumeration = async (data: Record<string, any>) => {
        setDialogError(null)
        setCreating(true)
        try {
            const hubIds = Array.isArray(data.hubIds) ? data.hubIds : []
            const isRequiredHub = Boolean(data.isRequiredHub)

            // Only require hubs if isRequiredHub is true
            if (isRequiredHub && hubIds.length === 0) {
                setDialogError(t('enumerations.validation.hubRequired', 'At least one hub is required'))
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
                setDialogError(t('enumerations.validation.codenameRequired', 'Codename is required'))
                return
            }

            const isSingleHub = Boolean(data.isSingleHub)

            // Choose API endpoint based on whether we have hubs
            if (hubIds.length > 0) {
                // Use hub-scoped endpoint with first hub
                const primaryHubId = hubIds[0]
                await createEnumerationMutation.mutateAsync({
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
                        navigate(`/metahub/${metahubId}/hub/${primaryHubId}/enumerations`)
                    }
                }
            } else {
                // No hubs selected - use metahub-level endpoint
                await createEnumerationAtMetahubMutation.mutateAsync({
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
                    : t('enumerations.createError')
            setDialogError(message)
            console.error('Failed to create enumeration', e)
        } finally {
            setCreating(false)
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

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const handleHubTabChange = (_event: unknown, tabValue: 'catalogs' | 'enumerations') => {
        if (!metahubId || !hubId) return
        if (tabValue === 'catalogs') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/catalogs`)
            return
        }
        navigate(`/metahub/${metahubId}/hub/${hubId}/enumerations`)
    }

    // Transform Enumeration data for display - use hub-aware version for global mode
    const getEnumerationCardData = (enumeration: EnumerationWithHubs): EnumerationWithHubsDisplay =>
        toEnumerationWithHubsDisplay(enumeration, i18n.language)

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
                                <Tab value='catalogs' label={t('catalogs.title')} />
                                <Tab value='enumerations' label={t('enumerations.title')} />
                            </Tabs>
                        </Box>
                    )}

                    {isLoading && enumerations.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && enumerations.length === 0 ? (
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
                                    {enumerations.map((enumeration: EnumerationWithHubs) => {
                                        const descriptors = [...enumerationActions]
                                        const displayData = getEnumerationCardData(enumeration)

                                        return (
                                            <ItemCard
                                                key={enumeration.id}
                                                data={displayData}
                                                images={images[enumeration.id] || []}
                                                onClick={() => goToEnumeration(enumeration)}
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
                                        data={enumerations.map(getEnumerationCardData)}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: any) =>
                                            row?.id
                                                ? isHubScoped
                                                    ? `/metahub/${metahubId}/hub/${hubId}/enumeration/${row.id}/values`
                                                    : `/metahub/${metahubId}/enumeration/${row.id}/values`
                                                : undefined
                                        }
                                        customColumns={enumerationColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: any) => {
                                            const originalEnumeration = enumerations.find((c) => c.id === row.id)
                                            if (!originalEnumeration) return null

                                            const descriptors = [...enumerationActions]
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

                    {/* Table Pagination at bottom */}
                    {!isLoading && enumerations.length > 0 && (
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
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateEnumeration}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                tabs={buildFormTabs}
                validate={validateEnumerationForm}
                canSave={canSaveEnumerationForm}
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
                onConfirm={async () => {
                    if (confirmDeleteDialogState.enumeration && metahubId) {
                        try {
                            const deletingEnumerationId = confirmDeleteDialogState.enumeration.id
                            // In hub-scoped mode, use hubId from URL; in global mode, use primary hub
                            const targetHubId = isHubScoped ? hubId! : confirmDeleteDialogState.enumeration.hubs?.[0]?.id || ''
                            await deleteEnumerationMutation.mutateAsync({
                                metahubId,
                                hubId: targetHubId,
                                enumerationId: deletingEnumerationId,
                                force: !isHubScoped // Force delete in global mode
                            })
                            setConfirmDeleteDialogState({ open: false, enumeration: null })
                            queryClient.removeQueries({
                                queryKey: metahubsQueryKeys.blockingEnumerationReferences(metahubId, deletingEnumerationId)
                            })
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
                                    : t('enumerations.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setConfirmDeleteDialogState({ open: false, enumeration: null })
                        }
                    }
                }}
            />

            <EnumerationDeleteDialog
                open={blockingDeleteDialogState.open}
                enumeration={blockingDeleteDialogState.enumeration}
                metahubId={metahubId}
                onClose={() => setBlockingDeleteDialogState({ open: false, enumeration: null })}
                onConfirm={async (enumeration) => {
                    try {
                        const targetHubId = isHubScoped ? hubId : enumeration.hubs?.[0]?.id
                        await deleteEnumerationMutation.mutateAsync({
                            metahubId,
                            hubId: targetHubId,
                            enumerationId: enumeration.id,
                            force: !isHubScoped
                        })
                        setBlockingDeleteDialogState({ open: false, enumeration: null })
                        queryClient.removeQueries({ queryKey: metahubsQueryKeys.blockingEnumerationReferences(metahubId, enumeration.id) })
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
                                : t('enumerations.deleteError')
                        enqueueSnackbar(message, { variant: 'error' })
                        setBlockingDeleteDialogState({ open: false, enumeration: null })
                    }
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

            <ConfirmDialog />
        </MainCard>
    )
}

export default EnumerationList
