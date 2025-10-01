import { lazy, useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

// Load UI framework pieces via @ui alias to avoid local alias conflicts
import Loadable from '@ui/ui-component/loading/Loadable'
import MinimalLayout from '@ui/layout/MinimalLayout'
import canvasesApi from '@ui/api/canvases'

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
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    const resolveRedirect = async () => {
      if (!unikId || !id) return
      try {
        const response = await canvasesApi.getCanvasById(id)
        const canvas = response?.data || response
        const resolvedSpaceId =
          canvas?.spaceId ??
          canvas?.space_id ??
          canvas?.space?.id ??
          null
        const target = resolvedSpaceId
          ? `/unik/${unikId}/space/${resolvedSpaceId}/canvas/${id}`
          : `/unik/${unikId}/canvas/${id}`
        if (isMounted) navigate(target, { replace: true })
      } catch (error) {
        if (isMounted) navigate(`/unik/${unikId}/canvas/${id}`, { replace: true })
      }
    }

    resolveRedirect()

    return () => {
      isMounted = false
    }
  }, [id, navigate, unikId])

  return null
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

