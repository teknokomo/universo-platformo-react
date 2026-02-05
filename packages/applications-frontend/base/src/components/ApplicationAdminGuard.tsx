import React from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Loader } from '@universo/template-mui'
import { useAuth } from '@universo/auth-frontend'
import { getApplication } from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'
import type { ApplicationRole } from '../types'

const ALLOWED_ROLES: ApplicationRole[] = ['owner', 'admin', 'editor']

export interface ApplicationAdminGuardProps {
    children: React.ReactNode
}

const isAccessDenied = (error: unknown): boolean => {
    if (error instanceof AxiosError) {
        const status = error.response?.status
        return status === 403 || status === 404
    }

    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status
        return status === 403 || status === 404
    }

    return false
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
        if (isAccessDenied(applicationQuery.error)) {
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
