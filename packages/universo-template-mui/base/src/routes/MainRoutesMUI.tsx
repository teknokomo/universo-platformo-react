import { lazy } from 'react'
import { Outlet } from 'react-router-dom'

// CRITICAL: Import i18n registrations BEFORE lazy components
// Ensures namespaces are registered before route components try to use translations
import '@universo/uniks-frontend/i18n'
import '@universo/metaverses-frontend/i18n'
// Register admin translations before lazy loading Admin component
import '@universo/admin-frontend/i18n'
// IMPORTANT: Register analytics translations before lazy loading Analytics component
import '@universo/analytics-frontend/i18n'
// Register tools translations before lazy loading Tools component
import '@flowise/tools-frontend/i18n'
// Register credentials translations before lazy loading Credentials component
import '@flowise/credentials-frontend/i18n'
// Register variables translations before lazy loading Variables component
import '@flowise/variables-frontend/i18n'
// Register apiKeys translations before lazy loading ApiKeys component
import '@flowise/apikey-frontend/i18n'
// Register assistants translations before lazy loading Assistants component
import '@flowise/assistants-frontend/i18n'
// Register executions translations before lazy loading Executions component
import '@flowise/executions-frontend/i18n'
// Register document-store translations before lazy loading Document Store component
import '@flowise/docstore-frontend/i18n'
// Register customtemplates translations before lazy loading Templates component
import '@flowise/customtemplates-frontend/i18n'

// Register start-frontend translations (onboarding + legal)
import '@universo/start-frontend/i18n'
// Register applications-frontend translations (migration guard + runtime)
import '@universo/applications-frontend/i18n'

import MainLayoutMUI from '../layout/MainLayoutMUI'
import MinimalLayout from '../layout/MinimalLayout'
import StartLayoutMUI from '../layout/StartLayoutMUI'
import Dashboard from '../views/dashboard/Dashboard'
import { ErrorBoundary } from '../components'

// Use local routing components (migrated from @flowise/template-mui)
import { AuthGuard, AdminGuard, Loadable } from '../components/routing'

// Route factory from apps-template-mui
import { createAppRuntimeRoute } from '@universo/apps-template-mui'

// Unik module components
const UnikList = Loadable(lazy(() => import('@universo/uniks-frontend/pages/UnikList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const UnikBoard = Loadable(lazy(() => import('@universo/uniks-frontend/pages/UnikBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const UnikMember = Loadable(lazy(() => import('@universo/uniks-frontend/pages/UnikMember')))

// Legacy components (temporarily loaded in new UI)
const Spaces = Loadable(lazy(() => import('@universo/spaces-frontend/src/views/spaces/index.jsx')))
const Canvas = Loadable(lazy(() => import('@universo/spaces-frontend/src/views/canvas/index.jsx')))
// Tools page - moved to @flowise/tools-frontend
const Tools = Loadable(lazy(() => import('@flowise/tools-frontend/pages/Tools')))
// Credentials page - moved to @flowise/credentials-frontend
// @ts-expect-error - Source-only JSX imports resolved at runtime by bundler
const Credentials = Loadable(lazy(() => import('@flowise/credentials-frontend/pages/Credentials')))
// Variables page - moved to @flowise/variables-frontend
// @ts-expect-error - Source-only JSX imports resolved at runtime by bundler
const Variables = Loadable(lazy(() => import('@flowise/variables-frontend/pages/Variables')))
// ApiKeys page - moved to @flowise/apikey-frontend
// @ts-expect-error - Source-only JSX imports resolved at runtime by bundler
const ApiKeys = Loadable(lazy(() => import('@flowise/apikey-frontend/pages/APIKey')))
// Document Store pages - moved to @flowise/docstore-frontend
const DocumentStores = Loadable(lazy(() => import('@flowise/docstore-frontend/pages/docstore')))
const DocumentStoreDetail = Loadable(lazy(() => import('@flowise/docstore-frontend/pages/docstore/DocumentStoreDetail')))
const LoaderConfigPreviewChunks = Loadable(lazy(() => import('@flowise/docstore-frontend/pages/docstore/LoaderConfigPreviewChunks')))
const ShowStoredChunks = Loadable(lazy(() => import('@flowise/docstore-frontend/pages/docstore/ShowStoredChunks')))
const VectorStoreConfigure = Loadable(lazy(() => import('@flowise/docstore-frontend/pages/docstore/VectorStoreConfigure')))
const VectorStoreQuery = Loadable(lazy(() => import('@flowise/docstore-frontend/pages/docstore/VectorStoreQuery')))
// Assistants pages - moved to @flowise/assistants-frontend
const Assistants = Loadable(lazy(() => import('@flowise/assistants-frontend/pages/Assistants')))
const CustomAssistantLayout = Loadable(lazy(() => import('@flowise/assistants-frontend/pages/custom/CustomAssistantLayout')))
const CustomAssistantConfigurePreview = Loadable(
    lazy(() => import('@flowise/assistants-frontend/pages/custom/CustomAssistantConfigurePreview'))
)
const OpenAIAssistantLayout = Loadable(lazy(() => import('@flowise/assistants-frontend/pages/openai/OpenAIAssistantLayout')))
// Executions pages - moved to @flowise/executions-frontend
// @ts-expect-error - Source-only JSX imports resolved at runtime by bundler
const Executions = Loadable(lazy(() => import('@flowise/executions-frontend/pages/Executions')))
// @ts-expect-error - Source-only JSX imports resolved at runtime by bundler
const PublicExecutionDetails = Loadable(lazy(() => import('@flowise/executions-frontend/pages/PublicExecutionDetails')))
// @ts-expect-error - Legacy Analytics component - moved to @universo/analytics-frontend
const Analytics = Loadable(lazy(() => import('@universo/analytics-frontend/pages/Analytics')))

// Start page - moved to @universo/start-frontend
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const StartPage = Loadable(lazy(() => import('@universo/start-frontend/views/StartPage')))
// Legal pages - Terms of Service and Privacy Policy
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const TermsPage = Loadable(lazy(() => import('@universo/start-frontend/views/LegalPage').then((m) => ({ default: m.TermsPage }))))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const PrivacyPage = Loadable(lazy(() => import('@universo/start-frontend/views/LegalPage').then((m) => ({ default: m.PrivacyPage }))))
// Custom Templates pages - moved to @flowise/customtemplates-frontend
// Note: TemplateCanvas is routed via CanvasRoutes with MinimalLayout
const Templates = Loadable(lazy(() => import('@flowise/customtemplates-frontend/pages/Templates')))

// Metaverse module components
const MetaverseList = Loadable(lazy(() => import('@universo/metaverses-frontend/pages/MetaverseList')))
const MetaverseBoard = Loadable(lazy(() => import('@universo/metaverses-frontend/pages/MetaverseBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const SectionList = Loadable(lazy(() => import('@universo/metaverses-frontend/pages/SectionList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const EntityList = Loadable(lazy(() => import('@universo/metaverses-frontend/pages/EntityList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const MetaverseMembers = Loadable(lazy(() => import('@universo/metaverses-frontend/pages/MetaverseMembers')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const MetaverseGuard = Loadable(lazy(() => import('@universo/metaverses-frontend/components/MetaverseGuard')))

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
const EnumerationList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.EnumerationList }))))
const EnumerationValueList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.EnumerationValueList }))))
const AttributeList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.AttributeList }))))
const ElementList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.ElementList }))))
const MetahubLayouts = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubLayouts }))))
const MetahubLayoutDetails = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubLayoutDetails }))))
const MetahubMigrations = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMigrations }))))
const MetahubMigrationGuard = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMigrationGuard })))
)
const MetahubMembers = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMembers }))))
const PublicationVersionList = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.PublicationVersionList })))
)
const PublicationApplicationList = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m: any) => ({ default: m.PublicationApplicationList })))
)

// Removed: SectionDetail, EntityDetail (old implementations deleted during cleanup)
// Removed: ClusterList from @universo/resources-frontend (package deleted)
// Removed: AllCatalogsList, CatalogDetailPage (consolidated into CatalogList with isHubScoped pattern)

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
// React Router v6 correctly concatenates parent '/' + child 'metaverses' = '/metaverses'

// Start page route - shows different content based on auth status
// Uses StartLayoutMUI with AppAppBar for consistent navigation
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
        {
            path: 'execution/:id',
            element: <PublicExecutionDetails />
        },
        {
            path: 'unik/:unikId/spaces/new',
            element: (
                <AuthGuard>
                    <Canvas />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/space/:id',
            element: (
                <AuthGuard>
                    <Canvas />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/space/:spaceId/canvas/:canvasId',
            element: (
                <AuthGuard>
                    <Canvas />
                </AuthGuard>
            )
        },
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
            element: <UnikList />
        },
        {
            path: 'uniks',
            element: <UnikList />
        },
        {
            path: 'unik/:unikId',
            element: <UnikBoard />
        },
        {
            path: 'unik/:unikId/spaces',
            element: <Spaces />
        },
        {
            path: 'unik/:unikId/tools',
            element: <Tools />
        },
        {
            path: 'unik/:unikId/credentials',
            element: <Credentials />
        },
        {
            path: 'unik/:unikId/variables',
            element: <Variables />
        },
        {
            path: 'unik/:unikId/apikey',
            element: <ApiKeys />
        },
        {
            path: 'unik/:unikId/document-stores',
            element: <Outlet />,
            children: [
                {
                    index: true,
                    element: <DocumentStores />
                },
                {
                    path: ':storeId',
                    element: <DocumentStoreDetail />
                },
                {
                    path: ':storeId/:name',
                    element: <LoaderConfigPreviewChunks />
                },
                {
                    path: 'chunks/:storeId/:fileId',
                    element: <ShowStoredChunks />
                },
                {
                    path: 'vector/:storeId/:docId',
                    element: <VectorStoreConfigure />
                },
                {
                    path: 'query/:storeId',
                    element: <VectorStoreQuery />
                }
            ]
        },
        {
            path: 'unik/:unikId/assistants',
            element: <Outlet />,
            children: [
                {
                    index: true,
                    element: <Assistants />
                },
                {
                    path: 'custom',
                    element: <CustomAssistantLayout />
                },
                {
                    path: 'custom/:id',
                    element: <CustomAssistantConfigurePreview />
                },
                {
                    path: 'openai',
                    element: <OpenAIAssistantLayout />
                }
            ]
        },
        {
            path: 'unik/:unikId/executions',
            element: <Executions />
        },
        {
            path: 'unik/:unikId/analytics',
            element: <Analytics />
        },
        {
            path: 'unik/:unikId/templates',
            element: <Templates />
            // Note: Template detail view (templates/:id) is in CanvasRoutes with MinimalLayout
        },
        {
            path: 'unik/:unikId/access',
            element: <UnikMember />
        },
        {
            path: 'metaverses',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: <MetaverseList />
                },
                // Nested lists inside a specific metaverse - protected by MetaverseGuard
                {
                    path: ':metaverseId/entities',
                    element: (
                        <MetaverseGuard>
                            <EntityList />
                        </MetaverseGuard>
                    )
                },
                {
                    path: ':metaverseId/sections',
                    element: (
                        <MetaverseGuard>
                            <SectionList />
                        </MetaverseGuard>
                    )
                }
            ]
        },
        // Metaverse detail routes - protected by MetaverseGuard
        // MetaverseGuard checks both authentication and resource access
        {
            path: 'metaverse/:metaverseId',
            element: (
                <MetaverseGuard>
                    <Outlet />
                </MetaverseGuard>
            ),
            children: [
                {
                    index: true,
                    element: <MetaverseBoard />
                },
                {
                    path: 'members',
                    element: <MetaverseMembers />
                },
                {
                    path: 'access',
                    element: <MetaverseMembers />
                }
            ]
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
                    path: 'enumeration/:enumerationId/values',
                    element: <EnumerationValueList />
                },
                // Hub-scoped catalog routes
                {
                    path: 'hub/:hubId/catalogs',
                    element: <CatalogList />
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
                }
            ]
        },
        {
            path: 'sections',
            element: <SectionList />
        },
        {
            path: 'entities',
            element: <EntityList />
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
        },
        // Temporary dashboard route for testing
        {
            path: 'dashboard-demo',
            element: <Dashboard />
        }
    ]
}

// Export route configurations
// StartRoute is the exact match for '/' (shows different content based on auth status)
// TermsRoute and PrivacyRoute are public legal pages
// MinimalRoutes handles specific paths like /execution/:id, /unik/:unikId/space/:id
// MainRoutesMUI catches all authenticated routes with main layout
export default [StartRoute, TermsRoute, PrivacyRoute, MinimalRoutes, MainRoutesMUI]
