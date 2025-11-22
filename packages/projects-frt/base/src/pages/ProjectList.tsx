import { useState, useMemo, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton } from '@mui/material'
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
    useDebouncedSearch,
    PaginationControls,
    FlowListTable,
    gridSpacing,
    ConfirmDialog,
    useConfirm,
    RoleChip
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useApi } from '../hooks/useApi'
import * as ProjectsApi from '../api/projects'
import { ProjectsQueryKeys } from '../api/queryKeys'
import { Project } from '../types'
import ProjectActions from './ProjectActions'

// Type for Project update/create data
type ProjectData = {
    name: string
    description?: string
}

const ProjectList = () => {
    const navigate = useNavigate()
    // Use Projects namespace for view-specific keys, roles and access for role/permission labels
    const { t, i18n } = useTranslation(['projects', 'roles', 'access', 'flowList'])
    // Use common namespace for table headers and common actions (with keyPrefix for cleaner usage)
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('projectsProjectDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for Projects list
    const paginationResult = usePaginated<Project, 'name' | 'created' | 'updated'>({
        queryKeyFn: ProjectsQueryKeys.list,
        queryFn: ProjectsApi.listProjects,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: projects, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog (not managed by BaseEntityMenu)
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        project: Project | null
    }>({ open: false, project: null })

    const { confirm } = useConfirm()

    const updateProjectApi = useApi<Project, [string, { name: string; description?: string }]>(ProjectsApi.updateProject)
    const deleteProjectApi = useApi<void, [string]>(ProjectsApi.deleteProject)

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(projects)) {
            projects.forEach((project) => {
                if (project?.id) {
                    imagesMap[project.id] = []
                }
            })
        }
        return imagesMap
    }, [projects])

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateProject = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await ProjectsApi.createProject({
                name: data.name,
                description: data.description
            })

            // Invalidate cache to refetch Projects list
            await queryClient.invalidateQueries({
                queryKey: ProjectsQueryKeys.lists()
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
            console.error('Failed to create Project', e)
        } finally {
            setCreating(false)
        }
    }

    const goToProject = (project: Project) => {
        navigate(`/project/${project.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('projectsProjectDisplayStyle', nextView)
        setView(nextView)
    }

    const ProjectColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left',
                render: (row: Project) => (
                    <Link to={`/project/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Typography
                            sx={{
                                fontSize: 14,
                                fontWeight: 500,
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
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
                width: '26%',
                align: 'left',
                render: (row: Project) => (
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
                render: (row: Project) => (row.role ? <RoleChip role={row.role} /> : '�')
            },
            {
                id: 'milestones',
                label: t('table.milestones', 'Milestones'),
                width: '10%',
                align: 'center',
                render: (row: Project) => (typeof row.MilestonesCount === 'number' ? row.MilestonesCount : '—')
            },
            {
                id: 'tasks',
                label: t('table.tasks', 'Tasks'),
                width: '10%',
                align: 'center',
                render: (row: Project) => (typeof row.TasksCount === 'number' ? row.TasksCount : '—')
            }
        ],
        [tc]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createProjectContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateProjectApi.request(id, patch)
                    // Invalidate cache after update
                    await queryClient.invalidateQueries({
                        queryKey: ProjectsQueryKeys.lists()
                    })
                },
                deleteEntity: async (id: string) => {
                    await deleteProjectApi.request(id)
                    // Invalidate cache after delete
                    await queryClient.invalidateQueries({
                        queryKey: ProjectsQueryKeys.lists()
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: ProjectsQueryKeys.lists()
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
                openDeleteDialog: (project: Project) => {
                    setDeleteDialogState({ open: true, project })
                }
            }
        }),
        [confirm, deleteProjectApi, enqueueSnackbar, queryClient, updateProjectApi]
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

                    {isLoading && projects.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && projects.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No projects' title={t('noProjectsFound')} />
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
                                    {projects.map((project: Project) => {
                                        // Filter actions based on permissions (same logic as table view)
                                        const descriptors = ProjectActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return project.permissions?.manageProject
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={project.id}
                                                data={project}
                                                images={images[project.id] || []}
                                                onClick={() => goToProject(project)}
                                                footerEndContent={project.role ? <RoleChip role={project.role} /> : null}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Project, ProjectData>
                                                                entity={project}
                                                                entityKind='project'
                                                                descriptors={descriptors}
                                                                namespace='projects'
                                                                i18nInstance={i18n}
                                                                createContext={createProjectContext}
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
                                        data={projects}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Project) => (row?.id ? `/project/${row.id}` : undefined)}
                                        customColumns={ProjectColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Project) => {
                                            const descriptors = ProjectActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.manageProject
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Project, ProjectData>
                                                    entity={row}
                                                    entityKind='project'
                                                    descriptors={descriptors}
                                                    // Use Projects namespace for action item labels (edit/delete)
                                                    // but keep the button label from flowList via explicit namespaced key
                                                    namespace='projects'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createProjectContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && projects.length > 0 && (
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
                title={t('createProject', 'Create Project')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateProject}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('confirmDelete')}
                description={t('confirmDeleteDescription', { name: deleteDialogState.project?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, project: null })}
                onConfirm={async () => {
                    if (deleteDialogState.project) {
                        try {
                            await deleteProjectApi.request(deleteDialogState.project.id)
                            setDeleteDialogState({ open: false, project: null })

                            // Invalidate cache to refetch Projects list
                            await queryClient.invalidateQueries({
                                queryKey: ProjectsQueryKeys.lists()
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
                            setDeleteDialogState({ open: false, project: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default ProjectList
