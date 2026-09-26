import { lazy } from 'react'
import { useRoutes } from 'react-router-dom'

import { Loadable, MinimalLayout } from '@universo-react/template-mui'
import { APPLICATION_HOST_ROUTE_PATHS } from '@universo-react/types'
import MainRoutes from './MainRoutes'

const Auth = Loadable(lazy(() => import('./Auth')))

const AuthRoutes = {
    path: APPLICATION_HOST_ROUTE_PATHS.auth,
    element: <MinimalLayout />,
    children: [
        {
            index: true,
            element: <Auth />
        }
    ]
}

export default function ThemeRoutes() {
    const routeTree = [AuthRoutes, ...MainRoutes]
    const sanitizedRoutes = routeTree.filter(Boolean)
    return useRoutes(sanitizedRoutes)
}
