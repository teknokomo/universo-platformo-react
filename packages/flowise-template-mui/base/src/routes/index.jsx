import { useRoutes } from 'react-router-dom'

// routes
// Note: MainRoutes removed from routeTree - all routes now in MainRoutesMUI
// AuthRoutes provides /auth path, PublicFlowRoutes provides /p/:slug and /b/:slug
import { AuthRoutes, PublicFlowRoutes } from './MainRoutes'
import CanvasRoutes from '@universo/spaces-frontend/src/entry/CanvasRoutes'
import ChatbotRoutes from './ChatbotRoutes'

// Import new MUI routes to replace main routes
// MainRoutesMUI now exports an array: [StartRoute, MinimalRoutes, MainRoutesMUI]
// StartRoute handles '/' with auth-conditional content
// MinimalRoutes handles Canvas paths without sidebar
import { MainRoutesMUI } from '@universo/template-mui'

// ==============================|| ROUTING RENDER ||============================== //

export default function ThemeRoutes() {
    // Spread MainRoutesMUI array to flatten StartRoute, MinimalRoutes and MainRoutesMUI into routeTree
    // Note: MainRoutes removed - was causing catch-all '*' to redirect all paths to Auth
    const routeTree = [AuthRoutes, ...MainRoutesMUI, CanvasRoutes, ChatbotRoutes, PublicFlowRoutes]
    const sanitizedRoutes = routeTree.filter(Boolean)

    return useRoutes(sanitizedRoutes)
}
