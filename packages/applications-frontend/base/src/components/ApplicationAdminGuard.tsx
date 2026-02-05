import React from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader } from '@universo/template-mui'
import { isAccessDeniedError } from '@universo/template-mui'
import { useAuth } from '@universo/auth-frontend'
import { getApplication } from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'
import type { ApplicationRole } from '../types'

const ALLOWED_ROLES: ApplicationRole[] = ['owner', 'admin', 'editor']

export interface ApplicationAdminGuardProps {
    children: React.ReactNode
}

export const ApplicationAdminGuard: React.FC<ApplicationAdminGuardProps> = ({ children }) => {
    const { isAuthenticated, loading: authLoading } = useAuth()
    const location = useLocation()
    const { applicationId } = useParams<{ applicationId: string }>()

    const applicationQuery = useQuery({
        queryKey: applicationId ? applicationsQueryKeys.detail(applicationId) : ['applications', 'detail', 'missing-id'],
        queryFn: async () => {
            if (!applicationId) throw new Error('Application ID is missing')
            const response = await getApplication(applicationId)
            return response.data
        },
        enabled: isAuthenticated && Boolean(applicationId),
        retry: false,
        staleTime: 60_000,
        refetchOnWindowFocus: false
    })

    if (authLoading) {
        return <Loader />
    }

    if (!isAuthenticated) {
        return <Navigate to='/auth' state={{ from: location.pathname }} replace />
    }

    if (!applicationId) {
        return <Navigate to='/' replace />
    }

    if (applicationQuery.isLoading) {
        return <Loader />
    }

    if (applicationQuery.isError) {
        if (isAccessDeniedError(applicationQuery.error)) {
            return <Navigate to={`/a/${applicationId}`} replace />
        }
        return <Navigate to='/' replace />
    }

    const role = applicationQuery.data?.role
    if (!role || !ALLOWED_ROLES.includes(role)) {
        return <Navigate to={`/a/${applicationId}`} replace />
    }

    return <>{children}</>
}

export default ApplicationAdminGuard
