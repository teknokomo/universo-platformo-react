import { useState, useMemo, useCallback, useEffect } from 'react'
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

import { useApi } from '../hooks/useApi'
import * as activitiesApi from '../api/activities'
import * as eventsApi from '../api/events'
import { activitiesQueryKeys, eventsQueryKeys } from '../api/queryKeys'
import { Activity, Event } from '../types'
import activityActions from './ActivityActions'

// Type for activity update/create data
type ActivityData = {
    name: string
    description?: string
}

const ActivityList = () => {
    // Use activities namespace for view-specific keys
    const { t, i18n } = useTranslation(['campaigns', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('activitiesActivityDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

    // Fetch events list for dropdown
    const { data: eventsData, isLoading: eventsLoading } = useQuery({
        queryKey: eventsQueryKeys.list({ limit: 1000, offset: 0 }),
        queryFn: () => eventsApi.listEvents({ limit: 1000, offset: 0 })
    })

    // Use paginated hook for activities list
    const paginationResult = usePaginated<Activity, 'name' | 'created' | 'updated'>({
        queryKeyFn: activitiesQueryKeys.list,
        queryFn: activitiesApi.listActivities,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: activities, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // DEBUG: Log pagination state changes for troubleshooting
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('[ActivityList Pagination Debug]', {
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
        activity: Activity | null
    }>({ open: false, activity: null })

    const { confirm } = useConfirm()

    const updateActivityApi = useApi<Activity, [string, { name: string; description?: string }]>(activitiesApi.updateActivity)
    const deleteActivityApi = useApi<void, [string]>(activitiesApi.deleteActivity)

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(activities)) {
            activities.forEach((activity) => {
                if (activity?.id) {
                    imagesMap[activity.id] = []
                }
            })
        }
        return imagesMap
    }, [activities])

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateActivity = async (data: { name: string; description?: string; eventId?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            // Validate eventId is present
            if (!data.eventId) {
                setDialogError(t('activities:errors.eventRequired', 'Event is required'))
                setCreating(false)
                return
            }

            await activitiesApi.createActivity({
                name: data.name,
                description: data.description,
                eventId: data.eventId
            })

            // Invalidate cache to refetch activities list
            await queryClient.invalidateQueries({
                queryKey: activitiesQueryKeys.lists()
            })

            handleDialogSave()
            setSelectedEvent(null) // Reset event selection
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('activities.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create activity', e)
        } finally {
            setCreating(false)
        }
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('activitiesActivityDisplayStyle', nextView)
        setView(nextView)
    }

    const activityColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                render: (row: Activity) => (
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
                render: (row: Activity) => (
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

    const createActivityContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateActivityApi.request(id, patch)
                    // Invalidate cache after update
                    await queryClient.invalidateQueries({
                        queryKey: activitiesQueryKeys.lists()
                    })
                },
                deleteEntity: async (id: string) => {
                    await deleteActivityApi.request(id)
                    // Invalidate cache after delete
                    await queryClient.invalidateQueries({
                        queryKey: activitiesQueryKeys.lists()
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: activitiesQueryKeys.lists()
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
                openDeleteDialog: (activity: Activity) => {
                    setDeleteDialogState({ open: true, activity })
                }
            }
        }),
        [confirm, deleteActivityApi, enqueueSnackbar, queryClient, updateActivityApi]
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
                        searchPlaceholder={t('activities.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('activities.title')}
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

                    {isLoading && activities.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && activities.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No activities' title={t('activities.noActivitiesFound')} />
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
                                    {activities.map((activity: Activity) => {
                                        // Filter actions based on permissions
                                        const descriptors = activityActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return activity.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={activity.id}
                                                data={activity}
                                                images={images[activity.id] || []}
                                                href={`/activity/${activity.id}`}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Activity, ActivityData>
                                                                entity={activity}
                                                                entityKind='activity'
                                                                descriptors={descriptors}
                                                                namespace='campaigns'
                                                                i18nInstance={i18n}
                                                                createContext={createActivityContext}
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
                                        data={activities}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Activity) => (row?.id ? `/activity/${row.id}` : undefined)}
                                        customColumns={activityColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Activity) => {
                                            const descriptors = activityActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Activity, ActivityData>
                                                    entity={row}
                                                    entityKind='activity'
                                                    descriptors={descriptors}
                                                    namespace='campaigns'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createActivityContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && activities.length > 0 && (
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
                title={t('activities.createActivity', 'Create Activity')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateActivity}
                initialExtraValues={{ eventId: selectedEvent?.id || '' }}
                extraFields={({ values, setValue, isLoading }) => (
                    <FormControl fullWidth required error={!values.eventId}>
                        <InputLabel>{t('activities.eventLabel', 'Event')}</InputLabel>
                        <Select
                            value={values.eventId || ''}
                            onChange={(e) => {
                                setValue('eventId', e.target.value)
                                setSelectedEvent(eventsData?.items?.find((s) => s.id === e.target.value) || null)
                            }}
                            disabled={isLoading || eventsLoading}
                            label={t('activities.eventLabel', 'Event')}
                            endAdornment={eventsLoading ? <CircularProgress color='inherit' size={20} sx={{ mr: 2 }} /> : null}
                        >
                            {eventsData?.items?.map((event) => (
                                <MenuItem key={event.id} value={event.id}>
                                    {event.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>{!values.eventId ? t('activities.errors.eventRequired', 'Event is required') : ''}</FormHelperText>
                    </FormControl>
                )}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('activities.confirmDelete')}
                description={t('activities.confirmDeleteDescription', { name: deleteDialogState.activity?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, activity: null })}
                onConfirm={async () => {
                    if (deleteDialogState.activity) {
                        try {
                            await deleteActivityApi.request(deleteDialogState.activity.id)
                            setDeleteDialogState({ open: false, activity: null })

                            // Invalidate cache to refetch activities list
                            await queryClient.invalidateQueries({
                                queryKey: activitiesQueryKeys.lists()
                            })

                            enqueueSnackbar(t('activities.deleteSuccess'), { variant: 'success' })
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
                                    : t('activities.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, activity: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default ActivityList
