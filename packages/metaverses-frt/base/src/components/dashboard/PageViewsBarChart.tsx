/**
 * DEMO DATA COMPONENT - In Development
 *
 * This chart displays demo data until real metrics are implemented.
 * Real data source: Future analytics service tracking resource usage/engagement.
 *
 * TODO: Replace with actual data when analytics infrastructure is ready.
 */

import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { BarChart } from '@mui/x-charts/BarChart'
import { useTranslation } from 'react-i18next'

export default function PageViewsBarChart() {
    const theme = useTheme()
    const { t } = useTranslation('metaverses')

    const colorPalette = [
        theme.palette.primary.light,
        theme.palette.primary.main,
        theme.palette.primary.dark
    ]

    return (
        <Card variant='outlined' sx={{ width: '100%' }}>
            <CardContent>
                <Typography component='h2' variant='subtitle2' gutterBottom>
                    {t('board.charts.resources.title')}
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
                            1.3M
                        </Typography>
                    </Stack>
                    <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                        {t('board.charts.resources.description')}
                    </Typography>
                </Stack>
                <BarChart
                    borderRadius={8}
                    colors={colorPalette}
                    xAxis={[
                        {
                            scaleType: 'band',
                            categoryGapRatio: 0.5,
                            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                        }
                    ]}
                    yAxis={[{}]}
                    series={[
                        {
                            id: 'page-views',
                            label: 'Page Views',
                            data: [2234, 3872, 2998, 4125, 3357, 2842, 4538, 3219, 4892, 3647, 5123, 4219],
                            stack: 'A'
                        },
                        {
                            id: 'downloads',
                            label: 'Downloads',
                            data: [3098, 4284, 3192, 4629, 3891, 3254, 4983, 3657, 5234, 4129, 5687, 4729],
                            stack: 'A'
                        },
                        {
                            id: 'conversions',
                            label: 'Conversions',
                            data: [4508, 5892, 4783, 6324, 5127, 4638, 6892, 5319, 7183, 5847, 7629, 6524],
                            stack: 'A'
                        }
                    ]}
                    height={250}
                    /* Provide inner padding so chart content doesn't hug card edges */
                    margin={{ left: 16, right: 16, top: 16, bottom: 24 }}
                    grid={{ horizontal: true }}
                    slotProps={{
                        legend: {
                            hidden: true
                        }
                    }}
                />
            </CardContent>
        </Card>
    )
}
