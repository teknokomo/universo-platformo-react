import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { sanitizeApplicationLearningContentSettings } from '@universo/types'
import Dashboard from '../dashboard/Dashboard'
import type {
    DashboardCreateTarget,
    DashboardDetailsSlot,
    DashboardLayoutConfig,
    DashboardMenuItem,
    DashboardMenuSlot,
    DashboardMenusMap,
    DashboardRowTarget,
    DashboardRowTargetAction
} from '../dashboard/Dashboard'
import AppMainLayout from '../layouts/AppMainLayout'
import { createStandaloneAdapter } from '../api/adapters'
import { updateLearningContentProgress } from '../api/api'
import type { AppDataResponse } from '../api/api'
import { useCrudDashboard } from '../hooks/useCrudDashboard'
import { CrudDialogs } from '../components/CrudDialogs'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { RuntimeWorkspacesPage } from '../workspaces/RuntimeWorkspacesPage'

export interface DashboardAppProps {
    applicationId: string
    locale: string
    apiBaseUrl: string
}

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

const buildStandaloneSectionHref = (applicationId: string, collectionId: string, sectionLinksEnabled: boolean): string =>
    sectionLinksEnabled ? `/a/${applicationId}/${encodeURIComponent(collectionId)}` : `/a/${applicationId}`

const isWorkspaceRootMenuItem = (item: DashboardMenuItem): boolean =>
    item.id === 'runtime-workspaces' || item.id === 'workspaces' || /\/workspaces(?:$|\?)/.test(item.href ?? '')

const buildLearningContentCreateDefaultContext = (appData: AppDataResponse | undefined): Record<string, unknown> => {
    const learningContentSettings = sanitizeApplicationLearningContentSettings(
        appData?.settings?.learningContent as Record<string, unknown> | undefined
    )

    return {
        learningContent: {
            courseCompletionPolicy: learningContentSettings.courseCompletionPolicy,
            trackOrderPolicy: learningContentSettings.trackOrderPolicy
        }
    }
}

const readCurrentRouteSource = (): string => {
    if (typeof window === 'undefined') return ''
    return `${window.location.pathname}${window.location.hash}`
}

const toStandaloneSectionLinkMenuItem = (
    item: DashboardMenuItem,
    applicationId: string,
    sectionLinksEnabled: boolean,
    forceLink: boolean
): DashboardMenuItem => {
    if (item.kind !== 'section') {
        return { ...item, selected: false }
    }

    const targetCollectionId = item.sectionId ?? item.objectCollectionId
    if (!targetCollectionId) {
        return { ...item, selected: false }
    }

    if (!forceLink && !sectionLinksEnabled) {
        return { ...item, selected: false }
    }

    return {
        ...item,
        kind: 'link',
        href: buildStandaloneSectionHref(applicationId, targetCollectionId, sectionLinksEnabled),
        selected: false
    }
}

export default function DashboardApp(props: DashboardAppProps) {
    const { t } = useTranslation('apps')
    const [routeSource, setRouteSource] = useState(readCurrentRouteSource)
    const navigate = useCallback((href: string) => {
        if (typeof window === 'undefined') return
        window.history.pushState(null, '', href)
        setRouteSource(readCurrentRouteSource())
    }, [])

    const isWorkspacesRoute = useMemo(() => {
        return /\/a\/[0-9a-fA-F-]{16,}\/workspaces/.test(routeSource)
    }, [routeSource])
    const runtimeRouteSegments = useMemo(() => {
        const marker = `/a/${props.applicationId}`
        const suffix = routeSource.startsWith(marker) ? routeSource.slice(marker.length) : ''
        return suffix.split('/').filter(Boolean)
    }, [props.applicationId, routeSource])
    const routeSectionId =
        !isWorkspacesRoute && UUID_PATH_SEGMENT_REGEX.test(runtimeRouteSegments[0] ?? '') ? runtimeRouteSegments[0] : undefined
    const routeWorkspaceId =
        isWorkspacesRoute && UUID_PATH_SEGMENT_REGEX.test(runtimeRouteSegments[1] ?? '') ? runtimeRouteSegments[1] : null
    const workspaceRouteSection = isWorkspacesRoute && runtimeRouteSegments[2] === 'access' ? 'access' : 'dashboard'

    const adapter = useMemo(
        () => createStandaloneAdapter({ apiBaseUrl: props.apiBaseUrl, applicationId: props.applicationId }),
        [props.apiBaseUrl, props.applicationId]
    )

    const state = useCrudDashboard({
        adapter,
        locale: props.locale,
        initialSectionId: routeSectionId,
        createDefaultContext: buildLearningContentCreateDefaultContext
    })

    const detailsTitle = isWorkspacesRoute ? t('workspace.title', 'Workspaces') : state.appData?.objectCollection.name ?? 'Details'
    const contentPermissions = state.appData?.permissions
    const canCreateContent = contentPermissions?.createContent === true
    const canEditContent = contentPermissions?.editContent === true
    const canDeleteContent = contentPermissions?.deleteContent === true
    const showCreateButton = state.appData?.objectCollection.runtimeConfig?.showCreateButton !== false && canCreateContent
    const activeObjectCollectionRuntimeConfig = state.appData?.objectCollection.runtimeConfig
    const currentWorkspaceId = state.appData?.currentWorkspaceId ?? null
    const learningContentSettings = useMemo(
        () => sanitizeApplicationLearningContentSettings(state.appData?.settings?.learningContent as Record<string, unknown> | undefined),
        [state.appData?.settings?.learningContent]
    )
    const currentSectionId =
        state.appData?.activeObjectCollectionId ?? state.selectedObjectCollectionId ?? state.activeObjectCollectionId ?? null
    const [pendingCreateTarget, setPendingCreateTarget] = useState<{
        sectionId: string
        createDefaults?: DashboardCreateTarget['createDefaults']
    } | null>(null)
    const [pendingRowTarget, setPendingRowTarget] = useState<{
        sectionId: string
        rowId: string
        action: DashboardRowTargetAction
    } | null>(null)
    const resolveCreateTargetSectionId = useCallback(
        (target: DashboardCreateTarget): string | null => {
            const directId = target.sectionId ?? target.objectCollectionId
            if (directId) return directId

            const targetCodename = target.sectionCodename ?? target.objectCollectionCodename
            if (!targetCodename) return null

            const candidates = [...(state.appData?.sections ?? []), ...(state.appData?.objectCollections ?? [])]
            return candidates.find((candidate) => candidate.codename === targetCodename)?.id ?? null
        },
        [state.appData?.objectCollections, state.appData?.sections]
    )
    const resolveRowTargetSectionId = useCallback(
        (target: DashboardRowTarget): string | null => {
            const directId = target.sectionId ?? target.objectCollectionId
            if (directId) return directId

            const targetCodename = target.sectionCodename ?? target.objectCollectionCodename
            if (!targetCodename) return null

            const candidates = [...(state.appData?.sections ?? []), ...(state.appData?.objectCollections ?? [])]
            return candidates.find((candidate) => candidate.codename === targetCodename)?.id ?? null
        },
        [state.appData?.objectCollections, state.appData?.sections]
    )
    const handleOpenCreateTarget = useCallback(
        (target: DashboardCreateTarget) => {
            if (target.disabled) return

            const targetSectionId = resolveCreateTargetSectionId(target)
            if (!targetSectionId) return

            setPendingCreateTarget({ sectionId: targetSectionId, createDefaults: target.createDefaults })
            if (targetSectionId !== currentSectionId) {
                state.onSelectObjectCollection(targetSectionId)
            }
        },
        [currentSectionId, resolveCreateTargetSectionId, state]
    )
    const handleOpenRowTargetAction = useCallback(
        (rowId: string, action: DashboardRowTargetAction) => {
            if (action === 'edit') {
                state.handleOpenEdit(rowId)
                return
            }
            if (action === 'copy') {
                state.handleOpenCopy(rowId)
                return
            }
            state.handleOpenDelete(rowId)
        },
        [state]
    )
    const handleOpenRowTarget = useCallback(
        (target: DashboardRowTarget, action: DashboardRowTargetAction) => {
            const targetSectionId = resolveRowTargetSectionId(target)
            if (!targetSectionId || !target.rowId) return

            if (action === 'edit' && !canEditContent) return
            if (action === 'copy' && !canCreateContent) return
            if (action === 'delete' && !canDeleteContent) return

            setPendingRowTarget({ sectionId: targetSectionId, rowId: target.rowId, action })
            if (targetSectionId !== currentSectionId) {
                state.onSelectObjectCollection(targetSectionId)
            }
        },
        [canCreateContent, canDeleteContent, canEditContent, currentSectionId, resolveRowTargetSectionId, state]
    )
    useEffect(() => {
        if (!pendingCreateTarget) return

        const loadedTargetId =
            state.appData?.activeSectionId ??
            state.appData?.section?.id ??
            state.appData?.activeObjectCollectionId ??
            state.appData?.objectCollection?.id ??
            null
        if (state.isLoading || state.isFetching || loadedTargetId !== pendingCreateTarget.sectionId) return

        setPendingCreateTarget(null)
        state.handleOpenCreate(pendingCreateTarget.createDefaults)
    }, [
        pendingCreateTarget,
        state,
        state.appData?.activeObjectCollectionId,
        state.appData?.activeSectionId,
        state.appData?.objectCollection?.id,
        state.appData?.section?.id,
        state.isFetching,
        state.isLoading
    ])
    useEffect(() => {
        if (!pendingRowTarget) return

        const loadedTargetId =
            state.appData?.activeSectionId ??
            state.appData?.section?.id ??
            state.appData?.activeObjectCollectionId ??
            state.appData?.objectCollection?.id ??
            null
        if (state.isLoading || state.isFetching || loadedTargetId !== pendingRowTarget.sectionId) return

        setPendingRowTarget(null)
        handleOpenRowTargetAction(pendingRowTarget.rowId, pendingRowTarget.action)
    }, [
        handleOpenRowTargetAction,
        pendingRowTarget,
        state.appData?.activeObjectCollectionId,
        state.appData?.activeSectionId,
        state.appData?.objectCollection?.id,
        state.appData?.section?.id,
        state.isFetching,
        state.isLoading
    ])
    const workspacesEnabled = state.appData?.workspacesEnabled ?? false
    const activeFormSurface = !state.formOpen
        ? 'dialog'
        : state.copyRowId
        ? activeObjectCollectionRuntimeConfig?.copySurface ?? 'dialog'
        : state.editRowId
        ? activeObjectCollectionRuntimeConfig?.editSurface ?? 'dialog'
        : activeObjectCollectionRuntimeConfig?.createSurface ?? 'dialog'

    const handleOpenCreate = state.handleOpenCreate
    const createActions = useMemo(
        () =>
            showCreateButton ? (
                <Button
                    data-testid='application-runtime-create-row'
                    variant='contained'
                    size='small'
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenCreate()}
                >
                    {t('app.createRow', 'Create')}
                </Button>
            ) : null,
        [handleOpenCreate, showCreateButton, t]
    )
    const workspacePageContent = useMemo(
        () =>
            isWorkspacesRoute ? (
                <RuntimeWorkspacesPage
                    applicationId={props.applicationId}
                    apiBaseUrl={props.apiBaseUrl}
                    locale={props.locale}
                    routeWorkspaceId={routeWorkspaceId}
                    routeSection={workspaceRouteSection}
                    onNavigate={navigate}
                />
            ) : null,
        [isWorkspacesRoute, navigate, props.apiBaseUrl, props.applicationId, props.locale, routeWorkspaceId, workspaceRouteSection]
    )
    const pageProgressTargetObjectCodename = state.appData?.objectCollection.codename ?? state.appData?.section?.codename ?? null
    const pageProgressTargetRecordId = currentSectionId
    const handlePageProgressChange = useCallback(
        async (payload: { action: 'view' | 'complete' }) => {
            if (!pageProgressTargetObjectCodename || !pageProgressTargetRecordId) return
            await updateLearningContentProgress({
                apiBaseUrl: props.apiBaseUrl,
                applicationId: props.applicationId,
                targetObjectCodename: pageProgressTargetObjectCodename,
                targetRecordId: pageProgressTargetRecordId,
                action: payload.action
            })
        },
        [pageProgressTargetObjectCodename, pageProgressTargetRecordId, props.apiBaseUrl, props.applicationId]
    )

    const details = useMemo<DashboardDetailsSlot>(
        () => ({
            title: detailsTitle,
            applicationId: props.applicationId,
            sectionId: state.appData?.activeSectionId ?? state.selectedObjectCollectionId ?? state.activeObjectCollectionId ?? null,
            sectionCodename: state.appData?.section?.codename ?? null,
            objectCollectionId: currentSectionId,
            objectCollectionCodename: state.appData?.objectCollection.codename ?? null,
            sections: state.appData?.sections ?? [],
            objectCollections: state.appData?.objectCollections ?? [],
            apiBaseUrl: props.apiBaseUrl,
            locale: props.locale,
            currentWorkspaceId,
            runtimeQueryKeyPrefix: adapter?.queryKeyPrefix,
            workspacesEnabled,
            permissions: state.appData?.permissions,
            content: workspacePageContent,
            rows: state.rows,
            columns: state.columns,
            runtimeColumns: state.appData?.columns,
            loading: state.isLoading,
            rowCount: state.rowCount,
            paginationModel: state.paginationModel,
            onPaginationModelChange: state.setPaginationModel,
            sortModel: state.sortModel,
            onSortModelChange: state.setSortModel,
            filterModel: state.filterModel,
            onFilterModelChange: state.setFilterModel,
            searchValue: state.searchValue,
            onSearchValueChange: state.setSearchValue,
            pageSizeOptions: state.pageSizeOptions,
            pageBlocks: state.appData?.objectCollection.pageBlocks ?? state.appData?.section?.pageBlocks,
            pagePlayer: {
                showOutline: learningContentSettings.playerPreset?.showOutline !== false,
                showProgressHeader: learningContentSettings.playerPreset?.showProgressHeader !== false,
                completeButtonMode: learningContentSettings.playerPreset?.completeButtonMode ?? 'manual',
                progressStorageKey: [
                    'learning-content-progress',
                    props.applicationId,
                    currentWorkspaceId ?? 'global',
                    currentSectionId ?? 'unknown'
                ].join(':'),
                onProgressChange: handlePageProgressChange
            },
            tableDefaults: {
                defaultViewMode: learningContentSettings.defaultView === 'cards' ? 'card' : 'table',
                columnPreset: learningContentSettings.columnPreset
            },
            resourceSourceTypes: learningContentSettings.supportedResourceTypes,
            onOpenCreateTarget: handleOpenCreateTarget,
            onOpenRowTarget: handleOpenRowTarget,
            localeText: state.localeText,
            actions: createActions,
            navigate,
            searchMode: state.appData?.objectCollection.runtimeConfig?.searchMode ?? 'page-local',
            rowReorder: state.canPersistRowReorder
                ? {
                      onReorder: state.handlePersistRowReorder,
                      isPending: state.isReordering
                  }
                : undefined
        }),
        [
            detailsTitle,
            state.appData?.activeSectionId,
            state.appData?.section?.codename,
            state.appData?.objectCollection.codename,
            state.appData?.sections,
            state.appData?.objectCollections,
            state.selectedObjectCollectionId,
            state.activeObjectCollectionId,
            state.appData?.objectCollection.runtimeConfig?.searchMode,
            currentWorkspaceId,
            currentSectionId,
            workspacesEnabled,
            state.appData?.permissions,
            state.canPersistRowReorder,
            state.rows,
            state.columns,
            state.appData?.columns,
            state.isLoading,
            state.handlePersistRowReorder,
            state.isReordering,
            state.rowCount,
            state.paginationModel,
            state.setPaginationModel,
            state.sortModel,
            state.setSortModel,
            state.filterModel,
            state.setFilterModel,
            state.searchValue,
            state.setSearchValue,
            state.pageSizeOptions,
            state.appData?.objectCollection.pageBlocks,
            state.appData?.section?.pageBlocks,
            learningContentSettings.playerPreset?.showOutline,
            learningContentSettings.playerPreset?.showProgressHeader,
            learningContentSettings.playerPreset?.completeButtonMode,
            learningContentSettings.defaultView,
            learningContentSettings.columnPreset,
            learningContentSettings.supportedResourceTypes,
            handlePageProgressChange,
            handleOpenCreateTarget,
            handleOpenRowTarget,
            state.localeText,
            createActions,
            adapter?.queryKeyPrefix,
            navigate,
            props.apiBaseUrl,
            props.applicationId,
            props.locale,
            workspacePageContent
        ]
    )
    const runtimeLayoutConfig = useMemo(
        () => (isWorkspacesRoute ? { ...state.layoutConfig, ...WORKSPACE_ROUTE_LAYOUT_OVERRIDES } : state.layoutConfig),
        [isWorkspacesRoute, state.layoutConfig]
    )

    if (!props.applicationId) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant='body2'>Missing applicationId</Typography>
            </Box>
        )
    }

    const workspaceMenuItem: DashboardMenuItem | null =
        state.appData?.workspacesEnabled && props.applicationId
            ? {
                  id: 'runtime-workspaces',
                  label: t('workspace.title', 'Workspaces'),
                  icon: 'folder',
                  kind: 'link',
                  href: `/a/${props.applicationId}/workspaces`,
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
                  href: `/a/${props.applicationId}/workspaces/${routeWorkspaceId}`,
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
                  href: `/a/${props.applicationId}/workspaces/${routeWorkspaceId}/access`,
                  selected: isWorkspacesRoute && workspaceRouteSection === 'access'
              }
            : null
    const sectionLinksEnabled = state.appData?.settings?.sectionLinksEnabled !== false

    const appendWorkspaceMenuItem = (slot?: DashboardMenuSlot): DashboardMenuSlot | undefined => {
        if (!workspaceMenuItem) return slot
        const baseItems = slot?.items ?? []
        const hasWorkspaceRootItem = baseItems.some(isWorkspaceRootMenuItem)
        const normalizedBaseItems = baseItems.map((item) => {
            if (isWorkspaceRootMenuItem(item)) {
                return {
                    ...item,
                    kind: 'link' as const,
                    href: item.href ?? workspaceMenuItem.href,
                    selected: isWorkspacesRoute
                }
            }

            return isWorkspacesRoute || sectionLinksEnabled
                ? toStandaloneSectionLinkMenuItem(item, props.applicationId, sectionLinksEnabled, isWorkspacesRoute)
                : item
        })

        return {
            ...slot,
            title: slot?.title ?? null,
            showTitle: slot?.showTitle ?? false,
            items: [
                ...normalizedBaseItems,
                ...(hasWorkspaceRootItem ? [] : [workspaceMenuItem]),
                ...(workspaceDashboardMenuItem ? [workspaceDashboardMenuItem] : []),
                ...(workspaceAccessMenuItem ? [workspaceAccessMenuItem] : [])
            ]
        }
    }

    const menuSlot = appendWorkspaceMenuItem(state.menuSlot)
    const menusMap: DashboardMenusMap | undefined =
        Object.keys(state.menusMap).length > 0
            ? Object.fromEntries(
                  Object.entries(state.menusMap).map(([key, slot]) => [key, appendWorkspaceMenuItem(slot) as DashboardMenuSlot])
              )
            : undefined

    return (
        <AppMainLayout>
            <Dashboard
                layoutConfig={runtimeLayoutConfig}
                zoneWidgets={state.appData?.zoneWidgets}
                menu={menuSlot}
                menus={menusMap}
                details={details}
            />

            {!isWorkspacesRoute ? (
                <>
                    <CrudDialogs
                        state={state}
                        locale={props.locale}
                        apiBaseUrl={props.apiBaseUrl}
                        applicationId={props.applicationId}
                        objectCollectionId={state.selectedObjectCollectionId ?? state.activeObjectCollectionId}
                        objectCollections={state.appData?.objectCollections ?? []}
                        currentWorkspaceId={currentWorkspaceId}
                        resourceSourceTypes={learningContentSettings.supportedResourceTypes}
                        surface={activeFormSurface}
                        labels={{
                            editTitle: t('app.editRow', 'Edit element'),
                            createTitle: t('app.createRecordTitle', 'Create element'),
                            saveText: t('app.save', 'Save'),
                            createText: t('app.create', 'Create'),
                            savingText: t('app.saving', 'Saving...'),
                            creatingText: t('app.creating', 'Creating...'),
                            cancelText: t('app.cancel', 'Cancel'),
                            noFieldsText: t('app.noFields', 'No fields configured for this object.'),
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
                        state={state}
                        permissions={{
                            canEdit: canEditContent,
                            canCopy: canCreateContent,
                            canDelete: canDeleteContent
                        }}
                        labels={{
                            editText: t('app.edit', 'Edit'),
                            copyText: t('app.copy', 'Copy'),
                            deleteText: t('app.delete', 'Delete'),
                            postText: t('app.postRecord', 'Post'),
                            unpostText: t('app.unpostRecord', 'Unpost'),
                            voidText: t('app.voidRecord', 'Void'),
                            stateDraftText: t('app.recordStateDraft', 'Draft'),
                            statePostedText: t('app.recordStatePosted', 'Posted'),
                            stateVoidedText: t('app.recordStateVoided', 'Voided'),
                            stateUnknownText: t('app.recordStateUnknown', 'State'),
                            workflowActionText: t('app.workflowAction', 'Run action'),
                            workflowConfirmationTitleText: t('app.workflowConfirmationTitle', 'Confirm action'),
                            workflowConfirmationMessageText: t('app.workflowConfirmationMessage', 'Run this action?'),
                            cancelText: t('app.cancel', 'Cancel'),
                            confirmText: t('app.confirm', 'Confirm')
                        }}
                    />
                </>
            ) : null}
        </AppMainLayout>
    )
}
