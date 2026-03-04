import { useRoutes } from 'react-router-dom'

// New MUI routes (StartRoute, MinimalRoutes, MainRoutesMUI)
import { MainRoutesMUI } from './MainRoutesMUI'

// Layout for auth/minimal pages
import MinimalLayout from '../layout/MinimalLayout'

// Auth page
import { lazy } from 'react'
import { Loadable } from '../components'

const Auth = Loadable(lazy(() => import('./Auth')))

// Auth routes using MinimalLayout
const AuthRoutes = {
    path: '/auth',
    element: <MinimalLayout />,
    children: [
        {
            index: true,
            element: <Auth />
        }
    ]
}

/**
 * ThemeRoutes — main routing entry point.
 * Composes AuthRoutes + MainRoutesMUI route arrays.
 */
export default function ThemeRoutes() {
    const routeTree = [AuthRoutes, ...MainRoutesMUI]
    const sanitizedRoutes = routeTree.filter(Boolean)
    return useRoutes(sanitizedRoutes)
}
