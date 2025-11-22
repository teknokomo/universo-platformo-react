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

import { useApi } from '../hooks/useApi'
import * as resourcesApi from '../api/resources'
import * as domainsApi from '../api/domains'
import { resourcesQueryKeys, domainsQueryKeys } from '../api/queryKeys'
import { Resource, Domain } from '../types'
import resourceActions from './ResourceActions'

// Type for resource update/create data
type ResourceData = {
    name: string
    description?: string
}

const ResourceList = () => {
    const navigate = useNavigate()
    // Use resources namespace for view-specific keys
    const { t, i18n } = useTranslation(['clusters', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('clustersResourceDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)

    // Fetch domains list for dropdown
    const { data: domainsData, isLoading: domainsLoading } = useQuery({
        queryKey: domainsQueryKeys.list({ limit: 1000, offset: 0 }),
        queryFn: () => domainsApi.listDomains({ limit: 1000, offset: 0 })
    })

    // Use paginated hook for resources list
    const paginationResult = usePaginated<Resource, 'name' | 'created' | 'updated'>({
        queryKeyFn: resourcesQueryKeys.list,
        queryFn: resourcesApi.listResources,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: resources, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // DEBUG: Log pagination state changes for troubleshooting
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('[ResourceList Pagination Debug]', {
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
        resource: Resource | null
    }>({ open: false, resource: null })

    const { confirm } = useConfirm()

    const updateResourceApi = useApi<Resource, [string, { name: string; description?: string }]>(resourcesApi.updateResource)
    const deleteResourceApi = useApi<void, [string]>(resourcesApi.deleteResource)

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(resources)) {
            resources.forEach((resource) => {
                if (resource?.id) {
                    imagesMap[resource.id] = []
                }
            })
        }
        return imagesMap
    }, [resources])

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateResource = async (data: { name: string; description?: string; domainId?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            // Validate domainId is present
            if (!data.domainId) {
                setDialogError(t('resources:errors.domainRequired', 'Domain is required'))
                setCreating(false)
                return
            }

            await resourcesApi.createResource({
                name: data.name,
                description: data.description,
                domainId: data.domainId
            })

            // Invalidate cache to refetch resources list
            await queryClient.invalidateQueries({
                queryKey: resourcesQueryKeys.lists()
            })

            handleDialogSave()
            setSelectedDomain(null) // Reset domain selection
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('resources.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create resource', e)
        } finally {
            setCreating(false)
        }
    }

    const goToResource = (resource: Resource) => {
        navigate(`/resources/${resource.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('clustersResourceDisplayStyle', nextView)
        setView(nextView)
    }

    const resourceColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                render: (row: Resource) => (
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
                render: (row: Resource) => (
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

    const createResourceContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateResourceApi.request(id, patch)
                    // Invalidate cache after update
                    await queryClient.invalidateQueries({
                        queryKey: resourcesQueryKeys.lists()
                    })
                },
                deleteEntity: async (id: string) => {
                    await deleteResourceApi.request(id)
                    // Invalidate cache after delete
                    await queryClient.invalidateQueries({
                        queryKey: resourcesQueryKeys.lists()
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: resourcesQueryKeys.lists()
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
                openDeleteDialog: (resource: Resource) => {
                    setDeleteDialogState({ open: true, resource })
                }
            }
        }),
        [confirm, deleteResourceApi, enqueueSnackbar, queryClient, updateResourceApi]
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
                        searchPlaceholder={t('resources.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('resources.title')}
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

                    {isLoading && resources.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && resources.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No resources' title={t('resources.noResourcesFound')} />
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
                                    {resources.map((resource: Resource) => {
                                        // Filter actions based on permissions
                                        const descriptors = resourceActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return resource.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={resource.id}
                                                data={resource}
                                                images={images[resource.id] || []}
                                                onClick={() => goToResource(resource)}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Resource, ResourceData>
                                                                entity={resource}
                                                                entityKind='resource'
                                                                descriptors={descriptors}
                                                                namespace='clusters'
                                                                i18nInstance={i18n}
                                                                createContext={createResourceContext}
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
                                        data={resources}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Resource) => (row?.id ? `/resources/${row.id}` : undefined)}
                                        customColumns={resourceColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Resource) => {
                                            const descriptors = resourceActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Resource, ResourceData>
                                                    entity={row}
                                                    entityKind='resource'
                                                    descriptors={descriptors}
                                                    namespace='clusters'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createResourceContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && resources.length > 0 && (
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
                title={t('resources.createResource', 'Create Resource')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateResource}
                initialExtraValues={{ domainId: selectedDomain?.id || '' }}
                extraFields={({ values, setValue, isLoading }) => (
                    <FormControl fullWidth required error={!values.domainId}>
                        <InputLabel>{t('resources.domainLabel', 'Domain')}</InputLabel>
                        <Select
                            value={values.domainId || ''}
                            onChange={(e) => {
                                setValue('domainId', e.target.value)
                                setSelectedDomain(domainsData?.items?.find((s) => s.id === e.target.value) || null)
                            }}
                            disabled={isLoading || domainsLoading}
                            label={t('resources.domainLabel', 'Domain')}
                            endAdornment={domainsLoading ? <CircularProgress color='inherit' size={20} sx={{ mr: 2 }} /> : null}
                        >
                            {domainsData?.items?.map((domain) => (
                                <MenuItem key={domain.id} value={domain.id}>
                                    {domain.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {!values.domainId ? t('resources.errors.domainRequired', 'Domain is required') : ''}
                        </FormHelperText>
                    </FormControl>
                )}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('resources.confirmDelete')}
                description={t('resources.confirmDeleteDescription', { name: deleteDialogState.resource?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, resource: null })}
                onConfirm={async () => {
                    if (deleteDialogState.resource) {
                        try {
                            await deleteResourceApi.request(deleteDialogState.resource.id)
                            setDeleteDialogState({ open: false, resource: null })

                            // Invalidate cache to refetch resources list
                            await queryClient.invalidateQueries({
                                queryKey: resourcesQueryKeys.lists()
                            })

                            enqueueSnackbar(t('resources.deleteSuccess'), { variant: 'success' })
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
                                    : t('resources.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, resource: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default ResourceList
