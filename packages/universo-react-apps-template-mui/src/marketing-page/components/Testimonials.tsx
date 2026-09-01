import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import type { MarketingSectionCopy, MarketingTestimonial } from '../types'
import { MarketingEmptyState, MarketingMediaView, MarketingSectionHeader, sortVisibleMarketingItems } from './MarketingPrimitives'

export interface TestimonialsProps {
    section: MarketingSectionCopy
    items: MarketingTestimonial[]
}

export default function Testimonials({ section, items }: TestimonialsProps) {
    const visibleItems = sortVisibleMarketingItems(items)
    return (
        <Container
            id='testimonials'
            sx={{
                pt: { xs: 4, sm: 12 },
                pb: { xs: 8, sm: 16 },
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: { xs: 3, sm: 6 }
            }}
        >
            <MarketingSectionHeader section={section} id='testimonials' />
            {visibleItems.length === 0 ? (
                <MarketingEmptyState section={section.title} />
            ) : (
                <Grid container spacing={2}>
                    {visibleItems.map((testimonial) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={testimonial.semanticKey} sx={{ display: 'flex' }}>
                            <Card
                                variant='outlined'
                                sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1 }}
                            >
                                <CardContent>
                                    <Typography variant='body1' gutterBottom sx={{ color: 'text.secondary' }}>
                                        {testimonial.quote}
                                    </Typography>
                                </CardContent>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        pr: 2
                                    }}
                                >
                                    <CardHeader
                                        avatar={
                                            testimonial.avatar ? (
                                                <MarketingMediaView
                                                    media={testimonial.avatar}
                                                    sx={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <Avatar>{testimonial.name.slice(0, 1)}</Avatar>
                                            )
                                        }
                                        title={testimonial.name}
                                        subheader={testimonial.role}
                                    />
                                    {testimonial.logo ? (
                                        <MarketingMediaView
                                            media={testimonial.logo}
                                            sx={{ width: 64, maxHeight: 48, objectFit: 'contain', opacity: 0.5 }}
                                        />
                                    ) : null}
                                </Box>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Container>
    )
}
