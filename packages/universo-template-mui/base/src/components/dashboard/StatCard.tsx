import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { SparkLineChart } from '@mui/x-charts/SparkLineChart'
import { areaElementClasses } from '@mui/x-charts/LineChart'

export type StatCardProps = {
    title: string
    value: string | number
    interval: string
    trend?: 'up' | 'down' | 'neutral'
    trendPercentage?: string
    description?: string
    data?: number[]
    /**
     * Custom labels for x-axis. If not provided, uses current month's days.
     * Useful for demo data or custom date ranges.
     * @example ['Day 1', 'Day 2', 'Day 3', ...]
     */
    xAxisLabels?: string[]
}

function buildXAxisLabels(dataLength: number, labels: string[]) {
    if (!Number.isFinite(dataLength) || dataLength <= 0) return []

    const normalizedLength = Math.trunc(dataLength)

    if (labels.length >= normalizedLength) {
        return labels.slice(0, normalizedLength)
    }

    return Array.from({ length: normalizedLength }, (_, index) => labels[index] ?? `Point ${index + 1}`)
}

function getDaysInMonth(month: number, year: number) {
    const date = new Date(year, month, 0)
    const monthName = date.toLocaleDateString('en-US', {
        month: 'short'
    })
    const daysInMonth = date.getDate()
    const days = []
    let i = 1
    while (days.length < daysInMonth) {
        days.push(`${monthName} ${i}`)
        i += 1
    }
    return days
}

function AreaGradient({ color, id }: { color: string; id: string }) {
    return (
        <defs>
            <linearGradient id={id} x1='50%' y1='0%' x2='50%' y2='100%'>
                <stop offset='0%' stopColor={color} stopOpacity={0.3} />
                <stop offset='100%' stopColor={color} stopOpacity={0} />
            </linearGradient>
        </defs>
    )
}

export default function StatCard({ title, value, interval, trend, trendPercentage, description, data, xAxisLabels }: StatCardProps) {
    const theme = useTheme()

    // Generate default labels from current month if not provided
    const now = new Date()
    const defaultLabels = getDaysInMonth(now.getMonth() + 1, now.getFullYear())
    const baseLabels = xAxisLabels && xAxisLabels.length > 0 ? xAxisLabels : defaultLabels
    const chartLabels = buildXAxisLabels(data?.length ?? 0, baseLabels)

    const trendColors = {
        up: theme.palette.mode === 'light' ? theme.palette.success.main : theme.palette.success.dark,
        down: theme.palette.mode === 'light' ? theme.palette.error.main : theme.palette.error.dark,
        neutral: theme.palette.mode === 'light' ? theme.palette.grey[400] : theme.palette.grey[700]
    }

    const labelColors = {
        up: 'success' as const,
        down: 'error' as const,
        neutral: 'default' as const
    }

    // Use trend-based color if trend is provided, otherwise use primary color
    const chartColor = trend ? trendColors[trend] : theme.palette.primary.main

    // Default trend percentages (can be overridden via trendPercentage prop)
    const defaultTrendValues = { up: '+25%', down: '-25%', neutral: '+5%' }

    return (
        <Card variant='outlined' sx={{ height: '100%', flexGrow: 1 }}>
            <CardContent sx={{ pb: 2, '&:last-child': { pb: 2 } }}>
                <Typography component='h2' variant='subtitle2' gutterBottom noWrap title={title}>
                    {title}
                </Typography>
                <Stack direction='column' sx={{ justifyContent: 'space-between', flexGrow: '1', gap: 1 }}>
                    <Stack sx={{ justifyContent: 'space-between' }}>
                        <Stack direction='row' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant='h4' component='p'>
                                {value}
                            </Typography>
                            {trend && <Chip size='small' color={labelColors[trend]} label={trendPercentage || defaultTrendValues[trend]} />}
                        </Stack>
                        <Typography
                            variant='caption'
                            noWrap
                            title={interval}
                            sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                            {interval}
                        </Typography>
                        {description && (
                            <Typography
                                variant='caption'
                                noWrap
                                title={description}
                                sx={{ color: 'text.secondary', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                                {description}
                            </Typography>
                        )}
                    </Stack>
                    {data && data.length > 0 && (
                        <Box sx={{ width: '100%', height: 50 }}>
                            <SparkLineChart
                                color={chartColor}
                                data={data}
                                height={50}
                                area
                                showHighlight
                                showTooltip
                                xAxis={{
                                    scaleType: 'band',
                                    data: chartLabels
                                }}
                                sx={{
                                    [`& .${areaElementClasses.root}`]: {
                                        fill: `url(#area-gradient-${value})`
                                    }
                                }}
                            >
                                <AreaGradient color={chartColor} id={`area-gradient-${value}`} />
                            </SparkLineChart>
                        </Box>
                    )}
                </Stack>
            </CardContent>
        </Card>
    )
}
