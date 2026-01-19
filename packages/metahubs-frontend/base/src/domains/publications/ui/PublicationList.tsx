import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton, Chip, Alert } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import InfoIcon from '@mui/icons-material/Info'
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
    useDebouncedSearch,
    PaginationControls,
    FlowListTable,
    gridSpacing,
    ConfirmDialog,
    useConfirm,
    LocalizedInlineField
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps, PaginationState, PaginationActions } from '@universo/template-mui'

import { useCreatePublication, useDeletePublication, useSyncPublication, useUpdatePublication } from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import { usePublicationsList } from '../hooks/usePublications'
import { useMetahubDetails } from '../../metahubs'
import type { Publication, PublicationAccessMode } from '../api'
import { invalidatePublicationsQueries } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { getVLCString, type PublicationDisplay } from '../../../types'
import { extractLocalizedInput, hasPrimaryContent } from '../../../utils/localizedInput'
import publicationActions from './PublicationActions'
import { AccessPanel } from './AccessPanel'
import { ApplicationsCreatePanel } from './ApplicationsCreatePanel'

type PublicationFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
}

type PublicationFormFieldsProps = {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors: Record<string, string>
    uiLocale: string
    nameLabel: string
    descriptionLabel: string
}

const PublicationFormFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel
}: PublicationFormFieldsProps) => {
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null

    return (
        <Stack spacing={2}>
            <LocalizedInlineField
                mode='localized'
                label={nameLabel}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next) => setValue('nameVlc', next)}
                error={errors.nameVlc || null}
                helperText={errors.nameVlc}
                uiLocale={uiLocale}
            />
            <LocalizedInlineField
                mode='localized'
                label={descriptionLabel}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
            />
        </Stack>
    )
}

const PublicationList = () => {
    const navigate = useNavigate()
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.PUBLICATION_DISPLAY_STYLE)

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use publications list hook
    const { data: publicationsResponse, isLoading, error, refetch } = usePublicationsList(metahubId ?? '', {
        enabled: !!metahubId
    })

    // Fetch metahub details for the create dialog's Metahub tab
    const { data: metahub, isLoading: isMetahubLoading } = useMetahubDetails(metahubId ?? '', {
        enabled: !!metahubId
    })

    const publications = publicationsResponse?.items ?? []

    // Local (client-side) search + pagination.
    // Backend list endpoint currently returns all items, so we slice/filter here.
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [searchQuery, setSearchQuery] = useState('')

    const setSearch = useCallback((nextSearch: string) => {
        setSearchQuery(nextSearch)
        setCurrentPage(1)
    }, [])

    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: setSearch,
        delay: 0
    })

    const filteredPublications = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return publications

        return publications.filter((publication) => {
            const name = (getVLCString(publication.name, i18n.language) || '').toLowerCase()
            const description = (getVLCString(publication.description, i18n.language) || '').toLowerCase()
            const schemaName = (publication.schemaName || '').toLowerCase()
            return name.includes(query) || description.includes(query) || schemaName.includes(query)
        })
    }, [publications, i18n.language, searchQuery])

    const totalItems = filteredPublications.length
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0

    useEffect(() => {
        if (totalPages === 0) {
            if (currentPage !== 1) setCurrentPage(1)
            return
        }
        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])

    const visiblePublications = useMemo(() => {
        if (totalItems === 0) return []
        const start = (currentPage - 1) * pageSize
        return filteredPublications.slice(start, start + pageSize)
    }, [currentPage, filteredPublications, pageSize, totalItems])

    const pagination: PaginationState = useMemo(
        () => ({
            currentPage,
            pageSize,
            totalItems,
            totalPages,
            hasNextPage: totalPages > 0 ? currentPage < totalPages : false,
            hasPreviousPage: currentPage > 1,
            search: searchQuery
        }),
        [currentPage, pageSize, searchQuery, totalItems, totalPages]
    )

    const paginationActions: PaginationActions = useMemo(
        () => ({
            goToPage: (page: number) => {
                if (totalPages === 0) {
                    setCurrentPage(1)
                    return
                }
                const safePage = Math.max(1, Math.min(page, totalPages))
                setCurrentPage(safePage)
            },
            nextPage: () => {
                if (totalPages === 0) return
                setCurrentPage((p) => Math.min(p + 1, totalPages))
            },
            previousPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
            setSearch,
            setSort: () => undefined,
            setPageSize: (nextSize: number) => {
                const safeSize = Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 20
                setPageSize(safeSize)
                setCurrentPage(1)
            }
        }),
        [setSearch, totalPages]
    )

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        publication: Publication | null
    }>({ open: false, publication: null })

    const { confirm } = useConfirm()

    const createPublicationMutation = useCreatePublication()
    const updatePublicationMutation = useUpdatePublication()
    const deletePublicationMutation = useDeletePublication()
    const syncPublicationMutation = useSyncPublication()

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(publications)) {
            publications.forEach((publication) => {
                if (publication?.id) {
                    imagesMap[publication.id] = []
                }
            })
        }
        return imagesMap
    }, [publications])

    const publicationMap = useMemo(() => {
        if (!Array.isArray(publications)) return new Map<string, Publication>()
        return new Map(publications.map((publication) => [publication.id, publication]))
    }, [publications])

    const localizedFormDefaults = useMemo<PublicationFormValues>(
        () => ({ nameVlc: null, descriptionVlc: null }),
        []
    )

    const validatePublicationForm = useCallback(
        (values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [tc]
    )

    const canSavePublicationForm = useCallback((values: Record<string, any>) => {
        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
        return hasPrimaryContent(nameVlc)
    }, [])

    /**
     * Build tabs configuration for create dialog.
     * Tab 1: General (name, description)
     * Tab 2: Access (access mode configuration)
     * Tab 3: Applications (auto-create application option)
     * 
     * Note: Metahubs tab is not shown because Publication is created within a Metahub context.
     */
    const buildCreateTabs = useCallback(
        ({
            values,
            setValue,
            isLoading: isFormLoading,
            errors
        }: {
            values: Record<string, any>
            setValue: (name: string, value: any) => void
            isLoading: boolean
            errors: Record<string, string>
        }): TabConfig[] => {
            const fieldErrors = errors ?? {}
            
            return [
                {
                    id: 'general',
                    label: t('publications.tabs.general', 'Основное'),
                    content: (
                        <PublicationFormFields
                            values={values}
                            setValue={setValue}
                            isLoading={isFormLoading}
                            errors={fieldErrors}
                            uiLocale={i18n.language}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                        />
                    )
                },
                {
                    id: 'access',
                    label: t('publications.tabs.access', 'Доступ'),
                    content: (
                        <AccessPanel
                            accessMode={(values.accessMode as PublicationAccessMode) ?? 'full'}
                            onChange={(mode) => setValue('accessMode', mode)}
                            isLoading={isFormLoading}
                            disabled={isFormLoading}
                        />
                    )
                },
                {
                    id: 'applications',
                    label: t('publications.tabs.applications', 'Приложения'),
                    content: (
                        <ApplicationsCreatePanel
                            autoCreateApplication={Boolean(values.autoCreateApplication)}
                            onChange={(autoCreate) => setValue('autoCreateApplication', autoCreate)}
                            isLoading={isFormLoading}
                            disabled={isFormLoading}
                        />
                    )
                }
            ]
        },
        [i18n.language, t, tc]
    )

    // Access mode chip colors
    const accessModeColors: Record<'full' | 'restricted', 'success' | 'warning'> = {
        full: 'success',
        restricted: 'warning'
    }

    const publicationColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '35%',
                align: 'left' as const,
                render: (row: PublicationDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 500,
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.name || '—'}
                    </Typography>
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '45%',
                align: 'left' as const,
                render: (row: PublicationDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.description || '—'}
                    </Typography>
                )
            },
            {
                id: 'accessMode',
                label: t('publications.table.accessMode', 'Access'),
                width: '20%',
                align: 'center' as const,
                render: (row: PublicationDisplay) => (
                    <Chip
                        label={t(`publications.accessMode.${row.accessMode}`, row.accessMode === 'full' ? 'Full Access' : 'Restricted')}
                        color={accessModeColors[row.accessMode]}
                        size="small"
                    />
                )
            }
        ],
        [t, tc]
    )

    const createPublicationContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            publicationMap,
            uiLocale: i18n.language,
            metahubId,
            metahub, // Pass metahub for MetahubInfoPanel in edit dialog
            isMetahubLoading, // Pass loading state for metahub
            api: {
                updateEntity: async (id: string, data: any) => {
                    if (!metahubId) return
                    await updatePublicationMutation.mutateAsync({ metahubId, publicationId: id, data })
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId) return
                    await deletePublicationMutation.mutateAsync({ metahubId, publicationId: id })
                },
                syncEntity: async (id: string, confirmDestructive?: boolean) => {
                    if (!metahubId) return
                    await syncPublicationMutation.mutateAsync({ metahubId, publicationId: id, confirmDestructive })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId) {
                        await invalidatePublicationsQueries.all(queryClient, metahubId)
                    }
                },
                openDeleteDialog: (entity: PublicationDisplay) => {
                    // Find the original publication from the map
                    const publication = publicationMap.get(entity.id)
                    if (publication) {
                        setDeleteDialogState({ open: true, publication })
                    }
                },
                confirm: async (spec: any) => {
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
                navigate
            }
        }),
        [publicationMap, confirm, deletePublicationMutation, enqueueSnackbar, i18n.language, isMetahubLoading, metahub, metahubId, navigate, queryClient, setDeleteDialogState, syncPublicationMutation, updatePublicationMutation]
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

    const handleCreatePublication = async (data: Record<string, any>) => {
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

            await createPublicationMutation.mutateAsync({
                metahubId: metahubId!,
                data: {
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale,
                    autoCreateApplication: Boolean(data.autoCreateApplication)
                }
            })

            await invalidatePublicationsQueries.all(queryClient, metahubId!)
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
                    : t('publications.messages.createError')
            setDialogError(message)
            console.error('Failed to create publication', e)
        } finally {
            setCreating(false)
        }
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    // Transform Publication data for display
    const getPublicationCardData = (publication: Publication): PublicationDisplay => ({
        id: publication.id,
        name: getVLCString(publication.name, i18n.language) || '',
        description: getVLCString(publication.description, i18n.language) || '',
        accessMode: publication.accessMode ?? 'full'
    })

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
                        label: t('common:actions.retry', 'Retry'),
                        onClick: () => refetch()
                    }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder={t('publications.searchPlaceholder')}
                        title={t('publications.title')}
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
                                startIcon: <AddRoundedIcon />,
                                disabled: publications.length > 0
                            }}
                        />
                    </ViewHeader>

                    {/* Info banner: temporary single-publication limit - shown below header, above content */}
                    {publications.length > 0 && (
                        <Alert
                            severity="info"
                            icon={<InfoIcon />}
                            sx={{
                                mx: { xs: -1.5, md: -2 },
                                mt: 0,
                                mb: 2
                            }}
                        >
                            {t('publications.singlePublicationLimit', 'Currently, only one Publication per Metahub is supported. Also, after creating a Publication, it cannot be deleted separately, only together with the entire Metahub. In future versions of Universo Platformo, these restrictions will be removed.')}
                        </Alert>
                    )}

                    {isLoading && publications.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && totalItems === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No publications'
                            title={searchQuery.trim() ? t('publications.noResults') : t('publications.empty')}
                            description={searchQuery.trim() ? t('publications.noResultsDescription') : t('publications.emptyDescription')}
                        />
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
                                    {visiblePublications.map((publication: Publication) => {
                                        const descriptors = [...publicationActions]
                                        const cardData = getPublicationCardData(publication)

                                        return (
                                            <ItemCard
                                                key={publication.id}
                                                data={cardData}
                                                images={images[publication.id] || []}
                                                footerEndContent={
                                                    <Chip
                                                        label={t(`publications.accessMode.${cardData.accessMode}`, cardData.accessMode === 'full' ? 'Full Access' : 'Restricted')}
                                                        color={cardData.accessMode === 'full' ? 'success' : 'warning'}
                                                        size="small"
                                                    />
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<PublicationDisplay, Record<string, any>>
                                                                entity={cardData}
                                                                entityKind='publication'
                                                                descriptors={descriptors}
                                                                namespace='metahubs'
                                                                i18nInstance={i18n}
                                                                createContext={createPublicationContext}
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
                                        data={visiblePublications.map(getPublicationCardData)}
                                        images={images}
                                        isLoading={isLoading}
                                        customColumns={publicationColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: any) => {
                                            const originalPublication = publications.find((a) => a.id === row.id)
                                            if (!originalPublication) return null

                                            const descriptors = [...publicationActions]
                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<PublicationDisplay, Record<string, any>>
                                                    entity={getPublicationCardData(originalPublication)}
                                                    entityKind='publication'
                                                    descriptors={descriptors}
                                                    namespace='metahubs'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createPublicationContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}

                            {totalItems > 0 && (
                                <Box sx={{ mx: { xs: -1.5, md: -2 }, mt: 2 }}>
                                    <PaginationControls
                                        pagination={pagination}
                                        actions={paginationActions}
                                        isLoading={isLoading}
                                        rowsPerPageOptions={[10, 20, 50, 100]}
                                        namespace='common'
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </Stack>
            )}

            <EntityFormDialog
                open={isDialogOpen}
                title={t('publications.createDialog.title', 'Create Publication')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreatePublication}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                tabs={buildCreateTabs}
                validate={validatePublicationForm}
                canSave={canSavePublicationForm}
            />

            {/* Independent ConfirmDeleteDialog for Publications */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('publications.deleteDialog.title')}
                description={t('publications.deleteDialog.warning')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, publication: null })}
                onConfirm={async () => {
                    if (deleteDialogState.publication && metahubId) {
                        try {
                            await deletePublicationMutation.mutateAsync({
                                metahubId,
                                publicationId: deleteDialogState.publication.id
                            })
                            await invalidatePublicationsQueries.all(queryClient, metahubId)
                            setDeleteDialogState({ open: false, publication: null })
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
                                    : t('publications.messages.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, publication: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default PublicationList
