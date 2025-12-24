import React from 'react'
import { ResourceGuard } from '@universo/template-mui'
import { getMetahub } from '../api/metahubs'
import { metahubsQueryKeys } from '../api/queryKeys'

/**
 * Props for MetahubGuard component
 */
export interface MetahubGuardProps {
    /**
     * Child components to render if user has access to the metahub
     */
    children: React.ReactNode

    /**
     * Redirect path when access is denied
     * @default '/'
     */
    accessDeniedRedirectTo?: string
}

/**
 * Metahub route protection component
 *
 * Protects metahub routes by verifying user has access to the metahub.
 * Uses ResourceGuard with metahub-specific configuration.
 *
 * Expects `metahubId` to be present in URL params.
 *
 * @example
 * ```tsx
 * <Route
 *   path="/metahub/:metahubId/*"
 *   element={
 *     <MetahubGuard>
 *       <Outlet />
 *     </MetahubGuard>
 *   }
 * />
 * ```
 */
export const MetahubGuard: React.FC<MetahubGuardProps> = ({ children, accessDeniedRedirectTo = '/' }) => {
    return (
        <ResourceGuard
            resourceType='metahub'
            resourceIdParam='metahubId'
            fetchResource={async (id: string) => {
                const response = await getMetahub(id)
                return response.data
            }}
            queryKeyFn={metahubsQueryKeys.detail}
            accessDeniedRedirectTo={accessDeniedRedirectTo}
        >
            {children}
        </ResourceGuard>
    )
}

export default MetahubGuard
