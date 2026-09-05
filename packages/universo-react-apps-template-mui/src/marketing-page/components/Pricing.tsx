import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'

import type { MarketingActionHandler, MarketingPricingTier, MarketingSectionCopy } from '../types'
import {
    marketingSectionId,
    MarketingActionButton,
    MarketingEmptyState,
    MarketingSectionHeader,
    sortVisibleMarketingItems
} from './MarketingPrimitives'

const NUMERIC_PRICE_RE = /^\d+(?:\.\d+)?$/

const formatPrice = (price: string): string => (NUMERIC_PRICE_RE.test(price.trim()) ? `$${price}` : price)

export interface PricingProps {
    section: MarketingSectionCopy
    tiers: MarketingPricingTier[]
    instanceKey?: string
    onAction?: MarketingActionHandler
}

export default function Pricing({ section, tiers, instanceKey, onAction }: PricingProps) {
    const visibleTiers = sortVisibleMarketingItems(tiers)
    const sectionId = marketingSectionId('pricing', instanceKey)
    return (
        <Container
            id={sectionId}
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
            <MarketingSectionHeader section={section} id={sectionId} />
            {visibleTiers.length === 0 ? (
                <MarketingEmptyState section={section.title} />
            ) : (
                <Grid container spacing={3} sx={{ alignItems: 'stretch', justifyContent: 'center' }}>
                    {visibleTiers.map((tier) => (
                        <Grid size={{ xs: 12, sm: tier.semanticKey === 'enterprise' ? 12 : 6, md: 4 }} key={tier.semanticKey}>
                            <Card
                                sx={[
                                    { p: 2, display: 'flex', flexDirection: 'column', gap: 4, height: '100%' },
                                    tier.featured
                                        ? (theme) => ({
                                              border: 'none',
                                              background: 'radial-gradient(circle at 50% 0%, hsl(220, 20%, 35%), hsl(220, 30%, 6%))',
                                              boxShadow: '0 8px 12px hsla(220, 20%, 42%, 0.2)',
                                              ...theme.applyStyles('dark', {
                                                  background: 'radial-gradient(circle at 50% 0%, hsl(220, 20%, 20%), hsl(220, 30%, 16%))',
                                                  boxShadow: '0 8px 12px hsla(0, 0%, 0%, 0.8)'
                                              })
                                          })
                                        : {}
                                ]}
                            >
                                <CardContent>
                                    <Box
                                        sx={{
                                            mb: 1,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 2,
                                            color: tier.featured ? 'grey.100' : 'text.primary'
                                        }}
                                    >
                                        <Typography component='h3' variant='h6'>
                                            {tier.title}
                                        </Typography>
                                        {tier.badge ? <Chip icon={<AutoAwesomeIcon />} label={tier.badge} /> : null}
                                    </Box>
                                    <Box
                                        sx={{ display: 'flex', alignItems: 'baseline', color: tier.featured ? 'grey.50' : 'text.primary' }}
                                    >
                                        <Typography component='span' variant='h2'>
                                            {formatPrice(tier.price)}
                                        </Typography>
                                        <Typography component='span' variant='h6'>
                                            &nbsp;{tier.period}
                                        </Typography>
                                    </Box>
                                    <Divider sx={{ my: 2, opacity: 0.8, borderColor: 'divider' }} />
                                    {tier.benefits.map((benefit) => (
                                        <Box key={benefit} sx={{ py: 1, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                            <CheckCircleRoundedIcon
                                                sx={{ width: 20, color: tier.featured ? 'primary.light' : 'primary.main', flexShrink: 0 }}
                                            />
                                            <Typography
                                                variant='subtitle2'
                                                component='span'
                                                sx={{ color: tier.featured ? 'grey.50' : 'text.primary' }}
                                            >
                                                {benefit}
                                            </Typography>
                                        </Box>
                                    ))}
                                </CardContent>
                                <CardActions>
                                    <MarketingActionButton
                                        action={tier.action}
                                        onAction={onAction}
                                        fullWidth
                                        variant={tier.featured ? 'contained' : 'outlined'}
                                        color={tier.featured ? 'secondary' : 'primary'}
                                    >
                                        {tier.action?.label}
                                    </MarketingActionButton>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Container>
    )
}
