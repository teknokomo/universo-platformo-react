import { lazy } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import '@universo-react/admin-frontend/i18n'
import '@universo-react/start-frontend/i18n'
import '@universo-react/applications-frontend/i18n'
import '@universo-react/metapanel-frontend/i18n'

import {
    AdminGuard,
    AuthGuard,
    ErrorBoundary,
    HomeRouteResolver,
    Loadable,
    MainLayoutMUI,
    MinimalLayout,
    RegisteredUserGuard,
    StartAccessGuard,
    StartLayoutMUI,
    Loader
} from '@universo-react/template-mui'

import { createAppRuntimeRoute, createPublicAppRuntimeRoute } from '@universo-react/apps-template-mui'
import { APPLICATION_HOST_ROUTE_PATHS } from '@universo-react/types'
import { AdminDialogSettingsProvider } from '@universo-react/admin-frontend'
import {
    ApplicationDialogSettingsProvider,
    applicationsQueryKeys,
    resolveApplicationRuntimeReference
} from '@universo-react/applications-frontend'
import { resolvePublicGuestRuntimeLocale } from './publicGuestRuntimeLocale'
import { isUuidV7 } from '@universo-react/utils'

const StartPage = Loadable(lazy(() => import('@universo-react/start-frontend/views/StartPage')))
const TermsPage = Loadable(lazy(() => import('@universo-react/start-frontend/views/LegalPage').then((m) => ({ default: m.TermsPage }))))
const PrivacyPage = Loadable(lazy(() => import('@universo-react/start-frontend/views/LegalPage').then((m) => ({ default: m.PrivacyPage }))))
const MetapanelDashboard = Loadable(lazy(() => import('@universo-react/metapanel-frontend/views/MetapanelDashboard')))

const ApplicationsApplicationList = Loadable(lazy(() => import('@universo-react/applications-frontend/pages/ApplicationList')))
const ApplicationsApplicationBoard = Loadable(lazy(() => import('@universo-react/applications-frontend/pages/ApplicationBoard')))
const ApplicationsApplicationMembers = Loadable(lazy(() => import('@universo-react/applications-frontend/pages/ApplicationMembers')))
const ApplicationsApplicationMigrations = Loadable(lazy(() => import('@universo-react/applications-frontend/pages/ApplicationMigrations')))
const ApplicationsApplicationLayouts = Loadable(lazy(() => import('@universo-react/applications-frontend/pages/ApplicationLayouts')))
const ApplicationsApplicationRuntimeEntry = Loadable(
    lazy(() => import('@universo-react/applications-frontend/pages/ApplicationRuntimeEntry'))
)
const ApplicationsApplicationSettings = Loadable(lazy(() => import('@universo-react/applications-frontend/pages/ApplicationSettings')))
const ApplicationsApplicationAdminGuard = Loadable(
    lazy(() => import('@universo-react/applications-frontend/components/ApplicationAdminGuard'))
)
const ApplicationsConnectorList = Loadable(lazy(() => import('@universo-react/applications-frontend/pages/ConnectorList')))
const ApplicationsConnectorBoard = Loadable(lazy(() => import('@universo-react/applications-frontend/pages/ConnectorBoard')))
const PublicGuestRuntimePage = Loadable(lazy(() => import('@universo-react/apps-template-mui').then((m) => ({ default: m.GuestApp }))))

const MetahubList = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.MetahubList }))))
const MetahubBoard = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.MetahubBoard }))))
const PublicationList = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.PublicationList }))))
const BranchList = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.BranchList }))))
const EntitiesWorkspace = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.EntitiesWorkspace }))))
const StandardEntityChildCollectionPage = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.StandardEntityChildCollectionPage })))
)
const SelectableOptionList = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.SelectableOptionList })))
)
const ComponentList = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.ComponentList }))))
const FixedValueList = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m: any) => ({ default: m.FixedValueList }))))
const RecordList = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.RecordList }))))
const MetahubResources = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.MetahubResources }))))
const PlayCanvasEditorHostPage = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.PlayCanvasEditorHostPage })))
)
const PlayCanvasEditorFullscreenPage = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.PlayCanvasEditorFullscreenPage })))
)
const MetahubLayoutDetails = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.MetahubLayoutDetails })))
)
const MetahubMigrations = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.MetahubMigrations }))))
const MetahubMigrationGuard = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.MetahubMigrationGuard })))
)
const MetahubMembers = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.MetahubMembers }))))
const EntityInstanceList = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.EntityInstanceList })))
)
const EntityBlockContentPage = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m) => ({ default: m.EntityBlockContentPage })))
)
const MetahubSettings = Loadable(lazy(() => import('@universo-react/metahubs-frontend').then((m: any) => ({ default: m.MetahubSettings }))))
const PublicationVersionList = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m: any) => ({ default: m.PublicationVersionList })))
)
const PublicationApplicationList = Loadable(
    lazy(() => import('@universo-react/metahubs-frontend').then((m: any) => ({ default: m.PublicationApplicationList })))
)

const AdminBoard = Loadable(lazy(() => import('@universo-react/admin-frontend/pages/AdminBoard')))
const InstanceList = Loadable(lazy(() => import('@universo-react/admin-frontend/pages/InstanceList')))
const InstanceBoard = Loadable(lazy(() => import('@universo-react/admin-frontend/pages/InstanceBoard')))
const InstanceUsers = Loadable(lazy(() => import('@universo-react/admin-frontend/pages/InstanceUsers')))
const RolesList = Loadable(lazy(() => import('@universo-react/admin-frontend/pages/RolesList')))
const RoleEdit = Loadable(lazy(() => import('@universo-react/admin-frontend/pages/RoleEdit')))
const RoleUsers = Loadable(lazy(() => import('@universo-react/admin-frontend/pages/RoleUsers')))
const LocalesList = Loadable(lazy(() => import('@universo-react/admin-frontend/pages/LocalesList')))
const AdminSettings = Loadable(lazy(() => import('@universo-react/admin-frontend/pages/AdminSettings')))
const ApplicationAliases = Loadable(lazy(() => import('@universo-react/applications-frontend/pages/ApplicationAliases')))

const ProfilePage = Loadable(lazy(() => import('@universo-react/profile-frontend/pages/Profile.jsx')))

const ApplicationAdminResolver = () => {
    return <MainLayoutMUI />
}

const PublicAwareApplicationRuntime = () => {
    return <ApplicationsApplicationRuntimeEntry />
}

const ApplicationAdminEntry = () => {
    const { applicationId = '' } = useParams<{ applicationId: string }>()

    if (!isUuidV7(applicationId)) {
        // Aliases address the application runtime only: `/a/<alias>/admin`
        // stays a runtime suffix instead of entering the management shell.
        return <ApplicationsApplicationRuntimeEntry />
    }

    return (
        <AuthGuard>
            <RegisteredUserGuard>
                <ApplicationAdminResolver />
            </RegisteredUserGuard>
        </AuthGuard>
    )
}

const PublicGuestRuntime = () => {
    const { applicationId = '', slug = '' } = useParams<{ applicationId: string; slug: string }>()

    return (
        <PublicGuestRuntimePage applicationId={applicationId} slug={slug} locale={resolvePublicGuestRuntimeLocale()} apiBaseUrl='/api/v1' />
    )
}

const AdminDialogScope = () => (
    <AdminDialogSettingsProvider>
        <Outlet />
    </AdminDialogSettingsProvider>
)

const ApplicationDialogScope = () => (
    <ApplicationDialogSettingsProvider>
        <Outlet />
    </ApplicationDialogSettingsProvider>
)

const HomeRoute = {
    path: APPLICATION_HOST_ROUTE_PATHS.home,
    element: (
        <ErrorBoundary>
            <HomeRouteResolver
                guestElement={
                    <StartLayoutMUI>
                        <StartPage />
                    </StartLayoutMUI>
                }
                workspaceElement={
                    <MainLayoutMUI>
                        <MetapanelDashboard />
                    </MainLayoutMUI>
                }
            />
        </ErrorBoundary>
    )
}

const StartRoute = {
    path: APPLICATION_HOST_ROUTE_PATHS.start,
    element: (
        <ErrorBoundary>
            <StartAccessGuard>
                <StartLayoutMUI>
                    <StartPage />
                </StartLayoutMUI>
            </StartAccessGuard>
        </ErrorBoundary>
    )
}

const TermsRoute = {
    path: APPLICATION_HOST_ROUTE_PATHS.terms,
    element: (
        <ErrorBoundary>
            <StartLayoutMUI>
                <TermsPage />
            </StartLayoutMUI>
        </ErrorBoundary>
    )
}

const PrivacyRoute = {
    path: APPLICATION_HOST_ROUTE_PATHS.privacy,
    element: (
        <ErrorBoundary>
            <StartLayoutMUI>
                <PrivacyPage />
            </StartLayoutMUI>
        </ErrorBoundary>
    )
}

const MinimalRoutes = {
    path: '/',
    element: (
        <ErrorBoundary>
            <MinimalLayout />
        </ErrorBoundary>
    ),
    children: [
        {
            path: 'metahub/:metahubId/resources/packages/:packageSlug/editor/fullscreen',
            element: (
                <AuthGuard>
                    <RegisteredUserGuard>
                        <MetahubMigrationGuard>
                            <PlayCanvasEditorFullscreenPage />
                        </MetahubMigrationGuard>
                    </RegisteredUserGuard>
                </AuthGuard>
            )
        },
        createAppRuntimeRoute({
            path: 'a/:applicationId/*',
            component: PublicAwareApplicationRuntime
        })
    ]
}

const ApplicationAdminRoute = {
    path: 'a/:applicationId/admin',
    element: (
        <ErrorBoundary>
            <ApplicationAdminEntry />
        </ErrorBoundary>
    ),
    children: [
        {
            element: (
                <ApplicationsApplicationAdminGuard>
                    <ApplicationDialogScope />
                </ApplicationsApplicationAdminGuard>
            ),
            children: [
                { index: true, element: <ApplicationsApplicationBoard /> },
                { path: 'connectors', element: <ApplicationsConnectorList /> },
                { path: 'connector/:connectorId', element: <ApplicationsConnectorBoard /> },
                { path: 'migrations', element: <ApplicationsApplicationMigrations /> },
                { path: 'layouts', element: <ApplicationsApplicationLayouts /> },
                { path: 'layouts/:layoutId', element: <ApplicationsApplicationLayouts /> },
                { path: 'access', element: <ApplicationsApplicationMembers /> },
                { path: 'settings', element: <ApplicationsApplicationSettings /> }
            ]
        }
    ]
}

const PublicRuntimeRoutes = {
    path: '/',
    element: (
        <ErrorBoundary>
            <Outlet />
        </ErrorBoundary>
    ),
    children: [
        createPublicAppRuntimeRoute({
            component: PublicGuestRuntime
        })
    ]
}

const MainRoutes = {
    path: '/',
    element: (
        <ErrorBoundary>
            <AuthGuard>
                <RegisteredUserGuard>
                    <MainLayoutMUI />
                </RegisteredUserGuard>
            </AuthGuard>
        </ErrorBoundary>
    ),
    children: [
        {
            path: 'dashboard',
            element: <Navigate to='/' replace />
        },
        {
            path: 'metapanel',
            element: <Navigate to='/' replace />
        },
        {
            path: 'applications',
            element: <Outlet />,
            children: [{ index: true, element: <ApplicationsApplicationList /> }]
        },
        {
            path: 'metahubs',
            element: <Outlet />,
            children: [{ index: true, element: <MetahubList /> }]
        },
        {
            path: 'metahub/:metahubId',
            element: (
                <MetahubMigrationGuard>
                    <Outlet />
                </MetahubMigrationGuard>
            ),
            children: [
                { index: true, element: <MetahubBoard /> },
                { path: 'publications', element: <PublicationList /> },
                { path: 'publication/:publicationId/versions', element: <PublicationVersionList /> },
                { path: 'publication/:publicationId/applications', element: <PublicationApplicationList /> },
                { path: 'migrations', element: <MetahubMigrations /> },
                { path: 'branches', element: <BranchList /> },
                { path: 'resources/packages/:packageSlug/editor/fullscreen', element: <PlayCanvasEditorFullscreenPage /> },
                { path: 'resources/packages/:packageSlug/editor', element: <PlayCanvasEditorHostPage /> },
                { path: 'resources', element: <MetahubResources /> },
                { path: 'entities', element: <EntitiesWorkspace /> },
                { path: 'entities/:kindKey/instances', element: <EntityInstanceList /> },
                { path: 'entities/:kindKey/instance/:entityId/content', element: <EntityBlockContentPage /> },
                { path: 'resources/layouts/:layoutId', element: <MetahubLayoutDetails /> },
                { path: 'entities/:kindKey/instance/:objectCollectionId/layout/:layoutId', element: <MetahubLayoutDetails /> },
                { path: 'entities/:kindKey/instance/:objectCollectionId/components', element: <ComponentList /> },
                { path: 'entities/:kindKey/instance/:objectCollectionId/requisites', element: <ComponentList /> },
                { path: 'entities/:kindKey/instance/:objectCollectionId/system', element: <ComponentList /> },
                { path: 'entities/:kindKey/instance/:objectCollectionId/records', element: <RecordList /> },
                { path: 'entities/:kindKey/instance/:treeEntityId/instances', element: <StandardEntityChildCollectionPage /> },
                {
                    path: 'entities/:kindKey/instance/:treeEntityId/instance/:objectCollectionId/components',
                    element: <ComponentList />
                },
                {
                    path: 'entities/:kindKey/instance/:treeEntityId/instance/:objectCollectionId/requisites',
                    element: <ComponentList />
                },
                { path: 'entities/:kindKey/instance/:treeEntityId/instance/:objectCollectionId/system', element: <ComponentList /> },
                { path: 'entities/:kindKey/instance/:treeEntityId/instance/:objectCollectionId/records', element: <RecordList /> },
                { path: 'entities/:kindKey/instance/:valueGroupId/fixed-values', element: <FixedValueList /> },
                { path: 'entities/:kindKey/instance/:treeEntityId/instance/:valueGroupId/fixed-values', element: <FixedValueList /> },
                { path: 'entities/:kindKey/instance/:optionListId/values', element: <SelectableOptionList /> },
                { path: 'entities/:kindKey/instance/:treeEntityId/instance/:optionListId/values', element: <SelectableOptionList /> },
                { path: 'members', element: <MetahubMembers /> },
                { path: 'access', element: <MetahubMembers /> },
                { path: 'settings', element: <MetahubSettings /> }
            ]
        },
        {
            path: 'profile',
            element: <ProfilePage />
        },
        {
            path: 'admin',
            element: (
                <AdminGuard>
                    <AdminDialogScope />
                </AdminGuard>
            ),
            children: [
                { index: true, element: <InstanceList /> },
                {
                    path: 'instance/:instanceId',
                    element: <Outlet />,
                    children: [
                        { index: true, element: <InstanceBoard /> },
                        { path: 'board', element: <InstanceBoard /> },
                        {
                            path: 'roles',
                            element: <Outlet />,
                            children: [
                                { index: true, element: <RolesList /> },
                                { path: ':roleId', element: <RoleEdit /> },
                                { path: ':roleId/users', element: <RoleUsers /> }
                            ]
                        },
                        { path: 'users', element: <InstanceUsers /> },
                        { path: 'locales', element: <LocalesList /> },
                        { path: 'aliases', element: <ApplicationAliases /> },
                        { path: 'settings', element: <AdminSettings /> }
                    ]
                },
                { path: 'board', element: <AdminBoard /> },
                { path: 'access', element: <Navigate to='/admin' replace /> }
            ]
        }
    ]
}

export default [HomeRoute, StartRoute, TermsRoute, PrivacyRoute, ApplicationAdminRoute, PublicRuntimeRoutes, MinimalRoutes, MainRoutes]
