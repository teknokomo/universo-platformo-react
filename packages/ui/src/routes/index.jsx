import { useRoutes } from 'react-router-dom'

// routes
import MainRoutes, { AuthRoutes, PublicFlowRoutes } from './MainRoutes'
import CanvasRoutes from '@apps/spaces-frt/base/src/entry/CanvasRoutes'
import ChatbotRoutes from './ChatbotRoutes'
import config from '@/config'

// Import new MUI routes to replace main routes
import { MainRoutesMUI } from '@universo/template-mui'

// ==============================|| ROUTING RENDER ||============================== //

export default function ThemeRoutes() {
    return useRoutes([AuthRoutes, MainRoutesMUI, MainRoutes, CanvasRoutes, ChatbotRoutes, PublicFlowRoutes], config.basename)
}
