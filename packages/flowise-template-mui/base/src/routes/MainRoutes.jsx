import { lazy } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

// project imports
import MainLayout from '../layout/MainLayout'
import MinimalLayout from '../layout/MinimalLayout'
import Loadable from '../ui-components/loading/Loadable'
import AuthGuard from './AuthGuard'

// Universo Platformo | Universal Public Flow Viewer
const PublicFlowView = Loadable(lazy(() => import('@universo/publish-frt/pages/public/PublicFlowView')))

// Components for authentication / lists
const Auth = Loadable(lazy(() => import('@/views/up-auth/Auth')))
const UnikList = Loadable(lazy(() => import('@universo/uniks-frt/pages/UnikList')))
// Legacy pages removed from metaverses-frt (old implementations, will be recreated with new architecture) - 2025-01-18:
// - MetaverseDetail, SectionDetail, EntityDetail
// Legacy resources-frt package removed (obsolete) - 2025-01-18:
// - ClusterDetail, DomainDetail, ResourceDetail

// Workspace dashboard component
const UnikDetail = Loadable(lazy(() => import('@universo/uniks-frt/pages/UnikDetail')))

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

const UniksContainer = () => <Outlet />
const MetaversesContainer = () => <Outlet />

const MainRoutes = {
    path: '/',
    element: <MainLayout />,
    children: [
        {
            path: 'unik',
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
                    path: ':unikId',
                    element: (
                        <AuthGuard>
                            <UniksContainer />
                        </AuthGuard>
                    ),
                    children: [
                        {
                            index: true,
                            element: <UnikDetail />
                        },
                        {
                            path: 'canvases',
                            element: <Canvases />
                        },
                        {
                            path: 'spaces',
                            element: <Spaces />
                        },
                        {
                            path: 'agentflows',
                            element: <Agentflows />
                        },
                        {
                            path: 'apikey',
                            element: <APIKey />
                        },
                        {
                            path: 'tools',
                            element: <Tools />
                        },
                        {
                            path: 'assistants',
                            element: <Assistants />
                        },
                        {
                            path: 'assistants/openai',
                            element: <OpenAIAssistantLayout />
                        },
                        {
                            path: 'assistants/custom',
                            element: <CustomAssistantLayout />
                        },
                        {
                            path: 'assistants/custom/:id',
                            element: <CustomAssistantConfigurePreview />
                        },
                        {
                            path: 'assistants/custom/preview',
                            element: <CustomAssistantConfigurePreview />
                        },
                        {
                            path: 'credentials',
                            element: <Credentials />
                        },
                        {
                            path: 'variables',
                            element: <Variables />
                        },
                        {
                            path: 'document-stores',
                            element: <Documents />
                        },
                        {
                            path: 'document-stores/:storeId',
                            element: <DocumentStoreDetail />
                        },
                        {
                            path: 'document-stores/chunks/:storeId/:fileId',
                            element: <ShowStoredChunks />
                        },
                        {
                            path: 'document-stores/:storeId/:name',
                            element: <LoaderConfigPreviewChunks />
                        },
                        {
                            path: 'document-stores/vector/:storeId',
                            element: <VectorStoreConfigure />
                        },
                        {
                            path: 'document-stores/vector/:storeId/:docId',
                            element: <VectorStoreConfigure />
                        },
                        {
                            path: 'document-stores/query/:storeId',
                            element: <VectorStoreQuery />
                        },
                        {
                            path: 'analytics',
                            element: <Analytics />
                        },
                        {
                            path: 'templates',
                            element: <Marketplaces />
                        }
                    ]
                }
            ]
        },
        // Legacy metaverses subtree removed. New routes are provided by MainRoutesMUI from @universo/template-mui.
        {
            path: 'clusters/:clusterId/*',
            element: <Navigate to='/' replace />
        },

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
