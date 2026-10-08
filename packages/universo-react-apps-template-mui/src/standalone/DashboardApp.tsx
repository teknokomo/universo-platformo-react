import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { sanitizeApplicationLearningContentSettings } from '@universo-react/types'
import type { LayoutRuntimeErrorCode } from '@universo-react/types'
import Dashboard from '../dashboard/Dashboard'
import { withoutWorkspaceDashboardContent } from '../dashboard/runtime/workspaceDashboardLayout'
import type {
    DashboardCreateTarget,
    DashboardDetailsSlot,
    DashboardLayoutConfig,
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
import { resolveDashboardEntityTargetSectionId } from '../dashboard/runtime/resolveDashboardEntityTargetSectionId'
import { useCrudDashboard } from '../hooks/useCrudDashboard'
import { extractRuntimeErrorMessage } from '../utils/runtimeErrors'
import { CrudDialogs } from '../components/CrudDialogs'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { RuntimeWorkspacesPage } from '../workspaces/RuntimeWorkspacesPage'
import MarketingRuntimeContent from '../marketing-page/MarketingRuntimeContent'
import {
    useDashboardBoundRowActions,
    type DashboardBoundRowActionGuardFailure,
    type DashboardBoundRowMutationAction,
    type PendingDashboardRowTarget
} from '../dashboard/useDashboardBoundRowActions'
import { buildRouteProjectedAppData, getLoadedRuntimeSectionId, resolveSectionRecord } from './standaloneTargets'
import {
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
    footerMetadata?: DashboardDetailsSlot['footerMetadata']
}

const UUID_PATH_SEGMENT_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

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
    onRuntimeDataChanged?: () => void | Promise<unknown>
    onNavigate?: (href: string) => void
}

function DashboardRuntimeContent({ effectiveLayout, onRuntimeDataChanged, onNavigate, ...props }: DashboardRuntimeContentProps) {
    const { t } = useTranslation('apps')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [routeSource, setRouteSource] = useState(readCurrentRouteSource)
    const navigate = useCallback(
        (href: string) => {
            if (typeof window === 'undefined') return
            if (onNavigate) {
                onNavigate(href)
                return
            }
            if (window.location.hash.startsWith('#/a/')) {
                window.location.hash = href
                return
            }
            window.history.pushState(null, '', href)
            window.dispatchEvent(new PopStateEvent('popstate'))
            setRouteSource(readCurrentRouteSource())
        },
        [onNavigate]
    )
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
    const state = useCrudDashboard({
        adapter,
        locale: props.locale,
        initialSectionId: routeSectionId ?? effectiveLayout?.resolvedEntityTypeId ?? undefined,
        workspaceId: requestedWorkspaceId,
        createDefaultContext: buildLearningContentCreateDefaultContext,
        onRuntimeDataChanged
    })

    const contentPermissions = state.appData?.permissions
    const canCreateContent = contentPermissions?.createContent === true
    const canEditContent = contentPermissions?.editContent === true
    const canDeleteContent = contentPermissions?.deleteContent === true
    const showCreateButton = state.appData?.objectCollection?.runtimeConfig?.showCreateButton !== false && canCreateContent
    const currentWorkspaceId = state.appData?.currentWorkspaceId ?? null
    const runtimeAppData = state.rawAppData ?? state.appData
    const currentRuntimeSectionId =
        routeSectionId ??
        effectiveLayout?.resolvedEntityTypeId ??
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
    const runtimeRouteSectionId = routeSectionId ?? effectiveLayout?.resolvedEntityTypeId ?? undefined
    const routeMatchesLoadedSection = !runtimeRouteSectionId || getLoadedRuntimeSectionId(state.appData) === runtimeRouteSectionId
    const detailsAppData = routeProjectedAppData ?? (routeMatchesLoadedSection ? state.appData : undefined)
    const effectiveDashboardLayout = effectiveLayout?.layout.templateKey === 'dashboard' ? effectiveLayout : undefined
    const effectiveZoneWidgets = effectiveDashboardLayout ? toDashboardZoneWidgets(effectiveDashboardLayout) : undefined
    const dashboardZoneWidgets = useMemo(() => {
        if (!effectiveZoneWidgets || !isWorkspacesRoute) return effectiveZoneWidgets
        return withoutWorkspaceDashboardContent(effectiveZoneWidgets)
    }, [effectiveZoneWidgets, isWorkspacesRoute])
    const detailsTitle = isWorkspacesRoute
        ? t('workspace.title', 'Workspaces')
        : detailsAppData?.objectCollection?.name ??
          currentRuntimeSection?.name ??
          state.appData?.objectCollection?.name ??
          t('runtime.details', 'Details')
    const activeObjectCollectionRuntimeConfig = detailsAppData?.objectCollection?.runtimeConfig
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
        createDefaultContext?: DashboardCreateTarget['createDefaultContext']
        createWizard?: DashboardCreateTarget['createWizard']
        relationScope?: DashboardCreateTarget['relationScope']
    } | null>(null)
    const [pendingRowTarget, setPendingRowTarget] = useState<PendingDashboardRowTarget | null>(null)
    const resolveCreateTargetSectionId = useCallback(
        (target: DashboardCreateTarget) =>
            resolveDashboardEntityTargetSectionId(target, {
                sections: state.appData?.sections,
                objectCollections: state.appData?.objectCollections
            }),
        [state.appData?.objectCollections, state.appData?.sections]
    )
    const resolveRowTargetSectionId = useCallback(
        (target: DashboardRowTarget) =>
            resolveDashboardEntityTargetSectionId(target, {
                sections: state.appData?.sections,
                objectCollections: state.appData?.objectCollections
            }),
        [state.appData?.objectCollections, state.appData?.sections]
    )
    const handleBoundRowActionGuardFailure = useCallback(
        (failure: DashboardBoundRowActionGuardFailure) => {
            const message =
                failure === 'target'
                    ? t('app.targetActionUnavailable', 'This action is not available for this row.')
                    : failure === 'record-version'
                    ? t('app.errorRuntimeRowVersionRequired', 'This record has no current version. Reload it and try again.')
                    : t('app.errorWorkflowVersionRequired', 'Workflow action requires a current row version. Please reload and try again.')
            enqueueSnackbar(message, { variant: 'error' })
        },
        [enqueueSnackbar, t]
    )
    const handleBoundRowMutationSuccess = useCallback(
        async (action: DashboardBoundRowMutationAction) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['application-data', props.applicationId] }),
                queryClient.invalidateQueries({ queryKey: ['applications', props.applicationId, 'runtime', 'effective-layout'] })
            ])
            if (action.kind === 'record') {
                const messageKey =
                    action.command === 'post' ? 'app.recordPosted' : action.command === 'unpost' ? 'app.recordUnposted' : 'app.recordVoided'
                const fallback =
                    action.command === 'post' ? 'Record posted.' : action.command === 'unpost' ? 'Record unposted.' : 'Record voided.'
                enqueueSnackbar(t(messageKey, fallback), { variant: 'success' })
                return
            }
            enqueueSnackbar(t('app.workflowActionCompleted', 'Workflow action completed.'), { variant: 'success' })
        },
        [enqueueSnackbar, props.applicationId, queryClient, t]
    )
    const handleBoundRowMutationError = useCallback(
        (error: unknown, action: DashboardBoundRowMutationAction) => {
            const fallback = t('app.targetActionUnavailable', 'This action is not available for this row.')
            const message = extractRuntimeErrorMessage(error, fallback, props.locale)
            const messageKey = action.kind === 'record' ? 'app.errorRecordCommand' : 'app.errorWorkflowAction'
            enqueueSnackbar(
                t(messageKey, {
                    defaultValue: action.kind === 'record' ? 'Record command failed: {{message}}' : 'Workflow action failed: {{message}}',
                    message
                }),
                { variant: 'error' }
            )
        },
        [enqueueSnackbar, props.locale, t]
    )
    const {
        boundRowActionMenu,
        rowActionLoadState,
        pendingRowActionKind,
        closeBoundRowActionMenu,
        handleOpenDashboardRowMenu,
        handleOpenBoundRowTargetAction,
        handleBoundRecordCommand,
        handleBoundWorkflowAction
    } = useDashboardBoundRowActions({
        applicationId: props.applicationId,
        locale: props.locale,
        adapter,
        currentWorkspaceId,
        currentSectionId,
        resolveRowTargetSectionId,
        onSelectObjectCollection: state.onSelectObjectCollection,
        setPendingRowTarget,
        handleStateRowMenuOpen: state.handleOpenMenu,
        onGuardFailure: handleBoundRowActionGuardFailure,
        onMutationSuccess: handleBoundRowMutationSuccess,
        onMutationError: handleBoundRowMutationError
    })
    const boundRowActionData = rowActionLoadState.status === 'ready' ? rowActionLoadState.data : null
    const handleOpenCreateTarget = useCallback(
        (target: DashboardCreateTarget) => {
            if (target.disabled) return

            const targetSectionId = resolveCreateTargetSectionId(target)
            if (!targetSectionId) return

            setPendingCreateTarget({
                sectionId: targetSectionId,
                createDefaults: target.createDefaults,
                createDefaultContext: target.createDefaultContext,
                createWizard: target.createWizard,
                relationScope: target.relationScope
            })
            if (targetSectionId !== currentSectionId) {
                state.onSelectObjectCollection(targetSectionId)
            }
        },
        [currentSectionId, resolveCreateTargetSectionId, state]
    )
    const handleOpenRowTargetAction = useCallback(
        (
            rowId: string,
            action: DashboardRowTargetAction,
            relationScope?: DashboardRowTarget['relationScope'],
            expectedVersion?: number
        ) => {
            if (action === 'edit') {
                if (expectedVersion === undefined) state.handleOpenEdit(rowId, relationScope)
                else state.handleOpenEdit(rowId, relationScope, expectedVersion)
                return
            }
            if (action === 'copy') {
                if (expectedVersion === undefined) state.handleOpenCopy(rowId, relationScope)
                else state.handleOpenCopy(rowId, relationScope, expectedVersion)
                return
            }
            if (expectedVersion === undefined) state.handleOpenDelete(rowId, relationScope)
            else state.handleOpenDelete(rowId, relationScope, expectedVersion)
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

            setPendingRowTarget({
                sectionId: targetSectionId,
                rowId: target.rowId,
                action,
                expectedVersion: target.expectedVersion,
                relationScope: target.relationScope
            })
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
        state.handleOpenCreate(
            pendingCreateTarget.createDefaults,
            pendingCreateTarget.createDefaultContext,
            pendingCreateTarget.relationScope,
            pendingCreateTarget.createWizard
        )
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
        handleOpenRowTargetAction(
            pendingRowTarget.rowId,
            pendingRowTarget.action,
            pendingRowTarget.relationScope,
            pendingRowTarget.expectedVersion
        )
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
    const pageProgressTargetObjectCodename = detailsAppData?.objectCollection?.codename ?? detailsAppData?.section?.codename ?? null
    const pageProgressTargetRecordId = detailsAppData?.section?.id ?? detailsAppData?.objectCollection?.id ?? currentRuntimeSectionId
    const handlePageProgressChange = useCallback(
        async (payload: { action: 'view' | 'complete'; target?: { objectCodename: string; recordHandle: string } }) => {
            const targetObjectCodename = payload.target?.objectCodename ?? pageProgressTargetObjectCodename
            const targetRecordId = payload.target?.recordHandle ?? pageProgressTargetRecordId
            if (!targetObjectCodename || !targetRecordId) return
            await updateLearningContentProgress({
                apiBaseUrl: props.apiBaseUrl,
                applicationId: props.applicationId,
                targetObjectCodename,
                targetRecordId,
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
            objectCollectionCodename: currentRuntimeSection?.codename ?? detailsAppData?.objectCollection?.codename ?? null,
            sections: detailsAppData?.sections ?? [],
            objectCollections: detailsAppData?.objectCollections ?? [],
            apiBaseUrl: props.apiBaseUrl,
            locale: props.locale,
            settings: detailsAppData?.settings,
            currentWorkspaceId,
            footerMetadata: props.footerMetadata,
            runtimeAccessMode: 'member',
            runtimeQueryKeyPrefix: adapter?.queryKeyPrefix,
            onRuntimeDataChanged,
            workspacesEnabled,
            permissions: detailsAppData?.permissions,
            content: workspacePageContent,
            pageSizeOptions: state.pageSizeOptions,
            pageBlocks: detailsAppData?.objectCollection?.pageBlocks ?? detailsAppData?.section?.pageBlocks,
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
            resourceSourceTypes: learningContentSettings.supportedResourceTypes,
            onOpenCreateTarget: handleOpenCreateTarget,
            onOpenRowMenu: handleOpenDashboardRowMenu,
            onOpenRowTarget: handleOpenRowTarget,
            localeText: state.localeText,
            actions: createActions,
            navigate,
            rowReorder: state.canPersistRowReorder
                ? {
                      onReorder: state.handlePersistRowReorder,
                      isPending: state.isReordering
                  }
                : undefined,
            relationRowReorder: state.canPersistRelationRowReorder
                ? {
                      onReorder: state.handlePersistRelationRowReorder,
                      isPending: state.isReordering
                  }
                : undefined
        }),
        [
            detailsTitle,
            currentRuntimeSection,
            currentRuntimeObjectCollectionId,
            currentRuntimeSectionId,
            detailsAppData?.section?.codename,
            detailsAppData?.objectCollection?.codename,
            detailsAppData?.sections,
            detailsAppData?.objectCollections,
            detailsAppData?.settings,
            currentWorkspaceId,
            props.footerMetadata,
            currentSectionId,
            workspacesEnabled,
            detailsAppData?.permissions,
            state.canPersistRowReorder,
            state.canPersistRelationRowReorder,
            state.handlePersistRowReorder,
            state.handlePersistRelationRowReorder,
            state.isReordering,
            state.pageSizeOptions,
            detailsAppData?.objectCollection?.pageBlocks,
            detailsAppData?.section?.pageBlocks,
            learningContentSettings.playerPreset?.showOutline,
            learningContentSettings.playerPreset?.showProgressHeader,
            learningContentSettings.playerPreset?.completeButtonMode,
            learningContentSettings.supportedResourceTypes,
            handlePageProgressChange,
            handleOpenCreateTarget,
            handleOpenDashboardRowMenu,
            handleOpenRowTarget,
            onRuntimeDataChanged,
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
        const baseLayoutConfig = selectedLayoutConfig as Partial<DashboardLayoutConfig> | undefined
        return baseLayoutConfig?.sideMenu ? { sideMenu: baseLayoutConfig.sideMenu } : undefined
    }, [effectiveDashboardLayout?.layout.config])

    if (!props.applicationId) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant='body2'>Missing applicationId</Typography>
            </Box>
        )
    }

    return (
        <AppMainLayout>
            <Dashboard layoutConfig={runtimeLayoutConfig} zoneWidgets={dashboardZoneWidgets} details={details} />

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
                            confirmText: t('app.confirm', 'Confirm'),
                            loadingText: t('app.rowActionsLoading', 'Loading actions…'),
                            unavailableText: t('app.rowActionsUnavailable', 'Actions are unavailable for this record.')
                        }}
                        runtimeContext={
                            boundRowActionMenu
                                ? {
                                      menuAnchorEl: boundRowActionMenu.anchorEl,
                                      menuRowId: boundRowActionMenu.target.recordHandle,
                                      row: boundRowActionData?.row ?? null,
                                      columns: boundRowActionData?.appData.columns ?? [],
                                      recordBehavior: boundRowActionData?.appData.objectCollection.recordBehavior,
                                      workflowActions: boundRowActionData?.appData.objectCollection.workflowActions ?? [],
                                      workflowCapabilities: boundRowActionData?.appData.workflowCapabilities,
                                      permissions: {
                                          canEdit: boundRowActionData?.appData.permissions.editContent === true,
                                          canCopy: boundRowActionData?.appData.permissions.createContent === true,
                                          canDelete: boundRowActionData?.appData.permissions.deleteContent === true
                                      },
                                      isLoading: rowActionLoadState.status === 'loading',
                                      hasError: rowActionLoadState.status === 'error',
                                      isRecordCommandPending: pendingRowActionKind === 'record',
                                      isWorkflowActionPending: pendingRowActionKind === 'workflow',
                                      onCloseMenu: closeBoundRowActionMenu,
                                      onRowTargetAction: handleOpenBoundRowTargetAction,
                                      onRecordCommand: handleBoundRecordCommand,
                                      onWorkflowAction: handleBoundWorkflowAction
                                  }
                                : undefined
                        }
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

    const navigate = useCallback((href: string) => {
        if (typeof window === 'undefined') return
        let targetUrl: URL
        try {
            targetUrl = new URL(href, window.location.origin)
        } catch {
            return
        }
        if (targetUrl.origin !== window.location.origin || !targetUrl.pathname.startsWith('/a/')) return

        const nextRoute = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
        if (window.location.hash.startsWith('#/a/')) {
            if (window.location.hash.slice(1) !== nextRoute) window.location.hash = nextRoute
            return
        }

        const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`
        if (nextRoute === currentRoute) return
        window.history.pushState(null, '', nextRoute)
        window.dispatchEvent(new PopStateEvent('popstate'))
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
    const { refetch: refetchRuntimeLayout } = templateQuery
    const refreshEffectiveLayout = useCallback(() => refetchRuntimeLayout(), [refetchRuntimeLayout])
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
                themeVariant={runtimeTarget.themeVariant}
                target={marketingTarget}
                layoutIdentity={
                    templateQuery.data.effectiveHash
                        ? {
                              layoutVersion: templateQuery.data.layout.version ?? 1,
                              layoutHash: templateQuery.data.effectiveHash
                          }
                        : undefined
                }
                effectiveLayoutWidgets={templateQuery.data.widgets}
                effectiveLayoutConfig={templateQuery.data.layout}
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
    return (
        <DashboardRuntimeContent
            {...props}
            effectiveLayout={templateQuery.data}
            onRuntimeDataChanged={refreshEffectiveLayout}
            onNavigate={navigate}
        />
    )
}
