import React from 'react'
import { ResourceGuard } from '@universo/template-mui'
import { getMetaverse } from '../api/metaverses'
import { metaversesQueryKeys } from '../api/queryKeys'

/**
 * Props for MetaverseGuard component
 */
export interface MetaverseGuardProps {
    /**
     * Child components to render if user has access to the metaverse
     */
    children: React.ReactNode

    /**
     * Redirect path when access is denied
     * @default '/'
     */
    accessDeniedRedirectTo?: string
}

/**
 * Metaverse route protection component
 *
 * Protects metaverse routes by verifying user has access to the metaverse.
 * Uses ResourceGuard with metaverse-specific configuration.
 *
 * Expects `metaverseId` to be present in URL params.
 *
 * @example
 * ```tsx
 * <Route
 *   path="/metaverse/:metaverseId/*"
 *   element={
 *     <MetaverseGuard>
 *       <Outlet />
 *     </MetaverseGuard>
 *   }
 * />
 * ```
 */
export const MetaverseGuard: React.FC<MetaverseGuardProps> = ({
    children,
    accessDeniedRedirectTo = '/'
}) => {
    return (
        <ResourceGuard
            resourceType="metaverse"
            resourceIdParam="metaverseId"
            fetchResource={async (id: string) => {
                const response = await getMetaverse(id)
                return response.data
            }}
            queryKeyFn={metaversesQueryKeys.detail}
            accessDeniedRedirectTo={accessDeniedRedirectTo}
        >
            {children}
        </ResourceGuard>
    )
}

export default MetaverseGuard
