import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { sanitizeApplicationLearningContentSettings } from '@universo-react/types'
import type { LayoutRuntimeErrorCode } from '@universo-react/types'
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
import {
    buildRuntimeLayoutQueryKey,
    fetchRuntimeEffectiveLayout,
    getRuntimeLayoutErrorCode,
    toDashboardZoneWidgets,
    updateLearningContentProgress
} from '../api/api'
import type { RuntimeEffectiveLayoutSuccess, RuntimeLayoutTarget } from '../api/api'
import type { AppDataResponse } from '../api/api'
import { useCrudDashboard } from '../hooks/useCrudDashboard'
import { CrudDialogs } from '../components/CrudDialogs'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { RuntimeWorkspacesPage } from '../workspaces/RuntimeWorkspacesPage'
import MarketingRuntimeContent from '../marketing-page/MarketingRuntimeContent'
import {
    buildRouteProjectedAppData,
    getLoadedRuntimeSectionId,
    isWorkspaceRootMenuItem,
    resolveSectionRecord,
    resolveSingleSystemMatrixSectionId,
    toStandaloneSectionLinkMenuItem
} from './standaloneTargets'
import {
    hasMatrixCellRouteParam,
    readCurrentRoutePathname,
    readCurrentRouteSource,
    readStandaloneMarketingTarget,
    readStandaloneRuntimeTarget,
    readStandaloneWorkspaceId
} from './standaloneRouting'

export interface DashboardAppProps {
    applicationId: string
    locale: string
    apiBaseUrl: string
}

const UUID_PATH_SEGMENT_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const WORKSPACE_ROUTE_LAYOUT_OVERRIDES: Partial<DashboardLayoutConfig> = {
    showOverviewTitle: false,
    showOverviewCards: false,
    showSessionsChart: false,
    showPageViewsChart: false,
    showDetailsTitle: false,
    showDetailsTable: false,
    showFooter: false
}

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

type DashboardRuntimeContentProps = DashboardAppProps & {
    effectiveLayout?: RuntimeEffectiveLayoutSuccess
}

function DashboardRuntimeContent({ effectiveLayout, ...props }: DashboardRuntimeContentProps) {
    const { t } = useTranslation('apps')
    const [routeSource, setRouteSource] = useState(readCurrentRouteSource)
    const navigate = useCallback((href: string) => {
        if (typeof window === 'undefined') return
        window.history.pushState(null, '', href)
        setRouteSource(readCurrentRouteSource())
    }, [])
    useEffect(() => {
        if (typeof window === 'undefined') return undefined

        const handleRouteChange = () => {
            setRouteSource(readCurrentRouteSource())
        }

        window.addEventListener('popstate', handleRouteChange)
        return () => {
            window.removeEventListener('popstate', handleRouteChange)
        }
    }, [])

    const routePathname = readCurrentRoutePathname(routeSource)
    const isWorkspacesRoute = useMemo(() => {
        const workspacePath = `/a/${props.applicationId}/workspaces`
        return routePathname === workspacePath || routePathname.startsWith(`${workspacePath}/`)
    }, [props.applicationId, routePathname])
    const runtimeRouteSegments = useMemo(() => {
        const marker = `/a/${props.applicationId}`
        const suffix = routePathname.startsWith(marker) ? routePathname.slice(marker.length) : ''
        return suffix.split('/').filter(Boolean)
    }, [props.applicationId, routePathname])
    const routeSectionId =
        !isWorkspacesRoute && UUID_PATH_SEGMENT_REGEX.test(runtimeRouteSegments[0] ?? '') ? runtimeRouteSegments[0] : undefined
    const routeWorkspaceId =
        isWorkspacesRoute && UUID_PATH_SEGMENT_REGEX.test(runtimeRouteSegments[1] ?? '') ? runtimeRouteSegments[1] : null
    const requestedWorkspaceId = routeWorkspaceId ?? readStandaloneWorkspaceId(routeSource)
    const workspaceRouteSection =
        isWorkspacesRoute && runtimeRouteSegments[2] === 'access'
            ? 'access'
            : isWorkspacesRoute && runtimeRouteSegments[2] === 'settings'
            ? 'settings'
            : 'dashboard'

    const adapter = useMemo(
        () => createStandaloneAdapter({ apiBaseUrl: props.apiBaseUrl, applicationId: props.applicationId }),
        [props.apiBaseUrl, props.applicationId]
    )
    const resolveRoutePreferredSectionId = useCallback(
        (appData: AppDataResponse): string | undefined => {
            if (!hasMatrixCellRouteParam(routeSource)) return undefined
            return resolveSingleSystemMatrixSectionId(appData) ?? undefined
        },
        [routeSource]
    )

    const state = useCrudDashboard({
        adapter,
        locale: props.locale,
        initialSectionId: routeSectionId,
        workspaceId: requestedWorkspaceId,
        resolvePreferredSectionId: resolveRoutePreferredSectionId,
        createDefaultContext: buildLearningContentCreateDefaultContext
    })

    const contentPermissions = state.appData?.permissions
    const canCreateContent = contentPermissions?.createContent === true
    const canEditContent = contentPermissions?.editContent === true
    const canDeleteContent = contentPermissions?.deleteContent === true
    const showCreateButton = state.appData?.objectCollection.runtimeConfig?.showCreateButton !== false && canCreateContent
    const currentWorkspaceId = state.appData?.currentWorkspaceId ?? null
    const runtimeAppData = state.rawAppData ?? state.appData
    const matrixRouteSectionId = useMemo(
        () => (hasMatrixCellRouteParam(routeSource) ? resolveSingleSystemMatrixSectionId(runtimeAppData) : null),
        [routeSource, runtimeAppData]
    )
    const currentRuntimeSectionId =
        routeSectionId ??
        matrixRouteSectionId ??
        state.selectedSectionId ??
        state.selectedObjectCollectionId ??
        state.activeSectionId ??
        state.activeObjectCollectionId ??
        null
    const currentRuntimeSection = useMemo(
        () => resolveSectionRecord(runtimeAppData, currentRuntimeSectionId),
        [currentRuntimeSectionId, runtimeAppData]
    )
    const routeProjectedAppData = useMemo(
        () => buildRouteProjectedAppData(runtimeAppData, currentRuntimeSection, currentRuntimeSectionId),
        [currentRuntimeSection, currentRuntimeSectionId, runtimeAppData]
    )
    const routeMatchesLoadedSection = !routeSectionId || getLoadedRuntimeSectionId(state.appData) === routeSectionId
    const detailsAppData = routeProjectedAppData ?? (routeMatchesLoadedSection ? state.appData : undefined)
    const hasResolvedDetailsAppData = Boolean(detailsAppData)
    const effectiveDashboardLayout = effectiveLayout?.layout.templateKey === 'dashboard' ? effectiveLayout : undefined
    const effectiveZoneWidgets = effectiveDashboardLayout ? toDashboardZoneWidgets(effectiveDashboardLayout) : undefined
    const dashboardZoneWidgets = effectiveZoneWidgets
    const detailsTitle = isWorkspacesRoute
        ? t('workspace.title', 'Workspaces')
        : detailsAppData?.objectCollection.name ??
          currentRuntimeSection?.name ??
          state.appData?.objectCollection.name ??
          t('runtime.details', 'Details')
    const activeObjectCollectionRuntimeConfig = detailsAppData?.objectCollection.runtimeConfig
    const currentRuntimeObjectCollectionId =
        currentRuntimeSection?.id ??
        routeSectionId ??
        state.selectedObjectCollectionId ??
        state.selectedSectionId ??
        state.activeObjectCollectionId ??
        state.activeSectionId ??
        null
    const learningContentSettings = useMemo(
        () => sanitizeApplicationLearningContentSettings(detailsAppData?.settings?.learningContent as Record<string, unknown> | undefined),
        [detailsAppData?.settings?.learningContent]
    )
    const currentSectionId =
        routeSectionId ??
        state.selectedObjectCollectionId ??
        state.selectedSectionId ??
        state.activeObjectCollectionId ??
        state.activeSectionId ??
        state.appData?.activeObjectCollectionId ??
        state.appData?.activeSectionId ??
        null
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
    const pageProgressTargetObjectCodename = detailsAppData?.objectCollection.codename ?? detailsAppData?.section?.codename ?? null
    const pageProgressTargetRecordId = detailsAppData?.section?.id ?? detailsAppData?.objectCollection?.id ?? currentRuntimeSectionId
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
            sectionId: currentRuntimeSectionId,
            sectionCodename: currentRuntimeSection?.codename ?? detailsAppData?.section?.codename ?? null,
            objectCollectionId: currentRuntimeObjectCollectionId,
            objectCollectionCodename: currentRuntimeSection?.codename ?? detailsAppData?.objectCollection.codename ?? null,
            sections: detailsAppData?.sections ?? [],
            objectCollections: detailsAppData?.objectCollections ?? [],
            apiBaseUrl: props.apiBaseUrl,
            locale: props.locale,
            currentWorkspaceId,
            runtimeAccessMode: 'member',
            runtimeQueryKeyPrefix: adapter?.queryKeyPrefix,
            workspacesEnabled,
            permissions: detailsAppData?.permissions,
            content: workspacePageContent,
            rows: hasResolvedDetailsAppData ? state.rows : [],
            columns: hasResolvedDetailsAppData ? state.columns : [],
            runtimeColumns: detailsAppData?.columns,
            loading: state.isLoading,
            rowCount: hasResolvedDetailsAppData ? state.rowCount : undefined,
            paginationModel: state.paginationModel,
            onPaginationModelChange: state.setPaginationModel,
            sortModel: state.sortModel,
            onSortModelChange: state.setSortModel,
            filterModel: state.filterModel,
            onFilterModelChange: state.setFilterModel,
            searchValue: state.searchValue,
            onSearchValueChange: state.setSearchValue,
            pageSizeOptions: state.pageSizeOptions,
            pageBlocks: detailsAppData?.objectCollection.pageBlocks ?? detailsAppData?.section?.pageBlocks,
            pagePlayer: {
                showOutline: learningContentSettings.playerPreset?.showOutline !== false,
                showProgressHeader: learningContentSettings.playerPreset?.showProgressHeader !== false,
                completeButtonMode: learningContentSettings.playerPreset?.completeButtonMode ?? 'manual',
                progressStorageKey: [
                    'learning-content-progress',
                    props.applicationId,
                    currentWorkspaceId ?? 'global',
                    currentRuntimeSectionId ?? currentSectionId ?? 'unknown'
                ].join(':'),
                onProgressChange: handlePageProgressChange
            },
            tableDefaults: {
                defaultViewMode: learningContentSettings.defaultView === 'cards' ? 'card' : 'table',
                columnPreset: learningContentSettings.columnPreset
            },
            resourceSourceTypes: learningContentSettings.supportedResourceTypes,
            onOpenCreateTarget: handleOpenCreateTarget,
            onOpenRowMenu: state.handleOpenMenu,
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
            hasResolvedDetailsAppData,
            currentRuntimeSection,
            currentRuntimeObjectCollectionId,
            currentRuntimeSectionId,
            detailsAppData?.section?.codename,
            detailsAppData?.objectCollection.codename,
            detailsAppData?.sections,
            detailsAppData?.objectCollections,
            state.appData?.objectCollection.runtimeConfig?.searchMode,
            currentWorkspaceId,
            currentSectionId,
            workspacesEnabled,
            detailsAppData?.permissions,
            state.canPersistRowReorder,
            state.rows,
            state.columns,
            detailsAppData?.columns,
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
            detailsAppData?.objectCollection.pageBlocks,
            detailsAppData?.section?.pageBlocks,
            learningContentSettings.playerPreset?.showOutline,
            learningContentSettings.playerPreset?.showProgressHeader,
            learningContentSettings.playerPreset?.completeButtonMode,
            learningContentSettings.defaultView,
            learningContentSettings.columnPreset,
            learningContentSettings.supportedResourceTypes,
            handlePageProgressChange,
            handleOpenCreateTarget,
            state.handleOpenMenu,
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
    const runtimeLayoutConfig = useMemo(() => {
        const selectedLayoutConfig = effectiveDashboardLayout?.layout.config
        const baseLayoutConfig = selectedLayoutConfig ? (selectedLayoutConfig as Partial<DashboardLayoutConfig>) : state.layoutConfig
        return isWorkspacesRoute ? { ...baseLayoutConfig, ...WORKSPACE_ROUTE_LAYOUT_OVERRIDES } : baseLayoutConfig
    }, [effectiveDashboardLayout?.layout.config, isWorkspacesRoute, state.layoutConfig])

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
    const workspaceSettingsMenuItem: DashboardMenuItem | null =
        workspaceMenuItem && routeWorkspaceId
            ? {
                  id: 'runtime-workspace-settings',
                  label: t('workspace.settings', 'Settings'),
                  icon: 'settings',
                  kind: 'link',
                  href: `/a/${props.applicationId}/workspaces/${routeWorkspaceId}/settings`,
                  selected: isWorkspacesRoute && workspaceRouteSection === 'settings'
              }
            : null
    const sectionLinksEnabled = state.appData?.settings?.sectionLinksEnabled !== false

    const appendWorkspaceMenuItem = (slot?: DashboardMenuSlot): DashboardMenuSlot | undefined => {
        if (!slot && !workspaceMenuItem) return slot
        const baseItems = slot?.items ?? []
        const hasWorkspaceRootItem = baseItems.some(isWorkspaceRootMenuItem)
        const normalizedBaseItems = baseItems.map((item) => {
            if (isWorkspaceRootMenuItem(item)) {
                return {
                    ...item,
                    kind: 'link' as const,
                    href: item.href ?? workspaceMenuItem?.href ?? null,
                    selected: isWorkspacesRoute
                }
            }

            return isWorkspacesRoute || sectionLinksEnabled
                ? toStandaloneSectionLinkMenuItem(item, props.applicationId, sectionLinksEnabled, isWorkspacesRoute, state.appData)
                : item
        })

        return {
            ...slot,
            title: slot?.title ?? null,
            showTitle: slot?.showTitle ?? false,
            items: [
                ...normalizedBaseItems,
                ...(workspaceMenuItem && !hasWorkspaceRootItem ? [workspaceMenuItem] : []),
                ...(workspaceDashboardMenuItem ? [workspaceDashboardMenuItem] : []),
                ...(workspaceAccessMenuItem ? [workspaceAccessMenuItem] : []),
                ...(workspaceSettingsMenuItem ? [workspaceSettingsMenuItem] : [])
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
                zoneWidgets={dashboardZoneWidgets}
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

function RuntimeBoundary({
    children,
    error,
    errorMessage,
    loading,
    errorCode,
    onRetry
}: {
    children?: ReactNode
    error?: boolean
    errorMessage?: string
    loading?: boolean
    errorCode?: LayoutRuntimeErrorCode | null
    onRetry?: () => void
}) {
    const { t } = useTranslation('apps')
    if (loading) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
                <CircularProgress aria-label={t('runtime.loading', 'Loading application')} />
            </Box>
        )
    }
    if (error) {
        return (
            <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
                <Alert
                    severity='error'
                    action={
                        onRetry ? (
                            <Button color='inherit' size='small' onClick={onRetry}>
                                {t('runtime.retry', 'Retry')}
                            </Button>
                        ) : undefined
                    }
                >
                    {errorMessage ??
                        (errorCode
                            ? t(`runtime.layoutErrors.${errorCode}`, {
                                  defaultValue: t('runtime.loadError', 'The application could not be loaded.')
                              })
                            : t('runtime.loadError', 'The application could not be loaded.'))}
                </Alert>
            </Box>
        )
    }
    return <>{children}</>
}

export default function DashboardApp(props: DashboardAppProps) {
    const { t } = useTranslation('apps')
    const [routeSource, setRouteSource] = useState(readCurrentRouteSource)
    useEffect(() => {
        if (typeof window === 'undefined') return undefined

        const handleRouteChange = () => {
            setRouteSource(readCurrentRouteSource())
        }

        window.addEventListener('popstate', handleRouteChange)
        window.addEventListener('hashchange', handleRouteChange)
        return () => {
            window.removeEventListener('popstate', handleRouteChange)
            window.removeEventListener('hashchange', handleRouteChange)
        }
    }, [])

    const workspaceId = useMemo(() => readStandaloneWorkspaceId(routeSource), [routeSource])
    const { runtimeTarget, runtimeTargetError } = useMemo(() => {
        try {
            return {
                runtimeTarget: readStandaloneRuntimeTarget(props.locale, workspaceId, routeSource),
                runtimeTargetError: null
            }
        } catch {
            return {
                runtimeTarget: { locale: props.locale, workspaceId } as RuntimeLayoutTarget,
                runtimeTargetError: t('runtime.invalidTarget', 'The runtime target in this URL is invalid.')
            }
        }
    }, [props.locale, routeSource, t, workspaceId])
    const marketingTarget = useMemo(() => readStandaloneMarketingTarget(routeSource), [routeSource])
    const templateQuery = useQuery({
        queryKey: buildRuntimeLayoutQueryKey(props.applicationId, runtimeTarget),
        queryFn: () =>
            fetchRuntimeEffectiveLayout({ apiBaseUrl: props.apiBaseUrl, applicationId: props.applicationId, target: runtimeTarget }),
        enabled: Boolean(props.applicationId) && !runtimeTargetError,
        staleTime: 60_000
    })
    const runtimeLayoutErrorCode =
        getRuntimeLayoutErrorCode(templateQuery.error) ??
        (templateQuery.data?.status === 'failed' ? getRuntimeLayoutErrorCode(templateQuery.data) : null)

    if (!props.applicationId) return <DashboardRuntimeContent {...props} />
    if (runtimeTargetError) return <RuntimeBoundary error errorMessage={runtimeTargetError} />
    if (templateQuery.isLoading) return <RuntimeBoundary loading />
    if (templateQuery.isError || !templateQuery.data || templateQuery.data.status === 'failed') {
        return <RuntimeBoundary error errorCode={runtimeLayoutErrorCode} onRetry={() => void templateQuery.refetch()} />
    }
    if (templateQuery.data.layout.templateKey === 'marketing-page') {
        return (
            <MarketingRuntimeContent
                {...props}
                workspaceId={workspaceId}
                target={marketingTarget}
                layoutIdentity={
                    templateQuery.data.effectiveHash
                        ? {
                              layoutVersion: templateQuery.data.layout.version ?? 1,
                              layoutHash: templateQuery.data.effectiveHash
                          }
                        : undefined
                }
                sharedLayoutWidgets={templateQuery.data.widgets}
                onLayoutStale={() => void templateQuery.refetch()}
                loadingLabel={t('runtime.loading', 'Loading application')}
                errorLabel={t('runtime.loadError', 'The application could not be loaded.')}
                retryLabel={t('runtime.retry', 'Retry')}
                onAction={(action) => {
                    if (action.actionKind !== 'internal' || typeof window === 'undefined') return
                    if (action.href.startsWith('#')) {
                        window.location.hash = action.href.slice(1)
                        return
                    }
                    window.location.assign(action.href)
                }}
            />
        )
    }
    return <DashboardRuntimeContent {...props} effectiveLayout={templateQuery.data} />
}
