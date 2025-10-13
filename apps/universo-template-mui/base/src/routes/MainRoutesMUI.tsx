import { lazy } from 'react'
import MainLayoutMUI from '../layout/MainLayoutMUI'
import Dashboard from '../views/dashboard/Dashboard'
import { ErrorBoundary } from '../components'

// Import AuthGuard from main UI package
// @ts-ignore - JS file imported in TS
import AuthGuard from '@ui/routes/AuthGuard'

// Import Loadable utility from main UI package
// @ts-ignore - JS file imported in TS
import Loadable from '@ui/ui-component/loading/Loadable'

// Use existing list components from monorepo apps
// @ts-ignore - JS file imported in TS
const UnikList = Loadable(lazy(() => import('@apps/uniks-frt/base/src/pages/UnikList')))

// @ts-ignore
const MetaverseList = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.MetaverseList }))))
// @ts-ignore
const MetaverseBoard = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.MetaverseBoard }))))
// @ts-ignore
const MetaverseAccess = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.MetaverseAccess }))))
// @ts-ignore
const SectionsList = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.SectionsList }))))
// @ts-ignore
const SectionDetail = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.SectionDetail }))))
// @ts-ignore
const EntityList = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.EntityList }))))
// @ts-ignore
const EntityDetail = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.EntityDetail }))))
// @ts-ignore
const ClusterList = Loadable(lazy(() => import('@universo/resources-frt').then((m) => ({ default: m.ClusterList }))))
// @ts-ignore
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
