import { useState, useMemo, useCallback, useEffect } from 'react'
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

import { useUpdateDepartment, useDeleteDepartment } from '../hooks/mutations'
import * as departmentsApi from '../api/departments'
import { departmentsQueryKeys } from '../api/queryKeys'
import { Department } from '../types'
import departmentActions from './DepartmentActions'

// Type for department update/create data
type DepartmentData = {
    name: string
    description?: string
}

const DepartmentList = () => {
    const navigate = useNavigate()
    const { organizationId } = useParams<{ organizationId: string }>()
    // Use organizations namespace with departments subkey
    const { t, i18n } = useTranslation(['organizations', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('organizationsDepartmentDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for departments list
    const paginationResult = usePaginated<Department, 'name' | 'created' | 'updated'>({
        queryKeyFn: departmentsQueryKeys.list,
        queryFn: departmentsApi.listDepartments,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!organizationId
    })

    const { data: departments, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // DEBUG: Log pagination state changes for troubleshooting
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('[DepartmentList Pagination Debug]', {
            currentPage: paginationResult.pagination.currentPage,
            pageSize: paginationResult.pagination.pageSize,
            totalItems: paginationResult.pagination.totalItems,
            totalPages: paginationResult.pagination.totalPages,
            offset: (paginationResult.pagination.currentPage - 1) * paginationResult.pagination.pageSize,
            search: paginationResult.pagination.search,
            isLoading: paginationResult.isLoading,
            searchValue
        })
    }, [
        paginationResult.pagination.currentPage,
        paginationResult.pagination.pageSize,
        paginationResult.pagination.totalItems,
        paginationResult.pagination.totalPages,
        paginationResult.pagination.search,
        paginationResult.isLoading,
        searchValue
    ])

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        department: Department | null
    }>({ open: false, department: null })

    const { confirm } = useConfirm()

    const updateDepartment = useUpdateDepartment()
    const deleteDepartment = useDeleteDepartment()

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(departments)) {
            departments.forEach((department) => {
                if (department?.id) {
                    imagesMap[department.id] = []
                }
            })
        }
        return imagesMap
    }, [departments])

    const departmentColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left',
                render: (row: Department) => (
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
                render: (row: Department) => (
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
                id: 'positions',
                label: tc('table.positions', 'Positions'),
                width: '20%',
                align: 'center',
                render: (row: Department) => (typeof row.positionsCount === 'number' ? row.positionsCount : '—')
            }
        ],
        [tc]
    )

    const createDepartmentContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateDepartment.mutateAsync({ id, data: patch })
                },
                deleteEntity: async (id: string) => {
                    await deleteDepartment.mutateAsync(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: departmentsQueryKeys.lists()
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
                openDeleteDialog: (department: Department) => {
                    setDeleteDialogState({ open: true, department })
                }
            }
        }),
        [confirm, deleteDepartment, enqueueSnackbar, queryClient, updateDepartment]
    )

    // Validate organizationId from URL AFTER all hooks
    if (!organizationId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid organization'
                title={t('organizations:errors.invalidOrganization')}
                description={t('organizations:errors.pleaseSelectOrganization')}
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

    const handleCreateDepartment = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await departmentsApi.createDepartment({
                name: data.name,
                description: data.description,
                organizationId: organizationId
            })

            // Invalidate cache to refetch departments list
            await queryClient.invalidateQueries({
                queryKey: departmentsQueryKeys.lists()
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
                    : t('departments.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create department', e)
        } finally {
            setCreating(false)
        }
    }

    const goToDepartment = (department: Department) => {
        navigate(`/departments/${department.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('organizationsDepartmentDisplayStyle', nextView)
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
                        searchPlaceholder={t('departments.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('departments.title')}
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

                    {isLoading && departments.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && departments.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No departments' title={t('departments.noDepartmentsFound')} />
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
                                    {departments.map((department: Department) => {
                                        // Filter actions based on permissions
                                        const descriptors = departmentActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return department.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={department.id}
                                                data={department}
                                                images={images[department.id] || []}
                                                onClick={() => goToDepartment(department)}
                                                footerEndContent={
                                                    typeof department.positionsCount === 'number' ? (
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {t('organizations:departments.positionCount', {
                                                                count: department.positionsCount
                                                            })}
                                                        </Typography>
                                                    ) : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Department, DepartmentData>
                                                                entity={department}
                                                                entityKind='department'
                                                                descriptors={descriptors}
                                                                namespace='organizations'
                                                                i18nInstance={i18n}
                                                                createContext={createDepartmentContext}
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
                                        data={departments}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Department) => (row?.id ? `/departments/${row.id}` : undefined)}
                                        customColumns={departmentColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Department) => {
                                            const descriptors = departmentActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Department, DepartmentData>
                                                    entity={row}
                                                    entityKind='department'
                                                    descriptors={descriptors}
                                                    namespace='organizations'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createDepartmentContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && departments.length > 0 && (
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
                title={t('departments.createDepartment', 'Create Department')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateDepartment}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('departments.confirmDelete')}
                description={t('departments.confirmDeleteDescription', { name: deleteDialogState.department?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, department: null })}
                onConfirm={async () => {
                    if (deleteDialogState.department) {
                        try {
                            await deleteDepartment.mutateAsync(deleteDialogState.department.id)
                            setDeleteDialogState({ open: false, department: null })
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
                                    : t('departments.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, department: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default DepartmentList
