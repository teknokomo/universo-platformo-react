import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { SparkLineChart } from '@mui/x-charts/SparkLineChart'
import { areaElementClasses } from '@mui/x-charts/LineChart'

export type StatCardProps = {
    title: string
    value: string | number
    interval: string
    description?: string
    data?: number[]
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

export default function StatCard({ title, value, interval, description, data }: StatCardProps) {
    const theme = useTheme()
    const chartColor = theme.palette.primary.main

    return (
        <Card variant='outlined' sx={{ height: '100%', flexGrow: 1 }}>
            <CardContent>
                <Typography component='h2' variant='subtitle2' gutterBottom>
                    {title}
                </Typography>
                <Stack direction='column' sx={{ justifyContent: 'space-between', flexGrow: '1', gap: 1 }}>
                    <Stack sx={{ justifyContent: 'space-between' }}>
                        <Typography variant='h4' component='p'>
                            {value}
                        </Typography>
                        <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                            {interval}
                        </Typography>
                        {description && (
                            <Typography variant='caption' sx={{ color: 'text.secondary', mt: 0.5 }}>
                                {description}
                            </Typography>
                        )}
                    </Stack>
                    {data && data.length > 0 && (
                        <Box sx={{ width: '100%', height: 50 }}>
                            <SparkLineChart
                                colors={[chartColor]}
                                data={data}
                                height={50}
                                area
                                showHighlight
                                showTooltip
                                xAxis={{
                                    scaleType: 'band',
                                    data: data.map((_, i) => i)
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
