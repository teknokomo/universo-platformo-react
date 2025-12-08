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
// Register document-store translations before lazy loading Document Store component
import '@flowise/docstore-frontend/i18n'
// Register customtemplates translations before lazy loading Templates component
import '@flowise/customtemplates-frontend/i18n'

import MainLayoutMUI from '../layout/MainLayoutMUI'
import MinimalLayout from '../layout/MinimalLayout'
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
const CustomAssistantConfigurePreview = Loadable(lazy(() => import('@flowise/assistants-frontend/pages/custom/CustomAssistantConfigurePreview')))
const OpenAIAssistantLayout = Loadable(lazy(() => import('@flowise/assistants-frontend/pages/openai/OpenAIAssistantLayout')))
// @ts-expect-error - Legacy Analytics component - moved to @universo/analytics-frontend
const Analytics = Loadable(lazy(() => import('@universo/analytics-frontend/pages/Analytics')))
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
// Removed: SectionDetail, EntityDetail (old implementations deleted during cleanup)
// Removed: ClusterList from @universo/resources-frontend (package deleted)

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
const InstanceAccess = Loadable(lazy(() => import('@universo/admin-frontend/pages/InstanceAccess')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const RolesList = Loadable(lazy(() => import('@universo/admin-frontend/pages/RolesList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const RoleEdit = Loadable(lazy(() => import('@universo/admin-frontend/pages/RoleEdit')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const RoleUsers = Loadable(lazy(() => import('@universo/admin-frontend/pages/RoleUsers')))

const ProfilePage = Loadable(lazy(() => import('@universo/profile-frontend/pages/Profile.jsx')))

// Main routes configuration object
// Using ErrorBoundary at layout level to ensure proper Router context
// IMPORTANT: Use RELATIVE paths for children (without leading slash)
// React Router v6 correctly concatenates parent '/' + child 'metaverses' = '/metaverses'

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
        }
    ]
}

// Routes with main layout (sidebar + navigation)
const MainRoutesMUI = {
    path: '/',
    element: (
        <ErrorBoundary>
            <MainLayoutMUI />
        </ErrorBoundary>
    ),
    children: [
        {
            index: true,
            element: (
                <AuthGuard>
                    <UnikList />
                </AuthGuard>
            )
        },
        {
            path: 'uniks',
            element: (
                <AuthGuard>
                    <UnikList />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId',
            element: (
                <AuthGuard>
                    <UnikBoard />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/spaces',
            element: (
                <AuthGuard>
                    <Spaces />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/tools',
            element: (
                <AuthGuard>
                    <Tools />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/credentials',
            element: (
                <AuthGuard>
                    <Credentials />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/variables',
            element: (
                <AuthGuard>
                    <Variables />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/apikey',
            element: (
                <AuthGuard>
                    <ApiKeys />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/document-stores',
            element: <Outlet />,
            children: [
                {
                    index: true,
                    element: (
                        <AuthGuard>
                            <DocumentStores />
                        </AuthGuard>
                    )
                },
                {
                    path: ':storeId',
                    element: (
                        <AuthGuard>
                            <DocumentStoreDetail />
                        </AuthGuard>
                    )
                },
                {
                    path: ':storeId/:name',
                    element: (
                        <AuthGuard>
                            <LoaderConfigPreviewChunks />
                        </AuthGuard>
                    )
                },
                {
                    path: 'chunks/:storeId/:fileId',
                    element: (
                        <AuthGuard>
                            <ShowStoredChunks />
                        </AuthGuard>
                    )
                },
                {
                    path: 'vector/:storeId/:docId',
                    element: (
                        <AuthGuard>
                            <VectorStoreConfigure />
                        </AuthGuard>
                    )
                },
                {
                    path: 'query/:storeId',
                    element: (
                        <AuthGuard>
                            <VectorStoreQuery />
                        </AuthGuard>
                    )
                }
            ]
        },
        {
            path: 'unik/:unikId/assistants',
            element: <Outlet />,
            children: [
                {
                    index: true,
                    element: (
                        <AuthGuard>
                            <Assistants />
                        </AuthGuard>
                    )
                },
                {
                    path: 'custom',
                    element: (
                        <AuthGuard>
                            <CustomAssistantLayout />
                        </AuthGuard>
                    )
                },
                {
                    path: 'custom/:id',
                    element: (
                        <AuthGuard>
                            <CustomAssistantConfigurePreview />
                        </AuthGuard>
                    )
                },
                {
                    path: 'openai',
                    element: (
                        <AuthGuard>
                            <OpenAIAssistantLayout />
                        </AuthGuard>
                    )
                }
            ]
        },
        {
            path: 'unik/:unikId/analytics',
            element: (
                <AuthGuard>
                    <Analytics />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/templates',
            element: (
                <AuthGuard>
                    <Templates />
                </AuthGuard>
            )
            // Note: Template detail view (templates/:id) is in CanvasRoutes with MinimalLayout
        },
        {
            path: 'unik/:unikId/access',
            element: (
                <AuthGuard>
                    <UnikMember />
                </AuthGuard>
            )
        },
        {
            path: 'metaverses',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: (
                        <AuthGuard>
                            <MetaverseList />
                        </AuthGuard>
                    )
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
        {
            path: 'sections',
            element: (
                <AuthGuard>
                    <SectionList />
                </AuthGuard>
            )
        },
        {
            path: 'entities',
            element: (
                <AuthGuard>
                    <EntityList />
                </AuthGuard>
            )
        },
        {
            path: 'clusters',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: (
                        <AuthGuard>
                            <ClusterList />
                        </AuthGuard>
                    )
                },
                // Nested lists inside a specific cluster
                {
                    path: ':clusterId/resources',
                    element: (
                        <AuthGuard>
                            <ResourceList />
                        </AuthGuard>
                    )
                },
                {
                    path: ':clusterId/domains',
                    element: (
                        <AuthGuard>
                            <DomainList />
                        </AuthGuard>
                    )
                }
            ]
        },
        {
            path: 'cluster/:clusterId',
            element: (
                <AuthGuard>
                    <ClusterBoard />
                </AuthGuard>
            )
        },
        {
            path: 'cluster/:clusterId/members',
            element: (
                <AuthGuard>
                    <ClusterMembers />
                </AuthGuard>
            )
        },
        {
            path: 'cluster/:clusterId/access',
            element: (
                <AuthGuard>
                    <ClusterMembers />
                </AuthGuard>
            )
        },
        {
            path: 'projects',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: (
                        <AuthGuard>
                            <ProjectList />
                        </AuthGuard>
                    )
                },
                // Nested lists inside a specific project
                {
                    path: ':projectId/milestones',
                    element: (
                        <AuthGuard>
                            <MilestoneList />
                        </AuthGuard>
                    )
                },
                {
                    path: ':projectId/tasks',
                    element: (
                        <AuthGuard>
                            <TaskList />
                        </AuthGuard>
                    )
                }
            ]
        },
        {
            path: 'project/:projectId',
            element: (
                <AuthGuard>
                    <ProjectBoard />
                </AuthGuard>
            )
        },
        {
            path: 'project/:projectId/members',
            element: (
                <AuthGuard>
                    <ProjectMembers />
                </AuthGuard>
            )
        },
        {
            path: 'project/:projectId/access',
            element: (
                <AuthGuard>
                    <ProjectMembers />
                </AuthGuard>
            )
        },
        {
            path: 'milestones',
            element: (
                <AuthGuard>
                    <MilestoneList />
                </AuthGuard>
            )
        },
        {
            path: 'tasks',
            element: (
                <AuthGuard>
                    <TaskList />
                </AuthGuard>
            )
        },
        {
            path: 'campaigns',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: (
                        <AuthGuard>
                            <CampaignList />
                        </AuthGuard>
                    )
                },
                // Nested lists inside a specific campaign
                {
                    path: ':campaignId/events',
                    element: (
                        <AuthGuard>
                            <EventList />
                        </AuthGuard>
                    )
                },
                {
                    path: ':campaignId/activities',
                    element: (
                        <AuthGuard>
                            <ActivityList />
                        </AuthGuard>
                    )
                }
            ]
        },
        {
            path: 'campaign/:campaignId',
            element: (
                <AuthGuard>
                    <CampaignBoard />
                </AuthGuard>
            )
        },
        {
            path: 'campaign/:campaignId/members',
            element: (
                <AuthGuard>
                    <CampaignMembers />
                </AuthGuard>
            )
        },
        {
            path: 'campaign/:campaignId/access',
            element: (
                <AuthGuard>
                    <CampaignMembers />
                </AuthGuard>
            )
        },
        {
            path: 'events',
            element: (
                <AuthGuard>
                    <EventList />
                </AuthGuard>
            )
        },
        {
            path: 'activities',
            element: (
                <AuthGuard>
                    <ActivityList />
                </AuthGuard>
            )
        },
        {
            path: 'organizations',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: (
                        <AuthGuard>
                            <OrganizationList />
                        </AuthGuard>
                    )
                },
                // Nested lists inside a specific organization
                {
                    path: ':organizationId/departments',
                    element: (
                        <AuthGuard>
                            <DepartmentList />
                        </AuthGuard>
                    )
                },
                {
                    path: ':organizationId/positions',
                    element: (
                        <AuthGuard>
                            <PositionList />
                        </AuthGuard>
                    )
                }
            ]
        },
        {
            path: 'organization/:organizationId',
            element: (
                <AuthGuard>
                    <OrganizationBoard />
                </AuthGuard>
            )
        },
        {
            path: 'organization/:organizationId/members',
            element: (
                <AuthGuard>
                    <OrganizationMembers />
                </AuthGuard>
            )
        },
        {
            path: 'organization/:organizationId/access',
            element: (
                <AuthGuard>
                    <OrganizationMembers />
                </AuthGuard>
            )
        },
        {
            path: 'departments',
            element: (
                <AuthGuard>
                    <DepartmentList />
                </AuthGuard>
            )
        },
        {
            path: 'positions',
            element: (
                <AuthGuard>
                    <PositionList />
                </AuthGuard>
            )
        },
        {
            path: 'storages',
            element: <Outlet />, // ← CRITICAL: Required for nested routes to render children
            children: [
                {
                    index: true,
                    element: (
                        <AuthGuard>
                            <StorageList />
                        </AuthGuard>
                    )
                },
                // Nested lists inside a specific storage
                {
                    path: ':storageId/containers',
                    element: (
                        <AuthGuard>
                            <ContainerList />
                        </AuthGuard>
                    )
                },
                {
                    path: ':storageId/slots',
                    element: (
                        <AuthGuard>
                            <SlotList />
                        </AuthGuard>
                    )
                }
            ]
        },
        {
            path: 'storage/:storageId/board',
            element: (
                <AuthGuard>
                    <StorageBoard />
                </AuthGuard>
            )
        },
        {
            path: 'storage/:storageId/members',
            element: (
                <AuthGuard>
                    <StorageMembers />
                </AuthGuard>
            )
        },
        {
            path: 'resources',
            element: (
                <AuthGuard>
                    <DomainList />
                </AuthGuard>
            )
        },
        {
            path: 'resources',
            element: (
                <AuthGuard>
                    <ResourceList />
                </AuthGuard>
            )
        },
        {
            path: 'profile',
            element: (
                <AuthGuard>
                    <ProfilePage />
                </AuthGuard>
            )
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
                            path: 'access',
                            element: <InstanceAccess />
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
            element: (
                <AuthGuard>
                    <Dashboard />
                </AuthGuard>
            )
        }
    ]
}

// Export both route configurations
// MinimalRoutes MUST be first in array to match specific Canvas paths before MainRoutesMUI catches all
export default [MinimalRoutes, MainRoutesMUI]
