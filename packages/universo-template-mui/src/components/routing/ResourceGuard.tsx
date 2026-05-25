import React from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useQuery, QueryKey } from '@tanstack/react-query'
import { useAuth } from '@universo/auth-frontend'

// Local imports
import { Loader } from '../feedback/loading'
import { isAccessDeniedError } from '../../utils/httpErrors'

/**
 * Props for ResourceGuard component
 */
export interface ResourceGuardProps {
    /**
     * Child components to render if user has access to the resource
     */
    children: React.ReactNode

    /**
     * Resource type identifier for query cache
     * @example 'metaverse', 'project', 'cluster'
     */
    resourceType: string

    /**
     * URL parameter name containing the resource ID
     * @example 'metaverseId', 'projectId'
     */
    resourceIdParam: string

    /**
     * Function to fetch the resource. Should throw on 403/404.
     */
    fetchResource: (id: string) => Promise<unknown>

    /**
     * Query key factory function for TanStack Query cache
     */
    queryKeyFn: (id: string) => QueryKey

    /**
     * Redirect path for unauthenticated users
     * @default '/auth'
     */
    authRedirectTo?: string

    /**
     * Redirect path when access is denied (403/404)
     * @default '/'
     */
    accessDeniedRedirectTo?: string
}

/**
 * Resource route protection component for Universo Platformo
 *
 * Protects resource routes by:
 * 1. Checking authentication status (redirects to /auth if not authenticated)
 * 2. Fetching the resource to verify access (redirects to / on 403/404)
 * 3. Caching the fetched data for use by child components
 *
 * This guard uses TanStack Query to fetch and cache the resource data,
 * preventing duplicate API calls when child components use the same query key.
 *
 * @example Metaverse protection
 * ```tsx
 * import { ResourceGuard } from '@universo/template-mui'
 * import { getMetaverse } from '@universo/metaverses-frontend/api/metaverses'
 * import { metaversesQueryKeys } from '@universo/metaverses-frontend/api/queryKeys'
 *
 * <Route
 *   path="/metaverse/:metaverseId/*"
 *   element={
 *     <ResourceGuard
 *       resourceType="metaverse"
 *       resourceIdParam="metaverseId"
 *       fetchResource={(id) => getMetaverse(id).then(r => r.data)}
 *       queryKeyFn={metaversesQueryKeys.detail}
 *     >
 *       <MetaverseLayout />
 *     </ResourceGuard>
 *   }
 * />
 * ```
 */
export const ResourceGuard: React.FC<ResourceGuardProps> = ({
    children,
    resourceType,
    resourceIdParam,
    fetchResource,
    queryKeyFn,
    authRedirectTo = '/auth',
    accessDeniedRedirectTo = '/'
}) => {
    const { isAuthenticated, loading: authLoading } = useAuth()
    const location = useLocation()
    const params = useParams()

    // Extract resource ID from URL params
    const resourceId = params[resourceIdParam]

    // Fetch resource to verify access
    // Uses the same query key as child components to share cached data
    const {
        isLoading: resourceLoading,
        error,
        isError
    } = useQuery({
        queryKey: queryKeyFn(resourceId || ''),
        queryFn: () => fetchResource(resourceId || ''),
        enabled: isAuthenticated && Boolean(resourceId),
        retry: false, // Don't retry on 403/404
        staleTime: 5 * 60 * 1000, // 5 minutes - same as typical page queries
        refetchOnWindowFocus: false
    })

    // Show loader while checking authentication
    if (authLoading) {
        return <Loader />
    }

    // Redirect to auth page if not authenticated
    if (!isAuthenticated) {
        return <Navigate to={authRedirectTo} state={{ from: location.pathname }} replace />
    }

    // Missing resource ID in URL - redirect to home
    if (!resourceId) {
        console.warn(`[ResourceGuard] Missing ${resourceIdParam} in URL params`)
        return <Navigate to={accessDeniedRedirectTo} replace />
    }

    // Show loader while fetching resource
    if (resourceLoading) {
        return <Loader />
    }

    // Redirect on access denied (403) or not found (404)
    if (isError && isAccessDeniedError(error)) {
        return <Navigate to={accessDeniedRedirectTo} replace />
    }

    // For other errors, still redirect to prevent showing broken UI
    // This is a security measure - don't reveal error details
    if (isError) {
        console.error(`[ResourceGuard] Error fetching ${resourceType}:`, error)
        return <Navigate to={accessDeniedRedirectTo} replace />
    }

    // Render protected content if access is verified
    return <>{children}</>
}
