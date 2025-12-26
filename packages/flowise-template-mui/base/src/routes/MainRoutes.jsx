import { lazy } from 'react'

// project imports
import MinimalLayout from '../layout/MinimalLayout'
import Loadable from '../ui-components/loading/Loadable'

// Universo Platformo | Universal Public Flow Viewer
const PublicFlowView = Loadable(lazy(() => import('@universo/publish-frontend/pages/public/PublicFlowView')))

// Components for authentication (from local routes wrapper)
const Auth = Loadable(lazy(() => import('./Auth')))

// DEPRECATED: MainRoutes is no longer used in the route tree
// All routes have been migrated to MainRoutesMUI in @universo/template-mui
// This object is kept only for reference and can be removed in future cleanup
const MainRoutes = null

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
