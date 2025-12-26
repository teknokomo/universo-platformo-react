import React from 'react'
import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

/**
 * WelcomeStep - First step of onboarding wizard
 *
 * Shows:
 * - Hero image spanning full width
 * - Welcome text with project description
 */
export const WelcomeStep: React.FC = () => {
    const { t } = useTranslation('onboarding')

    return (
        <Box>
            {/* Hero image */}
            <Box
                component="img"
                src="/start-mars.jpg"
                alt={t('welcome.imageAlt')}
                sx={{
                    width: '100%',
                    height: { xs: 200, sm: 300, md: 400 },
                    objectFit: 'cover',
                    borderRadius: 2,
                    mb: 4
                }}
            />

            {/* Welcome text */}
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                {t('welcome.title')}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
                {t('welcome.intro')}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
                {t('welcome.description1')}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
                {t('welcome.description2')}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                {t('welcome.description3')}
            </Typography>
        </Box>
    )
}
