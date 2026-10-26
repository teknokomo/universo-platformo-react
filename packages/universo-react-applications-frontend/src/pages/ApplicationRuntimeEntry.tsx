import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '@universo-react/auth-frontend'

import { resolveApplicationRuntimeReference } from '../api/applications'
import { buildCanonicalApplicationRuntimePath, isPublicApplicationUnavailableError } from '../api/publicApplicationRuntime'
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
 * Authenticated branch for the deterministic `/a/:applicationRef/*` entry.
 *
 * The dedicated authenticated resolver checks membership/global authorization
 * for both UUIDs and aliases. Authorized users enter the existing
 * ApplicationGuard -> ApplicationMigrationGuard -> ApplicationRuntime path.
 * If the reference is unavailable or access is denied, the public renderer
 * remains a safe read-only fallback for published applications.
 */
const AuthenticatedApplicationRuntime = ({ applicationRef }: { applicationRef: string }) => {
    const { user } = useAuth()
    const referenceQuery = useQuery({
        // Authorization-sensitive resolution must not reuse another account's
        // cached result when the session changes in the same QueryClient.
        queryKey: [...applicationsQueryKeys.runtimeReference(applicationRef), user?.id ?? null],
        queryFn: () => resolveApplicationRuntimeReference(applicationRef),
        retry: false,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false
    })

    if (referenceQuery.isLoading || referenceQuery.isFetching) return <RuntimeEntryLoader />
    if (referenceQuery.isError || !referenceQuery.data?.applicationId) return <PublicApplicationRuntime />

    const applicationId = referenceQuery.data.applicationId

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
 * 1. a ready public application applies its canonical alias policy while
 *    preserving the remaining path, query and hash;
 * 2. anonymous ready/retryable public applications use the published-read
 *    runtime;
 * 3. authenticated sessions use protected resolution regardless of public
 *    bootstrap health; success opens the guarded runtime and denial falls back
 *    to published read-only content when available;
 * 4. generic unavailable outcome + anonymous session -> login page, uniformly
 *    for every unavailable reference (closed, unknown, archived, unpublished),
 *    so the redirect never discloses which private resource exists;
 * 5. generic unavailable outcome + authenticated session -> authenticated
 *    guard/runtime path.
 */
export const ApplicationRuntimeEntry = () => {
    const { applicationId: applicationRef = '', '*': remainingPath = '' } = useParams<{ applicationId: string; '*': string }>()
    const location = useLocation()
    const { isAuthenticated, loading: authLoading } = useAuth()
    const { publicRuntimeQuery } = usePublicApplicationRuntimeQuery(applicationRef)
    // A background refetch of the data-less probe flips the query back to
    // `pending`, which would unmount the live runtime tree (and its realtime
    // session) on reconnect. Keep the last settled branch until the refetch
    // actually settles so background refreshes never reset the runtime shell.
    const [settledState, setSettledState] = useState<{
        applicationRef: string
        status: 'ready' | 'unavailable' | 'retryable'
    } | null>(null)

    useEffect(() => {
        if (!publicRuntimeQuery.isFetched || publicRuntimeQuery.isFetching) return
        const status = !publicRuntimeQuery.isError
            ? 'ready'
            : isPublicApplicationUnavailableError(publicRuntimeQuery.error)
            ? 'unavailable'
            : 'retryable'
        setSettledState({
            applicationRef,
            status
        })
    }, [applicationRef, publicRuntimeQuery.error, publicRuntimeQuery.isError, publicRuntimeQuery.isFetched, publicRuntimeQuery.isFetching])

    const settledStatus = settledState?.applicationRef === applicationRef ? settledState.status : null

    const canonicalPath = publicRuntimeQuery.data
        ? buildCanonicalApplicationRuntimePath({
              applicationRef,
              canonicalAlias: publicRuntimeQuery.data.route.canonicalAlias,
              remainingPath,
              search: location.search,
              hash: location.hash
          })
        : null
    if (canonicalPath) return <Navigate to={canonicalPath} replace />

    // Wait for the session state before selecting the anonymous or protected
    // branch, so authenticated users do not briefly see the guest surface. Once
    // auth is settled, protected resolution must not depend on the independent
    // public bootstrap probe settling first.
    if (authLoading) return <RuntimeEntryLoader />
    if (isAuthenticated) return <AuthenticatedApplicationRuntime applicationRef={applicationRef} />

    if (settledStatus === null) return <RuntimeEntryLoader />
    if (settledStatus !== 'unavailable') return <PublicApplicationRuntime />
    // The hash belongs to the deep link: AuthPage navigates back through
    // `state.from`, so dropping it loses anchor navigation after login.
    return <Navigate to='/auth' state={{ from: `${location.pathname}${location.search}${location.hash}` }} replace />
}

export default ApplicationRuntimeEntry
