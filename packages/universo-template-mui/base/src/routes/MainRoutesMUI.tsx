import { lazy } from 'react'
import { Outlet } from 'react-router-dom'

// CRITICAL: Import i18n registrations BEFORE lazy components
// Ensures namespaces are registered before route components try to use translations
import '@universo/uniks-frontend/i18n'
import '@universo/metaverses-frontend/i18n'
import '@universo/clusters-frontend/i18n'
import '@universo/projects-frontend/i18n'
import '@universo/campaigns-frontend/i18n'
import '@universo/organizations-frontend/i18n'
import '@universo/storages-frontend/i18n'
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

import MainLayoutMUI from '../layout/MainLayoutMUI'
import MinimalLayout from '../layout/MinimalLayout'
import StartLayoutMUI from '../layout/StartLayoutMUI'
import Dashboard from '../views/dashboard/Dashboard'
import { ErrorBoundary } from '../components'

// Use local routing components (migrated from @flowise/template-mui)
import { AuthGuard, AdminGuard, Loadable } from '../components/routing'

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

// Metahub module components
const MetahubList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubList }))))
const MetahubBoard = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubBoard }))))
const PublicationList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.PublicationList }))))
const BranchList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.BranchList }))))
const HubList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.HubList }))))
const CatalogList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.CatalogList }))))
const AttributeList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.AttributeList }))))
const ElementList = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.ElementList }))))
const MetahubLayouts = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubLayouts }))))
const MetahubLayoutDetails = Loadable(
    lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubLayoutDetails })))
)
const MetahubMembers = Loadable(lazy(() => import('@universo/metahubs-frontend').then((m) => ({ default: m.MetahubMembers }))))

// Removed: SectionDetail, EntityDetail (old implementations deleted during cleanup)
// Removed: ClusterList from @universo/resources-frontend (package deleted)
// Removed: AllCatalogsList, CatalogDetailPage (consolidated into CatalogList with isHubScoped pattern)

// Cluster module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ClusterList = Loadable(lazy(() => import('@universo/clusters-frontend/pages/ClusterList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ClusterBoard = Loadable(lazy(() => import('@universo/clusters-frontend/pages/ClusterBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const DomainList = Loadable(lazy(() => import('@universo/clusters-frontend/pages/DomainList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ResourceList = Loadable(lazy(() => import('@universo/clusters-frontend/pages/ResourceList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ClusterMembers = Loadable(lazy(() => import('@universo/clusters-frontend/pages/ClusterMembers')))

// Project module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ProjectList = Loadable(lazy(() => import('@universo/projects-frontend/pages/ProjectList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ProjectBoard = Loadable(lazy(() => import('@universo/projects-frontend/pages/ProjectBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const MilestoneList = Loadable(lazy(() => import('@universo/projects-frontend/pages/MilestoneList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const TaskList = Loadable(lazy(() => import('@universo/projects-frontend/pages/TaskList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ProjectMembers = Loadable(lazy(() => import('@universo/projects-frontend/pages/ProjectMembers')))

// Campaign module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const CampaignList = Loadable(lazy(() => import('@universo/campaigns-frontend/pages/CampaignList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const CampaignBoard = Loadable(lazy(() => import('@universo/campaigns-frontend/pages/CampaignBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const EventList = Loadable(lazy(() => import('@universo/campaigns-frontend/pages/EventList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ActivityList = Loadable(lazy(() => import('@universo/campaigns-frontend/pages/ActivityList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const CampaignMembers = Loadable(lazy(() => import('@universo/campaigns-frontend/pages/CampaignMembers')))

// Organization module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const OrganizationList = Loadable(lazy(() => import('@universo/organizations-frontend/pages/OrganizationList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const OrganizationBoard = Loadable(lazy(() => import('@universo/organizations-frontend/pages/OrganizationBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const DepartmentList = Loadable(lazy(() => import('@universo/organizations-frontend/pages/DepartmentList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const PositionList = Loadable(lazy(() => import('@universo/organizations-frontend/pages/PositionList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const OrganizationMembers = Loadable(lazy(() => import('@universo/organizations-frontend/pages/OrganizationMembers')))

// Storage module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const StorageList = Loadable(lazy(() => import('@universo/storages-frontend/pages/StorageList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const StorageBoard = Loadable(lazy(() => import('@universo/storages-frontend/pages/StorageBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ContainerList = Loadable(lazy(() => import('@universo/storages-frontend/pages/ContainerList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const SlotList = Loadable(lazy(() => import('@universo/storages-frontend/pages/SlotList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const StorageMembers = Loadable(lazy(() => import('@universo/storages-frontend/pages/StorageMembers')))

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
        {
            path: 'a/:applicationId/*',
            element: (
                <AuthGuard>
                    <ApplicationsApplicationRuntime />
                </AuthGuard>
            )
        }
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
            element: <Outlet />,
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
                // Hub-scoped catalog routes
                {
                    path: 'hub/:hubId/catalogs',
                    element: <CatalogList />
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
            path: 'clusters',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: <ClusterList />
                },
                // Nested lists inside a specific cluster
                {
                    path: ':clusterId/resources',
                    element: <ResourceList />
                },
                {
                    path: ':clusterId/domains',
                    element: <DomainList />
                }
            ]
        },
        {
            path: 'cluster/:clusterId',
            element: <ClusterBoard />
        },
        {
            path: 'cluster/:clusterId/members',
            element: <ClusterMembers />
        },
        {
            path: 'cluster/:clusterId/access',
            element: <ClusterMembers />
        },
        {
            path: 'projects',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: <ProjectList />
                },
                // Nested lists inside a specific project
                {
                    path: ':projectId/milestones',
                    element: <MilestoneList />
                },
                {
                    path: ':projectId/tasks',
                    element: <TaskList />
                }
            ]
        },
        {
            path: 'project/:projectId',
            element: <ProjectBoard />
        },
        {
            path: 'project/:projectId/members',
            element: <ProjectMembers />
        },
        {
            path: 'project/:projectId/access',
            element: <ProjectMembers />
        },
        {
            path: 'milestones',
            element: <MilestoneList />
        },
        {
            path: 'tasks',
            element: <TaskList />
        },
        {
            path: 'campaigns',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: <CampaignList />
                },
                // Nested lists inside a specific campaign
                {
                    path: ':campaignId/events',
                    element: <EventList />
                },
                {
                    path: ':campaignId/activities',
                    element: <ActivityList />
                }
            ]
        },
        {
            path: 'campaign/:campaignId',
            element: <CampaignBoard />
        },
        {
            path: 'campaign/:campaignId/members',
            element: <CampaignMembers />
        },
        {
            path: 'campaign/:campaignId/access',
            element: <CampaignMembers />
        },
        {
            path: 'events',
            element: <EventList />
        },
        {
            path: 'activities',
            element: <ActivityList />
        },
        {
            path: 'organizations',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: <OrganizationList />
                },
                // Nested lists inside a specific organization
                {
                    path: ':organizationId/departments',
                    element: <DepartmentList />
                },
                {
                    path: ':organizationId/positions',
                    element: <PositionList />
                }
            ]
        },
        {
            path: 'organization/:organizationId',
            element: <OrganizationBoard />
        },
        {
            path: 'organization/:organizationId/members',
            element: <OrganizationMembers />
        },
        {
            path: 'organization/:organizationId/access',
            element: <OrganizationMembers />
        },
        {
            path: 'departments',
            element: <DepartmentList />
        },
        {
            path: 'positions',
            element: <PositionList />
        },
        {
            path: 'storages',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: <StorageList />
                },
                // Nested lists inside a specific storage
                {
                    path: ':storageId/containers',
                    element: <ContainerList />
                },
                {
                    path: ':storageId/slots',
                    element: <SlotList />
                }
            ]
        },
        {
            path: 'storage/:storageId/board',
            element: <StorageBoard />
        },
        {
            path: 'storage/:storageId/members',
            element: <StorageMembers />
        },
        {
            path: 'resources',
            element: <DomainList />
        },
        {
            path: 'resources',
            element: <ResourceList />
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
