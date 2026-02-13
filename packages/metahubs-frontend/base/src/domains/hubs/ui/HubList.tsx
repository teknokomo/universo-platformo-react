import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton, Divider } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
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
    useCodenameAutoFill
} from '@universo/template-mui'
import { EntityFormDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useCreateHub, useUpdateHub, useDeleteHub } from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as hubsApi from '../api'
import { metahubsQueryKeys, invalidateHubsQueries } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { Hub, HubDisplay, HubLocalizedPayload, getVLCString, toHubDisplay } from '../../../types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField, HubDeleteDialog } from '../../../components'
import hubActions from './HubActions'

type HubFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
}

type HubFormFieldsProps = {
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
    const navigate = useNavigate()
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.HUB_DISPLAY_STYLE)

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for hubs list
    const paginationResult = usePaginated<Hub, 'codename' | 'created' | 'updated'>({
        queryKeyFn: metahubId ? (params) => metahubsQueryKeys.hubsList(metahubId, params) : () => ['empty'],
        queryFn: metahubId
            ? (params) => hubsApi.listHubs(metahubId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!metahubId
    })

    const { data: hubs, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    // Instant search for better UX
    const { searchValue, handleSearchChange } = useDebouncedSearch({
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

    const createHubMutation = useCreateHub()
    const updateHubMutation = useUpdateHub()
    const deleteHubMutation = useDeleteHub()

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(hubs)) {
            hubs.forEach((hub) => {
                if (hub?.id) {
                    imagesMap[hub.id] = []
                }
            })
        }
        return imagesMap
    }, [hubs])

    const hubMap = useMemo(() => {
        if (!Array.isArray(hubs)) return new Map<string, Hub>()
        return new Map(hubs.map((hub) => [hub.id, hub]))
    }, [hubs])

    const localizedFormDefaults = useMemo<HubFormValues>(
        () => ({ nameVlc: null, descriptionVlc: null, codename: '', codenameTouched: false }),
        []
    )

    const validateHubForm = useCallback(
        (values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = sanitizeCodename(rawCodename)
            if (!normalizedCodename) {
                errors.codename = t('hubs.validation.codenameRequired', 'Codename is required')
            } else if (!isValidCodename(normalizedCodename)) {
                errors.codename = t('hubs.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [t, tc]
    )

    const canSaveHubForm = useCallback((values: Record<string, any>) => {
        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = typeof values.codename === 'string' ? values.codename : ''
        const normalizedCodename = sanitizeCodename(rawCodename)
        return hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
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
                <HubFormFields
                    values={values}
                    setValue={setValue}
                    isLoading={isLoading}
                    errors={fieldErrors}
                    uiLocale={i18n.language}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    codenameLabel={t('hubs.codename', 'Codename')}
                    codenameHelper={t('hubs.codenameHelper', 'Unique identifier')}
                />
            )
        },
        [i18n.language, t, tc]
    )

    const hubColumns = useMemo(
        () => [
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
                id: 'catalogsCount',
                label: t('catalogs.title', 'Catalogs'),
                width: '10%',
                align: 'center' as const,
                render: (row: HubDisplay) => (typeof row.catalogsCount === 'number' ? row.catalogsCount : '—')
            }
        ],
        [t, tc, metahubId]
    )

    const createHubContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            hubMap,
            uiLocale: i18n.language,
            api: {
                updateEntity: async (id: string, patch: HubLocalizedPayload) => {
                    if (!metahubId) return
                    const normalizedCodename = sanitizeCodename(patch.codename)
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
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId) {
                        await invalidateHubsQueries.all(queryClient, metahubId)
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
                openDeleteDialog: (hubOrDisplay: Hub | HubDisplay) => {
                    // Handle both Hub and HubDisplay (from BaseEntityMenu context)
                    const hub = 'metahubId' in hubOrDisplay ? hubOrDisplay : hubMap.get(hubOrDisplay.id)
                    if (hub) {
                        setDeleteDialogState({ open: true, hub })
                    }
                }
            }
        }),
        [confirm, deleteHubMutation, enqueueSnackbar, hubMap, i18n.language, metahubId, queryClient, t, updateHubMutation]
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

    const handleCreateHub = async (data: Record<string, any>) => {
        setDialogError(null)
        setCreating(true)
        try {
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
                setDialogError(t('hubs.validation.codenameRequired', 'Codename is required'))
                return
            }

            await createHubMutation.mutateAsync({
                metahubId,
                data: {
                    codename: normalizedCodename,
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale
                }
            })

            await invalidateHubsQueries.all(queryClient, metahubId)
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

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
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

                    {isLoading && hubs.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && hubs.length === 0 ? (
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
                                    {hubs.map((hub: Hub) => {
                                        const descriptors = [...hubActions]

                                        return (
                                            <ItemCard
                                                key={hub.id}
                                                data={getHubCardData(hub)}
                                                images={images[hub.id] || []}
                                                onClick={() => goToHub(hub)}
                                                footerEndContent={
                                                    typeof hub.catalogsCount === 'number' ? (
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {t('hubs.catalogsCount', { count: hub.catalogsCount })}
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
                                        data={hubs.map(getHubCardData)}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: any) => (row?.id ? `/metahub/${metahubId}/hub/${row.id}/catalogs` : undefined)}
                                        customColumns={hubColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: any) => {
                                            const originalHub = hubs.find((h) => h.id === row.id)
                                            if (!originalHub) return null

                                            const descriptors = [...hubActions]
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
                    {!isLoading && hubs.length > 0 && (
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
                        const responseMessage =
                            err && typeof err === 'object' && 'response' in err ? (err as any)?.response?.data?.message : undefined
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
        </MainCard>
    )
}

export default HubList
