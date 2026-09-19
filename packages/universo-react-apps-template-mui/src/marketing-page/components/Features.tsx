import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

import type { MarketingCollectionWidgetSettings, MarketingFeature, MarketingSectionCopy } from '../types'
import {
    MarketingEmptyState,
    MarketingIcon,
    MarketingMediaView,
    marketingSectionId,
    MarketingSectionHeader,
    sortVisibleMarketingItems
} from './MarketingPrimitives'

const ITEMS_AREA_HEIGHT = 500

export interface FeaturesProps {
    section: MarketingSectionCopy
    items: MarketingFeature[]
    instanceKey?: string
    settings?: MarketingCollectionWidgetSettings
}

export default function Features({ section, items, instanceKey, settings }: FeaturesProps) {
    const sectionId = marketingSectionId('features', instanceKey)
    const visibleItems = sortVisibleMarketingItems(items)
    const [selectedItemIndex, setSelectedItemIndex] = React.useState(0)
    const selectedFeature = visibleItems[selectedItemIndex]
    const showItemDescriptions = settings?.showItemDescriptions ?? true
    const fixedItemsHeight = settings?.fixedItemsHeight ?? false

    if (visibleItems.length === 0) {
        return (
            <Container id={sectionId} sx={{ py: { xs: 8, sm: 16 } }}>
                <MarketingSectionHeader section={section} id={sectionId} />
                <MarketingEmptyState section={section.title} />
            </Container>
        )
    }

    return (
        <Container id={sectionId} sx={{ py: { xs: 8, sm: 16 } }}>
            <MarketingSectionHeader section={section} id={sectionId} />
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row-reverse' }, gap: 2, mt: { xs: 3, sm: 6 } }}>
                <Box
                    data-testid='marketing-features-items'
                    sx={{
                        display: { xs: 'none', sm: 'flex' },
                        flexDirection: 'column',
                        gap: 2,
                        width: { md: 'calc(30% - 8px)' },
                        minWidth: 0,
                        flexShrink: 0,
                        ...(fixedItemsHeight ? { maxHeight: ITEMS_AREA_HEIGHT, overflowY: 'auto' } : {})
                    }}
                >
                    {visibleItems.map((item, index) => (
                        <Box
                            key={item.semanticKey}
                            component={Button}
                            data-testid='marketing-feature-card'
                            onClick={() => setSelectedItemIndex(index)}
                            aria-pressed={selectedItemIndex === index}
                            sx={{
                                p: 2,
                                width: '100%',
                                minWidth: 0,
                                height: 'auto',
                                // Keep the card at its content height inside the
                                // scrollable fixed-height column; flex-shrinking it
                                // would overflow the text over the next card.
                                flexShrink: 0,
                                alignItems: 'flex-start',
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                bgcolor: selectedItemIndex === index ? 'action.selected' : undefined
                            }}
                        >
                            <Box
                                data-testid='marketing-feature-card-content'
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: 1,
                                    width: '100%',
                                    minWidth: 0,
                                    textTransform: 'none',
                                    color: selectedItemIndex === index ? 'text.primary' : 'text.secondary'
                                }}
                            >
                                <MarketingIcon name={item.icon} />
                                <Typography variant='h6' sx={{ overflowWrap: 'anywhere' }}>
                                    {item.title}
                                </Typography>
                                {showItemDescriptions ? (
                                    <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                                        {item.description}
                                    </Typography>
                                ) : null}
                            </Box>
                        </Box>
                    ))}
                </Box>
                <Box
                    sx={{
                        display: { xs: 'none', sm: 'flex' },
                        width: { xs: '100%', md: 'calc(70% - 8px)' },
                        minWidth: 0,
                        minHeight: 500,
                        flexShrink: 0
                    }}
                >
                    <Card variant='outlined' sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                        {selectedFeature?.media ? (
                            <MarketingMediaView
                                media={selectedFeature.media}
                                loading='eager'
                                sx={{ width: '100%', maxWidth: 520, height: 500, objectFit: 'contain' }}
                            />
                        ) : (
                            <MarketingIcon
                                name={selectedFeature?.icon}
                                data-testid='marketing-feature-placeholder-icon'
                                sx={{ fontSize: 96, color: 'text.disabled' }}
                            />
                        )}
                    </Card>
                </Box>
                <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                        {visibleItems.map((item, index) => (
                            <Chip
                                key={item.semanticKey}
                                label={item.title}
                                onClick={() => setSelectedItemIndex(index)}
                                aria-pressed={selectedItemIndex === index}
                                color={selectedItemIndex === index ? 'primary' : 'default'}
                                sx={
                                    selectedItemIndex === index
                                        ? {
                                              bgcolor: 'primary.dark',
                                              color: 'primary.contrastText',
                                              '&:hover': { bgcolor: 'primary.dark' },
                                              '& .MuiChip-label': { color: 'inherit' }
                                          }
                                        : undefined
                                }
                            />
                        ))}
                    </Box>
                    <Card variant='outlined'>
                        {selectedFeature?.media ? (
                            <MarketingMediaView
                                media={selectedFeature.media}
                                loading='eager'
                                sx={{ width: '100%', minHeight: 280, objectFit: 'cover' }}
                            />
                        ) : (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: 280
                                }}
                            >
                                <MarketingIcon
                                    name={selectedFeature?.icon}
                                    data-testid='marketing-feature-placeholder-icon'
                                    sx={{ fontSize: 72, color: 'text.disabled' }}
                                />
                            </Box>
                        )}
                        <Box sx={{ p: 2 }}>
                            <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
                                {selectedFeature?.title}
                            </Typography>
                            {showItemDescriptions ? (
                                <Typography
                                    variant='body2'
                                    sx={{
                                        color: 'text.secondary'
                                    }}
                                >
                                    {selectedFeature?.description}
                                </Typography>
                            ) : null}
                        </Box>
                    </Card>
                </Box>
            </Box>
        </Container>
    )
}
