import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import type { MarketingActionHandler, MarketingLogo, MarketingSectionCopy } from '../types'
import { MarketingActionLink, MarketingEmptyState, MarketingMediaView, sortVisibleMarketingItems } from './MarketingPrimitives'

export interface LogoCollectionProps {
    section: MarketingSectionCopy
    items: MarketingLogo[]
    onAction?: MarketingActionHandler
}

export default function LogoCollection({ section, items, onAction }: LogoCollectionProps) {
    const visibleItems = sortVisibleMarketingItems(items)
    return (
        <Box id='logoCollection' sx={{ py: 4 }}>
            <Container>
                <Typography component='h2' id='logoCollection-title' variant='subtitle2' align='center' sx={{ color: 'text.secondary' }}>
                    {section.title}
                </Typography>
                {visibleItems.length === 0 ? (
                    <MarketingEmptyState section={section.title} />
                ) : (
                    <Grid container sx={{ justifyContent: 'center', mt: 0.5, opacity: 0.6 }}>
                        {visibleItems.map((item) => (
                            <Grid key={item.semanticKey} size={{ xs: 6, sm: 4, md: 2 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                                {item.action ? (
                                    <MarketingActionLink action={item.action} onAction={onAction} sx={{ display: 'block', lineHeight: 0 }}>
                                        <MarketingMediaView
                                            media={item.media}
                                            sx={{ width: 100, height: 80, objectFit: 'contain', opacity: 0.8 }}
                                        />
                                    </MarketingActionLink>
                                ) : (
                                    <MarketingMediaView
                                        media={item.media}
                                        sx={{ width: 100, height: 80, objectFit: 'contain', opacity: 0.8 }}
                                    />
                                )}
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Container>
        </Box>
    )
}
