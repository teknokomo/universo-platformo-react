import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton } from '@mui/material'
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
    useConfirm
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useCreateHub, useUpdateHub, useDeleteHub } from '../hooks/mutations'
import * as hubsApi from '../api/hubs'
import { metahubsQueryKeys, invalidateHubsQueries } from '../api/queryKeys'
import { Hub, HubDisplay, toHubDisplay } from '../types'
import hubActions from './HubActions'

// Type for hub create/update data
type HubData = {
    codename: string
    name?: { en?: string; ru?: string }
    description?: { en?: string; ru?: string }
}

const HubList = () => {
    const navigate = useNavigate()
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('metahubsHubDisplayStyle') || 'card')

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

    const hubColumns = useMemo(
        () => [
            {
                id: 'codename',
                label: t('hubs.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
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
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '25%',
                align: 'left' as const,
                render: (row: HubDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 500,
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.name || '—'}
                    </Typography>
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '30%',
                align: 'left' as const,
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
                id: 'attributesCount',
                label: t('hubs.attributesCount', 'Attributes'),
                width: '10%',
                align: 'center' as const,
                render: (row: HubDisplay) => (typeof row.attributesCount === 'number' ? row.attributesCount : '—')
            },
            {
                id: 'recordsCount',
                label: t('hubs.recordsCount', 'Records'),
                width: '10%',
                align: 'center' as const,
                render: (row: HubDisplay) => (typeof row.recordsCount === 'number' ? row.recordsCount : '—')
            }
        ],
        [t, tc]
    )

    const createHubContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: { name?: string; description?: string }) => {
                    if (!metahubId) return
                    // Transform flat name/description to localized structure with current language
                    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
                    const localizedPatch: {
                        name?: { [key: string]: string }
                        description?: { [key: string]: string }
                    } = {}
                    if (patch.name) {
                        localizedPatch.name = { [currentLang]: patch.name }
                    }
                    if (patch.description !== undefined) {
                        localizedPatch.description = { [currentLang]: patch.description }
                    }
                    await updateHubMutation.mutateAsync({ metahubId, hubId: id, data: localizedPatch })
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
                openDeleteDialog: (hub: Hub) => {
                    setDeleteDialogState({ open: true, hub })
                }
            }
        }),
        [confirm, deleteHubMutation, enqueueSnackbar, metahubId, queryClient, updateHubMutation]
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

    const handleCreateHub = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            // Use current UI language for localized content
            const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
            
            // Transform flat name/description to localized structure with current language
            await createHubMutation.mutateAsync({
                metahubId,
                data: {
                    codename: data.name.toLowerCase().replace(/\s+/g, '_'),
                    name: { [currentLang]: data.name },
                    description: data.description ? { [currentLang]: data.description } : undefined
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
        navigate(`/metahub/${metahubId}/hubs/${hub.id}/attributes`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('metahubsHubDisplayStyle', nextView)
        setView(nextView)
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
                                label: tc('addNew'),
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
                                                    typeof hub.attributesCount === 'number' ? (
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {hub.attributesCount} {t('hubs.attributesCount', 'Attributes')}
                                                        </Typography>
                                                    ) : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<HubDisplay, HubData>
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
                                        getRowLink={(row: any) => (row?.id ? `/metahub/${metahubId}/hubs/${row.id}/attributes` : undefined)}
                                        customColumns={hubColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: any) => {
                                            const originalHub = hubs.find((h) => h.id === row.id)
                                            if (!originalHub) return null

                                            const descriptors = [...hubActions]
                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<HubDisplay, HubData>
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
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateHub}
            />

            {/* Independent ConfirmDeleteDialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('hubs.deleteDialog.title')}
                description={t('hubs.deleteDialog.message')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, hub: null })}
                onConfirm={async () => {
                    if (deleteDialogState.hub) {
                        try {
                            await deleteHubMutation.mutateAsync({
                                metahubId,
                                hubId: deleteDialogState.hub.id
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
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default HubList
