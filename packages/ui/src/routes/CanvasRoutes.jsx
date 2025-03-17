import { lazy } from 'react'

// project imports
import Loadable from '@/ui-component/loading/Loadable'
import MinimalLayout from '@/layout/MinimalLayout'

// canvas routing
const Canvas = Loadable(lazy(() => import('@/views/canvas')))
const MarketplaceCanvas = Loadable(lazy(() => import('@/views/marketplaces/MarketplaceCanvas')))

// ==============================|| CANVAS ROUTING ||============================== //

const CanvasRoutes = {
    path: '/uniks/:unikId',
    element: <MinimalLayout />,
    children: [
        {
            path: 'chatflows',
            element: <Canvas />
        },
        {
            path: 'chatflows/new',
            element: <Canvas />
        },
        {
            path: 'chatflows/:id',
            element: <Canvas />
        },
        {
            path: 'agentcanvas',
            element: <Canvas />
        },
        {
            path: 'agentcanvas/:id',
            element: <Canvas />
        },
        {
            path: 'marketplace/:id',
            element: <MarketplaceCanvas />
        }
    ]
}

export default CanvasRoutes
