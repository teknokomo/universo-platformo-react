import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'
import type { VersionedLocalizedContent } from '@universo/types'

// project imports
// Use the new template-mui ItemCard (JS component) for consistency with Uniks
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
    useConfirm,
    RoleChip,
    useUserSettings,
    LocalizedInlineField
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useUpdateMetahub, useDeleteMetahub } from '../hooks/mutations'
import { useViewPreference } from '../hooks/useViewPreference'
import { STORAGE_KEYS } from '../constants/storage'
import * as metahubsApi from '../api/metahubs'
import { metahubsQueryKeys } from '../api/queryKeys'
import { Metahub, MetahubDisplay, MetahubLocalizedPayload, toMetahubDisplay } from '../types'
import metahubActions from './MetahubActions'
import { extractLocalizedInput, hasPrimaryContent } from '../utils/localizedInput'

// Type for metahub update/create data
type MetahubFormValues = {
    nameVlc?: VersionedLocalizedContent<string> | null
    descriptionVlc?: VersionedLocalizedContent<string> | null
}

const MetahubList = () => {
    // Use metahubs namespace for view-specific keys, roles and access for role/permission labels
    const { t, i18n } = useTranslation(['metahubs', 'roles', 'access', 'flowList'])
    // Use common namespace for table headers and common actions (with keyPrefix for cleaner usage)
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.METAHUB_DISPLAY_STYLE)

    // Get user settings for showAll preference
    const { settings } = useUserSettings()
    const showAll = settings.admin?.showAllItems ?? false

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Create query function that includes showAll parameter
    const queryFnWithShowAll = useCallback((params: any) => metahubsApi.listMetahubs({ ...params, showAll }), [showAll])

    // Use paginated hook for metahubs list
    const paginationResult = usePaginated<Metahub, 'name' | 'created' | 'updated'>({
        queryKeyFn: (params) => [...metahubsQueryKeys.list(params), { showAll }],
        queryFn: queryFnWithShowAll,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: metahubs, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog (not managed by BaseEntityMenu)
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        metahub: MetahubDisplay | null
    }>({ open: false, metahub: null })

    const { confirm } = useConfirm()

    const updateMetahubMutation = useUpdateMetahub()
    const deleteMetahubMutation = useDeleteMetahub()

    // Convert metahubs to display format
    const metahubsDisplay = useMemo(() => {
        if (!Array.isArray(metahubs)) return []
        const currentLocale = i18n.language
        return metahubs.map((metahub) => toMetahubDisplay(metahub, currentLocale))
    }, [metahubs, i18n.language])

    const metahubMap = useMemo(() => {
        if (!Array.isArray(metahubs)) return new Map<string, Metahub>()
        return new Map(metahubs.map((metahub) => [metahub.id, metahub]))
    }, [metahubs])

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(metahubsDisplay)) {
            metahubsDisplay.forEach((metahub) => {
                if (metahub?.id) {
                    imagesMap[metahub.id] = []
                }
            })
        }
        return imagesMap
    }, [metahubsDisplay])

    const localizedFormDefaults = useMemo<MetahubFormValues>(() => ({ nameVlc: null, descriptionVlc: null }), [])

    const renderLocalizedFields = useCallback(
        ({
            values,
            setValue,
            isLoading,
            errors
        }: {
            values: Record<string, any>
            setValue: (name: string, value: any) => void
            isLoading: boolean
            errors?: Record<string, string>
        }) => {
            const fieldErrors = errors ?? {}
            const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            return (
                <>
                    <LocalizedInlineField
                        mode='localized'
                        label={tc('fields.name', 'Name')}
                        required
                        disabled={isLoading}
                        value={nameVlc}
                        onChange={(next) => setValue('nameVlc', next)}
                        error={fieldErrors.nameVlc || null}
                        helperText={fieldErrors.nameVlc}
                        uiLocale={i18n.language}
                    />
                    <LocalizedInlineField
                        mode='localized'
                        label={tc('fields.description', 'Description')}
                        disabled={isLoading}
                        value={descriptionVlc}
                        onChange={(next) => setValue('descriptionVlc', next)}
                        uiLocale={i18n.language}
                        multiline
                        rows={2}
                    />
                </>
            )
        },
        [i18n.language, tc]
    )

    const validateMetahubForm = useCallback(
        (values: Record<string, any>) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                return { nameVlc: tc('crud.nameRequired', 'Name is required') }
            }
            return null
        },
        [tc]
    )

    const canSaveMetahubForm = useCallback((values: Record<string, any>) => {
        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
        return hasPrimaryContent(nameVlc)
    }, [])

    const handleAddNew = () => {
        setDialogError(null)
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateMetahub = async (data: Record<string, any>) => {
        setDialogError(null)
        setCreating(true)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setDialogError(tc('crud.nameRequired', 'Name is required'))
                return
            }
            const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

            await metahubsApi.createMetahub({
                name: nameInput,
                description: descriptionInput,
                namePrimaryLocale,
                descriptionPrimaryLocale
            })

            // Invalidate cache to refetch metahubs list
            await queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.lists()
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
                    : t('errors.saveFailed')
            setDialogError(message)
            // eslint-disable-next-line no-console
            console.error('Failed to create metahub', e)
        } finally {
            setCreating(false)
        }
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const metahubColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: MetahubDisplay) => (
                    <Link to={`/metahub/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Typography
                            sx={{
                                fontSize: 14,
                                fontWeight: 500,
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                '&:hover': {
                                    textDecoration: 'underline',
                                    color: 'primary.main'
                                }
                            }}
                        >
                            {row.name || '—'}
                        </Typography>
                    </Link>
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '26%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: MetahubDisplay) => (
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
                label: tc('table.role', 'Role'),
                width: '10%',
                align: 'center' as const,
                render: (row: MetahubDisplay) => (row.role ? <RoleChip role={row.role} accessType={row.accessType} /> : '—')
            },
            {
                id: 'hubs',
                label: t('table.hubs'),
                width: '10%',
                align: 'center' as const,
                render: (row: MetahubDisplay) => (typeof row.hubsCount === 'number' ? row.hubsCount : '—')
            },
            {
                id: 'catalogs',
                label: t('table.catalogs'),
                width: '10%',
                align: 'center' as const,
                render: (row: MetahubDisplay) => (typeof row.catalogsCount === 'number' ? row.catalogsCount : '—')
            }
        ],
        [t, tc]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createMetahubContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            metahubMap,
            uiLocale: i18n.language,
            api: {
                updateEntity: async (id: string, patch: MetahubLocalizedPayload) => {
                    await updateMetahubMutation.mutateAsync({ id, data: patch })
                },
                deleteEntity: async (id: string) => {
                    await deleteMetahubMutation.mutateAsync(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.lists()
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
                openDeleteDialog: (metahub: MetahubDisplay) => {
                    setDeleteDialogState({ open: true, metahub })
                }
            }
        }),
        [confirm, deleteMetahubMutation, enqueueSnackbar, i18n.language, metahubMap, queryClient, updateMetahubMutation]
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
                        searchPlaceholder={t('searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('title')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            settingsEnabled
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

                    {isLoading && metahubsDisplay.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && metahubsDisplay.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No metahubs' title={t('noMetahubsFound')} />
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
                                    {metahubsDisplay.map((metahub: MetahubDisplay) => {
                                        // Filter actions based on permissions (same logic as table view)
                                        const descriptors = metahubActions.filter((descriptor) => {
                                            if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                return metahub.permissions?.manageMetahub
                                            }
                                            return true
                                        })

                                        return (
                                            <ItemCard
                                                key={metahub.id}
                                                data={metahub}
                                                images={images[metahub.id] || []}
                                                href={`/metahub/${metahub.id}`}
                                                footerEndContent={
                                                    metahub.role ? <RoleChip role={metahub.role} accessType={metahub.accessType} /> : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<MetahubDisplay, MetahubLocalizedPayload>
                                                                entity={metahub}
                                                                entityKind='metahub'
                                                                descriptors={descriptors}
                                                                namespace='metahubs'
                                                                i18nInstance={i18n}
                                                                createContext={createMetahubContext}
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
                                        data={metahubsDisplay}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: MetahubDisplay) => (row?.id ? `/metahub/${row.id}` : undefined)}
                                        customColumns={metahubColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: MetahubDisplay) => {
                                            const descriptors = metahubActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete') {
                                                    return row.permissions?.manageMetahub
                                                }
                                                return true
                                            })

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<MetahubDisplay, MetahubLocalizedPayload>
                                                    entity={row}
                                                    entityKind='metahub'
                                                    descriptors={descriptors}
                                                    // Use metahubs namespace for action item labels (edit/delete)
                                                    // but keep the button label from flowList via explicit namespaced key
                                                    namespace='metahubs'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createMetahubContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && metahubsDisplay.length > 0 && (
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
                title={t('createMetahub', 'Create Metahub')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateMetahub}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                extraFields={renderLocalizedFields}
                canSave={canSaveMetahubForm}
                validate={validateMetahubForm}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('confirmDelete')}
                description={t('confirmDeleteDescription', { name: deleteDialogState.metahub?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, metahub: null })}
                onConfirm={async () => {
                    if (deleteDialogState.metahub) {
                        try {
                            await deleteMetahubMutation.mutateAsync(deleteDialogState.metahub.id)
                            setDeleteDialogState({ open: false, metahub: null })
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
                                    : t('deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, metahub: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default MetahubList
