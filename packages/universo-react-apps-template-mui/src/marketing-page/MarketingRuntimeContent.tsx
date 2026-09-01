import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useContext, useEffect, useMemo } from 'react'

import { fetchMarketingPageRuntime } from '../api/api'
import AppMainLayout, { AppMainLayoutContext } from '../layouts/AppMainLayout'
import MarketingPage from './MarketingPage'
import { normalizeMarketingPageRuntime } from './normalize'
import type { MarketingActionHandler, MarketingPageData } from './types'

export interface MarketingRuntimeContentProps {
    applicationId: string
    locale: string
    apiBaseUrl: string
    workspaceId?: string | null
    loadingLabel: string
    errorLabel: string
    onAction?: MarketingActionHandler
}

const RuntimeBoundary = ({
    children,
    error,
    loading,
    loadingLabel,
    errorLabel
}: {
    children?: ReactNode
    error?: boolean
    loading?: boolean
    loadingLabel: string
    errorLabel: string
}) => {
    if (loading) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
                <CircularProgress aria-label={loadingLabel} />
            </Box>
        )
    }
    if (error) {
        return (
            <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
                <Alert severity='error'>{errorLabel}</Alert>
            </Box>
        )
    }
    return <>{children}</>
}

/**
 * Shared data-loading and shell boundary for hosted and standalone marketing
 * runtimes. Hosts only provide navigation/lead side effects and localized
 * boundary labels; the validated renderer and query contract stay identical.
 */
export default function MarketingRuntimeContent({
    applicationId,
    locale,
    apiBaseUrl,
    workspaceId,
    loadingLabel,
    errorLabel,
    onAction
}: MarketingRuntimeContentProps) {
    const normalizedWorkspaceId = workspaceId?.trim() || null
    const hostLayout = useContext(AppMainLayoutContext)
    const runtimeQuery = useQuery({
        queryKey: ['marketing-page-runtime', apiBaseUrl, applicationId, locale, normalizedWorkspaceId ?? 'default'],
        queryFn: () => fetchMarketingPageRuntime({ apiBaseUrl, applicationId, locale, workspaceId: normalizedWorkspaceId }),
        enabled: Boolean(applicationId)
    })

    let data: MarketingPageData | null = null
    if (runtimeQuery.data) {
        try {
            data = normalizeMarketingPageRuntime(runtimeQuery.data, locale)
        } catch {
            data = null
        }
    }

    const appearance = useMemo(
        () => ({
            defaultMode: data?.config?.themeMode,
            primaryColor: data?.config?.primaryColor,
            accentColor: data?.config?.accentColor
        }),
        [data?.config?.accentColor, data?.config?.primaryColor, data?.config?.themeMode]
    )
    const hasData = Boolean(data)

    useEffect(() => {
        if (!hostLayout || !hasData) return
        hostLayout.setAppearance(appearance)
        return () => hostLayout.setAppearance(null)
    }, [appearance, hasData, hostLayout])

    if (runtimeQuery.isLoading) {
        return <RuntimeBoundary loading loadingLabel={loadingLabel} errorLabel={errorLabel} />
    }
    if (runtimeQuery.isError || !runtimeQuery.data) {
        return <RuntimeBoundary error loadingLabel={loadingLabel} errorLabel={errorLabel} />
    }

    if (!data) {
        return <RuntimeBoundary error loadingLabel={loadingLabel} errorLabel={errorLabel} />
    }

    // Marketing actions are navigation-only in the published runtime. Lead
    // submission requires an explicit same-origin endpoint with its own auth,
    // CSRF, rate-limit, and persistence contract; never treat a navigation
    // callback as an email submission handler.
    const page = <MarketingPage data={data} onAction={onAction} />
    return hostLayout ? page : <AppMainLayout {...appearance}>{page}</AppMainLayout>
}
