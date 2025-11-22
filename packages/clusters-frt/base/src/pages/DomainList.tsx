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

import { useApi } from '../hooks/useApi'
import * as domainsApi from '../api/domains'
import { domainsQueryKeys } from '../api/queryKeys'
import { Domain } from '../types'
import domainActions from './DomainActions'

// Type for domain update/create data
type DomainData = {
    name: string
    description?: string
}

const DomainList = () => {
    const navigate = useNavigate()
    const { clusterId } = useParams<{ clusterId: string }>()
    // Use clusters namespace with domains subkey
    const { t, i18n } = useTranslation(['clusters', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('clustersDomainDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for domains list
    const paginationResult = usePaginated<Domain, 'name' | 'created' | 'updated'>({
        queryKeyFn: domainsQueryKeys.list,
        queryFn: domainsApi.listDomains,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!clusterId
    })

    const { data: domains, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // DEBUG: Log pagination state changes for troubleshooting
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('[DomainList Pagination Debug]', {
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
        domain: Domain | null
    }>({ open: false, domain: null })

    const { confirm } = useConfirm()

    const updateDomainApi = useApi<Domain, [string, { name: string; description?: string }]>(domainsApi.updateDomain)
    const deleteDomainApi = useApi<void, [string]>(domainsApi.deleteDomain)

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(domains)) {
            domains.forEach((domain) => {
                if (domain?.id) {
                    imagesMap[domain.id] = []
                }
            })
        }
        return imagesMap
    }, [domains])

    const domainColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left',
                render: (row: Domain) => (
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
                width: '40%',
                align: 'left',
                render: (row: Domain) => (
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
                id: 'resources',
                label: tc('table.resources', 'Resources'),
                width: '20%',
                align: 'center',
                render: (row: Domain) => (typeof row.resourcesCount === 'number' ? row.resourcesCount : '—')
            }
        ],
        [tc]
    )

    const createDomainContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateDomainApi.request(id, patch)
                    // Invalidate cache after update
                    await queryClient.invalidateQueries({
                        queryKey: domainsQueryKeys.lists()
                    })
                },
                deleteEntity: async (id: string) => {
                    await deleteDomainApi.request(id)
                    // Invalidate cache after delete
                    await queryClient.invalidateQueries({
                        queryKey: domainsQueryKeys.lists()
                    })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: domainsQueryKeys.lists()
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
                openDeleteDialog: (domain: Domain) => {
                    setDeleteDialogState({ open: true, domain })
                }
            }
        }),
        [confirm, deleteDomainApi, enqueueSnackbar, queryClient, updateDomainApi]
    )

    // Validate clusterId from URL AFTER all hooks
    if (!clusterId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid cluster'
                title={t('clusters:errors.invalidCluster')}
                description={t('clusters:errors.pleaseSelectCluster')}
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

    const handleCreateDomain = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await domainsApi.createDomain({
                name: data.name,
                description: data.description,
                clusterId: clusterId
            })

            // Invalidate cache to refetch domains list
            await queryClient.invalidateQueries({
                queryKey: domainsQueryKeys.lists()
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
                    : t('domains.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create domain', e)
        } finally {
            setCreating(false)
        }
    }

    const goToDomain = (domain: Domain) => {
        navigate(`/domains/${domain.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('clustersDomainDisplayStyle', nextView)
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
                        searchPlaceholder={t('domains.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('domains.title')}
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

                    {isLoading && domains.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && domains.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No domains' title={t('domains.noDomainsFound')} />
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
                                    {domains.map((domain: Domain) => {
                                        // Filter actions based on permissions
                                        const descriptors = domainActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return domain.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={domain.id}
                                                data={domain}
                                                images={images[domain.id] || []}
                                                onClick={() => goToDomain(domain)}
                                                footerEndContent={
                                                    typeof domain.resourcesCount === 'number' ? (
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {t('clusters:domains.resourceCount', { count: domain.resourcesCount })}
                                                        </Typography>
                                                    ) : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<Domain, DomainData>
                                                                entity={domain}
                                                                entityKind='domain'
                                                                descriptors={descriptors}
                                                                namespace='clusters'
                                                                i18nInstance={i18n}
                                                                createContext={createDomainContext}
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
                                        data={domains}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Domain) => (row?.id ? `/domains/${row.id}` : undefined)}
                                        customColumns={domainColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Domain) => {
                                            const descriptors = domainActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<Domain, DomainData>
                                                    entity={row}
                                                    entityKind='domain'
                                                    descriptors={descriptors}
                                                    namespace='clusters'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createDomainContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && domains.length > 0 && (
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
                title={t('domains.createDomain', 'Create Domain')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateDomain}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('domains.confirmDelete')}
                description={t('domains.confirmDeleteDescription', { name: deleteDialogState.domain?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, domain: null })}
                onConfirm={async () => {
                    if (deleteDialogState.domain) {
                        try {
                            await deleteDomainApi.request(deleteDialogState.domain.id)
                            setDeleteDialogState({ open: false, domain: null })

                            // Invalidate cache to refetch domains list
                            await queryClient.invalidateQueries({
                                queryKey: domainsQueryKeys.lists()
                            })

                            enqueueSnackbar(t('domains.deleteSuccess'), { variant: 'success' })
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
                                    : t('domains.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, domain: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default DomainList
