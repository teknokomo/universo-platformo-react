import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

import { useUpdatePosition, useDeletePosition } from '../hooks/mutations'
import * as positionsApi from '../api/positions'
import * as departmentsApi from '../api/departments'
import { positionsQueryKeys, departmentsQueryKeys } from '../api/queryKeys'
import { Position, Department } from '../types'
import positionActions from './PositionActions'

// Type for position update/create data
type PositionData = {
    name: string
    description?: string
}

const PositionList = () => {
    const navigate = useNavigate()
    // Use positions namespace for view-specific keys
    const { t, i18n } = useTranslation(['organizations', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('organizationsPositionDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)

    // Fetch departments list for dropdown
    const { data: departmentsData, isLoading: departmentsLoading } = useQuery({
        queryKey: departmentsQueryKeys.list({ limit: 1000, offset: 0 }),
        queryFn: () => departmentsApi.listDepartments({ limit: 1000, offset: 0 })
    })

    // Use paginated hook for positions list
    const paginationResult = usePaginated<Position, 'name' | 'created' | 'updated'>({
        queryKeyFn: positionsQueryKeys.list,
        queryFn: positionsApi.listPositions,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: positions, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // DEBUG: Log pagination state changes for troubleshooting
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('[PositionList Pagination Debug]', {
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
        position: Position | null
    }>({ open: false, position: null })

    const { confirm } = useConfirm()

    const updatePosition = useUpdatePosition()
    const deletePosition = useDeletePosition()

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(positions)) {
            positions.forEach((position) => {
                if (position?.id) {
                    imagesMap[position.id] = []
                }
            })
        }
        return imagesMap
    }, [positions])

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreatePosition = async (data: { name: string; description?: string; departmentId?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            // Validate departmentId is present
            if (!data.departmentId) {
                setDialogError(t('positions:errors.departmentRequired', 'Department is required'))
                setCreating(false)
                return
            }

            await positionsApi.createPosition({
                name: data.name,
                description: data.description,
                departmentId: data.departmentId
            })

            // Invalidate cache to refetch positions list
            await queryClient.invalidateQueries({
                queryKey: positionsQueryKeys.lists()
            })

            handleDialogSave()
            setSelectedDepartment(null) // Reset department selection
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('positions.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create position', e)
        } finally {
            setCreating(false)
        }
    }

    const goToPosition = (position: Position) => {
        navigate(`/positions/${position.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('organizationsPositionDisplayStyle', nextView)
        setView(nextView)
    }

    const positionColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                render: (row: Position) => (
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
                render: (row: Position) => (
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

    const createPositionContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updatePosition.mutateAsync({ id, data: patch })
                },
                deleteEntity: async (id: string) => {
                    await deletePosition.mutateAsync(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: positionsQueryKeys.lists()
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
                openDeleteDialog: (position: Position) => {
                    setDeleteDialogState({ open: true, position })
                }
            }
        }),
        [confirm, deletePosition, enqueueSnackbar, queryClient, updatePosition]
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
                        searchPlaceholder={t('positions.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('positions.title')}
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

                    {isLoading && positions.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && positions.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No positions' title={t('positions.noPositionsFound')} />
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
                                    {positions.map((position: Position) => {
                                        // Filter actions based on permissions
                                        const descriptors = positionActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return position.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={position.id}
                                                data={position}
                                                images={images[position.id] || []}
                                                onClick={() => goToPosition(position)}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Position, PositionData>
                                                                entity={position}
                                                                entityKind='position'
                                                                descriptors={descriptors}
                                                                namespace='organizations'
                                                                i18nInstance={i18n}
                                                                createContext={createPositionContext}
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
                                        data={positions}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Position) => (row?.id ? `/positions/${row.id}` : undefined)}
                                        customColumns={positionColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Position) => {
                                            const descriptors = positionActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Position, PositionData>
                                                    entity={row}
                                                    entityKind='position'
                                                    descriptors={descriptors}
                                                    namespace='organizations'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createPositionContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && positions.length > 0 && (
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
                title={t('positions.createPosition', 'Create Position')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreatePosition}
                initialExtraValues={{ departmentId: selectedDepartment?.id || '' }}
                extraFields={({ values, setValue, isLoading }) => (
                    <FormControl fullWidth required error={!values.departmentId}>
                        <InputLabel>{t('positions.departmentLabel', 'Department')}</InputLabel>
                        <Select
                            value={values.departmentId || ''}
                            onChange={(e) => {
                                setValue('departmentId', e.target.value)
                                setSelectedDepartment(departmentsData?.items?.find((s) => s.id === e.target.value) || null)
                            }}
                            disabled={isLoading || departmentsLoading}
                            label={t('positions.departmentLabel', 'Department')}
                            endAdornment={departmentsLoading ? <CircularProgress color='inherit' size={20} sx={{ mr: 2 }} /> : null}
                        >
                            {departmentsData?.items?.map((department) => (
                                <MenuItem key={department.id} value={department.id}>
                                    {department.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {!values.departmentId ? t('positions.errors.departmentRequired', 'Department is required') : ''}
                        </FormHelperText>
                    </FormControl>
                )}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('positions.confirmDelete')}
                description={t('positions.confirmDeleteDescription', { name: deleteDialogState.position?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, position: null })}
                onConfirm={async () => {
                    if (deleteDialogState.position) {
                        try {
                            await deletePosition.mutateAsync(deleteDialogState.position.id)
                            setDeleteDialogState({ open: false, position: null })
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
                                    : t('positions.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, position: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default PositionList
