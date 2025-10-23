import { lazy } from 'react'

// project imports
import { Loadable } from '@flowise/template-mui'
import MinimalLayout from '../layout/MinimalLayout'

// Universo Platformo | New bot routing component
const BotRouter = Loadable(lazy(() => import('@/views/publish/bots')))

// ==============================|| BOT ROUTING ||============================== //

const ChatbotRoutes = {
    path: '/',
    element: <MinimalLayout />,
    children: [
        {
            // Universo Platformo | Universal route for chatbot (backward compatibility)
            path: '/chatbot/:id',
            element: <BotRouter />
        },
        {
            // Universo Platformo | Universal route for bots with explicit type
            path: '/bots/:type/:id',
            element: <BotRouter />
        }
    ]
}

export default ChatbotRoutes
