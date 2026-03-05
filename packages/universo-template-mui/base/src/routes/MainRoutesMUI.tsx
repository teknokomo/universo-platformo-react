import { lazy } from 'react'
import { Outlet } from 'react-router-dom'

// CRITICAL: Import i18n registrations BEFORE lazy components
// Ensures namespaces are registered before route components try to use translations
import '@universo/admin-frontend/i18n'
import '@universo/start-frontend/i18n'
import '@universo/applications-frontend/i18n'

import MainLayoutMUI from '../layout/MainLayoutMUI'
import MinimalLayout from '../layout/MinimalLayout'
import StartLayoutMUI from '../layout/StartLayoutMUI'
import Dashboard from '../views/dashboard/Dashboard'
import { ErrorBoundary } from '../components'

// Use local routing components
import { AuthGuard, AdminGuard, Loadable } from '../components/routing'

// Route factory from apps-template-mui
import { createAppRuntimeRoute } from '@universo/apps-template-mui'

// Start page
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const StartPage = Loadable(lazy(() => import('@universo/start-frontend/views/StartPage')))
// Legal pages - Terms of Service and Privacy Policy
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const TermsPage = Loadable(lazy(() => import('@universo/start-frontend/views/LegalPage').then((m) => ({ default: m.TermsPage }))))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const PrivacyPage = Loadable(lazy(() => import('@universo/start-frontend/views/LegalPage').then((m) => ({ default: m.PrivacyPage }))))

// Applications module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ApplicationsApplicationList = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ApplicationsApplicationBoard = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ApplicationsApplicationMembers = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationMembers')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ApplicationsApplicationMigrations = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationMigrations')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ApplicationsApplicationRuntime = Loadable(lazy(() => import('@universo/applications-frontend/pages/ApplicationRuntime')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ApplicationsApplicationAdminGuard = Loadable(lazy(() => import('@universo/applications-frontend/components/ApplicationAdminGuard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ApplicationsConnectorList = Loadable(lazy(() => import('@universo/applications-frontend/pages/ConnectorList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ApplicationsConnectorBoard = Loadable(lazy(() => import('@universo/applications-frontend/pages/ConnectorBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ApplicationsMigrationGuard = Loadable(lazy(() => import('@universo/applications-frontend/components/ApplicationMigrationGuard')))

// Metahub module components
const MetahubList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubList }))))
const MetahubBoard = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubBoard }))))
const PublicationList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.PublicationList }))))
const BranchList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.BranchList }))))
const HubList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.HubList }))))
const CatalogList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.CatalogList }))))
const SetList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.SetList }))))
const EnumerationList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.EnumerationList }))))
const EnumerationValueList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.EnumerationValueList }))))
const AttributeList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.AttributeList }))))
const ConstantList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.ConstantList }))))
const ElementList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.ElementList }))))
const MetahubLayouts = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubLayouts }))))
const MetahubLayoutDetails = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubLayoutDetails }))))
const MetahubMigrations = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMigrations }))))
const MetahubMigrationGuard = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMigrationGuard })))
)
const MetahubMembers = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMembers }))))
const MetahubSettings = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.MetahubSettings }))))
const PublicationVersionList = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.PublicationVersionList })))
)
const PublicationApplicationList = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.PublicationApplicationList })))
)

// Admin module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const AdminBoard = Loadable(lazy(() => import('@universo/admin-frontend/pages/AdminBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const AdminAccess = Loadable(lazy(() => import('@universo/admin-frontend/pages/AdminAccess')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const InstanceList = Loadable(lazy(() => import('@universo/admin-frontend/pages/InstanceList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const InstanceBoard = Loadable(lazy(() => import('@universo/admin-frontend/pages/InstanceBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const InstanceUsers = Loadable(lazy(() => import('@universo/admin-frontend/pages/InstanceUsers')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const RolesList = Loadable(lazy(() => import('@universo/admin-frontend/pages/RolesList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const RoleEdit = Loadable(lazy(() => import('@universo/admin-frontend/pages/RoleEdit')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const RoleUsers = Loadable(lazy(() => import('@universo/admin-frontend/pages/RoleUsers')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const LocalesList = Loadable(lazy(() => import('@universo/admin-frontend/pages/LocalesList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const AdminSettings = Loadable(lazy(() => import('@universo/admin-frontend/pages/AdminSettings')))

const ProfilePage = Loadable(lazy(() => import('@universo/profile-frontend/pages/Profile.jsx')))

// Composite runtime component: migration guard wrapping the application runtime
const GuardedApplicationRuntime = () => (
    <ApplicationsMigrationGuard>
        <ApplicationsApplicationRuntime />
    </ApplicationsMigrationGuard>
)

// Main routes configuration object
// Using ErrorBoundary at layout level to ensure proper Router context
// IMPORTANT: Use RELATIVE paths for children (without leading slash)
// React Router v6 correctly concatenates parent '/' + child 'applications' = '/applications'

// Start page route - shows different content based on auth status
const StartRoute = {
    path: '/',
    element: (
        <ErrorBoundary>
            <StartLayoutMUI>
                <StartPage />
            </StartLayoutMUI>
        </ErrorBoundary>
    )
}

// Terms of Service page - public access
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

// Privacy Policy page - public access
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

// Routes with minimal layout (no sidebar/navigation) for full-screen views
const MinimalRoutes = {
    path: '/',
    element: (
        <ErrorBoundary>
            <MinimalLayout />
        </ErrorBoundary>
    ),
    children: [
        // Application runtime route — created via apps-template-mui route factory
        // ApplicationMigrationGuard checks if schema sync is required before rendering runtime
        createAppRuntimeRoute({
            component: GuardedApplicationRuntime,
            guard: AuthGuard
        })
    ]
}

// Routes with main layout (sidebar + navigation)
// AuthGuard wraps the entire layout to prevent flash of protected content
const MainRoutesMUI = {
    path: '/',
    element: (
        <ErrorBoundary>
            <AuthGuard>
                <MainLayoutMUI />
            </AuthGuard>
        </ErrorBoundary>
    ),
    children: [
        {
            // Dashboard route - main entry point after authentication
            path: 'dashboard',
            element: <Dashboard />
        },
        // Applications module routes
        {
            path: 'applications',
            element: <Outlet />,
            children: [
                {
                    index: true,
                    element: <ApplicationsApplicationList />
                }
            ]
        },
        {
            path: 'a/:applicationId/admin',
            element: (
                <ApplicationsApplicationAdminGuard>
                    <Outlet />
                </ApplicationsApplicationAdminGuard>
            ),
            children: [
                {
                    index: true,
                    element: <ApplicationsApplicationBoard />
                },
                {
                    path: 'connectors',
                    element: <ApplicationsConnectorList />
                },
                {
                    path: 'connector/:connectorId',
                    element: <ApplicationsConnectorBoard />
                },
                {
                    path: 'migrations',
                    element: <ApplicationsApplicationMigrations />
                },
                {
                    path: 'access',
                    element: <ApplicationsApplicationMembers />
                }
            ]
        },
        // Metahubs module routes
        {
            path: 'metahubs',
            element: <Outlet />,
            children: [
                {
                    index: true,
                    element: <MetahubList />
                }
            ]
        },
        {
            path: 'metahub/:metahubId',
            element: (
                <MetahubMigrationGuard>
                    <Outlet />
                </MetahubMigrationGuard>
            ),
            children: [
                {
                    index: true,
                    element: <MetahubBoard />
                },
                {
                    path: 'publications',
                    element: <PublicationList />
                },
                {
                    path: 'publication/:publicationId/versions',
                    element: <PublicationVersionList />
                },
                {
                    path: 'publication/:publicationId/applications',
                    element: <PublicationApplicationList />
                },
                {
                    path: 'migrations',
                    element: <MetahubMigrations />
                },
                {
                    path: 'branches',
                    element: <BranchList />
                },
                {
                    path: 'hubs',
                    element: <HubList />
                },
                // Global catalog routes (all catalogs in metahub, no hub context)
                {
                    path: 'catalogs',
                    element: <CatalogList />
                },
                {
                    path: 'sets',
                    element: <SetList />
                },
                {
                    path: 'enumerations',
                    element: <EnumerationList />
                },
                {
                    path: 'layouts',
                    element: <MetahubLayouts />
                },
                {
                    path: 'layouts/:layoutId',
                    element: <MetahubLayoutDetails />
                },
                {
                    path: 'catalog/:catalogId/attributes',
                    element: <AttributeList />
                },
                {
                    path: 'catalog/:catalogId/elements',
                    element: <ElementList />
                },
                {
                    path: 'set/:setId/constants',
                    element: <ConstantList />
                },
                {
                    path: 'enumeration/:enumerationId/values',
                    element: <EnumerationValueList />
                },
                // Hub-scoped catalog routes
                {
                    path: 'hub/:hubId/catalogs',
                    element: <CatalogList />
                },
                {
                    path: 'hub/:hubId/sets',
                    element: <SetList />
                },
                {
                    path: 'hub/:hubId/enumerations',
                    element: <EnumerationList />
                },
                {
                    path: 'hub/:hubId/catalog/:catalogId/attributes',
                    element: <AttributeList />
                },
                {
                    path: 'hub/:hubId/catalog/:catalogId/elements',
                    element: <ElementList />
                },
                {
                    path: 'hub/:hubId/set/:setId/constants',
                    element: <ConstantList />
                },
                {
                    path: 'hub/:hubId/enumeration/:enumerationId/values',
                    element: <EnumerationValueList />
                },
                {
                    path: 'members',
                    element: <MetahubMembers />
                },
                {
                    path: 'access',
                    element: <MetahubMembers />
                },
                {
                    path: 'settings',
                    element: <MetahubSettings />
                }
            ]
        },
        {
            path: 'profile',
            element: <ProfilePage />
        },
        // Admin routes (instances and global access management)
        // Wrapped in AdminGuard to check both authentication and admin panel access
        {
            path: 'admin',
            element: (
                <AdminGuard>
                    <Outlet />
                </AdminGuard>
            ),
            children: [
                // Instance list (main admin page)
                {
                    index: true,
                    element: <InstanceList />
                },
                // Instance context routes
                {
                    path: 'instance/:instanceId',
                    element: <Outlet />,
                    children: [
                        {
                            index: true,
                            element: <InstanceBoard />
                        },
                        {
                            path: 'board',
                            element: <InstanceBoard />
                        },
                        // Roles management routes (scoped to instance context)
                        {
                            path: 'roles',
                            element: <Outlet />,
                            children: [
                                {
                                    index: true,
                                    element: <RolesList />
                                },
                                {
                                    path: ':roleId',
                                    element: <RoleEdit />
                                },
                                {
                                    path: ':roleId/users',
                                    element: <RoleUsers />
                                }
                            ]
                        },
                        {
                            path: 'users',
                            element: <InstanceUsers />
                        },
                        // Locales management (VLC content localization settings)
                        {
                            path: 'locales',
                            element: <LocalesList />
                        },
                        // Platform settings (codename defaults, etc.)
                        {
                            path: 'settings',
                            element: <AdminSettings />
                        }
                    ]
                },
                // Legacy routes (kept for backward compatibility during transition)
                {
                    path: 'board',
                    element: <AdminBoard />
                },
                {
                    path: 'access',
                    element: <AdminAccess />
                }
            ]
        }
    ]
}

// Export route configurations
// StartRoute is the exact match for '/' (shows different content based on auth status)
// TermsRoute and PrivacyRoute are public legal pages
// MinimalRoutes handles application runtime with minimal layout
// MainRoutesMUI catches all authenticated routes with main layout
export default [StartRoute, TermsRoute, PrivacyRoute, MinimalRoutes, MainRoutesMUI]
