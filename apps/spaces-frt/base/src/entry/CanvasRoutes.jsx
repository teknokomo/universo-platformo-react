import { lazy } from 'react'
import { Navigate, useParams } from 'react-router-dom'

// Load UI framework pieces via @ui alias to avoid local alias conflicts
import Loadable from '@ui/ui-component/loading/Loadable'
import MinimalLayout from '@ui/layout/MinimalLayout'

// Canvas screens (Flowise UI)
const Canvas = Loadable(lazy(() => import('@ui/views/canvas')))
const MarketplaceCanvas = Loadable(lazy(() => import('@ui/views/marketplaces/MarketplaceCanvas')))

// Spaces list (from this package)
const Spaces = Loadable(lazy(() => import('@apps/spaces-frt/base/src/views/spaces')))

// ==============================|| CANVAS ROUTING (MinimalLayout) ||============================== //

const LegacyChatflowsRedirect = () => {
  const { unikId } = useParams()
  return <Navigate to={`/unik/${unikId}/spaces`} replace />
}

const LegacyChatflowDetailRedirect = () => {
  const { unikId, id } = useParams()
  return <Navigate to={`/unik/${unikId}/canvas/${id}`} replace />
}

const CanvasRoutes = {
  path: '/unik/:unikId',
  element: <MinimalLayout />,
  children: [
    // legacy redirects
    { path: 'chatflows', element: <LegacyChatflowsRedirect /> },
    { path: 'chatflows/:id', element: <LegacyChatflowDetailRedirect /> },
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

