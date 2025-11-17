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

import { useApi } from '../hooks/useApi'
import * as MilestonesApi from '../api/milestones'
import { MilestonesQueryKeys } from '../api/queryKeys'
import { Milestone } from '../types'
import MilestoneActions from './MilestoneActions'

// Type for Milestone update/create data
type MilestoneData = {
    name: string
    description?: string
}

const MilestoneList = () => {
    const navigate = useNavigate()
    const { projectId } = useParams<{ projectId: string }>()
    // Use Projects namespace with Milestones subkey
    const { t, i18n } = useTranslation(['projects', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('projectsMilestoneDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for Milestones list
    const paginationResult = usePaginated<Milestone, 'name' | 'created' | 'updated'>({
        queryKeyFn: MilestonesQueryKeys.list,
        queryFn: MilestonesApi.listMilestones,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!projectId
    })

    const { data: Milestones, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        Milestone: Milestone | null
    }>({ open: false, Milestone: null })

    const { confirm } = useConfirm()

    const updateMilestoneApi = useApi<Milestone, [string, { name: string; description?: string }]>(MilestonesApi.updateMilestone)
    const deleteMilestoneApi = useApi<void, [string]>(MilestonesApi.deleteMilestone)

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(Milestones)) {
            Milestones.forEach((Milestone) => {
                if (Milestone?.id) {
                    imagesMap[Milestone.id] = []
                }
            })
        }
        return imagesMap
    }, [Milestones])

    const MilestoneColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left',
                render: (row: Milestone) => (
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
                width: '50%',
                align: 'left',
                render: (row: Milestone) => (
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
                id: 'Tasks',
                label: tc('table.Tasks', 'Tasks'),
                width: '20%',
                align: 'center',
                render: (row: Milestone) => (typeof row.TasksCount === 'number' ? row.TasksCount : '—')
            }
        ],
        [tc]
    )

    const createMilestoneContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateMilestoneApi.request(id, patch)
                    // Invalidate cache after update
                    await queryClient.invalidateQueries({
                        queryKey: MilestonesQueryKeys.lists()
                    })
                },
                deleteEntity: async (id: string) => {
                    await deleteMilestoneApi.request(id)
                    // Invalidate cache after delete
                    await queryClient.invalidateQueries({
                        queryKey: MilestonesQueryKeys.lists()
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: MilestonesQueryKeys.lists()
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
                openDeleteDialog: (Milestone: Milestone) => {
                    setDeleteDialogState({ open: true, Milestone })
                }
            }
        }),
        [confirm, deleteMilestoneApi, enqueueSnackbar, queryClient, updateMilestoneApi]
    )

    // Validate projectId from URL AFTER all hooks
    if (!projectId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid Project'
                title={t('Projects:errors.invalidProject')}
                description={t('Projects:errors.pleaseSelectProject')}
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

    const handleCreateMilestone = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await MilestonesApi.createMilestone({
                name: data.name,
                description: data.description,
                projectId: projectId
            })

            // Invalidate cache to refetch Milestones list
            await queryClient.invalidateQueries({
                queryKey: MilestonesQueryKeys.lists()
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
                    : t('Milestones.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create Milestone', e)
        } finally {
            setCreating(false)
        }
    }

    const goToMilestone = (Milestone: Milestone) => {
        navigate(`/Milestones/${Milestone.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('projectsMilestoneDisplayStyle', nextView)
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
                        searchPlaceholder={t('Milestones.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('Milestones.title')}
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

                    {isLoading && Milestones.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && Milestones.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No Milestones' title={t('Milestones.noMilestonesFound')} />
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
                                    {Milestones.map((Milestone: Milestone) => {
                                        // Filter actions based on permissions
                                        const descriptors = MilestoneActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return Milestone.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={Milestone.id}
                                                data={Milestone}
                                                images={images[Milestone.id] || []}
                                                onClick={() => goToMilestone(Milestone)}
                                                footerEndContent={
                                                    typeof Milestone.TasksCount === 'number' ? (
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {t('projects:Milestones.TaskCount', { count: Milestone.TasksCount })}
                                                        </Typography>
                                                    ) : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Milestone, MilestoneData>
                                                                entity={Milestone}
                                                                entityKind='milestone'
                                                                descriptors={descriptors}
                                                                namespace='projects'
                                                                i18nInstance={i18n}
                                                                createContext={createMilestoneContext}
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
                                        data={Milestones}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Milestone) => (row?.id ? `/Milestones/${row.id}` : undefined)}
                                        customColumns={MilestoneColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Milestone) => {
                                            const descriptors = MilestoneActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Milestone, MilestoneData>
                                                    entity={row}
                                                    entityKind='milestone'
                                                    descriptors={descriptors}
                                                    namespace='projects'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createMilestoneContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && Milestones.length > 0 && (
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
                title={t('Milestones.createMilestone', 'Create Milestone')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateMilestone}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('Milestones.confirmDelete')}
                description={t('Milestones.confirmDeleteDescription', { name: deleteDialogState.Milestone?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, Milestone: null })}
                onConfirm={async () => {
                    if (deleteDialogState.Milestone) {
                        try {
                            await deleteMilestoneApi.request(deleteDialogState.Milestone.id)
                            setDeleteDialogState({ open: false, Milestone: null })

                            // Invalidate cache to refetch Milestones list
                            await queryClient.invalidateQueries({
                                queryKey: MilestonesQueryKeys.lists()
                            })

                            enqueueSnackbar(t('Milestones.deleteSuccess'), { variant: 'success' })
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
                                    : t('Milestones.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, Milestone: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default MilestoneList
