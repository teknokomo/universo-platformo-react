import { lazy } from 'react'
import { Outlet } from 'react-router-dom'

// project imports
import MainLayout from '@/layout/MainLayout'
import MinimalLayout from '@/layout/MinimalLayout'
import Loadable from '@/ui-component/loading/Loadable'
import AuthGuard from './AuthGuard'

// Universo Platformo | AR.js Viewer
const ARView = Loadable(lazy(() => import('@apps/publish-frt/base/src/pages/public/ARViewPage.tsx')))

// Components for authentication / lists
const Auth = Loadable(lazy(() => import('@/views/up-auth/Auth')))
const UnikList = Loadable(lazy(() => import('@/views/up-uniks/UnikList')))

// Workspace dashboard component
const UnikDetail = Loadable(lazy(() => import('@/views/up-uniks/UnikDetail')))

// chatflows routing
const Chatflows = Loadable(lazy(() => import('@/views/chatflows')))

// agents routing
const Agentflows = Loadable(lazy(() => import('@/views/agentflows')))

// marketplaces routing
const Marketplaces = Loadable(lazy(() => import('@/views/marketplaces')))
const MarketplaceCanvas = Loadable(lazy(() => import('@/views/marketplaces/MarketplaceCanvas')))

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

// Example for other common pages
const CommonPage = Loadable(lazy(() => import('@/views/up-uniks/CommonPage')))
const AdminPanel = Loadable(lazy(() => import('@/views/up-admin/AdminPanel')))

const UniksContainer = () => <Outlet />

const MainRoutes = {
    path: '/',
    element: <MainLayout />,
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
            path: '/uniks',
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
                            path: 'chatflows',
                            element: <Chatflows />
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
                            path: 'templates',
                            element: <Marketplaces />
                        }
                    ]
                }
            ]
        },
        {
            path: '/common',
            element: <CommonPage />
        },
        {
            path: '/admin',
            element: <AdminPanel />
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

// Universo Platformo | AR.js Public Routes
const ARPublicRoutes = {
    path: '/p',
    element: <MinimalLayout />,
    children: [
        {
            path: ':flowId',
            element: <ARView />
        }
    ]
}

export { AuthRoutes, ARPublicRoutes }
export default MainRoutes
