import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@universo/auth-frontend'

import { Loader } from '../feedback/loading'

export interface StartAccessGuardProps {
    children: React.ReactNode
}

export const StartAccessGuard: React.FC<StartAccessGuardProps> = ({ children }) => {
    const { isAuthenticated, loading: authLoading } = useAuth()

    if (authLoading) {
        return <Loader />
    }

    if (!isAuthenticated) {
        return <Navigate to='/' replace />
    }

    return <>{children}</>
}
