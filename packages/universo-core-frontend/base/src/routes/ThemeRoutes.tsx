import { lazy } from 'react'
import { useRoutes } from 'react-router-dom'

import { Loadable, MinimalLayout } from '@universo/template-mui'
import MainRoutes from './MainRoutes'

const Auth = Loadable(lazy(() => import('./Auth')))

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

export default function ThemeRoutes() {
    const routeTree = [AuthRoutes, ...MainRoutes]
    const sanitizedRoutes = routeTree.filter(Boolean)
    return useRoutes(sanitizedRoutes)
}
