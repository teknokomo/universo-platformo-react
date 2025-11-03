import { useRoutes } from 'react-router-dom'

// routes
import MainRoutes, { AuthRoutes, PublicFlowRoutes } from './MainRoutes'
import CanvasRoutes from '@universo/spaces-frt/src/entry/CanvasRoutes'
import ChatbotRoutes from './ChatbotRoutes'

// Import new MUI routes to replace main routes
import { MainRoutesMUI } from '@universo/template-mui'

// ==============================|| ROUTING RENDER ||============================== //

export default function ThemeRoutes() {
    const routeTree = [AuthRoutes, MainRoutesMUI, MainRoutes, CanvasRoutes, ChatbotRoutes, PublicFlowRoutes]
    const sanitizedRoutes = routeTree.filter(Boolean)

    return useRoutes(sanitizedRoutes)
}
