import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton, FormControl, InputLabel, Select, MenuItem, FormHelperText, CircularProgress } from '@mui/material'
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
import * as entitiesApi from '../api/entities'
import * as sectionsApi from '../api/sections'
import { entitiesQueryKeys, sectionsQueryKeys } from '../api/queryKeys'
import { Entity, Section } from '../types'
import entityActions from './EntityActions'

// Type for entity update/create data
type EntityData = {
    name: string
    description?: string
}

// DEBUG: Log module loading
console.log('[EntityList] Module loaded', {
    hasEntityActions: !!entityActions,
    entityActionsType: typeof entityActions,
    entityActionsIsArray: Array.isArray(entityActions),
    entityActionsLength: Array.isArray(entityActions) ? entityActions.length : 'N/A'
})

const EntityList = () => {
    console.log('[EntityList] Component render started')
    
    const navigate = useNavigate()
    // Use entities namespace for view-specific keys
    const { t, i18n } = useTranslation(['metaverses', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('entitiesEntityDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [selectedSection, setSelectedSection] = useState<Section | null>(null)

    // Fetch sections list for dropdown
    const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
        queryKey: sectionsQueryKeys.list({ limit: 1000, offset: 0 }),
        queryFn: () => sectionsApi.listSections({ limit: 1000, offset: 0 })
    })

    // Use paginated hook for entities list
    const paginationResult = usePaginated<Entity, 'name' | 'created' | 'updated'>({
        queryKeyFn: entitiesQueryKeys.list,
        queryFn: entitiesApi.listEntities,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: entities, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // DEBUG: Log pagination state changes for troubleshooting
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('[EntityList Pagination Debug]', {
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
        paginationResult.pagination.search,
        paginationResult.isLoading,
        searchValue
    ])

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        entity: Entity | null
    }>({ open: false, entity: null })

    const { confirm } = useConfirm()

    const updateEntityApi = useApi<Entity, [string, { name: string; description?: string }]>(entitiesApi.updateEntity)
    const deleteEntityApi = useApi<void, [string]>(entitiesApi.deleteEntity)

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(entities)) {
            entities.forEach((entity) => {
                if (entity?.id) {
                    imagesMap[entity.id] = []
                }
            })
        }
        return imagesMap
    }, [entities])

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateEntity = async (data: { name: string; description?: string; sectionId?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            // Validate sectionId is present
            if (!data.sectionId) {
                setDialogError(t('entities:errors.sectionRequired', 'Section is required'))
                setCreating(false)
                return
            }

            await entitiesApi.createEntity({
                name: data.name,
                description: data.description,
                sectionId: data.sectionId
            })

            // Invalidate cache to refetch entities list
            await queryClient.invalidateQueries({
                queryKey: entitiesQueryKeys.lists()
            })

            handleDialogSave()
            setSelectedSection(null) // Reset section selection
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('entities.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create entity', e)
        } finally {
            setCreating(false)
        }
    }

    const goToEntity = (entity: Entity) => {
        navigate(`/entities/${entity.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('entitiesEntityDisplayStyle', nextView)
        setView(nextView)
    }

    const entityColumns = useMemo(
        () => [
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '60%',
                align: 'left' as const,
                render: (row: Entity) => (
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

    const createEntityContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateEntityApi.request(id, patch)
                    // Invalidate cache after update
                    await queryClient.invalidateQueries({
                        queryKey: entitiesQueryKeys.lists()
                    })
                },
                deleteEntity: async (id: string) => {
                    await deleteEntityApi.request(id)
                    // Invalidate cache after delete
                    await queryClient.invalidateQueries({
                        queryKey: entitiesQueryKeys.lists()
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: entitiesQueryKeys.lists()
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
                openDeleteDialog: (entity: Entity) => {
                    setDeleteDialogState({ open: true, entity })
                }
            }
        }),
        [confirm, deleteEntityApi, enqueueSnackbar, queryClient, updateEntityApi]
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
                        searchPlaceholder={t('entities.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('entities.title')}
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

                    {isLoading && entities.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && entities.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No entities' title={t('entities.noEntitiesFound')} />
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
                                    {entities.map((entity: Entity) => {
                                        // Filter actions based on permissions
                                        const descriptors = entityActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return entity.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={entity.id}
                                                data={entity}
                                                images={images[entity.id] || []}
                                                onClick={() => goToEntity(entity)}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Entity, EntityData>
                                                                entity={entity}
                                                                entityKind='entity'
                                                                descriptors={descriptors}
                                                                namespace='metaverses'
                                                                i18nInstance={i18n}
                                                                createContext={createEntityContext}
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
                                        data={entities}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Entity) => (row?.id ? `/entities/${row.id}` : undefined)}
                                        customColumns={entityColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Entity) => {
                                            const descriptors = entityActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Entity, EntityData>
                                                    entity={row}
                                                    entityKind='entity'
                                                    descriptors={descriptors}
                                                    namespace='metaverses'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createEntityContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && entities.length > 0 && (
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
                title={t('entities.createEntity', 'Create Entity')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateEntity}
                initialExtraValues={{ sectionId: selectedSection?.id || '' }}
                extraFields={({ values, setValue, isLoading }) => (
                    <FormControl fullWidth required error={!values.sectionId}>
                        <InputLabel>{t('entities.sectionLabel', 'Section')}</InputLabel>
                        <Select
                            value={values.sectionId || ''}
                            onChange={(e) => {
                                setValue('sectionId', e.target.value)
                                setSelectedSection(sectionsData?.items?.find((s) => s.id === e.target.value) || null)
                            }}
                            disabled={isLoading || sectionsLoading}
                            label={t('entities.sectionLabel', 'Section')}
                            endAdornment={sectionsLoading ? <CircularProgress color='inherit' size={20} sx={{ mr: 2 }} /> : null}
                        >
                            {sectionsData?.items?.map((section) => (
                                <MenuItem key={section.id} value={section.id}>
                                    {section.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>{!values.sectionId ? t('entities.errors.sectionRequired', 'Section is required') : ''}</FormHelperText>
                    </FormControl>
                )}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('entities.confirmDelete')}
                description={t('entities.confirmDeleteDescription', { name: deleteDialogState.entity?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, entity: null })}
                onConfirm={async () => {
                    if (deleteDialogState.entity) {
                        try {
                            await deleteEntityApi.request(deleteDialogState.entity.id)
                            setDeleteDialogState({ open: false, entity: null })

                            // Invalidate cache to refetch entities list
                            await queryClient.invalidateQueries({
                                queryKey: entitiesQueryKeys.lists()
                            })

                            enqueueSnackbar(t('entities.deleteSuccess'), { variant: 'success' })
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
                                    : t('entities.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, entity: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default EntityList
