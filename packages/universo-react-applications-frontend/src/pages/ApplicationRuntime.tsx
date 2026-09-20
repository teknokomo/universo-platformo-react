import { useEffect, type ComponentProps } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppMainLayout, getRuntimeLayoutErrorCode, MarketingRuntimeContent, RuntimeWorkspacesPage } from '@universo-react/apps-template-mui'
import { getApplicationEffectiveLayout } from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'
import { buildCanonicalApplicationRuntimePath, isPublicApplicationUnavailableError } from '../api/publicApplicationRuntime'
import type { ApplicationRuntimeTargetKind, ApplicationRuntimeThemeVariant } from '../types'
import { DashboardApplicationRuntime } from './application-runtime/DashboardApplicationRuntime'
import { normalizeRuntimeLocale, UUID_PATH_SEGMENT_REGEX } from './application-runtime/runtimeLayout'
import { usePublicApplicationRuntimeQuery } from './application-runtime/usePublicApplicationRuntimeQuery'

type MarketingRuntimeContentProps = ComponentProps<typeof MarketingRuntimeContent>

const publicRuntimeRemainingPath = (pathname: string, applicationRef: string, wildcardPath?: string): string => {
    const encodedPrefix = `/a/${encodeURIComponent(applicationRef)}`
    const plainPrefix = `/a/${applicationRef}`
    const prefix = pathname.startsWith(encodedPrefix) ? encodedPrefix : pathname.startsWith(plainPrefix) ? plainPrefix : null
    if (prefix) return pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '')
    return (wildcardPath ?? '').replace(/^\/+|\/+$/g, '')
}

export const PublicApplicationRuntime = () => {
    const routeParams = useParams<{ applicationRef?: string; applicationId?: string; '*': string }>()
    const applicationRef = routeParams.applicationRef ?? routeParams.applicationId ?? ''
    const location = useLocation()
    const navigate = useNavigate()
    const { t } = useTranslation('applications')
    // The route entry performs the first anonymous bootstrap fetch; this page
    // reuses that shared result instead of re-requesting the same payload.
    const { requestedLocale, publicRuntimeQuery } = usePublicApplicationRuntimeQuery(applicationRef, { refetchOnMount: false })
    const remainingPath = publicRuntimeRemainingPath(location.pathname, applicationRef, routeParams['*'])

    if (!applicationRef) {
        return <Alert severity='error'>{t('app.errors.missingApplicationId', 'Application ID is missing in URL')}</Alert>
    }

    if (publicRuntimeQuery.isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                <CircularProgress aria-label={t('app.runtime.loading', 'Loading application')} />
            </Box>
        )
    }

    if (publicRuntimeQuery.isError || !publicRuntimeQuery.data) {
        const unavailable = isPublicApplicationUnavailableError(publicRuntimeQuery.error)
        return (
            <Alert
                severity='error'
                action={
                    unavailable ? (
                        <Stack
                            direction='row'
                            spacing={1}
                            sx={{
                                flexWrap: 'wrap'
                            }}
                        >
                            <Button color='inherit' size='small' onClick={() => navigate('/')}>
                                {t('app.errors.goHome', 'Go home')}
                            </Button>
                        </Stack>
                    ) : (
                        <Button color='inherit' size='small' onClick={() => void publicRuntimeQuery.refetch()}>
                            {t('common.retry', 'Retry')}
                        </Button>
                    )
                }
            >
                {t(unavailable ? 'app.errors.applicationUnavailable' : 'app.errors.loadFailed', 'Failed to load runtime data')}
            </Alert>
        )
    }

    const publicRuntime = publicRuntimeQuery.data
    const canonicalPath = buildCanonicalApplicationRuntimePath({
        applicationRef,
        canonicalAlias: publicRuntime.route.canonicalAlias,
        remainingPath,
        search: location.search,
        hash: location.hash
    })
    if (canonicalPath) return <Navigate to={canonicalPath} replace />

    const runtimePayload = {
        templateKey: publicRuntime.templateKey,
        marketingPage: publicRuntime.marketingPage
    } as const

    // The public bootstrap already contains the renderer-safe marketing widget
    // placement. Header capabilities (including the language switcher) use the
    // layout rows when present and fall back to the data widgets on payloads
    // created before the header contract; no authenticated request is made.
    const headerWidgets = publicRuntime.marketingPage.headerWidgets
    const effectiveLayoutWidgets = (headerWidgets && headerWidgets.length > 0
        ? headerWidgets
        : publicRuntime.marketingPage.widgets) as unknown as MarketingRuntimeContentProps['effectiveLayoutWidgets']

    return (
        <MarketingRuntimeContent
            applicationId={applicationRef}
            locale={requestedLocale}
            apiBaseUrl='/api/v1'
            effectiveLayoutWidgets={effectiveLayoutWidgets}
            loadingLabel={t('app.runtime.loading', 'Loading application')}
            errorLabel={t('app.errors.loadFailed', 'Failed to load runtime data')}
            retryLabel={t('common.retry', 'Retry')}
            runtimePayload={runtimePayload}
            onAction={(action) => {
                if (action.actionKind === 'internal') navigate(action.href)
            }}
        />
    )
}

export interface ApplicationRuntimeProps {
    /** Trusted application id resolved from a human-readable runtime reference. */
    applicationIdOverride?: string
}

const ApplicationRuntime = ({ applicationIdOverride }: ApplicationRuntimeProps = {}) => {
    const routeParams = useParams<{ applicationId: string; '*': string }>()
    const applicationId = applicationIdOverride ?? routeParams.applicationId
    const navigate = useNavigate()
    const [runtimeSearchParams] = useSearchParams()
    const { t, i18n } = useTranslation('applications')
    const requestedWorkspaceId = runtimeSearchParams.get('workspaceId')?.trim() || null
    const targetKindParam = runtimeSearchParams.get('targetKind')?.trim().toLowerCase() ?? null
    const requestedTargetKind: ApplicationRuntimeTargetKind | null =
        targetKindParam === 'page' ? 'page' : targetKindParam === 'object' ? 'object' : null
    const requestedEntityTypeId = runtimeSearchParams.get('entityTypeId')?.trim() || null
    const requestedEntityTypeCodename = runtimeSearchParams.get('entityTypeCodename')?.trim() || null
    const requestedLocale = normalizeRuntimeLocale(runtimeSearchParams.get('locale') || i18n.resolvedLanguage || i18n.language)
    const themeVariantParam = runtimeSearchParams.get('themeVariant')?.trim().toLowerCase()
    const requestedThemeVariant: ApplicationRuntimeThemeVariant | null =
        themeVariantParam === 'light' ? 'light' : themeVariantParam === 'dark' ? 'dark' : themeVariantParam === 'system' ? 'system' : null
    const requestedMarketingTarget = {
        targetKind: requestedTargetKind,
        entityTypeId: requestedEntityTypeId,
        entityTypeCodename: requestedEntityTypeCodename,
        recordKey: runtimeSearchParams.get('recordKey')?.trim() || null
    }
    const runtimeRouteSegments = (routeParams['*'] ?? '').split('/').filter(Boolean)
    const isWorkspacesRoute = runtimeRouteSegments[0] === 'workspaces'
    const routeWorkspaceId =
        isWorkspacesRoute && UUID_PATH_SEGMENT_REGEX.test(runtimeRouteSegments[1] ?? '') ? runtimeRouteSegments[1] : null
    const workspaceRouteSection =
        isWorkspacesRoute && runtimeRouteSegments[2] === 'access'
            ? 'access'
            : isWorkspacesRoute && runtimeRouteSegments[2] === 'settings'
            ? 'settings'
            : 'dashboard'
    const hasInvalidTargetKind = targetKindParam !== null && requestedTargetKind === null
    const hasBothEntitySelectors = Boolean(requestedEntityTypeId && requestedEntityTypeCodename)
    const hasEntitySelectorWithoutKind = Boolean(!requestedTargetKind && (requestedEntityTypeId || requestedEntityTypeCodename))
    const hasEntityTargetWithoutSelector = Boolean(requestedTargetKind && !requestedEntityTypeId && !requestedEntityTypeCodename)
    const hasInvalidRuntimeTarget =
        hasInvalidTargetKind || hasBothEntitySelectors || hasEntitySelectorWithoutKind || hasEntityTargetWithoutSelector
    const runtimeLayoutTarget = {
        targetKind: requestedTargetKind,
        entityTypeId: requestedTargetKind && !hasBothEntitySelectors ? requestedEntityTypeId : null,
        entityTypeCodename: requestedTargetKind && !hasBothEntitySelectors ? requestedEntityTypeCodename : null,
        workspaceId: requestedWorkspaceId,
        locale: requestedLocale,
        themeVariant: requestedThemeVariant
    }
    const hasMarketingTarget = Boolean(
        (requestedTargetKind && (requestedEntityTypeId || requestedEntityTypeCodename)) || requestedMarketingTarget.recordKey
    )
    const effectiveLayoutQuery = useQuery({
        queryKey: applicationsQueryKeys.runtimeEffectiveLayout(applicationId ?? '', runtimeLayoutTarget),
        queryFn: () => getApplicationEffectiveLayout(applicationId as string, runtimeLayoutTarget),
        enabled: Boolean(applicationId) && !hasInvalidRuntimeTarget,
        staleTime: 60_000
    })
    const runtimeLayoutErrorCode = getRuntimeLayoutErrorCode(effectiveLayoutQuery.error)
    const runtimeLoadErrorMessage = runtimeLayoutErrorCode
        ? t(`app.errors.layout.${runtimeLayoutErrorCode}`, { defaultValue: t('app.errors.loadFailed', 'Failed to load runtime data') })
        : t('app.errors.loadFailed', 'Failed to load runtime data')

    useEffect(() => {
        const activeLocale = normalizeRuntimeLocale(i18n.resolvedLanguage || i18n.language)
        if (activeLocale !== requestedLocale && typeof i18n.changeLanguage === 'function') {
            void i18n.changeLanguage(requestedLocale)
        }
    }, [i18n, requestedLocale])

    if (!applicationId) return <Alert severity='error'>{t('app.errors.missingApplicationId', 'Application ID is missing in URL')}</Alert>
    if (hasInvalidRuntimeTarget) {
        return <Alert severity='error'>{t('app.errors.invalidRuntimeTarget', 'The runtime target in this URL is invalid')}</Alert>
    }
    if (effectiveLayoutQuery.isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                <CircularProgress aria-label={t('app.runtime.loading', 'Loading application')} />
            </Box>
        )
    }
    if (effectiveLayoutQuery.isError || !effectiveLayoutQuery.data)
        return (
            <Alert
                severity='error'
                action={
                    <Button color='inherit' size='small' onClick={() => void effectiveLayoutQuery.refetch()}>
                        {t('common.retry', 'Retry')}
                    </Button>
                }
            >
                {runtimeLoadErrorMessage}
            </Alert>
        )
    if (effectiveLayoutQuery.data.layout.templateKey === 'marketing-page') {
        if (isWorkspacesRoute) {
            return (
                <AppMainLayout>
                    <RuntimeWorkspacesPage
                        applicationId={applicationId}
                        apiBaseUrl='/api/v1'
                        locale={requestedLocale}
                        routeWorkspaceId={routeWorkspaceId}
                        routeSection={workspaceRouteSection}
                        onNavigate={navigate}
                    />
                </AppMainLayout>
            )
        }

        return (
            <MarketingRuntimeContent
                applicationId={applicationId}
                locale={requestedLocale}
                apiBaseUrl='/api/v1'
                workspaceId={requestedWorkspaceId}
                target={hasMarketingTarget ? requestedMarketingTarget : null}
                layoutIdentity={
                    effectiveLayoutQuery.data.effectiveHash
                        ? {
                              layoutVersion: effectiveLayoutQuery.data.layout.version ?? 1,
                              layoutHash: effectiveLayoutQuery.data.effectiveHash
                          }
                        : undefined
                }
                effectiveLayoutWidgets={effectiveLayoutQuery.data.widgets}
                effectiveLayoutConfig={effectiveLayoutQuery.data.layout}
                onLayoutStale={() => void effectiveLayoutQuery.refetch()}
                loadingLabel={t('app.runtime.loading', 'Loading application')}
                errorLabel={runtimeLoadErrorMessage}
                retryLabel={t('common.retry', 'Retry')}
                onAction={(action) => {
                    if (action.actionKind === 'internal') navigate(action.href)
                }}
            />
        )
    }
    return <DashboardApplicationRuntime effectiveLayout={effectiveLayoutQuery.data} locale={requestedLocale} />
}

export default ApplicationRuntime
