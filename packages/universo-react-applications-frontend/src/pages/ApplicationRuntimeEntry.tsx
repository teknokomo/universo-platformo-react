import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '@universo-react/auth-frontend'
import { isUuidV7 } from '@universo-react/utils'

import { resolveApplicationRuntimeReference } from '../api/applications'
import { isPublicApplicationUnavailableError } from '../api/publicApplicationRuntime'
import { applicationsQueryKeys } from '../api/queryKeys'
import { ApplicationGuard } from '../components/ApplicationGuard'
import ApplicationMigrationGuard from '../components/ApplicationMigrationGuard'
import ApplicationRuntime, { PublicApplicationRuntime } from './ApplicationRuntime'
import { usePublicApplicationRuntimeQuery } from './application-runtime/usePublicApplicationRuntimeQuery'

const RuntimeEntryLoader = () => {
    const { t } = useTranslation('applications')

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
            <CircularProgress aria-label={t('app.runtime.loading', 'Loading application')} />
        </Box>
    )
}

/**
 * Authenticated fallback for the deterministic `/a/:applicationRef/*` entry.
 *
 * It only runs after the anonymous public resolver reported the single generic
 * unavailable outcome. The reference is resolved through the dedicated
 * authenticated resolver under normal membership/global authorization and then
 * enters the existing ApplicationGuard -> ApplicationMigrationGuard ->
 * ApplicationRuntime path; an unresolvable reference keeps the neutral
 * unavailable page without offering a redundant sign-in action.
 */
const AuthenticatedApplicationRuntime = ({ applicationRef }: { applicationRef: string }) => {
    const isUuidReference = isUuidV7(applicationRef)
    const referenceQuery = useQuery({
        queryKey: applicationsQueryKeys.runtimeReference(applicationRef),
        queryFn: () => resolveApplicationRuntimeReference(applicationRef),
        enabled: !isUuidReference,
        retry: false,
        staleTime: 5 * 60 * 1000
    })

    if (!isUuidReference) {
        if (referenceQuery.isLoading) return <RuntimeEntryLoader />
        if (referenceQuery.isError || !referenceQuery.data?.applicationId) {
            // Unable to resolve the alias under normal authorization: keep the
            // neutral unavailable outcome for the visitor.
            return <PublicApplicationRuntime />
        }
    }

    const applicationId = isUuidReference ? applicationRef : (referenceQuery.data as { applicationId: string }).applicationId

    return (
        <ApplicationGuard applicationIdOverride={applicationId}>
            <ApplicationMigrationGuard applicationIdOverride={applicationId}>
                <ApplicationRuntime applicationIdOverride={applicationId} />
            </ApplicationMigrationGuard>
        </ApplicationGuard>
    )
}

/**
 * Deterministic route entry for `/a/:applicationRef/*`.
 *
 * 1. ready public application -> anonymous published-read runtime;
 * 2. generic unavailable outcome + anonymous session -> login page, uniformly
 *    for every unavailable reference (closed, unknown, archived, unpublished),
 *    so the redirect never discloses which private resource exists;
 * 3. generic unavailable outcome + authenticated session -> authenticated
 *    guard/runtime path;
 * 4. transient/retryable failures keep the public retry state.
 */
export const ApplicationRuntimeEntry = () => {
    const { applicationId: applicationRef = '' } = useParams<{ applicationId: string }>()
    const location = useLocation()
    const { isAuthenticated, loading: authLoading } = useAuth()
    const { publicRuntimeQuery } = usePublicApplicationRuntimeQuery(applicationRef)
    // A background refetch of the data-less probe flips the query back to
    // `pending`, which would unmount the live runtime tree (and its realtime
    // session) on reconnect. Keep the last settled branch until the refetch
    // actually settles so background refreshes never reset the runtime shell.
    const [settledState, setSettledState] = useState<{ applicationRef: string; unavailable: boolean } | null>(null)

    useEffect(() => {
        if (!publicRuntimeQuery.isFetched || publicRuntimeQuery.isFetching) return
        setSettledState({
            applicationRef,
            unavailable: publicRuntimeQuery.isError && isPublicApplicationUnavailableError(publicRuntimeQuery.error)
        })
    }, [applicationRef, publicRuntimeQuery.error, publicRuntimeQuery.isError, publicRuntimeQuery.isFetched, publicRuntimeQuery.isFetching])

    const settledUnavailable = settledState?.applicationRef === applicationRef ? settledState.unavailable : null

    if (settledUnavailable === null) return <RuntimeEntryLoader />

    if (!settledUnavailable) return <PublicApplicationRuntime />

    // Wait for the session state before choosing between the login page and the
    // authenticated runtime.
    if (authLoading) return <RuntimeEntryLoader />
    if (!isAuthenticated) {
        return <Navigate to='/auth' state={{ from: `${location.pathname}${location.search}` }} replace />
    }

    return <AuthenticatedApplicationRuntime applicationRef={applicationRef} />
}

export default ApplicationRuntimeEntry
