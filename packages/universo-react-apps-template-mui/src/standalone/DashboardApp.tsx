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
import { fetchRuntimeTemplate, updateLearningContentProgress } from '../api/api'
import type { AppDataResponse } from '../api/api'
import { useCrudDashboard } from '../hooks/useCrudDashboard'
import { CrudDialogs } from '../components/CrudDialogs'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { RuntimeWorkspacesPage } from '../workspaces/RuntimeWorkspacesPage'
import MarketingRuntimeContent from '../marketing-page/MarketingRuntimeContent'

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
    return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

const readCurrentRoutePathname = (routeSource: string): string => {
    if (typeof window === 'undefined') return ''
    const hashRoute = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : ''
    const pathname = hashRoute || routeSource
    return pathname.split(/[?#]/, 1)[0] ?? window.location.pathname
}

const isStandaloneRuntimeRootRoute = (applicationId: string): boolean => {
    if (typeof window === 'undefined') return true

    const routeSource = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : window.location.pathname
    const routePathname = routeSource.split(/[?#]/, 1)[0] ?? ''
    const applicationPath = `/a/${applicationId}`
    if (routePathname !== applicationPath && !routePathname.startsWith(`${applicationPath}/`)) {
        return false
    }

    return routePathname.slice(applicationPath.length).split('/').filter(Boolean).length === 0
}

const readStandaloneWorkspaceId = (): string | null => {
    if (typeof window === 'undefined') return null

    const routeSource = window.location.hash.startsWith('#/')
        ? window.location.hash.slice(1)
        : `${window.location.pathname}${window.location.search}`
    const searchStart = routeSource.indexOf('?')
    if (searchStart === -1) return null

    const params = new URLSearchParams(routeSource.slice(searchStart + 1).split('#', 1)[0])
    return params.get('workspaceId')
}

const hasMatrixCellRouteParam = (routeSource: string): boolean => {
    const searchStart = routeSource.indexOf('?')
    if (searchStart === -1) return false

    const hashStart = routeSource.indexOf('#', searchStart)
    const search = routeSource.slice(searchStart + 1, hashStart === -1 ? undefined : hashStart)
    return new URLSearchParams(search).has('matrixCell')
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readStringArrayConfig = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

const normalizeRuntimeKey = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase()

const resolveSectionRecord = (
    appData: AppDataResponse | undefined,
    sectionId: string | null | undefined
): AppDataResponse['objectCollection'] | undefined => {
    if (!appData || !sectionId) return undefined

    const candidates = [...(appData.sections ?? []), ...(appData.objectCollections ?? [])]
    return candidates.find((candidate) => candidate.id === sectionId)
}

const getLoadedRuntimeSectionId = (appData: AppDataResponse | undefined): string | null =>
    appData?.section?.id ?? appData?.activeSectionId ?? appData?.objectCollection?.id ?? appData?.activeObjectCollectionId ?? null

const buildRouteProjectedAppData = (
    appData: AppDataResponse | undefined,
    currentRuntimeSection: AppDataResponse['objectCollection'] | undefined,
    currentRuntimeSectionId: string | null
): AppDataResponse | undefined => {
    if (!appData || !currentRuntimeSection || !currentRuntimeSectionId) return undefined
    if (getLoadedRuntimeSectionId(appData) === currentRuntimeSectionId) return undefined

    const hasTable = typeof currentRuntimeSection.tableName === 'string' && currentRuntimeSection.tableName.trim().length > 0

    return {
        ...appData,
        section: currentRuntimeSection,
        objectCollection: currentRuntimeSection,
        activeSectionId: currentRuntimeSectionId,
        activeObjectCollectionId: hasTable ? currentRuntimeSectionId : null,
        columns: [],
        rows: [],
        pagination: {
            ...appData.pagination,
            total: 0,
            offset: 0
        }
    }
}

const resolveSingleSystemMatrixSectionId = (appData: AppDataResponse | undefined): string | null => {
    if (!appData) return null

    const workspaceWidget = appData.zoneWidgets?.center?.find((widget) => widget.widgetKey === 'interpretationNetworkWorkspace')
    const visibleFor = isRecord(workspaceWidget?.config?.visibleFor) ? workspaceWidget.config.visibleFor : undefined
    if (!visibleFor) return null

    const sectionIds = readStringArrayConfig(visibleFor.sectionIds)
    const sectionCodenames = readStringArrayConfig(visibleFor.sectionCodenames).map(normalizeRuntimeKey)
    const objectCollectionIds = readStringArrayConfig(visibleFor.objectCollectionIds)
    const objectCollectionCodenames = readStringArrayConfig(visibleFor.objectCollectionCodenames).map(normalizeRuntimeKey)

    const menuSectionTargets = new Set(
        (appData.menus ?? [])
            .flatMap((menu) => [...(menu.items ?? []), ...(menu.overflowItems ?? [])])
            .filter((item) => item.isActive !== false && item.kind === 'section')
            .flatMap((item) => [item.sectionId, item.objectCollectionId])
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
    const preferMenuTarget = (ids: string[]): string | null => {
        const uniqueIds = Array.from(new Set(ids))
        return uniqueIds.find((id) => menuSectionTargets.has(id)) ?? uniqueIds[0] ?? null
    }

    const matchingSectionIds = (appData.sections ?? [])
        .filter((section) => sectionIds.includes(section.id) || sectionCodenames.includes(normalizeRuntimeKey(section.codename)))
        .map((section) => section.id)
    const matchingObjectCollectionIds = (appData.objectCollections ?? [])
        .filter(
            (objectCollection) =>
                objectCollectionIds.includes(objectCollection.id) ||
                objectCollectionCodenames.includes(normalizeRuntimeKey(objectCollection.codename))
        )
        .map((objectCollection) => objectCollection.id)
    const tableBackedObjectCollectionIds = (appData.objectCollections ?? [])
        .filter(
            (objectCollection) =>
                matchingObjectCollectionIds.includes(objectCollection.id) &&
                typeof objectCollection.tableName === 'string' &&
                objectCollection.tableName.trim().length > 0
        )
        .map((objectCollection) => objectCollection.id)
    const tableBackedSectionIds = (appData.sections ?? [])
        .filter(
            (section) =>
                matchingSectionIds.includes(section.id) && typeof section.tableName === 'string' && section.tableName.trim().length > 0
        )
        .map((section) => section.id)

    return preferMenuTarget([
        ...tableBackedObjectCollectionIds,
        ...tableBackedSectionIds,
        ...matchingObjectCollectionIds,
        ...matchingSectionIds
    ])
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

function DashboardRuntimeContent(props: DashboardAppProps) {
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
    const requestedWorkspaceId = routeWorkspaceId ?? readStandaloneWorkspaceId()
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
    const dashboardZoneWidgets = hasResolvedDetailsAppData
        ? routeProjectedAppData?.zoneWidgets ?? runtimeAppData?.zoneWidgets ?? state.appData?.zoneWidgets
        : undefined
    const detailsTitle = isWorkspacesRoute
        ? t('workspace.title', 'Workspaces')
        : detailsAppData?.objectCollection.name ?? currentRuntimeSection?.name ?? state.appData?.objectCollection.name ?? 'Details'
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

function RuntimeBoundary({ children, error, loading }: { children?: ReactNode; error?: boolean; loading?: boolean }) {
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
                <Alert severity='error'>{t('runtime.loadError', 'The application could not be loaded.')}</Alert>
            </Box>
        )
    }
    return <>{children}</>
}

export default function DashboardApp(props: DashboardAppProps) {
    const { t } = useTranslation('apps')
    const workspaceId = readStandaloneWorkspaceId()
    const templateQuery = useQuery({
        queryKey: ['standalone-runtime-template', props.applicationId],
        queryFn: () => fetchRuntimeTemplate({ apiBaseUrl: props.apiBaseUrl, applicationId: props.applicationId }),
        enabled: Boolean(props.applicationId),
        staleTime: 60_000
    })

    if (!props.applicationId) return <DashboardRuntimeContent {...props} />
    if (templateQuery.isLoading) return <RuntimeBoundary loading />
    if (templateQuery.isError || !templateQuery.data) return <RuntimeBoundary error />
    if (templateQuery.data.templateKey === 'marketing-page' && isStandaloneRuntimeRootRoute(props.applicationId)) {
        return (
            <MarketingRuntimeContent
                {...props}
                workspaceId={workspaceId}
                loadingLabel={t('runtime.loading', 'Loading application')}
                errorLabel={t('runtime.loadError', 'The application could not be loaded.')}
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
    return <DashboardRuntimeContent {...props} />
}
