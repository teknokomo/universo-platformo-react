import { lazy } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'

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
const HubList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.HubList }))))
const CatalogList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.CatalogList }))))
const SetList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.SetList }))))
const EnumerationList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.EnumerationList }))))
const EnumerationValueList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.EnumerationValueList }))))
const AttributeList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.AttributeList }))))
const ConstantList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.ConstantList }))))
const ElementList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.ElementList }))))
const MetahubCommon = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubCommon }))))
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

const LegacyMetahubLayoutsRedirect = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    return <Navigate to={metahubId ? `/metahub/${metahubId}/common` : '/metahubs'} replace />
}

const LegacyMetahubLayoutDetailsRedirect = () => {
    const { metahubId, layoutId } = useParams<{ metahubId: string; layoutId: string }>()
    return <Navigate to={metahubId && layoutId ? `/metahub/${metahubId}/common/layouts/${layoutId}` : '/metahubs'} replace />
}

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
                { path: 'common', element: <MetahubCommon /> },
                { path: 'entities', element: <EntitiesWorkspace /> },
                { path: 'entities/:kindKey/instances', element: <EntityInstanceList /> },
                { path: 'common/layouts/:layoutId', element: <MetahubLayoutDetails /> },
                { path: 'entities/:kindKey/instance/:catalogId/layout/:layoutId', element: <MetahubLayoutDetails /> },
                { path: 'entities/:kindKey/instance/:catalogId/attributes', element: <AttributeList /> },
                { path: 'entities/:kindKey/instance/:catalogId/system', element: <AttributeList /> },
                { path: 'entities/:kindKey/instance/:catalogId/elements', element: <ElementList /> },
                { path: 'entities/:kindKey/instance/:hubId/hubs', element: <HubList /> },
                { path: 'entities/:kindKey/instance/:hubId/catalogs', element: <CatalogList /> },
                { path: 'entities/:kindKey/instance/:hubId/sets', element: <SetList /> },
                { path: 'entities/:kindKey/instance/:hubId/enumerations', element: <EnumerationList /> },
                { path: 'entities/:kindKey/instance/:hubId/catalog/:catalogId/attributes', element: <AttributeList /> },
                { path: 'entities/:kindKey/instance/:hubId/catalog/:catalogId/system', element: <AttributeList /> },
                { path: 'entities/:kindKey/instance/:hubId/catalog/:catalogId/elements', element: <ElementList /> },
                { path: 'entities/:kindKey/instance/:setId/constants', element: <ConstantList /> },
                { path: 'entities/:kindKey/instance/:hubId/set/:setId/constants', element: <ConstantList /> },
                { path: 'entities/:kindKey/instance/:enumerationId/values', element: <EnumerationValueList /> },
                { path: 'entities/:kindKey/instance/:hubId/enumeration/:enumerationId/values', element: <EnumerationValueList /> },
                { path: 'general', element: <Navigate to='../common' replace /> },
                { path: 'general/layouts/:layoutId', element: <LegacyMetahubLayoutDetailsRedirect /> },
                { path: 'catalog/:catalogId/layout/:layoutId', element: <MetahubLayoutDetails /> },
                { path: 'hubs', element: <HubList /> },
                { path: 'catalogs', element: <CatalogList /> },
                { path: 'sets', element: <SetList /> },
                { path: 'enumerations', element: <EnumerationList /> },
                { path: 'layouts', element: <LegacyMetahubLayoutsRedirect /> },
                { path: 'layouts/:layoutId', element: <LegacyMetahubLayoutDetailsRedirect /> },
                { path: 'catalog/:catalogId/attributes', element: <AttributeList /> },
                { path: 'catalog/:catalogId/system', element: <AttributeList /> },
                { path: 'catalog/:catalogId/elements', element: <ElementList /> },
                { path: 'set/:setId/constants', element: <ConstantList /> },
                { path: 'enumeration/:enumerationId/values', element: <EnumerationValueList /> },
                { path: 'hub/:hubId/hubs', element: <HubList /> },
                { path: 'hub/:hubId/catalogs', element: <CatalogList /> },
                { path: 'hub/:hubId/sets', element: <SetList /> },
                { path: 'hub/:hubId/enumerations', element: <EnumerationList /> },
                { path: 'hub/:hubId/catalog/:catalogId/attributes', element: <AttributeList /> },
                { path: 'hub/:hubId/catalog/:catalogId/system', element: <AttributeList /> },
                { path: 'hub/:hubId/catalog/:catalogId/elements', element: <ElementList /> },
                { path: 'hub/:hubId/set/:setId/constants', element: <ConstantList /> },
                { path: 'hub/:hubId/enumeration/:enumerationId/values', element: <EnumerationValueList /> },
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
