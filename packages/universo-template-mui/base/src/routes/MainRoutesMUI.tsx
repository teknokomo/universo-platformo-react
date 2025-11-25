import { lazy } from 'react'
import { Outlet } from 'react-router-dom'

// CRITICAL: Import i18n registrations BEFORE lazy components
// Ensures namespaces are registered before route components try to use translations
import '@universo/uniks-frt/i18n'
import '@universo/metaverses-frt/i18n'
import '@universo/clusters-frt/i18n'
import '@universo/projects-frt/i18n'
import '@universo/campaigns-frt/i18n'
import '@universo/organizations-frt/i18n'
import '@universo/storages-frt/i18n'
// IMPORTANT: Register analytics translations before lazy loading Analytics component
import '@universo/analytics-frt/i18n'

import MainLayoutMUI from '../layout/MainLayoutMUI'
import MinimalLayout from '../layout/MinimalLayout'
import Dashboard from '../views/dashboard/Dashboard'
import { ErrorBoundary } from '../components'

// Use local routing components (migrated from @flowise/template-mui)
import { AuthGuard, Loadable } from '../components/routing'

// Unik module components
const UnikList = Loadable(lazy(() => import('@universo/uniks-frt/pages/UnikList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const UnikBoard = Loadable(lazy(() => import('@universo/uniks-frt/pages/UnikBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const UnikMember = Loadable(lazy(() => import('@universo/uniks-frt/pages/UnikMember')))

// Legacy components (temporarily loaded in new UI)
const Spaces = Loadable(lazy(() => import('@universo/spaces-frt/src/views/spaces/index.jsx')))
const Canvas = Loadable(lazy(() => import('@universo/spaces-frt/src/views/canvas/index.jsx')))
// @ts-expect-error - Legacy JSX component from old UI
const Tools = Loadable(lazy(() => import('@/views/tools')))
// @ts-expect-error - Legacy JSX component from old UI
const Credentials = Loadable(lazy(() => import('@/views/credentials')))
// @ts-expect-error - Legacy JSX component from old UI
const Variables = Loadable(lazy(() => import('@/views/variables')))
// @ts-expect-error - Legacy JSX component from old UI
const ApiKeys = Loadable(lazy(() => import('@/views/apikey')))
// @ts-expect-error - Legacy JSX component from old UI
const DocumentStores = Loadable(lazy(() => import('@/views/docstore')))
// @ts-expect-error - Legacy JSX component from old UI
const Assistants = Loadable(lazy(() => import('@/views/assistants')))
// @ts-expect-error - Legacy Analytics component - moved to @universo/analytics-frt
const Analytics = Loadable(lazy(() => import('@universo/analytics-frt/pages/Analytics')))

// Metaverse module components
const MetaverseList = Loadable(lazy(() => import('@universo/metaverses-frt/pages/MetaverseList')))
const MetaverseBoard = Loadable(lazy(() => import('@universo/metaverses-frt/pages/MetaverseBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const SectionList = Loadable(lazy(() => import('@universo/metaverses-frt/pages/SectionList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const EntityList = Loadable(lazy(() => import('@universo/metaverses-frt/pages/EntityList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const MetaverseMembers = Loadable(lazy(() => import('@universo/metaverses-frt/pages/MetaverseMembers')))
// Removed: SectionDetail, EntityDetail (old implementations deleted during cleanup)
// Removed: ClusterList from @universo/resources-frt (package deleted)

// Cluster module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ClusterList = Loadable(lazy(() => import('@universo/clusters-frt/pages/ClusterList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ClusterBoard = Loadable(lazy(() => import('@universo/clusters-frt/pages/ClusterBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const DomainList = Loadable(lazy(() => import('@universo/clusters-frt/pages/DomainList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ResourceList = Loadable(lazy(() => import('@universo/clusters-frt/pages/ResourceList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ClusterMembers = Loadable(lazy(() => import('@universo/clusters-frt/pages/ClusterMembers')))

// Project module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ProjectList = Loadable(lazy(() => import('@universo/projects-frt/pages/ProjectList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ProjectBoard = Loadable(lazy(() => import('@universo/projects-frt/pages/ProjectBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const MilestoneList = Loadable(lazy(() => import('@universo/projects-frt/pages/MilestoneList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const TaskList = Loadable(lazy(() => import('@universo/projects-frt/pages/TaskList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ProjectMembers = Loadable(lazy(() => import('@universo/projects-frt/pages/ProjectMembers')))

// Campaign module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const CampaignList = Loadable(lazy(() => import('@universo/campaigns-frt/pages/CampaignList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const CampaignBoard = Loadable(lazy(() => import('@universo/campaigns-frt/pages/CampaignBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const EventList = Loadable(lazy(() => import('@universo/campaigns-frt/pages/EventList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ActivityList = Loadable(lazy(() => import('@universo/campaigns-frt/pages/ActivityList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const CampaignMembers = Loadable(lazy(() => import('@universo/campaigns-frt/pages/CampaignMembers')))

// Organization module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const OrganizationList = Loadable(lazy(() => import('@universo/organizations-frt/pages/OrganizationList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const OrganizationBoard = Loadable(lazy(() => import('@universo/organizations-frt/pages/OrganizationBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const DepartmentList = Loadable(lazy(() => import('@universo/organizations-frt/pages/DepartmentList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const PositionList = Loadable(lazy(() => import('@universo/organizations-frt/pages/PositionList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const OrganizationMembers = Loadable(lazy(() => import('@universo/organizations-frt/pages/OrganizationMembers')))

// Storage module components
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const StorageList = Loadable(lazy(() => import('@universo/storages-frt/pages/StorageList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const StorageBoard = Loadable(lazy(() => import('@universo/storages-frt/pages/StorageBoard')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const ContainerList = Loadable(lazy(() => import('@universo/storages-frt/pages/ContainerList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const SlotList = Loadable(lazy(() => import('@universo/storages-frt/pages/SlotList')))
// @ts-expect-error - Source-only imports resolved at runtime by bundler
const StorageMembers = Loadable(lazy(() => import('@universo/storages-frt/pages/StorageMembers')))

const ProfilePage = Loadable(lazy(() => import('@universo/profile-frt/pages/Profile.jsx')))

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
            element: (
                <AuthGuard>
                    <DocumentStores />
                </AuthGuard>
            )
        },
        {
            path: 'unik/:unikId/assistants',
            element: (
                <AuthGuard>
                    <Assistants />
                </AuthGuard>
            )
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
                // Aliases and nested lists inside a specific metaverse
                {
                    path: ':metaverseId/entities',
                    element: (
                        <AuthGuard>
                            <EntityList />
                        </AuthGuard>
                    )
                },
                {
                    path: ':metaverseId/sections',
                    element: (
                        <AuthGuard>
                            <SectionList />
                        </AuthGuard>
                    )
                }
            ]
        },
        {
            path: 'metaverse/:metaverseId',
            element: (
                <AuthGuard>
                    <MetaverseBoard />
                </AuthGuard>
            )
        },
        {
            path: 'metaverse/:metaverseId/members',
            element: (
                <AuthGuard>
                    <MetaverseMembers />
                </AuthGuard>
            )
        },
        {
            path: 'metaverse/:metaverseId/access',
            element: (
                <AuthGuard>
                    <MetaverseMembers />
                </AuthGuard>
            )
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
