// English-only comments
import { lazy } from 'react'

const Spaces = lazy(() => import('../views/spaces'))
const Canvas = lazy(() => import('../views/canvas'))

export const spacesRoutes = {
  path: '/unik/:unikId',
  children: [
    { path: 'spaces', element: <Spaces /> },
    { path: 'spaces/new', element: <Canvas /> },
    { path: 'space/:id', element: <Canvas /> },
    { path: 'space/:spaceId/canvas/:canvasId', element: <Canvas /> }
  ]
}

export default spacesRoutes

