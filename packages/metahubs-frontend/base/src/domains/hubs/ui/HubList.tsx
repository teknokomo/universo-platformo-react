import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, Divider } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

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
import type { DragEndEvent } from '@universo/template-mui'
import { EntityFormDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreateHub, useUpdateHub, useDeleteHub, useCopyHub, useReorderHub } from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as hubsApi from '../api'
import { metahubsQueryKeys, invalidateHubsQueries } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { Hub, HubDisplay, HubLocalizedPayload, getVLCString, toHubDisplay } from '../../../types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField, HubDeleteDialog, ExistingCodenamesProvider } from '../../../components'
import hubActions from './HubActions'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'

type HubFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codenameVlc?: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
}

type GenericFormValues = Record<string, unknown>

type HubMenuBaseContext = {
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

type HubFormFieldsProps = {
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

const HubFormFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel,
    codenameLabel,
    codenameHelper
}: HubFormFieldsProps) => {
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
        <>
            <LocalizedInlineField
                mode='localized'
                label={nameLabel}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next) => setValue('nameVlc', next)}
                error={errors.nameVlc || null}
                helperText={errors.nameVlc}
                uiLocale={uiLocale}
            />
            <LocalizedInlineField
                mode='localized'
                label={descriptionLabel}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
            />
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched) => setValue('codenameTouched', touched)}
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                localizedEnabled={codenameConfig.localizedEnabled}
                localizedValue={codenameVlc}
                onLocalizedChange={(next) => setValue('codenameVlc', next)}
                uiLocale={uiLocale}
                label={codenameLabel}
                helperText={codenameHelper}
                error={errors.codename}
                disabled={isLoading}
                required
            />
        </>
    )
}

const HubList = () => {
    const codenameConfig = useCodenameConfig()
    const navigate = useNavigate()
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const preferredVlcLocale = useMetahubPrimaryLocale()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.HUB_DISPLAY_STYLE)

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for hubs list
    const paginationResult = usePaginated<Hub, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId ? (params) => metahubsQueryKeys.hubsList(metahubId, params) : () => ['empty'],
        queryFn: metahubId
            ? (params) => hubsApi.listHubs(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId
    })

    const { data: hubs, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    // Instant search for better UX
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        hub: Hub | null
    }>({ open: false, hub: null })

    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingUpdate: { id: string; patch: HubLocalizedPayload } | null
    }>({ open: false, conflict: null, pendingUpdate: null })

    const { confirm } = useConfirm()

    // Filter entity actions based on settings (allowCopy / allowDelete)
    const { allowCopy, allowDelete } = useEntityPermissions('hubs')
    const filteredHubActions = useMemo(
        () =>
            hubActions.filter((a) => {
                if (a.id === 'copy' && !allowCopy) return false
                if (a.id === 'delete' && !allowDelete) return false
                return true
            }),
        [allowCopy, allowDelete]
    )

    const createHubMutation = useCreateHub()
    const updateHubMutation = useUpdateHub()
    const deleteHubMutation = useDeleteHub()
    const copyHubMutation = useCopyHub()
    const reorderHubMutation = useReorderHub()

    const sortedHubs = useMemo(
        () =>
            [...hubs].sort((a, b) => {
                const sortA = a.sortOrder ?? 0
                const sortB = b.sortOrder ?? 0
                if (sortA !== sortB) return sortA - sortB
                return a.id.localeCompare(b.id)
            }),
        [hubs]
    )

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(sortedHubs)) {
            sortedHubs.forEach((hub) => {
                if (hub?.id) {
                    imagesMap[hub.id] = []
                }
            })
        }
        return imagesMap
    }, [sortedHubs])

    const hubMap = useMemo(() => {
        if (!Array.isArray(sortedHubs)) return new Map<string, Hub>()
        return new Map(sortedHubs.map((hub) => [hub.id, hub]))
    }, [sortedHubs])

    const localizedFormDefaults = useMemo<HubFormValues>(
        () => ({ nameVlc: null, descriptionVlc: null, codenameVlc: null, codename: '', codenameTouched: false }),
        []
    )

    const validateHubForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!normalizedCodename) {
                errors.codename = t('hubs.validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('hubs.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveHubForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            return (
                !values._hasCodenameDuplicate &&
                hasPrimaryContent(nameVlc) &&
                Boolean(normalizedCodename) &&
                isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            )
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style]
    )

    const renderLocalizedFields = useCallback(
        ({
            values,
            setValue,
            isLoading,
            errors
        }: {
            values: GenericFormValues
            setValue: (name: string, value: unknown) => void
            isLoading: boolean
            errors?: Record<string, string>
        }) => {
            const fieldErrors = errors ?? {}
            return (
                <HubFormFields
                    values={values}
                    setValue={setValue}
                    isLoading={isLoading}
                    errors={fieldErrors}
                    uiLocale={preferredVlcLocale}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    codenameLabel={t('hubs.codename', 'Codename')}
                    codenameHelper={t('hubs.codenameHelper', 'Unique identifier')}
                />
            )
        },
        [preferredVlcLocale, t, tc]
    )

    const hubColumns = useMemo(
        () => [
            {
                id: 'sortOrder',
                label: t('attributes.table.order', '#'),
                width: '4%',
                align: 'center' as const,
                sortable: true,
                sortAccessor: (row: HubDisplay) => row.sortOrder ?? 0,
                render: (row: HubDisplay) => (
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        {typeof row.sortOrder === 'number' ? row.sortOrder : '—'}
                    </Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '25%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: HubDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: HubDisplay) => (
                    <Link to={`/metahub/${metahubId}/hub/${row.id}/catalogs`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
                width: '30%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: HubDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: HubDisplay) => (
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
                label: t('hubs.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: HubDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: HubDisplay) => (
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
                id: 'itemsCount',
                label: t('hubs.itemsTitle', 'Items'),
                width: '10%',
                align: 'center' as const,
                render: (row: HubDisplay) => {
                    const itemsCount = typeof row.itemsCount === 'number' ? row.itemsCount : row.catalogsCount
                    return typeof itemsCount === 'number' ? itemsCount : '—'
                }
            }
        ],
        [t, tc, metahubId]
    )

    const createHubContext = useCallback(
        (baseContext: HubMenuBaseContext) => ({
            ...baseContext,
            hubMap,
            uiLocale: preferredVlcLocale,
            api: {
                updateEntity: async (id: string, patch: HubLocalizedPayload) => {
                    if (!metahubId) return
                    const normalizedCodename = normalizeCodenameForStyle(patch.codename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('hubs.validation.codenameRequired', 'Codename is required'))
                    }
                    const hub = hubMap.get(id)
                    const expectedVersion = hub?.version
                    try {
                        await updateHubMutation.mutateAsync({
                            metahubId,
                            hubId: id,
                            data: { ...patch, codename: normalizedCodename, expectedVersion }
                        })
                    } catch (error: unknown) {
                        if (isOptimisticLockConflict(error)) {
                            const conflict = extractConflictInfo(error)
                            if (conflict) {
                                setConflictState({
                                    open: true,
                                    conflict,
                                    pendingUpdate: { id, patch: { ...patch, codename: normalizedCodename } }
                                })
                                return
                            }
                        }
                        throw error
                    }
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId) return
                    await deleteHubMutation.mutateAsync({ metahubId, hubId: id })
                },
                copyEntity: async (id: string, payload: HubLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId) return
                    await copyHubMutation.mutateAsync({
                        metahubId,
                        hubId: id,
                        data: payload
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId) {
                        await invalidateHubsQueries.all(queryClient, metahubId)
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
                openDeleteDialog: (hubOrDisplay: Hub | HubDisplay) => {
                    // Handle both Hub and HubDisplay (from BaseEntityMenu context)
                    const hub = 'metahubId' in hubOrDisplay ? hubOrDisplay : hubMap.get(hubOrDisplay.id)
                    if (hub) {
                        setDeleteDialogState({ open: true, hub })
                    }
                }
            }
        }),
        [
            codenameConfig.alphabet,
            codenameConfig.style,
            confirm,
            copyHubMutation,
            deleteHubMutation,
            enqueueSnackbar,
            hubMap,
            metahubId,
            preferredVlcLocale,
            queryClient,
            t,
            updateHubMutation
        ]
    )

    // Validate metahubId from URL AFTER all hooks
    if (!metahubId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid metahub'
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

    const handleCreateHub = async (data: GenericFormValues) => {
        setDialogError(null)
        setCreating(true)
        try {
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
                setDialogError(t('hubs.validation.codenameRequired', 'Codename is required'))
                return
            }

            await createHubMutation.mutateAsync({
                metahubId,
                data: {
                    codename: normalizedCodename,
                    codenameInput,
                    codenamePrimaryLocale,
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale
                }
            })

            await invalidateHubsQueries.all(queryClient, metahubId)
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
                    : t('hubs.createError')
            setDialogError(message)
            console.error('Failed to create hub', e)
        } finally {
            setCreating(false)
        }
    }

    const goToHub = (hub: Hub) => {
        navigate(`/metahub/${metahubId}/hub/${hub.id}/catalogs`)
    }

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const handleSortableDragEnd = async (event: DragEndEvent) => {
        if (!metahubId) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const overHub = sortedHubs.find((hub) => hub.id === String(over.id))
        if (!overHub) return

        try {
            await reorderHubMutation.mutateAsync({
                metahubId,
                hubId: String(active.id),
                newSortOrder: overHub.sortOrder ?? 1
            })
            enqueueSnackbar(t('hubs.reorderSuccess', 'Hub order updated'), { variant: 'success' })
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('hubs.reorderError', 'Failed to reorder hub')
            enqueueSnackbar(message, { variant: 'error' })
        }
    }

    const renderDragOverlay = (activeId: string | null) => {
        if (!activeId) return null
        const hub = hubMap.get(activeId)
        if (!hub) return null
        const display = toHubDisplay(hub, i18n.language)
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
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{display.name || display.codename || hub.id}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{display.codename || '—'}</Typography>
                </Stack>
            </Box>
        )
    }

    // Transform Hub data for display (ItemCard and FlowListTable expect string name)
    const getHubCardData = (hub: Hub): HubDisplay => toHubDisplay(hub, i18n.language)

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <ExistingCodenamesProvider entities={hubs ?? []}>
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
                            searchPlaceholder={t('hubs.searchPlaceholder')}
                            onSearchChange={handleSearchChange}
                            title={t('hubs.title')}
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

                        {isLoading && sortedHubs.length === 0 ? (
                            view === 'card' ? (
                                <SkeletonGrid />
                            ) : (
                                <Skeleton variant='rectangular' height={120} />
                            )
                        ) : !isLoading && sortedHubs.length === 0 ? (
                            <EmptyListState
                                image={APIEmptySVG}
                                imageAlt='No hubs'
                                title={t('hubs.empty')}
                                description={t('hubs.emptyDescription')}
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
                                        {sortedHubs.map((hub: Hub) => {
                                            const descriptors = [...filteredHubActions]
                                            const itemsCount = typeof hub.itemsCount === 'number' ? hub.itemsCount : hub.catalogsCount ?? 0

                                            return (
                                                <ItemCard
                                                    key={hub.id}
                                                    data={getHubCardData(hub)}
                                                    images={images[hub.id] || []}
                                                    onClick={() => goToHub(hub)}
                                                    footerEndContent={
                                                        typeof hub.itemsCount === 'number' || typeof hub.catalogsCount === 'number' ? (
                                                            <Typography variant='caption' color='text.secondary'>
                                                                {t('hubs.itemsCount', { count: itemsCount })}
                                                            </Typography>
                                                        ) : null
                                                    }
                                                    headerAction={
                                                        descriptors.length > 0 ? (
                                                            <Box onClick={(e) => e.stopPropagation()}>
                                                                <BaseEntityMenu<HubDisplay, HubLocalizedPayload>
                                                                    entity={toHubDisplay(hub, i18n.language)}
                                                                    entityKind='hub'
                                                                    descriptors={descriptors}
                                                                    namespace='metahubs'
                                                                    i18nInstance={i18n}
                                                                    createContext={createHubContext}
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
                                            data={sortedHubs.map(getHubCardData)}
                                            images={images}
                                            isLoading={isLoading}
                                            sortableRows
                                            sortableItemIds={sortedHubs.map((hub) => hub.id)}
                                            dragHandleAriaLabel={t('hubs.dnd.dragHandle', 'Drag to reorder')}
                                            dragDisabled={reorderHubMutation.isPending || isLoading}
                                            onSortableDragEnd={handleSortableDragEnd}
                                            renderDragOverlay={renderDragOverlay}
                                            getRowLink={(row: HubDisplay) =>
                                                row?.id ? `/metahub/${metahubId}/hub/${row.id}/catalogs` : undefined
                                            }
                                            customColumns={hubColumns}
                                            i18nNamespace='flowList'
                                            renderActions={(row: HubDisplay) => {
                                                const originalHub = hubMap.get(row.id)
                                                if (!originalHub) return null

                                                const descriptors = [...filteredHubActions]
                                                if (!descriptors.length) return null

                                                return (
                                                    <BaseEntityMenu<HubDisplay, HubLocalizedPayload>
                                                        entity={toHubDisplay(originalHub, i18n.language)}
                                                        entityKind='hub'
                                                        descriptors={descriptors}
                                                        namespace='metahubs'
                                                        menuButtonLabelKey='flowList:menu.button'
                                                        i18nInstance={i18n}
                                                        createContext={createHubContext}
                                                    />
                                                )
                                            }}
                                        />
                                    </Box>
                                )}
                            </>
                        )}

                        {/* Table Pagination at bottom */}
                        {!isLoading && sortedHubs.length > 0 && (
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
                    title={t('hubs.createDialog.title', 'Create Hub')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={isCreating}
                    error={dialogError || undefined}
                    onClose={handleDialogClose}
                    onSave={handleCreateHub}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    extraFields={renderLocalizedFields}
                    validate={validateHubForm}
                    canSave={canSaveHubForm}
                />

                {/* Hub delete dialog with blocking catalogs check */}
                <HubDeleteDialog
                    open={deleteDialogState.open}
                    hub={deleteDialogState.hub}
                    metahubId={metahubId}
                    onClose={() => setDeleteDialogState({ open: false, hub: null })}
                    onConfirm={async (hub) => {
                        try {
                            await deleteHubMutation.mutateAsync({
                                metahubId,
                                hubId: hub.id
                            })
                            setDeleteDialogState({ open: false, hub: null })
                        } catch (err: unknown) {
                            const responseMessage = extractResponseMessage(err)
                            const message =
                                typeof responseMessage === 'string'
                                    ? responseMessage
                                    : err instanceof Error
                                    ? err.message
                                    : typeof err === 'string'
                                    ? err
                                    : t('hubs.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, hub: null })
                        }
                    }}
                    isDeleting={deleteHubMutation.isPending}
                    uiLocale={i18n.language}
                />

                <ConfirmDialog />

                <ConflictResolutionDialog
                    open={conflictState.open}
                    conflict={conflictState.conflict}
                    onCancel={() => {
                        setConflictState({ open: false, conflict: null, pendingUpdate: null })
                        if (metahubId) {
                            invalidateHubsQueries.all(queryClient, metahubId)
                        }
                    }}
                    onOverwrite={async () => {
                        if (conflictState.pendingUpdate && metahubId) {
                            const { id, patch } = conflictState.pendingUpdate
                            await updateHubMutation.mutateAsync({
                                metahubId,
                                hubId: id,
                                data: patch
                            })
                            setConflictState({ open: false, conflict: null, pendingUpdate: null })
                        }
                    }}
                    isLoading={updateHubMutation.isPending}
                />
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

export default HubList
