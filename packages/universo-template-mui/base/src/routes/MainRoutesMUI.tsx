import { lazy } from 'react'
import { Outlet } from 'react-router-dom'

// CRITICAL: Import i18n registrations BEFORE lazy components
// Ensures namespaces are registered before route components try to use translations
import '@universo/uniks-frt/i18n'
import '@universo/metaverses-frt/i18n'
import '@universo/clusters-frt/i18n'
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
                {
                    path: ':metaverseId',
                    element: (
                        <AuthGuard>
                            <MetaverseBoard />
                        </AuthGuard>
                    )
                },
                {
                    path: ':metaverseId/members',
                    element: (
                        <AuthGuard>
                            <MetaverseMembers />
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
                },
                {
                    path: ':metaverseId/access',
                    element: (
                        <AuthGuard>
                            <MetaverseMembers />
                        </AuthGuard>
                    )
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
                {
                    path: ':clusterId',
                    element: (
                        <AuthGuard>
                            <ClusterBoard />
                        </AuthGuard>
                    )
                },
                {
                    path: ':clusterId/members',
                    element: (
                        <AuthGuard>
                            <ClusterMembers />
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
                },
                {
                    path: ':clusterId/access',
                    element: (
                        <AuthGuard>
                            <ClusterMembers />
                        </AuthGuard>
                    )
                }
            ]
        },
        {
            path: 'domains',
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
