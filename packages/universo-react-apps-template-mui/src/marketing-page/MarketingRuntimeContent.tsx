import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useContext, useEffect, useMemo } from 'react'

import { fetchMarketingPageRuntime } from '../api/api'
import type { MarketingRuntimeTarget } from '../api/api'
import AppMainLayout, { AppMainLayoutContext } from '../layouts/AppMainLayout'
import MarketingPage from './MarketingPage'
import { normalizeMarketingPageRuntime } from './normalize'
import type { MarketingActionHandler, MarketingLayoutWidgetReference, MarketingPageData } from './types'

export interface MarketingRuntimeContentProps {
    applicationId: string
    locale: string
    apiBaseUrl: string
    workspaceId?: string | null
    target?: MarketingRuntimeTarget | null
    layoutIdentity?: {
        layoutVersion: number
        layoutHash: string
    }
    sharedLayoutWidgets?: readonly MarketingLayoutWidgetReference[]
    loadingLabel: string
    errorLabel: string
    retryLabel: string
    onAction?: MarketingActionHandler
    onLayoutStale?: () => void
}

const readHttpStatus = (error: unknown): number | null => {
    if (error && typeof error === 'object') {
        const candidate = error as {
            status?: unknown
            statusCode?: unknown
            response?: { status?: unknown }
        }
        const values = [candidate.status, candidate.statusCode, candidate.response?.status]
        for (const value of values) {
            if (typeof value === 'number' && Number.isInteger(value)) return value
        }
    }
    if (error instanceof Error) {
        const match = error.message.match(/\((\d{3})\)/)
        if (match) return Number(match[1])
    }
    return null
}

export const shouldRetryMarketingRuntime = (failureCount: number, error: unknown): boolean => {
    const status = readHttpStatus(error)
    return failureCount < 2 && status !== null && status >= 500 && status <= 599
}

export const isMarketingRuntimeLayoutStale = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false
    return (error as { code?: unknown }).code === 'MARKETING_RUNTIME_LAYOUT_STALE'
}

const RuntimeBoundary = ({
    children,
    error,
    loading,
    loadingLabel,
    errorLabel,
    retryLabel,
    onRetry
}: {
    children?: ReactNode
    error?: boolean
    loading?: boolean
    loadingLabel: string
    errorLabel: string
    retryLabel?: string
    onRetry?: () => void
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
                {onRetry && retryLabel ? (
                    <Button sx={{ mt: 2 }} variant='outlined' onClick={onRetry}>
                        {retryLabel}
                    </Button>
                ) : null}
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
    target,
    sharedLayoutWidgets,
    loadingLabel,
    errorLabel,
    retryLabel,
    layoutIdentity,
    onAction,
    onLayoutStale
}: MarketingRuntimeContentProps) {
    const normalizedWorkspaceId = workspaceId?.trim() || null
    const normalizedTarget = target
        ? {
              targetKind: target.targetKind ?? null,
              entityTypeId: target.entityTypeId?.trim() || null,
              entityTypeCodename: target.entityTypeCodename?.trim() || null,
              recordKey: target.recordKey?.trim() || null
          }
        : null
    const normalizedLayoutIdentity = layoutIdentity
        ? { layoutVersion: layoutIdentity.layoutVersion, layoutHash: layoutIdentity.layoutHash.trim() }
        : null
    const hostLayout = useContext(AppMainLayoutContext)
    const runtimeQuery = useQuery({
        queryKey: [
            'marketing-page-runtime',
            apiBaseUrl,
            applicationId,
            locale,
            normalizedWorkspaceId ?? 'default',
            normalizedTarget,
            normalizedLayoutIdentity
        ],
        queryFn: () =>
            fetchMarketingPageRuntime({
                apiBaseUrl,
                applicationId,
                locale,
                workspaceId: normalizedWorkspaceId,
                target: normalizedTarget,
                expectedLayoutHash: normalizedLayoutIdentity?.layoutHash
            }).then((response) => {
                if (
                    normalizedLayoutIdentity &&
                    (response.marketingPage.runtime.layoutHash !== normalizedLayoutIdentity.layoutHash ||
                        response.marketingPage.runtime.layoutVersion !== normalizedLayoutIdentity.layoutVersion)
                ) {
                    const error = new Error('Marketing runtime layout is stale')
                    Object.assign(error, { status: 409, code: 'MARKETING_RUNTIME_LAYOUT_STALE' })
                    throw error
                }
                return response
            }),
        enabled: Boolean(applicationId),
        retry: shouldRetryMarketingRuntime,
        retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 4_000)
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
        const retryStaleLayout = isMarketingRuntimeLayoutStale(runtimeQuery.error)
        return (
            <RuntimeBoundary
                error
                loadingLabel={loadingLabel}
                errorLabel={errorLabel}
                retryLabel={retryLabel}
                onRetry={() => {
                    if (retryStaleLayout && onLayoutStale) {
                        onLayoutStale()
                        return
                    }
                    void runtimeQuery.refetch()
                }}
            />
        )
    }

    if (!data) {
        return (
            <RuntimeBoundary
                error
                loadingLabel={loadingLabel}
                errorLabel={errorLabel}
                retryLabel={retryLabel}
                onRetry={() => void runtimeQuery.refetch()}
            />
        )
    }

    // Marketing actions are navigation-only in the published runtime. Lead
    // submission requires an explicit same-origin endpoint with its own auth,
    // CSRF, rate-limit, and persistence contract; never treat a navigation
    // callback as an email submission handler.
    const page = <MarketingPage data={data} sharedLayoutWidgets={sharedLayoutWidgets} onAction={onAction} />
    return hostLayout ? page : <AppMainLayout {...appearance}>{page}</AppMainLayout>
}
