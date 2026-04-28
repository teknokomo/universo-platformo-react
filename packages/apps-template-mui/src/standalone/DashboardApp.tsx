import { useMemo } from 'react'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import Dashboard from '../dashboard/Dashboard'
import type {
    DashboardDetailsSlot,
    DashboardLayoutConfig,
    DashboardMenuItem,
    DashboardMenuSlot,
    DashboardMenusMap
} from '../dashboard/Dashboard'
import AppMainLayout from '../layouts/AppMainLayout'
import { createStandaloneAdapter } from '../api/adapters'
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

const toStandaloneSectionLinkMenuItem = (
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
        href: buildStandaloneSectionHref(applicationId, targetCollectionId, sectionLinksEnabled),
        selected: false
    }
}

export default function DashboardApp(props: DashboardAppProps) {
    const { t } = useTranslation('apps')

    const isWorkspacesRoute = useMemo(() => {
        if (typeof window === 'undefined') return false
        return /\/a\/[0-9a-fA-F-]{16,}\/workspaces/.test(`${window.location.pathname}${window.location.hash}`)
    }, [])
    const runtimeRouteSegments = useMemo(() => {
        if (typeof window === 'undefined') return []
        const marker = `/a/${props.applicationId}`
        const suffix = window.location.pathname.startsWith(marker) ? window.location.pathname.slice(marker.length) : ''
        return suffix.split('/').filter(Boolean)
    }, [props.applicationId])
    const routeSectionId =
        !isWorkspacesRoute && UUID_PATH_SEGMENT_REGEX.test(runtimeRouteSegments[0] ?? '') ? runtimeRouteSegments[0] : undefined
    const routeWorkspaceId =
        isWorkspacesRoute && UUID_PATH_SEGMENT_REGEX.test(runtimeRouteSegments[1] ?? '') ? runtimeRouteSegments[1] : null
    const workspaceRouteSection = isWorkspacesRoute && runtimeRouteSegments[2] === 'access' ? 'access' : 'dashboard'

    const adapter = useMemo(
        () => createStandaloneAdapter({ apiBaseUrl: props.apiBaseUrl, applicationId: props.applicationId }),
        [props.apiBaseUrl, props.applicationId]
    )

    const state = useCrudDashboard({ adapter, locale: props.locale, initialSectionId: routeSectionId })

    const detailsTitle = isWorkspacesRoute ? t('workspace.title', 'Workspaces') : state.appData?.linkedCollection.name ?? 'Details'
    const showCreateButton = state.appData?.linkedCollection.runtimeConfig?.showCreateButton !== false
    const activeLinkedCollectionRuntimeConfig = state.appData?.linkedCollection.runtimeConfig
    const currentWorkspaceId = state.appData?.currentWorkspaceId ?? null
    const workspacesEnabled = state.appData?.workspacesEnabled ?? false
    const activeFormSurface = !state.formOpen
        ? 'dialog'
        : state.copyRowId
        ? activeLinkedCollectionRuntimeConfig?.copySurface ?? 'dialog'
        : state.editRowId
        ? activeLinkedCollectionRuntimeConfig?.editSurface ?? 'dialog'
        : activeLinkedCollectionRuntimeConfig?.createSurface ?? 'dialog'

    const createActions = useMemo(
        () =>
            showCreateButton ? (
                <Button variant='contained' size='small' startIcon={<AddIcon />} onClick={state.handleOpenCreate}>
                    {t('app.createRow', 'Create')}
                </Button>
            ) : null,
        [showCreateButton, state.handleOpenCreate, t]
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
                />
            ) : null,
        [isWorkspacesRoute, props.apiBaseUrl, props.applicationId, props.locale, routeWorkspaceId, workspaceRouteSection]
    )

    const details = useMemo<DashboardDetailsSlot>(
        () => ({
            title: detailsTitle,
            applicationId: props.applicationId,
            apiBaseUrl: props.apiBaseUrl,
            currentWorkspaceId,
            runtimeQueryKeyPrefix: adapter?.queryKeyPrefix,
            workspacesEnabled,
            content: workspacePageContent,
            rows: state.rows,
            columns: state.columns,
            loading: state.isLoading,
            rowCount: state.rowCount,
            paginationModel: state.paginationModel,
            onPaginationModelChange: state.setPaginationModel,
            pageSizeOptions: state.pageSizeOptions,
            localeText: state.localeText,
            actions: createActions,
            searchMode: state.appData?.linkedCollection.runtimeConfig?.searchMode ?? 'page-local',
            rowReorder: state.canPersistRowReorder
                ? {
                      onReorder: state.handlePersistRowReorder,
                      isPending: state.isReordering
                  }
                : undefined
        }),
        [
            detailsTitle,
            state.appData?.linkedCollection.runtimeConfig?.searchMode,
            currentWorkspaceId,
            workspacesEnabled,
            state.canPersistRowReorder,
            state.rows,
            state.columns,
            state.isLoading,
            state.handlePersistRowReorder,
            state.isReordering,
            state.rowCount,
            state.paginationModel,
            state.setPaginationModel,
            state.pageSizeOptions,
            state.localeText,
            createActions,
            adapter?.queryKeyPrefix,
            props.apiBaseUrl,
            props.applicationId,
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
        return {
            ...slot,
            title: slot?.title ?? null,
            showTitle: slot?.showTitle ?? false,
            items: [
                ...baseItems.map((item) =>
                    isWorkspacesRoute || sectionLinksEnabled
                        ? toStandaloneSectionLinkMenuItem(item, props.applicationId, sectionLinksEnabled, isWorkspacesRoute)
                        : item
                ),
                workspaceMenuItem,
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
                        linkedCollectionId={state.selectedLinkedCollectionId ?? state.activeLinkedCollectionId}
                        surface={activeFormSurface}
                        labels={{
                            editTitle: t('app.editRow', 'Edit element'),
                            createTitle: t('app.createRecordTitle', 'Create element'),
                            saveText: t('app.save', 'Save'),
                            createText: t('app.create', 'Create'),
                            savingText: t('app.saving', 'Saving...'),
                            creatingText: t('app.creating', 'Creating...'),
                            cancelText: t('app.cancel', 'Cancel'),
                            noFieldsText: t('app.noFields', 'No fields configured for this catalog.'),
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
                        labels={{
                            editText: t('app.edit', 'Edit'),
                            copyText: t('app.copy', 'Copy'),
                            deleteText: t('app.delete', 'Delete')
                        }}
                    />
                </>
            ) : null}
        </AppMainLayout>
    )
}
