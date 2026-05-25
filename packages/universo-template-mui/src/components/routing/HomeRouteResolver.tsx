import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@universo/auth-frontend'
import { useHasGlobalAccess } from '@universo/store'

import { Loader } from '../feedback/loading'
import { resolveShellAccess } from '../../navigation/roleAccess'

interface HomeRouteResolverProps {
    guestElement: ReactNode
    workspaceElement: ReactNode
    adminRedirectTo?: string
    startRedirectTo?: string
}

export default function HomeRouteResolver({
    guestElement,
    workspaceElement,
    adminRedirectTo = '/admin',
    startRedirectTo = '/start'
}: HomeRouteResolverProps) {
    const { isAuthenticated, loading: authLoading } = useAuth()
    const {
        isSuperuser,
        canAccessAdminPanel,
        globalRoles,
        loading: accessLoading,
        ability
    } = useHasGlobalAccess() as ReturnType<typeof useHasGlobalAccess> & {
        ability?: { can(action: string, subject: string): boolean } | null
    }

    if (authLoading || (isAuthenticated && accessLoading)) {
        return <Loader />
    }

    if (!isAuthenticated) {
        return <>{guestElement}</>
    }

    const { hasWorkspaceAccess } = resolveShellAccess({
        globalRoles,
        isSuperuser,
        ability
    })

    if (hasWorkspaceAccess) {
        return <>{workspaceElement}</>
    }

    return <Navigate to={canAccessAdminPanel ? adminRedirectTo : startRedirectTo} replace />
}
