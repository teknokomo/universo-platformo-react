import { Alert, Card, CardContent, CardHeader, CircularProgress, Stack, Typography } from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { StatsViewerWidgetConfig } from '@universo/types'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { executeClientScriptMethod } from '../runtime/browserScriptRuntime'
import { createClientScriptContext, useRuntimeWidgetClientScript } from './runtimeWidgetHelpers'

type StatsSeries = {
    label: string
    values: number[]
}

type StatsModel = {
    title: string
    description?: string
    categories: string[]
    series: StatsSeries[]
}

const readString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)

const normalizeStatsModel = (value: unknown, fallbackTitle: string): StatsModel | null => {
    if (!value || typeof value !== 'object') return null
    const source = value as Record<string, unknown>

    const categories = Array.isArray(source.categories) ? source.categories.map((c) => String(c)) : []
    const rawSeries = Array.isArray(source.series) ? source.series : []

    const series: StatsSeries[] = rawSeries
        .map((s) => {
            if (!s || typeof s !== 'object') return null
            const raw = s as Record<string, unknown>
            return {
                label: readString(raw.label, ''),
                values: Array.isArray(raw.values) ? raw.values.map((v) => (typeof v === 'number' ? v : 0)) : []
            }
        })
        .filter((s): s is StatsSeries => s !== null)

    if (categories.length === 0) return null
    return {
        title: readString(source.title, fallbackTitle),
        description: readString(source.description, ''),
        categories,
        series
    }
}

export default function StatsViewerWidget({ config }: { config?: Record<string, unknown> }) {
    const { t, i18n } = useTranslation('apps')
    const details = useDashboardDetails()
    const widgetConfig = (config ?? {}) as StatsViewerWidgetConfig

    const applicationId = details?.applicationId
    const linkedCollectionId = details?.linkedCollectionId ?? null
    const apiBaseUrl = details?.apiBaseUrl ?? '/api/v1'
    const mountMethodName = widgetConfig.mountMethodName || 'mount'

    const { scriptsQuery, selectedScript, clientBundleQuery, clientBundle } = useRuntimeWidgetClientScript({
        queryKeyPrefix: 'stats-viewer',
        apiBaseUrl,
        applicationId,
        linkedCollectionId,
        scriptCodename: widgetConfig.scriptCodename,
        attachedToKind: widgetConfig.attachedToKind
    })

    const statsQuery = useQuery({
        queryKey: ['stats-viewer-model', selectedScript?.id, linkedCollectionId, mountMethodName],
        enabled: Boolean(applicationId && selectedScript && clientBundle),
        queryFn: async () => {
            if (!applicationId || !selectedScript || !clientBundle) return null
            if (!selectedScript.manifest.methods.some((method) => method.name === mountMethodName)) return null

            const rawModel = await executeClientScriptMethod({
                bundle: clientBundle,
                methodName: mountMethodName,
                args: [i18n.language],
                context: createClientScriptContext({ apiBaseUrl, applicationId, script: selectedScript })
            })

            return normalizeStatsModel(rawModel, t('statsViewer.defaultTitle', 'Statistics'))
        }
    })

    const statsModel = statsQuery.data

    if (!applicationId) {
        return (
            <Alert severity='info'>
                {t('statsViewer.missingContext', 'Stats viewer widget is available only inside the application runtime surface.')}
            </Alert>
        )
    }

    if (scriptsQuery.isLoading || clientBundleQuery.isLoading || statsQuery.isLoading) {
        return (
            <Card variant='outlined'>
                <CardContent>
                    <Stack direction='row' spacing={1.5} alignItems='center'>
                        <CircularProgress size={20} />
                        <Typography variant='body2'>{t('statsViewer.loading', 'Loading statistics...')}</Typography>
                    </Stack>
                </CardContent>
            </Card>
        )
    }

    if (scriptsQuery.isError) {
        return <Alert severity='error'>{t('statsViewer.loadScriptsError', 'Failed to load widget scripts.')}</Alert>
    }

    if (statsQuery.isError) {
        return <Alert severity='error'>{t('statsViewer.loadModelError', 'Failed to load statistics data.')}</Alert>
    }

    if (clientBundleQuery.isError) {
        return <Alert severity='error'>{t('statsViewer.loadBundleError', 'Failed to load the widget client bundle.')}</Alert>
    }

    if (!selectedScript || !statsModel) {
        return (
            <Card variant='outlined'>
                <CardHeader title={widgetConfig.emptyStateTitle || t('statsViewer.emptyTitle', 'Stats viewer is not configured')} />
                <CardContent>
                    <Typography variant='body2' color='text.secondary'>
                        {widgetConfig.emptyStateDescription ||
                            t(
                                'statsViewer.emptyDescription',
                                'Attach an active widget script and expose a mount() method to render statistics here.'
                            )}
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card variant='outlined'>
            <CardHeader title={statsModel.title} subheader={statsModel.description || undefined} />
            <CardContent>
                <BarChart
                    xAxis={[{ scaleType: 'band', data: statsModel.categories }]}
                    series={statsModel.series.map((s) => ({ label: s.label, data: s.values }))}
                    height={300}
                />
            </CardContent>
        </Card>
    )
}
