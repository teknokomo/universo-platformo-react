import { lazy } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import '@universo/admin-frontend/i18n'
import '@universo/start-frontend/i18n'
import '@universo/applications-frontend/i18n'
import '@universo/metapanel-frontend/i18n'

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
    StartLayoutMUI
} from '@universo/template-mui'

import { createAppRuntimeRoute } from '@universo/apps-template-mui'
import { AdminDialogSettingsProvider } from '@universo/admin-frontend'
import { ApplicationDialogSettingsProvider } from '@universo/applications-frontend'

const StartPage = Loadable(lazy(() => import('@universo/start-frontend/views/StartPage')))
const TermsPage = Loadable(lazy(() => import('@universo/start-frontend/views/LegalPage').then((m) => ({ default: m.TermsPage }))))
const PrivacyPage = Loadable(lazy(() => import('@universo/start-frontend/views/LegalPage').then((m) => ({ default: m.PrivacyPage }))))
const MetapanelDashboard = Loadable(lazy(() => import('@universo/metapanel-frontend/views/MetapanelDashboard')))

const ApplicationsApplicationList = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationList')))
const ApplicationsApplicationBoard = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationBoard')))
const ApplicationsApplicationMembers = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationMembers')))
const ApplicationsApplicationMigrations = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationMigrations')))
const ApplicationsApplicationRuntime = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationRuntime')))
const ApplicationsApplicationSettings = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationSettings')))
const ApplicationsApplicationGuard = Loadable(lazy(() => import('@universo/applications-frontend/components/ApplicationGuard')))
const ApplicationsApplicationAdminGuard = Loadable(lazy(() => import('@universo/applications-frontend/components/ApplicationAdminGuard')))
const ApplicationsConnectorList = Loadable(lazy(() => import('@universo/applications-frontend/pages/ConnectorList')))
const ApplicationsConnectorBoard = Loadable(lazy(() => import('@universo/applications-frontend/pages/ConnectorBoard')))
const ApplicationsMigrationGuard = Loadable(lazy(() => import('@universo/applications-frontend/components/ApplicationMigrationGuard')))

const MetahubList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubList }))))
const MetahubBoard = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubBoard }))))
const PublicationList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.PublicationList }))))
const BranchList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.BranchList }))))
const EntitiesWorkspace = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.EntitiesWorkspace }))))
const StandardEntityChildCollectionPage = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.StandardEntityChildCollectionPage })))
)
const SelectableOptionList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.SelectableOptionList }))))
const FieldDefinitionList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.FieldDefinitionList }))))
const FixedValueList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.FixedValueList }))))
const RecordList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.RecordList }))))
const MetahubResources = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubResources }))))
const MetahubLayoutDetails = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubLayoutDetails }))))
const MetahubMigrations = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMigrations }))))
const MetahubMigrationGuard = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMigrationGuard })))
)
const MetahubMembers = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMembers }))))
const EntityInstanceList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.EntityInstanceList }))))
const MetahubSettings = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.MetahubSettings }))))
const PublicationVersionList = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.PublicationVersionList })))
)
const PublicationApplicationList = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.PublicationApplicationList })))
)

const AdminBoard = Loadable(lazy(() => import('@universo/admin-frontend/pages/AdminBoard')))
const InstanceList = Loadable(lazy(() => import('@universo/admin-frontend/pages/InstanceList')))
const InstanceBoard = Loadable(lazy(() => import('@universo/admin-frontend/pages/InstanceBoard')))
const InstanceUsers = Loadable(lazy(() => import('@universo/admin-frontend/pages/InstanceUsers')))
const RolesList = Loadable(lazy(() => import('@universo/admin-frontend/pages/RolesList')))
const RoleEdit = Loadable(lazy(() => import('@universo/admin-frontend/pages/RoleEdit')))
const RoleUsers = Loadable(lazy(() => import('@universo/admin-frontend/pages/RoleUsers')))
const LocalesList = Loadable(lazy(() => import('@universo/admin-frontend/pages/LocalesList')))
const AdminSettings = Loadable(lazy(() => import('@universo/admin-frontend/pages/AdminSettings')))

const ProfilePage = Loadable(lazy(() => import('@universo/profile-frontend/pages/Profile.jsx')))

const GuardedApplicationRuntime = () => (
    <ApplicationsApplicationGuard>
        <ApplicationsMigrationGuard>
            <ApplicationsApplicationRuntime />
        </ApplicationsMigrationGuard>
    </ApplicationsApplicationGuard>
)

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
    path: '/',
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
    path: '/start',
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
    path: '/terms',
    element: (
        <ErrorBoundary>
            <StartLayoutMUI>
                <TermsPage />
            </StartLayoutMUI>
        </ErrorBoundary>
    )
}

const PrivacyRoute = {
    path: '/privacy',
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
        createAppRuntimeRoute({
            component: GuardedApplicationRuntime,
            guard: AuthGuard
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
            path: 'a/:applicationId/admin',
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
                { path: 'access', element: <ApplicationsApplicationMembers /> },
                { path: 'settings', element: <ApplicationsApplicationSettings /> }
            ]
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
                { path: 'resources', element: <MetahubResources /> },
                { path: 'entities', element: <EntitiesWorkspace /> },
                { path: 'entities/:kindKey/instances', element: <EntityInstanceList /> },
                { path: 'resources/layouts/:layoutId', element: <MetahubLayoutDetails /> },
                { path: 'entities/:kindKey/instance/:linkedCollectionId/layout/:layoutId', element: <MetahubLayoutDetails /> },
                { path: 'entities/:kindKey/instance/:linkedCollectionId/field-definitions', element: <FieldDefinitionList /> },
                { path: 'entities/:kindKey/instance/:linkedCollectionId/system', element: <FieldDefinitionList /> },
                { path: 'entities/:kindKey/instance/:linkedCollectionId/records', element: <RecordList /> },
                { path: 'entities/:kindKey/instance/:treeEntityId/instances', element: <StandardEntityChildCollectionPage /> },
                { path: 'entities/:kindKey/instance/:treeEntityId/instance/:linkedCollectionId/field-definitions', element: <FieldDefinitionList /> },
                { path: 'entities/:kindKey/instance/:treeEntityId/instance/:linkedCollectionId/system', element: <FieldDefinitionList /> },
                { path: 'entities/:kindKey/instance/:treeEntityId/instance/:linkedCollectionId/records', element: <RecordList /> },
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
                        { path: 'settings', element: <AdminSettings /> }
                    ]
                },
                { path: 'board', element: <AdminBoard /> },
                { path: 'access', element: <Navigate to='/admin' replace /> }
            ]
        }
    ]
}

export default [HomeRoute, StartRoute, TermsRoute, PrivacyRoute, MainRoutes, MinimalRoutes]
