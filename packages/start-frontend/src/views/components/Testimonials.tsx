/**
 * Testimonials - Universo ecosystem product cards
 *
 * Displays 4 product cards in a grid:
 * - Universo Kompendio - Knowledge management
 * - Universo Platformo - Abstract management layer
 * - Universo Kiberplano - Planning and execution system
 * - Universo Grandaringo - Creative and media tools
 */
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import { useTranslation } from '@universo/i18n'

export default function Testimonials() {
    const { t } = useTranslation('landing')

    const universoProducts = [
        {
            titleKey: 'testimonials.kompendio.title',
            descriptionKey: 'testimonials.kompendio.description'
        },
        {
            titleKey: 'testimonials.platformo.title',
            descriptionKey: 'testimonials.platformo.description'
        },
        {
            titleKey: 'testimonials.kiberplano.title',
            descriptionKey: 'testimonials.kiberplano.description'
        },
        {
            titleKey: 'testimonials.grandaringo.title',
            descriptionKey: 'testimonials.grandaringo.description'
        }
    ]

    return (
        <Container
            id='testimonials'
            sx={{
                // Cards at bottom - minimal padding to match header spacing
                pt: { xs: 2, sm: 2 },
                pb: { xs: 0.8, sm: 0.8 },
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: { xs: 2, sm: 2 }
            }}
        >
            <Grid container spacing={2}>
                {universoProducts.map((product, index) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index} sx={{ display: 'flex' }}>
                        <Card
                            variant='outlined'
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                flexGrow: 1
                            }}
                        >
                            <CardContent>
                                <Typography variant='h6' component='h3' gutterBottom sx={{ fontWeight: 'bold' }}>
                                    <Typography
                                        component='span'
                                        sx={(theme) => ({
                                            color: 'primary.main',
                                            fontWeight: 'bold',
                                            fontSize: 'inherit',
                                            ...theme.applyStyles('dark', {
                                                color: 'primary.light'
                                            })
                                        })}
                                    >
                                        Universo
                                    </Typography>{' '}
                                    {t(product.titleKey)}
                                </Typography>
                                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                                    {t(product.descriptionKey)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Container>
    )
}
