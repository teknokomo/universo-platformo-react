import { useRoutes } from 'react-router-dom'

// routes
import MainRoutes, { AuthRoutes, PublicFlowRoutes } from './MainRoutes'
import CanvasRoutes from '@universo/spaces-frontend/src/entry/CanvasRoutes'
import ChatbotRoutes from './ChatbotRoutes'

// Import new MUI routes to replace main routes
// MainRoutesMUI now exports an array: [MinimalRoutes, MainRoutesMUI]
// MinimalRoutes handles Canvas paths without sidebar (must be first to match specific paths)
import { MainRoutesMUI } from '@universo/template-mui'

// ==============================|| ROUTING RENDER ||============================== //

export default function ThemeRoutes() {
    // Spread MainRoutesMUI array to flatten MinimalRoutes and MainRoutesMUI into routeTree
    const routeTree = [AuthRoutes, ...MainRoutesMUI, MainRoutes, CanvasRoutes, ChatbotRoutes, PublicFlowRoutes]
    const sanitizedRoutes = routeTree.filter(Boolean)

    return useRoutes(sanitizedRoutes)
}
