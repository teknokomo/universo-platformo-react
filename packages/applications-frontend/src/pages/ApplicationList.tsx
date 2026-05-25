import { useState, useMemo, useCallback, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Box, Button, ButtonBase, FormControlLabel, Radio, RadioGroup, Skeleton, Stack, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'
import type { AppAbility, VersionedLocalizedContent } from '@universo/types'
import { useHasGlobalAccess } from '@universo/store'

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
    LocalizedInlineField,
    revealPendingEntityFeedback
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'

import {
    useCreateApplication,
    useUpdateApplication,
    useDeleteApplication,
    useCopyApplication,
    useJoinApplication,
    useLeaveApplication
} from '../hooks/mutations'
import { useViewPreference } from '../hooks/useViewPreference'
import { STORAGE_KEYS } from '../constants/storage'
import * as applicationsApi from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'
import { Application, ApplicationDisplay, ApplicationLocalizedPayload, PaginationParams, toApplicationDisplay } from '../types'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import applicationActions from './ApplicationActions'
import { extractLocalizedInput, hasPrimaryContent } from '../utils/localizedInput'

export type ApplicationFormValues = {
    nameVlc?: VersionedLocalizedContent<string> | null
    descriptionVlc?: VersionedLocalizedContent<string> | null
    isPublic?: boolean
}

type ApplicationFormRenderState = {
    values: Record<string, unknown>
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    errors?: Record<string, string>
}

type ConfirmSpec = {
    title?: string
    titleKey?: string
    description?: string
    descriptionKey?: string
    confirmButtonName?: string
    confirmKey?: string
    cancelButtonName?: string
    cancelKey?: string
    interpolate?: Record<string, string | number>
}

type ApplicationActionContext = ActionContext<ApplicationDisplay, ApplicationLocalizedPayload> & {
    navigate?: ReturnType<typeof useNavigate>
    applicationMap?: Map<string, Application>
    uiLocale?: string
    api?: ActionContext<ApplicationDisplay, ApplicationLocalizedPayload>['api'] & {
        copyEntity?: (
            id: string,
            payload: ApplicationLocalizedPayload & {
                copyConnector?: boolean
                createSchema?: boolean
                copyAccess?: boolean
            }
        ) => Promise<void>
    }
}

const hasResponseStatus = (value: unknown): value is { response: { status: number } } => {
    if (!value || typeof value !== 'object') {
        return false
    }

    const response = (value as { response?: unknown }).response
    return Boolean(response && typeof response === 'object' && 'status' in response)
}

const canUseApplicationAbility = (ability: AppAbility | null | undefined, action: 'create' | 'manage') => {
    if (!ability) {
        return false
    }

    if (action === 'manage') {
        return ability.can('manage', 'Application') || ability.can('update', 'Application') || ability.can('delete', 'Application')
    }

    return ability.can('manage', 'Application') || ability.can('create', 'Application')
}

const canManageApplicationRecord = (application: ApplicationDisplay): boolean => {
    if (typeof application.permissions?.manageApplication === 'boolean') {
        return application.permissions.manageApplication
    }

    return application.role === 'owner' || application.role === 'admin'
}

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
    const {
        isSuperuser,
        loading: accessLoading,
        ability
    } = useHasGlobalAccess() as ReturnType<typeof useHasGlobalAccess> & {
        ability?: AppAbility | null
    }
    const canCreateApplications = !accessLoading && (isSuperuser || canUseApplicationAbility(ability, 'create'))

    const [dialogError, setDialogError] = useState<string | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const handlePendingApplicationInteraction = useCallback(
        (applicationId: string) => {
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: applicationsQueryKeys.lists(),
                entityId: applicationId,
                extraQueryKeys: [applicationsQueryKeys.detail(applicationId)]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, pendingInteractionMessage, queryClient]
    )

    // Create query function that includes showAll parameter
    const queryFnWithShowAll = useCallback(
        (params: PaginationParams) => applicationsApi.listApplications({ ...params, showAll }),
        [showAll]
    )

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

    const createApplicationMutation = useCreateApplication()
    const updateApplicationMutation = useUpdateApplication()
    const deleteApplicationMutation = useDeleteApplication()
    const copyApplicationMutation = useCopyApplication()
    const joinApplicationMutation = useJoinApplication()
    const leaveApplicationMutation = useLeaveApplication()

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
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(applicationsDisplay)) {
            applicationsDisplay.forEach((application) => {
                if (application?.id) {
                    imagesMap[application.id] = []
                }
            })
        }
        return imagesMap
    }, [applicationsDisplay])

    const localizedFormDefaults = useMemo<ApplicationFormValues>(() => ({ nameVlc: null, descriptionVlc: null, isPublic: false }), [])

    const renderLocalizedFields = useCallback(
        ({ values, setValue, isLoading, errors }: ApplicationFormRenderState) => {
            const fieldErrors = errors ?? {}
            const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
            const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null

            return (
                <Stack spacing={2}>
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
                </Stack>
            )
        },
        [i18n.language, tc]
    )

    const renderCreateParametersTab = useCallback(
        ({ values, setValue, isLoading }: ApplicationFormRenderState) => {
            const isPublic = values.isPublic === true

            return (
                <Stack spacing={2}>
                    <RadioGroup
                        value={isPublic ? 'public' : 'closed'}
                        onChange={(event) => setValue('isPublic', event.target.value === 'public')}
                    >
                        <FormControlLabel
                            value='closed'
                            control={<Radio />}
                            label={t('visibility.closed', 'Closed')}
                            disabled={isLoading}
                        />
                        <FormControlLabel
                            value='public'
                            control={<Radio />}
                            label={t('visibility.public', 'Public')}
                            disabled={isLoading}
                        />
                    </RadioGroup>
                    <Alert severity='info'>
                        {t('parameters.visibilityHint', 'Application visibility cannot be changed after creation.')}
                    </Alert>
                </Stack>
            )
        },
        [t]
    )

    const validateApplicationForm = useCallback(
        (values: Record<string, unknown>) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                return { nameVlc: tc('crud.nameRequired', 'Name is required') }
            }
            return null
        },
        [tc]
    )

    const canSaveApplicationForm = useCallback((values: Record<string, unknown>) => {
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

    const handleCreateApplication = (data: Record<string, unknown>) => {
        setDialogError(null)
        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        if (!nameInput || !namePrimaryLocale) {
            setDialogError(tc('crud.nameRequired', 'Name is required'))
            return
        }
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

        createApplicationMutation.mutate({
            name: nameInput,
            description: descriptionInput,
            namePrimaryLocale,
            descriptionPrimaryLocale,
            isPublic: data.isPublic === true
        })

        handleDialogSave()
    }

    const handleJoinApplication = useCallback(
        async (application: ApplicationDisplay) => {
            const confirmed = await confirm({
                title: t('join.dialogTitle', { name: application.name || '' }),
                description: application.description || t('join.dialogDescription', 'Join this application to start using it.'),
                confirmButtonName: t('join.action', 'Join'),
                cancelButtonName: tc('actions.cancel', 'Cancel')
            })

            if (!confirmed) {
                return
            }

            joinApplicationMutation.mutate({ id: application.id })
        },
        [confirm, joinApplicationMutation, t, tc]
    )

    const handleLeaveApplication = useCallback(
        async (application: ApplicationDisplay) => {
            const confirmed = await confirm({
                title: t('leave.dialogTitle', { name: application.name || '' }),
                description: t(
                    'leave.dialogDescription',
                    'If you leave this application, your workspace and all related data will be archived and removed from your view.'
                ),
                confirmButtonName: t('leave.action', 'Leave'),
                cancelButtonName: tc('actions.cancel', 'Cancel')
            })

            if (!confirmed) {
                return
            }

            leaveApplicationMutation.mutate({ id: application.id })
        },
        [confirm, leaveApplicationMutation, t, tc]
    )

    const handleChange = (_event: MouseEvent<HTMLElement> | null, nextView: string | null) => {
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
                render: (row: ApplicationDisplay) =>
                    isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingApplicationInteraction(row.id)}
                            sx={{ alignItems: 'flex-start', display: 'inline-flex', justifyContent: 'flex-start', textAlign: 'left' }}
                        >
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
                        </ButtonBase>
                    ) : row.canJoin ? (
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
                    ) : (
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
                render: (row: ApplicationDisplay) =>
                    row.canJoin ? (
                        <Button
                            size='small'
                            variant='outlined'
                            onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                void handleJoinApplication(row)
                            }}
                        >
                            {t('join.action', 'Join')}
                        </Button>
                    ) : row.role ? (
                        <RoleChip role={row.role} accessType={row.accessType} />
                    ) : (
                        '—'
                    )
            },
            {
                id: 'connectors',
                label: t('table.connectors'),
                width: '10%',
                align: 'center' as const,
                render: (row: ApplicationDisplay) => (typeof row.connectorsCount === 'number' ? row.connectorsCount : '—')
            }
        ],
        [handleJoinApplication, handlePendingApplicationInteraction, t, tc]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createApplicationContext = useCallback(
        (baseContext: Partial<ActionContext<ApplicationDisplay, ApplicationLocalizedPayload>>): ApplicationActionContext => ({
            ...baseContext,
            entity: baseContext.entity as ApplicationDisplay,
            entityKind: (baseContext.entityKind ?? 'application') as string,
            t: baseContext.t as ActionContext<ApplicationDisplay, ApplicationLocalizedPayload>['t'],
            navigate,
            applicationMap,
            uiLocale: i18n.language,
            api: {
                updateEntity: (id: string, patch: ApplicationLocalizedPayload) => {
                    const application = applicationMap.get(id)
                    const expectedVersion = application?.version
                    void updateApplicationMutation.mutateAsync({ id, data: { ...patch, expectedVersion } }).catch((error: unknown) => {
                        if (isOptimisticLockConflict(error)) {
                            const conflict = extractConflictInfo(error)
                            if (conflict) {
                                setConflictState({ open: true, conflict, pendingUpdate: { id, patch } })
                            }
                        }
                    })

                    return Promise.resolve()
                },
                deleteEntity: (id: string) => {
                    deleteApplicationMutation.mutate(id)
                    return Promise.resolve()
                },
                copyEntity: (
                    id: string,
                    payload: {
                        name?: Record<string, string>
                        description?: Record<string, string>
                        namePrimaryLocale?: string
                        descriptionPrimaryLocale?: string
                        isPublic?: boolean
                        copyConnector?: boolean
                        createSchema?: boolean
                        copyAccess?: boolean
                    }
                ) => {
                    void copyApplicationMutation.mutateAsync({ id, data: payload }).catch(() => undefined)

                    return Promise.resolve()
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    void queryClient.invalidateQueries({
                        queryKey: applicationsQueryKeys.lists()
                    })
                },
                confirm: async (spec: ConfirmSpec) => {
                    const translate = baseContext.t ?? t
                    // Support both direct strings and translation keys
                    const confirmed = await confirm({
                        title: spec.titleKey ? translate(spec.titleKey, spec.interpolate) : spec.title ?? '',
                        description: spec.descriptionKey ? translate(spec.descriptionKey, spec.interpolate) : spec.description,
                        confirmButtonName: spec.confirmKey
                            ? translate(spec.confirmKey)
                            : spec.confirmButtonName || translate('confirm.delete.confirm'),
                        cancelButtonName: spec.cancelKey
                            ? translate(spec.cancelKey)
                            : spec.cancelButtonName || translate('confirm.delete.cancel')
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
            t,
            updateApplicationMutation
        ]
    )

    const buildApplicationMenuDescriptors = useCallback(
        (application: ApplicationDisplay): ActionDescriptor<ApplicationDisplay, ApplicationLocalizedPayload>[] => {
            const canManageApplication = canManageApplicationRecord(application)

            if (!canManageApplication) {
                if (!application.role) return []

                return [
                    {
                        id: 'use',
                        labelKey: 'memberActions.use',
                        icon: <PlayArrowRoundedIcon />,
                        order: 10,
                        onSelect: (ctx) => {
                            const navigateTo = ctx.navigate as ((path: string) => void) | undefined
                            if (navigateTo) {
                                navigateTo(`/a/${ctx.entity.id}`)
                            }
                        },
                        dividerAfter: application.canLeave === true
                    },
                    ...(application.canLeave
                        ? [
                              {
                                  id: 'leave',
                                  labelKey: 'memberActions.leave',
                                  icon: <LogoutRoundedIcon />,
                                  tone: 'danger' as const,
                                  order: 20,
                                  onSelect: () => {
                                      void handleLeaveApplication(application)
                                  }
                              }
                          ]
                        : [])
                ]
            }

            const deleteDescriptor = applicationActions.find((descriptor) => descriptor.id === 'delete')
            const shouldShowDelete = Boolean(deleteDescriptor && application.role === 'owner')
            const editDescriptor = applicationActions.find((descriptor) => descriptor.id === 'edit')
            const copyDescriptor = applicationActions.find((descriptor) => descriptor.id === 'copy')

            const descriptors: ActionDescriptor<ApplicationDisplay, ApplicationLocalizedPayload>[] = []

            if (canManageApplication) {
                descriptors.push({
                    id: 'control-panel',
                    labelKey: 'actions.controlPanel',
                    icon: <SettingsRoundedIcon />,
                    order: 10,
                    onSelect: (ctx) => {
                        const navigateTo = ctx.navigate as ((path: string) => void) | undefined
                        if (navigateTo) {
                            navigateTo(`/a/${ctx.entity.id}/admin`)
                        }
                    },
                    dividerAfter: Boolean(editDescriptor || copyDescriptor || shouldShowDelete)
                })
            }

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
        [handleLeaveApplication]
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
                    description={!hasResponseStatus(error) ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
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
                            primaryAction={
                                canCreateApplications
                                    ? {
                                          label: tc('create'),
                                          onClick: handleAddNew,
                                          startIcon: <AddRoundedIcon />
                                      }
                                    : undefined
                            }
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
                                                href={application.canJoin ? undefined : `/a/${application.id}`}
                                                pending={isPendingEntity(application)}
                                                pendingAction={getPendingAction(application)}
                                                onPendingInteractionAttempt={() => handlePendingApplicationInteraction(application.id)}
                                                footerEndContent={
                                                    application.canJoin ? (
                                                        <Button
                                                            size='small'
                                                            variant='outlined'
                                                            onClick={(event) => {
                                                                event.preventDefault()
                                                                event.stopPropagation()
                                                                void handleJoinApplication(application)
                                                            }}
                                                        >
                                                            {t('join.action', 'Join')}
                                                        </Button>
                                                    ) : application.role ? (
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
                                        getRowLink={(row: ApplicationDisplay) => (row?.id && !row.canJoin ? `/a/${row.id}` : undefined)}
                                        onPendingInteractionAttempt={(row: ApplicationDisplay) =>
                                            handlePendingApplicationInteraction(row.id)
                                        }
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
                loading={createApplicationMutation.isPending}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateApplication}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                tabs={({ values, setValue, isLoading, errors }) => [
                    {
                        id: 'general',
                        label: t('copy.generalTab', 'General'),
                        content: renderLocalizedFields({ values, setValue, isLoading, errors })
                    },
                    {
                        id: 'parameters',
                        label: t('parameters.tab', 'Parameters'),
                        content: renderCreateParametersTab({ values, setValue, isLoading, errors })
                    }
                ]}
                canSave={canSaveApplicationForm}
                validate={(values) => validateApplicationForm(values)}
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
                        deleteApplicationMutation.mutate(deleteDialogState.application.id)
                        setDeleteDialogState({ open: false, application: null })
                    }
                }}
            />

            <ConfirmDialog />

            <ConflictResolutionDialog
                open={conflictState.open}
                conflict={conflictState.conflict}
                onCancel={() => {
                    setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    void queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
                }}
                onOverwrite={async () => {
                    if (conflictState.pendingUpdate) {
                        const { id, patch } = conflictState.pendingUpdate
                        void updateApplicationMutation.mutateAsync({ id, data: patch })
                        setConflictState({ open: false, conflict: null, pendingUpdate: null })
                    }
                }}
                isLoading={updateApplicationMutation.isPending}
            />
        </MainCard>
    )
}

export default ApplicationList
