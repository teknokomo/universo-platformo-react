import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, Chip, Typography, IconButton } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

// project imports
// Use the new template-mui ItemCard (JS component) for consistency with Uniks
import {
    TemplateMainCard as MainCard,
    ItemCard,
    ToolbarControls,
    EmptyListState,
    SkeletonGrid,
    APIEmptySVG,
    usePaginated,
    TablePaginationControls,
    FlowListTable,
    gridSpacing,
    ErrorBoundary,
    ConfirmDialog,
    useConfirm
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useApi } from '../hooks/useApi'
import * as metaversesApi from '../api/metaverses'
import { metaversesQueryKeys } from '../api/queryKeys'
import { Metaverse, MetaverseRole } from '../types'
import metaverseActions from './MetaverseActions'

// Type for metaverse update/create data
type MetaverseData = {
    name: string
    description?: string
}

const MetaverseList = () => {
    const navigate = useNavigate()
    // Use metaverses namespace for view-specific keys, roles and access for role/permission labels
    const { t, i18n } = useTranslation(['metaverses', 'roles', 'access', 'flowList'])
    // Use common namespace for table headers and common actions (with keyPrefix for cleaner usage)
    const { t: tc } = useCommonTranslations()
    
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('entitiesMetaverseDisplayStyle') || 'card')

    // Local search state for debounce synchronization with usePaginated
    const [localSearch, setLocalSearch] = useState('')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for metaverses list
    const paginationResult = usePaginated<Metaverse, 'name' | 'created' | 'updated'>({
        queryKeyFn: metaversesQueryKeys.list,
        queryFn: metaversesApi.listMetaverses,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: metaverses, isLoading, error } = paginationResult

    // Debounce effect for search synchronization with usePaginated
    useEffect(() => {
        const timer = setTimeout(() => {
            paginationResult.actions.setSearch(localSearch)
        }, 300) // 300ms debounce

        return () => clearTimeout(timer)
    }, [localSearch, paginationResult.actions])

    // State for independent ConfirmDeleteDialog (not managed by BaseEntityMenu)
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        metaverse: Metaverse | null
    }>({ open: false, metaverse: null })

    const { confirm } = useConfirm()

    const updateMetaverseApi = useApi<Metaverse, [string, { name: string; description?: string }]>(metaversesApi.updateMetaverse)
    const deleteMetaverseApi = useApi<void, [string]>(metaversesApi.deleteMetaverse)

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(metaverses)) {
            metaverses.forEach((metaverse) => {
                if (metaverse?.id) {
                    imagesMap[metaverse.id] = []
                }
            })
        }
        return imagesMap
    }, [metaverses])

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateMetaverse = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await metaversesApi.createMetaverse({
                name: data.name,
                description: data.description
            })

            // Invalidate cache to refetch metaverses list
            await queryClient.invalidateQueries({
                queryKey: metaversesQueryKeys.lists()
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
                    : t('errors.saveFailed')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create metaverse', e)
        } finally {
            setCreating(false)
        }
    }

    const goToMetaverse = (metaverse: any) => {
        navigate(`/metaverses/${metaverse.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('entitiesMetaverseDisplayStyle', nextView)
        setView(nextView)
    }

    // Handler for ViewHeader search input
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setLocalSearch(e.target.value)
    }, [])

    const getErrorText = useCallback(
        (err: unknown) => {
            if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
                return (err as any).message as string
            }
            if (typeof err === 'string') {
                return err
            }
            return t('error')
        },
        [t]
    )

    const roleLabel = useCallback((role?: MetaverseRole) => (role ? t(`roles:${role}`) : '—'), [t])

    const metaverseColumns = useMemo(
        () => [
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '26%',
                align: 'left',
                render: (row: Metaverse) => (
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
                id: 'role',
                label: tc('table.role', 'Role'),
                width: '10%',
                align: 'center',
                render: (row: Metaverse) => roleLabel(row.role)
            },
            {
                id: 'sections',
                label: tc('table.sections', 'Sections'),
                width: '10%',
                align: 'center',
                render: (row: Metaverse) => (typeof row.sectionsCount === 'number' ? row.sectionsCount : '—')
            },
            {
                id: 'entities',
                label: tc('table.entities', 'Entities'),
                width: '10%',
                align: 'center',
                render: (row: Metaverse) => (typeof row.entitiesCount === 'number' ? row.entitiesCount : '—')
            }
        ],
        [roleLabel, tc]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createMetaverseContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateMetaverseApi.request(id, patch)
                    // Invalidate cache after update
                    await queryClient.invalidateQueries({
                        queryKey: metaversesQueryKeys.lists()
                    })
                },
                deleteEntity: async (id: string) => {
                    await deleteMetaverseApi.request(id)
                    // Invalidate cache after delete
                    await queryClient.invalidateQueries({
                        queryKey: metaversesQueryKeys.lists()
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: metaversesQueryKeys.lists()
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
                openDeleteDialog: (metaverse: Metaverse) => {
                    setDeleteDialogState({ open: true, metaverse })
                }
            }
        }),
        [confirm, deleteMetaverseApi, enqueueSnackbar, queryClient, updateMetaverseApi]
    )

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
                <ErrorBoundary>
                    <div>Error: {getErrorText(error)}</div>
                </ErrorBoundary>
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('title')}
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

                    {isLoading && metaverses.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && metaverses.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No metaverses' title={t('noMetaversesFound')} />
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
                                    {metaverses.map((metaverse: Metaverse) => {
                                        // Filter actions based on permissions (same logic as table view)
                                        const descriptors = metaverseActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return metaverse.permissions?.manageMetaverse
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={metaverse.id}
                                                data={metaverse}
                                                images={images[metaverse.id] || []}
                                                onClick={() => goToMetaverse(metaverse)}
                                                footerEndContent={
                                                    metaverse.role ? (
                                                        <Chip
                                                            size='small'
                                                            variant='outlined'
                                                            color='primary'
                                                            label={roleLabel(metaverse.role)}
                                                            sx={{ pointerEvents: 'none' }}
                                                        />
                                                    ) : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Metaverse, MetaverseData>
                                                                entity={metaverse}
                                                                entityKind='metaverse'
                                                                descriptors={descriptors}
                                                                namespace='metaverses'
                                                                i18nInstance={i18n}
                                                                createContext={createMetaverseContext}
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
                                        data={metaverses}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Metaverse) => (row?.id ? `/metaverses/${row.id}` : undefined)}
                                        customColumns={metaverseColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Metaverse) => {
                                            const descriptors = metaverseActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.manageMetaverse
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Metaverse, MetaverseData>
                                                    entity={row}
                                                    entityKind='metaverse'
                                                    descriptors={descriptors}
                                                    // Use metaverses namespace for action item labels (edit/delete)
                                                    // but keep the button label from flowList via explicit namespaced key
                                                    namespace='metaverses'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createMetaverseContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && metaverses.length > 0 && (
                        <TablePaginationControls
                            pagination={paginationResult.pagination}
                            actions={paginationResult.actions}
                            isLoading={paginationResult.isLoading}
                            rowsPerPageOptions={[10, 20, 50, 100]}
                            namespace='common'
                        />
                    )}
                </Stack>
            )}

            <EntityFormDialog
                open={isDialogOpen}
                title={t('createMetaverse', 'Create Metaverse')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateMetaverse}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('confirmDelete')}
                description={t('confirmDeleteDescription', { name: deleteDialogState.metaverse?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, metaverse: null })}
                onConfirm={async () => {
                    if (deleteDialogState.metaverse) {
                        try {
                            await deleteMetaverseApi.request(deleteDialogState.metaverse.id)
                            setDeleteDialogState({ open: false, metaverse: null })

                            // Invalidate cache to refetch metaverses list
                            await queryClient.invalidateQueries({
                                queryKey: metaversesQueryKeys.lists()
                            })

                            enqueueSnackbar(t('deleteSuccess'), { variant: 'success' })
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
                                    : t('deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, metaverse: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default MetaverseList
