import { useRoutes } from 'react-router-dom'

// routes
import MainRoutes, { AuthRoutes, ARPublicRoutes } from './MainRoutes'
import CanvasRoutes from './CanvasRoutes'
import ChatbotRoutes from './ChatbotRoutes'
import config from '@/config'

// ==============================|| ROUTING RENDER ||============================== //

export default function ThemeRoutes() {
    return useRoutes([AuthRoutes, MainRoutes, CanvasRoutes, ChatbotRoutes, ARPublicRoutes], config.basename)
}
