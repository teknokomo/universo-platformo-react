import { lazy } from 'react'

// Load UI framework pieces from @flowise/template-mui
import { Loadable, MinimalLayout } from '@flowise/template-mui'

// Canvas screens (from this package and flowise-ui)
const Canvas = Loadable(lazy(() => import('../views/canvas')))
const MarketplaceCanvas = Loadable(lazy(() => import('@ui/views/marketplaces/MarketplaceCanvas')))

// ==============================|| CANVAS ROUTING (MinimalLayout) ||============================== //

const CanvasRoutes = {
  path: '/unik/:unikId',
  element: <MinimalLayout />,
  children: [
    { path: 'canvas/:canvasId', element: <Canvas /> },
    { path: 'canvases/:canvasId', element: <Canvas /> },

    // spaces canvas editing (not the list - that's in MainRoutes with AuthProvider)
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
