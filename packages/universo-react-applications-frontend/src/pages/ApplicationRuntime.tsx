import { useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppMainLayout, getRuntimeLayoutErrorCode, MarketingRuntimeContent, RuntimeWorkspacesPage } from '@universo-react/apps-template-mui'
import { getApplicationEffectiveLayout } from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'
import type { ApplicationRuntimeTargetKind, ApplicationRuntimeThemeVariant } from '../types'
import { DashboardApplicationRuntime } from './application-runtime/DashboardApplicationRuntime'
import { normalizeRuntimeLocale, toMarketingLayoutWidgets, UUID_PATH_SEGMENT_REGEX } from './application-runtime/runtimeLayout'

const ApplicationRuntime = () => {
    const routeParams = useParams<{ applicationId: string; '*': string }>()
    const applicationId = routeParams.applicationId
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
                sharedLayoutWidgets={toMarketingLayoutWidgets(effectiveLayoutQuery.data)}
                onLayoutStale={() => void effectiveLayoutQuery.refetch()}
                loadingLabel={t('app.runtime.loading', 'Loading application')}
                errorLabel={runtimeLoadErrorMessage}
                retryLabel={t('app.common.retry', 'Retry')}
                onAction={(action) => {
                    if (action.actionKind === 'internal') navigate(action.href)
                }}
            />
        )
    }
    return <DashboardApplicationRuntime effectiveLayout={effectiveLayoutQuery.data} locale={requestedLocale} />
}

export default ApplicationRuntime
