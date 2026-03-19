import React from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader } from '@universo/template-mui'
import { isAccessDeniedError } from '@universo/template-mui'
import { useAuth } from '@universo/auth-frontend'
import { getApplication } from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'

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
        refetchOnWindowFocus: false,
        refetchOnMount: 'always'
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

    const permissions = applicationQuery.data?.permissions
    const role = applicationQuery.data?.role
    const hasAccessSurface = typeof permissions?.manageApplication === 'boolean' || typeof role === 'string'

    if (!hasAccessSurface && applicationQuery.isFetching) {
        return <Loader />
    }

    const canManageApplication =
        typeof permissions?.manageApplication === 'boolean' ? permissions.manageApplication : role === 'owner' || role === 'admin'

    if (!canManageApplication) {
        return <Navigate to={`/a/${applicationId}`} replace />
    }

    return <>{children}</>
}

export default ApplicationAdminGuard
