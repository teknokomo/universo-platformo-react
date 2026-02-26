import { useState, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
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
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { ActionDescriptor } from '@universo/template-mui'

import { useUpdateApplication, useDeleteApplication, useCopyApplication } from '../hooks/mutations'
import { useViewPreference } from '../hooks/useViewPreference'
import { STORAGE_KEYS } from '../constants/storage'
import * as applicationsApi from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'
import { Application, ApplicationDisplay, ApplicationLocalizedPayload, toApplicationDisplay } from '../types'
import { isOptimisticLockConflict, extractConflictInfo, type ConflictInfo } from '@universo/utils'
import applicationActions from './ApplicationActions'
import { extractLocalizedInput, hasPrimaryContent } from '../utils/localizedInput'

// Type for application update/create data
type ApplicationFormValues = {
    nameVlc?: VersionedLocalizedContent<string> | null
    descriptionVlc?: VersionedLocalizedContent<string> | null
}

const ADMIN_PANEL_ROLES = new Set(['owner', 'admin', 'editor'])

const ApplicationList = () => {
    // Use applications namespace for view-specific keys, roles and access for role/permission labels
    const { t, i18n } = useTranslation(['applications', 'roles', 'access', 'flowList'])
    // Use common namespace for table headers and common actions (with keyPrefix for cleaner usage)
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.APPLICATION_DISPLAY_STYLE)

    // Get user settings for showAll preference
    const { settings } = useUserSettings()
    const showAll = settings.admin?.showAllItems ?? false

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Create query function that includes showAll parameter
    const queryFnWithShowAll = useCallback((params: any) => applicationsApi.listApplications({ ...params, showAll }), [showAll])

    // Use paginated hook for applications list
    const paginationResult = usePaginated<Application, 'name' | 'created' | 'updated'>({
        queryKeyFn: (params) => [...applicationsQueryKeys.list(params), { showAll }],
        queryFn: queryFnWithShowAll,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: applications, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog (not managed by BaseEntityMenu)
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        application: ApplicationDisplay | null
    }>({ open: false, application: null })

    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        pendingUpdate: { id: string; patch: ApplicationLocalizedPayload } | null
    }>({ open: false, conflict: null, pendingUpdate: null })

    const { confirm } = useConfirm()

    const updateApplicationMutation = useUpdateApplication()
    const deleteApplicationMutation = useDeleteApplication()
    const copyApplicationMutation = useCopyApplication()

    // Convert applications to display format
    const applicationsDisplay = useMemo(() => {
        if (!Array.isArray(applications)) return []
        const currentLocale = i18n.language
        return applications.map((application) => toApplicationDisplay(application, currentLocale))
    }, [applications, i18n.language])

    const applicationMap = useMemo(() => {
        if (!Array.isArray(applications)) return new Map<string, Application>()
        return new Map(applications.map((application) => [application.id, application]))
    }, [applications])

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(applicationsDisplay)) {
            applicationsDisplay.forEach((application) => {
                if (application?.id) {
                    imagesMap[application.id] = []
                }
            })
        }
        return imagesMap
    }, [applicationsDisplay])

    const localizedFormDefaults = useMemo<ApplicationFormValues>(() => ({ nameVlc: null, descriptionVlc: null }), [])

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

    const validateApplicationForm = useCallback(
        (values: Record<string, any>) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                return { nameVlc: tc('crud.nameRequired', 'Name is required') }
            }
            return null
        },
        [tc]
    )

    const canSaveApplicationForm = useCallback((values: Record<string, any>) => {
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

    const handleCreateApplication = async (data: Record<string, any>) => {
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

            await applicationsApi.createApplication({
                name: nameInput,
                description: descriptionInput,
                namePrimaryLocale,
                descriptionPrimaryLocale
            })

            // Invalidate cache to refetch applications list
            await queryClient.invalidateQueries({
                queryKey: applicationsQueryKeys.lists()
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
            console.error('Failed to create application', e)
        } finally {
            setCreating(false)
        }
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const applicationColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ApplicationDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: ApplicationDisplay) => (
                    <Link to={`/a/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
                sortAccessor: (row: ApplicationDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: ApplicationDisplay) => (
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
                render: (row: ApplicationDisplay) => (row.role ? <RoleChip role={row.role} accessType={row.accessType} /> : '—')
            },
            {
                id: 'connectors',
                label: t('table.connectors'),
                width: '10%',
                align: 'center' as const,
                render: (row: ApplicationDisplay) => (typeof row.connectorsCount === 'number' ? row.connectorsCount : '—')
            }
        ],
        [t, tc]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createApplicationContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            navigate,
            applicationMap,
            uiLocale: i18n.language,
            api: {
                updateEntity: async (id: string, patch: ApplicationLocalizedPayload) => {
                    const application = applicationMap.get(id)
                    const expectedVersion = application?.version
                    try {
                        await updateApplicationMutation.mutateAsync({ id, data: { ...patch, expectedVersion } })
                    } catch (error: unknown) {
                        if (isOptimisticLockConflict(error)) {
                            const conflict = extractConflictInfo(error)
                            if (conflict) {
                                setConflictState({ open: true, conflict, pendingUpdate: { id, patch } })
                                return
                            }
                        }
                        throw error
                    }
                },
                deleteEntity: async (id: string) => {
                    await deleteApplicationMutation.mutateAsync(id)
                },
                copyEntity: async (
                    id: string,
                    payload: {
                        name?: Record<string, string>
                        description?: Record<string, string>
                        namePrimaryLocale?: string
                        descriptionPrimaryLocale?: string
                        copyConnector?: boolean
                        createSchema?: boolean
                        copyAccess?: boolean
                    }
                ) => {
                    await copyApplicationMutation.mutateAsync({ id, data: payload })
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: applicationsQueryKeys.lists()
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
                openDeleteDialog: (application: ApplicationDisplay) => {
                    setDeleteDialogState({ open: true, application })
                }
            }
        }),
        [
            confirm,
            copyApplicationMutation,
            deleteApplicationMutation,
            enqueueSnackbar,
            i18n.language,
            applicationMap,
            navigate,
            queryClient,
            updateApplicationMutation
        ]
    )

    const buildApplicationMenuDescriptors = useCallback(
        (application: ApplicationDisplay): ActionDescriptor<ApplicationDisplay, ApplicationLocalizedPayload>[] => {
            if (!application.role || !ADMIN_PANEL_ROLES.has(application.role)) return []

            const deleteDescriptor = applicationActions.find((descriptor) => descriptor.id === 'delete')
            const shouldShowDelete = Boolean(deleteDescriptor && application.role === 'owner')
            const editDescriptor = applicationActions.find((descriptor) => descriptor.id === 'edit')
            const copyDescriptor = applicationActions.find((descriptor) => descriptor.id === 'copy')

            const descriptors: ActionDescriptor<ApplicationDisplay, ApplicationLocalizedPayload>[] = [
                {
                    id: 'control-panel',
                    labelKey: 'actions.controlPanel',
                    icon: <SettingsRoundedIcon />,
                    order: 10,
                    onSelect: (ctx) => {
                        ctx.navigate?.(`/a/${ctx.entity.id}/admin`)
                    },
                    dividerAfter: Boolean(editDescriptor || copyDescriptor || shouldShowDelete)
                }
            ]

            if (editDescriptor) {
                descriptors.push({
                    ...editDescriptor,
                    dividerAfter: false,
                    order: 100,
                    // Avoid implicit grouping dividers: we control separators explicitly via dividerAfter.
                    group: undefined
                })
            }

            if (copyDescriptor) {
                descriptors.push({
                    ...copyDescriptor,
                    dividerAfter: shouldShowDelete,
                    order: 105,
                    group: undefined
                })
            }

            if (deleteDescriptor && shouldShowDelete) {
                descriptors.push({
                    ...deleteDescriptor,
                    // Avoid implicit grouping dividers: we control separators explicitly via dividerAfter.
                    group: undefined,
                    order: 110
                })
            }

            return descriptors
        },
        []
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
                                label: tc('create'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {isLoading && applicationsDisplay.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && applicationsDisplay.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No applications' title={t('noApplicationsFound')} />
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
                                    {applicationsDisplay.map((application: ApplicationDisplay) => {
                                        // Filter actions based on permissions (same logic as table view)
                                        const descriptors = buildApplicationMenuDescriptors(application)

                                        return (
                                            <ItemCard
                                                key={application.id}
                                                data={application}
                                                images={images[application.id] || []}
                                                href={`/a/${application.id}`}
                                                footerEndContent={
                                                    application.role ? (
                                                        <RoleChip role={application.role} accessType={application.accessType} />
                                                    ) : null
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<ApplicationDisplay, ApplicationLocalizedPayload>
                                                                entity={application}
                                                                entityKind='application'
                                                                descriptors={descriptors}
                                                                namespace='applications'
                                                                i18nInstance={i18n}
                                                                createContext={createApplicationContext}
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
                                        data={applicationsDisplay}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: ApplicationDisplay) => (row?.id ? `/a/${row.id}` : undefined)}
                                        customColumns={applicationColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: ApplicationDisplay) => {
                                            const descriptors = buildApplicationMenuDescriptors(row)

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<ApplicationDisplay, ApplicationLocalizedPayload>
                                                    entity={row}
                                                    entityKind='application'
                                                    descriptors={descriptors}
                                                    // Use applications namespace for action item labels (edit/delete)
                                                    // but keep the button label from flowList via explicit namespaced key
                                                    namespace='applications'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createApplicationContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && applicationsDisplay.length > 0 && (
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
                title={t('createApplication', 'Create Application')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.create', 'Create')}
                savingButtonText={tc('actions.creating', 'Creating...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateApplication}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                extraFields={renderLocalizedFields}
                canSave={canSaveApplicationForm}
                validate={validateApplicationForm}
            />

            {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('confirmDelete')}
                description={t('confirmDeleteDescription', { name: deleteDialogState.application?.name || '' })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, application: null })}
                onConfirm={async () => {
                    if (deleteDialogState.application) {
                        try {
                            await deleteApplicationMutation.mutateAsync(deleteDialogState.application.id)
                            setDeleteDialogState({ open: false, application: null })
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
                            setDeleteDialogState({ open: false, application: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />

            <ConflictResolutionDialog
                open={conflictState.open}
                conflict={conflictState.conflict}
                onCancel={() => {
                    setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
                }}
                onOverwrite={async () => {
                    if (conflictState.pendingUpdate) {
                        const { id, patch } = conflictState.pendingUpdate
                        await updateApplicationMutation.mutateAsync({ id, data: patch })
                        setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    }
                }}
                isLoading={updateApplicationMutation.isPending}
            />
        </MainCard>
    )
}

export default ApplicationList
