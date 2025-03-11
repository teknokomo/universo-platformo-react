import { lazy } from 'react'
import Loadable from '@/ui-component/loading/Loadable'
import MainLayout from '@/layout/MainLayout'

// Основные компоненты Flowise
const Chatflows = Loadable(lazy(() => import('@/views/chatflows')))
const Agentflows = Loadable(lazy(() => import('@/views/agentflows')))
const Marketplaces = Loadable(lazy(() => import('@/views/marketplaces')))
const APIKey = Loadable(lazy(() => import('@/views/apikey')))
const Tools = Loadable(lazy(() => import('@/views/tools')))
const Assistants = Loadable(lazy(() => import('@/views/assistants')))
const OpenAIAssistantLayout = Loadable(lazy(() => import('@/views/assistants/openai/OpenAIAssistantLayout')))
const CustomAssistantLayout = Loadable(lazy(() => import('@/views/assistants/custom/CustomAssistantLayout')))
const CustomAssistantConfigurePreview = Loadable(lazy(() => import('@/views/assistants/custom/CustomAssistantConfigurePreview')))
const Credentials = Loadable(lazy(() => import('@/views/credentials')))
const Variables = Loadable(lazy(() => import('@/views/variables')))
const Documents = Loadable(lazy(() => import('@/views/docstore')))
const DocumentStoreDetail = Loadable(lazy(() => import('@/views/docstore/DocumentStoreDetail')))
const ShowStoredChunks = Loadable(lazy(() => import('@/views/docstore/ShowStoredChunks')))
const LoaderConfigPreviewChunks = Loadable(lazy(() => import('@/views/docstore/LoaderConfigPreviewChunks')))
const VectorStoreConfigure = Loadable(lazy(() => import('@/views/docstore/VectorStoreConfigure')))
const VectorStoreQuery = Loadable(lazy(() => import('@/views/docstore/VectorStoreQuery')))

// Новые компоненты для многопользовательского режима
const Auth = Loadable(lazy(() => import('@/views/up-auth/Auth')))
const UnikList = Loadable(lazy(() => import('@/views/up-uniks/UnikList')))
const UnikDetailWrapper = Loadable(lazy(() => import('@/views/up-uniks/UnikDetailWrapper')))
const CommonPage = Loadable(lazy(() => import('@/views/up-uniks/CommonPage')))
const AdminPanel = Loadable(lazy(() => import('@/views/up-admin/AdminPanel')))

const MainRoutes = {
    path: '/',
    element: <MainLayout />,
    children: [
        // Индексный маршрут: когда пользователь заходит на "/" - показываем UnikList
        {
            index: true,
            element: <UnikList />
        },
        // Остальные маршруты Flowise
        {
            path: '/chatflows',
            element: <Chatflows />
        },
        {
            path: '/agentflows',
            element: <Agentflows />
        },
        {
            path: '/apikey',
            element: <APIKey />
        },
        {
            path: '/tools',
            element: <Tools />
        },
        {
            path: '/assistants',
            element: <Assistants />
        },
        {
            path: '/assistants/custom',
            element: <CustomAssistantLayout />
        },
        {
            path: '/assistants/custom/:id',
            element: <CustomAssistantConfigurePreview />
        },
        {
            path: '/assistants/openai',
            element: <OpenAIAssistantLayout />
        },
        {
            path: '/credentials',
            element: <Credentials />
        },
        {
            path: '/variables',
            element: <Variables />
        },
        {
            path: '/document-stores',
            element: <Documents />
        },
        {
            path: '/document-stores/:storeId',
            element: <DocumentStoreDetail />
        },
        {
            path: '/document-stores/chunks/:storeId/:fileId',
            element: <ShowStoredChunks />
        },
        {
            path: '/document-stores/:storeId/:name',
            element: <LoaderConfigPreviewChunks />
        },
        {
            path: '/document-stores/vector/:storeId',
            element: <VectorStoreConfigure />
        },
        {
            path: '/document-stores/vector/:storeId/:docId',
            element: <VectorStoreConfigure />
        },
        {
            path: '/document-stores/query/:storeId',
            element: <VectorStoreQuery />
        },

        // Новые маршруты для мультипользовательского функционала
        {
            path: '/auth',
            element: <Auth />
        },
        {
            path: '/uniks',
            children: [
                {
                    index: true,
                    element: <UnikList /> // Список рабочих пространств по маршруту /uniks
                },
                {
                    path: ':unikId',
                    element: <UnikDetailWrapper /> // Детальная страница для конкретного рабочего пространства
                }
            ]
        },
        {
            path: '/common',
            element: <CommonPage />
        },
        {
            path: '/marketplace',
            element: <Marketplaces />
        },
        {
            path: '/admin',
            element: <AdminPanel />
        },
        // Перенаправление всех неопределённых маршрутов на страницу авторизации
        {
            path: '*',
            element: <Auth />
        }
    ]
}

export default MainRoutes
