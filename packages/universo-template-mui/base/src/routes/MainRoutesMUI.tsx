import { lazy } from 'react'
import { Outlet } from 'react-router-dom'

// CRITICAL: Import i18n registrations BEFORE lazy components
// Ensures namespaces are registered before route components try to use translations
import '@universo/uniks-frt/i18n'
import '@universo/metaverses-frt/i18n'

import MainLayoutMUI from '../layout/MainLayoutMUI'
import Dashboard from '../views/dashboard/Dashboard'
import { ErrorBoundary } from '../components'

import { AuthGuard, Loadable } from '@flowise/template-mui'

// Use subpath export that provides default component
const UnikList = Loadable(lazy(() => import('@universo/uniks-frt/pages/UnikList')))

const MetaverseList = Loadable(lazy(() => import('@universo/metaverses-frt/pages/MetaverseList')))
const MetaverseBoard = Loadable(lazy(() => import('@universo/metaverses-frt/pages/MetaverseBoard')))
// Removed: SectionDetail, EntityDetail (old implementations deleted during cleanup)
// Removed: ClusterList from @universo/resources-frt (package deleted)
const ProfilePage = Loadable(lazy(() => import('@universo/profile-frt/pages/Profile.jsx')))

// Main routes configuration object
// Using ErrorBoundary at layout level to ensure proper Router context
// IMPORTANT: Use RELATIVE paths for children (without leading slash)
// React Router v6 correctly concatenates parent '/' + child 'metaverses' = '/metaverses'
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
                }
            ]
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

export default MainRoutesMUI
