import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'

import type {
    MarketingActionHandler,
    MarketingPricingCardStyle,
    MarketingPricingCardWidth,
    MarketingPricingTier,
    MarketingSectionCopy
} from '../types'
import {
    marketingSectionId,
    MarketingActionButton,
    MarketingEmptyState,
    MarketingSectionHeader,
    sortVisibleMarketingItems
} from './MarketingPrimitives'

export interface PricingProps {
    section: MarketingSectionCopy
    tiers: MarketingPricingTier[]
    instanceKey?: string
    /** `uniform` disables the featured tier styling so every card looks equal. */
    cardStyle?: MarketingPricingCardStyle
    /** `full` widens the section container so the cards fill more of the viewport. */
    cardWidth?: MarketingPricingCardWidth
    /** Hides the benefit lists when a compact pricing section is requested. */
    showBenefits?: boolean
    onAction?: MarketingActionHandler
}

export default function Pricing({
    section,
    tiers,
    instanceKey,
    cardStyle = 'featured',
    cardWidth = 'auto',
    showBenefits = true,
    onAction
}: PricingProps) {
    const visibleTiers = sortVisibleMarketingItems(tiers)
    const sectionId = marketingSectionId('pricing', instanceKey)
    const uniform = cardStyle === 'uniform'
    const sizeForTier = (tier: MarketingPricingTier) =>
        uniform || tier.semanticKey !== 'enterprise' ? ({ xs: 12, sm: 6, md: 4 } as const) : ({ xs: 12, sm: 12, md: 4 } as const)
    return (
        <Container
            id={sectionId}
            maxWidth={cardWidth === 'full' ? 'xl' : 'lg'}
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
                <Grid
                    container
                    spacing={3}
                    data-testid='marketing-pricing-grid'
                    sx={{ width: '100%', alignItems: 'stretch', justifyContent: 'center' }}
                >
                    {visibleTiers.map((tier) => {
                        const featured = !uniform && Boolean(tier.featured)
                        return (
                            <Grid size={sizeForTier(tier)} key={tier.semanticKey}>
                                <Card
                                    sx={[
                                        { p: 2, display: 'flex', flexDirection: 'column', gap: 4, height: '100%' },
                                        featured
                                            ? (theme) => ({
                                                  border: 'none',
                                                  background: 'radial-gradient(circle at 50% 0%, hsl(220, 20%, 35%), hsl(220, 30%, 6%))',
                                                  boxShadow: '0 8px 12px hsla(220, 20%, 42%, 0.2)',
                                                  ...theme.applyStyles('dark', {
                                                      background:
                                                          'radial-gradient(circle at 50% 0%, hsl(220, 20%, 20%), hsl(220, 30%, 16%))',
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
                                                color: featured ? 'grey.100' : 'text.primary'
                                            }}
                                        >
                                            <Typography component='h3' variant='h6'>
                                                {tier.title}
                                            </Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'baseline',
                                                color: featured ? 'grey.50' : 'text.primary'
                                            }}
                                        >
                                            <Typography component='span' variant='h2'>
                                                {tier.price}
                                            </Typography>
                                            <Typography component='span' variant='h6'>
                                                &nbsp;{tier.period}
                                            </Typography>
                                        </Box>
                                        {tier.description ? (
                                            <Typography
                                                variant='body2'
                                                component='p'
                                                sx={{ mt: 1, color: featured ? 'grey.100' : 'text.secondary' }}
                                            >
                                                {tier.description}
                                            </Typography>
                                        ) : null}
                                        {showBenefits && tier.benefits.length > 0 ? (
                                            <>
                                                <Divider sx={{ my: 2, opacity: 0.8, borderColor: 'divider' }} />
                                                {tier.benefits.map((benefit, benefitIndex) => (
                                                    <Box
                                                        key={`${tier.semanticKey}-benefit-${benefitIndex}`}
                                                        sx={{ py: 1, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
                                                    >
                                                        <CheckCircleRoundedIcon
                                                            sx={{
                                                                width: 20,
                                                                color: featured ? 'primary.light' : 'primary.main',
                                                                flexShrink: 0
                                                            }}
                                                        />
                                                        <Typography
                                                            variant='subtitle2'
                                                            component='span'
                                                            sx={{ color: featured ? 'grey.50' : 'text.primary' }}
                                                        >
                                                            {benefit}
                                                        </Typography>
                                                    </Box>
                                                ))}
                                            </>
                                        ) : null}
                                    </CardContent>
                                    <CardActions>
                                        <MarketingActionButton
                                            action={tier.action}
                                            onAction={onAction}
                                            fullWidth
                                            variant={featured ? 'contained' : 'outlined'}
                                            color={featured ? 'secondary' : 'primary'}
                                        >
                                            {tier.action?.label}
                                        </MarketingActionButton>
                                    </CardActions>
                                </Card>
                            </Grid>
                        )
                    })}
                </Grid>
            )}
        </Container>
    )
}
