import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@universo/auth-frontend'
import { useHasGlobalAccess } from '@universo/store'

import { Loader } from '../feedback/loading'
import { resolveShellAccess } from '../../navigation/roleAccess'

export interface RegisteredUserGuardProps {
    children: React.ReactNode
    authRedirectTo?: string
    accessDeniedRedirectTo?: string
}

export const RegisteredUserGuard: React.FC<RegisteredUserGuardProps> = ({
    children,
    authRedirectTo = '/auth',
    accessDeniedRedirectTo = '/start'
}) => {
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
    const location = useLocation()

    if (authLoading || accessLoading) {
        return <Loader />
    }

    if (!isAuthenticated) {
        return <Navigate to={authRedirectTo} state={{ from: location.pathname }} replace />
    }

    const { hasWorkspaceAccess } = resolveShellAccess({
        globalRoles,
        isSuperuser,
        ability
    })

    if (!hasWorkspaceAccess) {
        return <Navigate to={canAccessAdminPanel ? '/admin' : accessDeniedRedirectTo} replace />
    }

    return <>{children}</>
}
