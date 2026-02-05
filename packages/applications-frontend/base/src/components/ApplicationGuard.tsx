import React from 'react'
import { ResourceGuard } from '@universo/template-mui'
import { getApplication } from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'

/**
 * Props for ApplicationGuard component
 */
export interface ApplicationGuardProps {
    /**
     * Child components to render if user has access to the application
     */
    children: React.ReactNode

    /**
     * Redirect path when access is denied
     * @default '/'
     */
    accessDeniedRedirectTo?: string
}

/**
 * Application route protection component
 *
 * Protects application routes by verifying user has access to the application.
 * Uses ResourceGuard with application-specific configuration.
 *
 * Expects `applicationId` to be present in URL params.
 *
 * @example
 * ```tsx
 * <Route
 *   path="/a/:applicationId/admin/*"
 *   element={
 *     <ApplicationGuard>
 *       <Outlet />
 *     </ApplicationGuard>
 *   }
 * />
 * ```
 */
export const ApplicationGuard: React.FC<ApplicationGuardProps> = ({ children, accessDeniedRedirectTo = '/' }) => {
    return (
        <ResourceGuard
            resourceType='application'
            resourceIdParam='applicationId'
            fetchResource={async (id: string) => {
                const response = await getApplication(id)
                return response.data
            }}
            queryKeyFn={applicationsQueryKeys.detail}
            accessDeniedRedirectTo={accessDeniedRedirectTo}
        >
            {children}
        </ResourceGuard>
    )
}

export default ApplicationGuard
