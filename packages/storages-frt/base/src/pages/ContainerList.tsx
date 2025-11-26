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

import { useUpdateContainer, useDeleteContainer } from '../hooks/mutations'
import * as containersApi from '../api/containers'
import { containersQueryKeys } from '../api/queryKeys'
import { Container } from '../types'
import containerActions from './ContainerActions'

// Type for container update/create data
type ContainerData = {
    name: string
    description?: string
}

const ContainerList = () => {
    const navigate = useNavigate()
    const { storageId } = useParams<{ storageId: string }>()
    // Use storages namespace with containers subkey
    const { t, i18n } = useTranslation(['storages', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('slotsContainerDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for containers list
    const paginationResult = usePaginated<Container, 'name' | 'created' | 'updated'>({
        queryKeyFn: containersQueryKeys.list,
        queryFn: containersApi.listContainers,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!storageId
    })

    const { data: containers, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue: _searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        container: Container | null
    }>({ open: false, container: null })

    const { confirm } = useConfirm()

    const updateContainer = useUpdateContainer()
    const deleteContainer = useDeleteContainer()

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(containers)) {
            containers.forEach((container) => {
                if (container?.id) {
                    imagesMap[container.id] = []
                }
            })
        }
        return imagesMap
    }, [containers])

    const containerColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left',
                render: (row: Container) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 500,
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                        }}
                    >
                        {row.name || '—'}
                    </Typography>
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '40%',
                align: 'left',
                render: (row: Container) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                        }}
                    >
                        {row.description || '—'}
                    </Typography>
                )
            },
            {
                id: 'slots',
                label: t('table.slots', 'Slots'),
                width: '20%',
                align: 'center',
                render: (row: Container) => (typeof row.slotsCount === 'number' ? row.slotsCount : '—')
            }
        ],
        [t, tc]
    )

    const createContainerContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateContainer.mutateAsync({ id, data: patch })
                },
                deleteEntity: async (id: string) => {
                    await deleteContainer.mutateAsync(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: containersQueryKeys.lists()
                    })
                },
                confirm: async (spec: any) => {
                    // Support both direct strings and translation keys
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
                // Helper to open ConfirmDeleteDialog independently from BaseEntityMenu
                openDeleteDialog: (container: Container) => {
                    setDeleteDialogState({ open: true, container })
                }
            }
        }),
        [confirm, deleteContainer, enqueueSnackbar, queryClient, updateContainer]
    )

    // Validate storageId from URL AFTER all hooks
    if (!storageId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid storage'
                title={t('storages:errors.invalidStorage')}
                description={t('storages:errors.pleaseSelectStorage')}
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

    const handleCreateContainer = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await containersApi.createContainer({
                name: data.name,
                description: data.description,
                storageId: storageId
            })

            // Invalidate cache to refetch containers list
            await queryClient.invalidateQueries({
                queryKey: containersQueryKeys.lists()
            })

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
                    : t('containers.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create container', e)
        } finally {
            setCreating(false)
        }
    }

    const goToContainer = (container: Container) => {
        navigate(`/containers/${container.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('slotsContainerDisplayStyle', nextView)
        setView(nextView)
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
            {error ? (
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Connection error'
                    title={tc('errors.connectionFailed')}
                    description={!(error as any)?.response?.status ? tc('errors.checkConnection') : tc('errors.pleaseTryLater')}
                    action={{
                        label: tc('actions.retry'),
                        onClick: () => paginationResult.actions.goToPage(1)
                    }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('containers.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('containers.title')}
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

                    {isLoading && containers.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && containers.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No containers' title={t('containers.noContainersFound')} />
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
                                    {containers.map((container: Container) => {
                                        // Filter actions based on permissions
                                        const descriptors = containerActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return container.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={container.id}
                                                data={container}
                                                images={images[container.id] || []}
                                                onClick={() => goToContainer(container)}
                                                footerEndContent={
                                                    typeof container.slotsCount === 'number' ? (
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {t('storages:containers.slotCount', { count: container.slotsCount })}
                                                        </Typography>
                                                    ) : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Container, ContainerData>
                                                                entity={container}
                                                                entityKind='container'
                                                                descriptors={descriptors}
                                                                namespace='storages'
                                                                i18nInstance={i18n}
                                                                createContext={createContainerContext}
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
                                        data={containers}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Container) => (row?.id ? `/containers/${row.id}` : undefined)}
                                        customColumns={containerColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Container) => {
                                            const descriptors = containerActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Container, ContainerData>
                                                    entity={row}
                                                    entityKind='container'
                                                    descriptors={descriptors}
                                                    namespace='storages'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createContainerContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && containers.length > 0 && (
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
                title={t('containers.createContainer', 'Create Container')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateContainer}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('containers.confirmDelete')}
                description={t('containers.confirmDeleteDescription', { name: deleteDialogState.container?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, container: null })}
                onConfirm={async () => {
                    if (deleteDialogState.container) {
                        try {
                            await deleteContainer.mutateAsync(deleteDialogState.container.id)
                            setDeleteDialogState({ open: false, container: null })
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
                                    : t('containers.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, container: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default ContainerList
