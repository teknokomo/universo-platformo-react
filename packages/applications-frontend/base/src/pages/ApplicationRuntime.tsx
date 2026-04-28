import { useCallback, useEffect, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import AddIcon from '@mui/icons-material/Add'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
    AppsDashboard,
    useCrudDashboard,
    CrudDialogs,
    RowActionsMenu,
    RuntimeWorkspacesPage,
    type CellRendererOverrides,
    type DashboardDetailsSlot,
    type DashboardLayoutConfig,
    type DashboardMenuItem,
    type DashboardMenuSlot,
    type DashboardMenusMap
} from '@universo/apps-template-mui'
import { createRuntimeAdapter } from '../api/runtimeAdapter'
import {
    buildPendingRuntimeCellMap,
    getRuntimeCellPendingKey,
    usePendingRuntimeCellMutations,
    useUpdateRuntimeCell
} from '../api/mutations'

const DEFAULT_PAGE_SIZE = 50
const WORKSPACE_ROUTE_LAYOUT_OVERRIDES: Partial<DashboardLayoutConfig> = {
    showOverviewTitle: false,
    showOverviewCards: false,
    showSessionsChart: false,
    showPageViewsChart: false,
    showDetailsTitle: false,
    showDetailsTable: false,
    showFooter: false
}

const UUID_PATH_SEGMENT_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const buildRuntimeSectionHref = (applicationId: string, collectionId: string, sectionLinksEnabled: boolean): string =>
    sectionLinksEnabled ? `/a/${applicationId}/${encodeURIComponent(collectionId)}` : `/a/${applicationId}`

const toRuntimeSectionLinkMenuItem = (
    item: DashboardMenuItem,
    applicationId: string,
    sectionLinksEnabled: boolean,
    forceLink: boolean
): DashboardMenuItem => {
    if (item.kind !== 'catalog' && item.kind !== 'section') {
        return { ...item, selected: false }
    }

    const targetCollectionId = item.sectionId ?? item.linkedCollectionId
    if (!targetCollectionId) {
        return { ...item, selected: false }
    }

    if (!forceLink && !sectionLinksEnabled) {
        return { ...item, selected: false }
    }

    return {
        ...item,
        kind: 'link',
        href: sectionLinksEnabled ? buildRuntimeSectionHref(applicationId, targetCollectionId, true) : `/a/${applicationId}`,
        selected: false
    }
}

const ApplicationRuntime = () => {
    const routeParams = useParams<{ applicationId: string; '*': string }>()
    const applicationId = routeParams.applicationId
    const runtimeSubRoute = routeParams['*'] ?? ''
    const runtimeRouteSegments = runtimeSubRoute.split('/').filter(Boolean)
    const [searchParams, setSearchParams] = useSearchParams()
    const { t, i18n } = useTranslation('applications')
    const isWorkspacesRoute = runtimeRouteSegments[0] === 'workspaces'
    const routeSectionId =
        !isWorkspacesRoute && UUID_PATH_SEGMENT_REGEX.test(runtimeRouteSegments[0] ?? '') ? runtimeRouteSegments[0] : undefined
    const routeWorkspaceId =
        isWorkspacesRoute && UUID_PATH_SEGMENT_REGEX.test(runtimeRouteSegments[1] ?? '') ? runtimeRouteSegments[1] : null
    const workspaceRouteSection = isWorkspacesRoute && runtimeRouteSegments[2] === 'access' ? 'access' : 'dashboard'

    const adapter = useMemo(() => (applicationId ? createRuntimeAdapter(applicationId) : null), [applicationId])

    // Inline cell mutation for BOOLEAN checkboxes (section id passed dynamically).
    const updateCellMutation = useUpdateRuntimeCell({ applicationId })
    const pendingRuntimeCellMutations = usePendingRuntimeCellMutations({ applicationId })

    // Stabilize cellRenderers — use refs to avoid DataGrid column re-creation on mutation state changes
    const cellMutateRef = useRef(updateCellMutation.mutate)
    cellMutateRef.current = updateCellMutation.mutate
    const pendingCellValues = useMemo(() => buildPendingRuntimeCellMap(pendingRuntimeCellMutations), [pendingRuntimeCellMutations])
    const pendingCellValuesRef = useRef(pendingCellValues)
    pendingCellValuesRef.current = pendingCellValues
    const sectionIdRef = useRef<string | undefined>(undefined)
    const pendingInteractionRef = useRef<(rowId: string) => boolean>(() => false)

    // Cell renderer overrides: interactive BOOLEAN checkboxes with per-cell optimistic state
    const cellRenderers = useMemo<CellRendererOverrides>(
        () => ({
            BOOLEAN: (params) => {
                // "via UI" optimistic: if THIS cell has a pending mutation, show the latest pending value for that exact cell
                const pendingKey = getRuntimeCellPendingKey(params.rowId, params.field)
                const hasPendingValue = pendingCellValuesRef.current.has(pendingKey)
                const pendingValue = pendingCellValuesRef.current.get(pendingKey)
                const displayValue = hasPendingValue ? pendingValue : params.value

                return (
                    <Checkbox
                        disableRipple
                        checked={Boolean(displayValue)}
                        indeterminate={false}
                        disabled={false}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(_, checked) => {
                            if (pendingInteractionRef.current(params.rowId)) {
                                return
                            }

                            cellMutateRef.current({
                                rowId: params.rowId,
                                field: params.field,
                                value: checked,
                                sectionId: sectionIdRef.current
                            })
                        }}
                    />
                )
            }
        }),
        []
    )

    const state = useCrudDashboard({
        adapter,
        locale: i18n.language,
        i18nNamespace: 'applications',
        defaultPageSize: DEFAULT_PAGE_SIZE,
        pageSizeOptions: [10, 25, 50, 100],
        staleTime: 30_000,
        initialSectionId: routeSectionId,
        cellRenderers
    })

    const activeRuntimeSection = state.appData?.section ?? state.appData?.linkedCollection
    const activeRuntimeConfig = activeRuntimeSection?.runtimeConfig
    const currentSectionId =
        state.selectedSectionId ?? state.activeSectionId ?? state.selectedLinkedCollectionId ?? state.activeLinkedCollectionId
    const showCreateButton = activeRuntimeConfig?.showCreateButton !== false
    const resolveFormSurface = useCallback(
        (mode: 'create' | 'edit' | 'copy') => {
            if (mode === 'create') return activeRuntimeConfig?.createSurface ?? 'dialog'
            if (mode === 'copy') return activeRuntimeConfig?.copySurface ?? 'dialog'
            return activeRuntimeConfig?.editSurface ?? 'dialog'
        },
        [activeRuntimeConfig?.copySurface, activeRuntimeConfig?.createSurface, activeRuntimeConfig?.editSurface]
    )

    const clearRuntimeFormParams = useCallback(() => {
        const next = new URLSearchParams(searchParams)
        next.delete('surface')
        next.delete('mode')
        next.delete('rowId')
        setSearchParams(next, { replace: true })
    }, [searchParams, setSearchParams])

    const handleOpenCreateSurface = useCallback(() => {
        if (!showCreateButton) {
            clearRuntimeFormParams()
            return
        }

        if (resolveFormSurface('create') === 'page') {
            const next = new URLSearchParams(searchParams)
            next.set('surface', 'page')
            next.set('mode', 'create')
            next.delete('rowId')
            setSearchParams(next)
            return
        }
        state.handleOpenCreate()
    }, [clearRuntimeFormParams, resolveFormSurface, searchParams, setSearchParams, showCreateButton, state])

    const handleOpenEditSurface = useCallback(
        (rowId: string) => {
            if (resolveFormSurface('edit') === 'page') {
                const next = new URLSearchParams(searchParams)
                next.set('surface', 'page')
                next.set('mode', 'edit')
                next.set('rowId', rowId)
                setSearchParams(next)
                return
            }
            state.handleOpenEdit(rowId)
        },
        [resolveFormSurface, searchParams, setSearchParams, state]
    )

    const handleOpenCopySurface = useCallback(
        (rowId: string) => {
            if (resolveFormSurface('copy') === 'page') {
                const next = new URLSearchParams(searchParams)
                next.set('surface', 'page')
                next.set('mode', 'copy')
                next.set('rowId', rowId)
                setSearchParams(next)
                return
            }
            state.handleOpenCopy(rowId)
        },
        [resolveFormSurface, searchParams, setSearchParams, state]
    )

    const handleCloseFormSurface = useCallback(() => {
        clearRuntimeFormParams()
        state.handleCloseForm()
    }, [clearRuntimeFormParams, state])

    const handledPageSurfaceRequestRef = useRef<string | null>(null)
    const suppressPageSurfaceOpenRef = useRef(false)
    const pendingPageSurfaceCleanupRef = useRef(false)

    const handleFormSubmitSurface = useCallback(
        async (data: Record<string, unknown>) => {
            if (searchParams.get('surface') === 'page') {
                suppressPageSurfaceOpenRef.current = true
                pendingPageSurfaceCleanupRef.current = true
            }
            await state.handleFormSubmit(data)
        },
        [searchParams, state]
    )

    useEffect(() => {
        if (searchParams.get('surface') !== 'page') {
            handledPageSurfaceRequestRef.current = null
            suppressPageSurfaceOpenRef.current = false
            pendingPageSurfaceCleanupRef.current = false
            return
        }

        if (suppressPageSurfaceOpenRef.current) {
            return
        }

        const mode = searchParams.get('mode')
        const rowId = searchParams.get('rowId')
        const requestKey = mode ? `${mode}:${rowId ?? ''}` : null

        if (mode === 'create') {
            if (!showCreateButton) {
                if (state.formOpen) {
                    state.handleCloseForm()
                }
                clearRuntimeFormParams()
                return
            }

            if (handledPageSurfaceRequestRef.current === requestKey) {
                return
            }

            handledPageSurfaceRequestRef.current = requestKey

            if (!state.formOpen) {
                state.handleOpenCreate()
            }
            return
        }

        if ((mode === 'edit' || mode === 'copy') && !rowId) {
            clearRuntimeFormParams()
            return
        }

        if (handledPageSurfaceRequestRef.current === requestKey) {
            return
        }

        handledPageSurfaceRequestRef.current = requestKey

        if (mode === 'edit' && rowId && (!state.formOpen || state.editRowId !== rowId)) {
            state.handleOpenEdit(rowId)
            return
        }

        if (mode === 'copy' && rowId && (!state.formOpen || state.copyRowId !== rowId)) {
            state.handleOpenCopy(rowId)
        }
    }, [clearRuntimeFormParams, searchParams, showCreateButton, state])

    useEffect(() => {
        if (searchParams.get('surface') !== 'page') {
            pendingPageSurfaceCleanupRef.current = false
            return
        }

        if (!pendingPageSurfaceCleanupRef.current || state.formOpen || state.isSubmitting) {
            return
        }

        pendingPageSurfaceCleanupRef.current = false
        clearRuntimeFormParams()
    }, [clearRuntimeFormParams, searchParams, state.formOpen, state.isSubmitting])

    const runtimeState = useMemo(
        () => ({
            ...state,
            handleOpenCreate: handleOpenCreateSurface,
            handleOpenEdit: handleOpenEditSurface,
            handleOpenCopy: handleOpenCopySurface,
            handleCloseForm: handleCloseFormSurface,
            handleFormSubmit: handleFormSubmitSurface
        }),
        [handleCloseFormSurface, handleFormSubmitSurface, handleOpenCopySurface, handleOpenCreateSurface, handleOpenEditSurface, state]
    )

    const activeSectionSelectionId = currentSectionId
    const previousSectionSelectionRef = useRef<string | undefined>(undefined)

    useEffect(() => {
        const previousSectionSelectionId = previousSectionSelectionRef.current

        if (previousSectionSelectionId && activeSectionSelectionId && previousSectionSelectionId !== activeSectionSelectionId) {
            handledPageSurfaceRequestRef.current = null
            suppressPageSurfaceOpenRef.current = false

            if (state.formOpen || state.editRowId || state.copyRowId) {
                state.handleCloseForm()
            }

            if (searchParams.has('surface') || searchParams.has('mode') || searchParams.has('rowId')) {
                clearRuntimeFormParams()
            }
        }

        previousSectionSelectionRef.current = activeSectionSelectionId
    }, [
        activeSectionSelectionId,
        clearRuntimeFormParams,
        searchParams,
        state,
        state.copyRowId,
        state.editRowId,
        state.formOpen,
        state.handleCloseForm
    ])

    const activeFormSurface =
        searchParams.get('surface') === 'page' && !(searchParams.get('mode') === 'create' && !showCreateButton) ? 'page' : 'dialog'

    // Keep section id ref in sync with the current runtime section from hook state.
    sectionIdRef.current = currentSectionId
    pendingInteractionRef.current = runtimeState.handlePendingInteractionAttempt

    const detailsTitle = isWorkspacesRoute ? t('workspace.title', 'Workspaces') : activeRuntimeSection?.name ?? 'Details'
    const runtimeLayoutConfig = useMemo(
        () => (isWorkspacesRoute ? { ...state.layoutConfig, ...WORKSPACE_ROUTE_LAYOUT_OVERRIDES } : state.layoutConfig),
        [isWorkspacesRoute, state.layoutConfig]
    )

    const createActions = useMemo(
        () =>
            showCreateButton ? (
                <Button
                    data-testid='application-runtime-create-row'
                    variant='contained'
                    startIcon={<AddIcon />}
                    onClick={runtimeState.handleOpenCreate}
                    disabled={state.appData?.workspaceLimit?.canCreate === false}
                    sx={{ height: 40, minHeight: 40, borderRadius: 1, flexShrink: 0 }}
                >
                    {t('app.createRow', 'Create')}
                </Button>
            ) : null,
        [runtimeState.handleOpenCreate, showCreateButton, state.appData?.workspaceLimit?.canCreate, t]
    )

    const workspaceLimitBanner = useMemo(
        () =>
            state.appData?.workspaceLimit?.canCreate === false ? (
                <Alert severity='info' data-testid='application-runtime-workspace-limit-banner'>
                    {t('app.workspaceLimitReached', {
                        defaultValue: 'The workspace limit for this section has been reached ({{current}} / {{max}}).',
                        current: state.appData.workspaceLimit.currentRows,
                        max: state.appData.workspaceLimit.maxRows ?? '∞'
                    })}
                </Alert>
            ) : null,
        [state.appData?.workspaceLimit, t]
    )

    const workspacePageContent = useMemo(
        () =>
            isWorkspacesRoute && applicationId ? (
                <RuntimeWorkspacesPage
                    applicationId={applicationId}
                    apiBaseUrl='/api/v1'
                    locale={i18n.language}
                    routeWorkspaceId={routeWorkspaceId}
                    routeSection={workspaceRouteSection}
                />
            ) : null,
        [applicationId, i18n.language, isWorkspacesRoute, routeWorkspaceId, workspaceRouteSection]
    )

    const pageSurfaceContent = useMemo(
        () =>
            workspacePageContent ??
            (activeFormSurface === 'page' && (runtimeState.formOpen || runtimeState.isSubmitting) ? (
                <CrudDialogs
                    state={runtimeState}
                    locale={i18n.language}
                    apiBaseUrl='/api/v1'
                    applicationId={applicationId}
                    linkedCollectionId={currentSectionId}
                    surface='page'
                    renderDelete={false}
                    labels={{
                        editTitle: t('app.editRow', 'Edit element'),
                        createTitle: t('app.createRecordTitle', 'Create element'),
                        saveText: t('app.save', 'Save'),
                        createText: t('app.create', 'Create'),
                        savingText: t('app.saving', 'Saving...'),
                        creatingText: t('app.creating', 'Creating...'),
                        cancelText: t('app.cancel', 'Cancel'),
                        noFieldsText: t('app.noFields', 'No fields configured for this section.'),
                        deleteTitle: t('app.deleteConfirmTitle', 'Delete element?'),
                        deleteDescription: t(
                            'app.deleteConfirmDescription',
                            'This element will be permanently deleted. This action cannot be undone.'
                        ),
                        deleteText: t('app.delete', 'Delete'),
                        deletingText: t('app.deleting', 'Deleting...'),
                        copyTitle: t('app.copyTitle', 'Copy element'),
                        copyText: t('app.copy', 'Copy'),
                        copyingText: t('app.copying', 'Copying...')
                    }}
                />
            ) : null),
        [activeFormSurface, applicationId, currentSectionId, i18n.language, runtimeState, t, workspacePageContent]
    )

    const details = useMemo<DashboardDetailsSlot>(
        () => ({
            title: detailsTitle,
            applicationId,
            sectionId: currentSectionId ?? null,
            sectionCodename: activeRuntimeSection?.codename ?? null,
            linkedCollectionId: currentSectionId ?? null,
            linkedCollectionCodename: activeRuntimeSection?.codename ?? null,
            apiBaseUrl: '/api/v1',
            currentWorkspaceId: state.appData?.currentWorkspaceId ?? null,
            runtimeQueryKeyPrefix: adapter?.queryKeyPrefix,
            workspacesEnabled: state.appData?.workspacesEnabled ?? false,
            banner: workspaceLimitBanner,
            content: pageSurfaceContent,
            rows: state.rows,
            columns: state.columns,
            loading: state.isFetching,
            rowCount: state.rowCount,
            paginationModel: state.paginationModel,
            onPaginationModelChange: state.setPaginationModel,
            pageSizeOptions: state.pageSizeOptions,
            localeText: state.localeText,
            actions: createActions,
            searchMode: activeRuntimeConfig?.searchMode ?? 'page-local',
            rowReorder: state.canPersistRowReorder
                ? {
                      onReorder: state.handlePersistRowReorder,
                      isPending: state.isReordering
                  }
                : undefined
        }),
        [
            activeRuntimeConfig?.searchMode,
            activeRuntimeSection?.codename,
            applicationId,
            currentSectionId,
            detailsTitle,
            state.rows,
            state.columns,
            state.isFetching,
            state.canPersistRowReorder,
            state.handlePersistRowReorder,
            state.isReordering,
            state.rowCount,
            state.paginationModel,
            state.setPaginationModel,
            state.pageSizeOptions,
            state.localeText,
            createActions,
            pageSurfaceContent,
            adapter?.queryKeyPrefix,
            state.appData?.currentWorkspaceId,
            state.appData?.workspacesEnabled,
            workspaceLimitBanner
        ]
    )

    if (!applicationId) {
        return <Alert severity='error'>{t('app.errors.missingApplicationId', 'Application ID is missing in URL')}</Alert>
    }

    if (state.isLoading && !state.appData) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                <CircularProgress />
            </Box>
        )
    }

    if (state.isError || !state.appData) {
        return <Alert severity='error'>{t('app.errors.loadFailed', 'Failed to load runtime data')}</Alert>
    }

    const workspaceMenuItem: DashboardMenuItem | null =
        state.appData.workspacesEnabled && applicationId
            ? {
                  id: 'runtime-workspaces',
                  label: t('workspace.title', 'Workspaces'),
                  icon: 'folder',
                  kind: 'link',
                  href: `/a/${applicationId}/workspaces`,
                  selected: isWorkspacesRoute
              }
            : null
    const workspaceDashboardMenuItem: DashboardMenuItem | null =
        workspaceMenuItem && routeWorkspaceId
            ? {
                  id: 'runtime-workspace-dashboard',
                  label: t('workspace.dashboard', 'Dashboard'),
                  icon: 'dashboard',
                  kind: 'link',
                  href: `/a/${applicationId}/workspaces/${routeWorkspaceId}`,
                  selected: isWorkspacesRoute && workspaceRouteSection === 'dashboard'
              }
            : null
    const workspaceAccessMenuItem: DashboardMenuItem | null =
        workspaceMenuItem && routeWorkspaceId
            ? {
                  id: 'runtime-workspace-access',
                  label: t('workspace.access', 'Access'),
                  icon: 'users',
                  kind: 'link',
                  href: `/a/${applicationId}/workspaces/${routeWorkspaceId}/access`,
                  selected: isWorkspacesRoute && workspaceRouteSection === 'access'
              }
            : null
    const sectionLinksEnabled = state.appData.settings?.sectionLinksEnabled !== false

    const appendWorkspaceMenuItem = (slot?: DashboardMenuSlot): DashboardMenuSlot | undefined => {
        if (!workspaceMenuItem) return slot
        const baseItems = slot?.items ?? []
        const items = [
            ...baseItems.map((item) =>
                isWorkspacesRoute || sectionLinksEnabled
                    ? toRuntimeSectionLinkMenuItem(item, applicationId, sectionLinksEnabled, isWorkspacesRoute)
                    : item
            ),
            workspaceMenuItem,
            ...(workspaceDashboardMenuItem ? [workspaceDashboardMenuItem] : []),
            ...(workspaceAccessMenuItem ? [workspaceAccessMenuItem] : [])
        ]
        return {
            ...slot,
            title: slot?.title ?? null,
            showTitle: slot?.showTitle ?? false,
            items
        }
    }

    const runtimeMenuSlot = appendWorkspaceMenuItem(state.menuSlot)
    const runtimeMenusMap: DashboardMenusMap | undefined =
        Object.keys(state.menusMap).length > 0
            ? Object.fromEntries(
                  Object.entries(state.menusMap).map(([key, slot]) => [key, appendWorkspaceMenuItem(slot) as DashboardMenuSlot])
              )
            : undefined

    return (
        <>
            <AppsDashboard
                layoutConfig={runtimeLayoutConfig}
                zoneWidgets={state.appData.zoneWidgets}
                menus={runtimeMenusMap}
                menu={runtimeMenuSlot}
                details={details}
            />

            {!isWorkspacesRoute ? (
                <>
                    <CrudDialogs
                        state={runtimeState}
                        locale={i18n.language}
                        apiBaseUrl='/api/v1'
                        applicationId={applicationId}
                        linkedCollectionId={currentSectionId}
                        surface={activeFormSurface}
                        renderForm={activeFormSurface !== 'page'}
                        labels={{
                            editTitle: t('app.editRow', 'Edit element'),
                            createTitle: t('app.createRecordTitle', 'Create element'),
                            saveText: t('app.save', 'Save'),
                            createText: t('app.create', 'Create'),
                            savingText: t('app.saving', 'Saving...'),
                            creatingText: t('app.creating', 'Creating...'),
                            cancelText: t('app.cancel', 'Cancel'),
                            noFieldsText: t('app.noFields', 'No fields configured for this section.'),
                            deleteTitle: t('app.deleteConfirmTitle', 'Delete element?'),
                            deleteDescription: t(
                                'app.deleteConfirmDescription',
                                'This element will be permanently deleted. This action cannot be undone.'
                            ),
                            deleteText: t('app.delete', 'Delete'),
                            deletingText: t('app.deleting', 'Deleting...'),
                            copyTitle: t('app.copyTitle', 'Copy element'),
                            copyText: t('app.copy', 'Copy'),
                            copyingText: t('app.copying', 'Copying...')
                        }}
                    />

                    <RowActionsMenu
                        state={runtimeState}
                        labels={{
                            editText: t('app.edit', 'Edit'),
                            copyText: t('app.copy', 'Copy'),
                            deleteText: t('app.delete', 'Delete')
                        }}
                    />
                </>
            ) : null}
        </>
    )
}

export default ApplicationRuntime
