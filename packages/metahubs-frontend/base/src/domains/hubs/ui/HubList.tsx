import { useState, useMemo, useCallback, useEffect } from 'react'
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom'
import { Box, ButtonBase, Chip, Divider, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQuery, useQueryClient } from '@tanstack/react-query'

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
import type { EntitySelectionLabels } from '@universo/template-mui'
import type { DragEndEvent } from '@universo/template-mui'
import { EntityFormDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreateHub, useUpdateHub, useDeleteHub, useCopyHub, useReorderHub } from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as hubsApi from '../api'
import { fetchAllPaginatedItems, metahubsQueryKeys, invalidateHubsQueries } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { Hub, HubDisplay, HubLocalizedPayload, PaginatedResponse, getVLCString, toHubDisplay } from '../../../types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField, HubDeleteDialog, ExistingCodenamesProvider, HubParentSelectionPanel } from '../../../components'
import hubActions, {
    buildInitialValues as buildHubInitialValues,
    buildFormTabs as buildHubFormTabs,
    validateHubForm,
    canSaveHubForm,
    toPayload as hubToPayload
} from './HubActions'
import { useEntityPermissions } from '../../settings/hooks/useEntityPermissions'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'

type HubFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    parentHubId?: string | null
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

const HubListContent = () => {
    const codenameConfig = useCodenameConfig()
    const navigate = useNavigate()
    const location = useLocation()
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId?: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()
    const preferredVlcLocale = useMetahubPrimaryLocale()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const isHubScoped = Boolean(hubId)
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.HUB_DISPLAY_STYLE)

    // Use paginated hook for hubs list
    const paginationResult = usePaginated<Hub, 'codename' | 'created' | 'updated' | 'sortOrder'>({
        queryKeyFn: metahubId
            ? (params) =>
                  isHubScoped && hubId
                      ? metahubsQueryKeys.childHubsList(metahubId, hubId, params)
                      : metahubsQueryKeys.hubsList(metahubId, params)
            : () => ['empty'],
        queryFn: metahubId
            ? (params) => (isHubScoped && hubId ? hubsApi.listChildHubs(metahubId, hubId, params) : hubsApi.listHubs(metahubId, params))
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        enabled: !!metahubId,
        keepPreviousDataOnQueryKeyChange: !isHubScoped
    })

    const { data: hubs, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    const { data: allHubsResponse } = useQuery<PaginatedResponse<Hub>>({
        queryKey: metahubId
            ? metahubsQueryKeys.hubsList(metahubId, { limit: 1000, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' })
            : ['hubs-all'],
        enabled: Boolean(metahubId),
        queryFn: () =>
            fetchAllPaginatedItems((params) => hubsApi.listHubs(String(metahubId), params), {
                limit: 1000,
                sortBy: 'sortOrder',
                sortOrder: 'asc'
            })
    })
    const allHubs = useMemo(() => allHubsResponse?.items ?? [], [allHubsResponse?.items])

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
    const [isAttachDialogOpen, setAttachDialogOpen] = useState(false)
    const [isAttachingExisting, setAttachingExisting] = useState(false)
    const [attachDialogError, setAttachDialogError] = useState<string | null>(null)
    const [pendingHubNavigation, setPendingHubNavigation] = useState<{ pendingId: string; codename: string } | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const handlePendingHubInteraction = useCallback(
        (pendingHubId: string) => {
            if (!metahubId) return
            const pendingHub = hubs.find((hub) => hub.id === pendingHubId)
            if (pendingHub?.codename) {
                setPendingHubNavigation({ pendingId: pendingHub.id, codename: pendingHub.codename })
            }
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: isHubScoped && hubId ? metahubsQueryKeys.childHubs(metahubId, hubId) : metahubsQueryKeys.hubs(metahubId),
                entityId: pendingHubId,
                extraQueryKeys: [metahubsQueryKeys.hubDetail(metahubId, pendingHubId)]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, hubId, hubs, isHubScoped, metahubId, pendingInteractionMessage, queryClient]
    )

    const { confirm } = useConfirm()

    // Filter entity actions based on settings (allowCopy / allowDelete)
    const { allowCopy, allowDelete, allowAttachExistingEntities, allowHubNesting } = useEntityPermissions('hubs')
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

    useEffect(() => {
        if (!pendingHubNavigation || !metahubId) return

        if (sortedHubs.some((hub) => hub.id === pendingHubNavigation.pendingId)) {
            return
        }

        const resolvedHub = sortedHubs.find((hub) => !isPendingEntity(hub) && hub.codename === pendingHubNavigation.codename)

        if (!resolvedHub) return

        setPendingHubNavigation(null)
        navigate(`/metahub/${metahubId}/hub/${resolvedHub.id}/hubs`)
    }, [metahubId, navigate, pendingHubNavigation, sortedHubs])

    useEffect(() => {
        const state = location.state as { openHubSettings?: boolean } | null
        if (!isHubScoped || !state?.openHubSettings) return

        setEditDialogOpen(true)
        navigate(location.pathname, { replace: true, state: null })
    }, [isHubScoped, location.pathname, location.state, navigate])

    const allHubsById = useMemo(() => {
        const map = new Map<string, Hub>()
        allHubs.forEach((hub) => map.set(hub.id, hub))
        return map
    }, [allHubs])

    const currentHubAncestorIds = useMemo(() => {
        const ancestors = new Set<string>()
        if (!isHubScoped || !hubId) return ancestors

        let current: string | null | undefined = hubId
        const visited = new Set<string>()
        while (current && !visited.has(current)) {
            visited.add(current)
            const parentHubId = allHubsById.get(current)?.parentHubId
            if (!parentHubId) break
            ancestors.add(parentHubId)
            current = parentHubId
        }

        return ancestors
    }, [allHubsById, hubId, isHubScoped])

    const attachableExistingHubs = useMemo(() => {
        if (!isHubScoped || !hubId) return []
        return allHubs.filter((hub) => {
            if (hub.id === hubId) return false
            if (hub.parentHubId === hubId) return false
            if (currentHubAncestorIds.has(hub.id)) return false
            return true
        })
    }, [allHubs, currentHubAncestorIds, hubId, isHubScoped])

    const attachExistingHubSelectionLabels = useMemo<EntitySelectionLabels>(
        () => ({
            title: t('hubs.attachExisting.selectionTitle', 'Hubs'),
            addButton: t('common:actions.add', 'Add'),
            dialogTitle: t('hubs.attachExisting.selectDialogTitle', 'Select hubs'),
            emptyMessage: t('hubs.attachExisting.emptySelection', 'No hubs selected'),
            noAvailableMessage: t('hubs.attachExisting.noAvailable', 'No hubs available to add'),
            searchPlaceholder: t('common:search', 'Search...'),
            cancelButton: t('common:actions.cancel', 'Cancel'),
            confirmButton: t('common:actions.add', 'Add'),
            removeTitle: t('common:actions.remove', 'Remove'),
            nameHeader: t('table.name', 'Name'),
            codenameHeader: t('common:fields.codename', 'Codename')
        }),
        [t]
    )

    const localizedFormDefaults = useMemo<HubFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            parentHubId: allowHubNesting && isHubScoped ? hubId ?? null : null
        }),
        [allowHubNesting, hubId, isHubScoped]
    )

    const validateCreateHubForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
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

    const canSaveCreateHubForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
            const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
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

    const buildFormTabs = useCallback(
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
        }): TabConfig[] => {
            const fieldErrors = errors ?? {}
            const parentHubId = typeof values.parentHubId === 'string' ? values.parentHubId : null

            const tabs: TabConfig[] = [
                {
                    id: 'general',
                    label: t('hubs.tabs.general', 'General'),
                    content: (
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
                }
            ]
            if (!allowHubNesting) {
                return tabs
            }

            tabs.push({
                id: 'hubs',
                label: t('hubs.tabs.hubs', 'Hubs'),
                content: (
                    <HubParentSelectionPanel
                        availableHubs={allHubs}
                        parentHubId={parentHubId}
                        onParentHubChange={(nextParentHubId) => setValue('parentHubId', nextParentHubId)}
                        disabled={isLoading}
                        error={fieldErrors.parentHubId}
                        uiLocale={preferredVlcLocale}
                        currentHubId={hubId ?? null}
                    />
                )
            })

            return tabs
        },
        [allowHubNesting, preferredVlcLocale, t, tc, allHubs, hubId]
    )

    const getDirectParentHub = useCallback(
        (hubLike: Hub | HubDisplay): { id: string; name: string; codename: string } | null => {
            const parentId = typeof hubLike.parentHubId === 'string' ? hubLike.parentHubId : null
            if (!parentId) return null
            const parent = allHubsById.get(parentId)
            if (!parent) return null
            return {
                id: parent.id,
                name: getVLCString(parent.name, i18n.language) || getVLCString(parent.name, 'en') || parent.codename || '—',
                codename: parent.codename || ''
            }
        },
        [allHubsById, i18n.language]
    )

    const hubColumns = useMemo(() => {
        const columns = [
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
                width: isHubScoped ? '25%' : '22%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: HubDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: HubDisplay) =>
                    isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingHubInteraction(row.id)}
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
                        <Link to={`/metahub/${metahubId}/hub/${row.id}/hubs`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
                width: isHubScoped ? '30%' : '24%',
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
                width: isHubScoped ? '15%' : '14%',
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
            }
        ]

        if (!isHubScoped) {
            columns.push({
                id: 'hubs',
                label: t('hubs.title', 'Hubs'),
                width: '18%',
                align: 'left' as const,
                render: (row: HubDisplay) => {
                    const parentHub = getDirectParentHub(row)
                    if (!parentHub) {
                        return (
                            <Typography variant='body2' color='text.secondary'>
                                —
                            </Typography>
                        )
                    }

                    return isPendingEntity(row) ? (
                        <Chip
                            label={parentHub.name}
                            size='small'
                            variant='outlined'
                            clickable
                            onClick={() => handlePendingHubInteraction(row.id)}
                            sx={{
                                maxWidth: '100%',
                                '&:hover': {
                                    backgroundColor: 'action.hover'
                                }
                            }}
                        />
                    ) : (
                        <Link to={`/metahub/${metahubId}/hub/${parentHub.id}/hubs`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <Chip
                                label={parentHub.name}
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
                }
            })
        }

        columns.push({
            id: 'itemsCount',
            label: t('hubs.itemsTitle', 'Items'),
            width: '10%',
            align: 'center' as const,
            render: (row: HubDisplay) => {
                const itemsCount = typeof row.itemsCount === 'number' ? row.itemsCount : row.catalogsCount
                return typeof itemsCount === 'number' ? itemsCount : '—'
            }
        })

        return columns
    }, [getDirectParentHub, handlePendingHubInteraction, isHubScoped, metahubId, t, tc])

    const createHubContext = useCallback(
        (baseContext: HubMenuBaseContext) => ({
            ...baseContext,
            hubMap,
            hubs: allHubs,
            currentHubId: isHubScoped ? hubId ?? null : null,
            allowHubNesting,
            uiLocale: preferredVlcLocale,
            api: {
                updateEntity: (id: string, patch: HubLocalizedPayload) => {
                    if (!metahubId) return Promise.resolve()
                    const rawCodename = getVLCString(patch.codename, patch.codename?._primary ?? 'en')
                    const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
                    if (!normalizedCodename) {
                        throw new Error(t('hubs.validation.codenameRequired', 'Codename is required'))
                    }
                    const codenamePayload = ensureLocalizedContent(patch.codename, patch.codename?._primary ?? 'en', normalizedCodename)
                    const hub = hubMap.get(id)
                    const expectedVersion = hub?.version
                    updateHubMutation.mutate(
                        {
                            metahubId,
                            hubId: id,
                            data: { ...patch, codename: codenamePayload, expectedVersion }
                        },
                        {
                            onError: (error: unknown) => {
                                if (isOptimisticLockConflict(error)) {
                                    const conflict = extractConflictInfo(error)
                                    if (conflict) {
                                        setConflictState({
                                            open: true,
                                            conflict,
                                            pendingUpdate: { id, patch: { ...patch, codename: codenamePayload } }
                                        })
                                    }
                                }
                            }
                        }
                    )

                    return Promise.resolve()
                },
                deleteEntity: (id: string) => {
                    if (!metahubId) return
                    return deleteHubMutation.mutateAsync({ metahubId, hubId: id })
                },
                copyEntity: (id: string, payload: HubLocalizedPayload & Record<string, unknown>) => {
                    if (!metahubId) return Promise.resolve()
                    copyHubMutation.mutate({
                        metahubId,
                        hubId: id,
                        data: payload
                    })

                    return Promise.resolve()
                }
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        void invalidateHubsQueries.all(queryClient, metahubId)
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
            hubId,
            metahubId,
            preferredVlcLocale,
            queryClient,
            allHubs,
            allowHubNesting,
            isHubScoped,
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
        if (!canCreateInCurrentHub) return
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

    const handleAttachExistingHubs = async (data: GenericFormValues) => {
        if (!metahubId || !hubId) return

        const selectedHubIds = Array.isArray(data.selectedHubIds)
            ? data.selectedHubIds.filter((id): id is string => typeof id === 'string')
            : []
        if (selectedHubIds.length === 0) {
            return
        }

        setAttachDialogError(null)
        setAttachingExisting(true)
        try {
            const selectedHubs = selectedHubIds.map((id) => allHubsById.get(id)).filter((hub): hub is Hub => Boolean(hub))
            const failed: string[] = []

            for (const targetHub of selectedHubs) {
                try {
                    await hubsApi.updateHub(metahubId, targetHub.id, {
                        parentHubId: hubId,
                        expectedVersion: targetHub.version
                    })
                } catch (error) {
                    failed.push(
                        getVLCString(targetHub.name, preferredVlcLocale) || getVLCString(targetHub.name, 'en') || targetHub.codename
                    )
                    // eslint-disable-next-line no-console
                    console.error('Failed to attach existing hub to current hub', error)
                }
            }

            await invalidateHubsQueries.all(queryClient, metahubId)

            if (failed.length === 0) {
                enqueueSnackbar(t('hubs.attachExisting.success', { count: selectedHubs.length, defaultValue: 'Added {{count}} hub(s).' }), {
                    variant: 'success'
                })
                setAttachDialogOpen(false)
                return
            }

            const successCount = selectedHubs.length - failed.length
            if (successCount > 0) {
                enqueueSnackbar(
                    t('hubs.attachExisting.partialSuccess', {
                        successCount,
                        failCount: failed.length,
                        defaultValue: 'Added {{successCount}} hub(s). {{failCount}} hub(s) could not be linked.'
                    }),
                    { variant: 'warning' }
                )
                setAttachDialogOpen(false)
                return
            }

            setAttachDialogError(
                t('hubs.attachExisting.failedAll', {
                    defaultValue: 'Selected hubs could not be linked to this hub. Please review parent/child constraints and try again.'
                })
            )
        } finally {
            setAttachingExisting(false)
        }
    }

    const handleCreateHub = async (data: GenericFormValues) => {
        // Validation is handled by EntityFormDialog's validate/canSave props.
        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
        const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
        const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
        const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, normalizedCodename || '')
        const parentHubId = typeof data.parentHubId === 'string' ? data.parentHubId : null

        // Confirm dialog for detached hub (async — throws DIALOG_SAVE_CANCEL if cancelled)
        if (isHubScoped && hubId && parentHubId !== hubId) {
            const confirmed = await confirm({
                title: t('hubs.detachedConfirm.title', 'Create hub outside current hub?'),
                description: t(
                    'hubs.detachedConfirm.description',
                    'This hub is not linked as a child of the current hub and will not appear in this hub after creation.'
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
        createHubMutation.mutate({
            metahubId,
            data: {
                codename: codenamePayload,
                name: nameInput ?? {},
                description: descriptionInput,
                namePrimaryLocale: namePrimaryLocale ?? '',
                descriptionPrimaryLocale,
                parentHubId
            }
        })
    }

    const goToHub = (hub: Hub) => {
        navigate(`/metahub/${metahubId}/hub/${hub.id}/hubs`)
    }

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const handleHubTabChange = (_event: unknown, tabValue: 'hubs' | 'catalogs' | 'sets' | 'enumerations' | 'settings') => {
        if (!metahubId || !hubId) return
        if (tabValue === 'settings') {
            setEditDialogOpen(true)
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
        if (tabValue === 'enumerations') {
            navigate(`/metahub/${metahubId}/hub/${hubId}/enumerations`)
            return
        }
        navigate(`/metahub/${metahubId}/hub/${hubId}/hubs`)
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
    const canCreateInCurrentHub = !isHubScoped || allowHubNesting
    const showAttachExistingAction = isHubScoped && allowHubNesting && allowAttachExistingEntities
    const hasAttachableExistingHubs = attachableExistingHubs.length > 0

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <ExistingCodenamesProvider entities={allHubs}>
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
                                    startIcon: <AddRoundedIcon />,
                                    disabled: !canCreateInCurrentHub
                                }}
                                primaryActionMenuItems={
                                    showAttachExistingAction && hasAttachableExistingHubs
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
                            <>
                                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                    <Tabs
                                        value='hubs'
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
                                {!allowHubNesting && (
                                    <Box sx={{ px: 2, pt: 1 }}>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(
                                                'hubs.nestingDisabledHint',
                                                'Hub nesting is disabled in settings. You can still edit and unlink existing parent relations.'
                                            )}
                                        </Typography>
                                    </Box>
                                )}
                            </>
                        )}

                        <Box sx={{ mt: isHubScoped ? 2 : 0 }}>
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
                                                const parentHub = getDirectParentHub(hub)
                                                const itemsCount =
                                                    typeof hub.itemsCount === 'number' ? hub.itemsCount : hub.catalogsCount ?? 0
                                                const showItemsCount =
                                                    typeof hub.itemsCount === 'number' || typeof hub.catalogsCount === 'number'
                                                const showParentHubInfo = !isHubScoped && Boolean(parentHub)

                                                return (
                                                    <ItemCard
                                                        key={hub.id}
                                                        data={getHubCardData(hub)}
                                                        images={images[hub.id] || []}
                                                        onClick={() => goToHub(hub)}
                                                        pending={isPendingEntity(hub)}
                                                        pendingAction={getPendingAction(hub)}
                                                        onPendingInteractionAttempt={() => handlePendingHubInteraction(hub.id)}
                                                        footerEndContent={
                                                            showParentHubInfo || showItemsCount ? (
                                                                <Stack direction='row' spacing={1} alignItems='center'>
                                                                    {showParentHubInfo && (
                                                                        <Chip label={parentHub?.name} size='small' variant='outlined' />
                                                                    )}
                                                                    {showItemsCount && (
                                                                        <Typography variant='caption' color='text.secondary'>
                                                                            {t('hubs.itemsCount', { count: itemsCount })}
                                                                        </Typography>
                                                                    )}
                                                                </Stack>
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
                                                    row?.id ? `/metahub/${metahubId}/hub/${row.id}/hubs` : undefined
                                                }
                                                onPendingInteractionAttempt={(row: HubDisplay) => handlePendingHubInteraction(row.id)}
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
                        </Box>

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
                    onClose={handleDialogClose}
                    onSave={handleCreateHub}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    validate={validateCreateHubForm}
                    canSave={canSaveCreateHubForm}
                />

                <EntityFormDialog
                    open={isAttachDialogOpen}
                    title={t('hubs.attachExisting.dialogTitle', 'Add Existing Hubs')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={t('common:actions.add', 'Add')}
                    savingButtonText={t('common:actions.saving', 'Saving...')}
                    cancelButtonText={t('common:actions.cancel', 'Cancel')}
                    loading={isAttachingExisting}
                    error={attachDialogError || undefined}
                    onClose={handleCloseAttachExistingDialog}
                    onSave={handleAttachExistingHubs}
                    hideDefaultFields
                    initialExtraValues={{ selectedHubIds: [] }}
                    tabs={({ values, setValue, isLoading, errors }) => {
                        const selectedHubIds = Array.isArray(values.selectedHubIds)
                            ? values.selectedHubIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return [
                            {
                                id: 'hubs',
                                label: t('hubs.tabs.hubs', 'Hubs'),
                                content: (
                                    <EntitySelectionPanel<Hub>
                                        availableEntities={attachableExistingHubs}
                                        selectedIds={selectedHubIds}
                                        onSelectionChange={(ids) => setValue('selectedHubIds', ids)}
                                        getDisplayName={(hub) =>
                                            getVLCString(hub.name, preferredVlcLocale) ||
                                            getVLCString(hub.name, 'en') ||
                                            hub.codename ||
                                            '—'
                                        }
                                        getCodename={(hub) => hub.codename}
                                        labels={attachExistingHubSelectionLabels}
                                        disabled={isLoading}
                                        error={errors.selectedHubIds}
                                    />
                                )
                            }
                        ]
                    }}
                    validate={(values) => {
                        const selectedHubIds = Array.isArray(values.selectedHubIds)
                            ? values.selectedHubIds.filter((id): id is string => typeof id === 'string')
                            : []
                        if (selectedHubIds.length > 0) return null
                        return {
                            selectedHubIds: t('hubs.attachExisting.requiredSelection', 'Select at least one hub to add.')
                        }
                    }}
                    canSave={(values) => {
                        const selectedHubIds = Array.isArray(values.selectedHubIds)
                            ? values.selectedHubIds.filter((id): id is string => typeof id === 'string')
                            : []
                        return !isAttachingExisting && selectedHubIds.length > 0
                    }}
                />

                {/* Hub delete dialog with blocking catalogs check */}
                <HubDeleteDialog
                    open={deleteDialogState.open}
                    hub={deleteDialogState.hub}
                    metahubId={metahubId}
                    onClose={() => setDeleteDialogState({ open: false, hub: null })}
                    onConfirm={(hub) => {
                        deleteHubMutation.mutate(
                            {
                                metahubId,
                                hubId: hub.id
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
                                            : t('hubs.deleteError')
                                    enqueueSnackbar(message, { variant: 'error' })
                                }
                            }
                        )
                    }}
                    isDeleting={deleteHubMutation.isPending}
                    uiLocale={i18n.language}
                />
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

                {/* Settings edit dialog overlay for hub-scoped view */}
                {isHubScoped &&
                    hubId &&
                    (() => {
                        const currentHub = allHubsById.get(hubId)
                        if (!currentHub) return null
                        const currentHubDisplay = toHubDisplay(currentHub, i18n.language)
                        const settingsCtx = createHubContext({
                            entity: currentHubDisplay,
                            entityKind: 'hub',
                            t
                        })
                        return (
                            <EntityFormDialog
                                open={editDialogOpen}
                                mode='edit'
                                title={t('hubs.editTitle', 'Edit Hub')}
                                nameLabel={tc('fields.name', 'Name')}
                                descriptionLabel={tc('fields.description', 'Description')}
                                saveButtonText={tc('actions.save', 'Save')}
                                savingButtonText={tc('actions.saving', 'Saving...')}
                                cancelButtonText={tc('actions.cancel', 'Cancel')}
                                hideDefaultFields
                                initialExtraValues={buildHubInitialValues(settingsCtx)}
                                tabs={buildHubFormTabs(settingsCtx, allHubs, {
                                    editingEntityId: currentHub.id,
                                    allowHubNesting,
                                    mode: 'edit'
                                })}
                                validate={(values) => validateHubForm(settingsCtx, values)}
                                canSave={canSaveHubForm}
                                onSave={(data) => {
                                    const payload = hubToPayload(data)
                                    void settingsCtx.api!.updateEntity!(currentHub.id, payload)
                                    // Invalidate breadcrumb queries so page title refreshes immediately
                                    if (metahubId && hubId) {
                                        void queryClient.invalidateQueries({
                                            queryKey: ['breadcrumb', 'hub', metahubId, hubId]
                                        })
                                    }
                                }}
                                onClose={() => setEditDialogOpen(false)}
                            />
                        )
                    })()}
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

const HubList = () => <HubListContent />

export default HubList
