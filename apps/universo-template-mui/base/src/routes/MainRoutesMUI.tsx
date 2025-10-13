import { lazy } from 'react'
import MainLayoutMUI from '../layout/MainLayoutMUI'
import Dashboard from '../views/dashboard/Dashboard'
import { ErrorBoundary } from '../components'

import AuthGuard from '@ui/routes/AuthGuard'

import Loadable from '@ui/ui-component/loading/Loadable'

const UnikList = Loadable(lazy(() => import('@apps/uniks-frt/base/src/pages/UnikList')))

const MetaverseList = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.MetaverseList }))))
const MetaverseBoard = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.MetaverseBoard }))))
const MetaverseAccess = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.MetaverseAccess }))))
const SectionsList = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.SectionsList }))))
const SectionDetail = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.SectionDetail }))))
const EntityList = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.EntityList }))))
const EntityDetail = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.EntityDetail }))))
const ClusterList = Loadable(lazy(() => import('@universo/resources-frt').then((m) => ({ default: m.ClusterList }))))
const ProfilePage = Loadable(lazy(() => import('@apps/profile-frt/base/src/pages/Profile.jsx')))

// Main routes configuration object (matching MainRoutes.jsx structure)
const MainRoutesMUI = {
    path: '/',
    element: <MainLayoutMUI />,
    children: [
        {
            index: true,
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <UnikList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'uniks',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <UnikList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'metaverses',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <MetaverseList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'metaverses/:metaverseId',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <MetaverseBoard />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'metaverses/:metaverseId/access',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <MetaverseAccess />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'metaverses/:metaverseId/entities',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <EntityList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'metaverses/:metaverseId/sections',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <SectionsList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'metaverses/:metaverseId/sections/:sectionId',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <SectionDetail />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'metaverses/:metaverseId/entities/:entityId',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <EntityDetail />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'clusters',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <ClusterList />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        {
            path: 'profile',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <ProfilePage />
                    </ErrorBoundary>
                </AuthGuard>
            )
        },
        // Temporary dashboard route for testing
        {
            path: 'dashboard-demo',
            element: (
                <AuthGuard>
                    <ErrorBoundary>
                        <Dashboard />
                    </ErrorBoundary>
                </AuthGuard>
            )
        }
    ]
}

export default MainRoutesMUI
