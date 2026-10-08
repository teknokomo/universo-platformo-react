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

export default function SessionsChart({
    title = '',
    value = '',
    interval = '',
    trendLabel = '',
    trend = 'neutral',
    xAxisData = [],
    series = [],
    noDataText
}: SessionsChartProps) {
    const theme = useTheme()
    const data = xAxisData

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
                            tickInterval: (_, index) => (index + 1) % 5 === 0,
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
