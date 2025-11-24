import { useState, useMemo, useCallback } from 'react'
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

import { useApi } from '../hooks/useApi'
import * as slotsApi from '../api/slots'
import * as containersApi from '../api/containers'
import { slotsQueryKeys, containersQueryKeys } from '../api/queryKeys'
import { Slot, Container } from '../types'
import slotActions from './SlotActions'

// Type for slot update/create data
type SlotData = {
    name: string
    description?: string
}

const SlotList = () => {
    const navigate = useNavigate()
    // Use slots namespace for view-specific keys
    const { t, i18n } = useTranslation(['storages', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('slotsSlotDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [selectedContainer, setSelectedContainer] = useState<Container | null>(null)

    // Fetch containers list for dropdown
    const { data: containersData, isLoading: containersLoading } = useQuery({
        queryKey: containersQueryKeys.list({ limit: 1000, offset: 0 }),
        queryFn: () => containersApi.listContainers({ limit: 1000, offset: 0 })
    })

    // Use paginated hook for slots list
    const paginationResult = usePaginated<Slot, 'name' | 'created' | 'updated'>({
        queryKeyFn: slotsQueryKeys.list,
        queryFn: slotsApi.listSlots,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: slots, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue: _searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        slot: Slot | null
    }>({ open: false, slot: null })

    const { confirm } = useConfirm()

    const updateSlotApi = useApi<Slot, [string, { name: string; description?: string }]>(slotsApi.updateSlot)
    const deleteSlotApi = useApi<void, [string]>(slotsApi.deleteSlot)

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(slots)) {
            slots.forEach((slot) => {
                if (slot?.id) {
                    imagesMap[slot.id] = []
                }
            })
        }
        return imagesMap
    }, [slots])

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateSlot = async (data: { name: string; description?: string; containerId?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            // Validate containerId is present
            if (!data.containerId) {
                setDialogError(t('slots:errors.containerRequired', 'Container is required'))
                setCreating(false)
                return
            }

            await slotsApi.createSlot({
                name: data.name,
                description: data.description,
                containerId: data.containerId
            })

            // Invalidate cache to refetch slots list
            await queryClient.invalidateQueries({
                queryKey: slotsQueryKeys.lists()
            })

            handleDialogSave()
            setSelectedContainer(null) // Reset container selection
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('slots.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create slot', e)
        } finally {
            setCreating(false)
        }
    }

    const goToSlot = (slot: Slot) => {
        navigate(`/slots/${slot.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('slotsSlotDisplayStyle', nextView)
        setView(nextView)
    }

    const slotColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '30%',
                align: 'left' as const,
                render: (row: Slot) => (
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
                align: 'left' as const,
                render: (row: Slot) => (
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

    const createSlotContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateSlotApi.request(id, patch)
                    // Invalidate cache after update
                    await queryClient.invalidateQueries({
                        queryKey: slotsQueryKeys.lists()
                    })
                },
                deleteEntity: async (id: string) => {
                    await deleteSlotApi.request(id)
                    // Invalidate cache after delete
                    await queryClient.invalidateQueries({
                        queryKey: slotsQueryKeys.lists()
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: slotsQueryKeys.lists()
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
                openDeleteDialog: (slot: Slot) => {
                    setDeleteDialogState({ open: true, slot })
                }
            }
        }),
        [confirm, deleteSlotApi, enqueueSnackbar, queryClient, updateSlotApi]
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
                        searchPlaceholder={t('slots.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('slots.title')}
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

                    {isLoading && slots.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && slots.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No slots' title={t('slots.noSlotsFound')} />
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
                                    {slots.map((slot: Slot) => {
                                        // Filter actions based on permissions
                                        const descriptors = slotActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return slot.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={slot.id}
                                                data={slot}
                                                images={images[slot.id] || []}
                                                onClick={() => goToSlot(slot)}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Slot, SlotData>
                                                                entity={slot}
                                                                entityKind='slot'
                                                                descriptors={descriptors}
                                                                namespace='storages'
                                                                i18nInstance={i18n}
                                                                createContext={createSlotContext}
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
                                        data={slots}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Slot) => (row?.id ? `/slots/${row.id}` : undefined)}
                                        customColumns={slotColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Slot) => {
                                            const descriptors = slotActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Slot, SlotData>
                                                    entity={row}
                                                    entityKind='slot'
                                                    descriptors={descriptors}
                                                    namespace='storages'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createSlotContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && slots.length > 0 && (
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
                title={t('slots.createSlot', 'Create Slot')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateSlot}
                initialExtraValues={{ containerId: selectedContainer?.id || '' }}
                extraFields={({ values, setValue, isLoading }) => (
                    <FormControl fullWidth required error={!values.containerId}>
                        <InputLabel>{t('slots.containerLabel', 'Container')}</InputLabel>
                        <Select
                            value={values.containerId || ''}
                            onChange={(e) => {
                                setValue('containerId', e.target.value)
                                setSelectedContainer(containersData?.items?.find((s) => s.id === e.target.value) || null)
                            }}
                            disabled={isLoading || containersLoading}
                            label={t('slots.containerLabel', 'Container')}
                            endAdornment={containersLoading ? <CircularProgress color='inherit' size={20} sx={{ mr: 2 }} /> : null}
                        >
                            {containersData?.items?.map((container) => (
                                <MenuItem key={container.id} value={container.id}>
                                    {container.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {!values.containerId ? t('slots.errors.containerRequired', 'Container is required') : ''}
                        </FormHelperText>
                    </FormControl>
                )}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('slots.confirmDelete')}
                description={t('slots.confirmDeleteDescription', { name: deleteDialogState.slot?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, slot: null })}
                onConfirm={async () => {
                    if (deleteDialogState.slot) {
                        try {
                            await deleteSlotApi.request(deleteDialogState.slot.id)
                            setDeleteDialogState({ open: false, slot: null })

                            // Invalidate cache to refetch slots list
                            await queryClient.invalidateQueries({
                                queryKey: slotsQueryKeys.lists()
                            })

                            enqueueSnackbar(t('slots.deleteSuccess'), { variant: 'success' })
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
                                    : t('slots.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, slot: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default SlotList
