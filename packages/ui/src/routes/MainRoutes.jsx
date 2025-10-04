import { lazy } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

// project imports
import MainLayout from '@/layout/MainLayout'
import MinimalLayout from '@/layout/MinimalLayout'
import Loadable from '@/ui-component/loading/Loadable'
import AuthGuard from './AuthGuard'

// Universo Platformo | Universal Public Flow Viewer
const PublicFlowView = Loadable(lazy(() => import('@apps/publish-frt/base/src/pages/public/PublicFlowView.tsx')))

// Components for authentication / lists
const Auth = Loadable(lazy(() => import('@/views/up-auth/Auth')))
const UnikList = Loadable(lazy(() => import('@apps/uniks-frt/base/src/pages/UnikList.jsx')))
const MetaverseDetail = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.MetaverseDetail }))))
const SectionDetail = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.SectionDetail }))))
const ClusterDetail = Loadable(lazy(() => import('@universo/resources-frt').then((m) => ({ default: m.ClusterDetail }))))
const DomainDetail = Loadable(lazy(() => import('@universo/resources-frt').then((m) => ({ default: m.DomainDetail }))))
const ResourceDetail = Loadable(lazy(() => import('@universo/resources-frt').then((m) => ({ default: m.ResourceDetail }))))
const EntityDetail = Loadable(lazy(() => import('@universo/metaverses-frt').then((m) => ({ default: m.EntityDetail }))))

// Workspace dashboard component
const UnikDetail = Loadable(lazy(() => import('@apps/uniks-frt/base/src/pages/UnikDetail.jsx')))

// canvases routing (Flowise list view)
const Canvases = Loadable(lazy(() => import('@/views/canvases')))

// spaces routing (load from spaces-frt package)
const Spaces = Loadable(lazy(() => import('@apps/spaces-frt/base/src/views/spaces')))

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
const Analytics = Loadable(lazy(() => import('@apps/analytics-frt/base/src/pages/Analytics.jsx')))
const Profile = Loadable(lazy(() => import('@apps/profile-frt/base/src/pages/Profile.jsx')))

const AdminPanel = Loadable(lazy(() => import('@/views/up-admin/AdminPanel')))

const AccountList = Loadable(lazy(() => import('@apps/finance-frt/base/src/pages/AccountList.jsx')))
const CurrencyList = Loadable(lazy(() => import('@apps/finance-frt/base/src/pages/CurrencyList.jsx')))

const UniksContainer = () => <Outlet />
const ClustersContainer = () => <Outlet />
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
                        },
                        {
                            path: 'finance/accounts',
                            element: <AccountList />
                        },
                        {
                            path: 'finance/currencies',
                            element: <CurrencyList />
                        }
                    ]
                }
            ]
        },
        {
            path: 'metaverses',
            children: [
                {
                    path: ':metaverseId',
                    element: (
                        <AuthGuard>
                            <MetaversesContainer />
                        </AuthGuard>
                    ),
                    children: [
                        {
                            index: true,
                            element: <MetaverseDetail />
                        },
                        {
                            path: 'entities',
                            element: <MetaverseDetail />
                        },
                        {
                            path: 'sections',
                            element: <MetaverseDetail />
                        },
                        {
                            path: 'sections/:sectionId',
                            element: <SectionDetail />
                        },
                        {
                            path: 'entities/:entityId',
                            element: <EntityDetail />
                        }
                    ]
                }
            ]
        },
        {
            path: 'clusters/:clusterId',
            element: (
                <AuthGuard>
                    <ClustersContainer />
                </AuthGuard>
            ),
            children: [
                {
                    index: true,
                    element: <ClusterDetail />
                },
                {
                    path: 'resources',
                    element: <ClusterDetail />
                },
                {
                    path: 'domains',
                    element: <ClusterDetail />
                },
                {
                    path: 'domains/:domainId',
                    element: <DomainDetail />
                },
                {
                    path: 'resources/:resourceId',
                    element: <ResourceDetail />
                }
            ]
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

// Universo Platformo | Universal Public Flow Routes
const PublicFlowRoutes = {
    path: '/p',
    element: <MinimalLayout />,
    children: [
        {
            path: ':flowId',
            element: <PublicFlowView />
        }
    ]
}

// Universo Platformo | Canvas Public Routes (New Structure)
const PublicCanvasRoutes = {
    path: '/published',
    element: <MinimalLayout />,
    children: [
        {
            path: 'canvas/:canvasId',
            element: <PublicFlowView />
        }
    ]
}

export { AuthRoutes, PublicFlowRoutes, PublicCanvasRoutes }
export default MainRoutes
