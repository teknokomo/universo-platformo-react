import { useRoutes } from 'react-router-dom'

// routes
import MainRoutes, { AuthRoutes, PublicFlowRoutes } from './MainRoutes'
import CanvasRoutes from './CanvasRoutes'
import ChatbotRoutes from './ChatbotRoutes'
import config from '@/config'

// ==============================|| ROUTING RENDER ||============================== //

export default function ThemeRoutes() {
    return useRoutes([AuthRoutes, MainRoutes, CanvasRoutes, ChatbotRoutes, PublicFlowRoutes], config.basename)
}
