import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import type { MarketingHighlight, MarketingSectionCopy } from '../types'
import { MarketingEmptyState, MarketingIcon, MarketingSectionHeader, sortVisibleMarketingItems } from './MarketingPrimitives'

export interface HighlightsProps {
    section: MarketingSectionCopy
    items: MarketingHighlight[]
}

export default function Highlights({ section, items }: HighlightsProps) {
    const visibleItems = sortVisibleMarketingItems(items)
    return (
        <Box id='highlights' sx={{ pt: { xs: 4, sm: 12 }, pb: { xs: 8, sm: 16 }, color: 'white', bgcolor: 'grey.900' }}>
            <Container sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 3, sm: 6 } }}>
                <MarketingSectionHeader section={section} id='highlights' inverse />
                {visibleItems.length === 0 ? (
                    <MarketingEmptyState section={section.title} />
                ) : (
                    <Grid container spacing={2}>
                        {visibleItems.map((item) => (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.semanticKey}>
                                <Stack
                                    direction='column'
                                    component={Card}
                                    spacing={1}
                                    useFlexGap
                                    sx={{
                                        color: 'inherit',
                                        p: 3,
                                        height: '100%',
                                        borderColor: 'hsla(220, 25%, 25%, 0.3)',
                                        backgroundColor: 'grey.800'
                                    }}
                                >
                                    <Box sx={{ opacity: 0.5 }}>
                                        <MarketingIcon name={item.icon} />
                                    </Box>
                                    <Box>
                                        <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
                                            {item.title}
                                        </Typography>
                                        <Typography variant='body2' sx={{ color: 'grey.400' }}>
                                            {item.description}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Container>
        </Box>
    )
}
