import { useState, useMemo, useCallback } from 'react'
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

import { useUpdateSection, useDeleteSection } from '../hooks/mutations'
import * as meta_sectionsApi from '../api/metaSections'
import * as metahubsApi from '../api/metahubs'
import { meta_sectionsQueryKeys, metahubsQueryKeys } from '../api/queryKeys'
import { MetaSection } from '../types'
import metaSectionActions from './MetaSectionActions'

// Type for section update/create data
type SectionData = {
    name: string
    description?: string
}

const SectionList = () => {
    const navigate = useNavigate()
    const { metahubId } = useParams<{ metahubId: string }>()
    // Use metahubs namespace with meta_sections subkey
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    // Use common namespace for table headers and common actions
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useState(localStorage.getItem('metahubsSectionDisplayStyle') || 'card')

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for meta_sections list
    // When metahubId is present, use metahub-scoped API to respect RLS
    const paginationResult = usePaginated<MetaSection, 'name' | 'created' | 'updated'>({
        queryKeyFn: metahubId ? (params) => metahubsQueryKeys.meta_sectionsList(metahubId, params) : meta_sectionsQueryKeys.list,
        queryFn: metahubId ? (params) => metahubsApi.listMetahubMetaSections(metahubId, params) : meta_sectionsApi.listMetaSections,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!metahubId
    })

    const { data: meta_sections, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        section: MetaSection | null
    }>({ open: false, section: null })

    const { confirm } = useConfirm()

    const updateSectionMutation = useUpdateSection()
    const deleteSectionMutation = useDeleteSection()

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(meta_sections)) {
            meta_sections.forEach((section) => {
                if (section?.id) {
                    imagesMap[section.id] = []
                }
            })
        }
        return imagesMap
    }, [meta_sections])

    const sectionColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left',
                render: (row: MetaSection) => (
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
                render: (row: MetaSection) => (
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
                id: 'meta_entities',
                label: tc('table.meta_entities', 'MetaEntities'),
                width: '20%',
                align: 'center',
                render: (row: MetaSection) => (typeof row.meta_entitiesCount === 'number' ? row.meta_entitiesCount : '—')
            }
        ],
        [tc]
    )

    const createSectionContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    await updateSectionMutation.mutateAsync({ id, data: patch })
                },
                deleteEntity: async (id: string) => {
                    await deleteSectionMutation.mutateAsync(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation - invalidate both metahub-scoped and global lists
                    if (metahubId) {
                        await queryClient.invalidateQueries({
                            queryKey: metahubsQueryKeys.meta_sections(metahubId)
                        })
                    }
                    await queryClient.invalidateQueries({
                        queryKey: meta_sectionsQueryKeys.lists()
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
                openDeleteDialog: (section: MetaSection) => {
                    setDeleteDialogState({ open: true, section })
                }
            }
        }),
        [confirm, deleteSectionMutation, enqueueSnackbar, metahubId, queryClient, updateSectionMutation]
    )

    // Validate metahubId from URL AFTER all hooks
    if (!metahubId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid metahub'
                title={t('metahubs:errors.invalidMetahub')}
                description={t('metahubs:errors.pleaseSelectMetahub')}
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

    const handleCreateSection = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await meta_sectionsApi.createSection({
                name: data.name,
                description: data.description,
                metahubId: metahubId
            })

            // Invalidate cache to refetch meta_sections list (both metahub-scoped and global)
            if (metahubId) {
                await queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.meta_sections(metahubId)
                })
            }
            await queryClient.invalidateQueries({
                queryKey: meta_sectionsQueryKeys.lists()
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
                    : t('meta_sections.saveError')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create section', e)
        } finally {
            setCreating(false)
        }
    }

    const goToSection = (section: MetaSection) => {
        navigate(`/meta_sections/${section.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('metahubsSectionDisplayStyle', nextView)
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
                        searchPlaceholder={t('meta_sections.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('meta_sections.title')}
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

                    {isLoading && meta_sections.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && meta_sections.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No meta_sections' title={t('meta_sections.noMetaSectionsFound')} />
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
                                    {meta_sections.map((section: MetaSection) => {
                                        // Filter actions based on permissions
                                        const descriptors = metaSectionActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return section.permissions?.editContent
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={section.id}
                                                data={section}
                                                images={images[section.id] || []}
                                                onClick={() => goToSection(section)}
                                                footerEndContent={
                                                    typeof section.meta_entitiesCount === 'number' ? (
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {t('metahubs:meta_sections.entityCount', { count: section.meta_entitiesCount })}
                                                        </Typography>
                                                    ) : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<MetaSection, SectionData>
                                                                entity={section}
                                                                entityKind='section'
                                                                descriptors={descriptors}
                                                                namespace='metahubs'
                                                                i18nInstance={i18n}
                                                                createContext={createSectionContext}
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
                                        data={meta_sections}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: MetaSection) => (row?.id ? `/meta_sections/${row.id}` : undefined)}
                                        customColumns={sectionColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: MetaSection) => {
                                            const descriptors = metaSectionActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.editContent
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<MetaSection, SectionData>
                                                    entity={row}
                                                    entityKind='section'
                                                    descriptors={descriptors}
                                                    namespace='metahubs'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createSectionContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && meta_sections.length > 0 && (
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
                title={t('meta_sections.createSection', 'Create MetaSection')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateSection}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('meta_sections.confirmDelete')}
                description={t('meta_sections.confirmDeleteDescription', { name: deleteDialogState.section?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, section: null })}
                onConfirm={async () => {
                    if (deleteDialogState.section) {
                        try {
                            await deleteSectionMutation.mutateAsync(deleteDialogState.section.id)
                            setDeleteDialogState({ open: false, section: null })
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
                                    : t('meta_sections.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, section: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default SectionList
