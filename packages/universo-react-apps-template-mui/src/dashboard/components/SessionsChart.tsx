import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { LineChart } from '@mui/x-charts/LineChart'

export type SessionsChartSeries = {
    id: string
    label: string
    data: number[]
    stack?: string
    area?: boolean
}

export type SessionsChartProps = {
    title?: string
    value?: string
    interval?: string
    trendLabel?: string
    trend?: 'up' | 'down' | 'neutral'
    xAxisData?: string[]
    series?: SessionsChartSeries[]
    noDataText?: string
}

function AreaGradient({ color, id }: { color: string; id: string }) {
    return (
        <defs>
            <linearGradient id={id} x1='50%' y1='0%' x2='50%' y2='100%'>
                <stop offset='0%' stopColor={color} stopOpacity={0.5} />
                <stop offset='100%' stopColor={color} stopOpacity={0} />
            </linearGradient>
        </defs>
    )
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

const DEFAULT_SERIES: SessionsChartSeries[] = [
    {
        id: 'direct',
        label: 'Direct',
        stack: 'total',
        area: true,
        data: [
            300, 900, 600, 1200, 1500, 1800, 2400, 2100, 2700, 3000, 1800, 3300, 3600, 3900, 4200, 4500, 3900, 4800, 5100, 5400, 4800, 5700,
            6000, 6300, 6600, 6900, 7200, 7500, 7800, 8100
        ]
    },
    {
        id: 'referral',
        label: 'Referral',
        stack: 'total',
        area: true,
        data: [
            500, 900, 700, 1400, 1100, 1700, 2300, 2000, 2600, 2900, 2300, 3200, 3500, 3800, 4100, 4400, 2900, 4700, 5000, 5300, 5600, 5900,
            6200, 6500, 5600, 6800, 7100, 7400, 7700, 8000
        ]
    },
    {
        id: 'organic',
        label: 'Organic',
        stack: 'total',
        area: true,
        data: [
            1000, 1500, 1200, 1700, 1300, 2000, 2400, 2200, 2600, 2800, 2500, 3000, 3400, 3700, 3200, 3900, 4100, 3500, 4300, 4500, 4000,
            4700, 5000, 5200, 4800, 5400, 5600, 5900, 6100, 6300
        ]
    }
]

export default function SessionsChart({
    title = 'Sessions',
    value = '13,277',
    interval = 'Sessions per day for the last 30 days',
    trendLabel = '+35%',
    trend = 'up',
    xAxisData,
    series = DEFAULT_SERIES,
    noDataText
}: SessionsChartProps) {
    const theme = useTheme()
    const data = xAxisData === undefined ? getDaysInMonth(4, 2024) : xAxisData

    const colorPalette = [theme.palette.primary.light, theme.palette.primary.main, theme.palette.primary.dark]
    const chipColor = trend === 'up' ? 'success' : trend === 'down' ? 'error' : 'default'

    return (
        <Card variant='outlined' sx={{ width: '100%' }}>
            <CardContent>
                <Typography component='h2' variant='subtitle2' gutterBottom>
                    {title}
                </Typography>
                <Stack sx={{ justifyContent: 'space-between' }}>
                    <Stack
                        direction='row'
                        sx={{
                            alignContent: { xs: 'center', sm: 'flex-start' },
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        <Typography variant='h4' component='p'>
                            {value}
                        </Typography>
                        <Chip size='small' color={chipColor} label={trendLabel} />
                    </Stack>
                    <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                        {interval}
                    </Typography>
                </Stack>
                <LineChart
                    colors={colorPalette}
                    xAxis={[
                        {
                            scaleType: 'point',
                            data,
                            tickInterval: (index, i) => (i + 1) % 5 === 0,
                            height: 24
                        }
                    ]}
                    yAxis={[{ width: 50 }]}
                    series={series.map((item) => ({
                        ...item,
                        showMark: false,
                        curve: 'linear',
                        stackOrder: 'ascending',
                        area: item.area ?? true
                    }))}
                    height={250}
                    localeText={noDataText ? { noData: noDataText } : undefined}
                    margin={{ left: 0, right: 20, top: 20, bottom: 0 }}
                    grid={{ horizontal: true }}
                    sx={{
                        '& .MuiAreaElement-series-organic': {
                            fill: "url('#organic')"
                        },
                        '& .MuiAreaElement-series-referral': {
                            fill: "url('#referral')"
                        },
                        '& .MuiAreaElement-series-direct': {
                            fill: "url('#direct')"
                        }
                    }}
                    hideLegend
                >
                    <AreaGradient color={theme.palette.primary.dark} id='organic' />
                    <AreaGradient color={theme.palette.primary.main} id='referral' />
                    <AreaGradient color={theme.palette.primary.light} id='direct' />
                </LineChart>
            </CardContent>
        </Card>
    )
}
