import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { BarChart } from '@mui/x-charts/BarChart'
import { useTheme } from '@mui/material/styles'

export type PageViewsBarChartSeries = {
    id: string
    label: string
    data: number[]
    stack?: string
}

export type PageViewsBarChartProps = {
    title?: string
    value?: string
    interval?: string
    trendLabel?: string
    trend?: 'up' | 'down' | 'neutral'
    xAxisData?: string[]
    series?: PageViewsBarChartSeries[]
    noDataText?: string
}

const DEFAULT_X_AXIS_DATA = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
const DEFAULT_SERIES: PageViewsBarChartSeries[] = [
    {
        id: 'page-views',
        label: 'Page views',
        data: [2234, 3872, 2998, 4125, 3357, 2789, 2998],
        stack: 'A'
    },
    {
        id: 'downloads',
        label: 'Downloads',
        data: [3098, 4215, 2384, 2101, 4752, 3593, 2384],
        stack: 'A'
    },
    {
        id: 'conversions',
        label: 'Conversions',
        data: [4051, 2275, 3129, 4693, 3904, 2038, 2275],
        stack: 'A'
    }
]

export default function PageViewsBarChart({
    title = 'Page views and downloads',
    value = '1.3M',
    interval = 'Page views and downloads for the last 6 months',
    trendLabel = '-8%',
    trend = 'down',
    xAxisData,
    series = DEFAULT_SERIES,
    noDataText
}: PageViewsBarChartProps) {
    const theme = useTheme()
    const data = xAxisData === undefined ? DEFAULT_X_AXIS_DATA : xAxisData
    const colorPalette = [
        (theme.vars || theme).palette.primary.dark,
        (theme.vars || theme).palette.primary.main,
        (theme.vars || theme).palette.primary.light
    ]
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
                <BarChart
                    borderRadius={8}
                    colors={colorPalette}
                    xAxis={[
                        {
                            scaleType: 'band',
                            categoryGapRatio: 0.5,
                            data,
                            height: 24
                        }
                    ]}
                    yAxis={[{ width: 50 }]}
                    series={series}
                    height={250}
                    localeText={noDataText ? { noData: noDataText } : undefined}
                    margin={{ left: 0, right: 0, top: 20, bottom: 0 }}
                    grid={{ horizontal: true }}
                    hideLegend
                />
            </CardContent>
        </Card>
    )
}
