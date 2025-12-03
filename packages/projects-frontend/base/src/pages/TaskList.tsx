import { useState, useMemo, useCallback } from 'react'
import {
    Box,
    Skeleton,
    Stack,
    Typography,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    CircularProgress
} from '@mui/material'
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
    useConfirm
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useUpdateTask, useDeleteTask } from '../hooks/mutations'
import * as TasksApi from '../api/tasks'
import * as MilestonesApi from '../api/milestones'
import { TasksQueryKeys, MilestonesQueryKeys } from '../api/queryKeys'
import { Task, Milestone } from '../types'
import TaskActions from './TaskActions'

// Type for Task update/create data
type TaskData = {
    name: string
    description?: string
}

const TaskList = () => {
    // Use Tasks namespace for view-specific keys
    const { t, i18n } = useTranslation(['projects', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('projectsTaskDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null)

    // Fetch Milestones list for dropdown
    const { data: MilestonesData, isLoading: MilestonesLoading } = useQuery({
        queryKey: MilestonesQueryKeys.list({ limit: 1000, offset: 0 }),
        queryFn: () => MilestonesApi.listMilestones({ limit: 1000, offset: 0 })
    })

    // Use paginated hook for Tasks list
    const paginationResult = usePaginated<Task, 'name' | 'created' | 'updated'>({
        queryKeyFn: TasksQueryKeys.list,
        queryFn: TasksApi.listTasks,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: Tasks, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog (not managed by BaseEntityMenu)
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        Task: Task | null
    }>({ open: false, Task: null })

    const { confirm } = useConfirm()

    const updateTask = useUpdateTask()
    const deleteTask = useDeleteTask()

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(Tasks)) {
            Tasks.forEach((Task) => {
                if (Task?.id) {
                    imagesMap[Task.id] = []
                }
            })
        }
        return imagesMap
    }, [Tasks])

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateTask = async (data: { name: string; description?: string; milestoneId?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            // Validate milestoneId is present
            if (!data.milestoneId) {
                setDialogError(t('Tasks:errors.MilestoneRequired', 'Milestone is required'))
                setCreating(false)
                return
            }

            await TasksApi.createTask({
                name: data.name,
                description: data.description,
                milestoneId: data.milestoneId
            })

            // Invalidate cache to refetch Tasks list
            await queryClient.invalidateQueries({
                queryKey: TasksQueryKeys.lists()
            })

            handleDialogSave()
            setSelectedMilestone(null) // Reset Milestone selection
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('Tasks.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create Task', e)
        } finally {
            setCreating(false)
        }
    }

    const goToTask = (Task: Task) => {
        navigate(`/Tasks/${Task.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('projectsTaskDisplayStyle', nextView)
        setView(nextView)
    }

    const TaskColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                render: (row: Task) => (
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
                width: '60%',
                align: 'left' as const,
                render: (row: Task) => (
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
            }
        ],
        [tc]
    )

    const createTaskContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateTask.mutateAsync({ id, data: patch })
                },
                deleteEntity: async (id: string) => {
                    await deleteTask.mutateAsync(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: TasksQueryKeys.lists()
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
                openDeleteDialog: (Task: Task) => {
                    setDeleteDialogState({ open: true, Task })
                }
            }
        }),
        [confirm, deleteTask, enqueueSnackbar, queryClient, updateTask]
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
                        searchPlaceholder={t('Tasks.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('Tasks.title')}
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

                    {isLoading && Tasks.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && Tasks.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No Tasks' title={t('Tasks.noTasksFound')} />
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
                                    {Tasks.map((Task: Task) => {
                                        // Filter actions based on permissions
                                        const descriptors = TaskActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return Task.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={Task.id}
                                                data={Task}
                                                images={images[Task.id] || []}
                                                onClick={() => goToTask(Task)}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Task, TaskData>
                                                                entity={Task}
                                                                entityKind='task'
                                                                descriptors={descriptors}
                                                                namespace='projects'
                                                                i18nInstance={i18n}
                                                                createContext={createTaskContext}
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
                                        data={Tasks}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Task) => (row?.id ? `/Tasks/${row.id}` : undefined)}
                                        customColumns={TaskColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Task) => {
                                            const descriptors = TaskActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Task, TaskData>
                                                    entity={row}
                                                    entityKind='task'
                                                    descriptors={descriptors}
                                                    namespace='projects'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createTaskContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && Tasks.length > 0 && (
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
                title={t('Tasks.createTask', 'Create Task')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateTask}
                initialExtraValues={{ milestoneId: selectedMilestone?.id || '' }}
                extraFields={({ values, setValue, isLoading }) => (
                    <FormControl fullWidth required error={!values.milestoneId}>
                        <InputLabel>{t('Tasks.MilestoneLabel', 'Milestone')}</InputLabel>
                        <Select
                            value={values.milestoneId || ''}
                            onChange={(e) => {
                                setValue('milestoneId', e.target.value)
                                setSelectedMilestone(MilestonesData?.items?.find((s) => s.id === e.target.value) || null)
                            }}
                            disabled={isLoading || MilestonesLoading}
                            label={t('Tasks.MilestoneLabel', 'Milestone')}
                            endAdornment={MilestonesLoading ? <CircularProgress color='inherit' size={20} sx={{ mr: 2 }} /> : null}
                        >
                            {MilestonesData?.items?.map((Milestone) => (
                                <MenuItem key={Milestone.id} value={Milestone.id}>
                                    {Milestone.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {!values.milestoneId ? t('Tasks.errors.MilestoneRequired', 'Milestone is required') : ''}
                        </FormHelperText>
                    </FormControl>
                )}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('Tasks.confirmDelete')}
                description={t('Tasks.confirmDeleteDescription', { name: deleteDialogState.Task?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, Task: null })}
                onConfirm={async () => {
                    if (deleteDialogState.Task) {
                        try {
                            await deleteTask.mutateAsync(deleteDialogState.Task.id)
                            setDeleteDialogState({ open: false, Task: null })
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
                                    : t('Tasks.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, Task: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default TaskList
