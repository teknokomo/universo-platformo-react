import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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

import { useUpdateEntity, useDeleteEntity } from '../hooks/mutations'
import * as meta_entitiesApi from '../api/metaEntities'
import * as meta_sectionsApi from '../api/metaSections'
import * as metahubsApi from '../api/metahubs'
import { meta_entitiesQueryKeys, meta_sectionsQueryKeys, metahubsQueryKeys } from '../api/queryKeys'
import { MetaEntity, MetaSection, PaginationParams } from '../types'
import metaEntityActions from './MetaEntityActions'

// Type for entity update/create data
type EntityData = {
    name: string
    description?: string
}

const EntityList = () => {
    const navigate = useNavigate()
    // Get metahubId from URL params (if present, we're viewing meta_entities within a specific metahub)
    const { metahubId } = useParams<{ metahubId?: string }>()

    // Use meta_entities namespace for view-specific keys
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('metahubsEntityDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [selectedSection, setSelectedSection] = useState<MetaSection | null>(null)

    // Fetch meta_sections list for dropdown
    // If metahubId is present, fetch meta_sections for that specific metahub
    // Otherwise, fetch all meta_sections accessible to the user
    const { data: meta_sectionsData, isLoading: meta_sectionsLoading } = useQuery({
        queryKey: metahubId ? metahubsQueryKeys.meta_sections(metahubId) : meta_sectionsQueryKeys.list({ limit: 1000, offset: 0 }),
        queryFn: () =>
            metahubId
                ? metahubsApi.listMetahubMetaSections(metahubId, { limit: 1000, offset: 0 })
                : meta_sectionsApi.listMetaSections({ limit: 1000, offset: 0 })
    })

    // Use paginated hook for meta_entities list
    // If metahubId is present, fetch meta_entities for that specific metahub
    // Otherwise, fetch all meta_entities accessible to the user
    const paginationResult = usePaginated<MetaEntity, 'name' | 'created' | 'updated'>({
        queryKeyFn: metahubId
            ? (params: PaginationParams) => metahubsQueryKeys.meta_entitiesList(metahubId, params)
            : meta_entitiesQueryKeys.list,
        queryFn: metahubId
            ? (params: PaginationParams) => metahubsApi.listMetahubMetaEntities(metahubId, params)
            : meta_entitiesApi.listMetaEntities,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: meta_entities, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        entity: MetaEntity | null
    }>({ open: false, entity: null })

    const { confirm } = useConfirm()

    const updateEntityMutation = useUpdateEntity()
    const deleteEntityMutation = useDeleteEntity()

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(meta_entities)) {
            meta_entities.forEach((entity) => {
                if (entity?.id) {
                    imagesMap[entity.id] = []
                }
            })
        }
        return imagesMap
    }, [meta_entities])

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
                setDialogError(t('meta_entities:errors.sectionRequired', 'MetaSection is required'))
                setCreating(false)
                return
            }

            await meta_entitiesApi.createEntity({
                name: data.name,
                description: data.description,
                sectionId: data.sectionId
            })

            // Invalidate cache to refetch meta_entities list (both metahub-scoped and global)
            if (metahubId) {
                await queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.meta_entities(metahubId)
                })
            }
            await queryClient.invalidateQueries({
                queryKey: meta_entitiesQueryKeys.lists()
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
                    : t('meta_entities.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create entity', e)
        } finally {
            setCreating(false)
        }
    }

    const goToEntity = (entity: MetaEntity) => {
        navigate(`/meta_entities/${entity.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('metahubsEntityDisplayStyle', nextView)
        setView(nextView)
    }

    const entityColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                render: (row: MetaEntity) => (
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
                render: (row: MetaEntity) => (
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
                    await updateEntityMutation.mutateAsync({ id, data: patch })
                },
                deleteEntity: async (id: string) => {
                    await deleteEntityMutation.mutateAsync(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation - invalidate both metahub-scoped and global lists
                    if (metahubId) {
                        await queryClient.invalidateQueries({
                            queryKey: metahubsQueryKeys.meta_entities(metahubId)
                        })
                    }
                    await queryClient.invalidateQueries({
                        queryKey: meta_entitiesQueryKeys.lists()
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
                openDeleteDialog: (entity: MetaEntity) => {
                    setDeleteDialogState({ open: true, entity })
                }
            }
        }),
        [confirm, deleteEntityMutation, enqueueSnackbar, metahubId, queryClient, updateEntityMutation]
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
                        searchPlaceholder={t('meta_entities.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('meta_entities.title')}
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

                    {isLoading && meta_entities.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && meta_entities.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No meta_entities' title={t('meta_entities.noMetaEntitiesFound')} />
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
                                    {meta_entities.map((entity: MetaEntity) => {
                                        // Filter actions based on permissions
                                        const descriptors = metaEntityActions.filter((descriptor) => {
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
                                                            <BaseEntityMenu<MetaEntity, EntityData>
                                                                entity={entity}
                                                                entityKind='entity'
                                                                descriptors={descriptors}
                                                                namespace='metahubs'
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
                                        data={meta_entities}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: MetaEntity) => (row?.id ? `/meta_entities/${row.id}` : undefined)}
                                        customColumns={entityColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: MetaEntity) => {
                                            const descriptors = metaEntityActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<MetaEntity, EntityData>
                                                    entity={row}
                                                    entityKind='entity'
                                                    descriptors={descriptors}
                                                    namespace='metahubs'
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
                    {!isLoading && meta_entities.length > 0 && (
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
                title={t('meta_entities.createEntity', 'Create MetaEntity')}
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
                        <InputLabel>{t('meta_entities.sectionLabel', 'MetaSection')}</InputLabel>
                        <Select
                            value={values.sectionId || ''}
                            onChange={(e) => {
                                setValue('sectionId', e.target.value)
                                setSelectedSection(meta_sectionsData?.items?.find((s) => s.id === e.target.value) || null)
                            }}
                            disabled={isLoading || meta_sectionsLoading}
                            label={t('meta_entities.sectionLabel', 'MetaSection')}
                            endAdornment={meta_sectionsLoading ? <CircularProgress color='inherit' size={20} sx={{ mr: 2 }} /> : null}
                        >
                            {meta_sectionsData?.items?.map((section) => (
                                <MenuItem key={section.id} value={section.id}>
                                    {section.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {!values.sectionId ? t('meta_entities.errors.sectionRequired', 'MetaSection is required') : ''}
                        </FormHelperText>
                    </FormControl>
                )}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('meta_entities.confirmDelete')}
                description={t('meta_entities.confirmDeleteDescription', { name: deleteDialogState.entity?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, entity: null })}
                onConfirm={async () => {
                    if (deleteDialogState.entity) {
                        try {
                            await deleteEntityMutation.mutateAsync(deleteDialogState.entity.id)
                            setDeleteDialogState({ open: false, entity: null })
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
                                    : t('meta_entities.deleteError')
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
