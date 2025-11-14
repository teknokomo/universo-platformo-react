import { lazy } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

// project imports
import MainLayout from '../layout/MainLayout'
import MinimalLayout from '../layout/MinimalLayout'
import Loadable from '../ui-components/loading/Loadable'
// Ensure analytics translations registered early for legacy UI route
import '@universo/analytics-frt/i18n'
import AuthGuard from './AuthGuard'

// Universo Platformo | Universal Public Flow Viewer
const PublicFlowView = Loadable(lazy(() => import('@universo/publish-frt/pages/public/PublicFlowView')))

// Components for authentication / lists
const Auth = Loadable(lazy(() => import('@/views/up-auth/Auth')))

// canvases routing (Flowise list view)
const Canvases = Loadable(lazy(() => import('@/views/canvases')))

// spaces routing (consume package directly)
const Spaces = Loadable(lazy(() => import('@universo/spaces-frt/src/views/spaces/index.jsx')))

// agents routing
const Agentflows = Loadable(lazy(() => import('@/views/agentflows')))

// marketplaces routing
const Marketplaces = Loadable(lazy(() => import('@/views/marketplaces')))

// apikey routing
const APIKey = Loadable(lazy(() => import('@/views/apikey')))

// tools routing
const Tools = Loadable(lazy(() => import('@/views/tools')))

// assistants routing
const Assistants = Loadable(lazy(() => import('@/views/assistants')))
const OpenAIAssistantLayout = Loadable(lazy(() => import('@/views/assistants/openai/OpenAIAssistantLayout')))
const CustomAssistantLayout = Loadable(lazy(() => import('@/views/assistants/custom/CustomAssistantLayout')))
const CustomAssistantConfigurePreview = Loadable(lazy(() => import('@/views/assistants/custom/CustomAssistantConfigurePreview')))

// credentials routing
const Credentials = Loadable(lazy(() => import('@/views/credentials')))

// variables routing
const Variables = Loadable(lazy(() => import('@/views/variables')))

// documents routing
const Documents = Loadable(lazy(() => import('@/views/docstore')))
const DocumentStoreDetail = Loadable(lazy(() => import('@/views/docstore/DocumentStoreDetail')))
const ShowStoredChunks = Loadable(lazy(() => import('@/views/docstore/ShowStoredChunks')))
const LoaderConfigPreviewChunks = Loadable(lazy(() => import('@/views/docstore/LoaderConfigPreviewChunks')))
const VectorStoreConfigure = Loadable(lazy(() => import('@/views/docstore/VectorStoreConfigure')))
const VectorStoreQuery = Loadable(lazy(() => import('@/views/docstore/VectorStoreQuery')))

// analytics routing moved to analytics-frt app
const Analytics = Loadable(lazy(() => import('@universo/analytics-frt/pages/Analytics')))
const Profile = Loadable(lazy(() => import('@universo/profile-frt/pages/Profile')))

const AdminPanel = Loadable(lazy(() => import('@/views/up-admin/AdminPanel')))

// Legacy finance-frt package removed (obsolete) - 2025-01-18:
// - AccountList, CurrencyList

const MainRoutes = {
    path: '/',
    element: <MainLayout />,
    children: [
        // Legacy metaverses subtree removed. New routes are provided by MainRoutesMUI from @universo/template-mui.
        {
            path: 'admin',
            element: <AdminPanel />
        },
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
