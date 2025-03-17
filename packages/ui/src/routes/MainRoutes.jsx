import { lazy } from 'react'
import { Outlet } from 'react-router-dom'

// project imports
import MainLayout from '@/layout/MainLayout'
import Loadable from '@/ui-component/loading/Loadable'

// Компоненты для аутентификации / списков
const Auth = Loadable(lazy(() => import('@/views/up-auth/Auth')))
const UnikList = Loadable(lazy(() => import('@/views/up-uniks/UnikList')))

// Компонент дашборда рабочего пространства
const UnikDetail = Loadable(lazy(() => import('@/views/up-uniks/UnikDetail')))

// chatflows routing
const Chatflows = Loadable(lazy(() => import('@/views/chatflows')))

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

// Пример для других общих страниц
const CommonPage = Loadable(lazy(() => import('@/views/up-uniks/CommonPage')))
const AdminPanel = Loadable(lazy(() => import('@/views/up-admin/AdminPanel')))

const UniksContainer = () => <Outlet />

const MainRoutes = {
    path: '/',
    element: <MainLayout />,
    children: [
        {
            index: true,
            element: <UnikList />
        },
        {
            path: '/auth',
            element: <Auth />
        },
        {
            path: '/uniks',
            children: [
                {
                    index: true,
                    element: <UnikList />
                },
                {
                    path: ':unikId',
                    element: <UniksContainer />,
                    children: [
                        {
                            index: true,
                            element: <UnikDetail />
                        },
                        {
                            path: 'chatflows',
                            element: <Chatflows />
                        }
                        // Можно добавить другие вложенные маршруты, например: agentflows, assistants и т.д.
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

export default MainRoutes
