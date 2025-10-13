import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, Chip, Typography, IconButton } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'

// project imports
// Use the new template-mui ItemCard (JS component) for consistency with Uniks
import { TemplateMainCard as MainCard, ItemCard, ToolbarControls, EmptyListState, SkeletonGrid, APIEmptySVG } from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { FlowListTable } from '@universo/template-mui/components/table/FlowListTable'
import { gridSpacing } from '@ui/store/constant'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'
import ErrorBoundary from '@ui/ErrorBoundary'
import ConfirmDialog from '@ui/ui-component/dialog/ConfirmDialog'
import useConfirm from '@ui/hooks/useConfirm'

import { useApi } from '../hooks/useApi'
import * as metaversesApi from '../api/metaverses'
import { Metaverse, MetaverseRole } from '../types'
import metaverseActions from './MetaverseActions'

const MetaverseList = () => {
    const navigate = useNavigate()
    const { t, i18n } = useTranslation('metaverses')
    const { enqueueSnackbar } = useSnackbar()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [view, setView] = useState(localStorage.getItem('entitiesMetaverseDisplayStyle') || 'card')

    // State management following Uniks pattern
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const [metaverses, setMetaverses] = useState<Metaverse[]>([])
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)
    // Aggregated counts come directly from backend list response now

    // State for independent ConfirmDeleteDialog (not managed by BaseEntityMenu)
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        metaverse: Metaverse | null
    }>({ open: false, metaverse: null })

    const { confirm } = useConfirm()

    const { request: loadMetaverses } = useApi(metaversesApi.listMetaverses)
    const updateMetaverseApi = useApi(metaversesApi.updateMetaverse)
    const deleteMetaverseApi = useApi(metaversesApi.deleteMetaverse)

    const fetchMetaverses = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await loadMetaverses()
            const metaversesArray = Array.isArray(result) ? result : []
            setMetaverses(metaversesArray)
        } catch (err: any) {
            setError(err)
            setMetaverses([])
        } finally {
            setLoading(false)
        }
    }, [loadMetaverses])

    useEffect(() => {
        fetchMetaverses()
    }, [fetchMetaverses])

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(metaverses)) {
            metaverses.forEach((metaverse) => {
                if (metaverse?.id) {
                    imagesMap[metaverse.id] = []
                }
            })
        }
        return imagesMap
    }, [metaverses])

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
        fetchMetaverses()
    }

    const handleCreateMetaverse = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await metaversesApi.createMetaverse({
                name: data.name,
                description: data.description
            })
            handleDialogSave()
        } catch (e: any) {
            setDialogError(e?.message || String(e))
            // eslint-disable-next-line no-console
            console.error('Failed to create metaverse', e)
        } finally {
            setCreating(false)
        }
    }

    const goToMetaverse = (metaverse: any) => {
        navigate(`/metaverses/${metaverse.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('entitiesMetaverseDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (value: string) => {
        setSearch(value)
    }

    const filterMetaverses = (data: any) => {
        const name = (data?.name || '').toLowerCase()
        const description = (data?.description || '').toLowerCase()
        const term = search.toLowerCase()
        return name.includes(term) || description.includes(term)
    }

    const updateFlowsApi = fetchMetaverses

    const roleLabel = useCallback((role?: MetaverseRole) => (role ? t(`roles.${role}`) : '—'), [t])

    const metaverseColumns = useMemo(
        () => [
            {
                id: 'description',
                label: t('metaverses.table.description'),
                width: '26%',
                align: 'left',
                render: (row: Metaverse) => (
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
                label: t('metaverses.table.role'),
                width: '10%',
                align: 'center',
                render: (row: Metaverse) => roleLabel(row.role)
            },
            {
                id: 'sections',
                label: t('metaverses.table.sections'),
                width: '10%',
                align: 'center',
                render: (row: Metaverse) => (typeof row.sectionsCount === 'number' ? row.sectionsCount : '—')
            },
            {
                id: 'entities',
                label: t('metaverses.table.entities'),
                width: '10%',
                align: 'center',
                render: (row: Metaverse) => (typeof row.entitiesCount === 'number' ? row.entitiesCount : '—')
            }
        ],
        [roleLabel, t]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createMetaverseContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    try {
                        await updateMetaverseApi.request(id, patch)
                    } catch (err: any) {
                        setError(err)
                        throw err
                    }
                },
                deleteEntity: async (id: string) => {
                    try {
                        await deleteMetaverseApi.request(id)
                    } catch (err: any) {
                        setError(err)
                        throw err
                    }
                }
            },
            helpers: {
                refreshList: async () => {
                    await fetchMetaverses()
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
                enqueueSnackbar,
                // Helper to open ConfirmDeleteDialog independently from BaseEntityMenu
                openDeleteDialog: (metaverse: Metaverse) => {
                    setDeleteDialogState({ open: true, metaverse })
                }
            }
        }),
        [confirm, deleteMetaverseApi, enqueueSnackbar, fetchMetaverses, setError, updateMetaverseApi]
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
                <ErrorBoundary>
                    <div>Error: {error.message || error}</div>
                </ErrorBoundary>
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={true}
                        searchPlaceholder={t('metaverses.searchPlaceholder')}
                        title={t('metaverses.title')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode: string) => handleChange(null, mode)}
                            cardViewTitle={t('common.cardView', 'Card View')}
                            listViewTitle={t('common.listView', 'List View')}
                            primaryAction={{
                                label: t('metaverses.addNew'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {isLoading && (!Array.isArray(metaverses) || metaverses.length === 0) ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && (!Array.isArray(metaverses) || metaverses.length === 0) ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No metaverses' title={t('metaverses.noMetaversesFound')} />
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
                                    {Array.isArray(metaverses) &&
                                        metaverses.filter(filterMetaverses).map((metaverse) => {
                                            // Filter actions based on permissions (same logic as table view)
                                            const descriptors = metaverseActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return metaverse.permissions?.manageMetaverse
                                                }
                                                return true
                                            })

                                            return (
                                                <ItemCard
                                                    key={metaverse.id}
                                                    data={metaverse}
                                                    images={images[metaverse.id] || []}
                                                    onClick={() => goToMetaverse(metaverse)}
                                                    footerEndContent={
                                                        metaverse.role ? (
                                                            <Chip
                                                                size='small'
                                                                variant='outlined'
                                                                color='primary'
                                                                label={roleLabel(metaverse.role)}
                                                                sx={{ pointerEvents: 'none' }}
                                                            />
                                                        ) : undefined
                                                    }
                                                    headerAction={
                                                        descriptors.length > 0 ? (
                                                            <Box onClick={(e) => e.stopPropagation()}>
                                                                <BaseEntityMenu
                                                                    entity={metaverse}
                                                                    entityKind='metaverse'
                                                                    descriptors={descriptors}
                                                                    namespace='metaverses'
                                                                    i18nInstance={i18n}
                                                                    createContext={createMetaverseContext}
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
                                        data={Array.isArray(metaverses) ? metaverses : []}
                                        images={images}
                                        isLoading={isLoading}
                                        filterFunction={filterMetaverses}
                                        updateFlowsApi={updateFlowsApi}
                                        setError={setError}
                                        getRowLink={(row: Metaverse) => (row?.id ? `/metaverses/${row.id}` : undefined)}
                                        customColumns={metaverseColumns}
                                        renderActions={(row: Metaverse) => {
                                            const descriptors = metaverseActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.manageMetaverse
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu
                                                    entity={row}
                                                    entityKind='metaverse'
                                                    descriptors={descriptors}
                                                    namespace='metaverses'
                                                    i18nInstance={i18n}
                                                    createContext={createMetaverseContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </Stack>
            )}

            <EntityFormDialog
                open={isDialogOpen}
                title={t('metaverses.createMetaverse', 'Create Metaverse')}
                nameLabel={t('metaverses.name', 'Name')}
                descriptionLabel={t('metaverses.description', 'Description')}
                saveButtonText={t('common.save', 'Save')}
                savingButtonText={t('common.saving', 'Saving')}
                cancelButtonText={t('common.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateMetaverse}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('metaverses.confirmDelete')}
                description={t('metaverses.confirmDeleteDescription', { name: deleteDialogState.metaverse?.name || '' })}
                confirmButtonText={t('metaverses.delete')}
                deletingButtonText={t('metaverses.deleting')}
                cancelButtonText={t('common.cancel')}
                onCancel={() => setDeleteDialogState({ open: false, metaverse: null })}
                onConfirm={async () => {
                    if (deleteDialogState.metaverse) {
                        try {
                            await deleteMetaverseApi.request(deleteDialogState.metaverse.id)
                            setDeleteDialogState({ open: false, metaverse: null })
                            await fetchMetaverses()
                            enqueueSnackbar(t('metaverses.deleteSuccess'), { variant: 'success' })
                        } catch (err: any) {
                            enqueueSnackbar(
                                typeof err?.response?.data === 'object'
                                    ? err.response.data.message
                                    : err?.response?.data || err?.message || t('metaverses.deleteError'),
                                { variant: 'error' }
                            )
                            setDeleteDialogState({ open: false, metaverse: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default MetaverseList
