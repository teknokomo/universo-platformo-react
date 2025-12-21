import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Box, Typography, IconButton } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'

// project imports
import {
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
    useConfirm,
    RoleChip,
    useUserSettings
} from '@universo/template-mui'
import { EntityFormDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useUpdateMetahub, useDeleteMetahub } from '../hooks/mutations'
import * as metahubsApi from '../api/metahubs'
import { metahubsQueryKeys } from '../api/queryKeys'
import { Metahub } from '../types'

// Type for metahub update/create data
type MetahubData = {
    name: string
    description?: string
}

const MetahubList = () => {
    // Use metahubs namespace for view-specific keys
    const { t } = useTranslation(['metahubs'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('metahubsDisplayStyle') || 'card')

    // Get user settings for showAll preference
    const { settings } = useUserSettings()
    const showAll = settings.admin?.showAllItems ?? false

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Create query function that includes showAll parameter
    const queryFnWithShowAll = useCallback(
        (params: { limit?: number; offset?: number; search?: string; sortBy?: string; sortOrder?: string }) =>
            metahubsApi.listMetahubs({ ...params, showAll }),
        [showAll]
    )

    // Use paginated hook for metahubs list
    const paginationResult = usePaginated<Metahub, 'name' | 'created' | 'updated'>({
        queryKeyFn: (params) => [...metahubsQueryKeys.list(params), { showAll }],
        queryFn: queryFnWithShowAll,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: metahubs, isLoading, error } = paginationResult

    const metahubsList = Array.isArray(metahubs) ? metahubs : []

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const { confirm } = useConfirm()

    const updateMetahubMutation = useUpdateMetahub()
    const deleteMetahubMutation = useDeleteMetahub()

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateMetahub = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await metahubsApi.createMetahub({
                name: data.name,
                description: data.description
            })

            // Invalidate cache to refetch metahubs list
            await queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.lists()
            })

            handleDialogSave()
        } catch (e: unknown) {
            const axiosError = e as AxiosError<{ message?: unknown }>
            const responseMessage = axiosError?.response?.data?.message
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
            console.error('Failed to create metahub', e)
        } finally {
            setCreating(false)
        }
    }

    const handleChange = (_event: React.SyntheticEvent | null, nextView: string | null) => {
        if (nextView !== null) {
            setView(nextView)
            localStorage.setItem('metahubsDisplayStyle', nextView)
        }
    }

    // Card click handler for navigation
    const handleCardClick = (metahub: Metahub) => {
        window.location.href = `/metahub/${metahub.id}`
    }

    // Menu action handlers
    const handleEditMetahub = async (metahub: Metahub, data: MetahubData) => {
        try {
            await updateMetahubMutation.mutateAsync({
                id: metahub.id,
                data: { name: data.name, description: data.description }
            })
        } catch {
            // Error is handled in mutation hook
        }
    }

    const handleDeleteMetahub = async (metahub: Metahub) => {
        const confirmed = await confirm({
            title: t('confirm.delete.title'),
            description: t('confirm.delete.description'),
            confirmText: t('confirm.delete.confirm'),
            cancelText: t('confirm.delete.cancel'),
            severity: 'error'
        })

        if (confirmed) {
            try {
                await deleteMetahubMutation.mutateAsync(metahub.id)
            } catch {
                // Error is handled in mutation hook
            }
        }
    }

    // Table columns configuration
    const columns = useMemo(
        () => [
            {
                id: 'name' as const,
                label: tc('table.headers.name'),
                sortable: true,
                width: '30%',
                render: (metahub: Metahub) => (
                    <Link to={`/metahub/${metahub.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Typography variant='body2' fontWeight={500}>
                            {metahub.name}
                        </Typography>
                    </Link>
                )
            },
            {
                id: 'description' as const,
                label: tc('table.headers.description'),
                sortable: false,
                width: '35%',
                render: (metahub: Metahub) => (
                    <Typography variant='body2' color='text.secondary' noWrap sx={{ maxWidth: 300 }}>
                        {metahub.description || '-'}
                    </Typography>
                )
            },
            {
                id: 'entitiesCount' as const,
                label: t('entitiesCount'),
                sortable: false,
                width: '15%',
                render: (metahub: Metahub) => (
                    <Typography variant='body2' color='text.secondary'>
                        {metahub.entitiesCount ?? 0}
                    </Typography>
                )
            },
            {
                id: 'role' as const,
                label: tc('table.headers.role'),
                sortable: false,
                width: '15%',
                render: (metahub: Metahub) => <RoleChip role={metahub.role} size='small' />
            }
        ],
        [t, tc]
    )

    // Empty state
    if (!isLoading && metahubsList.length === 0 && !paginationResult.pagination.search) {
        return (
            <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
                <ViewHeader title={t('title')} search={false} onAddNew={handleAddNew} addButtonIcon={<AddRoundedIcon />} />
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt={t('noMetahubsFound')}
                    title={t('noMetahubsFound')}
                    onAddNew={handleAddNew}
                    addButtonText={t('createMetahub')}
                />
                <EntityFormDialog
                    open={isDialogOpen}
                    onClose={handleDialogClose}
                    onSave={handleCreateMetahub}
                    title={t('createMetahub')}
                    nameLabel={t('metahubName')}
                    descriptionLabel={t('metahubDescription')}
                    isLoading={isCreating}
                    error={dialogError}
                />
            </Box>
        )
    }

    return (
        <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
            <ViewHeader title={t('title')} search={false} onAddNew={handleAddNew} addButtonIcon={<AddRoundedIcon />} />

            <ToolbarControls
                view={view}
                onViewChange={handleChange}
                searchValue={searchValue}
                onSearchChange={handleSearchChange}
                searchPlaceholder={t('searchPlaceholder')}
            />

            {isLoading ? (
                <SkeletonGrid count={6} />
            ) : error ? (
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt={t('errors.loadFailed')}
                    title={t('errors.connectionFailed')}
                    description={t('errors.checkConnection')}
                />
            ) : view === 'card' ? (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, 1fr)',
                            md: 'repeat(3, 1fr)',
                            lg: 'repeat(4, 1fr)'
                        },
                        gap: gridSpacing
                    }}
                >
                    {metahubsList.map((metahub) => (
                        <ItemCard
                            key={metahub.id}
                            data={{
                                id: metahub.id,
                                name: metahub.name,
                                description: metahub.description,
                                role: metahub.role
                            }}
                            images={[]}
                            onClick={() => handleCardClick(metahub)}
                        >
                            <BaseEntityMenu<Metahub>
                                entity={metahub}
                                entityType='metahub'
                                nameField='name'
                                descriptionField='description'
                                onRename={(entity, data) => handleEditMetahub(entity, data as MetahubData)}
                                onDelete={handleDeleteMetahub}
                                trigger={({ onClick }: TriggerProps) => (
                                    <IconButton size='small' onClick={onClick} sx={{ position: 'absolute', top: 8, right: 8 }}>
                                        <MoreVertRoundedIcon fontSize='small' />
                                    </IconButton>
                                )}
                            />
                        </ItemCard>
                    ))}
                </Box>
            ) : (
                <FlowListTable<Metahub>
                    data={metahubsList}
                    customColumns={columns}
                    renderActions={(metahub) => (
                        <BaseEntityMenu<Metahub>
                            entity={metahub}
                            entityType='metahub'
                            nameField='name'
                            descriptionField='description'
                            onRename={(entity, data) => handleEditMetahub(entity, data as MetahubData)}
                            onDelete={handleDeleteMetahub}
                            trigger={({ onClick }: TriggerProps) => (
                                <IconButton size='small' onClick={onClick}>
                                    <MoreVertRoundedIcon fontSize='small' />
                                </IconButton>
                            )}
                        />
                    )}
                    getRowLink={(metahub) => `/metahub/${metahub.id}`}
                />
            )}

            {!paginationResult.isLoading && paginationResult.pagination.totalItems > 0 && (
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

            <EntityFormDialog
                open={isDialogOpen}
                onClose={handleDialogClose}
                onSave={handleCreateMetahub}
                title={t('createMetahub')}
                nameLabel={t('metahubName')}
                descriptionLabel={t('metahubDescription')}
                isLoading={isCreating}
                error={dialogError}
            />
        </Box>
    )
}

export default MetahubList
