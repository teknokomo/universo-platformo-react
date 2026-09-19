import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import type { MarketingActionHandler, MarketingLogo, MarketingSectionCopy } from '../types'
import {
    marketingSectionId,
    MarketingActionLink,
    MarketingEmptyState,
    MarketingMediaView,
    sortVisibleMarketingItems
} from './MarketingPrimitives'

export interface LogoCollectionProps {
    section: MarketingSectionCopy
    items: MarketingLogo[]
    instanceKey?: string
    onAction?: MarketingActionHandler
}

export default function LogoCollection({ section, items, instanceKey, onAction }: LogoCollectionProps) {
    const visibleItems = sortVisibleMarketingItems(items)
    const sectionId = marketingSectionId('logoCollection', instanceKey)
    const hasMedia = (media?: MarketingLogo['media']): boolean =>
        Boolean(
            media?.src ||
                media?.resource?.url ||
                media?.resource?.storageKey ||
                media?.darkSrc ||
                media?.darkResource?.url ||
                media?.darkResource?.storageKey
        )

    return (
        <Box id={sectionId} sx={{ py: 4 }}>
            <Container>
                {section.showTitle !== false && section.title ? (
                    <Typography
                        component='h2'
                        id={`${sectionId}-title`}
                        variant='subtitle2'
                        align='center'
                        sx={{ color: 'text.secondary' }}
                    >
                        {section.title}
                    </Typography>
                ) : null}
                {visibleItems.length === 0 ? (
                    <MarketingEmptyState section={section.title} />
                ) : (
                    <Grid container sx={{ justifyContent: 'center', mt: 0.5, opacity: 0.6 }}>
                        {visibleItems.map((item) => (
                            <Grid key={item.semanticKey} size={{ xs: 6, sm: 4, md: 2 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                                {!hasMedia(item.media) ? (
                                    item.action ? (
                                        <MarketingActionLink action={item.action} onAction={onAction} sx={{ display: 'block' }}>
                                            <Typography
                                                variant='body2'
                                                component='span'
                                                sx={{
                                                    width: 100,
                                                    minHeight: 80,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {item.name}
                                            </Typography>
                                        </MarketingActionLink>
                                    ) : (
                                        <Typography
                                            variant='body2'
                                            component='span'
                                            sx={{
                                                width: 100,
                                                minHeight: 80,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {item.name}
                                        </Typography>
                                    )
                                ) : item.action ? (
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
