import React from 'react'
import { Box, Typography, Link } from '@mui/material'
import { useTranslation } from 'react-i18next'

/**
 * CompletionStep - Final step of onboarding wizard
 *
 * Shows an inspiring message about the platform's mission
 * and what happens next with user's selections.
 * Styled similar to WelcomeStep with hero image.
 */
export const CompletionStep: React.FC = () => {
    const { t } = useTranslation('onboarding')

    return (
        <Box>
            {/* Hero image - same style as WelcomeStep */}
            <Box
                component="img"
                src="/background-image.jpg"
                alt={t('completion.imageAlt')}
                sx={{
                    width: '100%',
                    height: { xs: 200, sm: 300, md: 400 },
                    objectFit: 'cover',
                    borderRadius: 2,
                    mb: 4
                }}
            />

            {/* Completion text */}
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                {t('completion.title')}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
                {t('completion.message1')}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
                {t('completion.message2')}
            </Typography>

            {/* Notice section */}
            <Box sx={{ mt: 3, mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    {t('completion.noticeTitle')}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {t('completion.noticeAlpha')}
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {t('completion.noticeUpdates')}{' '}
                        <Link href="https://github.com/teknokomo/universo-platformo-react" target="_blank" rel="noopener">
                            {t('completion.noticeUpdatesGitHub')}
                        </Link>{' '}
                        {t('completion.noticeUpdatesAnd')}{' '}
                        <Link href="https://gitverse.ru/teknokomo/universo-platformo-react" target="_blank" rel="noopener">
                            {t('completion.noticeUpdatesGitVerse')}
                        </Link>.
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                        {t('completion.noticeHelp')}{' '}
                        <Link href="https://boosty.to/universo" target="_blank" rel="noopener">
                            {t('completion.noticeHelpBoosty')}
                        </Link>.
                    </Typography>
                </Box>
            </Box>

            <Typography variant="h4" color="primary" sx={{ fontWeight: 700, mt: 3 }}>
                {t('completion.slogan')}
            </Typography>
        </Box>
    )
}
