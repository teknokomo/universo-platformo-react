import { useRoutes } from 'react-router-dom'

// routes
import MainRoutes, { AuthRoutes, PublicFlowRoutes, PublicCanvasRoutes } from './MainRoutes'
import CanvasRoutes from '@apps/spaces-frt/base/src/entry/CanvasRoutes'
import ChatbotRoutes from './ChatbotRoutes'
import config from '@/config'

// ==============================|| ROUTING RENDER ||============================== //

export default function ThemeRoutes() {
    return useRoutes([AuthRoutes, MainRoutes, CanvasRoutes, ChatbotRoutes, PublicFlowRoutes, PublicCanvasRoutes], config.basename)
}
