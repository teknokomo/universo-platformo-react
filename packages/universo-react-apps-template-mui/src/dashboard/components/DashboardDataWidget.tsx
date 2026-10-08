import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { dashboardWidgetConfigSchemaByKey } from '@universo-react/types'
import { ResourcePreview } from '../../components/resource-preview'
import type { ZoneWidgetItem } from '../contracts'
import DashboardEntityTableWidget from './DashboardEntityTableWidget'
import DashboardRelationBuilderWidget from './DashboardRelationBuilderWidget'
import StatCard from './StatCard'
import SessionsChart from './SessionsChart'
import PageViewsBarChart from './PageViewsBarChart'
import { RuntimeWidgetStatus, getMissingRuntimeDataState } from './RuntimeWidgetStatus'

export default function DashboardDataWidget({ widget }: { widget: ZoneWidgetItem }) {
    const { t, i18n } = useTranslation('apps')
    const state = widget.runtimeData ?? getMissingRuntimeDataState(widget.widgetKey)

    if (!state || state.status !== 'ready') return <RuntimeWidgetStatus state={state} />
    const payload = state.data

    if (['overviewTitle', 'detailsTitle'].includes(widget.widgetKey) && payload.kind === 'title') {
        const schema =
            widget.widgetKey === 'overviewTitle'
                ? dashboardWidgetConfigSchemaByKey.overviewTitle
                : dashboardWidgetConfigSchemaByKey.detailsTitle
        const config = schema.safeParse(widget.config)
        if (!config.success) return <RuntimeWidgetStatus invalid />
        return (
            <Typography component={config.data.level ?? 'h2'} variant='h6' align={config.data.align ?? 'left'}>
                {payload.text}
            </Typography>
        )
    }
    if (widget.widgetKey === 'infoCard' && payload.kind === 'info-card') {
        const config = dashboardWidgetConfigSchemaByKey.infoCard.safeParse(widget.config)
        if (!config.success) return <RuntimeWidgetStatus invalid />
        return (
            <Alert severity={config.data.severity ?? 'info'}>
                <Typography sx={{ fontWeight: 600 }}>{payload.title}</Typography>
                <Typography>{payload.body}</Typography>
            </Alert>
        )
    }
    if (widget.widgetKey === 'overviewCards' && payload.kind === 'metrics') {
        if (payload.cards.length === 0) return <RuntimeWidgetStatus state={{ status: 'empty' }} />
        return (
            <Grid container spacing={2}>
                {payload.cards.map((card, index) => (
                    <Grid key={`${index}:${card.label}`} size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={card.label}
                            value={card.value || t('dashboard.widget.emptyValue', '—')}
                            interval={t('dashboard.widget.resolvedSource', 'From the selected source')}
                            trend={card.trend ?? 'neutral'}
                            trendLabel={card.trendLabel ?? t(`dashboard.widget.trend.${card.trend ?? 'neutral'}`, 'No trend data')}
                            data={card.sparkline ?? []}
                        />
                    </Grid>
                ))}
            </Grid>
        )
    }
    if (['sessionsChart', 'pageViewsChart'].includes(widget.widgetKey) && payload.kind === 'series') {
        if (payload.labels.length === 0 || payload.series.length === 0) return <RuntimeWidgetStatus state={{ status: 'empty' }} />
        const schema =
            widget.widgetKey === 'sessionsChart'
                ? dashboardWidgetConfigSchemaByKey.sessionsChart
                : dashboardWidgetConfigSchemaByKey.pageViewsChart
        const config = schema.safeParse(widget.config)
        if (!config.success) return <RuntimeWidgetStatus invalid />
        const maxPoints = Math.min(config.data.maxPoints ?? payload.labels.length, payload.labels.length)
        const labels = payload.labels.slice(-maxPoints).map((label) => {
            if (!config.data.interval) return label
            const timestamp = new Date(label)
            if (Number.isNaN(timestamp.getTime())) return label
            const locale = i18n.resolvedLanguage || i18n.language || 'en'
            const options: Intl.DateTimeFormatOptions =
                config.data.interval === 'hour'
                    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }
                    : config.data.interval === 'month' || config.data.interval === 'quarter'
                    ? { year: 'numeric', month: 'short', timeZone: 'UTC' }
                    : { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }
            return new Intl.DateTimeFormat(locale, options).format(timestamp)
        })
        const defaultTitle =
            widget.widgetKey === 'sessionsChart'
                ? t('dashboard.widget.chartTitle.sessions', 'Sessions')
                : t('dashboard.widget.chartTitle.pageViews', 'Page views')
        const interval = config.data.interval
            ? t(`dashboard.widget.interval.${config.data.interval}`, config.data.interval)
            : t('dashboard.widget.resolvedSource', 'From the selected source')
        const chartStyle = config.data.chartStyle ?? (widget.widgetKey === 'sessionsChart' ? 'line' : 'bar')
        const series = payload.series.map((item) => ({
            id: item.id,
            label: item.label,
            data: item.values.slice(-maxPoints),
            stack: 'total'
        }))
        const chartProps = {
            title: payload.title || defaultTitle,
            value: '',
            interval,
            trend: 'neutral' as const,
            trendLabel: t('dashboard.widget.trend.neutral', 'No trend data'),
            xAxisData: labels,
            noDataText: t('dashboard.widget.empty', 'No content is available yet.')
        }
        return chartStyle === 'bar' ? (
            <PageViewsBarChart {...chartProps} series={series} />
        ) : (
            <SessionsChart {...chartProps} series={series.map((item) => ({ ...item, area: chartStyle === 'area' }))} />
        )
    }
    if (widget.widgetKey === 'detailsTable' && (payload.kind === 'table' || payload.kind === 'record')) {
        return <DashboardEntityTableWidget config={widget.config} payload={payload} />
    }
    if (widget.widgetKey === 'resourcePreview' && payload.kind === 'resource') {
        return <ResourcePreview source={payload.source} title={payload.title} />
    }
    if (widget.widgetKey === 'relationBuilder' && payload.kind === 'relation') {
        return <DashboardRelationBuilderWidget config={widget.config} payload={payload} />
    }
    return <RuntimeWidgetStatus invalid />
}
