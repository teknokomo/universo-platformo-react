import { lazy } from 'react'

// Load UI framework pieces via @ui alias to avoid local alias conflicts
import Loadable from '@ui/ui-component/loading/Loadable'
import MinimalLayout from '@ui/layout/MinimalLayout'

// Canvas screens (Flowise UI)
const Canvas = Loadable(lazy(() => import('@ui/views/canvas')))
const MarketplaceCanvas = Loadable(lazy(() => import('@ui/views/marketplaces/MarketplaceCanvas')))

// Spaces list (from this package)
const Spaces = Loadable(lazy(() => import('@apps/spaces-frt/base/src/views/spaces')))

// ==============================|| CANVAS ROUTING (MinimalLayout) ||============================== //

const CanvasRoutes = {
  path: '/unik/:unikId',
  element: <MinimalLayout />,
  children: [
    { path: 'canvas/:canvasId', element: <Canvas /> },
    { path: 'canvases/:canvasId', element: <Canvas /> },

    // spaces
    { path: 'spaces', element: <Spaces /> },
    { path: 'spaces/new', element: <Canvas /> },
    { path: 'space/:id', element: <Canvas /> },
    { path: 'space/:spaceId/canvas/:canvasId', element: <Canvas /> },

    // agents
    { path: 'agentcanvas', element: <Canvas /> },
    { path: 'agentcanvas/:id', element: <Canvas /> },

    // templates
    { path: 'templates/:id', element: <MarketplaceCanvas /> }
  ]
}

export default CanvasRoutes
