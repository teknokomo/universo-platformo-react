import { lazy } from 'react'

// project imports
import MainLayout from '../layout/MainLayout'
import MinimalLayout from '../layout/MinimalLayout'
import Loadable from '../ui-components/loading/Loadable'
// Ensure analytics translations registered early for legacy UI route
import '@universo/analytics-frt/i18n'
import AuthGuard from './AuthGuard'

// Universo Platformo | Universal Public Flow Viewer
const PublicFlowView = Loadable(lazy(() => import('@universo/publish-frt/pages/public/PublicFlowView')))

// Components for authentication
const Auth = Loadable(lazy(() => import('@/views/up-auth/Auth')))

// Profile component from profile-frt package
const Profile = Loadable(lazy(() => import('@universo/profile-frt/pages/Profile')))

const MainRoutes = {
    path: '/',
    element: <MainLayout />,
    children: [
        // Legacy metaverses subtree removed. New routes are provided by MainRoutesMUI from @universo/template-mui.
        {
            path: 'profile',
            element: (
                <AuthGuard>
                    <Profile />
                </AuthGuard>
            )
        },
        {
            path: '*',
            element: <Auth />
        }
    ]
}

// Universo Platformo | Auth routes using MinimalLayout
const AuthRoutes = {
    path: '/auth',
    element: <MinimalLayout />,
    children: [
        {
            index: true,
            element: <Auth />
        }
    ]
}

// Universo Platformo | Universal Public Flow Routes (slug-based)
const PublicFlowRoutes = {
    path: '/',
    element: <MinimalLayout />,
    children: [
        {
            path: 'p/:slug',
            element: <PublicFlowView />
        },
        {
            path: 'b/:slug',
            element: <PublicFlowView />
        }
    ]
}

export { AuthRoutes, PublicFlowRoutes }
export default MainRoutes
